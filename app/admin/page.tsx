import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatDate } from '@/lib/format';
import { Stat } from '@/components/admin/bits';

export default async function AdminOverview() {
  await requireAdmin();
  const db = createAdminClient();
  const count = async (build: (q: any) => any) => {
    const { count } = await build(db.from('orders').select('id', { count: 'exact', head: true }));
    return count ?? 0;
  };
  const since = new Date(Date.now() - 13 * 86400_000); since.setHours(0, 0, 0, 0);

  const [customers, total, pending, verification, approved, processing, fulfilled, cancelled, recent, activity] = await Promise.all([
    db.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer').then((r) => r.count ?? 0),
    count((q) => q),
    count((q) => q.eq('payment_status', 'pending').eq('fulfillment_status', 'not_started')),
    count((q) => q.in('payment_status', ['submitted', 'under_verification']).eq('fulfillment_status', 'not_started')),
    count((q) => q.eq('payment_status', 'approved')),
    count((q) => q.eq('fulfillment_status', 'processing')),
    count((q) => q.eq('fulfillment_status', 'fulfilled')),
    count((q) => q.eq('fulfillment_status', 'cancelled')),
    db.from('orders').select('created_at').gte('created_at', since.toISOString()),
    db.from('audit_logs').select('action,target_type,target_id,created_at,profiles(full_name,email)').order('created_at', { ascending: false }).limit(10),
  ]);

  const days: { label: string; n: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000);
    days.push({ label: d.toISOString().slice(5, 10), n: 0 });
  }
  for (const r of (recent.data ?? []) as { created_at: string }[]) {
    const bucket = days.find((d) => d.label === new Date(r.created_at).toISOString().slice(5, 10));
    if (bucket) bucket.n++;
  }
  const max = Math.max(1, ...days.map((d) => d.n));
  const statusBars = [['Pending payment', pending], ['Verification', verification], ['Approved', approved], ['Processing', processing], ['Fulfilled', fulfilled], ['Cancelled', cancelled]] as const;
  const maxStatus = Math.max(1, ...statusBars.map(([, n]) => n));

  return (
    <div className="space-y-8">
      <h1 className="h2">Overview</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Customers" value={customers} /><Stat label="Total orders" value={total} />
        <Stat label="Pending payment" value={pending} /><Stat label="Verification requests" value={verification} />
        <Stat label="Approved payments" value={approved} /><Stat label="Processing" value={processing} />
        <Stat label="Completed" value={fulfilled} /><Stat label="Cancelled" value={cancelled} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="font-semibold">Orders, last 14 days</h2>
          <div className="mt-4 flex h-32 items-end gap-1" role="img" aria-label="Orders per day, last 14 days">
            {days.map((d) => (
              <div key={d.label} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${d.label}: ${d.n}`}>
                <span className="text-[10px] text-charcoal-soft">{d.n || ''}</span>
                <div className="w-full rounded-t bg-forest-600" style={{ height: `${(d.n / max) * 100}%`, minHeight: d.n ? 4 : 1 }} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-charcoal-soft"><span>{days[0].label}</span><span>{days[13].label}</span></div>
        </section>
        <section className="card p-6">
          <h2 className="font-semibold">Orders by stage</h2>
          <ul className="mt-4 space-y-3">
            {statusBars.map(([label, n]) => (
              <li key={label} className="text-sm">
                <div className="flex justify-between"><span>{label}</span><span className="font-medium">{n}</span></div>
                <div className="mt-1 h-2 rounded-full bg-sage-100"><div className="h-2 rounded-full bg-forest-600" style={{ width: `${(n / maxStatus) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card p-6">
        <h2 className="font-semibold">Recent admin activity</h2>
        {(activity.data ?? []).length === 0 ? <p className="muted mt-3 text-sm">No activity yet.</p> : (
          <ul className="mt-3 divide-y divide-line text-sm">
            {(activity.data as any[]).map((a, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2 py-2.5">
                <span><strong>{a.action}</strong> <span className="muted">{a.target_type}</span></span>
                <span className="muted">{a.profiles?.full_name ?? a.profiles?.email ?? 'system'} · {formatDate(a.created_at, 'en')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
