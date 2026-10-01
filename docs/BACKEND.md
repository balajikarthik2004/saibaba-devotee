# Backend (Supabase) — Phase 2

Status: **written to be correct and reviewable, NOT yet run against a live Supabase project.**
The app defaults to mock mode (`VITE_DATA_MODE=mock`) and works exactly as before with no backend.
See [Verification status](#verification-status) for precisely what was and was not tested.

## Architecture

```
 Browser (apps/devotee, apps/admin)                       Third parties
 ┌────────────────────────────────────────┐
 │ UI ─► @saibaba/core                     │
 │       ├ mock API (default)              │
 │       └ backend/  repository ─► supabase-js ──────────┐
 │            auth (OTP / OAuth)           │              │ PostgREST + RLS (user JWT)
 │            mappers (row ⇄ domain)       │              ▼
 │ Stripe.js / Razorpay Checkout           │      ┌───────────────────────────────┐
 └───────┬──────────────────────┬──────────┘      │ Supabase project              │
         │ POST /payments/...   │ POST /notify    │  Auth (email/phone OTP, OAuth)│
         ▼                      ▼                 │  Postgres  (RLS on EVERY table)│
 ┌─────────────────── Edge functions (Deno) ──────┤   helpers: is_platform_admin() │
 │ payments   stripe/intent, razorpay/order,      │            has_temple_role()   │
 │            razorpay/verify, *webhook           │   SQL fns: apply_payment_event │
 │ notify     POST /notify, /notify/worker        │            issue_receipt_for_… │
 │ receipt-pdf, daily-message-cron,               │            allocate_receipt_…  │
 │ admin-invite-staff          (service role) ────┤   outbox: notification_log     │
 └───────┬───────────────┬────────────────────────┴───────────────────────────────┘
         │ REST          │ webhooks (signed)
         ▼               ▼
   Stripe / Razorpay   Resend (email) · Twilio (SMS, WhatsApp)
```

Key rules: the browser only ever holds the **anon key** and the user's JWT; the **service-role key and
every provider secret exist only inside edge functions**. Money state changes only via signed webhooks
-> `apply_payment_event()` (one transaction: dedupe + state + receipt number).

## Repository layout

| Path | What |
| --- | --- |
| `supabase/migrations/0001_schema.sql` | ~60 tables, constraints, `legacy_id` bridge to mock ids |
| `supabase/migrations/0002_functions.sql` | auth helpers, triggers, receipt numbering, FK indexes, audit |
| `supabase/migrations/0003_rls.sql` | RLS enabled on all tables, all policies, grants, public view |
| `supabase/migrations/0004_payment_and_notify_rpc.sql` | `apply_payment_event`, `claim_notifications`, `find_auth_user_by_email` |
| `supabase/seed.sql` | generated from `mock/temple.ts` (`node supabase/scripts/gen-seed-temples.mjs`) + static seed |
| `supabase/functions/*` | edge functions; `_shared/` holds pure, unit-tested helpers |
| `supabase/tests/run-pglite.mjs` | applies migrations + seed to in-memory Postgres and asserts RLS |
| `packages/core/src/backend/` | `DataMode`, client factory, `AuthProvider`s, mappers, repositories, `useOtpFlow` |

## Environment variables

Client (`VITE_*`, publishable only; see `.env.example`, `apps/*/.env.example`):

| Variable | Meaning |
| --- | --- |
| `VITE_DATA_MODE` | `mock` (default) or `supabase`. Supabase mode without URL/key falls back to mock with a console warning |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | project URL and anon key |
| `VITE_API_BASE` | `https://<ref>.supabase.co/functions/v1` (no trailing slash) |
| `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_RAZORPAY_KEY_ID` | publishable payment ids |
| `VITE_SITE_URL`, `VITE_VAPID_PUBLIC_KEY` | used by the PWA/i18n slice |

Server (function secrets, `supabase/.env.example`):

| Secret | Used by |
| --- | --- |
| `ALLOWED_ORIGINS`, `APP_DEVOTEE_URL`, `APP_ADMIN_URL` | CORS allow-list, links in emails, invite redirect |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET`, `STRIPE_API_VERSION`, `PLATFORM_FEE_BPS` | payments (Stripe) |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | payments (Razorpay) |
| `RESEND_API_KEY`, `NOTIFY_FROM_EMAIL` | email |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM`, `TWILIO_WHATSAPP_FROM` | SMS / WhatsApp |
| `CRON_SECRET`, `DIGEST_LOCAL_HOUR` | `notify/worker`, `daily-message-cron` |
| `GOOGLE_OAUTH_*`, `APPLE_OAUTH_*`, `TWILIO_MESSAGE_SERVICE_SID` | Supabase Auth providers (config.toml) |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are injected into functions by Supabase.

## Setup steps

1. **Create a Supabase project** (region near your largest user group; Postgres 15+).
2. **Run migrations**: `supabase link --project-ref <ref>` then `supabase db push`. Seed the demo temples
   with `supabase db reset` locally, or paste `supabase/seed.sql` in the SQL editor. Do **not** seed demo
   temples in production (`is_demo` temples show a demo banner).
3. **Auth settings** (Dashboard -> Authentication): enable Email (OTP), enable Phone with an SMS provider
   (Twilio Verify recommended; India needs a DLT-registered sender), enable Google/Apple if wanted, set Site URL and redirect
   URLs to both app origins, set OTP expiry 10 min and a rate limit (see `config.toml`). Edit the email
   template to include `{{ .Token }}` (6-digit code) rather than only a link.
4. **First admins** (SQL editor, after each person has signed in once):
   `insert into platform_admins select id from auth.users where email = '...';`
   then temple staff via the console (`admin-invite-staff`) or
   `insert into temple_members (temple_id, user_id, role) ...`.
5. **Set secrets**: `cp supabase/.env.example supabase/.env`, fill in, `supabase secrets set --env-file supabase/.env`.
6. **Deploy functions**: `supabase functions deploy payments notify receipt-pdf daily-message-cron admin-invite-staff`
   (`verify_jwt` per function is in `supabase/config.toml`).
7. **Webhooks**: Stripe -> `…/functions/v1/payments/stripe/webhook`, events `payment_intent.succeeded`,
   `payment_intent.payment_failed`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`
   (create a second endpoint with "Listen to events on Connected accounts" if using Connect).
   Razorpay -> `…/payments/razorpay/webhook`, events `payment.captured`, `payment.failed`, `refund.processed`.
8. **Schedulers** (Database -> Extensions: `pg_cron`, `pg_net`):
   ```sql
   select cron.schedule('notify-worker', '* * * * *', $$
     select net.http_post('https://<ref>.supabase.co/functions/v1/notify/worker',
       headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>')) $$);
   select cron.schedule('daily-message', '*/15 * * * *', $$
     select net.http_post('https://<ref>.supabase.co/functions/v1/daily-message-cron',
       headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>')) $$);
   ```
   (store the secret in Vault rather than inline for production.)
9. **Point the apps at it**: set the `VITE_*` values in Vercel for both projects and `VITE_DATA_MODE=supabase`.
10. **Temple payment accounts**: insert a `temple_payment_accounts` row per temple (Stripe Connect id and/or Razorpay linked account).

## Endpoint contract (matches `features/giving/payments/README.md` and the community `httpTransport`)

All `POST`, JSON in/out, errors `{ "error": "message" }` with non-2xx. Amounts in whole units of the temple's currency.

| Endpoint | Auth | Notes |
| --- | --- | --- |
| `/payments/stripe/intent` | none (guests allowed; JWT optional, used to tie the record to the user) | `templeId` may be uuid, slug or legacy `tmp_*`. `reference` = id of a pending `donations` / `bookings` / `shop_orders` / `annadanam_drives` row (purpose donation / sponsorship / shop / annadanam). For a donation whose `reference` is not a uuid (guest flow) the server creates the pending donation. **Amount is verified against the row**, currency against the temple, bounds per currency. Returns `{ id, clientSecret, paymentId, reference }`. `recurring` -> Customer + Subscription (`default_incomplete`) and the first invoice's PaymentIntent secret |
| `/payments/razorpay/order` | none | INR only, no recurring. Returns `{ orderId, keyId, amount(paise), currency }` |
| `/payments/razorpay/verify` | none | HMAC check of `{orderId,paymentId,signature}`; informational, the webhook is the source of truth |
| `/payments/{stripe,razorpay}/webhook` | provider signature | verified over the raw body; idempotent via `webhook_events` |
| `/notify` | **user JWT required** | body = community `NotifyMessage`. Staff (admin/committee) may message users; everyone else only themselves, 5/hour, address taken from their profile. Reply `{status:'queued'|'failed', note}` |
| `/notify/worker` | `x-cron-secret` | drains the outbox with retry/backoff (2,4,8,16 min; 5 attempts) |
| `/receipt-pdf?receiptId=` | user JWT | reads through RLS; JSON by default, `?format=pdf` for a plain PDF (Helvetica; uses currency codes, not symbols) |
| `/admin-invite-staff` | user JWT, temple admin | `{templeId,email,role}`; cannot grant `platform` |
| `/daily-message-cron` | `x-cron-secret` | see below |

**Known client gaps to close when going live** (owned by other slices, not edited here):
1. `httpTransport` in `features/community/notifications.ts` sends no `Authorization` header; `/notify` will answer 401 until it
   attaches the Supabase access token (`(await getSupabase()).auth.getSession()`).
2. The giving client's `reference` is `don_0042`-style in mock mode. In supabase mode it must be the uuid of the pending row, or omitted to let the server create a guest donation.
3. Receipt PDFs are rendered in the browser (`jspdf`) today; `receipt-pdf` is the server alternative (set `Receipt.pdfUrl`).

## Stripe Connect vs platform account (decision)

| | Platform account (all temples under one Stripe account) | Connect (each temple its own account) |
| --- | --- | --- |
| Setup | fastest, one KYC | each temple completes onboarding; needs Connect enabled |
| Funds | land with the platform, **you** must pay temples out (money-transmission / licensing exposure, reconciliation burden) | land directly with the temple (direct charges) |
| Tax / regulation | platform is merchant of record for donations: usually wrong for charities | temple is merchant of record; fits 501(c)(3)/charity registration |
| Fees | one fee schedule | per-account; platform can take `application_fee` (`PLATFORM_FEE_BPS`) |

Recommendation: **Connect with direct charges** for real temples (set `temple_payment_accounts.stripe_mode='connect'`
and `stripe_account_id`); use the platform account only for demos/pilots. The code supports both per temple. Get legal/accounting advice before handling other parties' money.

## Razorpay (India) notes and limitations

- Orders are created on the platform account; set `razorpay_account_id` to settle to a temple's **Route** linked account (Route must be enabled by Razorpay and each linked account KYC-complete; transfers are created with the order).
- Recurring gifts are **not implemented** for Razorpay (would need Plans/Subscriptions or UPI AutoPay mandates).
- Razorpay's fee includes GST and is recorded as `fee`; reconcile against settlements.
- **FCRA caution:** accepting foreign contributions (including from NRIs/overseas devotees) for an Indian trust requires FCRA registration and a designated FCRA bank account. The app does not enforce this. Use `taxDeclarations.residentStatus`, keep foreign gifts on a separate flow, and consult your CA/lawyer before enabling card payments in foreign currency for an Indian temple.
- 80G receipts need the donor's PAN; `tax_declarations.pan` is format-checked and readable only by the donor and finance/admin of the temple where they gave.

## Data-protection notes (engineering considerations, **not legal advice**)

- **DPDP Act 2023 (India) / UK GDPR:** collect the minimum; record consent with a timestamp and the text version shown (`profiles.consent_*`, `CONSENT_TEXT_VERSION`); SMS and WhatsApp are separate, unticked opt-ins, re-checked server-side in `notify` (no consent = `skipped`, logged with a reason); every message should carry an unsubscribe route (TODO in templates).
- **Rights requests:** access/export = query by `user_id`; erasure = anonymise the profile (`deleted_at`, blank PII) and delete family/tax rows, but **retain receipts and donation records** your tax regime requires (they keep `donor_name` snapshots). There is no client delete policy on purpose; implement as an audited admin routine.
- **Children:** Bal Vikas contact details are visible to signed-in members only; do not add child profiles without a guardian-consent flow.
- **Data location:** choose the Supabase region with residency in mind (UK/EU devotees, India). Sub-processors: Supabase, Stripe/Razorpay, Resend, Twilio, Vercel. List them in the privacy notice.
- Religious belief can be special-category data under UK GDPR; nakshatra/gothra are optional and only shown to staff who need them for the sankalpam.
- Gift Aid: the declaration is stored with a timestamp; wording must be checked against HMRC's current model declaration.

## Security notes

- RLS on every table (the PGlite test asserts it). Default deny; `anon` can read only published/active content; PII columns are never in an anon-readable table (`public_prayers` is a view without `user_id`; guest donor contact lives in `donations`, which anon cannot read).
- Devotees can insert only **pending** donations/bookings/orders for themselves; they cannot set status, fees, receipts, approvals or priests. Only webhooks (service role) mark money received.
- `issue_receipt_for_donation`, `allocate_receipt_number`, `apply_payment_event`, `claim_notifications` are executable by `service_role` only. Receipt numbers are allocated with an `INSERT … ON CONFLICT DO UPDATE` counter inside the issuing transaction (no duplicates, no gaps on rollback).
- Webhooks: signature verified on the raw body (constant-time, 5-minute tolerance for Stripe); event ids recorded atomically with the state change; provider-reported amount must equal `payments.amount` or the event is refused and audited.
- Platform admins pass `has_temple_role` everywhere (oversight). Treat that role as highly privileged, protect with MFA, and review `audit_log`.
- `audit_log` is written by triggers on donations, bookings, receipts, payments, members, admins, tax declarations and payment accounts (PAN is stripped from the diff).
- CORS allow-list from env; `verify_jwt=false` only where the function authenticates itself or the caller is a provider.
- `vercel.json` ships a **report-only** CSP starter (Stripe, Razorpay, Supabase, YouTube/Vimeo); tighten and switch to enforcing after a week without violations. The service worker / PWA agent may need `worker-src 'self'`.
- Known limits: column-level transitions on `bookings`/`requirement_sheets` are enforced by role (who may UPDATE), not by a state-machine trigger; a finance user could set any stage. Add a transition trigger before multi-tenant production use. New tables created after `0003` need `enable row level security` + grants.

## Migration checklist (mock API -> Supabase), slice by slice

Pattern: add a `repository` interface mirroring the mock function, implement it for `supabase`, switch the screen's import to `getRepositories()`.
Status: ✅ done (code + fixture/SQL tests) · 🟡 schema + mapper only · ⬜ schema only.

| Slice | Tables | Status |
| --- | --- | --- |
| Auth (OTP, OAuth, session -> role) | `profiles`, `temple_members`, `platform_admins` | ✅ provider + UI (live untested) |
| Temples list / by slug | `temples` | ✅ repository + mapper |
| Donations list / create | `donations`, `payments`, `receipts` | ✅ repository + mapper; payments via functions |
| Aarti slots | `aarti_slots` | ✅ repository + mapper |
| Bookings + approval chain | `bookings`, `approval_events`, `puja_occurrences` | 🟡 mapper; repository TODO |
| Vrat enrollments | `vrat_programs`, `vrat_enrollments` | 🟡 mapper; repository TODO |
| Tax declarations, receipts list, matching gifts | `tax_declarations`, `receipts`, `matching_gift_requests` | ⬜ |
| Family tree, memberships | `family_members`, `memberships` | ⬜ |
| Puja catalog, events, projects | `puja_catalog`, `events`, `event_costs`, `projects` | ⬜ |
| Inventory + requirements + readiness | `stock_*`, `requirement_*` | ⬜ |
| Volunteers + campaigns | `volunteer*` | ⬜ |
| Aarti texts, streams, recordings, festivals | `aarti_texts`, `live_streams`, `aarti_recordings`, `festival_dates` | ⬜ |
| Parayan, leelas, daily messages | `parayan_*`, `leelas`, `daily_messages` | ⬜ |
| Shop + shipping | `shop_*` | ⬜ (payment path ready) |
| Annadanam | `annadanam_*` | ⬜ (payment path ready: pledge created on success) |
| Prayers, satsang groups | `prayer_*`, `satsang_*` | ⬜ (`public_prayers` view ready) |
| Notification prefs + log | `notification_prefs`, `notification_log` | ⬜ (server side ✅) |
| Facility bookings, admin dashboard stats | not modelled / RPC needed | ⬜ |

## Verification status

**VERIFIED (by running it):**
- SQL: migrations `0001`–`0004` and `seed.sql` (twice, idempotent) apply cleanly to Postgres (PGlite 17) behind a shim of Supabase's `auth` schema and roles. 90 assertions in `supabase/tests/run-pglite.mjs` pass: RLS enabled on all tables; anon/devotee/finance/priest/committee/temple-admin/platform-admin access matrix; cross-temple isolation; privilege-escalation attempts denied; receipt numbering and idempotency; `apply_payment_event` (success, duplicate delivery, amount mismatch, recurring renewal, refund, order, annadanam); outbox claim.
- Edge functions: `deno check` passes for all five; `deno test` passes 7 tests (Stripe and Razorpay signature verification incl. a published HMAC test vector, quiet-hours across midnight/timezones, PDF structure, amount bounds, form encoding).
- Core: `tsc -p packages/core`, `tsc -b apps/devotee`, `tsc -b apps/admin` clean; `npm run test:backend -w @saibaba/core` runs 9 mapper fixture tests.

**NOT VERIFIED (needs credentials / a live project):**
- Any call to Supabase Auth/PostgREST from the browser (auth provider, repositories, `completeSignup`), PKCE/OAuth redirects, phone OTP delivery.
- Any Stripe/Razorpay/Resend/Twilio API call (request shapes follow public docs; Stripe `expand` assumes API version `2024-06-20`).
- RLS under real Supabase roles/JWT claims (tests emulate `auth.uid()` with a session setting), `supabase/config.toml` keys against your CLI version, pg_cron/pg_net scheduling, Supabase Auth hooks.
- Concurrency of receipt allocation (logic relies on row locking; single-connection test only).
- Visual check of the new sign-in/sign-up screens in a browser (type-checked only).
