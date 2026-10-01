import type { CountryCode, CurrencyCode } from '../types.sai'
import { TEMPLES } from './temple'

/**
 * Per-temple seed parameters: who works there, how busy it is, what it raised this year.
 * Everything the generators (`users`, `bookings`, `donations` …) need to make six temples
 * that feel like six temples rather than one temple six times.
 */

export interface StaffSeed {
  name: string
  title: string
}

export interface TempleProfile {
  id: string
  /** Short code used in generated ids, e.g. `fmt`. The flagship has none — its ids stay bare. */
  short: string
  index: number
  currency: CurrencyCode
  country: CountryCode
  /** Email domain for staff addresses. */
  domain: string
  phoneCode: string
  /** Bigger numbers = busier temple. The flagship is 1. */
  volume: number
  /** Bookings that are still in the accounts / committee queue. */
  queue: number
  /** Year-to-date collected (pujas + gifts), in the temple's own currency. */
  collected: number
  admin: StaffSeed
  board: StaffSeed
  finance: StaffSeed
  committee: StaffSeed
  priests: StaffSeed[]
  /** Localities devotees here live in. */
  localities: { city: string; zip: string }[]
  streets: string[]
  hasDatta: boolean
  hasMaruti: boolean
  hasShani: boolean
}

const has = (id: string, key: string) =>
  TEMPLES.find((t) => t.id === id)?.spaces.some((s) => s.key === key) ?? false

const P = (p: Omit<TempleProfile, 'hasDatta' | 'hasMaruti' | 'hasShani'>): TempleProfile => ({
  ...p,
  hasDatta: has(p.id, 'datta'),
  hasMaruti: has(p.id, 'maruti'),
  hasShani: has(p.id, 'shani'),
})

export const PROFILES: TempleProfile[] = [
  P({
    id: 'tmp_sugarland',
    short: '',
    index: 0,
    currency: 'USD',
    country: 'US',
    domain: 'saisugarland.org',
    phoneCode: '+1',
    volume: 1,
    queue: 10,
    collected: 640_000,
    admin: { name: 'Anand Mehta', title: 'Temple Administrator' },
    board: { name: 'Raghunath Iyer', title: 'Board Treasurer' },
    finance: { name: 'Kavita Patel', title: 'Accounts Officer' },
    committee: { name: 'Sridhar Naidu', title: 'Puja Committee Chair' },
    priests: [
      { name: 'Pt. Vishwanath Sharma', title: 'Chief Priest' },
      { name: 'Pt. Dattatreya Joshi', title: 'Priest — Samadhi Mandir' },
      { name: 'Pt. Srinivas Bhattar', title: 'Priest — Dwarakamai' },
      { name: 'Pt. Gopal Kulkarni', title: 'Priest — Homam & samskaras' },
    ],
    localities: [
      { city: 'Sugar Land', zip: '77479' },
      { city: 'Missouri City', zip: '77459' },
      { city: 'Stafford', zip: '77477' },
      { city: 'Houston', zip: '77096' },
      { city: 'Katy', zip: '77494' },
      { city: 'Pearland', zip: '77584' },
      { city: 'Richmond', zip: '77406' },
    ],
    streets: [
      'Highway 6',
      'Lexington Blvd',
      'Williams Trace Blvd',
      'Sweetwater Blvd',
      'Cinco Ranch Blvd',
      'Sienna Pkwy',
      'Dairy Ashford Rd',
    ],
  }),
  P({
    id: 'tmp_fremont',
    short: 'fmt',
    index: 1,
    currency: 'USD',
    country: 'US',
    domain: 'saifremont.org',
    phoneCode: '+1',
    volume: 0.45,
    queue: 5,
    collected: 410_000,
    admin: { name: 'Deepa Nair', title: 'Temple Administrator' },
    board: { name: 'Mahesh Gupta', title: 'Board Treasurer' },
    finance: { name: 'Rohit Shah', title: 'Accounts Officer' },
    committee: { name: 'Lalitha Rao', title: 'Puja Committee Chair' },
    priests: [
      { name: 'Pt. Hari Om Tiwari', title: 'Chief Priest' },
      { name: 'Pt. Sudhakar Rao', title: 'Priest — Samadhi Mandir' },
    ],
    localities: [
      { city: 'Fremont', zip: '94538' },
      { city: 'Newark', zip: '94560' },
      { city: 'Union City', zip: '94587' },
      { city: 'Milpitas', zip: '95035' },
    ],
    streets: ['Mission Blvd', 'Paseo Padre Pkwy', 'Stevenson Blvd', 'Warm Springs Blvd', 'Fremont Blvd'],
  }),
  P({
    id: 'tmp_pune',
    short: 'pun',
    index: 2,
    currency: 'INR',
    country: 'IN',
    domain: 'saipune.org',
    phoneCode: '+91',
    volume: 0.6,
    queue: 6,
    collected: 14_200_000,
    admin: { name: 'Shashikant Patil', title: 'Trust Secretary' },
    board: { name: 'Vijay Kulkarni', title: 'Trustee & Treasurer' },
    finance: { name: 'Medha Joshi', title: 'Accounts Officer' },
    committee: { name: 'Ganesh Kale', title: 'Puja Committee Chair' },
    priests: [
      { name: 'Pt. Dinkar Gosavi', title: 'Chief Priest' },
      { name: 'Pt. Mukund Joshi', title: 'Priest — Samadhi Mandir' },
      { name: 'Pt. Vasant Apte', title: 'Priest — Dwarakamai' },
    ],
    localities: [
      { city: 'Pune', zip: '411038' },
      { city: 'Pune', zip: '411045' },
      { city: 'Pune', zip: '411028' },
      { city: 'Pune', zip: '411007' },
      { city: 'Pimpri-Chinchwad', zip: '411017' },
    ],
    streets: ['Karve Road', 'Baner Road', 'Sinhagad Road', 'Aundh Road', 'FC Road', 'Paud Road'],
  }),
  P({
    id: 'tmp_hyderabad',
    short: 'hyd',
    index: 3,
    currency: 'INR',
    country: 'IN',
    domain: 'saihyderabad.org',
    phoneCode: '+91',
    volume: 0.4,
    queue: 4,
    collected: 7_800_000,
    admin: { name: 'Ramakrishna Reddy', title: 'Trust Secretary' },
    board: { name: 'Suryanarayana Rao', title: 'Trustee & Treasurer' },
    finance: { name: 'Lavanya Naidu', title: 'Accounts Officer' },
    committee: { name: 'Ravi Teja Chowdary', title: 'Puja Committee Chair' },
    priests: [
      { name: 'Pt. Seshagiri Sastry', title: 'Chief Priest' },
      { name: 'Pt. Anjaneyulu Sharma', title: 'Priest — Samadhi Mandir' },
    ],
    localities: [
      { city: 'Hyderabad', zip: '500033' },
      { city: 'Hyderabad', zip: '500081' },
      { city: 'Hyderabad', zip: '500072' },
      { city: 'Hyderabad', zip: '500032' },
    ],
    streets: ['Road No. 36', 'Madhapur Main Road', 'KPHB Colony Road', 'Gachibowli Road', 'Film Nagar Road'],
  }),
  P({
    id: 'tmp_harrow',
    short: 'hrw',
    index: 4,
    currency: 'GBP',
    country: 'GB',
    domain: 'saiharrow.org',
    phoneCode: '+44',
    volume: 0.3,
    queue: 3,
    collected: 240_000,
    admin: { name: 'Bharat Vyas', title: 'Centre Manager' },
    board: { name: 'Hema Patel', title: 'Trustee & Treasurer' },
    finance: { name: 'Chetan Shah', title: 'Accounts Officer' },
    committee: { name: 'Jyoti Mehta', title: 'Puja Committee Chair' },
    priests: [
      { name: 'Pt. Yogesh Pandya', title: 'Chief Priest' },
      { name: 'Pt. Kaushik Joshi', title: 'Priest' },
    ],
    localities: [
      { city: 'Harrow', zip: 'HA1 2AB' },
      { city: 'Wembley', zip: 'HA9 6DE' },
      { city: 'Stanmore', zip: 'HA7 3QT' },
      { city: 'Pinner', zip: 'HA5 1PL' },
    ],
    streets: ['Station Road', 'Kenton Road', 'Uxbridge Road', 'Bridge Street', 'Pinner Road'],
  }),
  P({
    id: 'tmp_mississauga',
    short: 'msg',
    index: 5,
    currency: 'CAD',
    country: 'CA',
    domain: 'saimississauga.org',
    phoneCode: '+1',
    volume: 0.4,
    queue: 4,
    collected: 360_000,
    admin: { name: 'Kamal Arora', title: 'Temple Administrator' },
    board: { name: 'Sheela Rajan', title: 'Board Treasurer' },
    finance: { name: 'Amrit Dhillon', title: 'Accounts Officer' },
    committee: { name: 'Tejal Desai', title: 'Puja Committee Chair' },
    priests: [
      { name: 'Pt. Narayan Iyer', title: 'Chief Priest' },
      { name: 'Pt. Mohan Shastri', title: 'Priest — Samadhi Mandir' },
    ],
    localities: [
      { city: 'Mississauga', zip: 'L5B 2C9' },
      { city: 'Brampton', zip: 'L6Y 5H2' },
      { city: 'Oakville', zip: 'L6H 7T1' },
      { city: 'Mississauga', zip: 'L5N 1W4' },
    ],
    streets: ['Hurontario St', 'Dundas St W', 'Burnhamthorpe Rd', 'Erin Mills Pkwy', 'Derry Rd'],
  }),
]

export const PROFILE_BY_ID = new Map(PROFILES.map((p) => [p.id, p]))
export const FLAGSHIP_ID = PROFILES[0]!.id
export const profileOf = (templeId: string | undefined): TempleProfile =>
  PROFILE_BY_ID.get(templeId ?? FLAGSHIP_ID) ?? PROFILES[0]!

/** Suffix for generated ids so six temples never collide. Empty for the flagship. */
export const tag = (p: TempleProfile) => (p.short ? `_${p.short}` : '')

/* ---------------------------------------------------------------- currency scaling */

/**
 * A price written in USD, expressed the way a temple in `currency` would actually quote
 * it. INR uses a purchasing-power factor (a $51 sponsorship is ₹1,101, not ₹4,200) and a
 * coarser rounding, and amounts that end in 1 keep doing so — 11, 51, 101, 251 are the
 * auspicious figures a hundi slip carries in every currency.
 */
export function loc(usd: number, currency: CurrencyCode): number {
  if (currency === 'USD') return usd
  const auspicious = usd % 10 === 1
  let v: number
  if (currency === 'INR') {
    v = usd * 22
    v =
      v < 500 ? Math.round(v / 10) * 10 : v < 5000 ? Math.round(v / 50) * 50 : Math.round(v / 100) * 100
  } else {
    v = usd * (currency === 'GBP' ? 0.8 : 1.3)
    v = v < 25 ? Math.round(v) : v < 2500 ? Math.round(v / 5) * 5 : Math.round(v / 50) * 50
  }
  if (auspicious && v % 10 === 0) v += 1
  return v
}

/** Goods and services bought locally: cheaper than temple prices in India. */
export function locCost(usd: number, currency: CurrencyCode): number {
  if (currency === 'USD') return usd
  if (currency === 'INR') return Math.max(1, Math.round(usd * 6))
  return Math.max(1, Math.round(usd * (currency === 'GBP' ? 0.8 : 1.3)))
}

/** Large round amounts (budgets, projects) — rounds to a figure a trustee would quote. */
export function locBig(usd: number, currency: CurrencyCode): number {
  const f = currency === 'USD' ? 1 : currency === 'INR' ? 60 : currency === 'GBP' ? 0.8 : 1.3
  const v = usd * f
  const step = v >= 1_000_000 ? 50_000 : v >= 100_000 ? 5_000 : v >= 10_000 ? 500 : 50
  return Math.round(v / step) * step
}

/** `Staff.id` of every priest at a temple, chief priest first. */
export const priestIdsOf = (p: TempleProfile): string[] =>
  p.priests.map((_, i) => (i === 0 ? `usr_priest${tag(p)}` : `stf${tag(p)}_${String(i + 1).padStart(4, '0')}`))
