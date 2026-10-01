import type {
  FacilityBooking,
  Money,
  RecurringRule,
  Staff,
  TargetAllocation,
  TransparencySnapshot,
} from '../types'
import type { CurrencyCode } from '../types.sai'
import { addDays, id, int, iso, pick, rng, today } from './seed'
import { DEVOTEES, devoteesOf } from './users'
import { PROFILES, loc, locCost, priestIdsOf, tag } from './profiles'
import type { TempleProfile } from './profiles'
import { PROJECTS } from './projects'
import { TEMPLE_BY_ID } from './temple'
import { pujaIdFor } from './catalog'

/* ---------------------------------------------------------------- transparency */

interface Head {
  key: string
  label: string
  detail: string
  /** Share of the non-construction target. */
  weight: number
}

const HEADS: Head[] = [
  {
    key: 'clergy',
    label: 'Priests & temple staff',
    detail: 'Honorarium, housing and travel for the priests, plus office and kitchen staff.',
    weight: 0.33,
  },
  {
    key: 'festivals',
    label: 'Festivals & pujas',
    detail: 'The temple year — from Guru Purnima and Ram Navami to Vijayadashami and Datta Jayanti.',
    weight: 0.25,
  },
  {
    key: 'annadanam',
    label: 'Annadanam & prasad',
    detail: 'Free meals every Thursday and on festival days, and daily naivedya.',
    weight: 0.17,
  },
  {
    key: 'facilities',
    label: 'Facilities, utilities & upkeep',
    detail: 'Power, water, insurance, landscaping and routine repair of the campus.',
    weight: 0.15,
  },
  {
    key: 'admin',
    label: 'Administration & outreach',
    detail: 'Accounting, statutory filing, the youth programme and the temple bulletin.',
    weight: 0.1,
  },
]

/** Per-head fraction of its target actually raised, before being scaled to reconcile. */
const RAISED_PCT = [0.93, 0.88, 0.92, 0.95, 0.83]
const SPENT_PCT = [0.97, 0.92, 0.93, 0.96, 0.91]

/**
 * One temple's board-approved budget, broken out by head.
 *
 * Reconciles exactly, by construction: the heads' targets sum to `annualTarget`, their
 * collected figures sum to `ytdCollected` (which is also pujas + gifts — `donations.ts`
 * settles to the same number), and the construction head carries the exact raised and
 * spent totals of that temple's `PROJECTS`, because the capital-projects section of the
 * transparency page is the same money counted a second way.
 */
function buildSnapshot(p: TempleProfile): TransparencySnapshot {
  const step = p.currency === 'INR' ? 1000 : 10
  const round = (v: number) => Math.round(v / step) * step
  const collected = p.collected

  const projects = PROJECTS.filter((x) => x.templeId === p.id)
  const consTarget = projects.reduce((s, x) => s + x.targetAmount, 0)
  const consRaised = projects.reduce((s, x) => s + x.raisedAmount, 0)
  const consSpent = projects.reduce((s, x) => s + x.spentAmount, 0)

  const annual = Math.round(collected / 0.8 / (p.currency === 'INR' ? 100_000 : 5_000)) * (p.currency === 'INR' ? 100_000 : 5_000)
  const restTarget = annual - consTarget
  const restCollected = collected - consRaised

  // Targets, then collected scaled so the heads add up to the headline figure.
  const targets: number[] = []
  HEADS.forEach((h, i) => {
    targets.push(i === HEADS.length - 1 ? restTarget - targets.reduce((a, b) => a + b, 0) : round(restTarget * h.weight))
  })
  const rawCollected = targets.map((t, i) => t * RAISED_PCT[i]!)
  const scale = restCollected / rawCollected.reduce((a, b) => a + b, 0)
  const collectedBy: number[] = []
  HEADS.forEach((_, i) => {
    collectedBy.push(
      i === HEADS.length - 1
        ? restCollected - collectedBy.reduce((a, b) => a + b, 0)
        : round(rawCollected[i]! * scale),
    )
  })

  const allocations: TargetAllocation[] = HEADS.map((h, i) => ({
    key: h.key,
    label: h.label,
    detail: h.detail,
    targetAmount: targets[i]!,
    collectedAmount: collectedBy[i]!,
    spentAmount: round(collectedBy[i]! * SPENT_PCT[i]!),
  }))

  allocations.push({
    key: 'construction',
    label: 'Temple construction & renovation',
    detail: 'Capital projects: ' + (projects.map((x) => x.title).join(', ') || 'none this year') + '.',
    targetAmount: consTarget,
    collectedAmount: consRaised,
    spentAmount: consSpent,
  })
  // Largest head first, as the page reads.
  allocations.sort((a, b) => b.targetAmount - a.targetAmount)

  return {
    templeId: p.id,
    currency: p.currency,
    ytdCollected: collected,
    annualTarget: annual,
    balanceToBreakeven: annual - collected,
    achievedPct: Math.round((collected / annual) * 100),
    updatedAt: iso(new Date()),
    allocations,
  }
}

export const TRANSPARENCY_BY_TEMPLE: Record<string, TransparencySnapshot> = Object.fromEntries(
  PROFILES.map((p) => [p.id, buildSnapshot(p)]),
)

/** The flagship's snapshot, kept under its original name. */
export const TRANSPARENCY: TransparencySnapshot = TRANSPARENCY_BY_TEMPLE[PROFILES[0]!.id]!

/* ------------------------------------------------------------ recurring rhythm */

function buildRules(): RecurringRule[] {
  const out: RecurringRule[] = []
  for (const p of PROFILES) {
    const rule = (
      key: string,
      label: string,
      dayOfWeek: number,
      time: string,
      nth?: number,
    ): void => {
      const pid = pujaIdFor(p.id, key)
      if (!pid) return
      out.push({
        id: `rule${tag(p)}_${String(out.filter((r) => r.templeId === p.id).length + 1).padStart(4, '0')}`,
        templeId: p.id,
        label,
        dayOfWeek,
        time,
        pujaCatalogId: pid,
        nth,
      })
    }
    rule('thursday', 'Thursday Sai Puja', 4, '18:30')
    rule('abhishekam', 'Thursday Baba Abhishekam', 4, '09:00')
    rule('annadanam-thu', 'Thursday Annadanam', 4, '12:30')
    rule('dattapuja', 'Dattatreya Puja', 4, '19:30', 3)
    rule('maruti', 'Maruti Puja', 6, '18:00')
    rule('shani', 'Shani Puja', 6, '19:00')
  }
  return out
}

/** The published weekly rhythm, overlaid on both calendars. */
export const RECURRING_RULES: RecurringRule[] = buildRules()

/* ----------------------------------------------------------------------- staff */

function buildStaff(): Staff[] {
  const out: Staff[] = []
  for (const p of PROFILES) {
    const t = TEMPLE_BY_ID.get(p.id)!
    const phone = (k: number) => t.phone.replace(/\d{2}$/, String(10 + k))
    const first = (n: string) => n.replace(/^Pt\.\s*/, '').split(' ')[0]!.toLowerCase()
    const ids = priestIdsOf(p)
    let k = 0
    p.priests.forEach((pr, i) =>
      out.push({
        id: ids[i]!,
        templeId: p.id,
        name: pr.name,
        role: 'priest',
        title: pr.title,
        phone: phone(k++),
        email: `${first(pr.name)}@${p.domain}`,
      }),
    )
    const rest: [string, Staff['role'], { name: string; title: string }, string][] = [
      [`usr_admin${tag(p)}`, 'admin', p.admin, `admin@${p.domain}`],
      [`usr_board${tag(p)}`, 'board', p.board, `board@${p.domain}`],
      [`usr_finance${tag(p)}`, 'finance', p.finance, `accounts@${p.domain}`],
      [`usr_committee${tag(p)}`, 'committee', p.committee, `pujacommittee@${p.domain}`],
    ]
    for (const [sid, role, seed, email] of rest) {
      out.push({ id: sid, templeId: p.id, name: seed.name, role, title: seed.title, phone: phone(k++), email })
    }
  }
  return out
}

/** Every temple's staff. Use `staffFor(templeId)` (or `listStaff()` in the API) to scope. */
export const ALL_STAFF: Staff[] = buildStaff()

export const staffFor = (templeId: string): Staff[] => ALL_STAFF.filter((s) => s.templeId === templeId)

/** The flagship's staff — what the screens that predate multi-temple still import. */
export const STAFF: Staff[] = staffFor(PROFILES[0]!.id)

/* -------------------------------------------------------------------- facility */

export interface FacilitySpec {
  key: FacilityBooking['facility']
  label: string
  capacity: number
  /** USD. `facilitiesFor(currency)` localises. */
  baseRate: Money
}

export const FACILITIES: FacilitySpec[] = [
  { key: 'main-hall', label: 'Main Hall', capacity: 400, baseRate: 1200 },
  { key: 'mini-hall', label: 'Mini Hall', capacity: 120, baseRate: 450 },
  { key: 'canteen', label: 'Canteen', capacity: 80, baseRate: 300 },
]

export const facilitiesFor = (currency: CurrencyCode): FacilitySpec[] =>
  FACILITIES.map((f) => ({ ...f, baseRate: loc(f.baseRate, currency) }))

export const FACILITY_ITEMS: { label: string; price: Money; unit: string }[] = [
  { label: 'Folding chairs', price: 2, unit: 'per chair' },
  { label: 'Banquet tables', price: 12, unit: 'per table' },
  { label: 'Catering (vegetarian, per plate)', price: 18, unit: 'per plate' },
  { label: 'Sound system & mic', price: 150, unit: 'flat' },
  { label: 'Stage lighting', price: 220, unit: 'flat' },
  { label: 'Cleaning crew', price: 180, unit: 'flat' },
]

export const facilityItemsFor = (currency: CurrencyCode) =>
  FACILITY_ITEMS.map((i) => ({ ...i, price: locCost(i.price, currency) }))

function buildFacilityBookings(): FacilityBooking[] {
  const base = today()
  const statuses: FacilityBooking['status'][] = ['confirmed', 'confirmed', 'pending', 'cancelled']
  const out: FacilityBooking[] = []

  for (const p of PROFILES) {
    const r = rng(660331 + p.index * 29)
    const items0 = facilityItemsFor(p.currency)
    const specs = facilitiesFor(p.currency)
    const home = devoteesOf(p.id)
    const count = Math.max(5, Math.round(18 * p.volume))
    for (let i = 0; i < count; i++) {
      const items = items0
        .filter(() => r() > 0.55)
        .map((it) => ({
          label: it.label,
          qty: it.unit === 'flat' ? 1 : int(r, 20, 220),
          price: it.price,
        }))
      const spec = pick(r, specs)
      const total = items.reduce<number>((s, it) => s + it.qty * it.price, spec.baseRate)
      out.push({
        id: id('fac', out.length + 1),
        templeId: p.id,
        currency: p.currency,
        userId: (r() < 0.95 ? pick(r, home) : pick(r, DEVOTEES)).id,
        facility: spec.key,
        date: iso(addDays(base, int(r, -20, 75))),
        items,
        total,
        status: pick(r, statuses),
      })
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

export const FACILITY_BOOKINGS: FacilityBooking[] = buildFacilityBookings()

/** Rendered by the admin "Email templates" settings tab. */
export const EMAIL_TEMPLATES = [
  {
    id: 'tpl_booking',
    name: 'Puja booking confirmation',
    subject: 'Your {{pujaName}} sponsorship is confirmed',
    body: 'Om Sai Ram {{devoteeName}},\n\nYour sponsorship of {{pujaName}} ({{cadence}}) is confirmed. Booking {{bookingId}}.\nSankalp will be offered in the name(s): {{sankalpamNames}}.\n\nShraddha and saburi,\n{{templeName}}',
  },
  {
    id: 'tpl_receipt',
    name: 'Tax receipt',
    subject: 'Your {{year}} contribution statement',
    body: 'Dear {{devoteeName}},\n\nThank you for your support. Your total eligible contribution for {{year}} was {{amount}}.\n{{templeName}} is a registered charity; {{taxIdLabel}} {{ein}}. No goods or services were provided in exchange.',
  },
  // Membership temporarily disabled
  // {
  // id: 'tpl_renewal',
  // name: 'Membership renewal reminder',
  // subject: 'Your {{tier}} membership renews on {{date}}',
  // body: 'Dear {{devoteeName}},\n\nYour {{tier}} membership expires on {{date}}. Renew online in under a minute to keep your family’s benefits active.',
  // },
]
