import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { COUNTRY_DATA, countryName, flag } from '@/lib/countries';
import { formatDate } from '@/lib/format';

export default async function AdminCustomers({
  searchParams,
}: { searchParams: Promise<{ q?: string; country?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  let query = createAdminClient()
    .from('profiles').select('id,full_name,email,country,created_at,is_suspended')
    .eq('role', 'customer').order('created_at', { ascending: false }).limit(200);
  if (sp.q) {
    const q = sp.q.replace(/[%_,()]/g, '').trim();
    if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
  }
  if (sp.country && /^[A-Z]{2}$/.test(sp.country)) query = query.eq('country', sp.country);
  const { data } = await query;
  const rows = (data ?? []) as any[];

  return (
    <div>
      <h1 className="h2">Customers</h1>
      <form className="card mt-5 grid gap-3 p-4 sm:grid-cols-[2fr_1.5fr_auto]">
        <input name="q" defaultValue={sp.q} placeholder="Search name or email" className="input" aria-label="Search" />
        <select name="country" defaultValue={sp.country ?? ''} className="input" aria-label="Country">
          <option value="">All countries</option>
          {COUNTRY_DATA.map(([c]) => <option key={c} value={c}>{flag(c)} {countryName(c, 'en')}</option>)}
        </select>
        <button className="btn btn-primary">Filter</button>
      </form>
      <div className="card mt-5 overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead className="border-b border-line"><tr><th className="th">Name</th><th className="th">Email</th><th className="th">Country</th><th className="th">Registered</th><th className="th">Status</th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && <tr><td className="td muted" colSpan={5}>No customers found.</td></tr>}
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-ivory">
                <td className="td"><Link className="underline" href={`/admin/customers/${c.id}`}>{c.full_name ?? '(no name)'}</Link></td>
                <td className="td">{c.email}</td>
                <td className="td">{c.country ? `${flag(c.country)} ${countryName(c.country, 'en')}` : '—'}</td>
                <td className="td whitespace-nowrap">{formatDate(c.created_at, 'en', false)}</td>
                <td className="td">{c.is_suspended ? <span className="badge bg-red-50 text-red-800 ring-red-200">Suspended</span> : 'Active'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
