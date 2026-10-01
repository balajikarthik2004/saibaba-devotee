// Notification core: consent + preference checks, quiet hours, outbox, provider delivery.
//   email    -> Resend            (RESEND_API_KEY, NOTIFY_FROM_EMAIL)
//   sms      -> Twilio Messages   (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM)
//   whatsapp -> Twilio WhatsApp   (same creds, TWILIO_WHATSAPP_FROM)
// UNTESTED AGAINST LIVE PROVIDER ACCOUNTS. WhatsApp business-initiated messages need pre-approved
// templates outside the 24h window; this sends free-form text, suitable for sandbox/testing only.
import type { SupabaseClient } from './deps.ts'
import { env, need } from './env.ts'
import { log } from './http.ts'
import { MAX_ATTEMPTS, quietHoursEnd, retryDelayMinutes } from './quiet.ts'

export type Channel = 'email' | 'sms' | 'whatsapp' | 'push'
export type Topic = 'aarti' | 'vrat' | 'festival' | 'daily-message' | 'giving' | 'shipping' | 'volunteer'

export interface OutMessage {
  templeId: string
  userId?: string
  to?: string
  channel: Channel
  topic: Topic
  subject: string
  body: string
  template?: string
  dedupeKey?: string
  /** Skip the topic preference check (transactional mail like receipts). Consent is never skipped. */
  transactional?: boolean
}

export interface EnqueueResult {
  status: 'queued' | 'skipped'
  reason?: string
  id?: string
}

/** Decide if/when a message may go out, then write it to the outbox. */
export async function enqueue(db: SupabaseClient, m: OutMessage, now = new Date()): Promise<EnqueueResult> {
  let to = m.to
  let tz = 'UTC'
  let quietFrom: string | null = null
  let quietTo: string | null = null

  if (m.userId) {
    const [{ data: prof }, { data: pref }] = await Promise.all([
      db.from('profiles').select('email,phone,consent_sms,consent_whatsapp,deleted_at').eq('id', m.userId).maybeSingle(),
      db.from('notification_prefs').select('channels,topics,quiet_from,quiet_to,timezone').eq('user_id', m.userId).maybeSingle(),
    ])
    if (!prof || prof.deleted_at) return skip(db, m, 'unknown-user')
    // Explicit consent is mandatory for SMS and WhatsApp, regardless of preferences or transactional flag.
    if (m.channel === 'sms' && !prof.consent_sms) return skip(db, m, 'no-consent')
    if (m.channel === 'whatsapp' && !prof.consent_whatsapp) return skip(db, m, 'no-consent')
    if (pref) {
      const ch = pref.channels as Record<string, boolean>
      const tp = pref.topics as Record<string, boolean>
      if (!m.transactional && ch[m.channel] === false) return skip(db, m, 'channel-off')
      if (m.channel !== 'email' && ch[m.channel] !== true) return skip(db, m, 'channel-off')
      if (!m.transactional && tp[m.topic] === false) return skip(db, m, 'topic-off')
      tz = pref.timezone || tz
      quietFrom = pref.quiet_from
      quietTo = pref.quiet_to
    } else if (m.channel === 'sms' || m.channel === 'whatsapp') {
      return skip(db, m, 'channel-off')
    }
    to = m.channel === 'email' ? (m.to ?? prof.email ?? undefined) : (m.to ?? prof.phone ?? undefined)
  } else if (m.channel === 'sms' || m.channel === 'whatsapp') {
    // No user = no recorded consent. Never send.
    return skip(db, m, 'no-consent')
  }
  if (!to) return skip(db, m, 'no-address')
  if (m.channel === 'push') return skip(db, m, 'push-not-implemented')

  // Email is not held for quiet hours (matches the client's rule); SMS/WhatsApp are.
  const holdUntil = m.channel === 'email' ? null : quietHoursEnd(now, tz, quietFrom, quietTo)
  const { data, error } = await db
    .from('notification_log')
    .insert({
      temple_id: m.templeId,
      user_id: m.userId ?? null,
      channel: m.channel,
      topic: m.topic,
      to_address: to,
      subject: m.subject,
      body: m.body,
      template: m.template ?? null,
      status: 'queued',
      next_attempt_at: (holdUntil ?? now).toISOString(),
      dedupe_key: m.dedupeKey ?? null,
    })
    .select('id')
    .single()
  if (error) {
    if (error.code === '23505') return { status: 'skipped', reason: 'duplicate' } // dedupe_key hit
    throw new Error(`enqueue failed: ${error.message}`)
  }
  return { status: 'queued', id: data.id }
}

async function skip(db: SupabaseClient, m: OutMessage, reason: string): Promise<EnqueueResult> {
  // Keep an auditable trace of suppressed messages (no address stored).
  await db.from('notification_log').insert({
    temple_id: m.templeId,
    user_id: m.userId ?? null,
    channel: m.channel,
    topic: m.topic,
    subject: m.subject,
    status: 'skipped',
    skip_reason: reason,
    dedupe_key: m.dedupeKey ? `skip:${m.dedupeKey}` : null,
  })
  return { status: 'skipped', reason }
}

// ---------------------------------------------------------------- delivery

interface Row {
  id: string
  channel: Channel
  to_address: string | null
  subject: string
  body: string
  attempts: number
}

async function deliver(r: Row): Promise<string | undefined> {
  if (!r.to_address) throw new Error('no address')
  if (r.channel === 'email') {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${need('RESEND_API_KEY')}`, 'Content-Type': 'application/json', 'Idempotency-Key': r.id },
      body: JSON.stringify({ from: need('NOTIFY_FROM_EMAIL'), to: [r.to_address], subject: r.subject, text: r.body }),
    })
    const j = (await res.json().catch(() => ({}))) as { id?: string; message?: string }
    if (!res.ok) throw new Error(`resend ${res.status}: ${j.message ?? ''}`)
    return j.id
  }
  if (r.channel === 'sms' || r.channel === 'whatsapp') {
    const sid = need('TWILIO_ACCOUNT_SID')
    const from = r.channel === 'sms' ? need('TWILIO_SMS_FROM') : `whatsapp:${need('TWILIO_WHATSAPP_FROM').replace(/^whatsapp:/, '')}`
    const to = r.channel === 'sms' ? r.to_address : `whatsapp:${r.to_address}`
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${btoa(`${sid}:${need('TWILIO_AUTH_TOKEN')}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, From: from, Body: r.subject ? `${r.subject}\n${r.body}` : r.body }),
    })
    const j = (await res.json().catch(() => ({}))) as { sid?: string; message?: string }
    if (!res.ok) throw new Error(`twilio ${res.status}: ${j.message ?? ''}`)
    return j.sid
  }
  throw new Error(`unsupported channel ${r.channel}`)
}

/** Claim due rows and send them. Failures are retried with backoff up to MAX_ATTEMPTS. */
export async function drainQueue(db: SupabaseClient, limit = 50): Promise<{ sent: number; retry: number; failed: number }> {
  const { data, error } = await db.rpc('claim_notifications', { p_limit: limit })
  if (error) throw new Error(`claim failed: ${error.message}`)
  const out = { sent: 0, retry: 0, failed: 0 }
  for (const r of (data ?? []) as Row[]) {
    try {
      const ref = await deliver(r)
      await db.from('notification_log').update({ status: 'sent', sent_at: new Date().toISOString(), provider_ref: ref ?? null, last_error: null }).eq('id', r.id)
      out.sent++
    } catch (e) {
      const msg = (e instanceof Error ? e.message : String(e)).slice(0, 300)
      log('warn', 'notification send failed', { id: r.id, attempts: r.attempts, msg })
      if (r.attempts >= MAX_ATTEMPTS) {
        await db.from('notification_log').update({ status: 'failed', last_error: msg }).eq('id', r.id)
        out.failed++
      } else {
        const next = new Date(Date.now() + retryDelayMinutes(r.attempts) * 60_000).toISOString()
        await db.from('notification_log').update({ status: 'queued', next_attempt_at: next, last_error: msg }).eq('id', r.id)
        out.retry++
      }
    }
  }
  return out
}

/** Queue the "your receipt" email for a freshly issued receipt. Idempotent via dedupe key. */
export async function enqueueReceiptEmail(db: SupabaseClient, receiptId: string) {
  const { data: r } = await db
    .from('receipts')
    .select('id,temple_id,user_id,donor_name,donor_email,number,amount,currency,temple_name')
    .eq('id', receiptId)
    .maybeSingle()
  if (!r || !(r.donor_email || r.user_id)) return
  const portal = env('APP_DEVOTEE_URL')
  await enqueue(db, {
    templeId: r.temple_id,
    userId: r.user_id ?? undefined,
    to: r.donor_email ?? undefined,
    channel: 'email',
    topic: 'giving',
    transactional: true,
    subject: `Your receipt ${r.number} from ${r.temple_name}`,
    body:
      `Dear ${r.donor_name},\n\nThank you for your gift of ${r.amount} ${r.currency} to ${r.temple_name}.\n` +
      `Your receipt number is ${r.number}.` +
      (portal ? `\nYou can download it any time at ${portal.replace(/\/$/, '')}/my/receipts` : '') +
      `\n\nOm Sai Ram.`,
    template: 'receipt',
    dedupeKey: `receipt:${r.id}`,
  })
}
