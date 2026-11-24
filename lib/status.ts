import type { Order } from './types';

export type Overall =
  | 'pending' | 'submitted' | 'under_verification' | 'approved' | 'rejected'
  | 'processing' | 'fulfilled' | 'cancelled' | 'refund_requested' | 'refunded';

/** One customer-facing status derived from the two underlying columns. */
export function overallStatus(o: Pick<Order, 'payment_status' | 'fulfillment_status'>): Overall {
  switch (o.fulfillment_status) {
    case 'cancelled': return 'cancelled';
    case 'refund_requested': return 'refund_requested';
    case 'refunded': return 'refunded';
    case 'fulfilled': return 'fulfilled';
    case 'processing': return 'processing';
  }
  return o.payment_status;
}

export const PROGRESS_STEPS: Overall[] = [
  'pending', 'submitted', 'under_verification', 'approved', 'processing', 'fulfilled',
];

export function progressIndex(s: Overall): number {
  const i = PROGRESS_STEPS.indexOf(s);
  return i === -1 ? -1 : i;
}

export const STATUS_TONE: Record<Overall, string> = {
  pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  submitted: 'bg-sky-50 text-sky-800 ring-sky-200',
  under_verification: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  approved: 'bg-sage-100 text-forest-700 ring-sage-300',
  rejected: 'bg-red-50 text-red-800 ring-red-200',
  processing: 'bg-sage-100 text-forest-700 ring-sage-300',
  fulfilled: 'bg-forest-700 text-white ring-forest-800',
  cancelled: 'bg-neutral-100 text-neutral-700 ring-neutral-300',
  refund_requested: 'bg-orange-50 text-orange-800 ring-orange-200',
  refunded: 'bg-neutral-100 text-neutral-700 ring-neutral-300',
};
