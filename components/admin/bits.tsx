import { Notice } from '@/components/ui';

const ERR: Record<string, string> = {
  state: 'That action is not valid for the current state of the order (it may have just changed). Reload and try again.',
  note: 'Write a note first.', provider: 'The fulfilment provider refused the change.',
  invalid: 'Some fields are invalid.', redeemable: 'A package can only be active when it has a "redeemable for" statement of at least 20 characters.',
  fixed: 'Fixed prices must be one per line, like PKR=500.', save: 'Could not save. Check the values and try again.',
  whatsapp: 'Enter a valid international WhatsApp number, e.g. +966599732748.', email: 'Enter a valid administrator email.',
  logo: 'Logo URL must start with https://.', currencies: 'Select at least one currency.',
  defaultCurrency: 'The default currency must be one of the supported currencies.',
  defaultLanguage: 'The default language must be an active language.', rates: 'Rate overrides must be one per line, like PKR=285.',
  name: 'Site name is required.', ratesFetch: 'Could not reach the exchange-rate service. Existing rates were kept.',
  code: 'Invalid language code.', exists: 'That language already exists.', protected: 'English and the default language cannot be deactivated.',
  inactive: 'Activate the language before making it the default.', self: 'You cannot suspend your own account.',
  send: 'Delivery failed again. See the error in the log.',
};

export function Flash({ saved, error }: { saved?: string; error?: string }) {
  if (error) return <div className="mb-5"><Notice tone="error">{ERR[error] ?? 'Something went wrong.'}</Notice></div>;
  if (saved) return <div className="mb-5"><Notice tone="success">Saved.</Notice></div>;
  return null;
}

export const Field = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <div><label className="label">{label}</label>{children}{hint && <p className="muted mt-1 text-xs">{hint}</p>}</div>
);

export const Stat = ({ label, value }: { label: string; value: number | string }) => (
  <div className="card p-5"><p className="muted text-xs uppercase tracking-wide">{label}</p><p className="mt-1 font-display text-3xl font-semibold text-forest-700">{value}</p></div>
);
