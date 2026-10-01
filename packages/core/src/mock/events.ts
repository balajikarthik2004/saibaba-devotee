import type { TempleEvent } from '../types'
import type { CurrencyCode } from '../types.sai'
import { PROFILES, locBig } from './profiles'
import type { TempleProfile } from './profiles'
import { addDays, festivalISO, id, int, iso, nextThursday, rng, today } from './seed'

interface EventSeed {
  key: string
  title: string
  month: number
  day: number
  endMonth?: number
  endDay?: number
  /** Fixed offset from today, for festivals whose real date is in the recent past. */
  offsetDays?: number
  /** Next Thursday plus this many weeks — the monthly Thursday specials. */
  thursdayWeeks?: number
  /** USD target. */
  target: number
  collectedPct: number
  ticketPrice?: number
  description: string
}

/**
 * The festival year of a Sai temple. Dates are seed data for the year being demoed —
 * each temple confirms the real dates against its own panchang, and the UI says so.
 */
const SEEDS: EventSeed[] = [
  {
    key: 'guru',
    title: 'Guru Purnima',
    month: 7,
    day: 29,
    offsetDays: -63,
    target: 24000,
    collectedPct: 104,
    description:
      'The festival of the Guru. Padukas puja at dawn, a day of bhajans and discourse on Baba’s teachings, and annadanam for every devotee.',
  },
  {
    key: 'ganesh',
    title: 'Ganesh Chaturthi',
    month: 9,
    day: 14,
    target: 14000,
    collectedPct: 71,
    description:
      'Clay Ganapati installation at the Ganapati Shrine, modak naivedya, archana and the community visarjan on the last evening.',
  },
  {
    key: 'navaratri',
    title: 'Navaratri Bhajan Nights',
    month: 10,
    day: 11,
    endMonth: 10,
    endDay: 19,
    target: 20000,
    collectedPct: 55,
    ticketPrice: 15,
    description:
      'Nine evenings of bhajans, garba and dandiya for families, with a short aarti and prasad each night.',
  },
  {
    key: 'vijayadashami',
    title: 'Vijayadashami — Sai Baba Punyatithi',
    month: 10,
    day: 20,
    target: 36000,
    collectedPct: 49,
    ticketPrice: 25,
    description:
      'Observed as Baba’s Punyatithi. Special puja and abhishekam, a procession of the padukas and a large annadanam.',
  },
  {
    key: 'diwali',
    title: 'Diwali Deepotsav',
    month: 11,
    day: 8,
    target: 28000,
    collectedPct: 38,
    ticketPrice: 15,
    description:
      'Rows of lamps around the mandir, a festival aarti at dusk and a sweets bazaar to raise funds for the annadanam.',
  },
  {
    key: 'datta',
    title: 'Datta Jayanti',
    month: 12,
    day: 23,
    target: 16000,
    collectedPct: 30,
    description:
      'Puja and abhishekam to Sri Dattatreya on his birth festival, with Guru Charitra reading and naivedya.',
  },
  {
    key: 'sankranti',
    title: 'Makar Sankranti',
    month: 1,
    day: 14,
    target: 9000,
    collectedPct: 35,
    description: 'Til-gul sweets for every family, a special puja and aarti to mark the turn of the season.',
  },
  {
    key: 'saptah',
    title: 'Sai Satcharitra Saptah Parayan',
    month: 1,
    day: 5,
    endMonth: 1,
    endDay: 11,
    target: 12000,
    collectedPct: 44,
    description:
      'A seven-day reading of the Sai Satcharitra by volunteers in turn, closing with aarti and prasad on the last evening.',
  },
  {
    key: 'utsav',
    title: 'Sai Baba Annual Utsav',
    month: 2,
    day: 20,
    endMonth: 2,
    endDay: 22,
    target: 30000,
    collectedPct: 41,
    ticketPrice: 20,
    description:
      'The temple’s annual celebration: a palkhi procession, abhishekam, youth programmes and a grand annadanam over three days.',
  },
  {
    key: 'ram',
    title: 'Ram Navami',
    month: 3,
    day: 26,
    target: 26000,
    collectedPct: 37,
    description:
      'Celebrated at Dwarakamai with bhajans, the cradle ceremony, a day-long reading and sweet panakam for all.',
  },
  {
    key: 'hanuman',
    title: 'Hanuman Jayanti',
    month: 4,
    day: 2,
    target: 11000,
    collectedPct: 28,
    description: 'Hanuman Chalisa recitals at the Maruti Shrine, oil lamps, and prasad for all.',
  },
  {
    key: 'vratam',
    title: 'Mass Sai Vratam Udyapan',
    month: 5,
    day: 10,
    target: 10000,
    collectedPct: 52,
    description:
      'A group puja for families concluding their nine-Thursday vrat, with nine devotees fed in each family’s name.',
  },
  {
    key: 'thu1',
    title: 'Thursday Special — Abhishekam & Annadanam',
    month: 0,
    day: 0,
    thursdayWeeks: 0,
    target: 6000,
    collectedPct: 70,
    description:
      'A special Thursday: longer abhishekam at the Samadhi Mandir, bhajans and a free meal for every devotee.',
  },
  {
    key: 'thu2',
    title: 'Thursday Special — Bhajan Evening',
    month: 0,
    day: 0,
    thursdayWeeks: 4,
    target: 6000,
    collectedPct: 25,
    description: 'A monthly evening of bhajans, aarti and annadanam on Baba’s day.',
  },
]

const PLAN: Record<string, { keys: string[]; k: number }> = {
  tmp_sugarland: { keys: SEEDS.map((s) => s.key), k: 1 },
  tmp_fremont: {
    keys: ['guru', 'ganesh', 'vijayadashami', 'diwali', 'datta', 'sankranti', 'ram', 'thu1'],
    k: 0.6,
  },
  tmp_pune: {
    keys: ['guru', 'utsav', 'ganesh', 'navaratri', 'vijayadashami', 'diwali', 'saptah', 'ram', 'hanuman', 'vratam', 'thu1'],
    k: 0.9,
  },
  tmp_hyderabad: { keys: ['guru', 'vijayadashami', 'datta', 'sankranti', 'ram', 'thu1'], k: 0.55 },
  tmp_harrow: { keys: ['guru', 'vijayadashami', 'diwali', 'ram', 'thu1'], k: 0.4 },
  tmp_mississauga: { keys: ['guru', 'vijayadashami', 'diwali', 'datta', 'ram', 'thu1'], k: 0.5 },
}

const COST_TEMPLATES: [string, number][][] = [
  [
    ['Flowers & garlands', 0.18],
    ['Priest honorarium', 0.14],
    ['Annadanam catering', 0.31],
    ['Decor & lighting', 0.12],
    ['Printing & publicity', 0.05],
  ],
  [
    ['Naivedya & prasad ingredients', 0.24],
    ['Priest honorarium', 0.16],
    ['Hall setup & rentals', 0.19],
    ['Sound & livestream', 0.09],
    ['Volunteer supplies', 0.04],
  ],
  [
    ['Abhishekam dravyam', 0.21],
    ['Annadanam catering', 0.29],
    ['Security & parking', 0.07],
    ['Decor & lighting', 0.15],
    ['Printing & publicity', 0.04],
  ],
]

/**
 * What a devotee can actually sponsor, three per festival, priced as a share of the
 * event's target so the ask scales with the occasion, then rounded to a figure a devotee
 * would recognise on a hundi slip.
 */
const SPONSORSHIP_TEMPLATES: [string, string, string, number][][] = [
  [
    ['flowers', 'Flowers & garlands', 'Fresh garlands for Baba and every shrine', 0.05],
    ['annadanam', 'Annadanam for the day', 'Free meals for every family who attends', 0.1],
    ['honorarium', 'Priest honorarium', 'Dakshina for the priests who officiate the day', 0.035],
  ],
  [
    ['prasadam', 'Prasad ingredients', 'Ghee, sugar and rice for the day’s naivedya', 0.045],
    ['decor', 'Decor & lighting', 'Mandir decoration, rangoli and the lamp array', 0.075],
    ['livestream', 'Sound & livestream', 'PA hire and the stream for families abroad', 0.03],
  ],
  [
    ['dravyam', 'Abhishekam dravyam', 'Milk, honey, sandal and udi', 0.055],
    ['annadanam', 'Annadanam for the day', 'Free meals for every family who attends', 0.1],
    ['vastram', 'Kafni & chadar', 'A fresh kafni and chadar for Baba’s alankar', 0.04],
  ],
]

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

/** A tidy figure in the temple's currency — 25s for dollars and pounds, 500s for rupees. */
const tidy = (v: number, cur: CurrencyCode, step?: number) => {
  const s = step ?? (cur === 'INR' ? 500 : 25)
  return Math.round(v / s) * s
}

function buildEventsFor(p: TempleProfile, counter: { n: number }): TempleEvent[] {
  const plan = PLAN[p.id]
  if (!plan) return []
  const r = rng(551201 + p.index * 17)
  const now = Date.now()
  const base = today()

  return plan.keys.map((key, i) => {
    const s = SEEDS.find((x) => x.key === key)!
    const date =
      s.thursdayWeeks !== undefined
        ? nextThursday(s.thursdayWeeks, 18)
        : s.offsetDays !== undefined
          ? (() => {
              const d = addDays(base, s.offsetDays)
              d.setHours(18, 0, 0, 0)
              return iso(d)
            })()
          : festivalISO(s.month, s.day, 18)
    const endDate =
      s.endMonth && s.endDay
        ? festivalISO(s.endMonth, s.endDay, 21)
        : undefined
    const startMs = new Date(date).getTime()
    const endMs = endDate ? new Date(endDate).getTime() : startMs + 86400000

    const status: TempleEvent['status'] =
      now > endMs ? 'completed' : now >= startMs ? 'ongoing' : 'upcoming'

    const target = p.currency === 'USD' ? tidy(s.target * plan.k, 'USD', 250) : locBig(s.target * plan.k, p.currency)
    const template = COST_TEMPLATES[i % COST_TEMPLATES.length]!
    const step = p.currency === 'INR' ? 1000 : 10
    const costs = template.map(([label, pct]) => ({
      label,
      amount: Math.round((target * pct) / step) * step,
    }))

    const sponsorships = SPONSORSHIP_TEMPLATES[i % SPONSORSHIP_TEMPLATES.length]!.map(
      ([k, label, blurb, pct]) => ({
        key: k,
        label,
        blurb,
        price: Math.max(p.currency === 'INR' ? 500 : 25, tidy(target * pct, p.currency)),
      }),
    )

    counter.n++
    return {
      id: id('evt', counter.n),
      templeId: p.id,
      currency: p.currency,
      title: s.title,
      slug: slugify(s.title),
      date,
      endDate,
      description: s.description,
      targetAmount: target,
      collectedAmount: Math.round((target * s.collectedPct) / 100 / (p.currency === 'INR' ? 500 : 50)) * (p.currency === 'INR' ? 500 : 50),
      costs,
      sponsorships,
      ticketPrice:
        s.ticketPrice === undefined
          ? undefined
          : p.currency === 'INR'
            ? Math.round((s.ticketPrice * 22) / 50) * 50
            : Math.round(s.ticketPrice * (p.currency === 'GBP' ? 0.8 : p.currency === 'CAD' ? 1.3 : 1)),
      rsvpCount: int(r, 24, 340),
      status,
    } satisfies TempleEvent
  })
}

const counter = { n: 0 }
export const EVENTS: TempleEvent[] = PROFILES.flatMap((p) => buildEventsFor(p, counter)).sort(
  (a, b) => a.date.localeCompare(b.date),
)

/** Lookup for the ledgers, which hold an `eventId` but need to print a title. */
export const EVENT_BY_ID = new Map(EVENTS.map((e) => [e.id, e]))
