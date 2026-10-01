export type UUID = string
export type ISODate = string
export type Money = number // whole units of the record's own currency (see types.sai.ts)

export * from './types.sai'
import type { CountryCode, CurrencyCode, LanguageCode, TempleTenantProfile } from './types.sai'

export interface Temple extends TempleTenantProfile {
  id: UUID
  name: string
  address: string
  city: string
  state: string
  zip: string
  country: CountryCode
  phone: string
  email: string
  timezone: string
  timings: { morning: string; evening: string }
  logoUrl: string
  deities: string[]
}

/** `platform` staff onboard temples and see across all of them. */
export type Role = 'devotee' | 'admin' | 'board' | 'priest' | 'finance' | 'committee' | 'platform'

export interface User {
  id: UUID
  role: Role
  name: string
  email: string
  phone: string // immutable identity anchor
  address?: string
  city?: string
  state?: string
  zip?: string
  country: 'US' | 'IN' | 'GB' | 'CA' | 'Other'
  /** The temple this devotee calls home. Devotee accounts are global. */
  homeTempleId?: UUID
  language?: LanguageCode
  nakshatra?: string
  gothra?: string
  dob?: ISODate
  familyTreeId?: UUID
  membershipId?: UUID
  createdAt: ISODate
  avatarInitials: string
}

export interface FamilyTree {
  id: UUID
  primaryUserId: UUID
  members: FamilyMember[]
}
export interface FamilyMember {
  name: string
  relation: 'spouse' | 'son' | 'daughter' | 'parent' | 'other'
  nakshatra?: string
  gothra?: string
  isAdultBranch?: boolean
}

export type Cadence = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'one-time'
export type PujaType = 'yearly' | 'monthly' | 'one-time' | 'abhishekam' | 'alangaram'

export interface PujaCatalogItem {
  /** Owning temple. Absent on legacy records = the flagship. */
  templeId?: UUID
  /** Currency of every amount on this record (the temple's own). */
  currency?: CurrencyCode
  id: UUID
  name: string // e.g. "Murugar Puja"
  deity: string // e.g. "Murugan"
  type: PujaType
  basePrice: Money
  durationMin: number
  defaultCadence: Cadence
  recurringRule?: string // human-readable: "Every 3rd Thursday"
  description: string
  imageUrl?: string
  addOns?: PujaAddOn[]
  active?: boolean
}
export interface PujaAddOn {
  id: string
  label: string
  /** One line under the label on the booking step. Lives here so adding an add-on
   *  does not mean editing a switch in the booking JSX. */
  blurb: string
  price: Money
}

/**
 * Where a booking has reached in the temple's approval chain.
 *
 * Deliberately a *different axis* from `Booking.status`. That field is the sponsorship's
 * lifecycle — running, paused, finished — and half the console's money figures are derived
 * from it. Approval is the question of whether the sponsorship should be running at all,
 * so it lives here and leaves those figures alone. A booking is `status: 'pending'` for
 * every stage below except `scheduled` (which makes it `'active'`) and `declined`
 * (which makes it `'cancelled'`).
 */
export type ApprovalStage =
  /** With the accounts desk, awaiting verification that the money actually arrived. */
  | 'finance-review'
  /** Accounts sent it back — the payment did not come through and can still be settled. */
  | 'payment-pending'
  /** Payment verified; waiting on the puja committee to put a priest on it. */
  | 'committee-review'
  /** A priest is assigned and the sponsorship is live. */
  | 'scheduled'
  /** Refused outright, with a reason. */
  | 'declined'

/** One hand-off in the chain. Together these are the booking's audit trail. */
export interface ApprovalEvent {
  at: ISODate
  actorId: UUID
  actorName: string
  actorRole: Role
  action:
    | 'submitted'
    | 'payment-verified'
    | 'sent-back'
    | 'resubmitted'
    | 'declined'
    | 'priest-assigned'
    | 'priest-reassigned'
  /** The typed reason. Required by the UI for `sent-back` and `declined`. */
  note?: string
}

/**
 * What the accounts desk checks against.
 *
 * `method` is what the devotee said they would use; `reference` is the transaction id or
 * cheque number the desk actually matched against the bank statement. Verifying without a
 * reference would record that someone looked, but not what they looked at.
 */
export interface PaymentRecord {
  method: 'card' | 'ach' | 'zelle' | 'check' | 'cash'
  reference?: string
  receivedAt?: ISODate
  verifiedBy?: UUID
  verifiedAt?: ISODate
}

export interface Booking {
  /** Owning temple. Absent on legacy records = the flagship. */
  templeId?: UUID
  /** Currency of every amount on this record (the temple's own). */
  currency?: CurrencyCode
  id: UUID
  userId: UUID
  pujaCatalogId: UUID
  cadence: Cadence
  startDate: ISODate
  endDate: ISODate // for yearly: startDate + 365 days
  sankalpamNames: string[]
  addOns: string[]
  amount: Money
  /** `'pending'` means it has not cleared approval — it is not yet real money. */
  status: 'pending' | 'active' | 'paused' | 'completed' | 'cancelled'
  /** Absent on the historic seed; every booking created from now on carries one. */
  approval?: { stage: ApprovalStage; history: ApprovalEvent[] }
  payment?: PaymentRecord
  /** The committee's default priest, copied onto every occurrence it generates. */
  assignedPriestId?: UUID
  createdAt: ISODate
}

export interface PujaOccurrence {
  id: UUID
  bookingId: UUID
  scheduledAt: ISODate
  fulfilledAt?: ISODate
  /** Display name of the priest. Kept as the denormalised label the roster prints. */
  officiant?: string
  /** `Staff.id` of the assigned priest — what a reassignment actually writes. */
  officiantId?: UUID
  notes?: string
  status: 'scheduled' | 'completed' | 'skipped'
}

export type DonationCategory =
  | 'general-hundi'
  | 'annadanam'
  | 'puja'
  | 'abhishekam'
  | 'goshala'
  | 'vedic-school'
  | 'building'
  | 'event'
  | 'other'

export interface DonorContact {
  firstName: string
  lastName: string
  email: string
  phone: string
}

export interface Donation {
  /** Owning temple. Absent on legacy records = the flagship. */
  templeId?: UUID
  /** Currency of every amount on this record (the temple's own). */
  currency?: CurrencyCode
  id: UUID
  userId: UUID | null // null when the gift came from a guest — see `donor`
  donor?: DonorContact
  category: DonationCategory
  amount: Money
  isRecurring: boolean
  recurringCadence?: Cadence
  paymentMethod: 'card' | 'ach' | 'zelle' | 'check' | 'cash'
  dedicatedTo?: string
  /** Set when `category` is `event` — the festival this gift sponsors. */
  eventId?: UUID
  /** Labels of the sponsorship items chosen, in the order they are offered. */
  eventItems?: string[]
  taxReceiptId?: UUID
  createdAt: ISODate
}

export type MembershipTier = 'silver' | 'gold' | 'platinum'
export interface Membership {
  /** Owning temple. Absent on legacy records = the flagship. */
  templeId?: UUID
  id: UUID
  userId: UUID
  tier: MembershipTier
  startDate: ISODate
  endDate: ISODate
  autoRenew: boolean
  familyPlan: boolean
  status: 'active' | 'expired' | 'cancelled'
}

export interface TempleEvent {
  /** Owning temple. Absent on legacy records = the flagship. */
  templeId?: UUID
  /** Currency of every amount on this record (the temple's own). */
  currency?: CurrencyCode
  id: UUID
  title: string
  slug: string
  date: ISODate
  endDate?: ISODate
  flyerUrl?: string
  description: string
  targetAmount: Money
  collectedAmount: Money
  costs: EventCost[]
  /** The three named pieces of this festival a devotee can sponsor outright. */
  sponsorships: EventSponsorship[]
  ticketPrice?: Money
  rsvpCount: number
  status: 'upcoming' | 'ongoing' | 'completed'
}
export interface EventCost {
  label: string
  amount: Money
}

/**
 * A named piece of a festival a devotee can sponsor — the flowers, the annadanam, the
 * priests' dakshina. Priced per event, so sponsoring the flowers at Chithirai costs
 * more than at Rama Navami. Distinct from `costs`, which is the published budget the
 * temple reports against; these are the items actually offered for sponsorship.
 */
export interface EventSponsorship {
  key: string
  label: string
  blurb: string
  price: Money
}

export interface FacilityBooking {
  /** Owning temple. Absent on legacy records = the flagship. */
  templeId?: UUID
  /** Currency of every amount on this record (the temple's own). */
  currency?: CurrencyCode
  id: UUID
  userId: UUID
  facility: 'main-hall' | 'mini-hall' | 'canteen'
  date: ISODate
  items: { label: string; qty: number; price: Money }[]
  total: Money
  status: 'pending' | 'confirmed' | 'cancelled'
}

export interface Project {
  /** Owning temple. Absent on legacy records = the flagship. */
  templeId?: UUID
  /** Currency of every amount on this record (the temple's own). */
  currency?: CurrencyCode
  id: UUID
  title: string
  targetAmount: Money
  raisedAmount: Money
  spentAmount: Money
  progressPct: number
  status: 'planned' | 'in-progress' | 'completed'
  notes: string[]
}

/**
 * One head of the board-approved annual budget — what the target is actually *for*.
 * The heads reconcile to the snapshot exactly: `targetAmount` sums to `annualTarget`
 * and `collectedAmount` sums to `ytdCollected`. The breakdown table asserts this, so
 * a head that is edited without rebalancing its siblings shows up as a variance row
 * rather than quietly disagreeing with the headline tiles.
 */
export interface TargetAllocation {
  key: string
  label: string
  /** One line on what the head pays for — read directly under the label. */
  detail: string
  /** Share of the annual target earmarked for this head. */
  targetAmount: Money
  /** Raised against this head so far this year. */
  collectedAmount: Money
  /** Disbursed against this head so far this year. */
  spentAmount: Money
}

export interface TransparencySnapshot {
  /** Owning temple. Absent on legacy records = the flagship. */
  templeId?: UUID
  /** Currency of every amount on this record (the temple's own). */
  currency?: CurrencyCode
  ytdCollected: Money
  annualTarget: Money
  balanceToBreakeven: Money
  achievedPct: number
  updatedAt: ISODate
  /** Where the annual target goes, largest head first. */
  allocations: TargetAllocation[]
}

/* ---- Supporting types (not persisted anywhere real) ---- */

export interface RecurringRule {
  /** Owning temple. Absent on legacy records = the flagship. */
  templeId?: UUID
  id: UUID
  label: string
  dayOfWeek: number // 0 = Sunday
  time: string // "19:00"
  pujaCatalogId?: UUID
  nth?: number // e.g. 3 => "3rd Thursday"
}

export interface PujaPnLRow {
  puja: PujaCatalogItem
  sponsors: number
  collected: Money
  cost: Money
  net: Money
  progressPct: number
}

export interface Staff {
  /** Owning temple. Absent on legacy records = the flagship. */
  templeId?: UUID
  id: UUID
  name: string
  role: Role
  title: string
  phone: string
  email: string
}

/* ---------------------------------------------------------------- volunteers */

/**
 * The volunteer side of a festival, in five entities.
 *
 * The shape here follows the same two-axis reasoning as `ApprovalStage` versus
 * `Booking.status`: what the temple *asked* and what the temple *got* are different
 * questions, so they are different records. A `VolunteerInvite` is the audit trail of
 * outreach — who was written to, on which channel, and what came back. A
 * `VolunteerAssignment` is current state — who is actually standing at the parking gate
 * on the day. Collapsing them would make "we asked forty people and eleven turned up"
 * unanswerable, and that ratio is the only number a coordinator plans next year from.
 *
 * It also lets a coordinator put somebody on the roster who was never invited — the
 * cousin who walked in on the morning — without inventing a fake invitation for them.
 */

/** The ten jobs a festival actually needs bodies for. Doubles as a volunteer's skills. */
export type VolunteerSkill =
  | 'kitchen'
  | 'decoration'
  | 'parking'
  | 'registration'
  | 'prasadam'
  | 'crowd'
  | 'cleanup'
  | 'av'
  | 'youth'
  | 'security'

export type VolunteerChannel = 'email' | 'sms' | 'both'

export interface Volunteer {
  /** Owning temple. Absent on legacy records = the flagship. */
  templeId?: UUID
  id: UUID
  name: string
  email: string
  phone: string
  city: string
  skills: VolunteerSkill[]
  /** Set when this volunteer is also a registered devotee, so the two records agree. */
  userId?: UUID
  /** Free text the coordinator reads, never filtered on — "leaves by 8pm", "no lifting". */
  notes?: string
  /** `paused` keeps the history but drops them out of every outreach audience. */
  status: 'active' | 'paused'
  joinedAt: ISODate
  avatarInitials: string
}

/** One line of the campaign's ask: this job, this many people. */
export interface VolunteerNeed {
  roleKey: VolunteerSkill
  label: string
  blurb: string
  needed: number
}

export interface VolunteerCampaign {
  /** Owning temple. Absent on legacy records = the flagship. */
  templeId?: UUID
  id: UUID
  /** The festival this staffs. A campaign never exists without an event behind it. */
  eventId: UUID
  title: string
  description: string
  /** The briefing, which is deliberately earlier than the festival itself. */
  briefingAt: ISODate
  coordinatorId: UUID
  needs: VolunteerNeed[]
  /**
   * `draft` has never been broadcast; the first send moves it to `recruiting`. `staffed`
   * is the coordinator's own judgement that every role is covered, not a computed state —
   * a role can be one short and still be fine, and only they know that.
   */
  status: 'draft' | 'recruiting' | 'staffed' | 'completed' | 'cancelled'
  createdAt: ISODate
}

/** The filter that resolved into a recipient list, kept so a send can be explained later. */
export interface VolunteerAudience {
  /** Empty means every skill — "anyone who can help". */
  skills: VolunteerSkill[]
  city?: string
  excludeInvited: boolean
  excludeRostered: boolean
}

/** One broadcast. Recipients are resolved at send time and frozen here. */
export interface VolunteerMessage {
  id: UUID
  campaignId: UUID
  channel: VolunteerChannel
  subject: string
  body: string
  recipientIds: UUID[]
  sentAt: ISODate
  sentByName: string
  audience: VolunteerAudience
}

export interface VolunteerInvite {
  id: UUID
  campaignId: UUID
  volunteerId: UUID
  messageId: UUID
  channel: VolunteerChannel
  /** `no-response` is set by the coordinator closing the loop, never by the passage of time. */
  status: 'sent' | 'accepted' | 'declined' | 'no-response'
  sentAt: ISODate
  respondedAt?: ISODate
  /** Why they declined — the coordinator's only record of it. */
  note?: string
}

export interface VolunteerAssignment {
  id: UUID
  campaignId: UUID
  volunteerId: UUID
  roleKey: VolunteerSkill
  shift: string
  status: 'pending' | 'confirmed' | 'checked-in' | 'no-show' | 'withdrawn'
  /** `invited` traces to an accepted invite; `direct` was placed by the coordinator. */
  source: 'invited' | 'direct'
  inviteId?: UUID
  addedAt: ISODate
  note?: string
}

/** Per-role staffing, computed from needs against the roster. */
export interface StaffingRow {
  roleKey: VolunteerSkill
  label: string
  needed: number
  confirmed: number
  pending: number
  short: number
}

/* ------------------------------------------------- stores, requirements, readiness */

/**
 * What a puja needs, what it costs, and whether the temple actually has it.
 *
 * Three records, split along the same seam as `ApprovalStage` versus `Booking.status`:
 * what the temple *intends* to use, what it *holds*, and what it *did* with it.
 *
 * `PujaRequirementSheet` is intent — the priest's standing list for a puja, agreed
 * once and reused for every performance of it. `StockItem.onHand` is holdings.
 * `StockMovement` is the history of every change to those holdings. Collapsing the
 * last two would make "we bought 5kg of ghee on Monday and have 800g on Friday"
 * unanswerable, and that gap is the only thing that tells a store keeper whether
 * consumption is normal or something walked off.
 *
 * Coverage — "is there enough for Thursday's abhishekam?" — is deliberately *not* a
 * record. It is the sheet read against `onHand` at the moment somebody asks, computed
 * into `ReadinessRow`. Storing it would let a cached "ready" outlive the stock it was
 * asserted about, which is precisely the failure this feature exists to prevent.
 */

/** Units a temple store actually counts in. Deliberately short — no unit conversion. */
export type StockUnit = 'pc' | 'kg' | 'g' | 'l' | 'ml' | 'bunch' | 'packet' | 'metre'

export type StockCategory =
  | 'flowers'
  | 'fruits'
  | 'dairy'
  | 'grains'
  | 'dravyam'
  | 'cloth'
  | 'lamp'
  | 'other'

export interface StockItem {
  /** Owning temple. Absent on legacy records = the flagship. */
  templeId?: UUID
  /** Currency of every amount on this record (the temple's own). */
  currency?: CurrencyCode
  id: UUID
  name: string
  category: StockCategory
  unit: StockUnit
  /** Quantity held right now. Every change to it also writes a `StockMovement`. */
  onHand: number
  /** At or below this the item reads as low and joins the reorder list. */
  reorderLevel: number
  /** Cost of one `unit` — the basis every requirement estimate is costed against. */
  unitCost: Money
  /** Where it is kept. Free text the store keeper reads, never filtered on. */
  storage?: string
  /** Perishables cannot be stocked ahead, so a shortfall in one is more urgent. */
  perishable: boolean
  active: boolean
  updatedAt: ISODate
}

/**
 * One change to a holding, signed.
 *
 * `balance` is the resulting on-hand figure, stored rather than re-summed. The ledger
 * is read far more often than it is written, and a running balance that has to be
 * recomputed from the head of the list every render is both slow and — the moment one
 * movement is ever back-dated — quietly wrong.
 */
export interface StockMovement {
  id: UUID
  itemId: UUID
  /** `received` and a positive `adjusted` add; `issued` and `wastage` subtract. */
  kind: 'received' | 'issued' | 'adjusted' | 'wastage'
  /** Signed, in the item's own unit. */
  qty: number
  balance: number
  /** Set on `issued` — which puja consumed it, so per-puja usage is answerable. */
  pujaCatalogId?: UUID
  occurrenceId?: UUID
  note?: string
  actorName: string
  at: ISODate
}

/** One line of a requirement sheet: this item, this much, for one performance. */
export interface RequirementLine {
  itemId: UUID
  /** Denormalised. A sheet approved last year must still read correctly after the
   *  item was renamed, and the figure finance signed off cannot move under it. */
  label: string
  unit: StockUnit
  qty: number
  /** Unit cost at the moment the sheet was costed — what the allocation was based on. */
  unitCost: Money
  /** Nice to have rather than required. Never counts towards a blocking shortfall. */
  optional?: boolean
  note?: string
}

/**
 * Where a requirement sheet has reached.
 *
 * `rejected` is not terminal — the priest revises and it returns to `draft`. It is a
 * distinct stage rather than a flag so a rejected sheet does not sit in the drafts list
 * looking like something nobody has got to yet.
 */
export type RequirementStage =
  /** The priest is still writing it. Not visible to any desk. */
  | 'draft'
  /** Submitted — accounts must put a per-performance figure against it. */
  | 'finance-review'
  /** Costed and allocated; waiting on the administrator's sign-off. */
  | 'admin-review'
  /** Live. Every occurrence of this puja checks stock against it. */
  | 'approved'
  /** Refused, with a reason. Revisable. */
  | 'rejected'
  /** Replaced by a later approved version, kept for the audit trail. */
  | 'superseded'

/** One hand-off in the requirement chain. Same shape as `ApprovalEvent`, on purpose. */
export interface RequirementEvent {
  at: ISODate
  actorId: UUID
  actorName: string
  actorRole: Role
  action:
    | 'drafted'
    | 'submitted'
    | 'allocated'
    | 'sent-back'
    | 'resubmitted'
    | 'approved'
    | 'rejected'
    | 'superseded'
  /** The typed reason. Required by the UI for `sent-back` and `rejected`. */
  note?: string
}

export interface PujaRequirementSheet {
  /** Owning temple. Absent on legacy records = the flagship. */
  templeId?: UUID
  id: UUID
  pujaCatalogId: UUID
  /** Bumped when an approved sheet is replaced, so history reads as v1, v2, v3. */
  version: number
  lines: RequirementLine[]
  /** `lines` costed at the unit costs frozen on them — what finance was asked for. */
  estimatedCost: Money
  /** What finance actually granted per performance. May differ from the estimate. */
  allocatedAmount?: Money
  allocationNote?: string
  stage: RequirementStage
  history: RequirementEvent[]
  preparedById: UUID
  preparedByName: string
  createdAt: ISODate
  updatedAt: ISODate
}

/** The priest's sign-off on one upcoming occurrence. Coverage itself is computed. */
export interface PujaReadiness {
  id: UUID
  occurrenceId: UUID
  /** `flagged` means he looked and it is short — an answer, not an absence of one. */
  status: 'confirmed' | 'flagged'
  note?: string
  byId: UUID
  byName: string
  at: ISODate
  /** Movements the confirmation posted, so an issue can be traced back to its cause. */
  movementIds: UUID[]
}

/* ---- Computed, never persisted ---- */

/** Per-item coverage for one occurrence: what it needs against what the store holds. */
export interface ReadinessLine {
  itemId: UUID
  label: string
  unit: StockUnit
  required: number
  onHand: number
  /** How many units are missing. Zero when covered. */
  short: number
  optional: boolean
  perishable: boolean
}

/**
 * One row of the priest's pre-puja worklist.
 *
 * `state` folds the two questions the screen answers into one value: has anybody looked
 * at this yet, and is there enough. `no-sheet` is called out separately from `short`
 * because they need opposite responses — one is a shopping trip, the other is a
 * conversation with whoever never wrote the requirements down.
 */
export interface ReadinessRow {
  occurrence: PujaOccurrence
  puja: PujaCatalogItem
  sheet?: PujaRequirementSheet
  lines: ReadinessLine[]
  state: 'no-sheet' | 'ready' | 'short' | 'confirmed' | 'flagged'
  shortCount: number
  /** Cost of the units missing — what a store run would have to spend. */
  shortfallCost: Money
  readiness?: PujaReadiness
  /** Days until it is performed. Negative never appears; the window starts at today. */
  daysAway: number
}
