import type { Metadata } from 'next';
import Link from 'next/link';
import { LogIn } from 'lucide-react';
import { getI18n } from '@/lib/i18n';
import { getPrefs } from '@/lib/prefs';
import { getProfile } from '@/lib/auth';
import { signInWithGoogle, signOut } from '@/app/actions';
import { safeNext } from '@/lib/format';
import { Notice } from '@/components/ui';
import PrefSelect from '@/components/PrefSelect';
import { countryOptions } from '@/lib/countries';

export const metadata: Metadata = { title: 'Sign in' };

const ERRORS = new Set(['oauth', 'suspended', 'forbidden', 'session', 'generic']);

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const [{ t, lang }, { country }, profile] = await Promise.all([getI18n(), getPrefs(), getProfile()]);
  const next = safeNext(sp.next);
  const error = sp.error && ERRORS.has(sp.error) ? sp.error : null;

  return (
    <div className="container-x flex justify-center py-16">
      <div className="card w-full max-w-md p-8">
        <h1 className="h2">{t('login.title')}</h1>
        <p className="muted mt-2 text-sm">{t('login.subtitle')}</p>
        {error && <div className="mt-5"><Notice tone="error">{t(`login.error.${error}`)}</Notice></div>}

        {profile ? (
          <div className="mt-6 space-y-3">
            <p className="text-sm">{t('login.signedInAs', { email: profile.email })}</p>
            <Link href={next} className="btn btn-primary w-full">{t('nav.dashboard')}</Link>
            <form action={signOut}><button className="btn btn-ghost w-full" type="submit">{t('nav.signOut')}</button></form>
          </div>
        ) : (
          <>
            <div className="mt-6">
              <label className="label">{t('login.country')}</label>
              <PrefSelect name="country" value={country ?? ''} label={t('common.country')}
                options={[{ value: '', label: `🌐 ${t('common.selectCountry')}` }, ...countryOptions(lang)]} />
            </div>
            <form action={signInWithGoogle} className="mt-5">
              <input type="hidden" name="next" value={next} />
              <button type="submit" className="btn btn-primary w-full">
                <LogIn size={18} aria-hidden />
                {t('login.google')}
              </button>
            </form>
            <p className="muted mt-4 text-xs">{t('login.consent')}</p>
          </>
        )}
      </div>
    </div>
  );
}
