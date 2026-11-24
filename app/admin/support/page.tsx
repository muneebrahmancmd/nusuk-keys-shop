import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatDate } from '@/lib/format';
import { closeSupport } from '@/app/admin/actions';
import { Flash } from '@/components/admin/bits';

export default async function AdminSupport({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const { data } = await createAdminClient()
    .from('support_requests').select('*, profiles(id,full_name,email), orders(order_number)')
    .order('status', { ascending: false }).order('created_at', { ascending: false }).limit(100);
  const rows = (data ?? []) as any[];
  return (
    <div className="space-y-5">
      <h1 className="h2">Support requests</h1>
      <Flash saved={sp.saved} error={sp.error} />
      {rows.length === 0 && <p className="card muted p-6">No support requests.</p>}
      {rows.map((s) => (
        <article key={s.id} className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold">{s.subject}</h2>
              <p className="muted text-xs">
                <Link className="underline" href={`/admin/customers/${s.profiles?.id}`}>{s.profiles?.full_name ?? s.profiles?.email}</Link>
                {' · '}{s.profiles?.email} · {formatDate(s.created_at, 'en')}{s.orders?.order_number ? ` · ${s.orders.order_number}` : ''}
              </p>
            </div>
            <span className={`badge ${s.status === 'open' ? 'bg-amber-50 text-amber-800 ring-amber-200' : 'bg-neutral-100 text-neutral-700 ring-neutral-300'}`}>{s.status}</span>
          </div>
          <p className="mt-3 whitespace-pre-line text-sm">{s.message}</p>
          {s.status === 'open' && (
            <form action={closeSupport} className="mt-3"><input type="hidden" name="id" value={s.id} /><button className="btn btn-ghost btn-sm">Mark closed</button></form>
          )}
        </article>
      ))}
    </div>
  );
}
