# Payments: client provider layer and server contract

`getProviders(temple)` returns the providers a donor can use at a temple, in display
order (India: UPI, Razorpay, bank; US: card/wallets, Zelle, ACH, cheque; UK and Canada:
card, then bank transfer / e-transfer, then cheque). The list is the temple's `payments`
intersected with Giving settings and the currency.

**Demo by default.** Without the env vars below every online provider falls back to the
simulator in `mock.ts` (test cards are listed there). Nothing is charged.

**No secrets in the client.** Only publishable identifiers are read from `VITE_*`.
Secret keys, webhook secrets and Razorpay key secrets live only in Supabase function
secrets.

| Env (client, publishable) | Meaning |
| --- | --- |
| `VITE_API_BASE` | Base URL of the functions, no trailing slash, e.g. `https://<ref>.supabase.co/functions/v1` |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` / `pk_test_...`. Stripe.js is loaded from `https://js.stripe.com/v3` only when this AND `VITE_API_BASE` are set, and only once a donor picks card |
| `VITE_RAZORPAY_KEY_ID` | Optional. The order reply may carry `keyId` instead |

All endpoints: `POST`, JSON in, JSON out, CORS open to the app origins, errors as
`{ "error": "human readable message" }` with a non-2xx status. Amounts are whole units
of the record's own currency (no conversion); the server multiplies by 100 for
Stripe/Razorpay minor units. The server must recompute and validate the amount, look up
the temple's connected account / key by `templeId`, and never trust the client's fee.

## `POST /payments/stripe/intent`

Request

```json
{
  "templeId": "tmp_sugarland",
  "amount": 101,
  "currency": "USD",
  "purpose": "donation",
  "reference": "don_0042",
  "payer": { "name": "A Devotee", "email": "a@example.com", "phone": "...", "country": "US" },
  "recurring": null
}
```

`recurring` is `null`, `"monthly"` or `"yearly"`. For a recurring gift the server
creates a Customer + Subscription (or SetupIntent) and returns the first invoice's
PaymentIntent secret.

Response `200`

```json
{ "id": "pi_...", "clientSecret": "pi_..._secret_..." }
```

The client mounts the Payment Element with `clientSecret` (card, Apple Pay and Google
Pay appear when the browser and Stripe account support them) and calls
`stripe.confirmPayment({ redirect: 'if_required' })`. The Payment Element is enabled
with `automatic_payment_methods` on the server.

## `POST /payments/razorpay/order`

Request: same body as above (`currency` is `INR`).

Response `200`

```json
{ "orderId": "order_...", "keyId": "rzp_live_...", "amount": 10100, "currency": "INR" }
```

`amount` is in paise, exactly as the order was created. `keyId` is the publishable key.

## `POST /payments/razorpay/verify`

Request

```json
{ "orderId": "order_...", "paymentId": "pay_...", "signature": "..." }
```

The server checks `HMAC_SHA256(orderId + "|" + paymentId, key_secret) == signature`.

Response `200`: `{ "verified": true }` (or `false`).

## Webhooks (server only, not called by the client)

- `POST /payments/stripe/webhook`: verify `Stripe-Signature`; on `payment_intent.succeeded`
  / `invoice.paid` / `charge.refunded` update the donation's `PaymentMeta.status`.
- `POST /payments/razorpay/webhook`: verify `X-Razorpay-Signature`; on `payment.captured`
  / `refund.processed` do the same.

The client treats the webhook as the source of truth; the browser result only drives the
success screen.

## UPI and manual providers

UPI (`upi://pay` link + QR), Zelle, ACH, bank transfer, cheque and cash need no server
call in the demo: they create a `pending` payment with per-temple instructions and the
office marks it received in Admin, Donations. A real deployment would additionally
write the pending row through the donations API.

## Receipts and PDFs

Receipt PDFs are rendered in the browser with `jspdf` (lazy-imported). A server-side
issuer can replace `renderReceiptPdf` by setting `Receipt.pdfUrl`; the UI prefers
`pdfUrl` when present.
