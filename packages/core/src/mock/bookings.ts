import type { ApprovalEvent, Booking, Cadence, PujaCatalogItem, PujaOccurrence, User } from '../types'
import { cadenceOptions, catalogFor, priceForCadence } from './catalog'
import { DEVOTEES, devoteesOf } from './users'
import { PROFILES, PROFILE_BY_ID, FLAGSHIP_ID, priestIdsOf, tag } from './profiles'
import type { TempleProfile } from './profiles'
import type { Rand } from './seed'
import { addDays, chance, dayInYear, id, int, iso, pick, rng, today } from './seed'

/** Chief priest + assistants of the flagship. Other temples: `priestIdsOf(profile)`. */
export const PRIEST_IDS = priestIdsOf(PROFILES[0]!)
export const OFFICIANTS = PROFILES[0]!.priests.map((x) => x.name)

/**
 * Which of a puja's permitted cadences a sponsor picks. Most take the rhythm the temple
 * recommends; a few step it up, a few step it down. Weighted toward the top of the range
 * so the roster carries realistic daily volume.
 */
const LADDER_CHOICE = [0, 1, 1, 1, 2, 2, 2, 2] as const

const STATUS_MIX: Booking['status'][] = [
  ...Array<Booking['status']>(11).fill('active'),
  ...Array<Booking['status']>(2).fill('completed'),
  'paused',
  'cancelled',
]

/**
 * The mix for a devotee's guaranteed sponsorship of the year. A cancelled booking is
 * refunded and so is excluded from the tax receipt — which would put the row back at
 * zero. Cancellations still occur, but only among the extra bookings below.
 */
const GUARANTEED_STATUS_MIX = STATUS_MIX.filter((s) => s !== 'cancelled')

/** The extras carry the states the guaranteed pass cannot, weighted the other way. */
const EXTRA_STATUS_MIX: Booking['status'][] = [
  ...Array<Booking['status']>(5).fill('active'),
  ...Array<Booking['status']>(3).fill('completed'),
  ...Array<Booking['status']>(2).fill('paused'),
  ...Array<Booking['status']>(3).fill('cancelled'),
]

type Method = NonNullable<Booking['payment']>['method']

/** How money actually arrives, by country. */
const METHODS_BY_COUNTRY: Record<string, Method[]> = {
  US: ['card', 'ach', 'zelle', 'check'],
  CA: ['card', 'ach', 'check'],
  GB: ['card', 'ach', 'check'],
  IN: ['card', 'cash', 'check'],
}

let bookingCounter = 0

/** One sponsorship, paid for on `createdAt`. */
function makeBooking(
  r: Rand,
  p: TempleProfile,
  catalog: PujaCatalogItem[],
  user: User,
  createdAt: Date,
  base: Date,
  guaranteed = false,
): Booking {
  const puja = pick(r, catalog)
  const options = cadenceOptions(puja)
  const cadence = options[Math.min(options.length - 1, pick(r, LADDER_CHOICE))]!

  // The temple takes payment a few days before the first puja is offered.
  const startDate = addDays(createdAt, int(r, 1, 9))
  const endDate = addDays(startDate, cadence === 'one-time' ? 1 : 365)

  const addOnDefs = puja.addOns ?? []
  const picked = addOnDefs.filter((a) => (a.price === 0 ? chance(r, 55) : chance(r, 28)))
  const addOns = picked.map((a) => a.id)
  const addOnTotal = picked.reduce((s, a) => s + a.price, 0)

  const sankalpamNames = [user.name]
  if (chance(r, 45)) sankalpamNames.push(`${user.name.split(' ')[0]} family`)

  // A term that has already run out is completed, not active.
  let status = pick(r, guaranteed ? GUARANTEED_STATUS_MIX : EXTRA_STATUS_MIX)
  if (status === 'active' && endDate.getTime() < base.getTime()) status = 'completed'

  bookingCounter++
  return {
    id: id('bkg', bookingCounter),
    templeId: p.id,
    currency: p.currency,
    userId: user.id,
    pujaCatalogId: puja.id,
    cadence,
    startDate: iso(startDate),
    endDate: iso(endDate),
    sankalpamNames,
    addOns,
    amount: priceForCadence(puja, cadence) + addOnTotal,
    status,
    createdAt: iso(createdAt),
  }
}

/** Plausible transaction references, shaped by how the money arrived. */
function paymentRef(r: Rand, method: Method, country: string) {
  if (method === 'check') return `CHQ ${int(r, 1000, 9999)}`
  if (method === 'zelle') return `ZL${int(r, 100000, 999999)}`
  if (method === 'ach') return country === 'GB' ? `FPS${int(r, 100000, 999999)}` : `ACH-${int(r, 10000, 99999)}`
  if (method === 'cash') return `RCPT-${int(r, 1000, 9999)}`
  return `ch_${int(r, 100000, 999999)}${int(r, 1000, 9999)}`
}

const SENT_BACK_REASONS = [
  'No matching credit on the bank statement for this amount.',
  'Cheque returned unpaid — please ask the devotee to re-issue.',
  'Transfer reference does not match any receipt in the temple account.',
]

/**
 * The live approval queue: recent sponsorships that have not yet cleared the desks, so
 * they carry `status: 'pending'` and generate no occurrences and no revenue.
 */
function makeApprovalBooking(
  r: Rand,
  p: TempleProfile,
  catalog: PujaCatalogItem[],
  user: User,
  base: Date,
  stage: 'finance-review' | 'payment-pending' | 'committee-review',
): Booking {
  const createdAt = addDays(base, -int(r, 0, 13))
  const puja = pick(r, catalog)
  const options = cadenceOptions(puja)
  const cadence = options[Math.min(options.length - 1, pick(r, LADDER_CHOICE))]!
  const startDate = addDays(createdAt, int(r, 3, 21))
  const endDate = addDays(startDate, cadence === 'one-time' ? 1 : 365)

  const picked = (puja.addOns ?? []).filter((a) => (a.price === 0 ? chance(r, 55) : chance(r, 28)))
  const addOnTotal = picked.reduce((s, a) => s + a.price, 0)

  const sankalpamNames = [user.name]
  if (chance(r, 45)) sankalpamNames.push(`${user.name.split(' ')[0]} family`)

  const method = pick(r, METHODS_BY_COUNTRY[p.country]!)
  const financeId = `usr_finance${tag(p)}`
  const history: ApprovalEvent[] = [
    {
      at: iso(createdAt),
      actorId: user.id,
      actorName: user.name,
      actorRole: 'devotee',
      action: 'submitted',
      note: `Sponsorship submitted from the devotee portal · paid by ${method}.`,
    },
  ]

  const payment: Booking['payment'] = { method, reference: paymentRef(r, method, p.country) }

  if (stage === 'committee-review') {
    const at = iso(addDays(createdAt, 1))
    payment.receivedAt = iso(createdAt)
    payment.verifiedBy = financeId
    payment.verifiedAt = at
    history.push({
      at,
      actorId: financeId,
      actorName: p.finance.name,
      actorRole: 'finance',
      action: 'payment-verified',
      note: `Matched against ${payment.reference} on the temple account.`,
    })
  }

  if (stage === 'payment-pending') {
    history.push({
      at: iso(addDays(createdAt, 1)),
      actorId: financeId,
      actorName: p.finance.name,
      actorRole: 'finance',
      action: 'sent-back',
      note: pick(r, SENT_BACK_REASONS),
    })
  }

  bookingCounter++
  return {
    id: id('bkg', bookingCounter),
    templeId: p.id,
    currency: p.currency,
    userId: user.id,
    pujaCatalogId: puja.id,
    cadence,
    startDate: iso(startDate),
    endDate: iso(endDate),
    sankalpamNames,
    addOns: picked.map((a) => a.id),
    amount: priceForCadence(puja, cadence) + addOnTotal,
    status: 'pending',
    approval: { stage, history },
    payment,
    createdAt: iso(createdAt),
  }
}

function buildBookingsFor(p: TempleProfile): Booking[] {
  const r = rng(430915 + p.index * 101)
  const base = today()
  const thisYear = base.getFullYear()
  const catalog = catalogFor(p.id)
  const home = devoteesOf(p.id)
  const out: Booking[] = []

  /** Mostly the temple's own devotees, with the odd visitor from elsewhere. */
  const someone = () => (chance(r, 95) ? pick(r, home) : pick(r, DEVOTEES))

  // Every home devotee sponsors at least once in each of the last two tax years, so the
  // bulk tax-receipt screen never shows a row with nothing in the Sponsorships column.
  for (const user of home) {
    for (const year of [thisYear - 1, thisYear]) {
      out.push(makeBooking(r, p, catalog, user, dayInYear(r, year, base), base, true))
    }
  }

  // Extras on top, so volume per devotee still varies. Weighted to the current year.
  const extras = Math.max(8, Math.round(50 * p.volume))
  for (let i = 0; i < extras; i++) {
    const year = pick(r, [thisYear - 1, thisYear, thisYear])
    out.push(makeBooking(r, p, catalog, someone(), dayInYear(r, year, base), base))
  }

  // Approval queue: mostly with accounts, a couple sent back, some with the committee.
  const q = p.queue
  const stages: ('finance-review' | 'payment-pending' | 'committee-review')[] = []
  for (let i = 0; i < q; i++) {
    stages.push(i < Math.ceil(q * 0.5) ? 'finance-review' : i < Math.ceil(q * 0.7) ? 'payment-pending' : 'committee-review')
  }
  for (const stage of stages) out.push(makeApprovalBooking(r, p, catalog, someone(), base, stage))

  return out
}

export const BOOKINGS: Booking[] = PROFILES.flatMap((p) => buildBookingsFor(p))

const NOTE_POOL = [
  'Family attending in person',
  'Prasad to be couriered',
  'Sponsor requested livestream link',
  'Names read at the Samadhi Mandir',
  'Rescheduled from the previous week',
]

/**
 * Step for a cadence, in days. `yearly`/`one-time` are handled explicitly.
 *
 * Exported because `api.ts` walks the same rhythm when it materialises occurrences for a
 * booking approved during the session.
 */
export const CADENCE_DAYS: Record<Cadence, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  quarterly: 91,
  yearly: 365,
  'one-time': 0,
}

/**
 * Materialises occurrences across a −14 → +30 day window from every active booking.
 * The backward half gives the admin app a plausible fulfilment history; the forward
 * half is the "next 30 days" the devotee dashboard and Today panel read from.
 */
function buildOccurrences(): PujaOccurrence[] {
  const r = rng(88123)
  const base = today()
  const now = Date.now()
  const from = -14
  const to = 30
  const out: PujaOccurrence[] = []
  let n = 0

  for (const b of BOOKINGS) {
    if (b.status !== 'active') continue
    const p = PROFILE_BY_ID.get(b.templeId ?? FLAGSHIP_ID)!
    const priestIds = priestIdsOf(p)
    const step = CADENCE_DAYS[b.cadence]
    const hour = pick(r, [8, 9, 11, 17, 18, 19])
    const minute = pick(r, [0, 15, 30])

    const offsets: number[] = []
    if (step === 0) {
      offsets.push(int(r, from, to))
    } else {
      // Anchor the series on the booking start date so each booking has its own rhythm.
      const startOffset = Math.round((new Date(b.startDate).getTime() - base.getTime()) / 86400000)
      let k = Math.ceil((from - startOffset) / step)
      for (;;) {
        const off = startOffset + k * step
        if (off > to) break
        if (off >= from) offsets.push(off)
        k++
      }
    }

    for (const off of offsets) {
      const at = addDays(base, off)
      at.setHours(hour, minute, 0, 0)
      const past = at.getTime() < now
      const skipped = past && chance(r, 4)
      const who = int(r, 0, p.priests.length - 1)
      n++
      out.push({
        id: id('occ', n),
        bookingId: b.id,
        scheduledAt: iso(at),
        fulfilledAt: past && !skipped ? iso(at) : undefined,
        officiant: p.priests[who]!.name,
        officiantId: priestIds[who],
        notes: chance(r, 12) ? pick(r, NOTE_POOL) : undefined,
        status: skipped ? 'skipped' : past ? 'completed' : 'scheduled',
      })
    }
  }

  return out.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
}

export const OCCURRENCES: PujaOccurrence[] = buildOccurrences()

/**
 * Sponsorship revenue booked, per temple — feeds each temple's transparency reconciliation.
 *
 * `pending` is excluded alongside `cancelled`: a sponsorship whose payment the accounts
 * desk has not yet verified is not money the temple can report having received.
 */
export const BOOKINGS_REVENUE_BY_TEMPLE: Record<string, number> = {}
for (const b of BOOKINGS) {
  if (b.status === 'cancelled' || b.status === 'pending') continue
  const k = b.templeId ?? FLAGSHIP_ID
  BOOKINGS_REVENUE_BY_TEMPLE[k] = (BOOKINGS_REVENUE_BY_TEMPLE[k] ?? 0) + b.amount
}

/** The flagship's figure — kept under the old name for screens that predate multi-temple. */
export const BOOKINGS_REVENUE = BOOKINGS_REVENUE_BY_TEMPLE[FLAGSHIP_ID] ?? 0
