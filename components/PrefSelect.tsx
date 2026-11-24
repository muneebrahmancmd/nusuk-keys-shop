'use client';

import { setPreferences } from '@/app/actions';

export default function PrefSelect({
  name, value, label, options,
}: { name: 'lang' | 'country' | 'currency'; value: string; label: string; options: { value: string; label: string }[] }) {
  return (
    <form action={setPreferences}>
      <select
        name={name}
        defaultValue={value}
        aria-label={label}
        title={label}
        className="select-sm"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </form>
  );
}
