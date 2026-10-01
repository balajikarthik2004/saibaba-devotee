import type { CountryCode, CurrencyCode, ShopItem } from '../../types.sai'
import type { Temple } from '../../types'
import type { QuoteLine, RateTable, ShipTier, ShippingQuote } from './types'

/**
 * Per-origin rate tables (demo numbers, in the origin temple's own currency — never
 * converted). Tiers are by parcel weight. A missing international destination means the
 * route is not offered. Real carrier rates differ; a temple would replace this table.
 */
export const RATE_TABLES: Record<CountryCode, RateTable> = {
  US: {
    currency: 'USD',
    domestic: [
      { maxGrams: 250, fee: 5, days: [3, 6] },
      { maxGrams: 1000, fee: 8, days: [3, 6] },
      { maxGrams: 2500, fee: 12, days: [3, 7] },
    ],
    international: {
      CA: [
        { maxGrams: 250, fee: 12, days: [7, 14] },
        { maxGrams: 1000, fee: 19, days: [7, 14] },
        { maxGrams: 2500, fee: 28, days: [8, 16] },
      ],
      IN: [
        { maxGrams: 250, fee: 18, days: [10, 25] },
        { maxGrams: 1000, fee: 32, days: [10, 25] },
        { maxGrams: 2500, fee: 55, days: [12, 28] },
      ],
      GB: [
        { maxGrams: 250, fee: 16, days: [8, 18] },
        { maxGrams: 1000, fee: 28, days: [8, 18] },
        { maxGrams: 2500, fee: 48, days: [10, 21] },
      ],
    },
    extraPer500g: { domestic: 3, international: 9 },
    freeDomesticOver: 75,
  },
  IN: {
    currency: 'INR',
    domestic: [
      { maxGrams: 250, fee: 50, days: [3, 7] },
      { maxGrams: 1000, fee: 90, days: [3, 7] },
      { maxGrams: 2500, fee: 160, days: [4, 8] },
    ],
    international: {
      US: [
        { maxGrams: 250, fee: 900, days: [10, 25] },
        { maxGrams: 1000, fee: 1800, days: [10, 25] },
        { maxGrams: 2500, fee: 3400, days: [12, 28] },
      ],
      GB: [
        { maxGrams: 250, fee: 800, days: [10, 22] },
        { maxGrams: 1000, fee: 1600, days: [10, 22] },
        { maxGrams: 2500, fee: 3000, days: [12, 25] },
      ],
      CA: [
        { maxGrams: 250, fee: 900, days: [10, 25] },
        { maxGrams: 1000, fee: 1800, days: [10, 25] },
        { maxGrams: 2500, fee: 3400, days: [12, 28] },
      ],
    },
    extraPer500g: { domestic: 40, international: 600 },
    freeDomesticOver: 1500,
  },
  GB: {
    currency: 'GBP',
    domestic: [
      { maxGrams: 250, fee: 3, days: [2, 4] },
      { maxGrams: 1000, fee: 5, days: [2, 4] },
      { maxGrams: 2500, fee: 8, days: [2, 5] },
    ],
    international: {
      US: [
        { maxGrams: 250, fee: 11, days: [7, 15] },
        { maxGrams: 1000, fee: 19, days: [7, 15] },
        { maxGrams: 2500, fee: 34, days: [8, 18] },
      ],
      CA: [
        { maxGrams: 250, fee: 11, days: [7, 15] },
        { maxGrams: 1000, fee: 19, days: [7, 15] },
        { maxGrams: 2500, fee: 34, days: [8, 18] },
      ],
      IN: [
        { maxGrams: 250, fee: 12, days: [8, 20] },
        { maxGrams: 1000, fee: 21, days: [8, 20] },
        { maxGrams: 2500, fee: 38, days: [10, 22] },
      ],
    },
    extraPer500g: { domestic: 2, international: 7 },
    freeDomesticOver: 50,
  },
  CA: {
    currency: 'CAD',
    domestic: [
      { maxGrams: 250, fee: 7, days: [3, 7] },
      { maxGrams: 1000, fee: 11, days: [3, 7] },
      { maxGrams: 2500, fee: 16, days: [4, 8] },
    ],
    international: {
      US: [
        { maxGrams: 250, fee: 13, days: [6, 12] },
        { maxGrams: 1000, fee: 21, days: [6, 12] },
        { maxGrams: 2500, fee: 33, days: [7, 14] },
      ],
      IN: [
        { maxGrams: 250, fee: 24, days: [10, 25] },
        { maxGrams: 1000, fee: 42, days: [10, 25] },
        { maxGrams: 2500, fee: 70, days: [12, 28] },
      ],
      GB: [
        { maxGrams: 250, fee: 21, days: [8, 18] },
        { maxGrams: 1000, fee: 36, days: [8, 18] },
        { maxGrams: 2500, fee: 60, days: [10, 21] },
      ],
    },
    extraPer500g: { domestic: 4, international: 12 },
    freeDomesticOver: 100,
  },
}

export const COUNTRY_NAMES: Record<CountryCode, string> = {
  US: 'United States',
  IN: 'India',
  GB: 'United Kingdom',
  CA: 'Canada',
}

/** Advisory notes by item kind, for domestic and cross-border parcels. Never legal advice. */
const NOTES: Record<ShopItem['key'], { domestic?: string; international?: string }> = {
  udi: {
    domestic: 'Udi (sacred ash) is sent sealed in a small packet and is generally fine to post domestically.',
    international:
      'Sacred ash is a fine powder. Some customs offices open or hold powders, so it is declared as "religious ash". Clearance is at the destination country’s discretion.',
  },
  'prasad-box': {
    domestic: 'Dry prasad sweets only (no fresh or perishable items). Best eaten within a few weeks.',
    international:
      'Food items are commonly restricted or inspected at borders. Prasad is usually offered for domestic shipping only.',
  },
  book: {},
  photo: {},
  ring: {
    international: 'Metal items may attract import duty depending on the destination.',
  },
  other: {
    international: 'Incense, herbs, seeds or plant material can be restricted in some countries — check local rules.',
  },
}

const round = (n: number) => Math.round(n)

export function tierFor(tiers: ShipTier[], grams: number): ShipTier | null {
  return tiers.find((t) => grams <= t.maxGrams) ?? null
}

export interface QuoteCatalogue {
  get(id: string): ShopItem | undefined
}

/**
 * Pure quote calculation. `ok` is false when any line cannot go to the destination, when
 * the temple does not post there, or when there is no rate for the route. Restrictions
 * are advisory text; customs outcomes are never promised.
 */
export function computeQuote(
  temple: Temple,
  country: CountryCode,
  lines: QuoteLine[],
  catalogue: QuoteCatalogue,
  subtotalOverride?: number,
): ShippingQuote {
  const table = RATE_TABLES[temple.country]
  const domestic = country === temple.country
  const base: ShippingQuote = {
    ok: false,
    fee: 0,
    currency: table.currency as CurrencyCode,
    days: { min: 0, max: 0 },
    domestic,
    totalGrams: 0,
    restrictions: [],
    blocked: [],
  }
  if (lines.length === 0) return { ...base, reason: 'Your cart is empty.' }
  if (!temple.shipsTo.includes(country)) {
    return {
      ...base,
      reason: temple.shipsTo.length
        ? `This temple does not post to ${COUNTRY_NAMES[country]}.`
        : 'This temple does not ship parcels.',
    }
  }

  let grams = 0
  let subtotal = 0
  const notes = new Set<string>()
  for (const l of lines) {
    const item = catalogue.get(l.itemId)
    if (!item) {
      base.blocked.push({ itemId: l.itemId, name: 'Unknown item', reason: 'No longer available.' })
      continue
    }
    grams += item.weightGrams * l.qty
    subtotal += item.price * l.qty
    if (!item.shipsTo.includes(country)) {
      base.blocked.push({
        itemId: item.id,
        name: item.name,
        reason: `Not shipped to ${COUNTRY_NAMES[country]}.`,
      })
    }
    const n = NOTES[item.key]?.[domestic ? 'domestic' : 'international']
    if (n) notes.add(n)
  }
  base.totalGrams = grams
  base.restrictions = [...notes]
  if (!domestic) {
    base.restrictions.push(
      'Customs rules and duties vary and can change. The temple cannot guarantee clearance; a parcel may be delayed or held.',
    )
  }
  if (base.blocked.length) {
    return { ...base, reason: 'Some items cannot be shipped to this destination.' }
  }

  const tiers = domestic ? table.domestic : table.international[country]
  if (!tiers) return { ...base, reason: `No shipping rate is set for ${COUNTRY_NAMES[country]}.` }

  const tier = tierFor(tiers, grams)
  const last = tiers[tiers.length - 1]!
  let fee: number
  let days: [number, number]
  if (tier) {
    fee = tier.fee
    days = tier.days
  } else {
    const extra = Math.ceil((grams - last.maxGrams) / 500)
    fee = last.fee + extra * (domestic ? table.extraPer500g.domestic : table.extraPer500g.international)
    days = [last.days[0], last.days[1] + 2]
  }
  const sub = subtotalOverride ?? subtotal
  if (domestic && table.freeDomesticOver != null && sub >= table.freeDomesticOver) fee = 0
  return { ...base, ok: true, fee: round(fee), days: { min: days[0], max: days[1] } }
}

/* ---------------------------------------------------------------- tracking */

export const CARRIERS = [
  'USPS',
  'UPS',
  'FedEx',
  'DHL',
  'Royal Mail',
  'India Post',
  'Blue Dart',
  'Canada Post',
  'Delhivery',
] as const

/** Best-effort public tracking link. Null when the carrier is unknown or there is no number. */
export function trackingUrl(carrier: string | undefined, tracking: string | undefined): string | null {
  if (!carrier || !tracking) return null
  const c = carrier.trim().toLowerCase().replace(/[\s_-]+/g, '')
  const n = encodeURIComponent(tracking.trim())
  switch (c) {
    case 'usps':
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`
    case 'ups':
      return `https://www.ups.com/track?tracknum=${n}`
    case 'fedex':
      return `https://www.fedex.com/fedextrack/?trknbr=${n}`
    case 'dhl':
      return `https://www.dhl.com/global-en/home/tracking.html?tracking-id=${n}`
    case 'royalmail':
      return `https://www.royalmail.com/track-your-item#/tracking-results/${n}`
    case 'indiapost':
      return 'https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx'
    case 'bluedart':
      return `https://www.bluedart.com/tracking?trackfor=${n}`
    case 'canadapost':
      return `https://www.canadapost-postescanada.ca/track-reperage/en#/search?searchFor=${n}`
    case 'delhivery':
      return `https://www.delhivery.com/track/package/${n}`
    default:
      return null
  }
}

/* ------------------------------------------------------------ business days */

/** Whole business days (Mon–Fri) elapsed between two instants. */
export function businessDaysBetween(from: Date, to: Date): number {
  let n = 0
  const d = new Date(from)
  d.setHours(0, 0, 0, 0)
  const end = new Date(to)
  end.setHours(0, 0, 0, 0)
  while (d < end) {
    d.setDate(d.getDate() + 1)
    const w = d.getDay()
    if (w !== 0 && w !== 6) n++
  }
  return n
}

export const OVERDUE_BUSINESS_DAYS = 3
