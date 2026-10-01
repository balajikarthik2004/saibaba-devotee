import type { Membership, MembershipTier } from '../types'
import type { CurrencyCode } from '../types.sai'
import { devoteesOf } from './users'
import { PROFILES } from './profiles'
import { addDays, chance, id, int, iso, rng, today } from './seed'

export interface TierSpec {
  tier: MembershipTier
  /** USD price. Use `tiersFor(currency)` / `tierPrice` for a temple's own. */
  price: number
  tagline: string
  perks: string[]
  facilityDiscountPct: number
}

export const TIERS: TierSpec[] = [
  {
    tier: 'silver',
    price: 250,
    tagline: 'Start your family’s year at Baba’s feet',
    perks: [
      '5% off facility bookings',
      'One free Archana per year',
      'Monthly newsletter and festival calendar',
      'Named in the annual report',
    ],
    facilityDiscountPct: 5,
  },
  {
    tier: 'gold',
    price: 500,
    tagline: 'For families who are here every Thursday',
    perks: [
      '10% off facility bookings',
      'One free Archana per year',
      'Prasad and udi by post, monthly',
      'Reserved seating at major festivals',
      'Named in the annual report',
    ],
    facilityDiscountPct: 10,
  },
  {
    tier: 'platinum',
    price: 1000,
    tagline: 'Patron of the temple',
    perks: [
      '15% off facility bookings',
      'One free Archana per year',
      'Prasad and udi by post, monthly',
      'Guru Purnima sponsorship option',
      'Priority booking on every puja and hall date',
      'Named in the annual report and on the patron board',
    ],
    facilityDiscountPct: 15,
  },
]

export const TIER_BY_KEY = new Map(TIERS.map((t) => [t.tier, t]))

/** Annual price of each tier in each currency — round figures a temple would actually quote. */
export const TIER_PRICES: Record<CurrencyCode, Record<MembershipTier, number>> = {
  USD: { silver: 250, gold: 500, platinum: 1000 },
  INR: { silver: 1101, gold: 2501, platinum: 5101 },
  GBP: { silver: 200, gold: 400, platinum: 800 },
  CAD: { silver: 300, gold: 600, platinum: 1200 },
}

export const tierPrice = (tier: MembershipTier, currency: CurrencyCode) => TIER_PRICES[currency][tier]

/** The tier list with prices in a temple's own currency. */
export const tiersFor = (currency: CurrencyCode): TierSpec[] =>
  TIERS.map((t) => ({ ...t, price: tierPrice(t.tier, currency) }))

/** Roughly two silver : two gold : one platinum at every temple, renewals scattered across the year. */
function buildMemberships(): Membership[] {
  const r = rng(310577)
  const base = today()
  const out: Membership[] = []

  for (const p of PROFILES) {
    const home = devoteesOf(p.id)
    const count = Math.max(3, Math.ceil(home.length * 0.7))
    home.slice(0, count).forEach((user, i) => {
      const tier: MembershipTier = i % 5 === 4 ? 'platinum' : i % 5 >= 2 ? 'gold' : 'silver'
      // Spread renewal dates: a few already lapsed, most live, some renewing soon.
      const startedDaysAgo = int(r, 20, 400)
      const startDate = addDays(base, -startedDaysAgo)
      const endDate = addDays(startDate, 365)
      const expired = endDate.getTime() < base.getTime()
      const cancelled = !expired && chance(r, 6)

      const membership: Membership = {
        id: id('mem', out.length + 1),
        templeId: p.id,
        userId: user.id,
        tier,
        startDate: iso(startDate),
        endDate: iso(endDate),
        autoRenew: chance(r, 64),
        familyPlan: chance(r, 48),
        status: cancelled ? 'cancelled' : expired ? 'expired' : 'active',
      }
      user.membershipId = membership.id
      out.push(membership)
    })
  }
  return out
}

export const MEMBERSHIPS: Membership[] = buildMemberships()

export const MEMBERSHIP_BY_USER = new Map(MEMBERSHIPS.map((m) => [m.userId, m]))
