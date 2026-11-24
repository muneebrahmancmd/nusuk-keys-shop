'use server';

import { redirect } from 'next/navigation';
import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSettings } from '@/lib/settings';
import { fileMessages, getLanguages } from '@/lib/i18n';
import { notify, deliver, emailShell, row, table } from '@/lib/email';
import { esc, formatMoney } from '@/lib/format';
import { normalizeWhatsapp } from '@/lib/whatsapp';
import { getFulfillmentProvider } from '@/lib/fulfillment';
import { ALL_CURRENCIES } from '@/lib/countries';
import { overallStatus } from '@/lib/status';
import type { Order } from '@/lib/types';

const uuid = z.string().uuid();

async function audit(adminId: string, action: string, targetType: string, targetId: string | null, details?: unknown) {
  await createAdminClient().from('audit_logs').insert({
    administrator_id: adminId, action, target_type: targetType, target_id: targetId, details: details ?? null,
  });
}

const flash = (path: string, key: 'saved' | 'error', value = '1') => redirect(`${path}?${key}=${encodeURIComponent(value)}`);

/** "PKR=500" per line -> { PKR: 500 } */
function parseLines(text: string): Record<string, number> | null {
  const out: Record<string, number> = {};
  for (const line of text.split('\n').map((l) => l.trim()).filter(Boolean)) {
    const m = /^([A-Za-z]{3})\s*[=:]\s*(\d+(?:\.\d+)?)$/.exec(line);
    if (!m) return null;
    out[m[1].toUpperCase()] = Number(m[2]);
  }
  return out;
}

/* ================================ ORDERS ================================= */

const ORDER_ACTIONS = ['under_verification', 'approve', 'reject', 'processing', 'fulfilled', 'cancel', 'refund_complete', 'refund_decline'] as const;
type OrderAction = (typeof ORDER_ACTIONS)[number];

const EMAIL_COPY: Partial<Record<OrderAction, { subject: string; body: string; category: 'payment' | 'fulfillment' }>> = {
  under_verification: { category: 'payment', subject: 'Your payment is being verified', body: 'The administrator is checking your payment.' },
  approve: { category: 'payment', subject: 'Your payment was approved', body: 'Your payment has been approved. Your order will move to processing next.' },
  reject: { category: 'payment', subject: 'Your payment was not approved', body: 'We could not verify your payment. Please contact the administrator on WhatsApp.' },
  processing: { category: 'fulfillment', subject: 'Your order is being processed', body: 'Your order is now being processed.' },
  fulfilled: { category: 'fulfillment', subject: 'Your order is fulfilled', body: 'Your order has been fulfilled. Thank you!' },
  cancel: { category: 'payment', subject: 'Your order was cancelled', body: 'Your order has been cancelled. Contact support if you have questions.' },
  refund_complete: { category: 'payment', subject: 'Your refund was processed', body: 'Your refund request has been processed.' },
  refund_decline: { category: 'payment', subject: 'Update on your refund request', body: 'Your refund request was reviewed and the order has been restored. Contact support for details.' },
};

export async function orderAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = uuid.safeParse(formData.get('orderId'));
  const action = z.enum(ORDER_ACTIONS).safeParse(formData.get('action'));
  if (!id.success || !action.success) redirect('/admin/orders');
  const path = `/admin/orders/${id.data}`;
  const db = createAdminClient();

  const { data } = await db.from('orders').select('*').eq('id', id.data).single();
  if (!data) redirect('/admin/orders');
  const o = data as Order;
  const pay = o.payment_status, ful = o.fulfillment_status;

  // The ONLY place order state changes. Payment is never approved automatically.
  let patch: Record<string, unknown> | null = null;
  switch (action.data) {
    case 'under_verification':
      if (ful === 'not_started' && ['pending', 'submitted'].includes(pay)) patch = { payment_status: 'under_verification' };
      break;
    case 'approve':
      if (ful === 'not_started' && ['pending', 'submitted', 'under_verification'].includes(pay)) patch = { payment_status: 'approved' };
      break;
    case 'reject':
      if (ful === 'not_started' && ['pending', 'submitted', 'under_verification'].includes(pay)) patch = { payment_status: 'rejected' };
      break;
    case 'processing':
      if (pay === 'approved' && ful === 'not_started') patch = { fulfillment_status: 'processing' };
      break;
    case 'fulfilled':
      if (pay === 'approved' && ful === 'processing') {
        const settings = await getSettings();
        try { await getFulfillmentProvider(settings.fulfillmentProvider).onFulfilled(o, admin.id); }
        catch { flash(path, 'error', 'provider'); }
        patch = { fulfillment_status: 'fulfilled' };
      }
      break;
    case 'cancel':
      if (['not_started', 'processing'].includes(ful)) patch = { fulfillment_status: 'cancelled' };
      break;
    case 'refund_complete':
      if (ful === 'refund_requested') patch = { fulfillment_status: 'refunded' };
      break;
    case 'refund_decline':
      if (ful === 'refund_requested' && o.status_before_refund) patch = { fulfillment_status: o.status_before_refund, status_before_refund: null };
      break;
  }
  if (!patch) flash(path, 'error', 'state');

  // Compare-and-set so two admins (or a double click) cannot apply a stale transition.
  const { data: updated, error } = await db.from('orders').update(patch!).eq('id', o.id)
    .eq('payment_status', pay).eq('fulfillment_status', ful).select('*').maybeSingle();
  if (error || !updated) flash(path, 'error', 'state');
  const next = updated as Order;

  const note = String(formData.get('note') ?? '').trim().slice(0, 2000);
  if (note) await db.from('order_notes').insert({ order_id: o.id, administrator_id: admin.id, note });
  await audit(admin.id, `order.${action.data}`, 'order', o.id, { from: { pay, ful }, to: { pay: next.payment_status, ful: next.fulfillment_status } });

  // Notifications (admin copy + customer copy). Dedupe key includes the new updated_at.
  const copy = EMAIL_COPY[action.data]!;
  const [settings, { data: customer }] = await Promise.all([
    getSettings(), db.from('profiles').select('full_name,email,preferred_language').eq('id', o.user_id).single(),
  ]);
  const label = (s: string, lang: string) => fileMessages[lang]?.[`status.${s}`] ?? fileMessages.en[`status.${s}`];
  const lang = customer?.preferred_language ?? 'en';
  const summary = table(
    row('Order', o.order_number) + row('Package', o.package_name) + row('Total', formatMoney(o.total_price, o.currency, 'en')) +
    row('Status', label(overallStatus(next), lang)),
  );
  await Promise.all([
    notify({
      category: copy.category, event: `${action.data}_admin`, dedupeKey: `${action.data}:${o.id}:${next.updated_at}:admin`,
      to: settings.adminEmail, subject: `[${o.order_number}] ${copy.subject}`,
      html: emailShell(settings.siteName, copy.subject, `<p>By ${esc(admin.full_name ?? admin.email)}.</p>${summary}`),
    }),
    notify({
      category: copy.category, event: `${action.data}_customer`, dedupeKey: `${action.data}:${o.id}:${next.updated_at}:customer`,
      customer: true, to: customer?.email, subject: copy.subject,
      html: emailShell(settings.siteName, copy.subject, `<p>${esc(copy.body)}</p>${summary}`),
    }),
  ]);
  revalidatePath('/admin', 'layout');
  flash(path, 'saved');
}

export async function addOrderNote(formData: FormData) {
  const admin = await requireAdmin();
  const id = uuid.safeParse(formData.get('orderId'));
  const note = z.string().trim().min(1).max(2000).safeParse(formData.get('note'));
  if (!id.success) redirect('/admin/orders');
  const path = `/admin/orders/${id.data}`;
  if (!note.success) flash(path, 'error', 'note');
  await createAdminClient().from('order_notes').insert({ order_id: id.data, administrator_id: admin.id, note: note.data! });
  await audit(admin.id, 'order.note', 'order', id.data);
  flash(path, 'saved');
}

/* =============================== PACKAGES ================================ */

const packageSchema = z.object({
  id: uuid.optional().or(z.literal('')),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500),
  redeemable_for: z.string().trim().max(500),
  credit_quantity: z.coerce.number().int().min(1).max(100_000_000),
  base_price: z.coerce.number().min(0).max(1_000_000_000),
  currency: z.string().regex(/^[A-Z]{3}$/),
  promo_price: z.preprocess((v) => (v === '' || v == null ? null : v), z.coerce.number().min(0).nullable()),
  promo_ends_at: z.string().optional(),
  sort_order: z.coerce.number().int().min(-1000).max(1000).default(0),
});

export async function savePackage(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = packageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash('/admin/packages', 'error', 'invalid');
  const p = parsed.data!;
  const isActive = formData.get('is_active') === 'on';
  if (isActive && p.redeemable_for.length < 20) flash('/admin/packages', 'error', 'redeemable');
  const fixed = parseLines(String(formData.get('fixed_prices') ?? ''));
  if (!fixed) flash('/admin/packages', 'error', 'fixed');

  const row = {
    name: p.name, description: p.description, redeemable_for: p.redeemable_for, credit_quantity: p.credit_quantity,
    base_price: p.base_price, currency: p.currency, promo_price: p.promo_price,
    promo_ends_at: p.promo_ends_at ? new Date(p.promo_ends_at).toISOString() : null,
    is_active: isActive, sort_order: p.sort_order,
  };
  const db = createAdminClient();
  let id = p.id || null;
  if (id) {
    const { error } = await db.from('packages').update(row).eq('id', id);
    if (error) flash('/admin/packages', 'error', 'save');
  } else {
    const { data, error } = await db.from('packages').insert(row).select('id').single();
    if (error || !data) flash('/admin/packages', 'error', 'save');
    id = data!.id;
  }
  await db.from('package_prices').delete().eq('package_id', id!);
  const rows = Object.entries(fixed!).map(([currency, price]) => ({ package_id: id!, currency, price }));
  if (rows.length) await db.from('package_prices').insert(rows);
  await audit(admin.id, p.id ? 'package.update' : 'package.create', 'package', id, { name: p.name, credits: p.credit_quantity, price: p.base_price, active: isActive });
  revalidatePath('/', 'layout');
  flash('/admin/packages', 'saved');
}

export async function deletePackage(formData: FormData) {
  const admin = await requireAdmin();
  const id = uuid.safeParse(formData.get('id'));
  if (!id.success) redirect('/admin/packages');
  await createAdminClient().from('packages').delete().eq('id', id.data); // orders keep their own snapshot
  await audit(admin.id, 'package.delete', 'package', id.data);
  revalidatePath('/', 'layout');
  flash('/admin/packages', 'saved');
}

/* ================================ SETTINGS =============================== */

const text = (max: number) => z.string().trim().max(max);

export async function saveSettings(formData: FormData) {
  const admin = await requireAdmin();
  const S = '/admin/settings';
  const wa = normalizeWhatsapp(String(formData.get('whatsapp_number') ?? ''));
  if (!wa) flash(S, 'error', 'whatsapp');
  const email = z.string().email().safeParse(String(formData.get('admin_email') ?? '').trim());
  if (!email.success) flash(S, 'error', 'email');
  const logo = String(formData.get('logo_url') ?? '').trim();
  if (logo && !/^https:\/\/\S+$/.test(logo)) flash(S, 'error', 'logo');
  const currencies = formData.getAll('currency').map(String).filter((c) => ALL_CURRENCIES.includes(c));
  if (!currencies.length) flash(S, 'error', 'currencies');
  const defCur = String(formData.get('default_currency') ?? '');
  if (!currencies.includes(defCur)) flash(S, 'error', 'defaultCurrency');
  const langs = (await getLanguages()).filter((l) => l.is_active).map((l) => l.code);
  const defLang = String(formData.get('default_language') ?? '');
  if (!langs.includes(defLang)) flash(S, 'error', 'defaultLanguage');
  const overrides = parseLines(String(formData.get('rate_overrides') ?? ''));
  if (!overrides) flash(S, 'error', 'rates');

  const name = text(80).min(1).safeParse(formData.get('site_name'));
  if (!name.success) flash(S, 'error', 'name');

  const entries: Record<string, unknown> = {
    site_name: name.data, site_description: text(300).parse(formData.get('site_description') ?? ''),
    logo_url: logo, whatsapp_number: wa, 'private.admin_email': email.data,
    supported_currencies: currencies, default_currency: defCur, default_language: defLang,
    support_info: text(1000).parse(formData.get('support_info') ?? ''),
    payment_instructions: text(3000).parse(formData.get('payment_instructions') ?? ''),
    announcement: text(300).parse(formData.get('announcement') ?? ''),
    maintenance_mode: formData.get('maintenance_mode') === 'on',
    rate_overrides: overrides,
  };
  for (const k of ['registration', 'order', 'payment', 'fulfillment', 'support', 'customer_emails']) {
    entries[`private.notify.${k}`] = formData.get(`notify_${k}`) === 'on';
  }
  const { error } = await createAdminClient().from('site_settings')
    .upsert(Object.entries(entries).map(([key, value]) => ({ key, value })), { onConflict: 'key' });
  if (error) flash(S, 'error', 'save');
  await audit(admin.id, 'settings.update', 'settings', null, { keys: Object.keys(entries), whatsapp: wa });
  revalidatePath('/', 'layout');
  flash(S, 'saved');
}

/** Pulls live USD-based rates from open.er-api.com (free, no key) for the supported currencies. */
export async function refreshRates() {
  const admin = await requireAdmin();
  const S = '/admin/settings';
  const settings = await getSettings();
  let rates: Record<string, number> | null = null;
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    const json = await res.json();
    if (json?.result === 'success') rates = json.rates;
  } catch (e) {
    console.error('rate refresh failed', e);
  }
  if (!rates) flash(S, 'error', 'ratesFetch');
  const merged: Record<string, number> = { ...settings.exchangeRates, USD: 1 };
  for (const c of settings.supportedCurrencies) if (typeof rates![c] === 'number') merged[c] = rates![c];
  await createAdminClient().from('site_settings').upsert({ key: 'exchange_rates', value: merged }, { onConflict: 'key' });
  await audit(admin.id, 'rates.refresh', 'settings', null);
  revalidatePath('/', 'layout');
  flash(S, 'saved');
}

/* ============================ LANGUAGES / TEXT =========================== */

export async function languageAction(formData: FormData) {
  const admin = await requireAdmin();
  const T = '/admin/translations';
  const db = createAdminClient();
  const op = String(formData.get('op'));
  const code = String(formData.get('code') ?? '').trim().toLowerCase();
  if (!/^[a-z]{2,3}(-[a-z]{2,4})?$/.test(code)) flash(T, 'error', 'code');

  if (op === 'add') {
    const name = text(60).min(1).safeParse(formData.get('name'));
    const native = text(60).min(1).safeParse(formData.get('native_name'));
    if (!name.success || !native.success) flash(T, 'error', 'invalid');
    const { count } = await db.from('languages').select('code', { count: 'exact', head: true });
    const { error } = await db.from('languages').insert({
      code, name: name.data, native_name: native.data, is_rtl: formData.get('is_rtl') === 'on', sort_order: (count ?? 0) + 1,
    });
    if (error) flash(T, 'error', 'exists');
  } else if (op === 'toggle' || op === 'rtl' || op === 'default') {
    const { data: lang } = await db.from('languages').select('*').eq('code', code).single();
    if (!lang) flash(T, 'error', 'code');
    const settings = await getSettings();
    if (op === 'toggle') {
      if (lang!.is_active && (code === settings.defaultLanguage || code === 'en')) flash(T, 'error', 'protected');
      await db.from('languages').update({ is_active: !lang!.is_active }).eq('code', code);
    } else if (op === 'rtl') {
      await db.from('languages').update({ is_rtl: !lang!.is_rtl }).eq('code', code);
    } else {
      if (!lang!.is_active) flash(T, 'error', 'inactive');
      await db.from('site_settings').upsert({ key: 'default_language', value: code }, { onConflict: 'key' });
    }
  }
  await audit(admin.id, `language.${op}`, 'language', code);
  revalidateTag('languages');
  revalidatePath('/', 'layout');
  flash(T, 'saved');
}

export async function saveTranslations(formData: FormData) {
  const admin = await requireAdmin();
  const lang = String(formData.get('lang') ?? '');
  const T = `/admin/translations`;
  const known = (await getLanguages()).map((l) => l.code);
  if (!known.includes(lang)) flash(T, 'error', 'code');
  const db = createAdminClient();
  let changed = 0;
  for (const [field, raw] of formData.entries()) {
    if (!field.startsWith('t:')) continue;
    const key = field.slice(2);
    if (!(key in fileMessages.en)) continue; // only known keys
    const value = String(raw).trim().slice(0, 2000);
    const baseline = fileMessages[lang]?.[key] ?? fileMessages.en[key];
    if (!value || value === baseline) {
      await db.from('translations').delete().eq('language_code', lang).eq('translation_key', key);
    } else {
      await db.from('translations').upsert({ language_code: lang, translation_key: key, translation_value: value }, { onConflict: 'language_code,translation_key' });
      changed++;
    }
  }
  await audit(admin.id, 'translations.update', 'language', lang, { overrides: changed });
  revalidateTag('translations');
  revalidatePath('/', 'layout');
  redirect(`${T}?lang=${lang}&saved=1`);
}

/* ============================ CUSTOMERS / OPS ============================ */

export async function setSuspended(formData: FormData) {
  const admin = await requireAdmin();
  const id = uuid.safeParse(formData.get('userId'));
  if (!id.success) redirect('/admin/customers');
  const path = `/admin/customers/${id.data}`;
  if (id.data === admin.id) flash(path, 'error', 'self');
  const suspend = formData.get('suspend') === '1';
  const { error } = await createAdminClient().from('profiles').update({ is_suspended: suspend }).eq('id', id.data).eq('role', 'customer');
  if (error) flash(path, 'error', 'save');
  await audit(admin.id, suspend ? 'customer.suspend' : 'customer.unsuspend', 'customer', id.data);
  flash(path, 'saved');
}

export async function closeSupport(formData: FormData) {
  const admin = await requireAdmin();
  const id = uuid.safeParse(formData.get('id'));
  if (!id.success) redirect('/admin/support');
  await createAdminClient().from('support_requests').update({ status: 'closed' }).eq('id', id.data);
  await audit(admin.id, 'support.close', 'support', id.data);
  flash('/admin/support', 'saved');
}

export async function retryNotification(formData: FormData) {
  const admin = await requireAdmin();
  const id = uuid.safeParse(formData.get('id'));
  if (!id.success) redirect('/admin/notifications');
  const res = await deliver(id.data);
  await audit(admin.id, 'notification.retry', 'notification', id.data, { ok: res.ok });
  if (!res.ok) flash('/admin/notifications', 'error', 'send');
  flash('/admin/notifications', 'saved');
}
