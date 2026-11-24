import type { Order } from './types';

/**
 * Fulfilment is a pluggable, ADMIN-ONLY step.
 *
 * Only the "manual" provider exists: an administrator delivers the purchased
 * service themselves, then marks the order fulfilled. Nothing here talks to any
 * third-party platform, and nothing here accesses a customer's account on any
 * other service.
 *
 * Do NOT add or enable an adapter that delivers value inside a third-party
 * service until you have independently verified, in writing, that you are
 * authorised to do so and that the delivery method complies with that service's
 * terms. Unknown provider ids are refused on purpose.
 */
export interface FulfillmentProvider {
  id: string;
  /** Called when an admin marks an order fulfilled. Throw to block the transition. */
  onFulfilled(order: Order, adminId: string): Promise<void>;
}

const manual: FulfillmentProvider = {
  id: 'manual',
  async onFulfilled() {
    /* Admin delivered the service by hand; the status change itself is the record. */
  },
};

const REGISTRY: Record<string, FulfillmentProvider> = { manual };

export function getFulfillmentProvider(id: string | undefined): FulfillmentProvider {
  const p = REGISTRY[id ?? 'manual'];
  if (!p) throw new Error(`Fulfilment provider "${id}" is not enabled.`);
  return p;
}
