// POST /payments/stripe/webhook  and  POST /payments/razorpay/webhook  (server to server).
// Every delivery goes through the SQL function apply_payment_event(): event-id dedupe, state
// change, domain-row update and receipt numbering commit atomically, so provider retries are safe.
// UNTESTED AGAINST LIVE PROVIDER ACCOUNTS (signature code is unit-tested; see tests/).
import type { SupabaseClient } from '../_shared/deps.ts'
import { HttpError, json, log } from '../_shared/http.ts'
import { env } from '../_shared/env.ts'
import { serviceClient } from '../_shared/supabase.ts'
import { fromMinor } from '../_shared/money.ts'
import { stripe } from '../_shared/providers.ts'
import { verifyRazorpayWebhook, verifyStripeSignature } from '../_shared/signatures.ts'
import { enqueueReceiptEmail } from '../_shared/notify.ts'

interface Applied {
  result: 'applied' | 'duplicate' | 'ignored' | 'unknown-payment' | 'amount-mismatch'
  receipt_id?: string
  donation_id?: string
  user_id?: string
  temple_id?: string
  status?: string
}

async function apply(
  db: SupabaseClient,
  provider: 'stripe' | 'razorpay',
  eventId: string,
  ref: string,
  status: 'succeeded' | 'failed' | 'refunded',
  fee: number,
  amount: number | null,
  renewal = false,
): Promise<Applied> {
  const { data, error } = await db.rpc('apply_payment_event', {
    p_provider: provider,
    p_event_id: eventId,
    p_provider_ref: ref,
    p_status: status,
    p_fee: fee,
    p_amount: amount,
    p_renewal: renewal,
  })
  if (error) {
    log('error', 'apply_payment_event failed', { provider, eventId, message: error.message })
    throw new HttpError(500, 'Could not apply the payment event.') // provider will retry
  }
  return data as Applied
}

async function afterApplied(db: SupabaseClient, a: Applied) {
  if (a.result === 'applied' && a.status !== 'failed' && a.receipt_id) {
    try {
      await enqueueReceiptEmail(db, a.receipt_id)
    } catch (e) {
      log('warn', 'receipt email not queued', { message: e instanceof Error ? e.message : String(e) })
    }
  }
}

// ------------------------------------------------------------------ Stripe

interface StripeEvent {
  id: string
  type: string
  created: number
  account?: string
  data: { object: Record<string, unknown> }
}

/** Processing fee in whole units, best effort (needs a balance transaction to exist). */
async function stripeFee(piId: string, account?: string): Promise<number> {
  try {
    const pi = await stripe<{ latest_charge?: { balance_transaction?: { fee?: number } } }>(
      `/payment_intents/${piId}`,
      { expand: ['latest_charge.balance_transaction'] },
      { method: 'GET', account },
    )
    return fromMinor(pi.latest_charge?.balance_transaction?.fee ?? 0)
  } catch {
    return 0
  }
}

export async function stripeWebhook(req: Request): Promise<Response> {
  const raw = await req.text() // raw bytes as text: required for signature verification
  const sig = req.headers.get('stripe-signature')
  const secrets = [env('STRIPE_WEBHOOK_SECRET'), env('STRIPE_CONNECT_WEBHOOK_SECRET')].filter((s): s is string => !!s)
  let ok = false
  for (const s of secrets) ok ||= await verifyStripeSignature(raw, sig, s)
  if (!ok) throw new HttpError(400, 'Invalid signature.')

  const ev = JSON.parse(raw) as StripeEvent
  const o = ev.data.object as Record<string, any> // deno-lint-ignore no-explicit-any
  const db = serviceClient()
  let a: Applied | null = null

  switch (ev.type) {
    case 'payment_intent.succeeded': {
      if (o.invoice) break // subscription payments are applied from invoice.paid
      a = await apply(db, 'stripe', ev.id, o.id, 'succeeded', await stripeFee(o.id, ev.account), fromMinor(o.amount_received ?? o.amount))
      break
    }
    case 'payment_intent.payment_failed': {
      if (o.invoice) break
      a = await apply(db, 'stripe', ev.id, o.id, 'failed', 0, null)
      break
    }
    case 'invoice.paid': {
      if (!o.subscription) break
      const renewal = o.billing_reason === 'subscription_cycle'
      const fee = o.payment_intent ? await stripeFee(o.payment_intent, ev.account) : 0
      a = await apply(db, 'stripe', ev.id, o.subscription, 'succeeded', fee, fromMinor(o.amount_paid), renewal)
      break
    }
    case 'invoice.payment_failed': {
      if (o.subscription && o.billing_reason === 'subscription_create') a = await apply(db, 'stripe', ev.id, o.subscription, 'failed', 0, null)
      break
    }
    case 'charge.refunded': {
      if (o.refunded && o.payment_intent) a = await apply(db, 'stripe', ev.id, o.payment_intent, 'refunded', 0, null)
      break
    }
    default:
      return json(req, { received: true, ignored: ev.type })
  }

  if (a?.result === 'unknown-payment') {
    // Refunds for charges we never recorded are noise; anything else may be a race: let Stripe retry.
    if (ev.type === 'charge.refunded') return json(req, { received: true, note: 'unknown payment' })
    log('warn', 'stripe event for unknown payment', { id: ev.id, type: ev.type })
    throw new HttpError(404, 'Unknown payment.')
  }
  if (a) await afterApplied(db, a)
  return json(req, { received: true, result: a?.result ?? 'noop' })
}

// ---------------------------------------------------------------- Razorpay

export async function razorpayWebhook(req: Request): Promise<Response> {
  const raw = await req.text()
  const secret = env('RAZORPAY_WEBHOOK_SECRET')
  if (!secret || !(await verifyRazorpayWebhook(raw, req.headers.get('x-razorpay-signature'), secret))) {
    throw new HttpError(400, 'Invalid signature.')
  }
  const ev = JSON.parse(raw) as { event: string; payload: Record<string, { entity: Record<string, any> }> } // deno-lint-ignore no-explicit-any
  const eventId = req.headers.get('x-razorpay-event-id') ?? ''
  if (!eventId) throw new HttpError(400, 'Missing event id.')
  const pay = ev.payload?.payment?.entity
  const db = serviceClient()
  let a: Applied | null = null

  switch (ev.event) {
    case 'payment.captured':
      if (pay?.order_id) a = await apply(db, 'razorpay', eventId, pay.order_id, 'succeeded', fromMinor(pay.fee ?? 0), fromMinor(pay.amount))
      break
    case 'payment.failed':
      if (pay?.order_id) a = await apply(db, 'razorpay', eventId, pay.order_id, 'failed', 0, null)
      break
    case 'refund.processed':
      if (pay?.order_id) a = await apply(db, 'razorpay', eventId, pay.order_id, 'refunded', 0, null)
      break
    default:
      return json(req, { received: true, ignored: ev.event })
  }
  if (a?.result === 'unknown-payment') throw new HttpError(404, 'Unknown payment.')
  if (a) await afterApplied(db, a)
  return json(req, { received: true, result: a?.result ?? 'noop' })
}
