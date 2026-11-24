import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { DEFAULT_LANGUAGE_CODES } from '@/lib/i18n/languages';
import { currencyForCountry, isCountry } from '@/lib/countries';

const PROTECTED = ['/dashboard', '/orders', '/order', '/admin'];
const YEAR = 60 * 60 * 24 * 365;

function detectLang(header: string | null): string | null {
  if (!header) return null;
  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=');
      return { tag: tag.toLowerCase(), q: q ? parseFloat(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { tag } of ranked) {
    const primary = tag.split('-')[0];
    if (DEFAULT_LANGUAGE_CODES.includes(primary)) return primary;
  }
  return null;
}

function detectCountry(req: NextRequest): string | null {
  const geo = req.headers.get('x-vercel-ip-country')?.toUpperCase();
  if (isCountry(geo)) return geo;
  for (const part of (req.headers.get('accept-language') ?? '').split(',')) {
    const region = part.trim().split(';')[0].split('-')[1]?.toUpperCase();
    if (isCountry(region)) return region;
  }
  return null;
}

export async function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set('x-pathname', request.nextUrl.pathname);
  let response = NextResponse.next({ request: { headers } });
  const path = request.nextUrl.pathname;

  // First visit: suggest language / country / currency from the browser. Never overrides a saved choice.
  const cookieOpts = { path: '/', maxAge: YEAR, sameSite: 'lax' as const };
  const setPref = (name: string, value: string) => {
    request.cookies.set(name, value);
    response.cookies.set(name, value, cookieOpts);
  };
  if (!request.cookies.get('lang')) setPref('lang', detectLang(request.headers.get('accept-language')) ?? 'en');
  if (!request.cookies.get('country')) {
    const c = detectCountry(request);
    if (c) {
      setPref('country', c);
      const cur = currencyForCountry(c);
      if (cur && !request.cookies.get('currency')) setPref('currency', cur);
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return response; // not configured yet: pages show a setup notice

  let user = null;
  try {
    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          const carry = response.cookies.getAll();
          response = NextResponse.next({ request: { headers } });
          carry.forEach((c) => response.cookies.set(c));
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    user = (await supabase.auth.getUser()).data.user; // also refreshes the session cookie
  } catch {
    /* treated as signed out */
  }

  if (!user && PROTECTED.some((p) => path === p || path.startsWith(p + '/'))) {
    const to = request.nextUrl.clone();
    to.pathname = '/login';
    to.search = `?next=${encodeURIComponent(path)}`;
    const redirect = NextResponse.redirect(to);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)'],
};
