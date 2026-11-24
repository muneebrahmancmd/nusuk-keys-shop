import 'server-only';
import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';

export interface Settings {
  dbError: boolean;
  siteName: string;
  siteDescription: string;
  logoUrl: string;
  whatsapp: string;
  adminEmail: string;
  supportedCurrencies: string[];
  defaultCurrency: string;
  defaultLanguage: string;
  supportInfo: string;
  paymentInstructions: string;
  announcement: string;
  maintenance: boolean;
  exchangeRates: Record<string, number>;
  rateOverrides: Record<string, number>;
  notify: Record<string, boolean>;
  fulfillmentProvider: string;
}

const DEFAULTS: Settings = {
  dbError: false,
  siteName: 'Sagewood Credits',
  siteDescription: 'Independent digital-credit packages with human-verified orders and clear tracking.',
  logoUrl: '',
  whatsapp: '',
  adminEmail: '',
  supportedCurrencies: ['USD'],
  defaultCurrency: 'USD',
  defaultLanguage: 'en',
  supportInfo: '',
  paymentInstructions: '',
  announcement: '',
  maintenance: false,
  exchangeRates: { USD: 1 },
  rateOverrides: {},
  notify: {},
  fulfillmentProvider: 'manual',
};

/** Server-only: reads ALL settings (including private.*) with the service role. */
export const getSettings = cache(async (): Promise<Settings> => {
  try {
    const { data, error } = await createAdminClient().from('site_settings').select('key,value');
    if (error) throw error;
    const m: Record<string, any> = {};
    for (const r of data ?? []) m[r.key] = r.value;
    const notify: Record<string, boolean> = {};
    for (const k of Object.keys(m)) if (k.startsWith('private.notify.')) notify[k.slice(15)] = m[k] !== false;
    return {
      dbError: false,
      siteName: m.site_name ?? DEFAULTS.siteName,
      siteDescription: m.site_description ?? DEFAULTS.siteDescription,
      logoUrl: m.logo_url ?? '',
      whatsapp: m.whatsapp_number ?? '',
      adminEmail: m['private.admin_email'] ?? '',
      supportedCurrencies: Array.isArray(m.supported_currencies) && m.supported_currencies.length ? m.supported_currencies : ['USD'],
      defaultCurrency: m.default_currency ?? 'USD',
      defaultLanguage: m.default_language ?? 'en',
      supportInfo: m.support_info ?? '',
      paymentInstructions: m.payment_instructions ?? '',
      announcement: m.announcement ?? '',
      maintenance: m.maintenance_mode === true,
      exchangeRates: m.exchange_rates ?? { USD: 1 },
      rateOverrides: m.rate_overrides ?? {},
      notify,
      fulfillmentProvider: m.fulfillment_provider ?? 'manual',
    };
  } catch (e) {
    console.error('settings load failed', e);
    return { ...DEFAULTS, dbError: true };
  }
});
