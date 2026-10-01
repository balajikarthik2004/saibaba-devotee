// Run:  node packages/core/src/backend/mappers.test.ts   (Node >= 22.6 strips types natively)
// Fixtures mimic PostgREST output for the tables in supabase/migrations/0001_schema.sql.
import assert from 'node:assert/strict'
import {
  aartiSlotFromRow,
  aartiSlotToRow,
  bookingFromRow,
  donationFromRow,
  donationToInsert,
  templeFromRow,
  templeToRow,
  vratEnrollmentFromRow,
  vratEnrollmentToRow,
} from './mappers.ts'

let n = 0
const t = (name: string, fn: () => void) => {
  fn()
  n++
  console.log('ok  ', name)
}

const templeRow = {
  id: '00000000-0000-4000-8000-000000000003',
  legacy_id: 'tmp_pune',
  slug: 'pune',
  name: 'Shree Sai Mandir — Pune',
  address: '12 Demo Peth Road',
  city: 'Pune',
  state: 'Maharashtra',
  zip: '411001',
  country: 'IN',
  phone: '+91 20 5550 0122',
  email: 'trust@sai-demo-pune.example',
  timezone: 'Asia/Kolkata',
  timings: { morning: '5:30 AM', evening: '4:30 PM' },
  logo_url: '/logo.svg',
  deities: ['Sai Baba'],
  currency: 'INR',
  locale: 'en-IN',
  languages: ['en', 'hi', 'mr'],
  tax_regime: 'in-80g',
  tax_id: 'AAAAA0000A / 80G-DEMO',
  tax_id_label: 'PAN / 80G reg. no.',
  lat: 18.5204,
  lng: 73.8567,
  about: 'Demo',
  spaces: [{ key: 'samadhi', name: 'Samadhi Mandir', blurb: 'Main sanctum' }],
  payments: ['razorpay', 'upi'],
  ships_to: ['IN'],
  status: 'active',
  is_demo: true,
  brand_hex: null,
}

t('temple row -> domain', () => {
  const x = templeFromRow(templeRow)
  assert.equal(x.id, templeRow.id)
  assert.equal(x.taxRegime, 'in-80g')
  assert.equal(x.currency, 'INR')
  assert.deepEqual(x.shipsTo, ['IN'])
  assert.equal(x.isDemo, true)
  assert.equal(x.brandHex, undefined)
  assert.equal(x.timings.morning, '5:30 AM')
})

t('temple domain -> row never writes status/isDemo and drops undefined', () => {
  const r = templeToRow({ ...templeFromRow(templeRow), status: 'suspended', isDemo: false })
  assert.equal('status' in r, false)
  assert.equal('is_demo' in r, false)
  assert.equal(r.tax_regime, 'in-80g')
  assert.equal(r.ships_to instanceof Array, true)
  assert.equal(Object.values(r).includes(undefined), false)
  assert.deepEqual(Object.keys(templeToRow({ name: 'X' })), ['name'])
})

t('donation row -> domain (account holder, numeric as string)', () => {
  const d = donationFromRow({
    id: 'd1', temple_id: templeRow.id, user_id: 'u1', category: 'annadanam', amount: '1100.00', currency: 'INR',
    payment_method: 'card', is_recurring: true, recurring_cadence: 'monthly', dedicated_to: null, event_items: [],
    receipt_id: 'r1', created_at: '2026-01-01T00:00:00Z',
  })
  assert.equal(d.amount, 1100)
  assert.equal(d.donor, undefined)
  assert.equal(d.dedicatedTo, undefined)
  assert.equal(d.eventItems, undefined)
  assert.equal(d.taxReceiptId, 'r1')
  assert.equal(d.recurringCadence, 'monthly')
  assert.equal(d.currency, 'INR')
})

t('donation row -> domain (guest keeps contact)', () => {
  const d = donationFromRow({
    id: 'd2', temple_id: 't', user_id: null, donor_first_name: 'A', donor_last_name: 'B', donor_email: 'a@b.example',
    donor_phone: '+1', category: 'other', amount: 25, currency: 'USD', payment_method: 'card', is_recurring: false,
    created_at: '2026-01-01T00:00:00Z',
  })
  assert.equal(d.userId, null)
  assert.deepEqual(d.donor, { firstName: 'A', lastName: 'B', email: 'a@b.example', phone: '+1' })
})

t('donation insert is a pending-safe shape (no status/fee/receipt/payment ids)', () => {
  const r = donationToInsert(
    { userId: 'u1', category: 'goshala', amount: 51, isRecurring: false, paymentMethod: 'card' },
    'temple-1', 'USD',
  )
  for (const k of ['status', 'fee', 'receipt_id', 'payment_id', 'id']) assert.equal(k in r, false, k)
  assert.equal(r.temple_id, 'temple-1')
  assert.equal(r.currency, 'USD')
  assert.deepEqual(r.event_items, [])
})

t('booking row + approval events -> domain, history sorted', () => {
  const b = bookingFromRow(
    {
      id: 'b1', temple_id: 't', user_id: 'u', puja_catalog_id: 'p', cadence: 'one-time', start_date: '2026-10-01',
      end_date: '2026-10-01', sankalpam_names: ['A'], add_ons: [], amount: '51.00', currency: 'USD', status: 'pending',
      approval_stage: 'committee-review', payment_method: 'card', payment_reference: 'pi_1', payment_received_at: '2026-09-30T00:00:00Z',
      payment_verified_by: 'f1', payment_verified_at: '2026-09-30T01:00:00Z', assigned_priest_id: null, created_at: '2026-09-29T00:00:00Z',
    },
    [
      { at: '2026-09-30T01:00:00Z', actor_id: 'f1', actor_name: 'Finance', actor_role: 'finance', action: 'payment-verified', note: null },
      { at: '2026-09-29T00:00:00Z', actor_id: 'u', actor_name: 'Devotee', actor_role: 'devotee', action: 'submitted' },
    ],
  )
  assert.equal(b.amount, 51)
  assert.equal(b.approval?.stage, 'committee-review')
  assert.deepEqual(b.approval?.history.map((h) => h.action), ['submitted', 'payment-verified'])
  assert.equal(b.payment?.reference, 'pi_1')
  assert.equal(b.payment?.verifiedBy, 'f1')
  assert.equal(b.assignedPriestId, undefined)
})

t('booking without payment fields has no payment record', () => {
  const b = bookingFromRow({
    id: 'b2', temple_id: 't', user_id: 'u', puja_catalog_id: 'p', cadence: 'yearly', start_date: '2026-01-01T00:00:00Z',
    end_date: '2027-01-01', sankalpam_names: [], add_ons: [], amount: 500, currency: 'USD', status: 'pending',
    approval_stage: 'finance-review', created_at: '2026-01-01T00:00:00Z',
  })
  assert.equal(b.payment, undefined)
  assert.equal(b.startDate, '2026-01-01')
})

t('aarti slot: Postgres time trims to HH:mm and round-trips', () => {
  const row = {
    id: 's1', temple_id: 't', key: 'kakad', name: 'Kakad Aarti', time: '05:30:00', days: [0, 1, 2, 3, 4, 5, 6],
    duration_min: 30, description: 'Morning', active: true, sponsorable: true, sponsor_puja_id: null,
  }
  const s = aartiSlotFromRow(row)
  assert.equal(s.time, '05:30')
  assert.equal(s.sponsorPujaId, undefined)
  const back = aartiSlotToRow(s)
  assert.equal(back.time, '05:30')
  assert.equal(back.sponsor_puja_id, null)
  assert.equal(back.id, 's1')
  assert.equal('id' in aartiSlotToRow({ ...s, id: undefined }), false)
})

t('vrat enrollment round-trip', () => {
  const e = vratEnrollmentFromRow({
    id: 'v1', user_id: 'u', temple_id: 't', program_id: 'p', start_date: '2026-10-01', intention: null,
    observed_on: ['2026-10-01T00:00:00Z', '2026-10-08'], status: 'active', completed_at: null,
    reminder_channels: ['email'], created_at: '2026-10-01T00:00:00Z',
  })
  assert.deepEqual(e.observedOn, ['2026-10-01', '2026-10-08'])
  assert.equal(e.intention, undefined)
  const row = vratEnrollmentToRow(e)
  assert.equal(row.intention, null)
  assert.equal('id' in row, false)
})

console.log(`\n${n} mapper tests passed`)
