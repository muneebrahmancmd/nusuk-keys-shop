import 'server-only';
import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSettings } from '@/lib/settings';
import { esc } from '@/lib/format';

export type Category = 'registration' | 'order' | 'payment' | 'fulfillment' | 'support';

export function emailShell(siteName: string, title: string, bodyHtml: string) {
  return `<!doctype html><html><body style="margin:0;background:#FBF8F1;font-family:Segoe UI,Arial,sans-serif;color:#26302B">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #E4DFD0;border-radius:16px">
<tr><td style="padding:20px 28px;background:#244F37;color:#fff;border-radius:16px 16px 0 0;font-size:18px;font-weight:600">${esc(siteName)}</td></tr>
<tr><td style="padding:28px"><h2 style="margin:0 0 16px;font-size:20px">${esc(title)}</h2>${bodyHtml}</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #E4DFD0;font-size:12px;color:#56615B">
This is an automated message from an independent service. We never ask for passwords, one-time codes or recovery codes.</td></tr>
</table></td></tr></table></body></html>`;
}

export const row = (label: string, value: unknown) =>
  `<tr><td style="padding:4px 12px 4px 0;color:#56615B">${esc(label)}</td><td style="padding:4px 0"><strong>${esc(value)}</strong></td></tr>`;
export const table = (rows: string) => `<table cellpadding="0" cellspacing="0" style="font-size:14px">${rows}</table>`;

interface NotifyOpts {
  category: Category;
  event: string;
  /** Unique per logical event; a repeat insert is ignored, so no duplicate emails. */
  dedupeKey: string;
  to: string | null | undefined;
  subject: string;
  html: string;
  /** true when the recipient is a customer (subject to the "customer emails" switch) */
  customer?: boolean;
}

/** Fire-and-forget: never throws, never blocks the user action. Failures are logged and can be retried. */
export async function notify(o: NotifyOpts) {
  try {
    if (!o.to) return;
    const s = await getSettings();
    if (s.notify[o.category] === false) return;
    if (o.customer && s.notify.customer_emails === false) return;
    const db = createAdminClient();
    const { data, error } = await db
      .from('notification_logs')
      .insert({ recipient: o.to, event_type: o.event, category: o.category, dedupe_key: o.dedupeKey, subject: o.subject, html: o.html })
      .select('id')
      .single();
    if (error || !data) return; // unique violation = already handled
    await deliver(data.id);
  } catch (e) {
    console.error('notify failed', e);
  }
}

/** Sends (or re-sends) a logged email. Used for first delivery and for admin retries. */
export async function deliver(id: string): Promise<{ ok: boolean; error?: string }> {
  const db = createAdminClient();
  const { data: log } = await db.from('notification_logs').select('*').eq('id', id).single();
  if (!log) return { ok: false, error: 'not found' };
  const fail = async (message: string) => {
    await db.from('notification_logs').update({ delivery_status: 'failed', error: message.slice(0, 500), attempts: log.attempts + 1 }).eq('id', id);
    return { ok: false, error: message };
  };
  const key = process.env.RESEND_API_KEY;
  if (!key) return fail('RESEND_API_KEY is not configured');
  try {
    const { error } = await new Resend(key).emails.send({
      from: process.env.EMAIL_FROM ?? 'onboarding@resend.dev',
      to: log.recipient,
      subject: log.subject,
      html: log.html,
    });
    if (error) return fail(error.message);
    await db.from('notification_logs').update({ delivery_status: 'sent', error: null, attempts: log.attempts + 1, sent_at: new Date().toISOString() }).eq('id', id);
    return { ok: true };
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'send failed');
  }
}
