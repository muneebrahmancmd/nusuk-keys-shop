import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatDate } from '@/lib/format';
import { retryNotification } from '@/app/admin/actions';
import { Flash } from '@/components/admin/bits';

export default async function AdminNotifications({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const { data } = await createAdminClient()
    .from('notification_logs').select('id,recipient,event_type,subject,delivery_status,error,attempts,created_at')
    .order('created_at', { ascending: false }).limit(100);
  const rows = (data ?? []) as any[];
  const tone = { sent: 'bg-sage-100 text-forest-700 ring-sage-300', failed: 'bg-red-50 text-red-800 ring-red-200', pending: 'bg-amber-50 text-amber-800 ring-amber-200' } as const;
  return (
    <div>
      <h1 className="h2">Email log</h1>
      <p className="muted mt-1 text-sm">Every notification is logged once (duplicates are suppressed). Failed emails can be retried.</p>
      <div className="mt-5"><Flash saved={sp.saved} error={sp.error} /></div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead className="border-b border-line"><tr><th className="th">When</th><th className="th">To</th><th className="th">Subject</th><th className="th">Status</th><th className="th"></th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && <tr><td className="td muted" colSpan={5}>No emails yet.</td></tr>}
            {rows.map((n) => (
              <tr key={n.id}>
                <td className="td whitespace-nowrap">{formatDate(n.created_at, 'en')}</td>
                <td className="td">{n.recipient}</td>
                <td className="td">{n.subject}<div className="muted text-xs">{n.event_type}</div></td>
                <td className="td"><span className={`badge ${tone[n.delivery_status as keyof typeof tone]}`}>{n.delivery_status}</span>
                  {n.error && <div className="mt-1 max-w-xs text-xs text-red-700">{n.error}</div>}</td>
                <td className="td">{n.delivery_status !== 'sent' && (
                  <form action={retryNotification}><input type="hidden" name="id" value={n.id} /><button className="btn btn-ghost btn-sm">Retry</button></form>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
