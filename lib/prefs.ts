import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { getSettings } from '@/lib/settings';
import { currencyForCountry, isCountry } from '@/lib/countries';

/** Country + currency for this visitor: cookie -> profile-independent suggestion -> site default. */
export const getPrefs = cache(async () => {
  const [settings, store] = await Promise.all([getSettings(), cookies()]);
  const c = store.get('country')?.value;
  const country = isCountry(c) ? c : null;
  const supported = settings.supportedCurrencies;
  const cur = store.get('currency')?.value;
  const suggested = currencyForCountry(country);
  const currency =
    cur && supported.includes(cur) ? cur
    : suggested && supported.includes(suggested) ? suggested
    : supported.includes(settings.defaultCurrency) ? settings.defaultCurrency
    : supported[0];
  return { settings, country, currency };
});
