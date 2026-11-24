import { requireAdmin } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { getLanguages } from '@/lib/i18n';
import { ALL_CURRENCIES, currencyName } from '@/lib/countries';
import { refreshRates, saveSettings } from '@/app/admin/actions';
import { Field, Flash } from '@/components/admin/bits';

const NOTIFY: [string, string][] = [
  ['registration', 'New customer registrations'], ['order', 'New orders'], ['payment', 'Payment status changes'],
  ['fulfillment', 'Order fulfilment'], ['support', 'Support requests'], ['customer_emails', 'Emails to customers (welcome, order, status)'],
];

export default async function AdminSettings({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [s, languages] = await Promise.all([getSettings(), getLanguages()]);
  const overrides = Object.entries(s.rateOverrides).map(([k, v]) => `${k}=${v}`).join('\n');

  return (
    <div className="space-y-6">
      <h1 className="h2">Website settings</h1>
      <Flash saved={sp.saved} error={sp.error} />
      <form action={saveSettings} className="space-y-6">
        <section className="card grid gap-4 p-6 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">Brand</h2>
          <Field label="Website name"><input name="site_name" required maxLength={80} defaultValue={s.siteName} className="input" /></Field>
          <Field label="Logo URL (https, optional)"><input name="logo_url" defaultValue={s.logoUrl} className="input" placeholder="https://…" /></Field>
          <div className="sm:col-span-2"><Field label="Description"><textarea name="site_description" rows={2} maxLength={300} defaultValue={s.siteDescription} className="input" /></Field></div>
          <div className="sm:col-span-2"><Field label="Homepage announcement (empty = hidden)"><input name="announcement" maxLength={300} defaultValue={s.announcement} className="input" /></Field></div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="maintenance_mode" defaultChecked={s.maintenance} className="h-4 w-4 accent-forest-700" /> Maintenance mode (visitors see a maintenance page; admins can still sign in)</label>
        </section>

        <section className="card grid gap-4 p-6 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">Contact</h2>
          <Field label="WhatsApp number" hint="International format. Every WhatsApp button on the site uses this number."><input name="whatsapp_number" required defaultValue={s.whatsapp} className="input" dir="ltr" placeholder="+966599732748" /></Field>
          <Field label="Administrator email" hint="Receives admin notifications."><input name="admin_email" type="email" required defaultValue={s.adminEmail} className="input" /></Field>
          <div className="sm:col-span-2"><Field label="Customer support information"><textarea name="support_info" rows={2} maxLength={1000} defaultValue={s.supportInfo} className="input" /></Field></div>
          <div className="sm:col-span-2"><Field label="Payment instructions (shown on order pages)"><textarea name="payment_instructions" rows={4} maxLength={3000} defaultValue={s.paymentInstructions} className="input" /></Field></div>
        </section>

        <section className="card space-y-4 p-6">
          <h2 className="font-semibold">Currencies and language</h2>
          <fieldset>
            <legend className="label">Supported currencies</legend>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3 lg:grid-cols-4">
              {ALL_CURRENCIES.map((c) => (
                <label key={c} className="flex items-center gap-2"><input type="checkbox" name="currency" value={c} defaultChecked={s.supportedCurrencies.includes(c)} className="h-4 w-4 accent-forest-700" /><span title={currencyName(c, 'en')}>{c}</span></label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Default currency"><select name="default_currency" defaultValue={s.defaultCurrency} className="input">{ALL_CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Default language"><select name="default_language" defaultValue={s.defaultLanguage} className="input">{languages.filter((l) => l.is_active).map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}</select></Field>
          </div>
          <Field label="Manual exchange-rate overrides (per 1 USD)" hint="One per line, e.g. PKR=285. An override wins over the live/stored rate. Existing orders are never changed.">
            <textarea name="rate_overrides" rows={3} defaultValue={overrides} className="input font-mono" />
          </Field>
        </section>

        <section className="card p-6">
          <h2 className="font-semibold">Email notification categories</h2>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            {NOTIFY.map(([k, label]) => (
              <label key={k} className="flex items-center gap-2"><input type="checkbox" name={`notify_${k}`} defaultChecked={s.notify[k] !== false} className="h-4 w-4 accent-forest-700" />{label}</label>
            ))}
          </div>
        </section>
        <button className="btn btn-primary">Save settings</button>
      </form>

      <section className="card p-6">
        <h2 className="font-semibold">Stored exchange rates (units per 1 USD)</h2>
        <p className="muted mt-1 text-sm">The seeded values are placeholders. Refresh them before taking real orders. The refresh pulls from open.er-api.com and only touches supported currencies.</p>
        <p className="mt-3 font-mono text-xs">{s.supportedCurrencies.map((c) => `${c} ${s.exchangeRates[c] ?? '—'}`).join('  ·  ')}</p>
        <form action={refreshRates} className="mt-4"><button className="btn btn-ghost btn-sm">Refresh live rates</button></form>
      </section>
    </div>
  );
}
