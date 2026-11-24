'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProfile, requireUser } from '@/lib/auth';
import { getPrefs } from '@/lib/prefs';
import { getSettings } from '@/lib/settings';
import { getLanguages } from '@/lib/i18n';
import { currencyForCountry, isCountry } from '@/lib/countries';
import { notify, emailShell, row, table } from '@/lib/email';
import { esc, formatMoney, safeNext } from '@/lib/format';
import { rateLimit } from '@/lib/ratelimit';

const YEAR = 60 * 60 * 24 * 365;

async function clientKey(prefix: string) {
  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  return `${prefix}:${ip}`;
}

/* ------------------------------ preferences ------------------------------ */

export async function setPreferences(formData: FormData) {
  const store = await cookies();
  const opts = { path: '/', maxAge: YEAR, sameSite: 'lax' as const };
  const settings = await getSettings();
  const profile = await getProfile();
  const patch: Record<string, string> = {};

  const lang = String(formData.get('lang') ?? '');
  if (lang) {
    const active = (await getLanguages()).filter((l) => l.is_active).map((l) => l.code);
    if (active.includes(lang)) { store.set('lang', lang, opts); patch.preferred_language = lang; }
  }
  const country = String(formData.get('country') ?? '');
  if (country && isCountry(country)) {
    store.set('country', country, opts);
    patch.country = country;
    const suggested = currencyForCountry(country);
    if (suggested && settings.supportedCurrencies.includes(suggested)) {
      store.set('currency', suggested, opts); // currency follows country; user can still override it
      patch.preferred_currency = suggested;
    }
  }
  const currency = String(formData.get('currency') ?? '');
  if (currency && settings.supportedCurrencies.includes(currency)) {
    store.set('currency', currency, opts);
    patch.preferred_currency = currency;
  }

  if (profile && Object.keys(patch).length) {
    const supabase = await createClient();
    await supabase.from('profiles').update(patch).eq('id', profile.id);
  }
  revalidatePath('/', 'layout');
}

/* --------------------------------- auth ---------------------------------- */

export async function signInWithGoogle(formData: FormData) {
  const next = safeNext(formData.get('next'));
  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`;
  let url: string | null = null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (!error) url = data.url;
  } catch (e) {
    console.error('oauth start failed', e);
  }
  if (!url) redirect('/login?error=oauth');
  redirect(url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}

/* -------------------------------- profile -------------------------------- */

const profileSchema = z.object({
  full_name: z.string().trim().min(1).max(100),
  country: z.string().refine(isCountry),
});

export async function updateProfile(formData: FormData) {
  const profile = await requireUser('/dashboard');
  const parsed = profileSchema.safeParse({ full_name: formData.get('full_name'), country: formData.get('country') });
  if (!parsed.success) redirect('/dashboard?error=profile');
  const settings = await getSettings();
  const languages = (await getLanguages()).filter((l) => l.is_active).map((l) => l.code);
  const lang = String(formData.get('lang') ?? 'en');
  const currency = String(formData.get('currency') ?? '');
  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: parsed.data.full_name,
      country: parsed.data.country,
      preferred_language: languages.includes(lang) ? lang : 'en',
      preferred_currency: settings.supportedCurrencies.includes(currency) ? currency : null,
    })
    .eq('id', profile.id);
  if (error) redirect('/dashboard?error=profile');
  const store = await cookies();
  const opts = { path: '/', maxAge: YEAR, sameSite: 'lax' as const };
  store.set('country', parsed.data.country, opts);
  if (languages.includes(lang)) store.set('lang', lang, opts);
  if (settings.supportedCurrencies.includes(currency)) store.set('currency', currency, opts);
  revalidatePath('/', 'layout');
  redirect('/dashboard?saved=1');
}

/* --------------------------------- orders -------------------------------- */

const orderSchema = z.object({
  packageId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(10),
});

const ORDER_ERRORS: Record<string, string> = {
  terms_not_accepted: 'terms', package_unavailable: 'package', currency_unsupported: 'currency',
  price_unavailable: 'price', country_required: 'country', account_unavailable: 'account', invalid_quantity: 'quantity',
};

export async function createOrder(formData: FormData) {
  const profile = await requireUser('/packages');
  const parsed = orderSchema.safeParse({ packageId: formData.get('packageId'), quantity: formData.get('quantity') });
  if (!parsed.success) redirect('/packages');
  const { packageId, quantity } = parsed.data;
  const back = (code: string) => redirect(`/order/${packageId}?error=${code}`);

  if (!rateLimit(`order:${profile.id}`, 8, 10 * 60_000)) back('rate');
  const { country, currency, settings } = await getPrefs();
  if (!country) back('country');

  const { data, error } = await createAdminClient().rpc('create_order', {
    p_user: profile.id,
    p_package: packageId,
    p_qty: quantity,
    p_currency: currency,
    p_country: country,
    p_terms: formData.get('terms') === 'on',
  });
  if (error || !data) {
    const code = Object.entries(ORDER_ERRORS).find(([k]) => error?.message.includes(k))?.[1] ?? 'generic';
    if (code === 'generic') console.error('create_order failed', error);
    back(code);
  }
  const order = data as any;

  const total = formatMoney(order.total_price, order.currency, 'en');
  const summary = table(
    row('Order ID', order.order_number) + row('Package', order.package_name) +
    row('Credits', order.credit_quantity * order.quantity) + row('Total', total + (order.price_is_estimate ? ' (estimated)' : '')) +
    row('Country', order.customer_country),
  );
  await Promise.all([
    notify({
      category: 'order', event: 'order_created_admin', dedupeKey: `order-created:${order.id}:admin`,
      to: settings.adminEmail, subject: `New order ${order.order_number}`,
      html: emailShell(settings.siteName, 'New order', `<p>${esc(profile.full_name ?? 'A customer')} placed an order.</p>${summary}`),
    }),
    notify({
      category: 'order', event: 'order_created_customer', dedupeKey: `order-created:${order.id}:customer`,
      to: profile.email, customer: true, subject: `Your order ${order.order_number}`,
      html: emailShell(settings.siteName, 'Your order has been created',
        `<p>Thank you. Contact the administrator on WhatsApp to arrange payment. Your order is not paid until the administrator confirms it.</p>${summary}`),
    }),
  ]);
  redirect(`/orders/${order.id}`);
}

/** Customer says "I sent my proof". This only moves pending -> submitted; it never approves anything. */
export async function markProofSent(formData: FormData) {
  const profile = await requireUser('/dashboard');
  const id = z.string().uuid().safeParse(formData.get('orderId'));
  if (!id.success) redirect('/dashboard');
  const supabase = await createClient();
  const { data: order } = await supabase.from('orders').select('*').eq('id', id.data).eq('user_id', profile.id).maybeSingle();
  if (!order) redirect('/dashboard');
  if (order.payment_status !== 'pending' || order.fulfillment_status !== 'not_started') redirect(`/orders/${order.id}?error=state`);
  const { error } = await createAdminClient()
    .from('orders')
    .update({ payment_status: 'submitted', proof_sent_at: new Date().toISOString() })
    .eq('id', order.id).eq('payment_status', 'pending');
  if (error) redirect(`/orders/${order.id}?error=generic`);
  const settings = await getSettings();
  await notify({
    category: 'payment', event: 'proof_sent', dedupeKey: `proof-sent:${order.id}`,
    to: settings.adminEmail, subject: `Payment proof reported: ${order.order_number}`,
    html: emailShell(settings.siteName, 'Customer reports payment proof sent',
      `<p>${esc(profile.full_name ?? profile.email)} says they sent proof on WhatsApp. Verify it, then approve or reject in the admin panel.</p>${table(row('Order', order.order_number))}`),
  });
  revalidatePath(`/orders/${order.id}`);
  redirect(`/orders/${order.id}?proof=1`);
}

export async function requestRefund(formData: FormData) {
  const profile = await requireUser('/dashboard');
  const id = z.string().uuid().safeParse(formData.get('orderId'));
  if (!id.success) redirect('/dashboard');
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 1000);
  const supabase = await createClient();
  const { data: order } = await supabase.from('orders').select('*').eq('id', id.data).eq('user_id', profile.id).maybeSingle();
  if (!order) redirect('/dashboard');
  const allowed = order.payment_status === 'approved' && ['not_started', 'processing', 'fulfilled'].includes(order.fulfillment_status);
  if (!allowed) redirect(`/orders/${order.id}?error=state`);
  const db = createAdminClient();
  const { error } = await db.from('orders')
    .update({ status_before_refund: order.fulfillment_status, fulfillment_status: 'refund_requested' })
    .eq('id', order.id).eq('fulfillment_status', order.fulfillment_status);
  if (error) redirect(`/orders/${order.id}?error=generic`);
  if (reason) await db.from('order_notes').insert({ order_id: order.id, administrator_id: null, note: `Customer refund reason: ${reason}` });
  const settings = await getSettings();
  await notify({
    category: 'payment', event: 'refund_requested', dedupeKey: `refund-requested:${order.id}:${order.updated_at}`,
    to: settings.adminEmail, subject: `Refund requested: ${order.order_number}`,
    html: emailShell(settings.siteName, 'Refund requested',
      `${table(row('Order', order.order_number) + row('Customer', profile.full_name ?? profile.email))}${reason ? `<p>Reason: ${esc(reason)}</p>` : ''}`),
  });
  revalidatePath(`/orders/${order.id}`);
  redirect(`/orders/${order.id}?refund=1`);
}

/* --------------------------------- support ------------------------------- */

const supportSchema = z.object({
  subject: z.string().trim().min(1).max(150),
  message: z.string().trim().min(1).max(4000),
  orderId: z.string().uuid().optional().or(z.literal('')),
});

export async function submitSupport(formData: FormData) {
  const profile = await requireUser('/dashboard');
  const parsed = supportSchema.safeParse({
    subject: formData.get('subject'), message: formData.get('message'), orderId: formData.get('orderId') ?? '',
  });
  if (!parsed.success) redirect('/dashboard?error=support');
  if (!rateLimit(`support:${profile.id}`, 5, 10 * 60_000)) redirect('/dashboard?error=rate');
  const supabase = await createClient();
  let orderId: string | null = null;
  if (parsed.data.orderId) {
    const { data } = await supabase.from('orders').select('id').eq('id', parsed.data.orderId).eq('user_id', profile.id).maybeSingle();
    orderId = data?.id ?? null;
  }
  const { data: created, error } = await supabase
    .from('support_requests')
    .insert({ user_id: profile.id, order_id: orderId, subject: parsed.data.subject, message: parsed.data.message })
    .select('id').single();
  if (error || !created) redirect('/dashboard?error=support');
  const settings = await getSettings();
  await notify({
    category: 'support', event: 'support_request', dedupeKey: `support:${created.id}`,
    to: settings.adminEmail, subject: `Support request: ${parsed.data.subject}`,
    html: emailShell(settings.siteName, 'New support request',
      `${table(row('From', profile.full_name ?? profile.email) + row('Email', profile.email))}<p>${esc(parsed.data.message).replace(/\n/g, '<br>')}</p>`),
  });
  redirect('/dashboard?support=1');
}
