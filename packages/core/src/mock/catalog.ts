import type { Cadence, Money, PujaAddOn, PujaCatalogItem, PujaType } from '../types'
import type { CurrencyCode } from '../types.sai'
import { PROFILES, loc } from './profiles'
import type { TempleProfile } from './profiles'

/** Offered on every recurring sponsorship. Priced in USD; `addOnsFor` localises. */
export const STANDARD_ADDONS: PujaAddOn[] = [
  {
    id: 'prasadam-post',
    label: 'Prasad & udi by post',
    blurb: 'Udi, kumkum and prasad posted to your address',
    price: 60,
  },
  {
    id: 'birthday-archana-self',
    label: 'Archana on your birthday',
    blurb: 'Offered in your name on your birthday each year',
    price: 25,
  },
  {
    id: 'birthday-archana-family',
    label: 'Archana on your family’s birthdays',
    blurb: 'Offered for each family member on their own birthday',
    price: 40,
  },
  {
    id: 'livestream-reminder',
    label: 'Livestream reminder email',
    blurb: 'An email an hour before each occurrence',
    price: 0,
  },
]

/** The add-ons a temple quotes, in its own currency. */
export const addOnsFor = (currency: CurrencyCode): PujaAddOn[] =>
  STANDARD_ADDONS.map((a) => ({ ...a, price: a.price === 0 ? 0 : loc(a.price, currency) }))

/** One puja as every temple that offers it sells it. Prices are the USD originals. */
interface Template {
  key: string
  name: string
  /** Shrine / space name, or 'Sai Baba'. Needs `shrine` present at the temple when set. */
  deity: string
  shrine?: 'datta' | 'maruti' | 'shani' | 'ganapati'
  type: PujaType
  usd: number
  durationMin: number
  cadence: Cadence
  rule: string
  description: string
  /** Direct cost as a share of the sponsorship price. */
  costRatio: number
}

/**
 * The Sai temple catalogue. Timings and rules follow widely-attested practice — Thursday
 * as Baba's day, the four daily aartis, the seven-day Sai Satcharitra parayan — and the
 * descriptions are our own paraphrase. Festival dates are confirmed by each temple.
 */
export const PUJA_TEMPLATES: Template[] = [
  {
    key: 'thursday',
    name: 'Thursday Sai Puja',
    deity: 'Sai Baba',
    type: 'yearly',
    usd: 751,
    durationMin: 45,
    cadence: 'weekly',
    rule: 'Every Thursday',
    description:
      'Baba’s own day. A weekly puja with flowers, udi and naivedya offered at the Samadhi Mandir in your family’s name, closing with aarti.',
    costRatio: 0.6,
  },
  {
    key: 'kakad',
    name: 'Kakad Aarti Sponsorship',
    deity: 'Samadhi Mandir',
    type: 'monthly',
    usd: 251,
    durationMin: 30,
    cadence: 'monthly',
    rule: 'One morning each month, on the date you choose',
    description:
      'Sponsor the dawn aarti that wakes Baba — lamps, flowers and milk naivedya offered in your family’s name.',
    costRatio: 0.5,
  },
  {
    key: 'madhyan',
    name: 'Madhyan Aarti Sponsorship',
    deity: 'Samadhi Mandir',
    type: 'monthly',
    usd: 251,
    durationMin: 30,
    cadence: 'monthly',
    rule: 'One midday each month, on the date you choose',
    description:
      'Sponsor the noon aarti and the naivedya of the day, offered with the midday meal for Baba.',
    costRatio: 0.52,
  },
  {
    key: 'dhoop',
    name: 'Dhoop Aarti Sponsorship',
    deity: 'Samadhi Mandir',
    type: 'monthly',
    usd: 201,
    durationMin: 30,
    cadence: 'monthly',
    rule: 'One sunset each month, on the date you choose',
    description: 'Sponsor the sunset lamp-offering with incense and camphor at the Samadhi Mandir.',
    costRatio: 0.48,
  },
  {
    key: 'shej',
    name: 'Shej Aarti Sponsorship',
    deity: 'Samadhi Mandir',
    type: 'monthly',
    usd: 201,
    durationMin: 30,
    cadence: 'monthly',
    rule: 'One night each month, on the date you choose',
    description:
      'Sponsor the night aarti as Baba retires for the day — a quiet, candle-lit offering with bhajans.',
    costRatio: 0.46,
  },
  {
    key: 'abhishekam',
    name: 'Sai Baba Abhishekam',
    deity: 'Samadhi Mandir',
    type: 'abhishekam',
    usd: 351,
    durationMin: 60,
    cadence: 'monthly',
    rule: 'Every Thursday morning (your chosen Thursday each month)',
    description:
      'Bathing of Baba’s murti with milk, honey, sandal and udi, followed by alankar and aarti.',
    costRatio: 0.68,
  },
  {
    key: 'saptah',
    name: 'Sai Satcharitra Saptah Parayan Sponsorship',
    deity: 'Dwarakamai',
    type: 'one-time',
    usd: 501,
    durationMin: 180,
    cadence: 'one-time',
    rule: 'Seven-day reading, offered on request',
    description:
      'Sponsor the reading of the Sai Satcharitra over seven days by the temple’s volunteers and priests, with aarti on the final evening.',
    costRatio: 0.45,
  },
  {
    key: 'guru',
    name: 'Guru Purnima Puja',
    deity: 'Sai Baba',
    type: 'yearly',
    usd: 501,
    durationMin: 150,
    cadence: 'yearly',
    rule: 'Guru Purnima, annually',
    description:
      'The festival of the Guru. Sponsors are named in the sankalp, seated near the padukas and receive prasad from the day’s annadanam.',
    costRatio: 0.85,
  },
  {
    key: 'ramnavami',
    name: 'Ram Navami Puja',
    deity: 'Dwarakamai',
    type: 'yearly',
    usd: 351,
    durationMin: 120,
    cadence: 'yearly',
    rule: 'Ram Navami, annually',
    description:
      'Celebrated at Dwarakamai with bhajans, the cradle ceremony and sweet panakam for every family who attends.',
    costRatio: 0.8,
  },
  {
    key: 'datta',
    name: 'Datta Jayanti Puja',
    deity: 'Dattatreya Shrine',
    shrine: 'datta',
    type: 'yearly',
    usd: 301,
    durationMin: 90,
    cadence: 'yearly',
    rule: 'Datta Jayanti, annually',
    description:
      'Puja and abhishekam to Sri Dattatreya on his birth festival, with Guru Charitra reading and naivedya.',
    costRatio: 0.7,
  },
  {
    key: 'vijayadashami',
    name: 'Vijayadashami (Punyatithi) Puja',
    deity: 'Samadhi Mandir',
    type: 'yearly',
    usd: 501,
    durationMin: 150,
    cadence: 'yearly',
    rule: 'Vijayadashami, annually',
    description:
      'Observed as Baba’s Punyatithi with a special puja, procession of the padukas and annadanam.',
    costRatio: 0.88,
  },
  {
    key: 'vratam',
    name: 'Sai Vratam Udyapan',
    deity: 'Sai Baba',
    type: 'one-time',
    usd: 251,
    durationMin: 90,
    cadence: 'one-time',
    rule: 'After your nine Thursdays, on request',
    description:
      'The concluding puja of the nine-Thursday vrat, with feeding of nine devotees and aarti at the Samadhi Mandir.',
    costRatio: 0.52,
  },
  {
    key: 'vastra',
    name: 'Kafni & Chadar Alankar',
    deity: 'Samadhi Mandir',
    type: 'alangaram',
    usd: 201,
    durationMin: 45,
    cadence: 'quarterly',
    rule: 'Once a quarter, on a Thursday you choose',
    description:
      'Sponsor a fresh kafni and chadar for Baba with a flower alankar before the noon aarti.',
    costRatio: 0.6,
  },
  {
    key: 'dattapuja',
    name: 'Dattatreya Puja',
    deity: 'Dattatreya Shrine',
    shrine: 'datta',
    type: 'monthly',
    usd: 151,
    durationMin: 45,
    cadence: 'monthly',
    rule: 'Every Thursday (your chosen Thursday each month)',
    description:
      'Thursday puja to Sri Dattatreya, the Guru tradition Baba is honoured within, with archana and aarti.',
    costRatio: 0.58,
  },
  {
    key: 'ganapati',
    name: 'Ganapati Puja',
    deity: 'Ganapati Shrine',
    shrine: 'ganapati',
    type: 'monthly',
    usd: 151,
    durationMin: 45,
    cadence: 'monthly',
    rule: 'Every Sankashti Chaturthi',
    description:
      'Invoke Vighneshwara before a new beginning: modak naivedya, durva archana and aarti at the Ganapati Shrine.',
    costRatio: 0.55,
  },
  {
    key: 'maruti',
    name: 'Maruti Puja',
    deity: 'Maruti Shrine',
    shrine: 'maruti',
    type: 'monthly',
    usd: 151,
    durationMin: 45,
    cadence: 'monthly',
    rule: 'Every Saturday (your chosen Saturday each month)',
    description:
      'Saturday puja to Hanuman, protector of the temple, with oil lamps, flowers and Hanuman Chalisa.',
    costRatio: 0.58,
  },
  {
    key: 'shani',
    name: 'Shani Puja',
    deity: 'Shani Shrine',
    shrine: 'shani',
    type: 'monthly',
    usd: 126,
    durationMin: 45,
    cadence: 'monthly',
    rule: 'Every Saturday (your chosen Saturday each month)',
    description:
      'Sesame-oil lamps and quiet prayer at the Shani Shrine for steadiness through hard times.',
    costRatio: 0.5,
  },
  {
    key: 'annadanam-thu',
    name: 'Thursday Annadanam Sponsorship',
    deity: 'Dwarakamai',
    type: 'one-time',
    usd: 501,
    durationMin: 240,
    cadence: 'one-time',
    rule: 'Any Thursday, on request',
    description:
      'Sponsor the free meal served to every devotee after the noon aarti — rice, dal, vegetables and sweet.',
    costRatio: 0.78,
  },
  {
    key: 'annadanam-mo',
    name: 'Monthly Annadanam Seva',
    deity: 'Dwarakamai',
    type: 'monthly',
    usd: 1001,
    durationMin: 240,
    cadence: 'monthly',
    rule: 'One Thursday every month',
    description:
      'Take on the annadanam for one Thursday every month for a year, with your family’s name read at the naivedya.',
    costRatio: 0.76,
  },
]

/** Template key → cost ratio, per puja id (filled as the catalogue is built). */
const COST_RATIO_BY_ID: Record<string, number> = {}

function buildCatalogFor(p: TempleProfile): PujaCatalogItem[] {
  const temple = p.id
  const addOns = addOnsFor(p.currency)
  const offered = PUJA_TEMPLATES.filter((t) => {
    if (t.shrine === 'datta') return p.hasDatta
    if (t.shrine === 'maruti') return p.hasMaruti
    if (t.shrine === 'shani') return p.hasShani
    return true // the Ganapati Shrine is in every temple's space list
  })
  return offered.map((t, i) => {
    const pid = p.short ? `puja_${p.short}_${String(i + 1).padStart(2, '0')}` : `puja_${String(i + 1).padStart(4, '0')}`
    COST_RATIO_BY_ID[pid] = t.costRatio
    return {
      id: pid,
      templeId: temple,
      currency: p.currency,
      name: t.name,
      deity: t.deity,
      type: t.type,
      basePrice: loc(t.usd, p.currency),
      durationMin: t.durationMin,
      defaultCadence: t.cadence,
      recurringRule: t.rule,
      description: t.description,
      addOns,
      active: true,
    } satisfies PujaCatalogItem
  })
}

/**
 * Artwork is rendered as a generated gradient tile rather than a photograph — the app
 * ships no binary assets. `imageUrl` stays on the type for the real build.
 *
 * Flagship items come first and keep the bare `puja_0001…` ids.
 */
export const PUJA_CATALOG: PujaCatalogItem[] = PROFILES.flatMap((p) => buildCatalogFor(p))

export const PUJA_BY_ID = new Map(PUJA_CATALOG.map((p) => [p.id, p]))

/** The catalogue of a single temple. */
export const catalogFor = (templeId: string): PujaCatalogItem[] =>
  PUJA_CATALOG.filter((p) => p.templeId === templeId)

/** The template key (`thursday`, `kakad` …) a seeded catalogue item was built from. */
const KEY_BY_ID = new Map<string, string>()
for (const p of PROFILES) {
  const offered = PUJA_TEMPLATES.filter((t) => {
    if (t.shrine === 'datta') return p.hasDatta
    if (t.shrine === 'maruti') return p.hasMaruti
    if (t.shrine === 'shani') return p.hasShani
    return true
  })
  offered.forEach((t, i) => {
    KEY_BY_ID.set(
      p.short ? `puja_${p.short}_${String(i + 1).padStart(2, '0')}` : `puja_${String(i + 1).padStart(4, '0')}`,
      t.key,
    )
  })
}
export const templateKeyOf = (pujaId: string): string | undefined => KEY_BY_ID.get(pujaId)

/** The puja id a template key has at a temple, if that temple offers it. */
export const pujaIdFor = (templeId: string, key: string): string | undefined =>
  PUJA_CATALOG.find((x) => x.templeId === templeId && KEY_BY_ID.get(x.id) === key)?.id

/** How many times a cadence comes round in a year. */
export const OCCURRENCES_PER_YEAR: Record<Cadence, number> = {
  daily: 365,
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  yearly: 1,
  'one-time': 1,
}

/**
 * Cost of performing this puja once — flowers, dravyam, prasad and priest time.
 *
 * `basePrice` buys a full year at the puja's *default* cadence, so the per-occurrence
 * cost is the annual cost divided by that cadence's yearly count. Most pujas run a
 * healthy margin; the big festival pujas run close to cost, and the board should see
 * that plainly rather than have it averaged away.
 */
export function unitCostOf(puja: PujaCatalogItem): Money {
  const ratio = COST_RATIO_BY_ID[puja.id] ?? 0.6
  const perYear = OCCURRENCES_PER_YEAR[puja.defaultCadence]
  return Math.round((puja.basePrice * ratio) / perYear)
}

/**
 * Cadences ordered from rarest to most frequent. A sponsorship is only offered at the
 * puja's own rhythm or one step either side of it — a temple does not sell a daily
 * Guru Purnima, and pricing a one-day annadanam as a daily endowment gives a nonsense
 * figure.
 */
export const CADENCE_LADDER: Cadence[] = [
  'one-time',
  'yearly',
  'quarterly',
  'monthly',
  'weekly',
  'daily',
]

/** The cadences a devotee may actually choose for this puja. */
export function cadenceOptions(puja: PujaCatalogItem): Cadence[] {
  const i = CADENCE_LADDER.indexOf(puja.defaultCadence)
  return CADENCE_LADDER.slice(Math.max(0, i - 1), i + 2)
}

/**
 * What a sponsorship costs at a given cadence.
 *
 * `basePrice` buys a year at the puja's default rhythm, and the price scales with how
 * many times it is actually performed. That has to stay linear: the temple really does
 * buy flowers, milk and prasad every single time, so any discount curve would put
 * frequent sponsorships permanently below direct cost. Bounding the *cadence* rather
 * than bending the *price* is what keeps the figures both honest and realistic.
 */
export function priceForCadence(puja: PujaCatalogItem, cadence: Cadence): Money {
  const ratio = OCCURRENCES_PER_YEAR[cadence] / OCCURRENCES_PER_YEAR[puja.defaultCadence]
  const step = puja.currency === 'INR' ? 50 : 5
  return Math.max(puja.basePrice, Math.round((puja.basePrice * ratio) / step) * step)
}

export const PUJA_UNIT_COST: Record<string, Money> = Object.fromEntries(
  PUJA_CATALOG.map((p) => [p.id, unitCostOf(p)]),
)

/** Shrine / deity → gradient pair, used by PujaCard in place of photography. */
export const DEITY_GRADIENT: Record<string, [string, string]> = {
  'Sai Baba': ['#a8651e', '#f2d9a4'],
  'Samadhi Mandir': ['#8a4a12', '#e3b873'],
  Dwarakamai: ['#6b3a1c', '#d8a45e'],
  Chavadi: ['#5a3a24', '#c9a06a'],
  'Lendi Baug': ['#2f6b52', '#a9c98a'],
  'Ganapati Shrine': ['#a3341f', '#e6c58a'],
  'Dattatreya Shrine': ['#7a4a10', '#e8c66a'],
  'Maruti Shrine': ['#9a3a12', '#eab267'],
  'Shani Shrine': ['#23303f', '#8a9bb0'],
}
