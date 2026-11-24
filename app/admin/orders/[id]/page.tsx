import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatDate, formatMoney } from '@/lib/format';
import { countryName } from '@/lib/countries';
import { overallStatus, type Overall } from '@/lib/status';
import { addOrderNote, orderAction } from '@/app/admin/actions';
import { OrderProgress, StatusBadge } from '@/components/ui';
import { Flash } from '@/components/admin/bits';
import type { Order } from '@/lib/types';

const t = (k: string) => k.replace('status.', '').replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase());

export default async function AdminOrder({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = createAdminClient();
  const { data } = await db.from('orders').select('*, profiles(id,full_name,email,country,is_suspended)').eq('id', id).maybeSingle();
  if (!data) notFound();
  const o = data as Order & { profiles: any };
  const [{ data: notes }, { data: log }] = await Promise.all([
    db.from('order_notes').select('note,created_at,profiles(full_name,email)').eq('order_id', id).order('created_at', { ascending: false }),
    db.from('audit_logs').select('action,created_at,profiles(full_name,email)').eq('target_type', 'order').eq('target_id', id).order('created_at', { ascending: false }),
  ]);

  const pay = o.payment_status, ful = o.fulfillment_status;
  const btns: { action: string; label: string; cls: string; show: boolean }[] = [
    { action: 'under_verification', label: 'Mark under verification', cls: 'btn-ghost', show: ful === 'not_started' && ['pending', 'submitted'].includes(pay) },
    { action: 'approve', label: 'Approve payment', cls: 'btn-primary', show: ful === 'not_started' && ['pending', 'submitted', 'under_verification'].includes(pay) },
    { action: 'reject', label: 'Reject payment', cls: 'btn-danger', show: ful === 'not_started' && ['pending', 'submitted', 'under_verification'].includes(pay) },
    { action: 'processing', label: 'Start processing', cls: 'btn-primary', show: pay === 'approved' && ful === 'not_started' },
    { action: 'fulfilled', label: 'Mark fulfilled', cls: 'btn-primary', show: pay === 'approved' && ful === 'processing' },
    { action: 'cancel', label: 'Cancel order', cls: 'btn-danger', show: ['not_started', 'processing'].includes(ful) },
    { action: 'refund_complete', label: 'Refund processed', cls: 'btn-primary', show: ful === 'refund_requested' },
    { action: 'refund_decline', label: 'Decline refund (restore order)', cls: 'btn-ghost', show: ful === 'refund_requested' && !!o.status_before_refund },
  ];
  const status = overallStatus(o) as Overall;

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex justify-between gap-4 py-2.5"><dt className="muted text-sm">{label}</dt><dd className="text-end text-sm font-medium">{children}</dd></div>
  );

  return (
    <div className="space-y-6">
      <Link href="/admin/orders" className="muted text-sm hover:underline">← Orders</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="h2 font-mono">{o.order_number}</h1><StatusBadge status={status} t={t} />
      </div>
      <Flash saved={sp.saved} error={sp.error} />
      <section className="card p-6"><OrderProgress status={status} t={t} /></section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="font-semibold">Order</h2>
          <dl className="mt-2 divide-y divide-line">
            <Row label="Package">{o.package_name}</Row>
            <Row label="Credits">{(o.credit_quantity * o.quantity).toLocaleString()} ({o.quantity} × {o.credit_quantity})</Row>
            <Row label="Unit price">{formatMoney(o.unit_price, o.currency, 'en')}</Row>
            <Row label="Total">{formatMoney(o.total_price, o.currency, 'en')}{o.price_is_estimate ? ' (converted estimate)' : ''}</Row>
            <Row label="Country">{countryName(o.customer_country, 'en')}</Row>
            <Row label="Payment">{t(pay)}</Row><Row label="Fulfilment">{t(ful)}</Row>
            <Row label="Placed">{formatDate(o.created_at, 'en')}</Row>
            <Row label="Terms accepted">{formatDate(o.terms_accepted_at, 'en')}</Row>
            <Row label="Customer reported proof">{o.proof_sent_at ? formatDate(o.proof_sent_at, 'en') : '—'}</Row>
          </dl>
          <p className="mt-3 rounded-xl bg-sage-100/70 p-3 text-sm"><strong>Redeemable for:</strong> {o.redeemable_for}</p>
        </section>
        <section className="card p-6">
          <h2 className="font-semibold">Customer</h2>
          <dl className="mt-2 divide-y divide-line">
            <Row label="Name">{o.profiles?.full_name ?? '—'}</Row>
            <Row label="Email">{o.profiles?.email}</Row>
            <Row label="Account">{o.profiles?.is_suspended ? 'Suspended' : 'Active'}</Row>
          </dl>
          <Link href={`/admin/customers/${o.profiles?.id}`} className="btn btn-ghost btn-sm mt-3">Customer profile</Link>
        </section>
      </div>

      <section className="card p-6">
        <h2 className="font-semibold">Actions</h2>
        <p className="muted mt-1 text-sm">Verify the payment proof in WhatsApp first. Payment is never approved automatically.</p>
        <form action={orderAction} className="mt-4 space-y-3">
          <input type="hidden" name="orderId" value={o.id} />
          <textarea name="note" rows={2} maxLength={2000} placeholder="Internal note for this action (optional, e.g. how the payment was verified)" className="input" />
          <div className="flex flex-wrap gap-2">
            {btns.filter((b) => b.show).map((b) => (
              <button key={b.action} name="action" value={b.action} className={`btn btn-sm ${b.cls}`}>{b.label}</button>
            ))}
            {!btns.some((b) => b.show) && <p className="muted text-sm">No further actions: this order is in a final state.</p>}
          </div>
        </form>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="font-semibold">Internal notes</h2>
          <form action={addOrderNote} className="mt-3 flex gap-2">
            <input type="hidden" name="orderId" value={o.id} />
            <input name="note" required maxLength={2000} className="input" placeholder="Add a note" aria-label="Note" />
            <button className="btn btn-ghost">Add</button>
          </form>
          <ul className="mt-4 space-y-3 text-sm">
            {(notes ?? []).length === 0 && <li className="muted">No notes.</li>}
            {(notes as any[] ?? []).map((n, i) => (
              <li key={i} className="rounded-xl bg-ivory p-3"><p>{n.note}</p>
                <p className="muted mt-1 text-xs">{n.profiles?.full_name ?? n.profiles?.email ?? 'Customer'} · {formatDate(n.created_at, 'en')}</p></li>
            ))}
          </ul>
        </section>
        <section className="card p-6">
          <h2 className="font-semibold">Audit trail</h2>
          <ul className="mt-3 divide-y divide-line text-sm">
            {(log ?? []).length === 0 && <li className="muted py-2">No admin actions yet.</li>}
            {(log as any[] ?? []).map((l, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2 py-2"><strong>{l.action}</strong>
                <span className="muted">{l.profiles?.full_name ?? l.profiles?.email} · {formatDate(l.created_at, 'en')}</span></li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
