/**
 * Row mappers: snake_case Postgres rows (see supabase/migrations/0001_schema.sql) <-> camelCase
 * domain types. Pure functions, type-only imports, so they run under plain Node for the fixture
 * test (`npm run test:backend -w @saibaba/core`).
 *
 * Covered tables: temples, donations, bookings (+ approval events), aarti_slots, vrat_enrollments.
 * Anything not listed here has no mapper yet; see docs/BACKEND.md "migration checklist".
 * UNTESTED AGAINST A LIVE PROJECT: shapes were written against the migration SQL and exercised
 * against fixtures shaped like PostgREST output.
 */
import type {
  AartiSlot,
  ApprovalEvent,
  ApprovalStage,
  Booking,
  CountryCode,
  CurrencyCode,
  Donation,
  Role,
  Temple,
  VratEnrollment,
} from '../types'

/** PostgREST returns numeric(12,2) as a JSON number, but some drivers/paths give strings. */
const num = (v: number | string): number => (typeof v === 'number' ? v : Number(v))
const nn = <T>(v: T | null | undefined): T | undefined => (v === null || v === undefined ? undefined : v)
/** 'HH:MM:SS' (Postgres time) -> 'HH:mm'. */
const hhmm = (t: string) => t.slice(0, 5)
const day = (d: string) => d.slice(0, 10)

/* ------------------------------------------------------------------ temples */

export interface DbTempleRow {
  id: string
  legacy_id?: string | null
  slug: string
  name: string
  address: string
  city: string
  state: string
  zip: string
  country: string
  phone: string
  email: string
  timezone: string
  timings: { morning?: string; evening?: string } | null
  logo_url: string
  deities: string[]
  currency: string
  locale: string
  languages: string[]
  tax_regime: string
  tax_id: string
  tax_id_label: string
  lat: number | null
  lng: number | null
  about: string
  spaces: Temple['spaces'] | null
  payments: string[]
  ships_to: string[]
  status: string
  is_demo: boolean
  brand_hex?: string | null
}

export function templeFromRow(r: DbTempleRow): Temple {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    address: r.address,
    city: r.city,
    state: r.state,
    zip: r.zip,
    country: r.country as CountryCode,
    phone: r.phone,
    email: r.email,
    timezone: r.timezone,
    timings: { morning: r.timings?.morning ?? '', evening: r.timings?.evening ?? '' },
    logoUrl: r.logo_url,
    deities: r.deities,
    currency: r.currency as CurrencyCode,
    locale: r.locale,
    languages: r.languages as Temple['languages'],
    taxRegime: r.tax_regime as Temple['taxRegime'],
    taxId: r.tax_id,
    taxIdLabel: r.tax_id_label,
    lat: r.lat ?? 0,
    lng: r.lng ?? 0,
    about: r.about,
    spaces: r.spaces ?? [],
    payments: r.payments as Temple['payments'],
    shipsTo: r.ships_to as CountryCode[],
    status: r.status as Temple['status'],
    isDemo: r.is_demo,
    brandHex: nn(r.brand_hex),
  }
}

/** Columns a temple admin may write (status / isDemo are platform-only and deliberately absent). */
export function templeToRow(t: Partial<Temple>): Record<string, unknown> {
  const m: Record<string, unknown> = {
    slug: t.slug,
    name: t.name,
    address: t.address,
    city: t.city,
    state: t.state,
    zip: t.zip,
    country: t.country,
    phone: t.phone,
    email: t.email,
    timezone: t.timezone,
    timings: t.timings,
    logo_url: t.logoUrl,
    deities: t.deities,
    currency: t.currency,
    locale: t.locale,
    languages: t.languages,
    tax_regime: t.taxRegime,
    tax_id: t.taxId,
    tax_id_label: t.taxIdLabel,
    lat: t.lat,
    lng: t.lng,
    about: t.about,
    spaces: t.spaces,
    payments: t.payments,
    ships_to: t.shipsTo,
    brand_hex: t.brandHex,
  }
  return Object.fromEntries(Object.entries(m).filter(([, v]) => v !== undefined))
}

/* ---------------------------------------------------------------- donations */

export interface DbDonationRow {
  id: string
  temple_id: string
  user_id: string | null
  donor_first_name?: string | null
  donor_last_name?: string | null
  donor_email?: string | null
  donor_phone?: string | null
  category: string
  amount: number | string
  currency: string
  provider?: string
  payment_method: string
  is_recurring: boolean
  recurring_cadence?: string | null
  dedicated_to?: string | null
  event_id?: string | null
  event_items?: string[] | null
  receipt_id?: string | null
  status?: string
  created_at: string
}

export function donationFromRow(r: DbDonationRow): Donation {
  const guest = !r.user_id && (r.donor_email || r.donor_phone)
  return {
    id: r.id,
    templeId: r.temple_id,
    currency: r.currency as CurrencyCode,
    userId: r.user_id,
    donor: guest
      ? { firstName: r.donor_first_name ?? '', lastName: r.donor_last_name ?? '', email: r.donor_email ?? '', phone: r.donor_phone ?? '' }
      : undefined,
    category: r.category as Donation['category'],
    amount: num(r.amount),
    isRecurring: r.is_recurring,
    recurringCadence: nn(r.recurring_cadence) as Donation['recurringCadence'],
    paymentMethod: r.payment_method as Donation['paymentMethod'],
    dedicatedTo: nn(r.dedicated_to),
    eventId: nn(r.event_id),
    eventItems: r.event_items && r.event_items.length ? r.event_items : undefined,
    taxReceiptId: nn(r.receipt_id),
    createdAt: r.created_at,
  }
}

/**
 * Insert shape for a donation. RLS only lets a devotee insert a *pending* gift for themselves; the
 * webhook flips it to succeeded. Guests are created by the payments function, not from the browser.
 */
export function donationToInsert(
  d: Omit<Donation, 'id' | 'createdAt' | 'taxReceiptId'>,
  templeId: string,
  currency: CurrencyCode,
): Record<string, unknown> {
  return {
    temple_id: templeId,
    user_id: d.userId,
    category: d.category,
    amount: d.amount,
    currency,
    payment_method: d.paymentMethod,
    is_recurring: d.isRecurring,
    recurring_cadence: d.recurringCadence ?? null,
    dedicated_to: d.dedicatedTo ?? null,
    event_id: d.eventId ?? null,
    event_items: d.eventItems ?? [],
  }
}

/* ----------------------------------------------------------------- bookings */

export interface DbBookingRow {
  id: string
  temple_id: string
  user_id: string
  puja_catalog_id: string
  cadence: string
  start_date: string
  end_date: string
  sankalpam_names: string[]
  add_ons: string[]
  amount: number | string
  currency: string
  status: string
  approval_stage: string
  payment_method?: string | null
  payment_reference?: string | null
  payment_received_at?: string | null
  payment_verified_by?: string | null
  payment_verified_at?: string | null
  assigned_priest_id?: string | null
  created_at: string
}

export interface DbApprovalEventRow {
  at: string
  actor_id: string | null
  actor_name: string
  actor_role: string
  action: string
  note?: string | null
}

export function approvalEventFromRow(r: DbApprovalEventRow): ApprovalEvent {
  return {
    at: r.at,
    actorId: r.actor_id ?? '',
    actorName: r.actor_name,
    actorRole: r.actor_role as Role,
    action: r.action as ApprovalEvent['action'],
    note: nn(r.note),
  }
}

export function bookingFromRow(r: DbBookingRow, events: DbApprovalEventRow[] = []): Booking {
  const hasPayment = r.payment_method || r.payment_reference || r.payment_received_at
  return {
    id: r.id,
    templeId: r.temple_id,
    currency: r.currency as CurrencyCode,
    userId: r.user_id,
    pujaCatalogId: r.puja_catalog_id,
    cadence: r.cadence as Booking['cadence'],
    startDate: day(r.start_date),
    endDate: day(r.end_date),
    sankalpamNames: r.sankalpam_names,
    addOns: r.add_ons,
    amount: num(r.amount),
    status: r.status as Booking['status'],
    approval: {
      stage: r.approval_stage as ApprovalStage,
      history: events.slice().sort((a, b) => a.at.localeCompare(b.at)).map(approvalEventFromRow),
    },
    payment: hasPayment
      ? {
          method: (r.payment_method ?? 'card') as NonNullable<Booking['payment']>['method'],
          reference: nn(r.payment_reference),
          receivedAt: nn(r.payment_received_at),
          verifiedBy: nn(r.payment_verified_by),
          verifiedAt: nn(r.payment_verified_at),
        }
      : undefined,
    assignedPriestId: nn(r.assigned_priest_id),
    createdAt: r.created_at,
  }
}

/* -------------------------------------------------------------------- aarti */

export interface DbAartiSlotRow {
  id: string
  temple_id: string
  key: string
  name: string
  time: string
  days: number[]
  duration_min: number
  description: string
  active: boolean
  sponsorable: boolean
  sponsor_puja_id?: string | null
}

export function aartiSlotFromRow(r: DbAartiSlotRow): AartiSlot {
  return {
    id: r.id,
    templeId: r.temple_id,
    key: r.key as AartiSlot['key'],
    name: r.name,
    time: hhmm(r.time),
    days: r.days,
    durationMin: r.duration_min,
    description: r.description,
    active: r.active,
    sponsorable: r.sponsorable,
    sponsorPujaId: nn(r.sponsor_puja_id),
  }
}

export function aartiSlotToRow(s: Omit<AartiSlot, 'id'> & { id?: string }): Record<string, unknown> {
  return {
    ...(s.id ? { id: s.id } : {}),
    temple_id: s.templeId,
    key: s.key,
    name: s.name,
    time: s.time,
    days: s.days,
    duration_min: s.durationMin,
    description: s.description,
    active: s.active,
    sponsorable: s.sponsorable,
    sponsor_puja_id: s.sponsorPujaId ?? null,
  }
}

/* --------------------------------------------------------------------- vrat */

export interface DbVratEnrollmentRow {
  id: string
  user_id: string
  temple_id: string
  program_id: string
  start_date: string
  intention?: string | null
  observed_on: string[]
  status: string
  completed_at?: string | null
  reminder_channels: string[]
  created_at: string
}

export function vratEnrollmentFromRow(r: DbVratEnrollmentRow): VratEnrollment {
  return {
    id: r.id,
    userId: r.user_id,
    templeId: r.temple_id,
    programId: r.program_id,
    startDate: day(r.start_date),
    intention: nn(r.intention),
    observedOn: r.observed_on.map(day),
    status: r.status as VratEnrollment['status'],
    completedAt: nn(r.completed_at),
    reminderChannels: r.reminder_channels as VratEnrollment['reminderChannels'],
    createdAt: r.created_at,
  }
}

export function vratEnrollmentToRow(e: Omit<VratEnrollment, 'id' | 'createdAt'>): Record<string, unknown> {
  return {
    user_id: e.userId,
    temple_id: e.templeId,
    program_id: e.programId,
    start_date: e.startDate,
    intention: e.intention ?? null,
    observed_on: e.observedOn,
    status: e.status,
    completed_at: e.completedAt ?? null,
    reminder_channels: e.reminderChannels,
  }
}
