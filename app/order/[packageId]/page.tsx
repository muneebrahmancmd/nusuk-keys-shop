import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getI18n } from '@/lib/i18n';
import { getPrefs } from '@/lib/prefs';
import { requireUser } from '@/lib/auth';
import { getPricedPackage } from '@/lib/pricing';
import { countryName, flag } from '@/lib/countries';
import { formatMoney } from '@/lib/format';
import { createOrder } from '@/app/actions';
import { Notice } from '@/components/ui';

export const metadata: Metadata = { title: 'Confirm order' };

const ERRORS = new Set(['terms', 'package', 'currency', 'price', 'country', 'account', 'quantity', 'rate', 'generic']);

export default async function OrderPage({
  params, searchParams,
}: { params: Promise<{ packageId: string }>; searchParams: Promise<{ error?: string }> }) {
  const { packageId } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(packageId)) notFound();
  const profile = await requireUser(`/order/${packageId}`);
  const [{ t, lang }, { country, currency, settings }] = await Promise.all([getI18n(), getPrefs()]);
  const pkg = await getPricedPackage(packageId, currency).catch(() => null);
  const error = sp.error && ERRORS.has(sp.error) ? sp.error : null;

  if (!pkg) {
    return (
      <div className="container-x max-w-xl py-16">
        <Notice tone="error">{t('order.error.package')}</Notice>
        <Link href="/packages" className="btn btn-ghost mt-4">{t('nav.packages')}</Link>
      </div>
    );
  }

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-start justify-between gap-4 py-3"><dt className="muted text-sm">{label}</dt><dd className="text-end text-sm font-medium">{children}</dd></div>
  );

  return (
    <div className="container-x max-w-2xl py-12">
      <h1 className="h2">{t('order.title')}</h1>
      {error && <div className="mt-5"><Notice tone="error">{t(`order.error.${error}`)}</Notice></div>}

      <form action={createOrder} className="card mt-6 p-6">
        <input type="hidden" name="packageId" value={pkg.id} />
        <dl className="divide-y divide-line">
          <Row label={t('order.customer')}>{profile.full_name ?? profile.email}</Row>
          <Row label={t('order.package')}>{pkg.name}</Row>
          <Row label={t('order.credits')}>{pkg.credit_quantity.toLocaleString(lang)}</Row>
          <Row label={t('order.quantity')}>
            <select name="quantity" defaultValue="1" className="input !w-24" aria-label={t('order.quantity')}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n}>{n}</option>)}
            </select>
          </Row>
          <Row label={t('order.unitPrice')}>
            {pkg.unit_price != null ? <span dir="ltr">{formatMoney(pkg.unit_price, currency, lang)}</span> : t('packages.priceUnavailable')}
          </Row>
          <Row label={t('order.country')}>{country ? `${flag(country)} ${countryName(country, lang)}` : <span className="text-red-700">{t('order.error.country')}</span>}</Row>
          <Row label={t('order.currency')}>{currency}</Row>
          <Row label={t('order.id')}><span className="muted">{t('order.idAfter')}</span></Row>
        </dl>
        {pkg.is_estimate && <div className="mt-4"><Notice tone="warn">{t('common.estimate')}. {t('common.estimateNote')}</Notice></div>}

        <div className="mt-5 rounded-xl bg-sage-100/70 p-4 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-forest-700">{t('packages.redeemable')}</p>
          <p className="mt-1">{pkg.redeemable_for}</p>
          <p className="muted mt-2 text-xs">{t('order.redeemableNote')}</p>
        </div>

        <div className="mt-5">
          <h2 className="text-sm font-semibold">{t('order.instructions')}</h2>
          <p className="muted mt-1 whitespace-pre-line text-sm">{settings.paymentInstructions}</p>
          <p className="mt-2 text-xs font-medium text-red-800">{t('order.noPasswords')}</p>
        </div>

        <label className="mt-5 flex items-start gap-3 text-sm">
          <input type="checkbox" name="terms" required className="mt-1 h-4 w-4 accent-forest-700" />
          <span>
            {t('order.terms')}{' '}
            <Link href="/legal/terms" target="_blank" className="underline">{t('footer.terms')}</Link>
            {' · '}
            <Link href="/legal/refund" target="_blank" className="underline">{t('footer.refund')}</Link>
          </span>
        </label>

        <button className="btn btn-primary mt-6 w-full" disabled={pkg.unit_price == null || !country}>{t('order.confirm')}</button>
      </form>
    </div>
  );
}
