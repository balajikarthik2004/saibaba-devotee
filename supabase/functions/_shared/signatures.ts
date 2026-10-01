// Pure, dependency-free signature helpers (Web Crypto only) so they run in Deno AND Node
// and can be unit-tested (see tests/signatures.test.ts).

const enc = new TextEncoder()

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)))
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Constant-time compare of two strings. */
export function timingSafeEqual(a: string, b: string): boolean {
  const ea = enc.encode(a)
  const eb = enc.encode(b)
  let diff = ea.length ^ eb.length
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0)
  return diff === 0
}

/**
 * Stripe webhook signature: header `t=<unix>,v1=<hex>[,v1=<hex>...]`;
 * v1 = HMAC_SHA256(secret, `${t}.${rawBody}`). Rejects timestamps outside `toleranceSec`.
 * `rawBody` MUST be the unparsed request text.
 */
export async function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  toleranceSec = 300,
  nowSec = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!header || !secret) return false
  const parts = header.split(',').map((p) => p.trim().split('='))
  const t = parts.find(([k]) => k === 't')?.[1]
  const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v ?? '')
  if (!t || sigs.length === 0 || !/^\d+$/.test(t)) return false
  if (Math.abs(nowSec - Number(t)) > toleranceSec) return false
  const expected = await hmacSha256Hex(secret, `${t}.${rawBody}`)
  return sigs.some((s) => timingSafeEqual(s, expected))
}

/** Razorpay webhook: X-Razorpay-Signature = hex HMAC_SHA256(webhookSecret, rawBody). */
export async function verifyRazorpayWebhook(rawBody: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature || !secret) return false
  return timingSafeEqual(signature, await hmacSha256Hex(secret, rawBody))
}

/** Razorpay Checkout result: signature = HMAC_SHA256(keySecret, `${orderId}|${paymentId}`). */
export async function verifyRazorpayPayment(orderId: string, paymentId: string, signature: string, keySecret: string): Promise<boolean> {
  if (!orderId || !paymentId || !signature || !keySecret) return false
  return timingSafeEqual(signature, await hmacSha256Hex(keySecret, `${orderId}|${paymentId}`))
}
