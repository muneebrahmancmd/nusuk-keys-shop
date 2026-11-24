import type { Metadata } from 'next';
import { getI18n } from '@/lib/i18n';
import { getPrefs } from '@/lib/prefs';
import { getPricedPackages } from '@/lib/pricing';
import { Notice, PackageCard } from '@/components/ui';

export const metadata: Metadata = { title: 'Packages' };

export default async function PackagesPage() {
  const [{ t, lang }, { currency, settings }] = await Promise.all([getI18n(), getPrefs()]);
  let failed = settings.dbError;
  const packages = failed ? [] : await getPricedPackages(currency).catch(() => { failed = true; return []; });
  return (
    <div className="container-x py-12">
      <h1 className="h1 !text-3xl sm:!text-4xl">{t('packages.title')}</h1>
      <p className="muted mt-2">{t('packages.subtitle')}</p>
      <div className="mt-8">
        {failed ? (
          <Notice tone="error">{t('error.db')}</Notice>
        ) : packages.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map((p) => <PackageCard key={p.id} pkg={p} currency={currency} lang={lang} t={t} />)}
          </div>
        ) : (
          <p className="card muted p-8 text-center">{t('packages.empty')}</p>
        )}
      </div>
    </div>
  );
}
