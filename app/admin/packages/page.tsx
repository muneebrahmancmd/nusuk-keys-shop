import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSettings } from '@/lib/settings';
import { ALL_CURRENCIES } from '@/lib/countries';
import { formatMoney } from '@/lib/format';
import { deletePackage, savePackage } from '@/app/admin/actions';
import { Field, Flash } from '@/components/admin/bits';
import type { Pkg } from '@/lib/types';

function PackageForm({ pkg, fixed, currencies }: { pkg?: Pkg; fixed: string; currencies: string[] }) {
  const localDt = pkg?.promo_ends_at ? new Date(pkg.promo_ends_at).toISOString().slice(0, 16) : '';
  return (
    <form action={savePackage} className="grid gap-4 sm:grid-cols-2">
      {pkg && <input type="hidden" name="id" value={pkg.id} />}
      <Field label="Name"><input name="name" required maxLength={80} defaultValue={pkg?.name} className="input" /></Field>
      <Field label="Credits"><input name="credit_quantity" type="number" min={1} required defaultValue={pkg?.credit_quantity} className="input" /></Field>
      <Field label="Base price"><input name="base_price" type="number" step="0.01" min={0} required defaultValue={pkg?.base_price} className="input" /></Field>
      <Field label="Price currency">
        <select name="currency" defaultValue={pkg?.currency ?? 'USD'} className="input">
          {Array.from(new Set([...currencies, ...ALL_CURRENCIES])).sort().map((c) => <option key={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Promotional price (optional)"><input name="promo_price" type="number" step="0.01" min={0} defaultValue={pkg?.promo_price ?? ''} className="input" /></Field>
      <Field label="Promotion ends (optional)"><input name="promo_ends_at" type="datetime-local" defaultValue={localDt} className="input" /></Field>
      <div className="sm:col-span-2"><Field label="Description"><textarea name="description" rows={2} maxLength={500} defaultValue={pkg?.description} className="input" /></Field></div>
      <div className="sm:col-span-2">
        <Field label="Redeemable for (shown to customers)" hint="Required before the package can be active (min. 20 characters). Describe exactly what the credits can be used for, and only things you own or are authorised to provide.">
          <textarea name="redeemable_for" rows={2} maxLength={500} defaultValue={pkg?.redeemable_for} className="input" />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Fixed prices per currency (optional)" hint="One per line, e.g. PKR=500. Overrides conversion for that market.">
          <textarea name="fixed_prices" rows={2} defaultValue={fixed} className="input font-mono" />
        </Field>
      </div>
      <Field label="Sort order"><input name="sort_order" type="number" defaultValue={pkg?.sort_order ?? 0} className="input" /></Field>
      <label className="flex items-center gap-2 self-end pb-3 text-sm">
        <input type="checkbox" name="is_active" defaultChecked={pkg?.is_active} className="h-4 w-4 accent-forest-700" /> Active (visible and orderable)
      </label>
      <div className="sm:col-span-2"><button className="btn btn-primary">{pkg ? 'Save package' : 'Create package'}</button></div>
    </form>
  );
}

export default async function AdminPackages({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const db = createAdminClient();
  const [{ data: pkgs }, { data: prices }, settings] = await Promise.all([
    db.from('packages').select('*').order('sort_order').order('credit_quantity'),
    db.from('package_prices').select('*'),
    getSettings(),
  ]);
  const fixedFor = (id: string) => ((prices ?? []) as any[]).filter((p) => p.package_id === id).map((p) => `${p.currency}=${p.price}`).join('\n');

  return (
    <div className="space-y-6">
      <h1 className="h2">Packages</h1>
      <Flash saved={sp.saved} error={sp.error} />
      <details className="card p-6" open={!(pkgs ?? []).length}>
        <summary className="cursor-pointer font-semibold">New package</summary>
        <div className="mt-4"><PackageForm fixed="" currencies={settings.supportedCurrencies} /></div>
      </details>

      {((pkgs ?? []) as Pkg[]).map((p) => (
        <details key={p.id} className="card p-6">
          <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">{p.name} <span className="muted font-normal">· {p.credit_quantity.toLocaleString()} credits · {formatMoney(p.base_price, p.currency, 'en')}</span></span>
            <span className={`badge ${p.is_active ? 'bg-sage-100 text-forest-700 ring-sage-300' : 'bg-neutral-100 text-neutral-700 ring-neutral-300'}`}>{p.is_active ? 'Active' : 'Inactive'}</span>
          </summary>
          <div className="mt-4"><PackageForm pkg={p} fixed={fixedFor(p.id)} currencies={settings.supportedCurrencies} /></div>
          <form action={deletePackage} className="mt-4 border-t border-line pt-4">
            <input type="hidden" name="id" value={p.id} />
            <button className="btn btn-danger btn-sm">Delete package</button>
            <span className="muted ms-3 text-xs">Existing orders keep their own copy of the package details. To just hide it, untick Active instead.</span>
          </form>
        </details>
      ))}
    </div>
  );
}
