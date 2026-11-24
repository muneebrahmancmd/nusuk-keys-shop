import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { getI18n } from '@/lib/i18n';
import { getPrefs } from '@/lib/prefs';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { countryName } from '@/lib/countries';
import { formatDate, formatMoney } from '@/lib/format';
import { orderMessage, whatsappLink } from '@/lib/whatsapp';
import { overallStatus } from '@/lib/status';
import { markProofSent, requestRefund } from '@/app/actions';
import { Notice, OrderProgress, StatusBadge } from '@/components/ui';
import type { Order } from '@/lib/types';

export const metadata: Metadata = { title: 'Order', robots: { index: false } };

export default async function OrderDetail({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; proof?: string; refund?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const profile = await requireUser(`/orders/${id}`);
  const [{ t, lang }, { settings }] = await Promise.all([getI18n(), getPrefs()]);

  // RLS guarantees a customer can only ever read their own order.
  const supabase = await createClient();
  const { data } = await supabase.from('orders').select('*').eq('id', id).maybeSingle();
  const order = data as Order | null;
  if (!order || order.user_id !== profile.id) notFound();

  const status = overallStatus(order);
  const total = formatMoney(order.total_price, order.currency, lang);
  const wa = whatsappLink(settings.whatsapp, orderMessage({
    order_number: order.order_number, package_name: order.package_name, credit_quantity: order.credit_quantity,
    quantity: order.quantity, total: formatMoney(order.total_price, order.currency, 'en'),
    country: countryName(order.customer_country, 'en'),
  }));
  const awaitingPayment = ['pending', 'submitted', 'under_verification'].includes(order.payment_status) && order.fulfillment_status === 'not_started';
  const canRefund = order.payment_status === 'approved' && ['not_started', 'processing', 'fulfilled'].includes(order.fulfillment_status);

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-start justify-between gap-4 py-2.5"><dt className="muted text-sm">{label}</dt><dd className="text-end text-sm font-medium">{children}</dd></div>
  );

  return (
    <div className="container-x max-w-2xl space-y-6 py-12">
      <Link href="/dashboard" className="muted text-sm hover:underline">← {t('dashboard.title')}</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="h2" dir="ltr">{order.order_number}</h1>
        <StatusBadge status={status} t={t} />
      </div>

      {sp.proof && <Notice tone="success">{t('order.proofRecorded')}</Notice>}
      {sp.refund && <Notice tone="success">{t('order.refundRequested')}</Notice>}
      {sp.error && <Notice tone="error">{t('order.error.state')}</Notice>}
      {!sp.proof && !sp.refund && !sp.error && status === 'pending' && <Notice>{t('order.created')}</Notice>}

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold">{t('order.progress')}</h2>
        <OrderProgress status={status} t={t} />
      </section>

      <section className="card p-6">
        <dl className="divide-y divide-line">
          <Row label={t('order.package')}>{order.package_name}</Row>
          <Row label={t('order.credits')}>{(order.credit_quantity * order.quantity).toLocaleString(lang)} ({order.quantity} × {order.credit_quantity.toLocaleString(lang)})</Row>
          <Row label={t('order.unitPrice')}><span dir="ltr">{formatMoney(order.unit_price, order.currency, lang)}</span></Row>
          <Row label={t('order.total')}><span dir="ltr">{total}</span></Row>
          <Row label={t('order.country')}>{countryName(order.customer_country, lang)}</Row>
          <Row label={t('order.placedOn')}>{formatDate(order.created_at, lang)}</Row>
          <Row label={t('dashboard.payment')}>{t(`status.${order.payment_status}`)}</Row>
          <Row label={t('dashboard.fulfillment')}>{order.fulfillment_status === 'not_started' ? '—' : t(`status.${order.fulfillment_status}`)}</Row>
        </dl>
        {order.price_is_estimate && <div className="mt-3"><Notice tone="warn">{t('common.estimateNote')}</Notice></div>}
        <div className="mt-4 rounded-xl bg-sage-100/70 p-4 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-forest-700">{t('packages.redeemable')}</p>
          <p className="mt-1">{order.redeemable_for}</p>
        </div>
      </section>

      {awaitingPayment && (
        <section className="card space-y-4 p-6">
          <h2 className="text-sm font-semibold">{t('order.instructions')}</h2>
          <p className="muted whitespace-pre-line text-sm">{settings.paymentInstructions}</p>
          <p className="text-xs font-medium text-red-800">{t('order.noPasswords')}</p>
          {wa ? (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-wa w-full sm:w-auto">
              <MessageCircle size={16} aria-hidden />{t('order.whatsapp')}
            </a>
          ) : (
            <Notice tone="error">{t('error.whatsapp')}</Notice>
          )}
          <p className="muted text-xs">{t('order.waNote')}</p>
          {order.payment_status === 'pending' && (
            <form action={markProofSent} className="border-t border-line pt-4">
              <input type="hidden" name="orderId" value={order.id} />
              <button className="btn btn-ghost">{t('order.proofSent')}</button>
              <p className="muted mt-2 text-xs">{t('order.proofHelp')}</p>
            </form>
          )}
        </section>
      )}

      {canRefund && (
        <details className="card p-6">
          <summary className="cursor-pointer text-sm font-medium">{t('order.requestRefund')}</summary>
          <form action={requestRefund} className="mt-4 space-y-3">
            <input type="hidden" name="orderId" value={order.id} />
            <label className="label" htmlFor="reason">{t('order.refundReason')}</label>
            <textarea id="reason" name="reason" maxLength={1000} rows={3} className="input" />
            <button className="btn btn-danger">{t('order.requestRefund')}</button>
          </form>
        </details>
      )}
    </div>
  );
}
