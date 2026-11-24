-- =====================================================================
-- Sagewood Credits - database schema, RLS and seed data
-- Run once in Supabase: SQL Editor > New query > paste > Run.
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------- enums ----------
do $$ begin
  create type user_role as enum ('customer', 'admin');
  create type payment_status as enum ('pending', 'submitted', 'under_verification', 'approved', 'rejected');
  create type fulfillment_status as enum ('not_started', 'processing', 'fulfilled', 'cancelled', 'refund_requested', 'refunded');
exception when duplicate_object then null; end $$;

-- ---------- helpers ----------
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------- profiles (the "users" table) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text not null,
  country text check (country is null or country ~ '^[A-Z]{2}$'),
  preferred_language text not null default 'en',
  preferred_currency text check (preferred_currency is null or preferred_currency ~ '^[A-Z]{3}$'),
  role user_role not null default 'customer',
  is_suspended boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists profiles_country_idx on public.profiles(country);
create index if not exists profiles_created_idx on public.profiles(created_at desc);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), new.email)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and not is_suspended)
$$;

-- A signed-in user (JWT present) can never change role / suspension / email / id.
-- The service role and the SQL editor have no JWT, so they can.
create or replace function public.protect_profile() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and (
       new.role is distinct from old.role
    or new.is_suspended is distinct from old.is_suspended
    or new.email is distinct from old.email
    or new.id is distinct from old.id) then
    raise exception 'protected column';
  end if;
  return new;
end $$;
drop trigger if exists protect_profile_trg on public.profiles;
create trigger protect_profile_trg before update on public.profiles
  for each row execute function public.protect_profile();

-- ---------- packages ----------
create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  description text not null default '',
  -- What the credits can be redeemed for. REQUIRED before a package can go live,
  -- and shown to customers on the card, at checkout and in the order.
  redeemable_for text not null default '',
  credit_quantity integer not null check (credit_quantity > 0),
  base_price numeric(12,2) not null check (base_price >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  promo_price numeric(12,2) check (promo_price is null or promo_price >= 0),
  promo_ends_at timestamptz,
  is_active boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint active_requires_redeemable check (not is_active or length(trim(redeemable_for)) >= 20)
);
drop trigger if exists packages_touch on public.packages;
create trigger packages_touch before update on public.packages for each row execute function public.touch_updated_at();

-- Fixed prices for particular markets (override conversion)
create table if not exists public.package_prices (
  package_id uuid not null references public.packages(id) on delete cascade,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  price numeric(12,2) not null check (price >= 0),
  primary key (package_id, currency)
);

-- ---------- settings ----------
-- Keys starting with 'private.' are readable by admins / the server only.
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
drop trigger if exists settings_touch on public.site_settings;
create trigger settings_touch before update on public.site_settings for each row execute function public.touch_updated_at();

-- ---------- languages / translations ----------
create table if not exists public.languages (
  code text primary key check (code ~ '^[a-z]{2,3}(-[A-Za-z]{2,4})?$'),
  name text not null,
  native_name text not null,
  is_rtl boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0
);
create table if not exists public.translations (
  id uuid primary key default gen_random_uuid(),
  language_code text not null references public.languages(code) on delete cascade,
  translation_key text not null,
  translation_value text not null,
  unique (language_code, translation_key)
);

-- ---------- orders ----------
create table if not exists public.order_counters (
  year integer primary key,
  last_value integer not null default 0
);

create or replace function public.next_order_number() returns text language plpgsql as $$
declare y integer := extract(year from now())::integer; n integer;
begin
  insert into public.order_counters(year, last_value) values (y, 1)
  on conflict (year) do update set last_value = public.order_counters.last_value + 1
  returning last_value into n;
  return format('ORD-%s-%s', y, lpad(n::text, 6, '0'));
end $$;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),            -- unguessable id used in URLs
  order_number text not null unique default public.next_order_number(),
  user_id uuid not null references public.profiles(id),
  package_id uuid references public.packages(id) on delete set null,
  -- snapshots: later package edits never change an existing order
  package_name text not null,
  redeemable_for text not null,
  credit_quantity integer not null check (credit_quantity > 0),
  quantity integer not null default 1 check (quantity between 1 and 10),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  total_price numeric(12,2) not null check (total_price >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  price_is_estimate boolean not null default false,
  payment_status payment_status not null default 'pending',
  fulfillment_status fulfillment_status not null default 'not_started',
  status_before_refund fulfillment_status,
  customer_country text not null check (customer_country ~ '^[A-Z]{2}$'),
  terms_accepted_at timestamptz not null,
  proof_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- fulfilment can never start before payment was approved by an admin
  constraint fulfil_needs_payment check (
    fulfillment_status in ('not_started', 'cancelled', 'refund_requested', 'refunded') or payment_status = 'approved')
);
create index if not exists orders_user_idx on public.orders(user_id, created_at desc);
create index if not exists orders_status_idx on public.orders(payment_status, fulfillment_status);
create index if not exists orders_created_idx on public.orders(created_at desc);
drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();

create table if not exists public.order_notes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  administrator_id uuid references public.profiles(id),
  note text not null check (length(note) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists order_notes_order_idx on public.order_notes(order_id, created_at desc);

-- ---------- support / logs ----------
create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  subject text not null check (length(subject) between 1 and 150),
  message text not null check (length(message) between 1 and 4000),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  recipient text not null,
  event_type text not null,
  category text not null,
  dedupe_key text not null unique,                          -- prevents duplicate emails
  subject text not null,
  html text not null,
  delivery_status text not null default 'pending' check (delivery_status in ('pending', 'sent', 'failed')),
  error text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists notification_logs_status_idx on public.notification_logs(delivery_status, created_at desc);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  administrator_id uuid references public.profiles(id),
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);

-- ---------- pricing (single source of truth for display AND checkout) ----------
create or replace function public.quote_price(p_package uuid, p_currency text)
returns table(unit_price numeric, is_estimate boolean)
language plpgsql stable set search_path = public as $$
declare pkg packages%rowtype; eff numeric; ratio numeric; fixed numeric;
        rates jsonb; ov jsonb; r_from numeric; r_to numeric;
begin
  select * into pkg from packages where id = p_package;
  if not found then return; end if;
  eff := case when pkg.promo_price is not null and (pkg.promo_ends_at is null or pkg.promo_ends_at > now())
              then pkg.promo_price else pkg.base_price end;
  ratio := case when pkg.base_price > 0 then eff / pkg.base_price else 1 end;

  select price into fixed from package_prices where package_id = p_package and currency = p_currency;
  if fixed is not null then unit_price := round(fixed * ratio, 2); is_estimate := false; return next; return; end if;

  if p_currency = pkg.currency then unit_price := round(eff, 2); is_estimate := false; return next; return; end if;

  select value into rates from site_settings where key = 'exchange_rates';
  select value into ov from site_settings where key = 'rate_overrides';
  r_from := coalesce((ov->>pkg.currency)::numeric, (rates->>pkg.currency)::numeric);
  r_to   := coalesce((ov->>p_currency)::numeric,  (rates->>p_currency)::numeric);
  if r_from is null or r_to is null or r_from = 0 then return; end if;
  unit_price := round(eff / r_from * r_to, 2); is_estimate := true; return next;
end $$;

create or replace function public.quote_packages(p_currency text)
returns table(package_id uuid, unit_price numeric, is_estimate boolean)
language sql stable set search_path = public as $$
  select p.id, q.unit_price, q.is_estimate
  from packages p cross join lateral quote_price(p.id, p_currency) q
  where p.is_active
$$;

-- ---------- order creation (server-side only) ----------
create or replace function public.create_order(
  p_user uuid, p_package uuid, p_qty integer, p_currency text, p_country text, p_terms boolean)
returns public.orders language plpgsql security definer set search_path = public as $$
declare pkg packages%rowtype; q record; supported jsonb; prof profiles%rowtype; o orders;
begin
  if not coalesce(p_terms, false) then raise exception 'terms_not_accepted'; end if;
  if p_qty is null or p_qty < 1 or p_qty > 10 then raise exception 'invalid_quantity'; end if;
  if p_country is null or p_country !~ '^[A-Z]{2}$' then raise exception 'country_required'; end if;
  select * into prof from profiles where id = p_user;
  if not found or prof.is_suspended then raise exception 'account_unavailable'; end if;
  select * into pkg from packages where id = p_package and is_active;
  if not found then raise exception 'package_unavailable'; end if;
  select value into supported from site_settings where key = 'supported_currencies';
  if supported is null or not (supported @> to_jsonb(p_currency)) then raise exception 'currency_unsupported'; end if;
  select * into q from quote_price(p_package, p_currency);
  if q.unit_price is null then raise exception 'price_unavailable'; end if;

  insert into orders (user_id, package_id, package_name, redeemable_for, credit_quantity, quantity,
                      unit_price, total_price, currency, price_is_estimate, customer_country, terms_accepted_at)
  values (p_user, pkg.id, pkg.name, pkg.redeemable_for, pkg.credit_quantity, p_qty,
          q.unit_price, q.unit_price * p_qty, p_currency, q.is_estimate, p_country, now())
  returning * into o;
  return o;
end $$;
revoke execute on function public.create_order(uuid, uuid, integer, text, text, boolean) from public, anon, authenticated;
grant execute on function public.create_order(uuid, uuid, integer, text, text, boolean) to service_role;

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.packages enable row level security;
alter table public.package_prices enable row level security;
alter table public.site_settings enable row level security;
alter table public.languages enable row level security;
alter table public.translations enable row level security;
alter table public.order_counters enable row level security;
alter table public.orders enable row level security;
alter table public.order_notes enable row level security;
alter table public.support_requests enable row level security;
alter table public.notification_logs enable row level security;
alter table public.audit_logs enable row level security;

-- profiles: own row (or admin). Protected columns are guarded by the trigger above.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- packages: public sees active ones only
drop policy if exists packages_select on public.packages;
create policy packages_select on public.packages for select using (is_active or public.is_admin());
drop policy if exists packages_admin on public.packages;
create policy packages_admin on public.packages for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists package_prices_select on public.package_prices;
create policy package_prices_select on public.package_prices for select using (true);
drop policy if exists package_prices_admin on public.package_prices;
create policy package_prices_admin on public.package_prices for all using (public.is_admin()) with check (public.is_admin());

-- settings
drop policy if exists settings_select on public.site_settings;
create policy settings_select on public.site_settings for select using (key not like 'private.%' or public.is_admin());
drop policy if exists settings_admin on public.site_settings;
create policy settings_admin on public.site_settings for all using (public.is_admin()) with check (public.is_admin());

-- languages / translations
drop policy if exists languages_select on public.languages;
create policy languages_select on public.languages for select using (true);
drop policy if exists languages_admin on public.languages;
create policy languages_admin on public.languages for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists translations_select on public.translations;
create policy translations_select on public.translations for select using (true);
drop policy if exists translations_admin on public.translations;
create policy translations_admin on public.translations for all using (public.is_admin()) with check (public.is_admin());

-- orders: customers READ their own; there is deliberately NO customer insert/update policy.
-- All writes go through server code (service role) after validation.
drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders for select using (user_id = auth.uid() or public.is_admin());

-- admin-only tables
drop policy if exists order_notes_admin on public.order_notes;
create policy order_notes_admin on public.order_notes for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists notification_logs_admin on public.notification_logs;
create policy notification_logs_admin on public.notification_logs for select using (public.is_admin());
drop policy if exists audit_logs_admin on public.audit_logs;
create policy audit_logs_admin on public.audit_logs for select using (public.is_admin());

-- support requests
drop policy if exists support_select on public.support_requests;
create policy support_select on public.support_requests for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists support_insert on public.support_requests;
create policy support_insert on public.support_requests for insert with check (user_id = auth.uid());
drop policy if exists support_admin_update on public.support_requests;
create policy support_admin_update on public.support_requests for update using (public.is_admin());

-- ---------- seed data ----------
insert into public.languages (code, name, native_name, is_rtl, sort_order) values
  ('en','English','English',false,1), ('ar','Arabic','العربية',true,2), ('ur','Urdu','اردو',true,3),
  ('hi','Hindi','हिन्दी',false,4), ('fa','Persian','فارسی',true,5), ('tr','Turkish','Türkçe',false,6),
  ('fr','French','Français',false,7), ('de','German','Deutsch',false,8), ('es','Spanish','Español',false,9),
  ('pt','Portuguese','Português',false,10), ('ru','Russian','Русский',false,11), ('zh','Chinese','中文',false,12),
  ('ja','Japanese','日本語',false,13), ('ko','Korean','한국어',false,14), ('bn','Bengali','বাংলা',false,15),
  ('id','Indonesian','Bahasa Indonesia',false,16), ('ms','Malay','Bahasa Melayu',false,17),
  ('it','Italian','Italiano',false,18), ('nl','Dutch','Nederlands',false,19), ('sw','Swahili','Kiswahili',false,20)
on conflict (code) do nothing;

insert into public.site_settings (key, value) values
  ('site_name', '"Sagewood Credits"'),
  ('site_description', '"Independent digital-credit packages with human-verified orders and clear tracking."'),
  ('logo_url', '""'),
  ('whatsapp_number', '"+966599732748"'),
  ('private.admin_email', '"muneebrahman500@gmail.com"'),
  ('supported_currencies', '["USD","SAR","PKR","INR","AED","GBP","EUR","BDT","TRY","MYR","IDR","CAD","AUD"]'),
  ('default_currency', '"USD"'),
  ('default_language', '"en"'),
  ('support_info', '"Support is handled over WhatsApp. Replies usually arrive within a few hours."'),
  ('payment_instructions', '"After confirming your order, message the administrator on WhatsApp. You will receive the available payment methods there. Send your payment proof in the same chat. Never share passwords, one-time codes or recovery codes with anyone."'),
  ('announcement', '""'),
  ('maintenance_mode', 'false'),
  -- PLACEHOLDER rates (units per 1 USD). Update or use "Refresh live rates" in Admin > Settings.
  ('exchange_rates', '{"USD":1,"SAR":3.75,"PKR":280,"INR":83,"AED":3.6725,"GBP":0.79,"EUR":0.92,"BDT":110,"TRY":32,"MYR":4.7,"IDR":15700,"CAD":1.36,"AUD":1.52}'),
  ('rate_overrides', '{}'),
  ('fulfillment_provider', '"manual"'),
  ('private.notify.registration', 'true'),
  ('private.notify.order', 'true'),
  ('private.notify.payment', 'true'),
  ('private.notify.fulfillment', 'true'),
  ('private.notify.support', 'true'),
  ('private.notify.customer_emails', 'true')
on conflict (key) do nothing;

-- Sample packages are created INACTIVE: write the "redeemable for" statement, then activate.
insert into public.packages (name, description, credit_quantity, base_price, currency, sort_order)
select * from (values
  ('Package A', 'Starter bundle of 250 credits.', 250, 2.00, 'USD', 1),
  ('Package B', 'Standard bundle of 500 credits.', 500, 3.50, 'USD', 2)
) v(name, description, credit_quantity, base_price, currency, sort_order)
where not exists (select 1 from public.packages);

-- ---------- make yourself admin (run AFTER you have signed in once with Google) ----------
-- update public.profiles set role = 'admin' where email = 'muneebrahman500@gmail.com';
