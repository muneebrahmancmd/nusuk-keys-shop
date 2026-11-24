/** Stored format: E.164 with a leading "+", e.g. +966599732748 */
export const WHATSAPP_RE = /^\+[1-9]\d{7,14}$/;

export function normalizeWhatsapp(input: string): string | null {
  const cleaned = '+' + input.replace(/[^\d]/g, '');
  return WHATSAPP_RE.test(cleaned) ? cleaned : null;
}

/** The customer reviews and sends the pre-filled message themselves. */
export function whatsappLink(number: string | undefined | null, message: string): string | null {
  if (!number || !WHATSAPP_RE.test(number)) return null;
  return `https://wa.me/${number.slice(1)}?text=${encodeURIComponent(message)}`;
}

export function orderMessage(o: {
  order_number: string;
  package_name: string;
  credit_quantity: number;
  quantity: number;
  total: string; // already formatted with currency code
  country: string;
}) {
  return [
    'Hello! I would like to complete my digital-credit order.',
    '',
    `Order ID: ${o.order_number}`,
    `Package: ${o.package_name}`,
    `Credits: ${o.credit_quantity * o.quantity} (${o.quantity} x ${o.credit_quantity})`,
    `Total Amount: ${o.total}`,
    `Country: ${o.country}`,
    '',
    'Please provide the payment instructions.',
  ].join('\n');
}
