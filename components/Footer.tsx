import Link from 'next/link';
import { getI18n } from '@/lib/i18n';
import { getSettings } from '@/lib/settings';
import { Logo } from './ui';

export default async function Footer() {
  const [{ t }, settings] = await Promise.all([getI18n(), getSettings()]);
  return (
    <footer className="mt-20 border-t border-line bg-white/60">
      <div className="container-x grid gap-8 py-10 md:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          <Logo name={settings.siteName} url={settings.logoUrl} />
          <p className="muted max-w-md text-sm">{settings.siteDescription}</p>
          <p className="max-w-md rounded-xl border border-line bg-ivory p-3 text-xs text-charcoal-soft">{t('footer.independent')}</p>
        </div>
        <nav className="flex flex-col gap-2 text-sm" aria-label="Legal">
          <Link className="hover:underline" href="/legal/privacy">{t('footer.privacy')}</Link>
          <Link className="hover:underline" href="/legal/terms">{t('footer.terms')}</Link>
          <Link className="hover:underline" href="/legal/refund">{t('footer.refund')}</Link>
          <Link className="hover:underline" href="/legal/contact">{t('footer.contact')}</Link>
        </nav>
      </div>
      <div className="border-t border-line py-4 text-center text-xs text-charcoal-soft">
        © {new Date().getFullYear()} {settings.siteName}. {t('footer.rights')}
      </div>
    </footer>
  );
}
