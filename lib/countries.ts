// ISO 3166-1 alpha-2 code, calling code, ISO 4217 currency.
// Country and currency NAMES come from Intl.DisplayNames in the visitor's language,
// symbols from Intl.NumberFormat, flags from the regional-indicator emoji.
export const COUNTRY_DATA: ReadonlyArray<readonly [string, string, string]> = [
  ['US', '+1', 'USD'], ['CA', '+1', 'CAD'], ['MX', '+52', 'MXN'], ['BR', '+55', 'BRL'], ['AR', '+54', 'ARS'],
  ['CL', '+56', 'CLP'], ['CO', '+57', 'COP'], ['PE', '+51', 'PEN'], ['GB', '+44', 'GBP'], ['IE', '+353', 'EUR'],
  ['FR', '+33', 'EUR'], ['DE', '+49', 'EUR'], ['ES', '+34', 'EUR'], ['PT', '+351', 'EUR'], ['IT', '+39', 'EUR'],
  ['NL', '+31', 'EUR'], ['BE', '+32', 'EUR'], ['AT', '+43', 'EUR'], ['FI', '+358', 'EUR'], ['GR', '+30', 'EUR'],
  ['BG', '+359', 'EUR'], ['CH', '+41', 'CHF'], ['SE', '+46', 'SEK'], ['NO', '+47', 'NOK'], ['DK', '+45', 'DKK'],
  ['PL', '+48', 'PLN'], ['CZ', '+420', 'CZK'], ['HU', '+36', 'HUF'], ['RO', '+40', 'RON'], ['UA', '+380', 'UAH'],
  ['RU', '+7', 'RUB'], ['TR', '+90', 'TRY'], ['SA', '+966', 'SAR'], ['AE', '+971', 'AED'], ['QA', '+974', 'QAR'],
  ['KW', '+965', 'KWD'], ['BH', '+973', 'BHD'], ['OM', '+968', 'OMR'], ['JO', '+962', 'JOD'], ['LB', '+961', 'LBP'],
  ['IQ', '+964', 'IQD'], ['IR', '+98', 'IRR'], ['IL', '+972', 'ILS'], ['EG', '+20', 'EGP'], ['MA', '+212', 'MAD'],
  ['DZ', '+213', 'DZD'], ['TN', '+216', 'TND'], ['LY', '+218', 'LYD'], ['SD', '+249', 'SDG'], ['NG', '+234', 'NGN'],
  ['GH', '+233', 'GHS'], ['KE', '+254', 'KES'], ['TZ', '+255', 'TZS'], ['UG', '+256', 'UGX'], ['ET', '+251', 'ETB'],
  ['ZA', '+27', 'ZAR'], ['SN', '+221', 'XOF'], ['SO', '+252', 'SOS'], ['PK', '+92', 'PKR'], ['IN', '+91', 'INR'],
  ['BD', '+880', 'BDT'], ['LK', '+94', 'LKR'], ['NP', '+977', 'NPR'], ['AF', '+93', 'AFN'], ['MV', '+960', 'MVR'],
  ['ID', '+62', 'IDR'], ['MY', '+60', 'MYR'], ['SG', '+65', 'SGD'], ['TH', '+66', 'THB'], ['VN', '+84', 'VND'],
  ['PH', '+63', 'PHP'], ['BN', '+673', 'BND'], ['CN', '+86', 'CNY'], ['HK', '+852', 'HKD'], ['TW', '+886', 'TWD'],
  ['JP', '+81', 'JPY'], ['KR', '+82', 'KRW'], ['AU', '+61', 'AUD'], ['NZ', '+64', 'NZD'], ['KZ', '+7', 'KZT'],
  ['UZ', '+998', 'UZS'], ['AZ', '+994', 'AZN'], ['MM', '+95', 'MMK'], ['KH', '+855', 'KHR'],
];

const BY_CODE = new Map(COUNTRY_DATA.map((c) => [c[0], c]));

export const isCountry = (code: string | null | undefined): code is string => !!code && BY_CODE.has(code);
export const currencyForCountry = (code: string | null | undefined) => (code ? BY_CODE.get(code)?.[2] : undefined);
export const callingCode = (code: string) => BY_CODE.get(code)?.[1] ?? '';

export const ALL_CURRENCIES = Array.from(new Set(COUNTRY_DATA.map((c) => c[2]))).sort();

export function flag(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(...[...code].map((c) => 127397 + c.charCodeAt(0)));
}

export function countryName(code: string, lang: string) {
  try {
    return new Intl.DisplayNames([lang], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function currencyName(code: string, lang: string) {
  try {
    return new Intl.DisplayNames([lang], { type: 'currency' }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function currencySymbol(code: string, lang: string) {
  try {
    const parts = new Intl.NumberFormat(lang, { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0);
    return parts.find((p) => p.type === 'currency')?.value ?? code;
  } catch {
    return code;
  }
}

export function countryOptions(lang: string) {
  return COUNTRY_DATA.map(([code]) => ({ value: code, label: `${flag(code)} ${countryName(code, lang)}` })).sort(
    (a, b) => a.label.localeCompare(b.label, lang),
  );
}
