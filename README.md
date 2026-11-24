# Sagewood Credits

Multilingual digital-credits storefront and order-management platform.
Next.js 15 (App Router, TypeScript) · Tailwind · Supabase (Postgres + Auth + RLS) · Google sign-in · Resend email · Vercel.

Customers sign in with Google, pick a package, place an order, and arrange payment with the administrator over WhatsApp. The administrator verifies payment **by hand**, fulfils the order, and updates its status. Customers track everything in their dashboard.

> **Independent service.** The site says so in the footer and in the terms. Every package must carry a
> "redeemable for" statement written by the administrator (enforced by a database constraint) that is shown on the
> package card, at checkout and on the order. Credits may only be sold for services you own or are authorised to provide.
> Fulfilment is a manual, admin-only step behind a provider interface (`lib/fulfillment.ts`); only `manual` exists.
> Do not add an adapter that delivers value inside any third-party service until you have verified, in writing,
> that you are authorised and that the method complies with that service's terms.

## 1. Run it locally

```bash
npm install
cp .env.example .env.local     # then fill it in (section 2)
npm run dev                    # http://localhost:3000
```

## 2. Environment variables

| Variable | Where it comes from | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase > Project Settings > API | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same | public; RLS protects the data |
| `SUPABASE_SERVICE_ROLE_KEY` | same | **secret, server only**, bypasses RLS. Never prefix with `NEXT_PUBLIC_`. `lib/supabase/admin.ts` imports `server-only` so a client import fails the build |
| `NEXT_PUBLIC_SITE_URL` | your deployed URL | used for OAuth redirects, metadata, sitemap |
| `RESEND_API_KEY` | resend.com > API Keys | without it emails are logged as *failed* and can be retried later |
| `EMAIL_FROM` | a sender on a domain verified in Resend | e.g. `Sagewood Credits <orders@yourdomain.com>` |

## 3. Supabase

1. Create a project at supabase.com.
2. **SQL Editor** > paste all of `supabase/schema.sql` > Run. It creates tables, constraints, indexes, RLS policies, the pricing and order functions, and seed data (20 languages, settings, two inactive sample packages).
3. **Authentication > URL Configuration**: set *Site URL* to your site URL and add `https://YOUR-DOMAIN/auth/callback` and `http://localhost:3000/auth/callback` to *Redirect URLs*.

## 4. Google OAuth

1. Google Cloud Console > APIs & Services > **OAuth consent screen** (External). Add your domain, privacy-policy and terms URLs (`/legal/privacy`, `/legal/terms`).
2. **Credentials > Create credentials > OAuth client ID > Web application.**
   *Authorized redirect URI*: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
3. Copy the Client ID and Secret into Supabase > **Authentication > Providers > Google**, enable it, save.

## 5. Make yourself the administrator

Sign in once with Google, then in the Supabase SQL editor:

```sql
update public.profiles set role = 'admin' where email = 'muneebrahman500@gmail.com';
```

Admin lives at `/admin`. Roles cannot be changed from the browser: a trigger blocks any signed-in user from editing `role`, `is_suspended`, `email` or `id`.

## 6. First-run checklist (in the admin panel)

1. **Settings**: confirm WhatsApp number (`+966599732748` is pre-filled), admin email, payment instructions, supported currencies.
2. **Settings > Refresh live rates.** The seeded exchange rates are placeholders.
3. **Packages**: for each package write the *Redeemable for* statement, set price/credits, tick *Active*. (A package cannot be activated without that statement.)
4. **Resend**: verify your domain and set `EMAIL_FROM`.
5. Read `lib/legal.ts` with a lawyer; the policies are starter templates, not legal advice.

## 7. Deploy to Vercel

Import the repo, add the six env variables above, deploy, then update `NEXT_PUBLIC_SITE_URL` and the Supabase/Google redirect URLs to the final domain.

## How it works

**Order flow** `pending` > `submitted` (customer says "I sent proof") > `under_verification` > `approved` | `rejected` (admin only) > `processing` > `fulfilled`. Also `cancelled`, `refund_requested`, `refunded`.
Customers have **no write access** to orders. Creating an order goes through the `create_order()` SQL function (service role only), which re-prices on the server, snapshots package details, and issues `ORD-YYYY-NNNNNN` plus an unguessable UUID used in URLs. Admin transitions are validated and applied compare-and-set; a CHECK constraint stops fulfilment before payment approval.

**Pricing** has one source of truth, `quote_price()` in SQL, used for both display and checkout. Order: fixed per-currency price > same currency > conversion via `exchange_rates` (manual `rate_overrides` win). Converted prices are labelled *Estimated* and the payable amount is confirmed over WhatsApp. An order keeps the currency and price it was created with.

**WhatsApp**: the number is a setting; every button builds `wa.me` links from it with a pre-filled message the customer reviews and sends. Opening WhatsApp never changes an order.

**Languages**: 20 shipped. English is complete; the other 19 ship ~60 core strings (navigation, hero, packages, statuses, login, orders, footer) and fall back to English for the rest. Admin > Languages lets you add languages, toggle RTL/active, set the default, and override any string. Arabic, Urdu and Persian render right-to-left. Browser language is detected on first visit (middleware); country and currency are suggested from the geo header or browser locale.

**Email**: admin notifications for registrations, orders, payment/fulfilment changes and support; customer emails for welcome, order created, payment decisions, fulfilment, cancellation/refund. Each category can be switched off. Every email is logged once (unique dedupe key), failures are stored and can be retried from Admin > Email log. Customer emails use the status labels of the customer's language; the body text is English.

## Security notes

- RLS on every table; customers read only their own profile, orders and tickets.
- Every admin page **and** every admin server action calls `requireAdmin()`.
- All inputs validated with zod and database constraints; SQL is parameterised by the Supabase client; React escapes output; email HTML is escaped.
- Server Actions carry Next.js's built-in origin (CSRF) check. Security headers are set in `next.config.mjs`.
- `lib/ratelimit.ts` is an in-memory limiter, so it is best-effort on serverless. Swap in Upstash Redis for hard limits.
- Admin actions are written to `audit_logs`.

## Known limitations / not yet done

- Nothing here has been run against a live Supabase project, Google OAuth, or Resend. See the testing table in the hand-off notes.
- Admin screens are English only.
- No payment gateway by design (manual verification over WhatsApp).
- Translations were written by an AI model; have native speakers review them before launch.
- No automated test suite yet.
