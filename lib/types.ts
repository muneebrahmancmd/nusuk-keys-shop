export type PaymentStatus = 'pending' | 'submitted' | 'under_verification' | 'approved' | 'rejected';
export type FulfillmentStatus =
  | 'not_started' | 'processing' | 'fulfilled' | 'cancelled' | 'refund_requested' | 'refunded';

export interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  country: string | null;
  preferred_language: string;
  preferred_currency: string | null;
  role: 'customer' | 'admin';
  is_suspended: boolean;
  created_at: string;
}

export interface Pkg {
  id: string;
  name: string;
  description: string;
  redeemable_for: string;
  credit_quantity: number;
  base_price: number;
  currency: string;
  promo_price: number | null;
  promo_ends_at: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  package_id: string | null;
  package_name: string;
  redeemable_for: string;
  credit_quantity: number;
  quantity: number;
  unit_price: number;
  total_price: number;
  currency: string;
  price_is_estimate: boolean;
  payment_status: PaymentStatus;
  fulfillment_status: FulfillmentStatus;
  status_before_refund: FulfillmentStatus | null;
  customer_country: string;
  terms_accepted_at: string;
  proof_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Language {
  code: string;
  name: string;
  native_name: string;
  is_rtl: boolean;
  is_active: boolean;
  sort_order: number;
}
