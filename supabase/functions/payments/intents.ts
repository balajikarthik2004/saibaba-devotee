// POST /payments/stripe/intent   and   POST /payments/razorpay/order   and   POST /payments/razorpay/verify
// UNTESTED AGAINST LIVE PROVIDER ACCOUNTS.
import { z } from '../_shared/deps.ts'
import { HttpError, json, parseBody } from '../_shared/http.ts'
import { env, need } from '../_shared/env.ts'
import { optionalUser, serviceClient } from '../_shared/supabase.ts'
import { platformFeeMinor, toMinor } from '../_shared/money.ts'
import { razorpay, stripe } from '../_shared/providers.ts'
import { verifyRazorpayPayment } from '../_shared/signatures.ts'
import { paymentAccount, paymentBody, resolveTarget, resolveTemple } from './resolve.ts'

export async function stripeIntent(req: Request): Promise<Response> {
  const body = await parseBody(req, paymentBody)
  const db = serviceClient()
  const user = await optionalUser(req)
  const temple = await resolveTemple(db, body.templeId)
  if (!temple.payments.includes('stripe')) throw new HttpError(400, 'Card payments are not enabled for this temple.')
  const target = await resolveTarget(db, temple, body, user?.id ?? null)
  const acct = await paymentAccount(db, temple.id)
  const minor = toMinor(body.amount)
  const feeBps = Number(env('PLATFORM_FEE_BPS') ?? 0) || 0
  const currency = body.currency.toLowerCase()
  const meta = {
    temple_id: temple.id,
    reference_type: target.referenceType,
    reference_id: target.referenceId,
  }
  const idem = `intent:${target.referenceType}:${target.referenceId}:${minor}:${body.recurring ?? 'once'}`
  const account = acct.stripeAccount

  let providerRef: string
  let clientSecret: string
  let paymentIntentId: string | undefined

  if (!body.recurring) {
    const pi = await stripe<{ id: string; client_secret: string }>(
      '/payment_intents',
      {
        amount: minor,
        currency,
        automatic_payment_methods: { enabled: true },
        description: target.description,
        metadata: meta,
        ...(account && feeBps ? { application_fee_amount: platformFeeMinor(minor, feeBps) } : {}),
      },
      { account, idempotencyKey: idem },
    )
    providerRef = pi.id
    clientSecret = pi.client_secret
  } else {
    // Recurring: Customer + Subscription (default_incomplete) -> first invoice's PaymentIntent secret.
    const customer = await stripe<{ id: string }>(
      '/customers',
      { email: body.payer.email, name: body.payer.name, metadata: meta },
      { account, idempotencyKey: `cus:${idem}` },
    )
    const sub = await stripe<{ id: string; latest_invoice: { payment_intent: { id: string; client_secret: string } } }>(
      '/subscriptions',
      {
        customer: customer.id,
        items: [
          {
            price_data: {
              currency,
              unit_amount: minor,
              recurring: { interval: body.recurring === 'yearly' ? 'year' : 'month' },
              product_data: { name: target.description },
            },
          },
        ],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: meta,
        ...(account && feeBps ? { application_fee_percent: feeBps / 100 } : {}),
      },
      { account, idempotencyKey: `sub:${idem}` },
    )
    providerRef = sub.id // webhooks for recurring map on the subscription id
    paymentIntentId = sub.latest_invoice.payment_intent.id
    clientSecret = sub.latest_invoice.payment_intent.client_secret
  }

  const { data: pay, error } = await db
    .from('payments')
    .upsert(
      {
        temple_id: temple.id,
        user_id: target.userId,
        purpose: body.purpose,
        reference_type: target.referenceType,
        reference_id: target.referenceId,
        provider: 'stripe',
        provider_ref: providerRef,
        amount: body.amount,
        currency: body.currency,
        status: 'requires-action',
        recurring: body.recurring ?? null,
        payer_email: body.payer.email,
        meta: { ...target.meta, paymentIntent: paymentIntentId ?? providerRef, connectedAccount: account ?? null },
      },
      { onConflict: 'provider,provider_ref', ignoreDuplicates: true },
    )
    .select('id')
    .maybeSingle()
  if (error) throw new HttpError(500, 'Could not record the payment.')
  return json(req, { id: providerRef, clientSecret, paymentId: pay?.id ?? null, reference: target.referenceId })
}

export async function razorpayOrder(req: Request): Promise<Response> {
  const body = await parseBody(req, paymentBody)
  if (body.currency !== 'INR') throw new HttpError(400, 'Razorpay is used for INR payments only.')
  if (body.recurring) throw new HttpError(400, 'Repeating gifts are not available through Razorpay yet.')
  const db = serviceClient()
  const user = await optionalUser(req)
  const temple = await resolveTemple(db, body.templeId)
  if (!temple.payments.includes('razorpay')) throw new HttpError(400, 'Razorpay is not enabled for this temple.')
  const target = await resolveTarget(db, temple, body, user?.id ?? null)
  const acct = await paymentAccount(db, temple.id)
  const minor = toMinor(body.amount)

  const order = await razorpay<{ id: string; amount: number; currency: string }>('/orders', {
    amount: minor,
    currency: 'INR',
    receipt: target.referenceId.replaceAll('-', '').slice(0, 40),
    notes: { temple_id: temple.id, reference_type: target.referenceType, reference_id: target.referenceId },
    // Razorpay Route: settle to the temple's linked account. Requires Route to be activated on the
    // platform account and the linked account to be KYC-complete. See docs/BACKEND.md.
    ...(acct.razorpayAccount
      ? { transfers: [{ account: acct.razorpayAccount, amount: minor, currency: 'INR', on_hold: false }] }
      : {}),
  })

  const { error } = await db.from('payments').upsert(
    {
      temple_id: temple.id,
      user_id: target.userId,
      purpose: body.purpose,
      reference_type: target.referenceType,
      reference_id: target.referenceId,
      provider: 'razorpay',
      provider_ref: order.id,
      amount: body.amount,
      currency: 'INR',
      status: 'requires-action',
      payer_email: body.payer.email,
      meta: target.meta,
    },
    { onConflict: 'provider,provider_ref', ignoreDuplicates: true },
  )
  if (error) throw new HttpError(500, 'Could not record the payment.')
  return json(req, { orderId: order.id, keyId: need('RAZORPAY_KEY_ID'), amount: order.amount, currency: order.currency })
}

const verifyBody = z.object({ orderId: z.string().min(3).max(80), paymentId: z.string().min(3).max(80), signature: z.string().min(10).max(200) })

/** Checks the Checkout result signature. The webhook, not this call, is what marks money received. */
export async function razorpayVerify(req: Request): Promise<Response> {
  const b = await parseBody(req, verifyBody)
  const ok = await verifyRazorpayPayment(b.orderId, b.paymentId, b.signature, need('RAZORPAY_KEY_SECRET'))
  return json(req, { verified: ok })
}
