import type { Donation, DonationCategory } from '../types'
import type { CurrencyCode } from '../types.sai'
import { BOOKINGS_REVENUE_BY_TEMPLE } from './bookings'
import { DEVOTEES, devoteesOf } from './users'
import { PROFILES } from './profiles'
import type { TempleProfile } from './profiles'
import type { Rand } from './seed'
import { chance, dayInYear, id, int, iso, pick, rng, today } from './seed'

/**
 * Year-to-date collected (pujas + gifts) for the flagship. Every temple reconciles to its
 * own figure — see `TempleProfile.collected` — and this stays as the flagship's alias.
 */
export const TOTAL_COLLECTED_TARGET = PROFILES[0]!.collected

export const DONATION_CATEGORIES: { key: DonationCategory; label: string; blurb: string }[] = [
  { key: 'general-hundi', label: 'E-Hundi', blurb: 'Wherever the need is greatest' },
  { key: 'annadanam', label: 'Annadanam', blurb: 'Free meals served every Thursday' },
  { key: 'puja', label: 'Puja Fund', blurb: 'Flowers, naivedya and priest honorarium' },
  { key: 'abhishekam', label: 'Abhishekam', blurb: 'Milk, honey and sandal for Baba’s abhishekam' },
  { key: 'goshala', label: 'Goshala', blurb: 'Care and feed for the temple cows' },
  { key: 'vedic-school', label: 'Sai Youth & Bal Vikas', blurb: 'Weekend classes on Baba’s teachings' },
  { key: 'building', label: 'Building Fund', blurb: 'Mandir, halls and grounds' },
  { key: 'event', label: 'Event Sponsorship', blurb: 'Festival-specific sponsorship' },
]

const CATEGORY_KEYS = DONATION_CATEGORIES.map((c) => c.key)

type Method = Donation['paymentMethod']

const METHODS_BY_COUNTRY: Record<string, Method[]> = {
  US: ['card', 'card', 'card', 'ach', 'ach', 'zelle', 'zelle', 'check', 'cash'],
  CA: ['card', 'card', 'card', 'ach', 'ach', 'check', 'cash'],
  GB: ['card', 'card', 'card', 'ach', 'ach', 'check', 'cash'],
  IN: ['card', 'card', 'card', 'cash', 'cash', 'cash', 'check'],
}

/** Everyday gift sizes in each currency — auspicious figures ending in 1. */
const SMALL_AMOUNTS: Record<CurrencyCode, number[]> = {
  USD: [51, 51, 101, 101, 101, 251, 251, 501, 501, 1001, 1001, 2501],
  INR: [101, 251, 251, 501, 501, 1001, 1001, 2101, 2501, 5001, 11000, 21000],
  GBP: [21, 21, 51, 51, 101, 101, 251, 251, 501, 1001],
  CAD: [51, 51, 101, 101, 251, 251, 501, 501, 1001, 2501],
}

/** Rough size of a capital-campaign cheque, relative to the US figure (before reconciling). */
const MAJOR_FACTOR: Record<CurrencyCode, number> = { USD: 1, INR: 15, GBP: 0.8, CAD: 1.3 }

const DEDICATIONS = [
  'In gratitude for Baba’s grace',
  'For my daughter’s wedding',
  'Thanksgiving for a new home',
  'On my mother’s 80th birthday',
  'In memory of my father',
  'After completing nine Thursdays',
]

let donationCounter = 0

/** One gift. `isMajor` gifts are the capital-campaign cheques that carry the budget. */
function makeDonation(
  r: Rand,
  p: TempleProfile,
  userId: string | null,
  isMajor: boolean,
  createdAt: Date,
): Donation {
  const isRecurring = !isMajor && chance(r, 22)
  donationCounter++
  return {
    id: id('don', donationCounter),
    templeId: p.id,
    currency: p.currency,
    userId,
    category: isMajor ? 'building' : pick(r, CATEGORY_KEYS),
    amount: isMajor ? int(r, 12, 58) * 1000 * MAJOR_FACTOR[p.currency] : pick(r, SMALL_AMOUNTS[p.currency]),
    isRecurring,
    recurringCadence: isRecurring ? pick(r, ['monthly', 'quarterly', 'yearly'] as const) : undefined,
    paymentMethod: isMajor
      ? pick(r, p.country === 'IN' ? (['check', 'check', 'cash'] as const) : (['ach', 'check'] as const))
      : pick(r, METHODS_BY_COUNTRY[p.country]!),
    dedicatedTo: chance(r, 26) ? pick(r, DEDICATIONS) : undefined,
    taxReceiptId: chance(r, 74) ? id('rcpt', donationCounter) : undefined,
    createdAt: iso(createdAt),
  }
}

function buildDonationsFor(p: TempleProfile): Donation[] {
  const r = rng(9042117 + p.index * 131)
  const base = today()
  const thisYear = base.getFullYear()
  const home = devoteesOf(p.id)
  const out: Donation[] = []
  const majors: Donation[] = []

  // Every home devotee gives at least once in each of the last two tax years, so a
  // statement row with nothing against a devotee's name never appears.
  for (const user of home) {
    for (const year of [thisYear - 1, thisYear]) {
      out.push(makeDonation(r, p, user.id, false, dayInYear(r, year, base)))
    }
  }

  // The wider ledger on top — anonymous hundi gifts, recurring givers and the capital
  // majors, spread across both tax years.
  const extras = Math.max(40, Math.round(220 * p.volume))
  for (let i = 0; i < extras; i++) {
    const isMajor = i % 17 === 3
    const anonymous = chance(r, 9)
    const year = pick(r, [thisYear - 1, thisYear])
    const visitor = chance(r, 4)
    const d = makeDonation(
      r,
      p,
      anonymous ? null : (visitor ? pick(r, DEVOTEES) : pick(r, home)).id,
      isMajor,
      dayInYear(r, year, base),
    )
    out.push(d)
    if (isMajor) majors.push(d)
  }

  // Reconcile to the temple's headline figure exactly: scale the capital majors, then
  // settle the rounding remainder on the single largest gift. Small gifts keep their
  // round values.
  const target = p.collected
  const booked = BOOKINGS_REVENUE_BY_TEMPLE[p.id] ?? 0
  const majorSum = majors.reduce((s, d) => s + d.amount, 0)
  const smallSum = out.reduce((s, d) => s + d.amount, 0) - majorSum
  const wanted = target - booked - smallSum
  const factor = wanted / majorSum
  const step = p.currency === 'INR' ? 1000 : 100
  majors.forEach((d) => {
    d.amount = Math.round((d.amount * factor) / step) * step
  })
  const drift = target - booked - out.reduce((s, d) => s + d.amount, 0)
  const anchor = majors.reduce((m, d) => (d.amount > m.amount ? d : m), majors[0]!)
  anchor.amount += drift

  return out
}

export const DONATIONS: Donation[] = PROFILES.flatMap((p) => buildDonationsFor(p)).sort((a, b) =>
  b.createdAt.localeCompare(a.createdAt),
)

export const DONATIONS_REVENUE = DONATIONS.filter((d) => (d.templeId ?? PROFILES[0]!.id) === PROFILES[0]!.id).reduce(
  (s, d) => s + d.amount,
  0,
)
