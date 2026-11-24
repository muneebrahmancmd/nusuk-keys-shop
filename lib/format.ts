/** Money is always shown with BOTH symbol and ISO code, e.g. "$2.00 USD", to avoid ambiguity. */
export function formatMoney(amount: number | string, currency: string, lang: string) {
  const n = Number(amount);
  try {
    const f = new Intl.NumberFormat(lang, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' });
    return `${f.format(n)} ${currency}`;
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

export function formatNumber(n: number, lang: string) {
  try {
    return new Intl.NumberFormat(lang).format(n);
  } catch {
    return String(n);
  }
}

export function formatDate(iso: string, lang: string, withTime = true) {
  try {
    return new Intl.DateTimeFormat(lang, {
      dateStyle: 'medium',
      ...(withTime ? { timeStyle: 'short' } : {}),
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Only allow same-site relative redirects. */
export function safeNext(next: unknown, fallback = '/dashboard') {
  const s = typeof next === 'string' ? next : '';
  return s.startsWith('/') && !s.startsWith('//') && !s.includes('\\') ? s : fallback;
}
