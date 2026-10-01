// Thin REST wrappers for Stripe and Razorpay (no SDK: fewer moving parts in the edge runtime).
// UNTESTED AGAINST LIVE PROVIDER ACCOUNTS. Request shapes follow the providers' public API docs.
import { HttpError, log } from './http.ts'
import { env, need } from './env.ts'

/** Flatten nested objects/arrays into Stripe's form-encoding: a[b]=1, items[0][x]=2. */
export function stripeForm(params: Record<string, unknown>, prefix = ''): URLSearchParams {
  const out = new URLSearchParams()
  const walk = (v: unknown, key: string) => {
    if (v === undefined || v === null) return
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${key}[${i}]`))
    else if (typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, key ? `${key}[${k}]` : k)
    else out.append(key, String(v))
  }
  walk(params, prefix)
  return out
}

export interface StripeOpts {
  /** Connected account id (acct_...) for direct charges. */
  account?: string
  idempotencyKey?: string
  method?: 'GET' | 'POST'
}

export async function stripe<T = Record<string, unknown>>(path: string, params: Record<string, unknown> = {}, opts: StripeOpts = {}): Promise<T> {
  const method = opts.method ?? 'POST'
  const headers: Record<string, string> = {
    Authorization: `Bearer ${need('STRIPE_SECRET_KEY')}`,
    'Stripe-Version': env('STRIPE_API_VERSION') ?? '2024-06-20',
  }
  if (opts.account) headers['Stripe-Account'] = opts.account
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey
  let url = `https://api.stripe.com/v1${path}`
  let body: URLSearchParams | undefined
  if (method === 'POST') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    body = stripeForm(params)
  } else if (Object.keys(params).length) url += `?${stripeForm(params)}`
  const res = await fetch(url, { method, headers, body })
  const data = (await res.json().catch(() => ({}))) as { error?: { message?: string; type?: string; code?: string } } & T
  if (!res.ok) {
    log('error', 'stripe api error', { path, status: res.status, type: data.error?.type, code: data.error?.code })
    // Card-type errors are safe to show; anything else is generic.
    const safe = data.error?.type === 'card_error' || data.error?.type === 'invalid_request_error'
    throw new HttpError(res.status >= 500 ? 502 : 400, safe && data.error?.message ? data.error.message : 'The payment provider rejected the request.')
  }
  return data
}

export async function razorpay<T = Record<string, unknown>>(path: string, body?: Record<string, unknown>, method: 'GET' | 'POST' = 'POST'): Promise<T> {
  const auth = btoa(`${need('RAZORPAY_KEY_ID')}:${need('RAZORPAY_KEY_SECRET')}`)
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
  })
  const data = (await res.json().catch(() => ({}))) as { error?: { description?: string; code?: string } } & T
  if (!res.ok) {
    log('error', 'razorpay api error', { path, status: res.status, code: data.error?.code })
    throw new HttpError(res.status >= 500 ? 502 : 400, data.error?.description ?? 'The payment provider rejected the request.')
  }
  return data
}
