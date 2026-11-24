import Link from 'next/link';
import { Menu, ShieldCheck } from 'lucide-react';
import { getI18n } from '@/lib/i18n';
import { getPrefs } from '@/lib/prefs';
import { getProfile } from '@/lib/auth';
import { countryOptions, currencySymbol } from '@/lib/countries';
import { signOut } from '@/app/actions';
import PrefSelect from './PrefSelect';
import { Logo } from './ui';

export default async function Navbar() {
  const [{ t, lang, languages }, { country, currency, settings }, profile] = await Promise.all([
    getI18n(), getPrefs(), getProfile(),
  ]);

  const selectors = (
    <>
      <PrefSelect
        name="lang" value={lang} label={t('common.language')}
        options={languages.filter((l) => l.is_active).map((l) => ({ value: l.code, label: l.native_name }))}
      />
      <PrefSelect
        name="country" value={country ?? ''} label={t('common.country')}
        options={[{ value: '', label: `🌐 ${t('common.selectCountry')}` }, ...countryOptions(lang)]}
      />
      <PrefSelect
        name="currency" value={currency} label={t('common.currency')}
        options={settings.supportedCurrencies.map((c) => ({ value: c, label: `${c} (${currencySymbol(c, lang)})` }))}
      />
    </>
  );

  const links = (
    <>
      <Link href="/packages" className="rounded-full px-3 py-2 text-sm hover:bg-sage-100">{t('nav.packages')}</Link>
      <Link href="/#how" className="rounded-full px-3 py-2 text-sm hover:bg-sage-100">{t('nav.howItWorks')}</Link>
      <Link href="/#support" className="rounded-full px-3 py-2 text-sm hover:bg-sage-100">{t('nav.support')}</Link>
    </>
  );

  const account = profile ? (
    <>
      {profile.role === 'admin' && (
        <Link href="/admin" className="btn btn-ghost btn-sm"><ShieldCheck size={14} aria-hidden />{t('nav.admin')}</Link>
      )}
      <Link href="/dashboard" className="btn btn-ghost btn-sm">{t('nav.dashboard')}</Link>
      <form action={signOut}><button className="btn btn-ghost btn-sm" type="submit">{t('nav.signOut')}</button></form>
    </>
  ) : (
    <Link href="/login" className="btn btn-primary btn-sm">{t('nav.signIn')}</Link>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ivory/90 backdrop-blur">
      <div className="container-x flex h-16 items-center justify-between gap-3">
        <Link href="/" aria-label={settings.siteName}><Logo name={settings.siteName} url={settings.logoUrl} /></Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">{links}</nav>
        <div className="hidden items-center gap-2 lg:flex">{selectors}{account}</div>

        <details className="group relative lg:hidden">
          <summary className="btn btn-ghost btn-sm cursor-pointer list-none" aria-label={t('nav.menu')}>
            <Menu size={18} aria-hidden />
          </summary>
          <div className="card absolute end-0 top-12 z-50 flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-3 p-4">
            <nav className="flex flex-col" aria-label="Main">{links}</nav>
            <div className="flex flex-wrap gap-2">{selectors}</div>
            <div className="flex flex-wrap gap-2">{account}</div>
          </div>
        </details>
      </div>
    </header>
  );
}
