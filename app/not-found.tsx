import Link from 'next/link';
import { getI18n } from '@/lib/i18n';

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <div className="container-x py-24 text-center">
      <p className="text-5xl font-display font-semibold text-forest-700">404</p>
      <h1 className="h2 mt-3">{t('error.notFound')}</h1>
      <p className="muted mt-2">{t('error.notFoundText')}</p>
      <Link href="/" className="btn btn-primary mt-6">{t('error.home')}</Link>
    </div>
  );
}
