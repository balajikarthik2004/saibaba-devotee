/**
 * The single seam between the UI and the data.
 *
 * Everything below reads and writes in-memory mock arrays. Swap the bodies for `fetch`
 * calls and the whole app moves to a real backend without touching a single screen.
 */
import type {
  ApprovalEvent,
  ApprovalStage,
  Booking,
  Donation,
  ISODate,
  DonorContact,
  FacilityBooking,
  FamilyTree,
  Membership,
  MembershipTier,
  Money,
  Project,
  PujaCatalogItem,
  PujaOccurrence,
  PujaPnLRow,
  PujaReadiness,
  PujaRequirementSheet,
  PujaType,
  Staff,
  ReadinessLine,
  ReadinessRow,
  RecurringRule,
  RequirementEvent,
  RequirementLine,
  RequirementStage,
  StaffingRow,
  StockItem,
  StockMovement,
  Temple,
  TempleEvent,
  TransparencySnapshot,
  User,
  UUID,
  Volunteer,
  VolunteerAssignment,
  VolunteerAudience,
  VolunteerCampaign,
  VolunteerChannel,
  VolunteerInvite,
  VolunteerMessage,
  VolunteerSkill,
} from './types'
import {
  BOOKINGS,
  CADENCE_DAYS,
  DONATIONS,
  EVENTS,
  EVENT_BY_ID,
  FACILITY_BOOKINGS,
  FAMILY_TREES,
  MEMBERSHIPS,
  OCCURRENCES,
  PROJECTS,
  PUJA_BY_ID,
  PUJA_CATALOG,
  OCCURRENCES_PER_YEAR,
  PUJA_READINESS,
  PUJA_UNIT_COST,
  RECURRING_RULES,
  REQUIREMENT_SHEETS,
  ALL_STAFF,
  STOCK_ITEMS,
  STOCK_MOVEMENTS,
  TEMPLE_BY_ID,
  costOfLines,
  TRANSPARENCY_BY_TEMPLE,
  USERS,
  VOLUNTEERS,
  VOLUNTEER_ASSIGNMENTS,
  VOLUNTEER_CAMPAIGNS,
  VOLUNTEER_INVITES,
  VOLUNTEER_MESSAGES,
  roleLabel,
} from './mock'
import { initialsOf } from './util'
import { contactMatches, normEmail, normPhone } from './donor'
import type { DonorIdentity } from './donor'
import { LOCAL_KEYS, readLocal, writeLocal } from './local'
import { useAuthStore } from './store/auth'
import { currentTemple, currentTempleId } from './tenant'
import { FLAGSHIP_ID } from './mock/profiles'
import { useProfileSignal } from './store/profile'

export const simulateLatency = () => new Promise((r) => setTimeout(r, 150 + Math.random() * 150))

const clone = <T>(x: T): T => structuredClone(x)

/* ------------------------------------------------------------------- tenancy */

/**
 * Temple scoping. Every record carries an optional `templeId`; one without it predates
 * multi-temple and belongs to the flagship. Reads go through `here()`, writes stamp
 * `templeOf()`. Devotee accounts are global — only the records hanging off them are
 * temple-scoped — and a query keyed on a particular devotee returns that devotee's
 * records at every temple (their own history is theirs, wherever they gave).
 */
const tidOf = (r: { templeId?: UUID }): UUID => r.templeId ?? FLAGSHIP_ID
const here = <T extends { templeId?: UUID }>(rows: readonly T[]): T[] => {
  const t = currentTempleId()
  return rows.filter((r) => tidOf(r) === t)
}
/** What every record created now is stamped with. */
const templeStamp = () => {
  const t = currentTemple()
  return { templeId: t.id, currency: t.currency }
}
const isPlatform = () => useAuthStore.getState().user?.role === 'platform'

/** Spreading `{ templeId: undefined }` over a stamp would erase it; drop undefined keys. */
const stripUndefined = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T

/** A temple with no seeded books yet (freshly onboarded) reads as an empty ledger. */
const emptySnapshot = (): TransparencySnapshot => ({
  ...templeStamp(),
  ytdCollected: 0,
  annualTarget: 0,
  balanceToBreakeven: 0,
  achievedPct: 0,
  updatedAt: new Date().toISOString(),
  allocations: [],
})

/** Requirement sheets of the temple being viewed (a sheet's temple is its puja's). */
const hereSheets = () => {
  const t = currentTempleId()
  return REQUIREMENT_SHEETS.filter(
    (s) => (s.templeId ?? PUJA_BY_ID.get(s.pujaCatalogId)?.templeId ?? FLAGSHIP_ID) === t,
  )
}

/** Bookings belonging to the temple being viewed. */
const hereBookings = () => here(BOOKINGS)
/** Ids of this temple's bookings, for scoping occurrences. */
const hereBookingIds = () => new Set(hereBookings().map((b) => b.id))

/* ------------------------------------------------------------------ identity */

export async function getCurrentUser(): Promise<User | null> {
  await simulateLatency()
  return useAuthStore.getState().user
}

export async function getTemple(): Promise<Temple> {
  await simulateLatency()
  return currentTemple()
}

/** Priests, administrators and desk staff of the temple being viewed. */
export async function listStaff(role?: Staff['role']): Promise<Staff[]> {
  await simulateLatency()
  return here(ALL_STAFF).filter((s) => (role ? s.role === role : true))
}

export async function getDevoteeById(id: UUID): Promise<User | null> {
  await simulateLatency()
  return USERS.find((u) => u.id === id) ?? null
}

export async function listDevotees(query?: {
  search?: string
  tier?: MembershipTier
  city?: string
}): Promise<User[]> {
  await simulateLatency()
  const q = query?.search?.trim().toLowerCase()
  // Devotee accounts are global, so "this temple's devotees" means those whose home is
  // here or who have given, sponsored, booked or volunteered here. Platform staff see all.
  const tid = currentTempleId()
  const active = new Set<UUID>()
  if (!isPlatform()) {
    for (const d of here(DONATIONS)) if (d.userId) active.add(d.userId)
    for (const b of hereBookings()) active.add(b.userId)
    for (const f of here(FACILITY_BOOKINGS)) active.add(f.userId)
    for (const m of here(MEMBERSHIPS)) active.add(m.userId)
    for (const v of here(VOLUNTEERS)) if (v.userId) active.add(v.userId)
  }
  return USERS.filter((u) => u.role === 'devotee')
    .filter((u) => isPlatform() || (u.homeTempleId ?? FLAGSHIP_ID) === tid || active.has(u.id))
    .filter((u) => (q ? [u.name, u.email, u.phone].some((f) => f.toLowerCase().includes(q)) : true))
    .filter((u) => (query?.city ? u.city === query.city : true))
    .filter((u) => {
      if (!query?.tier) return true
      const m = MEMBERSHIPS.find((x) => x.userId === u.id && x.status === 'active')
      return m?.tier === query.tier
    })
}

/**
 * Turns a set of contact details into a devotee record.
 *
 * The guest flow needs this to mean something: a visitor who gave as a guest and then
 * accepts "create my account" must end up on their *own* record, not resolved onto a
 * seeded one. An email or phone the temple already knows returns the existing devotee
 * instead of opening a duplicate — the same rule `findDonorByContact` reports at the
 * gate. Gifts they made as a guest still surface, because `listDonationsFor` matches on
 * contact as well as on id.
 */
export async function registerDevotee(input: {
  firstName: string
  lastName: string
  email: string
  phone: string
  city?: string
  nakshatra?: string
  gothra?: string
  country?: User['country']
  language?: User['language']
  homeTempleId?: UUID
}): Promise<User> {
  await simulateLatency()

  const existing = USERS.find(
    (u) => u.role === 'devotee' && contactMatches(u, { email: input.email, phone: input.phone }),
  )
  if (existing) return existing

  const name = `${input.firstName} ${input.lastName}`.trim()
  const user: User = {
    id: `usr_${String(USERS.length + 1).padStart(4, '0')}`,
    role: 'devotee',
    name,
    email: input.email.trim(),
    phone: input.phone.trim(),
    city: input.city?.trim() || undefined,
    country: input.country ?? currentTemple().country,
    homeTempleId: input.homeTempleId ?? currentTempleId(),
    language: input.language,
    nakshatra: input.nakshatra || undefined,
    gothra: input.gothra || undefined,
    createdAt: new Date().toISOString(),
    avatarInitials: initialsOf(name),
  }
  USERS.push(user)
  return user
}

export async function updateDevotee(id: UUID, patch: Partial<User>): Promise<User> {
  await simulateLatency()
  const u = USERS.find((x) => x.id === id)
  if (!u) throw new Error(`No such devotee: ${id}`)
  Object.assign(u, patch)
  if (useAuthStore.getState().user?.id === id) useAuthStore.getState().setUser({ ...u })
  return u
}

/**
 * Family trees the devotee has edited, replayed over the seed on first import so a
 * saved tree survives a reload. Seeded trees stay untouched until they are edited.
 */
function hydrateFamilyTrees() {
  for (const saved of readLocal<FamilyTree[]>(LOCAL_KEYS.familyTrees, [])) {
    const i = FAMILY_TREES.findIndex((f) => f.primaryUserId === saved.primaryUserId)
    if (i >= 0) FAMILY_TREES[i] = saved
    else FAMILY_TREES.push(saved)
  }
}
hydrateFamilyTrees()

export async function getFamilyTree(userId: UUID): Promise<FamilyTree | null> {
  await simulateLatency()
  return FAMILY_TREES.find((f) => f.primaryUserId === userId) ?? null
}

export async function saveFamilyTree(tree: FamilyTree): Promise<FamilyTree> {
  await simulateLatency()
  // Match on the devotee, not the tree id — the profile page mints `fam_<userId>`
  // when a devotee has no seeded tree, which would otherwise append a second tree
  // for the same person the first time they add a relative.
  const i = FAMILY_TREES.findIndex((f) => f.primaryUserId === tree.primaryUserId)
  if (i >= 0) FAMILY_TREES[i] = tree
  else FAMILY_TREES.push(tree)

  // Persist only the edited trees, not the whole seeded set.
  const edited = readLocal<FamilyTree[]>(LOCAL_KEYS.familyTrees, []).filter(
    (f) => f.primaryUserId !== tree.primaryUserId,
  )
  writeLocal(LOCAL_KEYS.familyTrees, [...edited, tree])

  // Tell anything deriving state from the tree — the completion ring, for one — that
  // its copy is now stale.
  useProfileSignal.getState().bumpFamily()

  return tree
}

/* ---------------------------------------------------------------- catalogue */

export async function getPujaCatalog(type?: PujaType): Promise<PujaCatalogItem[]> {
  await simulateLatency()
  return here(PUJA_CATALOG).filter((p) => (type ? p.type === type : true))
}

export async function getPujaById(id: UUID): Promise<PujaCatalogItem | null> {
  await simulateLatency()
  return PUJA_CATALOG.find((p) => p.id === id) ?? null
}

export async function savePujaCatalogItem(item: PujaCatalogItem): Promise<PujaCatalogItem> {
  await simulateLatency()
  const i = PUJA_CATALOG.findIndex((p) => p.id === item.id)
  if (i >= 0) {
    // An edit keeps the owning temple the item already had.
    const old = PUJA_CATALOG[i]!
    PUJA_CATALOG[i] = { ...item, templeId: old.templeId ?? item.templeId, currency: old.currency ?? item.currency }
    PUJA_BY_ID.set(item.id, PUJA_CATALOG[i]!)
    return PUJA_CATALOG[i]!
  }
  const created: PujaCatalogItem = { ...templeStamp(), ...item }
  PUJA_CATALOG.push(created)
  PUJA_BY_ID.set(created.id, created)
  return created
}

export async function deletePujaCatalogItem(id: UUID): Promise<void> {
  await simulateLatency()
  const i = PUJA_CATALOG.findIndex((p) => p.id === id)
  if (i >= 0) PUJA_CATALOG.splice(i, 1)
}

/* ----------------------------------------------------------------- bookings */

/**
 * Whether a booking's amount is money the temple can report having received.
 *
 * `cancelled` never counted. `pending` must not count either: it is a sponsorship whose
 * payment the accounts desk has not yet verified, so putting it into revenue, a P&L or a
 * tax receipt would be reporting money nobody has confirmed arrived. Every figure derived
 * from booking amounts goes through this, so the rule is stated once.
 */
export const isRealisedBooking = (b: Booking) => b.status !== 'cancelled' && b.status !== 'pending'

export async function getMyBookings(userId: UUID): Promise<Booking[]> {
  await simulateLatency()
  return BOOKINGS.filter((b) => b.userId === userId).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )
}

export async function listBookings(filter?: {
  status?: Booking['status']
  pujaCatalogId?: UUID
  from?: string
  to?: string
}): Promise<Booking[]> {
  await simulateLatency()
  return hereBookings().filter((b) => (filter?.status ? b.status === filter.status : true))
    .filter((b) => (filter?.pujaCatalogId ? b.pujaCatalogId === filter.pujaCatalogId : true))
    .filter((b) => (filter?.from ? b.startDate >= filter.from : true))
    .filter((b) => (filter?.to ? b.startDate <= filter.to : true))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getUpcomingOccurrences(userId?: UUID, days = 30): Promise<PujaOccurrence[]> {
  await simulateLatency()
  const now = Date.now()
  const until = now + days * 86400000
  // A devotee's own roster spans every temple they sponsor at; the console is one temple.
  const mine = userId
    ? new Set(BOOKINGS.filter((b) => b.userId === userId).map((b) => b.id))
    : hereBookingIds()
  return OCCURRENCES.filter((o) => {
    const t = new Date(o.scheduledAt).getTime()
    return t >= now && t <= until && mine.has(o.bookingId)
  })
}

export async function getOccurrencesOn(date: Date, userId?: UUID): Promise<PujaOccurrence[]> {
  await simulateLatency()
  const key = date.toDateString()
  const mine = userId
    ? new Set(BOOKINGS.filter((b) => b.userId === userId).map((b) => b.id))
    : hereBookingIds()
  return OCCURRENCES.filter(
    (o) => new Date(o.scheduledAt).toDateString() === key && mine.has(o.bookingId),
  )
}

export async function setOccurrenceStatus(
  id: UUID,
  status: PujaOccurrence['status'],
): Promise<PujaOccurrence | null> {
  await simulateLatency()
  const o = OCCURRENCES.find((x) => x.id === id)
  if (!o) return null
  o.status = status
  o.fulfilledAt = status === 'completed' ? new Date().toISOString() : undefined
  return o
}

export async function createBooking(
  input: Omit<Booking, 'id' | 'createdAt' | 'status' | 'endDate' | 'approval'>,
): Promise<Booking> {
  await simulateLatency()
  const start = new Date(input.startDate)
  const end = new Date(start)
  end.setDate(end.getDate() + (input.cadence === 'one-time' ? 1 : 365))
  const now = new Date().toISOString()
  const devotee = USERS.find((u) => u.id === input.userId)
  // A booking for a particular puja belongs to that puja's temple, whatever is selected.
  const puja = PUJA_BY_ID.get(input.pujaCatalogId)
  const booking: Booking = {
    ...input,
    templeId: puja?.templeId ?? currentTempleId(),
    currency: puja?.currency ?? currentTemple().currency,
    id: `bkg_${String(BOOKINGS.length + 1).padStart(4, '0')}`,
    endDate: end.toISOString(),
    // A sponsorship is no longer live the moment it is taken. It enters the accounts
    // queue and only becomes 'active' once a priest is on it — see `assignPriest`.
    status: 'pending',
    approval: {
      stage: 'finance-review',
      history: [
        {
          at: now,
          actorId: input.userId,
          actorName: devotee?.name ?? 'Devotee',
          actorRole: 'devotee',
          action: 'submitted',
          note: input.payment
            ? `Sponsorship submitted · paid by ${input.payment.method}.`
            : 'Sponsorship submitted.',
        },
      ],
    },
    createdAt: now,
  }
  BOOKINGS.unshift(booking)
  return booking
}

export async function setBookingStatus(
  id: UUID,
  status: Booking['status'],
): Promise<Booking | null> {
  await simulateLatency()
  const b = BOOKINGS.find((x) => x.id === id)
  if (!b) return null

  // Nothing may make a booking live except the committee, via `assignPriest`. The
  // bookings table offers no such action on a pending row, but this is the seam every
  // screen shares — leaving it open is how an approval chain quietly gets bypassed.
  // Cancelling is always allowed: the office can drop a sponsorship at any stage.
  const stage = b.approval?.stage
  if (status !== 'cancelled' && stage && stage !== 'scheduled') return null

  b.status = status
  // Pausing or cancelling a booking that went through the chain is part of its record,
  // so it survives a reload alongside the approval that put it there.
  if (b.approval) persistApproval(b)
  return b
}

/* ---------------------------------------------------------------- approvals */

/**
 * Persistence for the approval chain.
 *
 * Only the fields a desk can actually change are stored, replayed over the seed at
 * import time — the same shape `hydrateFamilyTrees` uses. Storing whole bookings would
 * mean a stale copy of the seed silently overriding any later change to it.
 */
interface SavedApproval {
  id: UUID
  status: Booking['status']
  approval?: Booking['approval']
  payment?: Booking['payment']
  assignedPriestId?: UUID
}

/** Occurrences minted by an approval, plus per-day priest changes to seeded ones. */
interface SavedRoster {
  created: PujaOccurrence[]
  officiants: Record<UUID, { officiant: string; officiantId: UUID }>
}

const emptyRoster = (): SavedRoster => ({ created: [], officiants: {} })

function persistApproval(b: Booking) {
  const rest = readLocal<SavedApproval[]>(LOCAL_KEYS.approvals, []).filter((s) => s.id !== b.id)
  writeLocal(LOCAL_KEYS.approvals, [
    ...rest,
    {
      id: b.id,
      status: b.status,
      approval: b.approval,
      payment: b.payment,
      assignedPriestId: b.assignedPriestId,
    },
  ])
}

function persistRoster(mutate: (r: SavedRoster) => void) {
  const roster = readLocal<SavedRoster>(LOCAL_KEYS.rosterAssignments, emptyRoster())
  mutate(roster)
  writeLocal(LOCAL_KEYS.rosterAssignments, roster)
}

function hydrateApprovals() {
  for (const saved of readLocal<SavedApproval[]>(LOCAL_KEYS.approvals, [])) {
    const b = BOOKINGS.find((x) => x.id === saved.id)
    if (!b) continue
    b.status = saved.status
    b.approval = saved.approval
    b.payment = saved.payment
    b.assignedPriestId = saved.assignedPriestId
  }

  const roster = readLocal<SavedRoster>(LOCAL_KEYS.rosterAssignments, emptyRoster())
  for (const o of roster.created) if (!OCCURRENCES.some((x) => x.id === o.id)) OCCURRENCES.push(o)
  for (const [id, who] of Object.entries(roster.officiants)) {
    const o = OCCURRENCES.find((x) => x.id === id)
    if (o) {
      o.officiant = who.officiant
      o.officiantId = who.officiantId
    }
  }
  OCCURRENCES.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
}
hydrateApprovals()

/**
 * The approval chain: devotee submits → accounts verify the money → the puja committee
 * puts a priest on it. Each function below is one desk's decision, and every one of them
 * appends to `approval.history` rather than only flipping a field, so the booking can
 * always answer who did what and why.
 */

/** Appends an audit entry and moves the stage in one place, so the two cannot drift. */
function advance(
  booking: Booking,
  stage: ApprovalStage,
  actor: User,
  action: ApprovalEvent['action'],
  note?: string,
): Booking {
  const event: ApprovalEvent = {
    at: new Date().toISOString(),
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action,
    note: note?.trim() || undefined,
  }
  booking.approval = {
    stage,
    history: [...(booking.approval?.history ?? []), event],
  }
  // Every transition goes through here, so this is the one place the decision has to
  // be written down for it to survive the reload that signing in as the next desk causes.
  persistApproval(booking)
  return booking
}

/** Every booking sitting at a given desk, oldest first — a queue, not a ledger. */
export async function listBookingsByStage(stage: ApprovalStage | 'all'): Promise<Booking[]> {
  await simulateLatency()
  return hereBookings().filter((b) =>
    stage === 'all' ? Boolean(b.approval) : b.approval?.stage === stage,
  ).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/**
 * Accounts confirm the money arrived, recording what they matched it against.
 *
 * The reference is stored on the booking rather than only in the note, because "which
 * transaction did you check?" is a question an auditor asks about a specific field.
 */
export async function verifyPayment(
  id: UUID,
  actor: User,
  input: { method: NonNullable<Booking['payment']>['method']; reference: string; note?: string },
): Promise<Booking | null> {
  await simulateLatency()
  const b = BOOKINGS.find((x) => x.id === id)
  if (!b) return null
  const at = new Date().toISOString()
  b.payment = {
    ...b.payment,
    method: input.method,
    reference: input.reference.trim(),
    receivedAt: b.payment?.receivedAt ?? at,
    verifiedBy: actor.id,
    verifiedAt: at,
  }
  return advance(
    b,
    'committee-review',
    actor,
    'payment-verified',
    input.note || `Matched against ${input.reference.trim()}.`,
  )
}

/** The money did not arrive, but still could. Stays pending and waits to be resubmitted. */
export async function sendBackForPayment(
  id: UUID,
  actor: User,
  reason: string,
): Promise<Booking | null> {
  await simulateLatency()
  const b = BOOKINGS.find((x) => x.id === id)
  if (!b) return null
  return advance(b, 'payment-pending', actor, 'sent-back', reason)
}

/** The devotee has settled it — back into the accounts queue for a second look. */
export async function resubmitForReview(
  id: UUID,
  actor: User,
  note?: string,
): Promise<Booking | null> {
  await simulateLatency()
  const b = BOOKINGS.find((x) => x.id === id)
  if (!b) return null
  return advance(b, 'finance-review', actor, 'resubmitted', note)
}

/** Refused outright. The sponsorship is cancelled and leaves every revenue figure. */
export async function declineBooking(
  id: UUID,
  actor: User,
  reason: string,
): Promise<Booking | null> {
  await simulateLatency()
  const b = BOOKINGS.find((x) => x.id === id)
  if (!b) return null
  b.status = 'cancelled'
  return advance(b, 'declined', actor, 'declined', reason)
}

/**
 * Materialises the occurrences an approved booking should have.
 *
 * The seed builds occurrences once at module load and only for already-active bookings,
 * so a booking approved during the session would otherwise have no days on the roster —
 * and nothing for the committee to assign a priest to.
 *
 * Two rules the seed does not share. Nothing is back-dated: the seed writes `completed`
 * rows behind today to give the console a fulfilment history, but a booking approved a
 * moment ago had no puja performed last week, so this mints only from today forward. And
 * it is idempotent — a double-click must not book the sannidhi twice.
 */
function materialiseOccurrences(booking: Booking, priest?: { id: UUID; name: string }): number {
  if (OCCURRENCES.some((o) => o.bookingId === booking.id)) return 0

  const step = CADENCE_DAYS[booking.cadence]
  const base = new Date()
  base.setHours(0, 0, 0, 0)
  const startOffset = Math.round(
    (new Date(booking.startDate).getTime() - base.getTime()) / 86400000,
  )
  const offsets: number[] = []

  if (step === 0) {
    // A one-time puja sits on its own start date — unless that has already passed,
    // in which case the soonest it can now be offered is today.
    offsets.push(Math.max(0, startOffset))
  } else {
    let k = Math.max(0, Math.ceil(-startOffset / step))
    for (;;) {
      const off = startOffset + k * step
      if (off > 30) break
      if (off >= 0) offsets.push(off)
      k++
    }
  }

  for (const off of offsets) {
    const at = new Date(base)
    at.setDate(at.getDate() + off)
    at.setHours(9, 0, 0, 0)
    const occurrence: PujaOccurrence = {
      id: `occ_${String(OCCURRENCES.length + 1).padStart(4, '0')}`,
      bookingId: booking.id,
      scheduledAt: at.toISOString(),
      officiant: priest?.name,
      officiantId: priest?.id,
      status: 'scheduled',
    }
    OCCURRENCES.push(occurrence)
    persistRoster((r) => r.created.push(occurrence))
  }
  // `getOccurrencesOn` returns in array order, so an unsorted append would drop a new
  // 9am puja underneath an existing 7pm one on today's roster.
  OCCURRENCES.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
  return offsets.length
}

/**
 * The committee puts a priest on the puja, which is the step that makes it live.
 *
 * The chosen priest becomes the booking's default and is written onto every occurrence
 * generated for it; individual days can be moved afterwards with `setOccurrenceOfficiant`.
 */
export async function assignPriest(
  id: UUID,
  actor: User,
  priestId: UUID,
  note?: string,
): Promise<Booking | null> {
  await simulateLatency()
  const b = BOOKINGS.find((x) => x.id === id)
  if (!b) return null
  const priest = ALL_STAFF.find((s) => s.id === priestId)
  if (!priest) return null

  b.assignedPriestId = priest.id
  b.status = 'active'
  materialiseOccurrences(b, { id: priest.id, name: priest.name })

  // Any day already on the roster that nobody had been put on follows the default too.
  for (const o of OCCURRENCES) {
    if (o.bookingId === b.id && !o.officiantId) {
      o.officiant = priest.name
      o.officiantId = priest.id
      persistRoster((r) => {
        r.officiants[o.id] = { officiant: priest.name, officiantId: priest.id }
      })
    }
  }

  return advance(b, 'scheduled', actor, 'priest-assigned', note || `Assigned to ${priest.name}.`)
}

/** Moves a single day to a different priest — cover for illness, travel, a clash. */
export async function setOccurrenceOfficiant(
  occurrenceId: UUID,
  priestId: UUID,
): Promise<PujaOccurrence | null> {
  await simulateLatency()
  const o = OCCURRENCES.find((x) => x.id === occurrenceId)
  if (!o) return null
  const priest = ALL_STAFF.find((s) => s.id === priestId)
  if (!priest) return null
  o.officiant = priest.name
  o.officiantId = priest.id
  persistRoster((r) => {
    r.officiants[o.id] = { officiant: priest.name, officiantId: priest.id }
  })
  return o
}

/** The days belonging to one booking, for the committee's per-day reassignment list. */
export async function getOccurrencesForBooking(bookingId: UUID): Promise<PujaOccurrence[]> {
  await simulateLatency()
  return OCCURRENCES.filter((o) => o.bookingId === bookingId).sort((a, b) =>
    a.scheduledAt.localeCompare(b.scheduledAt),
  )
}

/* ---------------------------------------------------------------- donations */

/**
 * Guest gifts replayed over the seed on first import.
 *
 * `DONATIONS` is an in-memory array that resets on reload — harmless for seeded records
 * nobody can lose, but a gift a visitor made ten minutes ago is the one record they will
 * come looking for. Mirrored into localStorage on write and read back here, so
 * `listDonationsFor` can still find it on their next visit.
 */
function hydrateGuestDonations() {
  const saved = readLocal<Donation[]>(LOCAL_KEYS.guestDonations, [])
  for (const d of saved) if (!DONATIONS.some((x) => x.id === d.id)) DONATIONS.unshift(d)
  DONATIONS.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
hydrateGuestDonations()

export async function listDonations(userId?: UUID): Promise<Donation[]> {
  await simulateLatency()
  // Keyed on a devotee: everything they have given, at any temple. Otherwise: this temple.
  return userId ? DONATIONS.filter((d) => d.userId === userId) : here(DONATIONS)
}

/**
 * Every gift belonging to whoever is giving — by account where there is one, and by
 * contact details either way.
 *
 * The contact pass is what makes the guest flow worth anything: it reunites a visitor
 * with gifts made before they had an account, and it means a devotee who signs up after
 * giving as a guest finds that gift waiting in their statement rather than orphaned.
 */
export async function listDonationsFor(identity: DonorIdentity): Promise<Donation[]> {
  await simulateLatency()
  return DONATIONS.filter(
    (d) =>
      (identity.userId !== null && d.userId === identity.userId) ||
      contactMatches(d.donor, identity.contact),
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/**
 * The devotee account behind an email or phone, if the temple already has one.
 *
 * The gate calls this to offer "you already have an account — sign in instead" rather
 * than quietly opening a second, contactless record for somebody who is already a
 * devotee. It reports only that a match exists; it never signs anybody in.
 */
export async function findDonorByContact(contact: {
  email?: string
  phone?: string
}): Promise<User | null> {
  await simulateLatency()
  const email = normEmail(contact.email ?? '')
  const phone = normPhone(contact.phone ?? '')
  if (!email && phone.length < 10) return null
  return (
    USERS.find((u) => u.role === 'devotee' && contactMatches(u, { email, phone })) ?? null
  )
}

export async function createDonation(
  input: Omit<Donation, 'id' | 'createdAt' | 'taxReceiptId'>,
): Promise<Donation> {
  await simulateLatency()
  const n = DONATIONS.length + 1
  const donation: Donation = {
    // An explicit temple on the input (a gift to a temple other than the one being
    // viewed) wins; otherwise the gift is stamped for the temple being viewed.
    ...templeStamp(),
    ...stripUndefined(input),
    currency:
      input.currency ??
      (input.templeId ? TEMPLE_BY_ID.get(input.templeId)?.currency : undefined) ??
      currentTemple().currency,
    id: `don_${String(n).padStart(4, '0')}`,
    taxReceiptId: `rcpt_${String(n).padStart(4, '0')}`,
    createdAt: new Date().toISOString(),
  }
  DONATIONS.unshift(donation)

  // A guest gift has no seeded record to fall back on — see `hydrateGuestDonations`.
  if (!donation.userId && donation.donor) {
    writeLocal(LOCAL_KEYS.guestDonations, [
      donation,
      ...readLocal<Donation[]>(LOCAL_KEYS.guestDonations, []),
    ])
  }

  // An event sponsorship is money raised *for that festival*, so it moves the festival's
  // break-even meter as well as landing in the ledger. Without this the devotee sponsors
  // the flowers and the event page still reads the same figure it did a moment ago.
  if (donation.eventId) {
    const event = EVENT_BY_ID.get(donation.eventId) ?? EVENTS.find((e) => e.id === donation.eventId)
    if (event) event.collectedAmount += donation.amount
  }

  return donation
}

/**
 * What a returning visitor has given before, keyed only on contact details.
 *
 * Shown at the gate the moment they finish typing their email or phone, so the
 * recognition is visible *before* they commit to a second gift.
 */
export async function getGivingSummaryForContact(contact: DonorContact): Promise<{
  count: number
  total: Money
  lastGiftAt: ISODate | null
}> {
  await simulateLatency()
  const account = USERS.find((u) => u.role === 'devotee' && contactMatches(u, contact))
  // Totals are in one currency, so recognition at the gate is per temple.
  const mine = here(DONATIONS).filter(
    (d) => (account && d.userId === account.id) || contactMatches(d.donor, contact),
  )
  return {
    count: mine.length,
    total: mine.reduce((s, d) => s + d.amount, 0),
    lastGiftAt: mine.map((d) => d.createdAt).sort().at(-1) ?? null,
  }
}

export async function issueTaxReceipts(ids: UUID[]): Promise<number> {
  await simulateLatency()
  let n = 0
  for (const id of ids) {
    const d = DONATIONS.find((x) => x.id === id)
    if (d && !d.taxReceiptId) {
      d.taxReceiptId = `rcpt_${d.id.replace('don_', '')}`
      n++
    }
  }
  return n
}

/** Per-donor totals for a calendar year — the tax-receipt bulk tool reads this. */
export async function getYearlyContributions(
  year: number,
): Promise<Array<{ user: User; donations: Money; sponsorships: Money; total: Money }>> {
  await simulateLatency()
  const temple = here(DONATIONS)
  const templeBookings = hereBookings()
  return USERS.filter((u) => u.role === 'devotee')
    .map((user) => {
      const donations = temple
        .filter((d) => d.userId === user.id && new Date(d.createdAt).getFullYear() === year)
        .reduce((s, d) => s + d.amount, 0)
      const sponsorships = templeBookings.filter(
        (b) =>
          b.userId === user.id &&
          isRealisedBooking(b) &&
          new Date(b.createdAt).getFullYear() === year,
      ).reduce((s, b) => s + b.amount, 0)
      return { user, donations, sponsorships, total: donations + sponsorships }
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total)
}

/* -------------------------------------------------------------- memberships */

export async function getMembership(userId: UUID): Promise<Membership | null> {
  await simulateLatency()
  return (
    MEMBERSHIPS.filter((m) => m.userId === userId).sort((a, b) =>
      b.endDate.localeCompare(a.endDate),
    )[0] ?? null
  )
}

export async function listMemberships(): Promise<Membership[]> {
  await simulateLatency()
  return here(MEMBERSHIPS).sort((a, b) => a.endDate.localeCompare(b.endDate))
}

export async function createMembership(
  input: Omit<Membership, 'id' | 'status'>,
): Promise<Membership> {
  await simulateLatency()
  const m: Membership = {
    templeId: currentTempleId(),
    ...input,
    id: `mem_${String(MEMBERSHIPS.length + 1).padStart(4, '0')}`,
    status: 'active',
  }
  MEMBERSHIPS.push(m)
  const u = USERS.find((x) => x.id === input.userId)
  if (u) u.membershipId = m.id
  return m
}

/* ------------------------------------------------------------------- events */

export async function listEvents(
  status?: 'upcoming' | 'ongoing' | 'completed',
): Promise<TempleEvent[]> {
  await simulateLatency()
  return here(EVENTS)
    .filter((e) => (status ? e.status === status : true))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export async function getEventBySlug(slug: string): Promise<TempleEvent | null> {
  await simulateLatency()
  return here(EVENTS).find((e) => e.slug === slug) ?? null
}

export async function getEventById(id: UUID): Promise<TempleEvent | null> {
  await simulateLatency()
  return EVENTS.find((e) => e.id === id) ?? null
}

export async function saveEvent(event: TempleEvent): Promise<TempleEvent> {
  await simulateLatency()
  const i = EVENTS.findIndex((e) => e.id === event.id)
  // An edit keeps the owning temple it had; a new event is stamped for the current one.
  const stamped: TempleEvent =
    i >= 0
      ? { ...event, templeId: EVENTS[i]!.templeId ?? event.templeId, currency: EVENTS[i]!.currency ?? event.currency }
      : { ...templeStamp(), ...stripUndefined(event) }
  if (i >= 0) EVENTS[i] = stamped
  else EVENTS.push(stamped)
  EVENTS.sort((a, b) => a.date.localeCompare(b.date))
  EVENT_BY_ID.set(stamped.id, stamped)
  return stamped
}

export async function deleteEvent(id: UUID): Promise<void> {
  await simulateLatency()
  const i = EVENTS.findIndex((e) => e.id === id)
  if (i >= 0) EVENTS.splice(i, 1)
}

export async function rsvpToEvent(id: UUID, seats: number): Promise<TempleEvent | null> {
  await simulateLatency()
  const e = EVENTS.find((x) => x.id === id)
  if (!e) return null
  e.rsvpCount += seats
  if (e.ticketPrice) e.collectedAmount += e.ticketPrice * seats
  return e
}

/* ----------------------------------------------------------------- facility */

export async function listFacilityBookings(): Promise<FacilityBooking[]> {
  await simulateLatency()
  return here(FACILITY_BOOKINGS)
}

export async function createFacilityBooking(
  input: Omit<FacilityBooking, 'id' | 'status'>,
): Promise<FacilityBooking> {
  await simulateLatency()
  const fb: FacilityBooking = {
    ...templeStamp(),
    ...stripUndefined(input),
    id: `fac_${String(FACILITY_BOOKINGS.length + 1).padStart(4, '0')}`,
    status: 'pending',
  }
  FACILITY_BOOKINGS.push(fb)
  return fb
}

export async function setFacilityBookingStatus(
  id: UUID,
  status: FacilityBooking['status'],
): Promise<void> {
  await simulateLatency()
  const fb = FACILITY_BOOKINGS.find((x) => x.id === id)
  if (fb) fb.status = status
}

/* ------------------------------------------------------------- transparency */

export async function listProjects(): Promise<Project[]> {
  await simulateLatency()
  return clone(here(PROJECTS))
}

export async function getTransparencySnapshot(): Promise<TransparencySnapshot> {
  await simulateLatency()
  return TRANSPARENCY_BY_TEMPLE[currentTempleId()] ?? emptySnapshot()
}

export async function getPujaPnL(): Promise<PujaPnLRow[]> {
  await simulateLatency()
  const temple = hereBookings()
  return here(PUJA_CATALOG).map((puja) => {
    const bookings = temple.filter((b) => b.pujaCatalogId === puja.id && isRealisedBooking(b))
    const collected = bookings.reduce((s, b) => s + b.amount, 0)
    // Revenue here is a full year of sponsorship, so cost has to be a full year too.
    // Counting occurrences from the 30-day materialisation window against annual
    // revenue is what made every puja look like it ran at a catastrophic loss.
    const unitCost = PUJA_UNIT_COST[puja.id] ?? Math.round(puja.basePrice * 0.5)
    const cost = bookings.reduce((s, b) => s + OCCURRENCES_PER_YEAR[b.cadence] * unitCost, 0)
    const net = collected - cost
    return {
      puja,
      sponsors: bookings.length,
      collected,
      cost,
      net,
      progressPct: collected === 0 ? 0 : Math.round((net / collected) * 100),
    }
  }).sort((a, b) => b.collected - a.collected)
}

/* ----------------------------------------------------------------- calendar */

export async function listRecurringRules(): Promise<RecurringRule[]> {
  await simulateLatency()
  return here(RECURRING_RULES)
}

export async function saveRecurringRule(input: RecurringRule): Promise<RecurringRule> {
  await simulateLatency()
  const rule: RecurringRule = { ...input, templeId: input.templeId ?? currentTempleId() }
  const i = RECURRING_RULES.findIndex((r) => r.id === rule.id)
  if (i >= 0) RECURRING_RULES[i] = rule
  else RECURRING_RULES.push(rule)
  return rule
}

export async function deleteRecurringRule(id: UUID): Promise<void> {
  await simulateLatency()
  const i = RECURRING_RULES.findIndex((r) => r.id === id)
  if (i >= 0) RECURRING_RULES.splice(i, 1)
}

/* -------------------------------------------------------- admin aggregates */

/** A closed date range, inclusive of both ends. `yyyy-mm-dd`, as the date inputs give it. */
export interface DashboardRange {
  from: string
  to: string
}

export interface AdminStats {
  /* --- Scoped to the selected range --------------------------------------- */
  donations: Money
  /** The same measure over the immediately preceding window of equal length. */
  donationsPrev: Money
  sponsorships: number
  sponsorshipsPrev: number
  sponsorshipRevenue: Money
  newDevotees: number
  newDevoteesPrev: number
  trend: Array<{ label: string; amount: Money }>
  byPujaType: Array<{ type: string; bookings: number }>
  /** How the trend was bucketed, so the chart can caption itself honestly. */
  grain: 'day' | 'week' | 'month'
  days: number

  /* --- Point in time. These ignore the range entirely ---------------------- */
  activeBookings: number
  activeMemberships: number
  devoteeCount: number
  todayQueue: number
  overduePrasadam: number
}

const startOfDay = (d: Date) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

const endOfDay = (d: Date) => {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

/**
 * Buckets for the trend chart, chosen from the span rather than fixed at monthly.
 * A seven-day range plotted in months is one point; a two-year range plotted in days
 * is 730 of them. Neither is a chart, so the grain follows the question being asked.
 */
function buildBuckets(from: Date, to: Date, grain: 'day' | 'week' | 'month') {
  const out: { start: Date; end: Date; label: string }[] = []
  const cursor = new Date(from)

  while (cursor.getTime() <= to.getTime()) {
    let end: Date
    let label: string

    if (grain === 'month') {
      end = endOfDay(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0))
      label = cursor.toLocaleString('en-US', { month: 'short' })
    } else if (grain === 'week') {
      end = endOfDay(new Date(cursor.getTime() + 6 * 86400000))
      label = cursor.toLocaleString('en-US', { month: 'short', day: 'numeric' })
    } else {
      end = endOfDay(cursor)
      label = cursor.toLocaleString('en-US', { month: 'short', day: 'numeric' })
    }

    out.push({ start: new Date(cursor), end: end > to ? to : end, label })

    if (grain === 'month') cursor.setMonth(cursor.getMonth() + 1, 1)
    else cursor.setDate(cursor.getDate() + (grain === 'week' ? 7 : 1))
    cursor.setHours(0, 0, 0, 0)
  }

  return out
}

/**
 * Dashboard aggregates for a date range.
 *
 * Only the figures that genuinely have a period are scoped by it. "Active bookings",
 * "today's queue" and "overdue prasadam" are counts of what is true right now — there
 * is no such thing as an overdue shipment "in June" — so they are returned unscoped
 * and the dashboard groups them apart rather than quietly re-labelling a live number
 * as a historical one.
 */
export async function getAdminStats(range?: DashboardRange): Promise<AdminStats> {
  await simulateLatency()
  const now = new Date()

  const to = range ? endOfDay(new Date(`${range.to}T12:00:00`)) : endOfDay(now)
  const from = range
    ? startOfDay(new Date(`${range.from}T12:00:00`))
    : startOfDay(new Date(now.getFullYear(), 0, 1))

  const span = Math.max(0, to.getTime() - from.getTime())
  // `to` is the end of its day, so the span already covers the final day whole — the
  // inclusive count is the rounded span, not the span plus one.
  const days = Math.max(1, Math.round(span / 86400000))

  // The window immediately before this one, same length — what "vs previous" compares to.
  const prevTo = new Date(from.getTime() - 1)
  const prevFrom = new Date(prevTo.getTime() - span)

  const within = (iso: string, a: Date, b: Date) => {
    const t = new Date(iso).getTime()
    return t >= a.getTime() && t <= b.getTime()
  }

  const hereDonations = here(DONATIONS)
  const bookingsHere = hereBookings()
  const donationsBetween = (a: Date, b: Date) =>
    hereDonations.filter((d) => within(d.createdAt, a, b)).reduce((s, d) => s + d.amount, 0)

  const bookingsBetween = (a: Date, b: Date) =>
    bookingsHere.filter((bk) => isRealisedBooking(bk) && within(bk.createdAt, a, b))

  const tid = currentTempleId()
  const devotees = USERS.filter(
    (u) => u.role === 'devotee' && (isPlatform() || (u.homeTempleId ?? FLAGSHIP_ID) === tid),
  )
  const devoteesBetween = (a: Date, b: Date) =>
    devotees.filter((u) => within(u.createdAt, a, b)).length

  const rangeBookings = bookingsBetween(from, to)

  const grain: 'day' | 'week' | 'month' = days <= 31 ? 'day' : days <= 130 ? 'week' : 'month'
  const trend = buildBuckets(from, to, grain).map((b) => ({
    label: b.label,
    amount: donationsBetween(b.start, b.end),
  }))

  const typeCounts = new Map<string, number>()
  for (const b of rangeBookings) {
    const puja = PUJA_BY_ID.get(b.pujaCatalogId)
    if (!puja) continue
    typeCounts.set(puja.type, (typeCounts.get(puja.type) ?? 0) + 1)
  }

  const todayKey = now.toDateString()
  const hereIds = hereBookingIds()

  return {
    donations: donationsBetween(from, to),
    donationsPrev: donationsBetween(prevFrom, prevTo),
    sponsorships: rangeBookings.length,
    sponsorshipsPrev: bookingsBetween(prevFrom, prevTo).length,
    sponsorshipRevenue: rangeBookings.reduce((s, b) => s + b.amount, 0),
    newDevotees: devoteesBetween(from, to),
    newDevoteesPrev: devoteesBetween(prevFrom, prevTo),
    trend,
    byPujaType: [...typeCounts.entries()].map(([type, bookings]) => ({ type, bookings })),
    grain,
    days,

    activeBookings: bookingsHere.filter((b) => b.status === 'active').length,
    activeMemberships: here(MEMBERSHIPS).filter((m) => m.status === 'active').length,
    devoteeCount: devotees.length,
    todayQueue: OCCURRENCES.filter(
      (o) =>
        hereIds.has(o.bookingId) &&
        new Date(o.scheduledAt).toDateString() === todayKey &&
        o.status === 'scheduled',
    ).length,
    overduePrasadam: bookingsHere.filter(
      (b) => b.status === 'active' && b.addOns.includes('prasadam-post'),
    ).length,
  }
}

/* --------------------------------------------------------------- volunteers */

/**
 * The volunteer flow, in one sequence: a pool of people, a campaign that says what a
 * festival needs, a broadcast that asks them, the replies that come back, and the roster
 * those replies build.
 *
 * Two functions below carry the only real logic in the feature.
 * `sendCampaignMessage` resolves an audience filter into a frozen recipient list, records
 * the broadcast, mints exactly one invite per recipient and moves a `draft` campaign to
 * `recruiting` — the send *is* the transition, so there is no way to have outreach on a
 * campaign that still claims nobody has been asked. `recordInviteResponse` creates the
 * matching assignment on an acceptance, so "said yes" and "is on the roster" cannot
 * disagree by a coordinator forgetting a second step.
 *
 * Nothing here sends real mail or SMS. There is no gateway wired to this app, and the
 * screens say so in as many words: a send is recorded, addressed and previewed exactly
 * as it would go out, and then goes nowhere. Implying otherwise would be the one bug in
 * this feature nobody could see.
 */

/**
 * What the volunteer desk has changed since the seed.
 *
 * Created rows are stored whole because there is no seeded original behind them; seeded
 * rows store only the fields the desk can edit, for the same reason `SavedApproval` does —
 * a whole stored copy would pin a record to whatever the seed said the day it was cached.
 */
interface SavedVolunteering {
  newVolunteers: Volunteer[]
  newCampaigns: VolunteerCampaign[]
  newMessages: VolunteerMessage[]
  newInvites: VolunteerInvite[]
  newAssignments: VolunteerAssignment[]
  volunteerPatches: Record<UUID, Partial<Volunteer>>
  campaignPatches: Record<UUID, Partial<VolunteerCampaign>>
  invitePatches: Record<UUID, Partial<VolunteerInvite>>
  assignmentPatches: Record<UUID, Partial<VolunteerAssignment>>
  /** Ids removed by the desk, so a delete is not undone by the next reload. */
  removed: UUID[]
}

const emptyVolunteering = (): SavedVolunteering => ({
  newVolunteers: [],
  newCampaigns: [],
  newMessages: [],
  newInvites: [],
  newAssignments: [],
  volunteerPatches: {},
  campaignPatches: {},
  invitePatches: {},
  assignmentPatches: {},
  removed: [],
})

function persistVolunteering(mutate: (s: SavedVolunteering) => void) {
  const saved = readLocal<SavedVolunteering>(LOCAL_KEYS.volunteers, emptyVolunteering())
  // A key written by an earlier build may be missing a field this one reads.
  const merged = { ...emptyVolunteering(), ...saved }
  mutate(merged)
  writeLocal(LOCAL_KEYS.volunteers, merged)
}

function hydrateVolunteering() {
  const s = { ...emptyVolunteering(), ...readLocal<SavedVolunteering>(LOCAL_KEYS.volunteers, emptyVolunteering()) }

  for (const v of s.newVolunteers) if (!VOLUNTEERS.some((x) => x.id === v.id)) VOLUNTEERS.push(v)
  for (const c of s.newCampaigns)
    if (!VOLUNTEER_CAMPAIGNS.some((x) => x.id === c.id)) VOLUNTEER_CAMPAIGNS.push(c)
  for (const m of s.newMessages)
    if (!VOLUNTEER_MESSAGES.some((x) => x.id === m.id)) VOLUNTEER_MESSAGES.push(m)
  for (const i of s.newInvites)
    if (!VOLUNTEER_INVITES.some((x) => x.id === i.id)) VOLUNTEER_INVITES.push(i)
  for (const a of s.newAssignments)
    if (!VOLUNTEER_ASSIGNMENTS.some((x) => x.id === a.id)) VOLUNTEER_ASSIGNMENTS.push(a)

  for (const [id, patch] of Object.entries(s.volunteerPatches)) {
    const v = VOLUNTEERS.find((x) => x.id === id)
    if (v) Object.assign(v, patch)
  }
  for (const [id, patch] of Object.entries(s.campaignPatches)) {
    const c = VOLUNTEER_CAMPAIGNS.find((x) => x.id === id)
    if (c) Object.assign(c, patch)
  }
  for (const [id, patch] of Object.entries(s.invitePatches)) {
    const i = VOLUNTEER_INVITES.find((x) => x.id === id)
    if (i) Object.assign(i, patch)
  }
  for (const [id, patch] of Object.entries(s.assignmentPatches)) {
    const a = VOLUNTEER_ASSIGNMENTS.find((x) => x.id === id)
    if (a) Object.assign(a, patch)
  }

  for (const id of s.removed) {
    for (const arr of [
      VOLUNTEERS,
      VOLUNTEER_CAMPAIGNS,
      VOLUNTEER_MESSAGES,
      VOLUNTEER_INVITES,
      VOLUNTEER_ASSIGNMENTS,
    ] as { id: UUID }[][]) {
      const i = arr.findIndex((x) => x.id === id)
      if (i >= 0) arr.splice(i, 1)
    }
  }
}
hydrateVolunteering()

/** Next free id in a family, so a created row cannot collide with a seeded one. */
function nextId(prefix: string, rows: { id: UUID }[]): UUID {
  const used = rows
    .map((r) => Number(r.id.split('_')[1]))
    .filter((n) => Number.isFinite(n)) as number[]
  const n = (used.length ? Math.max(...used) : 0) + 1
  return `${prefix}_${String(n).padStart(4, '0')}`
}

const initialsFor = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '??'

/* ------------------------------------------------------- the volunteer pool */

export async function listVolunteers(query?: {
  search?: string
  skill?: VolunteerSkill
  city?: string
  status?: Volunteer['status']
}): Promise<Volunteer[]> {
  await simulateLatency()
  const q = query?.search?.trim().toLowerCase()
  return clone(
    here(VOLUNTEERS).filter((v) =>
      q ? [v.name, v.email, v.phone, v.city].some((f) => f.toLowerCase().includes(q)) : true,
    )
      .filter((v) => (query?.skill ? v.skills.includes(query.skill) : true))
      .filter((v) => (query?.city ? v.city === query.city : true))
      .filter((v) => (query?.status ? v.status === query.status : true))
      .sort((a, b) => a.name.localeCompare(b.name)),
  )
}

export async function getVolunteerById(id: UUID): Promise<Volunteer | null> {
  await simulateLatency()
  const v = VOLUNTEERS.find((x) => x.id === id)
  return v ? clone(v) : null
}

export async function createVolunteer(
  input: Omit<Volunteer, 'id' | 'joinedAt' | 'avatarInitials'>,
): Promise<Volunteer> {
  await simulateLatency()
  const v: Volunteer = {
    templeId: currentTempleId(),
    ...input,
    id: nextId('vol', VOLUNTEERS),
    joinedAt: new Date().toISOString(),
    avatarInitials: initialsFor(input.name),
  }
  VOLUNTEERS.push(v)
  persistVolunteering((s) => s.newVolunteers.push(v))
  return clone(v)
}

export async function updateVolunteer(id: UUID, patch: Partial<Volunteer>): Promise<Volunteer> {
  await simulateLatency()
  const v = VOLUNTEERS.find((x) => x.id === id)
  if (!v) throw new Error('Volunteer not found')
  Object.assign(v, patch)
  if (patch.name) v.avatarInitials = initialsFor(v.name)

  persistVolunteering((s) => {
    // A row created in this browser is stored whole, so patch the stored copy rather
    // than recording a delta against a seed that does not exist.
    const created = s.newVolunteers.find((x) => x.id === id)
    if (created) Object.assign(created, patch, { avatarInitials: v.avatarInitials })
    else
      s.volunteerPatches[id] = {
        ...s.volunteerPatches[id],
        ...patch,
        avatarInitials: v.avatarInitials,
      }
  })
  return clone(v)
}

export async function deleteVolunteer(id: UUID): Promise<void> {
  await simulateLatency()
  // Their outreach history and roster places go with them — a roster row pointing at a
  // volunteer who no longer exists renders as a blank name, which is worse than a gap.
  const doomed = [
    id,
    ...VOLUNTEER_INVITES.filter((i) => i.volunteerId === id).map((i) => i.id),
    ...VOLUNTEER_ASSIGNMENTS.filter((a) => a.volunteerId === id).map((a) => a.id),
  ]
  for (const arr of [VOLUNTEERS, VOLUNTEER_INVITES, VOLUNTEER_ASSIGNMENTS] as { id: UUID }[][]) {
    for (let i = arr.length - 1; i >= 0; i--) if (doomed.includes(arr[i]!.id)) arr.splice(i, 1)
  }
  persistVolunteering((s) => {
    s.removed.push(...doomed)
    s.newVolunteers = s.newVolunteers.filter((x) => !doomed.includes(x.id))
    s.newInvites = s.newInvites.filter((x) => !doomed.includes(x.id))
    s.newAssignments = s.newAssignments.filter((x) => !doomed.includes(x.id))
  })
}

/* ----------------------------------------------------------------- campaigns */

export async function listCampaigns(
  status?: VolunteerCampaign['status'],
): Promise<VolunteerCampaign[]> {
  await simulateLatency()
  return clone(
    here(VOLUNTEER_CAMPAIGNS)
      .filter((c) => (status ? c.status === status : true))
      .sort((a, b) => a.briefingAt.localeCompare(b.briefingAt)),
  )
}

export async function getCampaignById(id: UUID): Promise<VolunteerCampaign | null> {
  await simulateLatency()
  const c = VOLUNTEER_CAMPAIGNS.find((x) => x.id === id)
  return c ? clone(c) : null
}

export async function saveCampaign(input: VolunteerCampaign): Promise<VolunteerCampaign> {
  let campaign = input
  await simulateLatency()
  const i = VOLUNTEER_CAMPAIGNS.findIndex((c) => c.id === campaign.id)
  const isNew = i < 0
  campaign = { ...campaign, templeId: i >= 0 ? (VOLUNTEER_CAMPAIGNS[i]!.templeId ?? campaign.templeId) : (campaign.templeId ?? currentTempleId()) }
  if (isNew) VOLUNTEER_CAMPAIGNS.push(campaign)
  else VOLUNTEER_CAMPAIGNS[i] = campaign
  VOLUNTEER_CAMPAIGNS.sort((a, b) => a.briefingAt.localeCompare(b.briefingAt))

  persistVolunteering((s) => {
    const created = s.newCampaigns.findIndex((x) => x.id === campaign.id)
    if (created >= 0) s.newCampaigns[created] = campaign
    else if (isNew) s.newCampaigns.push(campaign)
    else s.campaignPatches[campaign.id] = { ...s.campaignPatches[campaign.id], ...campaign }
  })
  return clone(campaign)
}

export async function newCampaignId(): Promise<UUID> {
  return nextId('vcm', VOLUNTEER_CAMPAIGNS)
}

export async function setCampaignStatus(
  id: UUID,
  status: VolunteerCampaign['status'],
): Promise<VolunteerCampaign> {
  await simulateLatency()
  const c = VOLUNTEER_CAMPAIGNS.find((x) => x.id === id)
  if (!c) throw new Error('Campaign not found')
  c.status = status
  persistVolunteering((s) => {
    const created = s.newCampaigns.find((x) => x.id === id)
    if (created) created.status = status
    else s.campaignPatches[id] = { ...s.campaignPatches[id], status }
  })
  return clone(c)
}

export async function deleteCampaign(id: UUID): Promise<void> {
  await simulateLatency()
  const doomed = [
    id,
    ...VOLUNTEER_MESSAGES.filter((m) => m.campaignId === id).map((m) => m.id),
    ...VOLUNTEER_INVITES.filter((i) => i.campaignId === id).map((i) => i.id),
    ...VOLUNTEER_ASSIGNMENTS.filter((a) => a.campaignId === id).map((a) => a.id),
  ]
  for (const arr of [
    VOLUNTEER_CAMPAIGNS,
    VOLUNTEER_MESSAGES,
    VOLUNTEER_INVITES,
    VOLUNTEER_ASSIGNMENTS,
  ] as { id: UUID }[][]) {
    for (let i = arr.length - 1; i >= 0; i--) if (doomed.includes(arr[i]!.id)) arr.splice(i, 1)
  }
  persistVolunteering((s) => {
    s.removed.push(...doomed)
    s.newCampaigns = s.newCampaigns.filter((x) => !doomed.includes(x.id))
    s.newMessages = s.newMessages.filter((x) => !doomed.includes(x.id))
    s.newInvites = s.newInvites.filter((x) => !doomed.includes(x.id))
    s.newAssignments = s.newAssignments.filter((x) => !doomed.includes(x.id))
  })
}

/**
 * Per-role staffing: what was asked for, against who is actually on the sheet.
 *
 * `withdrawn` and `no-show` count towards nothing — the point of the number is how many
 * bodies will be standing there, and somebody who pulled out will not be. `pending` is
 * kept separate from `confirmed` rather than folded in, because a role that is "full" on
 * eight unconfirmed acceptances is not full, and the coordinator needs to see which.
 */
export async function getCampaignStaffing(campaignId: UUID): Promise<StaffingRow[]> {
  await simulateLatency()
  const c = VOLUNTEER_CAMPAIGNS.find((x) => x.id === campaignId)
  if (!c) return []
  const rows = VOLUNTEER_ASSIGNMENTS.filter((a) => a.campaignId === campaignId)

  return c.needs.map((n) => {
    const mine = rows.filter((a) => a.roleKey === n.roleKey)
    const confirmed = mine.filter(
      (a) => a.status === 'confirmed' || a.status === 'checked-in',
    ).length
    const pending = mine.filter((a) => a.status === 'pending').length
    return {
      roleKey: n.roleKey,
      label: n.label,
      needed: n.needed,
      confirmed,
      pending,
      short: Math.max(0, n.needed - confirmed - pending),
    }
  })
}

/* ------------------------------------------------------------------ outreach */

export async function listCampaignMessages(campaignId: UUID): Promise<VolunteerMessage[]> {
  await simulateLatency()
  return clone(
    VOLUNTEER_MESSAGES.filter((m) => m.campaignId === campaignId).sort((a, b) =>
      b.sentAt.localeCompare(a.sentAt),
    ),
  )
}

/**
 * Resolve an audience filter into the people it would actually reach.
 *
 * Shared by the preview count on the compose form and by the send itself, so the number
 * shown above the button is the number of invites the button creates — never a separate
 * estimate that can drift from it.
 */
function resolveAudience(campaignId: UUID, audience: VolunteerAudience): Volunteer[] {
  const invited = new Set(
    VOLUNTEER_INVITES.filter((i) => i.campaignId === campaignId).map((i) => i.volunteerId),
  )
  const rostered = new Set(
    VOLUNTEER_ASSIGNMENTS.filter(
      (a) => a.campaignId === campaignId && a.status !== 'withdrawn',
    ).map((a) => a.volunteerId),
  )

  // Only the campaign's own temple's volunteers are ever written to.
  const campaignTemple = tidOf(VOLUNTEER_CAMPAIGNS.find((c) => c.id === campaignId) ?? {})
  return VOLUNTEERS.filter((v) => tidOf(v) === campaignTemple)
    .filter((v) => v.status === 'active')
    .filter((v) => (audience.skills.length ? v.skills.some((s) => audience.skills.includes(s)) : true))
    .filter((v) => (audience.city ? v.city === audience.city : true))
    .filter((v) => (audience.excludeInvited ? !invited.has(v.id) : true))
    .filter((v) => (audience.excludeRostered ? !rostered.has(v.id) : true))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function previewAudience(
  campaignId: UUID,
  audience: VolunteerAudience,
): Promise<Volunteer[]> {
  await simulateLatency()
  return clone(resolveAudience(campaignId, audience))
}

/**
 * Record a broadcast and mint the invites it implies.
 *
 * The campaign's move from `draft` to `recruiting` happens here rather than as a separate
 * button, because the first send is what makes it true. A `staffed` or `completed`
 * campaign is left where it is — a coordinator chasing two late gaps has not reopened
 * recruitment.
 */
export async function sendCampaignMessage(
  campaignId: UUID,
  input: {
    channel: VolunteerChannel
    subject: string
    body: string
    audience: VolunteerAudience
    sentByName: string
  },
): Promise<{ message: VolunteerMessage; invites: VolunteerInvite[] }> {
  await simulateLatency()
  const campaign = VOLUNTEER_CAMPAIGNS.find((c) => c.id === campaignId)
  if (!campaign) throw new Error('Campaign not found')

  const recipients = resolveAudience(campaignId, input.audience)
  if (recipients.length === 0) throw new Error('That audience matches nobody')

  const now = new Date().toISOString()
  const message: VolunteerMessage = {
    id: nextId('vms', VOLUNTEER_MESSAGES),
    campaignId,
    channel: input.channel,
    subject: input.subject,
    body: input.body,
    recipientIds: recipients.map((v) => v.id),
    sentAt: now,
    sentByName: input.sentByName,
    audience: input.audience,
  }
  VOLUNTEER_MESSAGES.push(message)

  const minted: VolunteerInvite[] = []
  for (const v of recipients) {
    const existing = VOLUNTEER_INVITES.find(
      (i) => i.campaignId === campaignId && i.volunteerId === v.id,
    )
    // A reminder to somebody already asked re-dates their invite instead of creating a
    // second one, so the accepted/declined tallies stay a count of people, not of sends.
    if (existing) {
      existing.messageId = message.id
      existing.sentAt = now
      existing.channel = input.channel
      if (existing.status === 'no-response') existing.status = 'sent'
      const patched = existing
      persistVolunteering((s) => {
        const created = s.newInvites.find((x) => x.id === patched.id)
        if (created) Object.assign(created, patched)
        else
          s.invitePatches[patched.id] = {
            ...s.invitePatches[patched.id],
            status: patched.status,
            respondedAt: patched.respondedAt,
          }
      })
      continue
    }
    const invite: VolunteerInvite = {
      id: nextId('vin', [...VOLUNTEER_INVITES, ...minted]),
      campaignId,
      volunteerId: v.id,
      messageId: message.id,
      channel: input.channel,
      status: 'sent',
      sentAt: now,
    }
    minted.push(invite)
    VOLUNTEER_INVITES.push(invite)
  }

  const becameRecruiting = campaign.status === 'draft'
  if (becameRecruiting) campaign.status = 'recruiting'

  persistVolunteering((s) => {
    s.newMessages.push(message)
    s.newInvites.push(...minted)
    if (becameRecruiting) {
      const created = s.newCampaigns.find((x) => x.id === campaignId)
      if (created) created.status = 'recruiting'
      else s.campaignPatches[campaignId] = { ...s.campaignPatches[campaignId], status: 'recruiting' }
    }
  })

  return { message: clone(message), invites: clone(minted) }
}

export async function listCampaignInvites(campaignId: UUID): Promise<VolunteerInvite[]> {
  await simulateLatency()
  return clone(
    VOLUNTEER_INVITES.filter((i) => i.campaignId === campaignId).sort((a, b) =>
      b.sentAt.localeCompare(a.sentAt),
    ),
  )
}

/**
 * Log what a volunteer said back — typed in by whoever took the call.
 *
 * An acceptance creates the roster place in the same breath. Recording the yes and then
 * separately remembering to add them is exactly the step that gets skipped on a busy
 * evening, and the gap it leaves is a volunteer who thinks they are rostered and is not.
 * The role is guessed from what they can do against what is still short; the coordinator
 * can move them afterwards.
 */
export async function recordInviteResponse(
  inviteId: UUID,
  response: 'accepted' | 'declined' | 'no-response',
  note?: string,
): Promise<{ invite: VolunteerInvite; assignment?: VolunteerAssignment }> {
  await simulateLatency()
  const invite = VOLUNTEER_INVITES.find((i) => i.id === inviteId)
  if (!invite) throw new Error('Invite not found')

  invite.status = response
  invite.respondedAt = new Date().toISOString()
  invite.note = note?.trim() || undefined

  let assignment: VolunteerAssignment | undefined
  const already = VOLUNTEER_ASSIGNMENTS.find(
    (a) => a.campaignId === invite.campaignId && a.volunteerId === invite.volunteerId,
  )

  if (response === 'accepted' && !already) {
    const campaign = VOLUNTEER_CAMPAIGNS.find((c) => c.id === invite.campaignId)
    const volunteer = VOLUNTEERS.find((v) => v.id === invite.volunteerId)
    const needKeys = campaign?.needs.map((n) => n.roleKey) ?? []
    const rows = VOLUNTEER_ASSIGNMENTS.filter((a) => a.campaignId === invite.campaignId)
    const shortest =
      campaign?.needs
        .map((n) => ({
          key: n.roleKey,
          gap: n.needed - rows.filter((a) => a.roleKey === n.roleKey).length,
        }))
        .sort((a, b) => b.gap - a.gap)[0]?.key ?? needKeys[0]

    const roleKey =
      volunteer?.skills.find((s) => needKeys.includes(s)) ?? shortest ?? ('kitchen' as VolunteerSkill)

    assignment = {
      id: nextId('vas', VOLUNTEER_ASSIGNMENTS),
      campaignId: invite.campaignId,
      volunteerId: invite.volunteerId,
      roleKey,
      shift: 'Not yet set',
      status: 'pending',
      source: 'invited',
      inviteId: invite.id,
      addedAt: invite.respondedAt,
    }
    VOLUNTEER_ASSIGNMENTS.push(assignment)
  }

  // Somebody who declines after having accepted keeps their row, marked withdrawn, so the
  // roster shows a gap where a body used to be rather than silently shrinking.
  if (response !== 'accepted' && already && already.source === 'invited') {
    already.status = 'withdrawn'
  }

  const withdrawn = response !== 'accepted' && already?.source === 'invited' ? already : undefined
  const created = assignment
  persistVolunteering((s) => {
    const inv = s.newInvites.find((x) => x.id === inviteId)
    if (inv) Object.assign(inv, { status: invite.status, respondedAt: invite.respondedAt, note: invite.note })
    else
      s.invitePatches[inviteId] = {
        ...s.invitePatches[inviteId],
        status: invite.status,
        respondedAt: invite.respondedAt,
        note: invite.note,
      }
    if (created) s.newAssignments.push(created)
    if (withdrawn) {
      const c = s.newAssignments.find((x) => x.id === withdrawn.id)
      if (c) c.status = 'withdrawn'
      else
        s.assignmentPatches[withdrawn.id] = {
          ...s.assignmentPatches[withdrawn.id],
          status: 'withdrawn',
        }
    }
  })

  return { invite: clone(invite), assignment: created ? clone(created) : undefined }
}

/* -------------------------------------------------------------------- roster */

export async function listCampaignAssignments(campaignId: UUID): Promise<VolunteerAssignment[]> {
  await simulateLatency()
  return clone(
    VOLUNTEER_ASSIGNMENTS.filter((a) => a.campaignId === campaignId).sort(
      (a, b) => roleLabel(a.roleKey).localeCompare(roleLabel(b.roleKey)) || a.addedAt.localeCompare(b.addedAt),
    ),
  )
}

/**
 * Put somebody on the sheet who was never invited — the cousin who walked in on the
 * morning, the regular the coordinator simply rings. `source: 'direct'` marks them so
 * next year's "how many of the people we wrote to actually helped" stays honest.
 */
export async function addAssignment(
  campaignId: UUID,
  input: { volunteerId: UUID; roleKey: VolunteerSkill; shift: string; note?: string },
): Promise<VolunteerAssignment> {
  await simulateLatency()
  if (
    VOLUNTEER_ASSIGNMENTS.some(
      (a) => a.campaignId === campaignId && a.volunteerId === input.volunteerId,
    )
  ) {
    throw new Error('That volunteer is already on this roster')
  }
  const assignment: VolunteerAssignment = {
    id: nextId('vas', VOLUNTEER_ASSIGNMENTS),
    campaignId,
    volunteerId: input.volunteerId,
    roleKey: input.roleKey,
    shift: input.shift,
    // Direct adds land confirmed: somebody is standing in front of the coordinator
    // saying yes, which is a firmer commitment than a reply to a broadcast.
    status: 'confirmed',
    source: 'direct',
    addedAt: new Date().toISOString(),
    note: input.note?.trim() || undefined,
  }
  VOLUNTEER_ASSIGNMENTS.push(assignment)
  persistVolunteering((s) => s.newAssignments.push(assignment))
  return clone(assignment)
}

export async function updateAssignment(
  id: UUID,
  patch: Partial<Pick<VolunteerAssignment, 'roleKey' | 'shift' | 'status' | 'note'>>,
): Promise<VolunteerAssignment> {
  await simulateLatency()
  const a = VOLUNTEER_ASSIGNMENTS.find((x) => x.id === id)
  if (!a) throw new Error('Assignment not found')
  Object.assign(a, patch)
  persistVolunteering((s) => {
    const created = s.newAssignments.find((x) => x.id === id)
    if (created) Object.assign(created, patch)
    else s.assignmentPatches[id] = { ...s.assignmentPatches[id], ...patch }
  })
  return clone(a)
}

export async function removeAssignment(id: UUID): Promise<void> {
  await simulateLatency()
  const i = VOLUNTEER_ASSIGNMENTS.findIndex((a) => a.id === id)
  if (i >= 0) VOLUNTEER_ASSIGNMENTS.splice(i, 1)
  persistVolunteering((s) => {
    s.removed.push(id)
    s.newAssignments = s.newAssignments.filter((x) => x.id !== id)
    delete s.assignmentPatches[id]
  })
}

/** Confirm every pending place at once — the last step before the briefing goes out. */
export async function confirmAllPending(campaignId: UUID): Promise<number> {
  await simulateLatency()
  const pending = VOLUNTEER_ASSIGNMENTS.filter(
    (a) => a.campaignId === campaignId && a.status === 'pending',
  )
  for (const a of pending) a.status = 'confirmed'
  persistVolunteering((s) => {
    for (const a of pending) {
      const created = s.newAssignments.find((x) => x.id === a.id)
      if (created) created.status = 'confirmed'
      else s.assignmentPatches[a.id] = { ...s.assignmentPatches[a.id], status: 'confirmed' }
    }
  })
  return pending.length
}

/* --------------------------------------------------- stores & puja requirements */

/**
 * The store, the requirement chain and the pre-puja check.
 *
 * Three rules hold this together, and every function below exists to keep one of them.
 *
 * 1. **`onHand` never moves without a movement.** `postMovement` is the only writer of
 *    a stock balance in this file. Anything that consumes stock — a readiness
 *    confirmation, a wastage entry — goes through it, so the ledger can always explain
 *    the count. A screen that could set `onHand` directly would make the ledger a
 *    decoration.
 *
 * 2. **Approving a sheet supersedes the previous one.** A puja has at most one sheet in
 *    force. `approveRequirementSheet` demotes the incumbent in the same call that
 *    promotes the successor, so there is no instant at which two versions are both
 *    approved and a readiness check has to guess between them.
 *
 * 3. **Coverage is computed, never stored.** `listReadiness` reads the approved sheet
 *    against `onHand` at the moment it is called. Only the priest's decision persists.
 */

/** What the store desk has changed since the seed. Same split as `SavedVolunteering`. */
interface SavedInventory {
  newItems: StockItem[]
  newMovements: StockMovement[]
  newSheets: PujaRequirementSheet[]
  newReadiness: PujaReadiness[]
  itemPatches: Record<UUID, Partial<StockItem>>
  sheetPatches: Record<UUID, Partial<PujaRequirementSheet>>
  removed: UUID[]
}

const emptyInventory = (): SavedInventory => ({
  newItems: [],
  newMovements: [],
  newSheets: [],
  newReadiness: [],
  itemPatches: {},
  sheetPatches: {},
  removed: [],
})

function persistInventory(mutate: (s: SavedInventory) => void) {
  const saved = readLocal<SavedInventory>(LOCAL_KEYS.inventory, emptyInventory())
  // A key written by an earlier build may be missing a field this one reads.
  const merged = { ...emptyInventory(), ...saved }
  mutate(merged)
  writeLocal(LOCAL_KEYS.inventory, merged)
}

function hydrateInventory() {
  const s = {
    ...emptyInventory(),
    ...readLocal<SavedInventory>(LOCAL_KEYS.inventory, emptyInventory()),
  }

  for (const i of s.newItems) if (!STOCK_ITEMS.some((x) => x.id === i.id)) STOCK_ITEMS.push(i)
  for (const m of s.newMovements)
    if (!STOCK_MOVEMENTS.some((x) => x.id === m.id)) STOCK_MOVEMENTS.push(m)
  for (const sheet of s.newSheets)
    if (!REQUIREMENT_SHEETS.some((x) => x.id === sheet.id)) REQUIREMENT_SHEETS.push(sheet)
  for (const r of s.newReadiness)
    if (!PUJA_READINESS.some((x) => x.id === r.id)) PUJA_READINESS.push(r)

  for (const [id, patch] of Object.entries(s.itemPatches)) {
    const item = STOCK_ITEMS.find((x) => x.id === id)
    if (item) Object.assign(item, patch)
  }
  for (const [id, patch] of Object.entries(s.sheetPatches)) {
    const sheet = REQUIREMENT_SHEETS.find((x) => x.id === id)
    if (sheet) Object.assign(sheet, patch)
  }

  for (const id of s.removed) {
    for (const arr of [STOCK_ITEMS, REQUIREMENT_SHEETS] as { id: UUID }[][]) {
      const i = arr.findIndex((x) => x.id === id)
      if (i >= 0) arr.splice(i, 1)
    }
  }

  STOCK_MOVEMENTS.sort((a, b) => a.at.localeCompare(b.at))
}
hydrateInventory()

/** Store a change to a seeded item, or fold it into a created one. */
function patchItem(item: StockItem, patch: Partial<StockItem>) {
  Object.assign(item, patch, { updatedAt: new Date().toISOString() })
  persistInventory((s) => {
    const created = s.newItems.find((x) => x.id === item.id)
    if (created) Object.assign(created, item)
    else s.itemPatches[item.id] = { ...s.itemPatches[item.id], ...patch, updatedAt: item.updatedAt }
  })
}

function patchSheet(sheet: PujaRequirementSheet, patch: Partial<PujaRequirementSheet>) {
  Object.assign(sheet, patch, { updatedAt: new Date().toISOString() })
  persistInventory((s) => {
    const created = s.newSheets.find((x) => x.id === sheet.id)
    if (created) Object.assign(created, sheet)
    else s.sheetPatches[sheet.id] = { ...s.sheetPatches[sheet.id], ...sheet }
  })
}

/* ------------------------------------------------------------------- the store */

export async function listStockItems(query?: {
  search?: string
  category?: StockItem['category'] | 'all'
  /** Only what is at or below its reorder level — the shopping list. */
  lowOnly?: boolean
}): Promise<StockItem[]> {
  await simulateLatency()
  const q = query?.search?.trim().toLowerCase()
  return clone(
    here(STOCK_ITEMS).filter((i) => {
      if (!i.active) return false
      if (q && !i.name.toLowerCase().includes(q)) return false
      if (query?.category && query.category !== 'all' && i.category !== query.category) return false
      if (query?.lowOnly && i.onHand > i.reorderLevel) return false
      return true
    }).sort((a, b) => a.name.localeCompare(b.name)),
  )
}

export async function getStockItem(id: UUID): Promise<StockItem | null> {
  await simulateLatency()
  return clone(STOCK_ITEMS.find((i) => i.id === id) ?? null)
}

/**
 * The store ledger, newest first.
 *
 * Newest first because the question asked of a ledger on screen is almost always "what
 * happened recently?", never "what happened when we opened the ledger?" — the seed's
 * own build order is the opposite for a different reason, which is that a running
 * balance only makes sense computed forwards.
 */
export async function listStockMovements(query?: {
  itemId?: UUID
  kind?: StockMovement['kind'] | 'all'
  limit?: number
}): Promise<StockMovement[]> {
  await simulateLatency()
  const itemIds = new Set(here(STOCK_ITEMS).map((i) => i.id))
  const rows = STOCK_MOVEMENTS.filter((m) => {
    if (!itemIds.has(m.itemId)) return false
    if (query?.itemId && m.itemId !== query.itemId) return false
    if (query?.kind && query.kind !== 'all' && m.kind !== query.kind) return false
    return true
  }).sort((a, b) => b.at.localeCompare(a.at))
  return clone(query?.limit ? rows.slice(0, query.limit) : rows)
}

/**
 * The one place a stock balance changes.
 *
 * `qty` is signed and the caller states it that way, because "issued 6" and "adjusted
 * by −6" are different facts about the same six coconuts and the ledger has to keep
 * them apart. The balance is clamped at zero: a temple can discover it has less than it
 * thought, but it cannot hold minus four garlands, and a negative on-hand figure would
 * propagate into every coverage sum downstream as a phantom surplus.
 */
function postMovement(
  item: StockItem,
  kind: StockMovement['kind'],
  qty: number,
  actorName: string,
  extra?: { note?: string; pujaCatalogId?: UUID; occurrenceId?: UUID },
): StockMovement {
  const balance = Math.max(0, item.onHand + qty)
  const movement: StockMovement = {
    id: nextId('mov', STOCK_MOVEMENTS),
    itemId: item.id,
    kind,
    qty,
    balance,
    note: extra?.note?.trim() || undefined,
    pujaCatalogId: extra?.pujaCatalogId,
    occurrenceId: extra?.occurrenceId,
    actorName,
    at: new Date().toISOString(),
  }

  STOCK_MOVEMENTS.push(movement)
  patchItem(item, { onHand: balance })
  persistInventory((s) => {
    s.newMovements.push(movement)
  })
  return movement
}

/** Goods in. The note is where the invoice number goes. */
export async function receiveStock(
  itemId: UUID,
  qty: number,
  actor: User,
  note?: string,
): Promise<StockItem> {
  await simulateLatency()
  const item = STOCK_ITEMS.find((i) => i.id === itemId)
  if (!item) throw new Error('Unknown stock item')
  postMovement(item, 'received', Math.abs(qty), actor.name, { note })
  return clone(item)
}

/**
 * A physical count that disagrees with the book, or stock thrown away.
 *
 * For an adjustment `to` is the counted figure rather than a delta, because that is
 * what somebody standing at the shelf actually has: a number in front of them, not the
 * difference between it and a figure they would have to look up first. For wastage it
 * is the quantity discarded, which is the only figure that hand ever knows.
 */
export async function adjustStock(
  itemId: UUID,
  to: number,
  actor: User,
  note?: string,
  kind: Extract<StockMovement['kind'], 'adjusted' | 'wastage'> = 'adjusted',
): Promise<StockItem> {
  await simulateLatency()
  const item = STOCK_ITEMS.find((i) => i.id === itemId)
  if (!item) throw new Error('Unknown stock item')
  const delta = kind === 'wastage' ? -Math.abs(to) : Math.max(0, to) - item.onHand
  postMovement(item, kind, delta, actor.name, { note })
  return clone(item)
}

export async function saveStockItem(item: StockItem): Promise<StockItem> {
  await simulateLatency()
  const existing = STOCK_ITEMS.find((i) => i.id === item.id)

  if (existing) {
    // `onHand` is deliberately not settable here — it belongs to the ledger. A form
    // that could edit it would be a second, silent writer of the balance.
    const editable = { ...item }
    delete (editable as Partial<StockItem>).onHand
    patchItem(existing, editable)
    return clone(existing)
  }

  const created: StockItem = {
    ...templeStamp(),
    ...stripUndefined(item),
    id: nextId('stk', STOCK_ITEMS),
    onHand: 0,
    updatedAt: new Date().toISOString(),
  }
  STOCK_ITEMS.push(created)
  persistInventory((s) => {
    s.newItems.push(created)
  })
  // An opening balance is a counted fact like any other, so it enters as a movement
  // rather than as a field on the item — the ledger starts at line one, not line two.
  if (item.onHand > 0) {
    postMovement(created, 'adjusted', item.onHand, 'Store desk', { note: 'Opening stock count' })
  }
  return clone(created)
}

/** Retired rather than deleted: its movements still have to mean something. */
export async function retireStockItem(id: UUID): Promise<void> {
  await simulateLatency()
  const item = STOCK_ITEMS.find((i) => i.id === id)
  if (item) patchItem(item, { active: false })
}

/* --------------------------------------------------------- requirement sheets */

export async function listRequirementSheets(
  stage?: RequirementStage | 'all',
): Promise<PujaRequirementSheet[]> {
  await simulateLatency()
  return clone(
    hereSheets()
      .filter((s) => (!stage || stage === 'all' ? true : s.stage === stage))
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)),
  )
}

export async function getRequirementSheet(id: UUID): Promise<PujaRequirementSheet | null> {
  await simulateLatency()
  return clone(REQUIREMENT_SHEETS.find((s) => s.id === id) ?? null)
}

/** The sheet in force for a puja right now, if any. */
export async function getApprovedSheet(pujaCatalogId: UUID): Promise<PujaRequirementSheet | null> {
  await simulateLatency()
  return clone(
    REQUIREMENT_SHEETS.find((s) => s.pujaCatalogId === pujaCatalogId && s.stage === 'approved') ??
      null,
  )
}

/** Appends the audit entry and moves the stage together, as `advance` does for bookings. */
function step(
  sheet: PujaRequirementSheet,
  stage: RequirementStage,
  actor: User,
  action: RequirementEvent['action'],
  note?: string,
  extra?: Partial<PujaRequirementSheet>,
): PujaRequirementSheet {
  const event: RequirementEvent = {
    at: new Date().toISOString(),
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action,
    note: note?.trim() || undefined,
  }
  patchSheet(sheet, {
    ...extra,
    stage,
    history: [...sheet.history, event],
  })
  return sheet
}

/**
 * Start a sheet for a puja, or reopen the one already there.
 *
 * A puja gets one editable draft at a time. Handing back the existing draft rather than
 * minting a second one is what stops the priest's list turning into three half-written
 * versions of the same sheet, which is the failure mode of every requisition form that
 * has a "New" button and no "the one you started on Tuesday".
 */
export async function startRequirementSheet(
  pujaCatalogId: UUID,
  actor: User,
): Promise<PujaRequirementSheet> {
  await simulateLatency()

  const open = REQUIREMENT_SHEETS.find(
    (s) => s.pujaCatalogId === pujaCatalogId && (s.stage === 'draft' || s.stage === 'rejected'),
  )
  if (open) return clone(open)

  // A revision starts from what is already approved, not from a blank page — the
  // priest is almost always changing two lines, not rewriting the list.
  const live = REQUIREMENT_SHEETS.find(
    (s) => s.pujaCatalogId === pujaCatalogId && s.stage === 'approved',
  )
  const highestVersion = Math.max(
    0,
    ...REQUIREMENT_SHEETS.filter((s) => s.pujaCatalogId === pujaCatalogId).map((s) => s.version),
  )
  const now = new Date().toISOString()

  const created: PujaRequirementSheet = {
    id: nextId('req', REQUIREMENT_SHEETS),
    templeId: PUJA_BY_ID.get(pujaCatalogId)?.templeId ?? currentTempleId(),
    pujaCatalogId,
    version: highestVersion + 1,
    lines: live ? clone(live.lines) : [],
    estimatedCost: live ? live.estimatedCost : 0,
    stage: 'draft',
    history: [
      {
        at: now,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'drafted',
        note: live ? `Revision of v${live.version}` : undefined,
      },
    ],
    preparedById: actor.id,
    preparedByName: actor.name,
    createdAt: now,
    updatedAt: now,
  }

  REQUIREMENT_SHEETS.push(created)
  persistInventory((s) => {
    s.newSheets.push(created)
  })
  return clone(created)
}

/**
 * Save the lines the priest has typed.
 *
 * Unit costs are re-read from the item master on every save, so the estimate a desk
 * eventually sees is priced at what the store pays today rather than at whatever it
 * paid on the afternoon the line was first added. Once the sheet leaves `draft` nothing
 * calls this again — the figure finance allocated against must not move under it.
 */
export async function saveRequirementLines(
  id: UUID,
  lines: RequirementLine[],
): Promise<PujaRequirementSheet> {
  await simulateLatency()
  const sheet = REQUIREMENT_SHEETS.find((s) => s.id === id)
  if (!sheet) throw new Error('Unknown requirement sheet')

  const priced = lines.map((l) => {
    const item = STOCK_ITEMS.find((i) => i.id === l.itemId)
    return item ? { ...l, label: item.name, unit: item.unit, unitCost: item.unitCost } : l
  })

  patchSheet(sheet, { lines: priced, estimatedCost: costOfLines(priced) })
  return clone(sheet)
}

/** The priest sends it to accounts. A sheet with no lines is not a sheet. */
export async function submitRequirementSheet(
  id: UUID,
  actor: User,
  note?: string,
): Promise<PujaRequirementSheet> {
  await simulateLatency()
  const sheet = REQUIREMENT_SHEETS.find((s) => s.id === id)
  if (!sheet) throw new Error('Unknown requirement sheet')
  if (sheet.lines.length === 0) throw new Error('Add at least one requirement before submitting')

  // A sheet that was sent back is *resubmitted*, and the timeline says so. The two
  // read identically in the queue and very differently in the history.
  const action = sheet.history.some((h) => h.action === 'sent-back' || h.action === 'rejected')
    ? 'resubmitted'
    : 'submitted'
  step(sheet, 'finance-review', actor, action, note)
  return clone(sheet)
}

/**
 * Accounts put a figure against the sheet and pass it up.
 *
 * The allocation is per performance, not per year: multiplying it out by cadence is a
 * reporting question, and baking the multiplication into the stored figure would make
 * the number meaningless the first time a puja's cadence changed.
 */
export async function allocateRequirementBudget(
  id: UUID,
  amount: Money,
  actor: User,
  note?: string,
): Promise<PujaRequirementSheet> {
  await simulateLatency()
  const sheet = REQUIREMENT_SHEETS.find((s) => s.id === id)
  if (!sheet) throw new Error('Unknown requirement sheet')
  step(sheet, 'admin-review', actor, 'allocated', note, {
    allocatedAmount: Math.max(0, Math.round(amount)),
    allocationNote: note?.trim() || undefined,
  })
  return clone(sheet)
}

/** Accounts send it back to the priest. The reason is the whole message. */
export async function sendBackRequirementSheet(
  id: UUID,
  actor: User,
  note: string,
): Promise<PujaRequirementSheet> {
  await simulateLatency()
  const sheet = REQUIREMENT_SHEETS.find((s) => s.id === id)
  if (!sheet) throw new Error('Unknown requirement sheet')
  step(sheet, 'draft', actor, 'sent-back', note)
  return clone(sheet)
}

/**
 * The administrator signs it off, and the previous version stands down.
 *
 * Both writes happen here so there is never a moment with two approved sheets for one
 * puja — a readiness check that ran in that window would have to pick one arbitrarily,
 * and would pick differently on the next render.
 */
export async function approveRequirementSheet(
  id: UUID,
  actor: User,
  note?: string,
): Promise<PujaRequirementSheet> {
  await simulateLatency()
  const sheet = REQUIREMENT_SHEETS.find((s) => s.id === id)
  if (!sheet) throw new Error('Unknown requirement sheet')

  const incumbent = REQUIREMENT_SHEETS.find(
    (s) => s.pujaCatalogId === sheet.pujaCatalogId && s.stage === 'approved' && s.id !== sheet.id,
  )
  if (incumbent) {
    step(incumbent, 'superseded', actor, 'superseded', `Replaced by v${sheet.version}`)
  }

  step(sheet, 'approved', actor, 'approved', note)
  return clone(sheet)
}

export async function rejectRequirementSheet(
  id: UUID,
  actor: User,
  note: string,
): Promise<PujaRequirementSheet> {
  await simulateLatency()
  const sheet = REQUIREMENT_SHEETS.find((s) => s.id === id)
  if (!sheet) throw new Error('Unknown requirement sheet')
  step(sheet, 'rejected', actor, 'rejected', note)
  return clone(sheet)
}

/* ------------------------------------------------------------- pre-puja check */

/** The rolling window the priest's worklist covers. Two days, as the temple asked. */
export const READINESS_WINDOW_DAYS = 2

/**
 * Coverage for every occurrence in a window: sheets read against what is on the shelf.
 *
 * Demand is summed across the window as it walks, which is the difference between a
 * useful screen and a misleading one. Checked one occurrence at a time, six coconuts on
 * the shelf cover Thursday's puja and also cover Friday's and also cover Saturday's —
 * three green rows and an empty shelf. The `claimed` map spends the stock down in date
 * order, so the first puja is covered and the later one is honestly short.
 */
function buildReadinessRows(from: Date, to: Date): ReadinessRow[] {
  const bookingById = new Map(hereBookings().map((b) => [b.id, b]))
  const stockById = new Map(here(STOCK_ITEMS).map((i) => [i.id, i]))
  const readinessByOccurrence = new Map(PUJA_READINESS.map((r) => [r.occurrenceId, r]))

  /** Units already spoken for by an earlier occurrence in this same window. */
  const claimed = new Map<UUID, number>()

  const inWindow = OCCURRENCES.filter((o) => {
    const when = new Date(o.scheduledAt).getTime()
    return o.status === 'scheduled' && when >= from.getTime() && when <= to.getTime()
  }).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))

  const rows: ReadinessRow[] = []

  for (const occurrence of inWindow) {
    const booking = bookingById.get(occurrence.bookingId)
    const puja = booking ? PUJA_BY_ID.get(booking.pujaCatalogId) : undefined
    if (!booking || !puja) continue

    const sheet = REQUIREMENT_SHEETS.find(
      (s) => s.pujaCatalogId === puja.id && s.stage === 'approved',
    )
    const readiness = readinessByOccurrence.get(occurrence.id)

    const lines: ReadinessLine[] = (sheet?.lines ?? []).map((l) => {
      const item = stockById.get(l.itemId)
      const alreadyClaimed = claimed.get(l.itemId) ?? 0
      const available = Math.max(0, (item?.onHand ?? 0) - alreadyClaimed)
      claimed.set(l.itemId, alreadyClaimed + l.qty)
      return {
        itemId: l.itemId,
        label: l.label,
        unit: l.unit,
        required: l.qty,
        onHand: available,
        short: Math.max(0, l.qty - available),
        optional: Boolean(l.optional),
        perishable: Boolean(item?.perishable),
      }
    })

    // Optional lines never block. A missing agarbatti packet is not a reason to tell
    // a priest his puja cannot go ahead.
    const blocking = lines.filter((l) => !l.optional && l.short > 0)
    const shortfallCost = blocking.reduce((sum, l) => {
      const unitCost = sheet?.lines.find((x) => x.itemId === l.itemId)?.unitCost ?? 0
      return sum + l.short * unitCost
    }, 0)

    const state: ReadinessRow['state'] = !sheet
      ? 'no-sheet'
      : readiness?.status === 'flagged'
        ? 'flagged'
        : readiness?.status === 'confirmed'
          ? 'confirmed'
          : blocking.length > 0
            ? 'short'
            : 'ready'

    rows.push({
      occurrence,
      puja,
      sheet,
      lines,
      state,
      shortCount: blocking.length,
      shortfallCost,
      readiness,
      daysAway: Math.max(
        0,
        Math.round(
          (new Date(occurrence.scheduledAt).setHours(0, 0, 0, 0) - from.getTime()) / 86400000,
        ),
      ),
    })
  }

  return rows
}

/**
 * The priest's worklist: everything happening between now and `days` out.
 *
 * The window starts at midnight today rather than at this moment, so a puja at nine
 * this morning has not vanished from the list at ten past.
 */
export async function listReadiness(days = READINESS_WINDOW_DAYS): Promise<ReadinessRow[]> {
  await simulateLatency()
  const from = startOfDay(new Date())
  const to = endOfDay(new Date(from.getTime() + days * 86400000))
  return clone(buildReadinessRows(from, to))
}

/**
 * The priest signs off one occurrence, and the stock leaves the shelf.
 *
 * Issuing on confirmation rather than on completion is a deliberate choice about what
 * the store figure is *for*. It is there to answer "can the next puja go ahead?", and
 * once the flowers for Thursday have been set aside they cannot answer that question
 * for Friday as well. Optional lines are issued too when they are actually available —
 * they were used, whether or not their absence would have stopped anything.
 */
export async function confirmReadiness(
  occurrenceId: UUID,
  actor: User,
  note?: string,
): Promise<PujaReadiness> {
  await simulateLatency()

  const from = startOfDay(new Date())
  const to = endOfDay(new Date(from.getTime() + READINESS_WINDOW_DAYS * 86400000))
  const row = buildReadinessRows(from, to).find((r) => r.occurrence.id === occurrenceId)
  if (!row) throw new Error('That puja is no longer in the readiness window')
  if (!row.sheet) throw new Error('This puja has no approved requirement sheet')
  // Confirming twice would issue the stock twice, and the second issue would be a
  // fiction the ledger could not distinguish from a real one.
  if (row.readiness?.status === 'confirmed') return clone(row.readiness)

  const movementIds: UUID[] = []
  for (const line of row.sheet.lines) {
    const item = STOCK_ITEMS.find((i) => i.id === line.itemId)
    if (!item) continue
    // Never issue more than is actually there — the count would go straight back to
    // zero on the clamp in `postMovement` and the ledger would record a fiction.
    const qty = Math.min(line.qty, item.onHand)
    if (qty <= 0) continue
    const movement = postMovement(item, 'issued', -qty, actor.name, {
      pujaCatalogId: row.puja.id,
      occurrenceId,
      note: `Issued for ${row.puja.name}`,
    })
    movementIds.push(movement.id)
  }

  return upsertReadiness(occurrenceId, 'confirmed', actor, note, movementIds)
}

/**
 * The priest looked and it is short.
 *
 * Nothing is issued. The row stays on the worklist as a flagged, explained problem
 * rather than disappearing, because the store run it implies has not happened yet.
 */
export async function flagReadiness(
  occurrenceId: UUID,
  actor: User,
  note: string,
): Promise<PujaReadiness> {
  await simulateLatency()
  return upsertReadiness(occurrenceId, 'flagged', actor, note, [])
}

/** One sign-off per occurrence — a second decision replaces the first, it does not stack. */
function upsertReadiness(
  occurrenceId: UUID,
  status: PujaReadiness['status'],
  actor: User,
  note: string | undefined,
  movementIds: UUID[],
): PujaReadiness {
  const existing = PUJA_READINESS.find((r) => r.occurrenceId === occurrenceId)
  const record: PujaReadiness = {
    id: existing?.id ?? nextId('rdy', PUJA_READINESS),
    occurrenceId,
    status,
    note: note?.trim() || undefined,
    byId: actor.id,
    byName: actor.name,
    at: new Date().toISOString(),
    // Movements from an earlier confirmation are kept: the stock really did leave the
    // shelf, and dropping the ids would orphan those ledger rows from their cause.
    movementIds: [...(existing?.movementIds ?? []), ...movementIds],
  }

  if (existing) Object.assign(existing, record)
  else PUJA_READINESS.push(record)

  persistInventory((s) => {
    s.newReadiness = [...s.newReadiness.filter((r) => r.occurrenceId !== occurrenceId), record]
  })
  return clone(record)
}

/** Headline figures for the store and the chain — the tiles on both screens. */
export interface StoresStats {
  itemsTracked: number
  lowStock: number
  stockValue: Money
  awaitingFinance: number
  awaitingAdmin: number
  approvedSheets: number
  /** Pujas with no sheet in force at all — the gap nobody has noticed. */
  pujasWithoutSheet: number
  /** Occurrences in the window still waiting on the priest. */
  readinessPending: number
  readinessShort: number
}

export async function getStoresStats(): Promise<StoresStats> {
  await simulateLatency()
  const active = here(STOCK_ITEMS).filter((i) => i.active)
  const sheets = hereSheets()
  const approved = sheets.filter((s) => s.stage === 'approved')
  const from = startOfDay(new Date())
  const rows = buildReadinessRows(
    from,
    endOfDay(new Date(from.getTime() + READINESS_WINDOW_DAYS * 86400000)),
  )

  return {
    itemsTracked: active.length,
    lowStock: active.filter((i) => i.onHand <= i.reorderLevel).length,
    stockValue: active.reduce((sum, i) => sum + i.onHand * i.unitCost, 0),
    awaitingFinance: sheets.filter((s) => s.stage === 'finance-review').length,
    awaitingAdmin: sheets.filter((s) => s.stage === 'admin-review').length,
    approvedSheets: approved.length,
    pujasWithoutSheet: here(PUJA_CATALOG).filter(
      (p) => p.active !== false && !approved.some((s) => s.pujaCatalogId === p.id),
    ).length,
    readinessPending: rows.filter((r) => r.state === 'ready' || r.state === 'short').length,
    readinessShort: rows.filter((r) => r.state === 'short' || r.state === 'flagged').length,
  }
}
