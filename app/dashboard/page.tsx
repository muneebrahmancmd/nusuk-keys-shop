import type { Metadata } from 'next';
import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { getI18n } from '@/lib/i18n';
import { getPrefs } from '@/lib/prefs';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { countryOptions, currencySymbol } from '@/lib/countries';
import { formatDate, formatMoney } from '@/lib/format';
import { overallStatus } from '@/lib/status';
import { whatsappLink } from '@/lib/whatsapp';
import { submitSupport, updateProfile } from '@/app/actions';
import { Notice, OrderProgress, StatusBadge } from '@/components/ui';
import type { Order } from '@/lib/types';

export const metadata: Metadata = { title: 'My account', robots: { index: false } };

export default async function Dashboard({
  searchParams,
}: { searchParams: Promise<{ saved?: string; support?: string; error?: string }> }) {
  const sp = await searchParams;
  const profile = await requireUser('/dashboard');
  const [{ t, lang, languages }, { settings, country, currency }] = await Promise.all([getI18n(), getPrefs()]);
  const supabase = await createClient();
  const { data } = await supabase.from('orders').select('*').eq('user_id', profile.id).order('created_at', { ascending: false });
  const orders = (data ?? []) as Order[];
  const wa = whatsappLink(settings.whatsapp, t('support.defaultMessage'));

  return (
    <div className="container-x space-y-10 py-12">
      <div>
        <h1 className="h2">{t('dashboard.welcome', { name: profile.full_name ?? profile.email })}</h1>
        <p className="muted mt-1 text-sm">{profile.email}</p>
      </div>
      {sp.saved && <Notice tone="success">{t('dashboard.profileSaved')}</Notice>}
      {sp.support && <Notice tone="success">{t('support.sent')}</Notice>}
      {sp.error && <Notice tone="error">{t('order.error.generic')}</Notice>}

      <section aria-labelledby="orders-h">
        <h2 id="orders-h" className="text-lg font-semibold">{t('dashboard.orders')}</h2>
        {orders.length === 0 ? (
          <div className="card mt-4 p-8 text-center">
            <p className="muted">{t('dashboard.noOrders')}</p>
            <Link href="/packages" className="btn btn-primary mt-4">{t('dashboard.noOrdersCta')}</Link>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {orders.map((o) => {
              const s = overallStatus(o);
              return (
                <article key={o.id} className="card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-mono text-sm font-semibold" dir="ltr">{o.order_number}</p>
                    <StatusBadge status={s} t={t} />
                  </div>
                  <p className="mt-2 text-sm">{o.package_name} · {(o.credit_quantity * o.quantity).toLocaleString(lang)} {t('order.credits').toLowerCase()}</p>
                  <p className="muted text-sm"><span dir="ltr">{formatMoney(o.total_price, o.currency, lang)}</span> · {formatDate(o.created_at, lang)}</p>
                  <div className="mt-4"><OrderProgress status={s} t={t} /></div>
                  <Link href={`/orders/${o.id}`} className="btn btn-ghost btn-sm mt-4">{t('dashboard.viewOrder')}</Link>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="profile-h" className="card p-6">
          <h2 id="profile-h" className="text-lg font-semibold">{t('dashboard.profile')}</h2>
          <form action={updateProfile} className="mt-4 space-y-4">
            <div><label className="label" htmlFor="full_name">{t('common.name')}</label>
              <input id="full_name" name="full_name" defaultValue={profile.full_name ?? ''} required maxLength={100} className="input" /></div>
            <div><label className="label" htmlFor="country">{t('common.country')}</label>
              <select id="country" name="country" defaultValue={profile.country ?? country ?? ''} required className="input">
                <option value="" disabled>{t('common.selectCountry')}</option>
                {countryOptions(lang).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label" htmlFor="lang">{t('common.language')}</label>
                <select id="lang" name="lang" defaultValue={lang} className="input">
                  {languages.filter((l) => l.is_active).map((l) => <option key={l.code} value={l.code}>{l.native_name}</option>)}
                </select></div>
              <div><label className="label" htmlFor="currency">{t('common.currency')}</label>
                <select id="currency" name="currency" defaultValue={profile.preferred_currency ?? currency} className="input">
                  {settings.supportedCurrencies.map((c) => <option key={c} value={c}>{c} ({currencySymbol(c, lang)})</option>)}
                </select></div>
            </div>
            <button className="btn btn-primary">{t('common.save')}</button>
          </form>
        </section>

        <section aria-labelledby="support-h" className="card p-6">
          <h2 id="support-h" className="text-lg font-semibold">{t('dashboard.support')}</h2>
          {settings.supportInfo && <p className="muted mt-1 text-sm">{settings.supportInfo}</p>}
          {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-wa btn-sm mt-3"><MessageCircle size={14} aria-hidden />{t('support.whatsapp')}</a>}
          <form action={submitSupport} className="mt-4 space-y-3">
            <div><label className="label" htmlFor="subject">{t('support.subject')}</label>
              <input id="subject" name="subject" required maxLength={150} className="input" /></div>
            <div><label className="label" htmlFor="orderId">{t('support.order')}</label>
              <select id="orderId" name="orderId" className="input" defaultValue="">
                <option value="">{t('support.none')}</option>
                {orders.map((o) => <option key={o.id} value={o.id}>{o.order_number}</option>)}
              </select></div>
            <div><label className="label" htmlFor="message">{t('support.message')}</label>
              <textarea id="message" name="message" required maxLength={4000} rows={4} className="input" /></div>
            <button className="btn btn-ghost">{t('support.send')}</button>
          </form>
        </section>
      </div>
    </div>
  );
}
