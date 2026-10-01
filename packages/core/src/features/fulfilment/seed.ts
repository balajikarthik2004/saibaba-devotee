import type {
  Address,
  AnnadanamDrive,
  CountryCode,
  CurrencyCode,
  ShipmentStatus,
  ShopItem,
} from '../../types.sai'
import { TEMPLES } from '../../mock/temple'
import { addDays, festivalISO, iso, today } from '../../mock/seed'
import { USERS } from '../../mock/users'
import { computeQuote } from './shipping'
import type { FulfilmentOrder, FulfilmentPledge } from './types'

/* ------------------------------------------------------------------ shop */

const PRICES: Record<CurrencyCode, number[]> = {
  USD: [5, 21, 15, 25, 12, 8],
  INR: [100, 351, 250, 450, 200, 120],
  GBP: [4, 18, 12, 20, 10, 7],
  CAD: [7, 28, 20, 32, 16, 11],
}

export function buildShopItems(): ShopItem[] {
  const out: ShopItem[] = []
  for (const t of TEMPLES) {
    const p = PRICES[t.currency]
    const all = t.shipsTo
    const domestic = all.filter((c) => c === t.country)
    const mk = (
      n: number,
      key: ShopItem['key'],
      name: string,
      description: string,
      price: number,
      weightGrams: number,
      shipsTo: CountryCode[],
      stock: number | null,
    ): ShopItem => ({
      id: `shp_${t.slug}_${n}`,
      templeId: t.id,
      key,
      name,
      description,
      price,
      currency: t.currency,
      weightGrams,
      shipsTo,
      active: true,
      stock,
    })
    out.push(
      mk(1, 'udi', 'Udi packet (sacred ash)', 'Sealed packet of udi from the temple dhuni, blessed after the daily aarti.', p[0]!, 30, all, null),
      mk(2, 'prasad-box', 'Prasad box (dry sweets)', 'A small box of dry, long-keeping prasad sweets. No fresh or perishable items.', p[1]!, 450, domestic, 40),
      mk(3, 'book', 'Shri Sai Satcharitra (paperback)', 'The classic life of Sai Baba, in a readable paperback edition for daily or weekly reading.', p[2]!, 480, all, 25),
      mk(4, 'photo', 'Framed photo of Baba (8×10 in)', 'A simple framed picture for the home altar. Photo placeholder in this demo.', p[3]!, 700, all, 3),
      mk(5, 'other', 'Japa mala', 'A 108-bead wooden mala for chanting “Om Sai Ram”.', p[4]!, 90, all, 60),
      mk(6, 'other', 'Dhoop sticks (pack of 20)', 'Gentle sandal-scented incense for the evening lamp. Shipped domestically only.', p[5]!, 120, domestic, 100),
    )
  }
  return out
}

/* ---------------------------------------------------------------- orders */

const SAMPLE_ADDR: Record<CountryCode, Omit<Address, 'name' | 'phone'>> = {
  US: { line1: '12 Sample Street', city: 'Houston', region: 'TX', postcode: '77001', country: 'US' },
  CA: { line1: '4 Demo Crescent', city: 'Mississauga', region: 'ON', postcode: 'L5B 1A1', country: 'CA' },
  IN: { line1: 'Flat 5, Demo Apartments', city: 'Pune', region: 'Maharashtra', postcode: '411001', country: 'IN' },
  GB: { line1: '8 Example Road', city: 'Harrow', region: 'Greater London', postcode: 'HA1 1AA', country: 'GB' },
}

const NAMES = ['Anita Demo', 'Ravi Sample', 'Meera Example', 'Kiran Placeholder', 'Sunil Mock', 'Lata Test', 'Arjun Demo', 'Divya Sample']

interface OrderSpec {
  status: ShipmentStatus
  ageDays: number
  dest: CountryCode
  lines: [number, number][] // [item index 1-based, qty]
  carrier?: string
  tracking?: string
  holdNote?: string
}

/** Specs are per-origin-country; flagship (US) gets the full spread. */
const SPEC_US: OrderSpec[] = [
  { status: 'placed', ageDays: 0, dest: 'US', lines: [[1, 2]] },
  { status: 'paid', ageDays: 1, dest: 'US', lines: [[1, 1], [3, 1]] },
  { status: 'paid', ageDays: 7, dest: 'US', lines: [[2, 1], [5, 1]] },
  { status: 'packed', ageDays: 3, dest: 'US', lines: [[3, 2]] },
  { status: 'shipped', ageDays: 5, dest: 'US', lines: [[1, 3], [5, 1]], carrier: 'USPS', tracking: '9400111899223856928499' },
  { status: 'shipped', ageDays: 6, dest: 'CA', lines: [[1, 1], [3, 1]], carrier: 'UPS', tracking: '1Z999AA10123456784' },
  { status: 'delivered', ageDays: 14, dest: 'US', lines: [[4, 1]], carrier: 'FedEx', tracking: '123456789012' },
  {
    status: 'held-customs',
    ageDays: 12,
    dest: 'CA',
    lines: [[1, 2], [5, 1]],
    carrier: 'USPS',
    tracking: '9205590164917312751089',
    holdNote: 'Carrier reports the parcel is awaiting customs review. The temple is following up.',
  },
  { status: 'cancelled', ageDays: 9, dest: 'US', lines: [[3, 1]] },
]

const SPEC_OTHER: OrderSpec[] = [
  { status: 'paid', ageDays: 5, dest: 'US', lines: [[1, 1]] },
  { status: 'shipped', ageDays: 4, dest: 'US', lines: [[3, 1], [1, 1]], carrier: 'USPS', tracking: '9400100000000000000001' },
]

const STATUS_CHAIN: ShipmentStatus[] = ['placed', 'paid', 'packed', 'shipped', 'delivered']

export function buildOrders(items: ShopItem[]): FulfilmentOrder[] {
  const out: FulfilmentOrder[] = []
  let n = 0
  const byId = new Map(items.map((i) => [i.id, i]))
  for (const t of TEMPLES) {
    const specs = t.id === TEMPLES[0]!.id ? SPEC_US : SPEC_OTHER
    specs.forEach((s, idx) => {
      // Non-flagship temples use their own first shipping destination.
      const dest = t.id === TEMPLES[0]!.id ? s.dest : (t.shipsTo[0] ?? t.country)
      const tItems = items.filter((i) => i.templeId === t.id)
      const lines = s.lines
        .map(([k, q]) => ({ item: tItems[k - 1], qty: q }))
        .filter((l): l is { item: ShopItem; qty: number } => !!l.item)
      const quote = computeQuote(
        t,
        dest,
        lines.map((l) => ({ itemId: l.item.id, qty: l.qty })),
        { get: (id) => byId.get(id) },
      )
      const subtotal = lines.reduce((a, l) => a + l.item.price * l.qty, 0)
      const fee = quote.ok ? quote.fee : 0
      n += 1
      const created = addDays(today(), -s.ageDays)
      created.setHours(10 + (idx % 6), 15, 0, 0)
      const at = (plusHours: number) => iso(new Date(created.getTime() + plusHours * 3600_000))
      const events: FulfilmentOrder['events'] = []
      const chainEnd =
        s.status === 'cancelled'
          ? 0
          : s.status === 'held-customs'
            ? STATUS_CHAIN.indexOf('shipped')
            : STATUS_CHAIN.indexOf(s.status)
      for (let i = 0; i <= chainEnd; i++) {
        events.push({ at: at(i * 20), status: STATUS_CHAIN[i]!, note: i === 3 && s.carrier ? `${s.carrier} ${s.tracking ?? ''}`.trim() : undefined })
      }
      if (s.status === 'held-customs') events.push({ at: at(120), status: 'held-customs', note: s.holdNote })
      if (s.status === 'cancelled') events.push({ at: at(24), status: 'cancelled', note: 'Cancelled at the devotee’s request.' })
      const name = NAMES[(n - 1) % NAMES.length]!
      const addr = SAMPLE_ADDR[dest]
      out.push({
        id: `ord_${String(n).padStart(4, '0')}`,
        templeId: t.id,
        userId: null,
        items: lines.map((l) => ({ itemId: l.item.id, name: l.item.name, qty: l.qty, unitPrice: l.item.price })),
        address: { ...addr, name, phone: `(555) 010-${String(1000 + n).slice(-4)}` },
        subtotal,
        shippingFee: fee,
        total: subtotal + fee,
        currency: t.currency,
        status: s.status,
        carrier: s.carrier,
        tracking: s.tracking,
        paymentRef: s.status === 'placed' ? undefined : `mock_seed_${n}`,
        createdAt: iso(created),
        events,
        contactEmail: `${name.split(' ')[0]!.toLowerCase()}@example.invalid`,
        provider: t.payments[0],
        holdNote: s.holdNote,
      })
    })
  }
  // Tie a few flagship records to the first demo devotee so /my/orders has something to show.
  const demo = USERS.find((u) => u.role === 'devotee')
  if (demo) {
    for (const o of out.filter((x) => ['ord_0002', 'ord_0005', 'ord_0007'].includes(x.id))) {
      o.userId = demo.id
      o.contactEmail = demo.email
    }
  }
  return out
}

/* -------------------------------------------------------------- annadanam */

const PRICE_PER_MEAL: Record<CurrencyCode, number> = { USD: 3, INR: 40, GBP: 3, CAD: 4 }

const SVG = (label: string, hue: number) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420"><rect width="100%" height="100%" fill="hsl(${hue},55%,88%)"/><text x="50%" y="50%" text-anchor="middle" font-family="serif" font-size="26" fill="hsl(${hue},40%,30%)">${label}</text></svg>`,
  )}`

function lastThursday(minDaysAgo: number): Date {
  const d = addDays(today(), -minDaysAgo)
  while (d.getDay() !== 4) d.setDate(d.getDate() - 1)
  d.setHours(12, 0, 0, 0)
  return d
}

function nextThursday(): Date {
  const d = addDays(today(), 1)
  while (d.getDay() !== 4) d.setDate(d.getDate() + 1)
  d.setHours(12, 0, 0, 0)
  return d
}

export function buildDrives(): { drives: AnnadanamDrive[]; pledges: FulfilmentPledge[] } {
  const drives: AnnadanamDrive[] = []
  const pledges: FulfilmentPledge[] = []
  let pn = 0
  TEMPLES.forEach((t, ti) => {
    const price = PRICE_PER_MEAL[t.currency]
    const mk = (
      k: number,
      title: string,
      date: string,
      target: number,
      funded: number,
      menuNote: string,
      status: AnnadanamDrive['status'],
      report?: AnnadanamDrive['report'],
    ) => {
      const d: AnnadanamDrive = {
        id: `adr_${t.slug}_${k}`,
        templeId: t.id,
        title,
        date,
        mealsTarget: target,
        pricePerMeal: price,
        currency: t.currency,
        mealsFunded: funded,
        menuNote,
        status,
        report,
      }
      drives.push(d)
      // Split `funded` into a handful of pledges that sum exactly.
      const parts = [11, 21, 5, 51, 1, 101, 7]
      let left = funded
      let i = 0
      while (left > 0) {
        const meals = Math.min(left, parts[(i + ti + k) % parts.length]!)
        pn += 1
        const name = NAMES[pn % NAMES.length]!
        pledges.push({
          id: `plg_${String(pn).padStart(4, '0')}`,
          driveId: d.id,
          templeId: t.id,
          userId: null,
          donorName: name,
          meals,
          amount: meals * price,
          currency: t.currency,
          dedicatedTo: pn % 4 === 0 ? 'In memory of a beloved grandparent' : undefined,
          createdAt: iso(addDays(new Date(date), -(3 + (pn % 9)))),
          contactEmail: `${name.split(' ')[0]!.toLowerCase()}@example.invalid`,
        })
        left -= meals
        i += 1
      }
    }
    const scale = t.currency === 'INR' ? 2 : 1
    mk(1, 'Thursday annadanam', iso(nextThursday()), 251 * scale, 96 * scale, 'Simple vegetarian thali: rice, dal, a vegetable and a sweet. Menu set by the temple kitchen.', 'open')
    mk(2, 'Vijayadashami annadanam (Baba’s Punyatithi)', festivalISO(10, 20, 12), 501 * scale, 180 * scale, 'Festival meal for the whole community. Date confirmed by your temple.', 'open')
    mk(3, 'Datta Jayanti annadanam', festivalISO(12, 3, 12), 351 * scale, 40 * scale, 'Vegetarian festival meal. Date confirmed by your temple.', 'open')
    const past = lastThursday(10)
    mk(4, 'Thursday annadanam', iso(past), 201 * scale, 201 * scale, 'Khichdi, raita and a sweet.', 'reported', {
      mealsServed: 214 * scale,
      photos: [SVG('Serving line (demo photo)', 28), SVG('Volunteers (demo photo)', 40)],
      note: 'Thank you to everyone who gave. A few extra plates were served to late arrivals.',
      postedAt: iso(addDays(past, 1)),
    })
  })
  const demo = USERS.find((u) => u.role === 'devotee')
  if (demo) {
    // Two of the flagship pledges belong to the demo devotee.
    for (const p of pledges.filter((x) => x.templeId === TEMPLES[0]!.id).slice(0, 2)) {
      p.userId = demo.id
      p.donorName = demo.name
      p.contactEmail = demo.email
    }
  }
  return { drives, pledges }
}

