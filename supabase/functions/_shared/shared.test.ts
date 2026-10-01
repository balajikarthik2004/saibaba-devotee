// deno test supabase/functions/_shared/shared.test.ts
import { hmacSha256Hex, verifyRazorpayPayment, verifyRazorpayWebhook, verifyStripeSignature } from './signatures.ts'
import { quietHoursEnd, retryDelayMinutes } from './quiet.ts'
import { renderReceiptPdf } from './pdf.ts'
import { checkAmountBounds, toMinor } from './money.ts'
import { stripeForm } from './providers.ts'

const eq = (a: unknown, b: unknown, m = '') => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`)
}

Deno.test('stripe signature: valid, tampered, stale, multi-v1', async () => {
  const secret = 'whsec_test'
  const body = '{"id":"evt_1"}'
  const t = 1_700_000_000
  const v1 = await hmacSha256Hex(secret, `${t}.${body}`)
  eq(await verifyStripeSignature(body, `t=${t},v1=${v1}`, secret, 300, t + 10), true, 'valid')
  eq(await verifyStripeSignature(body + ' ', `t=${t},v1=${v1}`, secret, 300, t + 10), false, 'tampered body')
  eq(await verifyStripeSignature(body, `t=${t},v1=${v1}`, 'other', 300, t + 10), false, 'wrong secret')
  eq(await verifyStripeSignature(body, `t=${t},v1=${v1}`, secret, 300, t + 1000), false, 'stale')
  eq(await verifyStripeSignature(body, `t=${t},v1=deadbeef,v1=${v1}`, secret, 300, t), true, 'rotated secret')
  eq(await verifyStripeSignature(body, null, secret), false, 'missing header')
})

Deno.test('stripe signature matches an independently computed HMAC vector', async () => {
  // HMAC-SHA256("key", "The quick brown fox jumps over the lazy dog") is a published test vector.
  eq(await hmacSha256Hex('key', 'The quick brown fox jumps over the lazy dog'), 'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8')
})

Deno.test('razorpay webhook + payment signatures', async () => {
  const sig = await hmacSha256Hex('whs', '{"a":1}')
  eq(await verifyRazorpayWebhook('{"a":1}', sig, 'whs'), true)
  eq(await verifyRazorpayWebhook('{"a":2}', sig, 'whs'), false)
  const ps = await hmacSha256Hex('ks', 'order_1|pay_1')
  eq(await verifyRazorpayPayment('order_1', 'pay_1', ps, 'ks'), true)
  eq(await verifyRazorpayPayment('order_1', 'pay_2', ps, 'ks'), false)
})

Deno.test('quiet hours wrap midnight and respect timezone', () => {
  // 03:00 UTC = 21:30 previous day in America/Chicago (CST, UTC-6, January)
  const at = new Date('2026-01-15T03:30:00Z')
  const end = quietHoursEnd(at, 'America/Chicago', '21:30', '07:00')
  eq(end?.toISOString(), '2026-01-15T13:00:00.000Z', 'ends 07:00 local')
  eq(quietHoursEnd(new Date('2026-01-15T18:00:00Z'), 'America/Chicago', '21:30', '07:00'), null, 'midday is fine')
  eq(quietHoursEnd(at, 'UTC', null, null), null, 'no window')
  eq(retryDelayMinutes(1), 2)
  eq(retryDelayMinutes(20), 360)
})

Deno.test('pdf is well formed', () => {
  const bytes = renderReceiptPdf({
    number: 'SAI-2026-000001', issued_at: '2026-01-01T00:00:00Z', donor_name: 'A (Devotee)', amount: 10, currency: 'USD',
    lines: [{ description: 'Annadanam', amount: 10 }], temple_name: 'Demo Temple', tax_id: '00-0000000', tax_id_label: 'EIN', declarations: ['No goods or services were provided.'],
  })
  const s = new TextDecoder('latin1').decode(bytes)
  eq(s.startsWith('%PDF-1.4'), true)
  eq(s.trimEnd().endsWith('%%EOF'), true)
  const xrefAt = Number(/startxref\n(\d+)/.exec(s)?.[1])
  eq(s.slice(xrefAt, xrefAt + 4), 'xref', 'startxref points at xref table')
  // every xref offset points at "N 0 obj"
  const offs = [...s.slice(xrefAt).matchAll(/(\d{10}) 00000 n/g)].map((m) => Number(m[1]))
  offs.forEach((o, i) => eq(s.slice(o).startsWith(`${i + 1} 0 obj`), true, `obj ${i + 1}`))
})

Deno.test('amount helpers', () => {
  eq(toMinor(10.1), 1010)
  eq(checkAmountBounds(0.5, 'USD') !== null, true)
  eq(checkAmountBounds(10.123, 'USD') !== null, true)
  eq(checkAmountBounds(25, 'USD'), null)
  eq(checkAmountBounds(1e9, 'INR') !== null, true)
})

Deno.test('stripe form encoding', () => {
  eq(stripeForm({ a: 1, b: { c: 'x' }, items: [{ price_data: { unit_amount: 5 } }], skip: undefined }).toString(),
    'a=1&b%5Bc%5D=x&items%5B0%5D%5Bprice_data%5D%5Bunit_amount%5D=5')
})
