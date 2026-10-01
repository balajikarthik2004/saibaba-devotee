import type {
  PujaReadiness,
  PujaRequirementSheet,
  RequirementEvent,
  RequirementLine,
  StockItem,
  StockMovement,
} from '../types'
import { addDays, iso, id as mkId, offsetISO, rng, today, type Rand } from './seed'
import { PUJA_BY_ID, pujaIdFor } from './catalog'
import { BOOKINGS, OCCURRENCES } from './bookings'
import { PROFILES, locCost, tag } from './profiles'
import type { TempleProfile } from './profiles'

/**
 * The temple stores, seeded — one per temple.
 *
 * Two things had to be true of this seed for the feature to be demonstrable rather than
 * merely present. First, the ledger and the item master must *agree*: `onHand` is never a
 * typed-in number, it is the balance the movements arrive at. A store screen whose
 * running total disagrees with its own history is the one bug a store keeper will spot in
 * about four seconds.
 *
 * Second, the shelf has to be in proportion to the pujas actually booked, and the
 * shortfalls have to be real ones. Both come from `sizeStore()` below, which reads the
 * demand the booking seed generates and opens the store against it — comfortably for most
 * items, deliberately short for three.
 *
 * The order of the file follows that dependency and cannot be shuffled: items, then
 * sheets, then the sizing pass, then the ledger that lands on the sized figures.
 */

/**
 * How far ahead the seed sizes the store for.
 *
 * Matches `READINESS_WINDOW_DAYS` in `api.ts` — stated here rather than imported because
 * the mock layer must not depend on the API layer that reads it.
 */
const READINESS_SEED_WINDOW_DAYS = 2

interface ItemSpec {
  name: string
  category: StockItem['category']
  unit: StockItem['unit']
  reorderLevel: number
  /** USD per unit; localised per temple with `locCost`. */
  unitCost: number
  storage: string
  perishable: boolean
}

/* Priced in whole units of the temple's currency per unit, per the `Money` convention. */
const ITEM_SPECS: ItemSpec[] = [
  // Flowers — bought fresh, never stocked deep. The perishables are what go short.
  { name: 'Rose garland', category: 'flowers', unit: 'pc', reorderLevel: 12, unitCost: 14, storage: 'Cold room, rack A', perishable: true },
  { name: 'Jasmine string', category: 'flowers', unit: 'metre', reorderLevel: 20, unitCost: 6, storage: 'Cold room, rack A', perishable: true },
  { name: 'Tulsi leaves', category: 'flowers', unit: 'bunch', reorderLevel: 8, unitCost: 3, storage: 'Cold room, rack B', perishable: true },
  { name: 'Marigold loose', category: 'flowers', unit: 'kg', reorderLevel: 5, unitCost: 9, storage: 'Cold room, rack B', perishable: true },
  { name: 'Lotus', category: 'flowers', unit: 'pc', reorderLevel: 10, unitCost: 8, storage: 'Cold room, rack A', perishable: true },

  // Fruits and naivedya.
  { name: 'Coconut', category: 'fruits', unit: 'pc', reorderLevel: 24, unitCost: 2, storage: 'Store room, bin 1', perishable: false },
  { name: 'Banana', category: 'fruits', unit: 'kg', reorderLevel: 8, unitCost: 4, storage: 'Store room, bin 2', perishable: true },
  { name: 'Peda (sweets for naivedya)', category: 'fruits', unit: 'kg', reorderLevel: 5, unitCost: 14, storage: 'Cold room, rack C', perishable: true },

  // Dairy — the abhishekam dravyams, and the ones that move fastest.
  { name: 'Cow ghee (100 ml)', category: 'dairy', unit: 'packet', reorderLevel: 20, unitCost: 3, storage: 'Store room, shelf 2', perishable: false },
  { name: 'Milk', category: 'dairy', unit: 'l', reorderLevel: 10, unitCost: 3, storage: 'Cold room, shelf 1', perishable: true },
  { name: 'Curd', category: 'dairy', unit: 'l', reorderLevel: 6, unitCost: 4, storage: 'Cold room, shelf 1', perishable: true },
  { name: 'Honey (100 ml)', category: 'dairy', unit: 'packet', reorderLevel: 10, unitCost: 2, storage: 'Store room, shelf 2', perishable: false },

  // Grains and the annadanam side.
  { name: 'Raw rice', category: 'grains', unit: 'kg', reorderLevel: 25, unitCost: 3, storage: 'Store room, bin 4', perishable: false },
  { name: 'Jaggery', category: 'grains', unit: 'kg', reorderLevel: 8, unitCost: 5, storage: 'Store room, shelf 3', perishable: false },
  { name: 'Sesame seeds', category: 'grains', unit: 'kg', reorderLevel: 4, unitCost: 7, storage: 'Store room, shelf 3', perishable: false },

  // Dravyam and the archana consumables.
  { name: 'Kumkum (25 g)', category: 'dravyam', unit: 'packet', reorderLevel: 20, unitCost: 1, storage: 'Shrine cupboard', perishable: false },
  { name: 'Udi — sacred ash (25 g)', category: 'dravyam', unit: 'packet', reorderLevel: 30, unitCost: 2, storage: 'Shrine cupboard', perishable: false },
  { name: 'Sandal paste (25 g)', category: 'dravyam', unit: 'packet', reorderLevel: 12, unitCost: 3, storage: 'Shrine cupboard', perishable: false },
  { name: 'Camphor', category: 'dravyam', unit: 'packet', reorderLevel: 10, unitCost: 4, storage: 'Shrine cupboard', perishable: false },
  { name: 'Agarbatti', category: 'dravyam', unit: 'packet', reorderLevel: 12, unitCost: 3, storage: 'Shrine cupboard', perishable: false },

  // Cloth and lamps — slow-moving, but a festival empties them.
  { name: 'Silk chadar', category: 'cloth', unit: 'pc', reorderLevel: 4, unitCost: 45, storage: 'Locked almirah', perishable: false },
  { name: 'Kafni cloth', category: 'cloth', unit: 'pc', reorderLevel: 6, unitCost: 18, storage: 'Locked almirah', perishable: false },
  { name: 'Lamp oil', category: 'lamp', unit: 'l', reorderLevel: 12, unitCost: 6, storage: 'Store room, bin 6', perishable: false },
  { name: 'Cotton wick', category: 'lamp', unit: 'packet', reorderLevel: 15, unitCost: 2, storage: 'Store room, bin 6', perishable: false },
]

let stockCounter = 0

function buildStockItemsFor(p: TempleProfile): StockItem[] {
  const now = iso(today())
  return ITEM_SPECS.map((s) => {
    stockCounter++
    return {
      id: mkId('stk', stockCounter),
      templeId: p.id,
      currency: p.currency,
      name: s.name,
      category: s.category,
      unit: s.unit,
      // Filled in by `sizeStore()` once the sheets exist and real demand is known.
      onHand: 0,
      reorderLevel: s.reorderLevel,
      unitCost: locCost(s.unitCost, p.currency),
      storage: s.storage,
      perishable: s.perishable,
      active: true,
      updatedAt: now,
    }
  })
}

export const STOCK_ITEMS: StockItem[] = PROFILES.flatMap((p) => buildStockItemsFor(p))
export const STOCK_BY_ID = new Map(STOCK_ITEMS.map((s) => [s.id, s]))

/** Item by name within one temple's store. */
export const stockItemByName = (templeId: string, name: string): StockItem | undefined =>
  STOCK_ITEMS.find((s) => s.templeId === templeId && s.name === name)

/** The flagship's items by name — kept for screens that predate multi-temple. */
export const STOCK_BY_NAME = new Map(
  STOCK_ITEMS.filter((s) => s.templeId === PROFILES[0]!.id).map((s) => [s.name, s]),
)

export const STOCK_CATEGORY_LABELS: Record<StockItem['category'], string> = {
  flowers: 'Flowers',
  fruits: 'Fruits & naivedya',
  dairy: 'Dairy & dravyam',
  grains: 'Grains & provisions',
  dravyam: 'Archana consumables',
  cloth: 'Cloth & vastram',
  lamp: 'Lamps & oil',
  other: 'Other',
}

export const STOCK_UNITS: StockItem['unit'][] = ['pc', 'kg', 'g', 'l', 'ml', 'bunch', 'packet', 'metre']

/* ------------------------------------------------------------- requirement sheets */

/** Item name → quantity per performance. Names resolve to ids at build time. */
type LineSpec = [name: string, qty: number, optional?: boolean]

const GHEE = 'Cow ghee (100 ml)'
const HONEY = 'Honey (100 ml)'
const KUMKUM = 'Kumkum (25 g)'
const UDI = 'Udi — sacred ash (25 g)'
const SANDAL = 'Sandal paste (25 g)'
const PEDA = 'Peda (sweets for naivedya)'

/**
 * What each puja actually consumes, per performance, keyed by catalogue template.
 *
 * These are the priest's lists, not an accountant's — an abhishekam is heavy on milk,
 * honey and ghee, a festival puja on flowers, cloth and naivedya. The quantities are
 * what make the readiness screen interesting: the Thursday puja runs weekly and wants
 * lotus and marigold, of which the store is seeded short.
 */
const SHEET_SPECS: Record<string, LineSpec[]> = {
  thursday: [
    ['Marigold loose', 1],
    ['Rose garland', 2],
    ['Coconut', 2],
    [PEDA, 1],
    [GHEE, 2],
    [UDI, 2],
    ['Camphor', 1],
    ['Agarbatti', 1, true],
  ],
  kakad: [
    ['Rose garland', 1],
    [GHEE, 2],
    ['Cotton wick', 2],
    ['Camphor', 1],
    ['Milk', 1],
    ['Agarbatti', 1, true],
  ],
  madhyan: [
    [PEDA, 2],
    ['Banana', 2],
    ['Rose garland', 1],
    ['Raw rice', 2],
    ['Camphor', 1],
    ['Coconut', 1],
  ],
  dhoop: [
    ['Jasmine string', 3],
    ['Lamp oil', 1],
    ['Cotton wick', 3],
    ['Camphor', 1],
    ['Agarbatti', 2],
  ],
  shej: [
    ['Rose garland', 1],
    ['Milk', 1],
    ['Cotton wick', 2],
    ['Camphor', 1],
    ['Agarbatti', 1],
    ['Jasmine string', 2, true],
  ],
  abhishekam: [
    ['Milk', 5],
    ['Curd', 1],
    [HONEY, 2],
    [SANDAL, 4],
    [UDI, 3],
    ['Rose garland', 3],
    ['Kafni cloth', 1],
    [GHEE, 3],
    ['Coconut', 3],
  ],
  saptah: [
    ['Marigold loose', 1],
    ['Coconut', 2],
    [PEDA, 2],
    ['Agarbatti', 2],
    ['Cotton wick', 3],
    ['Lamp oil', 2],
    ['Rose garland', 2],
  ],
  guru: [
    ['Rose garland', 8],
    ['Marigold loose', 3],
    ['Silk chadar', 2],
    ['Coconut', 12],
    [PEDA, 5],
    [GHEE, 8],
    ['Milk', 5],
    [HONEY, 3],
    [UDI, 6],
    [SANDAL, 5],
    ['Lamp oil', 4],
    ['Cotton wick', 4],
    ['Kafni cloth', 4, true],
  ],
  ramnavami: [
    ['Rose garland', 6],
    ['Jasmine string', 6],
    ['Tulsi leaves', 3],
    ['Coconut', 10],
    ['Jaggery', 3],
    ['Banana', 4],
    [GHEE, 5],
    ['Milk', 4],
    ['Raw rice', 5],
    ['Lamp oil', 3],
  ],
  datta: [
    ['Marigold loose', 2],
    ['Coconut', 3],
    ['Jaggery', 2],
    [GHEE, 3],
    [UDI, 3],
    ['Camphor', 2],
    ['Tulsi leaves', 2],
  ],
  vijayadashami: [
    ['Rose garland', 10],
    ['Marigold loose', 4],
    ['Silk chadar', 2],
    ['Coconut', 14],
    [PEDA, 6],
    [GHEE, 9],
    ['Milk', 6],
    [HONEY, 3],
    [UDI, 8],
    [SANDAL, 5],
    ['Lamp oil', 5],
    ['Cotton wick', 5],
    ['Kafni cloth', 4, true],
  ],
  vratam: [
    ['Rose garland', 2],
    ['Coconut', 3],
    [PEDA, 2],
    [KUMKUM, 2],
    ['Raw rice', 2],
    ['Banana', 3],
    ['Camphor', 1],
  ],
}

/** Sheet order: 0–7 approved, 8–9 with finance, 10 with the administrator, 11 a draft. */
const SHEET_KEYS = [
  'thursday',
  'kakad',
  'madhyan',
  'dhoop',
  'shej',
  'abhishekam',
  'saptah',
  'guru',
  'ramnavami',
  'datta',
  'vijayadashami',
  'vratam',
]

function linesFrom(templeId: string, specs: LineSpec[]): RequirementLine[] {
  return specs.flatMap(([name, qty, optional]) => {
    const item = stockItemByName(templeId, name)
    // A spec naming an item that does not exist is a seed bug, not a runtime state —
    // dropping it keeps the app up and the missing line is visible on the sheet.
    if (!item) return []
    return [
      {
        itemId: item.id,
        label: item.name,
        unit: item.unit,
        qty,
        unitCost: item.unitCost,
        optional,
      },
    ]
  })
}

export const costOfLines = (lines: RequirementLine[]) =>
  lines.reduce((sum, l) => sum + l.qty * l.unitCost, 0)

const evt = (
  action: RequirementEvent['action'],
  actorId: string,
  actorName: string,
  actorRole: RequirementEvent['actorRole'],
  daysAgo: number,
  note?: string,
): RequirementEvent => ({
  at: offsetISO(-daysAgo, 10 + (daysAgo % 6)),
  actorId,
  actorName,
  actorRole,
  action,
  note,
})

let sheetCounter = 0

/**
 * Sheets seeded across every stage, so each desk opens onto a queue with work in it.
 *
 * Eight are approved and in force, two sit with accounts, one is with the administrator
 * and one is a draft the priest has not sent yet. The distribution is the point: an
 * approvals screen that is empty on first load reads as broken rather than as calm.
 */
function buildSheetsFor(p: TempleProfile): PujaRequirementSheet[] {
  const sheets: PujaRequirementSheet[] = []
  const t = tag(p)
  const PRIEST = { id: `usr_priest${t}`, name: p.priests[0]!.name }
  const FINANCE = { id: `usr_finance${t}`, name: p.finance.name }
  const ADMIN = { id: `usr_admin${t}`, name: p.admin.name }

  const present = SHEET_KEYS.filter((k) => pujaIdFor(p.id, k))

  present.forEach((key, index) => {
    const pujaId = pujaIdFor(p.id, key)!
    const lines = linesFrom(p.id, SHEET_SPECS[key]!)
    const estimate = costOfLines(lines)

    const stage: PujaRequirementSheet['stage'] =
      index <= 7 ? 'approved' : index <= 9 ? 'finance-review' : index === 10 ? 'admin-review' : 'draft'

    const history: RequirementEvent[] = [evt('drafted', PRIEST.id, PRIEST.name, 'priest', 40 + index)]
    let allocatedAmount: number | undefined
    let allocationNote: string | undefined

    if (stage !== 'draft') {
      history.push(evt('submitted', PRIEST.id, PRIEST.name, 'priest', 34 + index))
    }
    if (stage === 'approved' || stage === 'admin-review') {
      // Accounts round up to a working figure and say why — the note is the whole
      // point of the allocation step, and a seed without one teaches nothing.
      const step = p.currency === 'INR' ? 50 : 5
      allocatedAmount = Math.max(estimate, Math.ceil((estimate * 1.08) / step) * step)
      allocationNote =
        allocatedAmount > estimate
          ? 'Rounded up to cover market variation on flowers and ghee.'
          : 'Allocated at the costed estimate.'
      history.push(evt('allocated', FINANCE.id, FINANCE.name, 'finance', 26 + index, allocationNote))
    }
    if (stage === 'approved') {
      history.push(evt('approved', ADMIN.id, ADMIN.name, 'admin', 18 + index))
    }

    sheetCounter++
    sheets.push({
      id: mkId('req', sheetCounter),
      templeId: p.id,
      pujaCatalogId: pujaId,
      version: 1,
      lines,
      estimatedCost: estimate,
      allocatedAmount,
      allocationNote,
      stage,
      history,
      preparedById: PRIEST.id,
      preparedByName: PRIEST.name,
      createdAt: offsetISO(-(40 + index), 9),
      updatedAt: history[history.length - 1]!.at,
    })
  })

  // One sheet that has been round the loop — sent back by accounts, revised, and is
  // now back with them. Without it the timeline component never shows a `sent-back`
  // rail in the seed, which is the entry a reviewer most wants to see rendered.
  const revised = sheets.find((s) => s.pujaCatalogId === pujaIdFor(p.id, 'ramnavami'))
  if (revised && revised.stage === 'finance-review') {
    revised.history.splice(
      2,
      0,
      evt(
        'sent-back',
        FINANCE.id,
        FINANCE.name,
        'finance',
        30,
        'Twelve coconuts and eight packets of ghee look high against last year’s usage — please recheck.',
      ),
      evt('resubmitted', PRIEST.id, PRIEST.name, 'priest', 28, 'Rechecked against last year’s register; the quantities are correct.'),
    )
  }

  return sheets
}

export const REQUIREMENT_SHEETS: PujaRequirementSheet[] = PROFILES.flatMap((p) => buildSheetsFor(p))

/* ------------------------------------------------------------ sizing the store */

/**
 * Opening stock, derived from what the booked pujas actually consume.
 *
 * Hand-picked opening figures were wrong in a way that only showed up on screen: the
 * booking seed materialises something like twenty pujas across the readiness window, the
 * readiness check spends stock down cumulatively as it walks that window, and a shelf
 * sized by eye left almost every row red. A store screen where everything is short says
 * nothing about anything.
 *
 * So the shelf is sized from the demand the rest of the seed generates. Most items open
 * at a comfortable multiple of it; the three named below open deliberately short, which
 * is what gives the readiness screen something real to be red about on the first load.
 */

/** Opened deliberately short, so the shortfall path is exercised by the seed itself. */
const SEEDED_SHORT = new Set(['Lotus', 'Sesame seeds', SANDAL])

/** Opened just under the reorder mark — low, but not yet stopping anything. */
const SEEDED_LOW = new Set([GHEE, 'Jasmine string'])

function sizeStore(p: TempleProfile) {
  const approved = new Map(
    REQUIREMENT_SHEETS.filter((s) => s.templeId === p.id && s.stage === 'approved').map((s) => [
      s.pujaCatalogId,
      s,
    ]),
  )
  const pujaOfBooking = new Map(
    BOOKINGS.filter((b) => b.templeId === p.id).map((b) => [b.id, b.pujaCatalogId]),
  )

  // The same window the readiness screen reads, so the two are sized against each other.
  const from = today().getTime()
  const to = addDays(today(), READINESS_SEED_WINDOW_DAYS).getTime()

  const demand = new Map<string, number>()
  for (const o of OCCURRENCES) {
    const pujaId = pujaOfBooking.get(o.bookingId)
    if (!pujaId) continue
    const when = new Date(o.scheduledAt).getTime()
    if (o.status !== 'scheduled' || when < from || when > to) continue
    const sheet = approved.get(pujaId)
    if (!sheet) continue
    for (const l of sheet.lines) demand.set(l.itemId, (demand.get(l.itemId) ?? 0) + l.qty)
  }

  for (const item of STOCK_ITEMS.filter((x) => x.templeId === p.id)) {
    const needed = demand.get(item.id) ?? 0

    // Nothing in the window wants it — the authored reorder level is the whole story,
    // and a comfortable multiple of it is as good an opening figure as any.
    if (needed === 0) {
      item.onHand = Math.round(item.reorderLevel * 1.6)
      continue
    }

    // The reorder level follows demand too. A level of 12 garlands against a window
    // that consumes 40 would mark the shelf "fine" right up to the morning it runs out.
    item.reorderLevel = Math.max(item.reorderLevel, Math.ceil(needed * 0.5))

    const factor = SEEDED_SHORT.has(item.name) ? 0.45 : SEEDED_LOW.has(item.name) ? 0.95 : 1.45
    item.onHand = Math.max(1, Math.round(needed * factor))
  }
}
for (const p of PROFILES) sizeStore(p)

/**
 * Six weeks of ledger, ending at exactly the `onHand` each item is seeded with.
 *
 * Built backwards: the balance is walked from today's figure back through a plausible
 * run of receipts and issues, then the whole list is reversed so it reads forwards with
 * a correct running balance. Building it forwards from a guessed opening figure would
 * mean the two ends never quite meeting, which is the one thing this ledger cannot do.
 */
function buildMovements(): StockMovement[] {
  const rows: StockMovement[] = []
  const base = today()
  let n = 0

  for (const p of PROFILES) {
    const r = rng(90210 + p.index * 7)
    const keeper = p.admin.name
    const priest = p.priests[0]!.name

    for (const item of STOCK_ITEMS.filter((x) => x.templeId === p.id)) {
      // Perishables turn over weekly; provisions are bought in bulk far less often.
      const steps = item.perishable ? 9 : 5
      let balance = item.onHand
      const back: StockMovement[] = []

      for (let s = 0; s < steps; s++) {
        const daysAgo = 3 + s * (item.perishable ? 4 : 8) + Math.floor(r() * 3)
        // Alternating so the ledger reads as a real rhythm: buy a lot, spend it down.
        const isReceipt = s % 2 === 1
        const magnitude = Math.max(1, Math.round(item.reorderLevel * (0.3 + r() * 0.7)))
        const qty = isReceipt ? magnitude : -Math.max(1, Math.round(magnitude * 0.6))

        back.push({
          id: mkId('mov', ++n),
          itemId: item.id,
          kind: isReceipt ? 'received' : 'issued',
          qty,
          balance,
          note: isReceipt ? 'Purchased for the store' : 'Issued to the shrine',
          actorName: isReceipt ? keeper : priest,
          at: iso(addDays(base, -daysAgo)),
        })
        // Step back to what the balance must have been *before* this movement.
        balance -= qty
      }

      // One opening line so the earliest balance in the ledger has a stated origin
      // rather than appearing out of nowhere.
      back.push({
        id: mkId('mov', ++n),
        itemId: item.id,
        kind: 'adjusted',
        qty: balance,
        balance,
        note: 'Opening stock count',
        actorName: keeper,
        at: iso(addDays(base, -60)),
      })

      rows.push(...back.reverse())
    }
  }

  return rows.sort((a, b) => a.at.localeCompare(b.at))
}

export const STOCK_MOVEMENTS: StockMovement[] = buildMovements()

/**
 * A handful of readiness sign-offs already on the board.
 *
 * Only for occurrences inside the next two days, and only where the puja behind the
 * occurrence has an approved sheet — seeding a confirmation against a sheet that was
 * never approved would put the screen into a state its own rules cannot produce.
 */
function buildReadiness(): PujaReadiness[] {
  const approved = new Set(
    REQUIREMENT_SHEETS.filter((s) => s.stage === 'approved').map((s) => s.pujaCatalogId),
  )
  const booking = new Map(BOOKINGS.map((b) => [b.id, b]))
  const horizon = addDays(today(), 2).getTime()
  const rows: PujaReadiness[] = []
  let n = 0
  const r: Rand = rng(4242)

  for (const o of OCCURRENCES) {
    const when = new Date(o.scheduledAt).getTime()
    if (when < today().getTime() || when > horizon) continue
    if (o.status !== 'scheduled') continue

    const b = booking.get(o.bookingId)
    if (!b || !approved.has(b.pujaCatalogId)) continue

    // The seed signs off roughly half of what is in the window, so the priest's
    // worklist opens with both settled rows and rows still asking for a decision.
    if (r() > 0.5) continue

    const p = PROFILES.find((x) => x.id === b.templeId) ?? PROFILES[0]!
    rows.push({
      id: mkId('rdy', ++n),
      occurrenceId: o.id,
      status: 'confirmed',
      byId: `usr_priest${tag(p)}`,
      byName: p.priests[0]!.name,
      at: offsetISO(-1, 8),
      movementIds: [],
    })
  }

  return rows
}

export const PUJA_READINESS: PujaReadiness[] = buildReadiness()

/** Sheets that are in force right now, one per puja — what a readiness check reads. */
export const approvedSheetFor = (
  sheets: PujaRequirementSheet[],
  pujaCatalogId: string,
): PujaRequirementSheet | undefined =>
  sheets.find((s) => s.pujaCatalogId === pujaCatalogId && s.stage === 'approved')

/** Puja name for a sheet, for screens that list sheets without loading the catalogue. */
export const pujaNameFor = (pujaCatalogId: string) =>
  PUJA_BY_ID.get(pujaCatalogId)?.name ?? 'Unknown puja'
