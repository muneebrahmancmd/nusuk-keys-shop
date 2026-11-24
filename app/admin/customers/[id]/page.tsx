import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { countryName } from '@/lib/countries';
import { formatDate, formatMoney } from '@/lib/format';
import { overallStatus, type Overall } from '@/lib/status';
import { setSuspended } from '@/app/admin/actions';
import { StatusBadge } from '@/components/ui';
import { Flash } from '@/components/admin/bits';

const t = (k: string) => k.replace('status.', '').replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase());

export default async function AdminCustomer({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = createAdminClient();
  const [{ data: c }, { data: orders }, { data: tickets }] = await Promise.all([
    db.from('profiles').select('*').eq('id', id).maybeSingle(),
    db.from('orders').select('*').eq('user_id', id).order('created_at', { ascending: false }),
    db.from('support_requests').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(20),
  ]);
  if (!c) notFound();

  return (
    <div className="space-y-6">
      <Link href="/admin/customers" className="muted text-sm hover:underline">← Customers</Link>
      <h1 className="h2">{c.full_name ?? c.email}</h1>
      <Flash saved={sp.saved} error={sp.error} />
      <section className="card p-6">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="muted">Email</dt><dd className="font-medium">{c.email}</dd></div>
          <div><dt className="muted">Country</dt><dd className="font-medium">{c.country ? countryName(c.country, 'en') : '—'}</dd></div>
          <div><dt className="muted">Language / currency</dt><dd className="font-medium">{c.preferred_language} / {c.preferred_currency ?? '—'}</dd></div>
          <div><dt className="muted">Registered</dt><dd className="font-medium">{formatDate(c.created_at, 'en')}</dd></div>
          <div><dt className="muted">Role</dt><dd className="font-medium">{c.role}</dd></div>
          <div><dt className="muted">Account</dt><dd className="font-medium">{c.is_suspended ? 'Suspended' : 'Active'}</dd></div>
        </dl>
        {c.role === 'customer' && c.id !== admin.id && (
          <form action={setSuspended} className="mt-5 border-t border-line pt-4">
            <input type="hidden" name="userId" value={c.id} />
            <input type="hidden" name="suspend" value={c.is_suspended ? '0' : '1'} />
            <button className={`btn btn-sm ${c.is_suspended ? 'btn-primary' : 'btn-danger'}`}>{c.is_suspended ? 'Reinstate account' : 'Suspend account'}</button>
            <span className="muted ms-3 text-xs">Suspend only where justified (fraud, abuse). The customer is blocked from signing in and ordering.</span>
          </form>
        )}
      </section>

      <section className="card overflow-x-auto p-6">
        <h2 className="font-semibold">Order history</h2>
        <table className="mt-3 w-full min-w-[560px]">
          <tbody className="divide-y divide-line">
            {(orders ?? []).length === 0 && <tr><td className="td muted">No orders.</td></tr>}
            {(orders as any[] ?? []).map((o) => (
              <tr key={o.id}>
                <td className="td font-mono"><Link className="underline" href={`/admin/orders/${o.id}`}>{o.order_number}</Link></td>
                <td className="td">{o.package_name} × {o.quantity}</td>
                <td className="td whitespace-nowrap">{formatMoney(o.total_price, o.currency, 'en')}</td>
                <td className="td"><StatusBadge status={overallStatus(o) as Overall} t={t} /></td>
                <td className="td whitespace-nowrap">{formatDate(o.created_at, 'en', false)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card p-6">
        <h2 className="font-semibold">Support requests</h2>
        <ul className="mt-3 divide-y divide-line text-sm">
          {(tickets ?? []).length === 0 && <li className="muted py-2">None.</li>}
          {(tickets as any[] ?? []).map((s) => (
            <li key={s.id} className="py-3"><p className="font-medium">{s.subject} <span className="muted font-normal">· {s.status}</span></p>
              <p className="muted mt-1 whitespace-pre-line">{s.message}</p></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
