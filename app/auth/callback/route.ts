import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSettings } from '@/lib/settings';
import { notify, emailShell, row, table } from '@/lib/email';
import { countryName, isCountry } from '@/lib/countries';
import { formatDate, safeNext } from '@/lib/format';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));
  const base = process.env.NEXT_PUBLIC_SITE_URL || origin;
  if (!code) return NextResponse.redirect(`${base}/login?error=oauth`);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) return NextResponse.redirect(`${base}/login?error=oauth`);

    // Apply the country/language/currency chosen before signing in to a brand-new profile.
    const db = createAdminClient();
    const { data: profile } = await db.from('profiles').select('*').eq('id', data.user.id).single();
    if (profile) {
      const cookieCountry = request.cookies.get('country')?.value;
      const cookieLang = request.cookies.get('lang')?.value;
      const cookieCur = request.cookies.get('currency')?.value;
      const patch: Record<string, string> = {};
      if (!profile.country && isCountry(cookieCountry)) patch.country = cookieCountry;
      if (!profile.preferred_currency && cookieCur && /^[A-Z]{3}$/.test(cookieCur)) patch.preferred_currency = cookieCur;
      if (cookieLang && /^[a-z]{2,3}$/.test(cookieLang) && profile.preferred_language === 'en') patch.preferred_language = cookieLang;
      if (Object.keys(patch).length) await db.from('profiles').update(patch).eq('id', profile.id);

      if (profile.is_suspended) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${base}/login?error=suspended`);
      }

      // Welcome + admin notification. dedupe keys make this safe on every login.
      const settings = await getSettings();
      const country = patch.country ?? profile.country;
      await Promise.all([
        notify({
          category: 'registration', event: 'registration', dedupeKey: `registration:${profile.id}`,
          to: settings.adminEmail, subject: 'New customer registration',
          html: emailShell(settings.siteName, 'New customer registered', table(
            row('Name', profile.full_name ?? '(not provided)') +
            row('Country', country ? countryName(country, 'en') : '(not selected)') +
            row('Registered', formatDate(profile.created_at, 'en')) +
            row('Email', profile.email))),
        }),
        notify({
          category: 'registration', event: 'welcome', dedupeKey: `welcome:${profile.id}`, customer: true,
          to: profile.email, subject: `Welcome to ${settings.siteName}`,
          html: emailShell(settings.siteName, 'Welcome!', '<p>Your account is ready. You can browse packages and place an order any time.</p>'),
        }),
      ]);
    }
  } catch (e) {
    console.error('auth callback failed', e);
    return NextResponse.redirect(`${base}/login?error=generic`);
  }
  return NextResponse.redirect(`${base}${next}`);
}
