import Link from 'next/link';
import { Check, AlertTriangle, Info } from 'lucide-react';
import { STATUS_TONE, PROGRESS_STEPS, progressIndex, type Overall } from '@/lib/status';
import { formatMoney } from '@/lib/format';
import type { PricedPackage } from '@/lib/pricing';

type T = (k: string, v?: Record<string, string | number>) => string;

export function Logo({ name, url }: { name: string; url?: string }) {
  return (
    <span className="flex items-center gap-2.5">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-9 w-9 rounded-xl object-cover" />
      ) : (
        <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
          <rect width="36" height="36" rx="11" fill="#244F37" />
          <path d="M18 27V16" stroke="#E8EFE6" strokeWidth="2" strokeLinecap="round" />
          <path d="M18 17c0-4.5-3-7-8-7 0 4.5 3 7 8 7Z" fill="#B8CDB3" />
          <path d="M18 20c0-4 2.7-6.5 8-6.5 0 4-2.7 6.5-8 6.5Z" fill="#8FB39B" />
        </svg>
      )}
      <span className="font-display text-lg font-semibold tracking-tight">{name}</span>
    </span>
  );
}

export function StatusBadge({ status, t }: { status: Overall; t: T }) {
  return <span className={`badge ${STATUS_TONE[status]}`}>{t(`status.${status}`)}</span>;
}

export function OrderProgress({ status, t }: { status: Overall; t: T }) {
  const terminal = ['cancelled', 'refund_requested', 'refunded', 'rejected'].includes(status);
  const idx = progressIndex(status);
  return (
    <div>
      <ol className="grid grid-cols-6 gap-1" aria-label="Order progress">
        {PROGRESS_STEPS.map((s, i) => {
          const done = !terminal && idx >= i;
          return (
            <li key={s} className="flex flex-col items-center gap-1.5 text-center">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ring-1 transition ${
                  done ? 'bg-forest-700 text-white ring-forest-800' : 'bg-white text-charcoal-soft ring-line'
                } ${!terminal && idx === i ? 'shadow-lift' : ''}`}
              >
                {done ? <Check size={14} aria-hidden /> : i + 1}
              </span>
              <span className={`hidden text-[11px] leading-tight sm:block ${done ? 'text-charcoal' : 'text-charcoal-soft'}`}>
                {t(`status.${s}`)}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-sm sm:hidden">
        <StatusBadge status={status} t={t} />
      </p>
      {terminal && (
        <p className="mt-3 flex items-center gap-2 text-sm">
          <AlertTriangle size={16} aria-hidden className="text-amber-700" />
          <StatusBadge status={status} t={t} />
        </p>
      )}
    </div>
  );
}

export function Notice({
  tone = 'info', children,
}: { tone?: 'info' | 'error' | 'success' | 'warn'; children: React.ReactNode }) {
  const tones = {
    info: 'border-sage-300 bg-sage-100/60 text-forest-800',
    error: 'border-red-200 bg-red-50 text-red-800',
    success: 'border-sage-300 bg-sage-100 text-forest-800',
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
  } as const;
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${tones[tone]}`}>
      {tone === 'error' || tone === 'warn' ? <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden /> : <Info size={16} className="mt-0.5 shrink-0" aria-hidden />}
      <div>{children}</div>
    </div>
  );
}

export function PackageCard({
  pkg, currency, lang, t,
}: { pkg: PricedPackage; currency: string; lang: string; t: T }) {
  const promo = pkg.promo_price != null && (!pkg.promo_ends_at || new Date(pkg.promo_ends_at) > new Date());
  const hasPrice = pkg.unit_price != null;
  return (
    <article className="card flex animate-rise flex-col p-6 transition duration-300 hover:-translate-y-0.5 hover:shadow-lift">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-xl font-semibold">{pkg.name}</h3>
        {promo && <span className="badge bg-amber-50 text-amber-800 ring-amber-200">{t('packages.promo')}</span>}
      </div>
      <p className="mt-1 text-3xl font-semibold text-forest-700">{t('packages.credits', { n: pkg.credit_quantity.toLocaleString(lang) })}</p>
      {pkg.description && <p className="muted mt-2 text-sm">{pkg.description}</p>}
      <div className="mt-4 rounded-xl bg-sage-100/70 p-3 text-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-forest-700">{t('packages.redeemable')}</p>
        <p className="mt-1">{pkg.redeemable_for}</p>
      </div>
      <div className="mt-auto pt-5">
        {hasPrice ? (
          <>
            <p className="text-2xl font-semibold" dir="ltr" style={{ unicodeBidi: 'plaintext' }}>
              {formatMoney(pkg.unit_price!, currency, lang)}
            </p>
            {pkg.is_estimate && <p className="muted mt-1 text-xs">{t('common.estimate')}. {t('common.estimateNote')}</p>}
            <Link href={`/order/${pkg.id}`} className="btn btn-primary mt-4 w-full">{t('packages.buy')}</Link>
          </>
        ) : (
          <>
            <p className="muted text-sm">{t('packages.priceUnavailable')}</p>
            <span className="btn btn-ghost mt-4 w-full cursor-not-allowed opacity-60" aria-disabled>{t('packages.unavailable')}</span>
          </>
        )}
      </div>
    </article>
  );
}
