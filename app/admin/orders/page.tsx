import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatDate, formatMoney } from '@/lib/format';
import { overallStatus, type Overall } from '@/lib/status';
import { StatusBadge } from '@/components/ui';

const FILTERS: Record<string, (q: any) => any> = {
  pending: (q) => q.eq('payment_status', 'pending').eq('fulfillment_status', 'not_started'),
  submitted: (q) => q.eq('payment_status', 'submitted').eq('fulfillment_status', 'not_started'),
  under_verification: (q) => q.eq('payment_status', 'under_verification').eq('fulfillment_status', 'not_started'),
  approved: (q) => q.eq('payment_status', 'approved').eq('fulfillment_status', 'not_started'),
  rejected: (q) => q.eq('payment_status', 'rejected').eq('fulfillment_status', 'not_started'),
  processing: (q) => q.eq('fulfillment_status', 'processing'),
  fulfilled: (q) => q.eq('fulfillment_status', 'fulfilled'),
  cancelled: (q) => q.eq('fulfillment_status', 'cancelled'),
  refund_requested: (q) => q.eq('fulfillment_status', 'refund_requested'),
  refunded: (q) => q.eq('fulfillment_status', 'refunded'),
};

// Admin pages are English-only; reuse the English status labels.
const t = (k: string) => k.replace('status.', '').replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase());

export default async function AdminOrders({
  searchParams,
}: { searchParams: Promise<{ q?: string; status?: string; from?: string; to?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  let query = createAdminClient().from('orders').select('*, profiles(full_name,email)').order('created_at', { ascending: false }).limit(200);
  if (sp.q) query = query.ilike('order_number', `%${sp.q.replace(/[%_,()]/g, '').trim()}%`);
  if (sp.status && FILTERS[sp.status]) query = FILTERS[sp.status](query);
  if (sp.from && !isNaN(Date.parse(sp.from))) query = query.gte('created_at', new Date(sp.from).toISOString());
  if (sp.to && !isNaN(Date.parse(sp.to))) query = query.lt('created_at', new Date(Date.parse(sp.to) + 86400_000).toISOString());
  const { data, error } = await query;
  const orders = (data ?? []) as any[];

  return (
    <div>
      <h1 className="h2">Orders</h1>
      <form className="card mt-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1.4fr_1fr_1fr_auto]">
        <input name="q" defaultValue={sp.q} placeholder="Search order ID, e.g. ORD-2026-000001" className="input" aria-label="Search order ID" />
        <select name="status" defaultValue={sp.status ?? ''} className="input" aria-label="Status">
          <option value="">All statuses</option>
          {Object.keys(FILTERS).map((s) => <option key={s} value={s}>{t(s)}</option>)}
        </select>
        <input type="date" name="from" defaultValue={sp.from} className="input" aria-label="From date" />
        <input type="date" name="to" defaultValue={sp.to} className="input" aria-label="To date" />
        <button className="btn btn-primary">Filter</button>
      </form>

      {error && <p className="mt-4 text-sm text-red-700">Could not load orders.</p>}
      <div className="card mt-5 overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead className="border-b border-line"><tr>
            <th className="th">Order</th><th className="th">Customer</th><th className="th">Package</th><th className="th">Total</th><th className="th">Status</th><th className="th">Placed</th>
          </tr></thead>
          <tbody className="divide-y divide-line">
            {orders.length === 0 && <tr><td className="td muted" colSpan={6}>No orders match.</td></tr>}
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-ivory">
                <td className="td font-mono"><Link className="underline" href={`/admin/orders/${o.id}`}>{o.order_number}</Link></td>
                <td className="td">{o.profiles?.full_name ?? o.profiles?.email}<div className="muted text-xs">{o.customer_country}</div></td>
                <td className="td">{o.package_name} × {o.quantity}</td>
                <td className="td whitespace-nowrap">{formatMoney(o.total_price, o.currency, 'en')}</td>
                <td className="td"><StatusBadge status={overallStatus(o) as Overall} t={(k) => t(k)} /></td>
                <td className="td whitespace-nowrap">{formatDate(o.created_at, 'en')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
