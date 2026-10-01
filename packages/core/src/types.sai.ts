/**
 * Shree Saibaba platform — domain contract.
 *
 * Everything the multi-temple, multi-country product adds on top of the original
 * single-temple prototype lives here so feature slices can build against one agreed
 * shape. Money is whole units of the record's own `currency` (never converted).
 * Times named `time` are 'HH:mm' in the *temple's* timezone; use `core/time` to show
 * them in the viewer's.
 */
import type { ISODate, UUID } from './types'

/* ------------------------------------------------------------------ locale */

export type CountryCode = 'US' | 'IN' | 'GB' | 'CA'
export type CurrencyCode = 'USD' | 'INR' | 'GBP' | 'CAD'
export type LanguageCode = 'en' | 'hi' | 'mr' | 'te' | 'gu' | 'ta' | 'es'
/** us-501c3 · in-80g · uk-giftaid · ca-cra */
export type TaxRegime = 'us-501c3' | 'in-80g' | 'uk-giftaid' | 'ca-cra'
export type PaymentProviderKey =
  | 'stripe'
  | 'razorpay'
  | 'upi'
  | 'zelle'
  | 'ach'
  | 'cheque'
  | 'bank-transfer'
  | 'cash'
export type NotifyChannel = 'email' | 'sms' | 'whatsapp' | 'push'

export interface Address {
  name: string
  line1: string
  line2?: string
  city: string
  /** State / province / county. */
  region: string
  postcode: string
  country: CountryCode
  phone: string
}

/* ----------------------------------------------------------------- tenancy */

/** A physical place of worship inside a temple (Samadhi Mandir, Dwarakamai …). */
export interface SaiSpace {
  key: string
  name: string
  blurb: string
}

export interface TempleTenantProfile {
  slug: string
  currency: CurrencyCode
  /** BCP-47, used for number/date formatting. */
  locale: string
  languages: LanguageCode[]
  taxRegime: TaxRegime
  /** EIN / 80G registration / charity number, per regime. Demo values are placeholders. */
  taxId: string
  taxIdLabel: string
  lat: number
  lng: number
  about: string
  spaces: SaiSpace[]
  payments: PaymentProviderKey[]
  /** Countries this temple posts prasad / udi to. Empty = no shipping. */
  shipsTo: CountryCode[]
  status: 'active' | 'onboarding' | 'suspended'
  /** Seeded, fictional demo temple — surfaces a banner in the UI. */
  isDemo: boolean
  brandHex?: string
}

/* -------------------------------------------------------- aarti & live darshan */

export type AartiKey = 'kakad' | 'madhyan' | 'dhoop' | 'shej' | 'special'

export interface AartiSlot {
  id: UUID
  templeId: UUID
  key: AartiKey
  name: string
  /** 'HH:mm', temple-local. */
  time: string
  /** 0 = Sunday … 6 = Saturday. */
  days: number[]
  durationMin: number
  description: string
  active: boolean
  /** Devotees may sponsor this aarti in their family's name. */
  sponsorable: boolean
  sponsorPujaId?: UUID
}

export interface AartiText {
  id: UUID
  key: AartiKey | string
  title: string
  language: LanguageCode
  script: 'devanagari' | 'latin' | 'gujarati' | 'telugu' | 'tamil'
  lines: string[]
  /** Where the text comes from — temples supply / verify their own copy. */
  source?: string
  audioUrl?: string
}

export interface LiveStream {
  templeId: UUID
  provider: 'youtube' | 'vimeo' | 'hls' | 'facebook' | 'none'
  embedUrl: string
  isLive: boolean
  startedAt?: ISODate
  replayPlaylistUrl?: string
}

export interface AartiRecording {
  id: UUID
  templeId: UUID
  slotKey: AartiKey
  date: ISODate
  title: string
  url: string
  durationSec: number
}

export interface FestivalDate {
  id: UUID
  /** null = applies to every temple. */
  templeId: UUID | null
  key: 'ram-navami' | 'guru-purnima' | 'vijayadashami' | 'datta-jayanti' | 'sai-jayanti' | 'other'
  name: string
  date: ISODate
  endDate?: ISODate
  note?: string
  /** Seed dates are marked unverified until the temple's panchang confirms them. */
  verified: boolean
  eventId?: UUID
}

/* ----------------------------------------------------- vrat, parayan, teachings */

export interface VratProgram {
  id: UUID
  key: 'nine-thursday' | 'eleven-thursday' | 'custom'
  name: string
  weeks: number
  /** 0 = Sunday … 6 = Saturday; Thursday = 4. */
  weekday: number
  summary: string
  steps: { title: string; body: string }[]
  kathaSummary: string
  udyapanGuidance: string
}

export interface VratEnrollment {
  id: UUID
  userId: UUID
  templeId: UUID
  programId: UUID
  startDate: ISODate
  intention?: string
  /** Dates (ISO, day precision) on which the devotee marked the week observed. */
  observedOn: ISODate[]
  status: 'active' | 'completed' | 'paused' | 'abandoned'
  completedAt?: ISODate
  reminderChannels: NotifyChannel[]
  createdAt: ISODate
}

export interface ParayanPlan {
  id: UUID
  key: 'saptah' | 'chapter-a-day' | 'custom'
  name: string
  /** Sai Satcharitra is read as 51 chapters. */
  chapters: number
  days: number
  summary: string
  /** Which chapters fall on which day (1-based day). */
  schedule: { day: number; chapters: number[] }[]
}

export interface ParayanEnrollment {
  id: UUID
  userId: UUID
  planId: UUID
  templeId: UUID | null
  startDate: ISODate
  chaptersRead: number[]
  groupId?: UUID
  status: 'active' | 'completed' | 'paused'
  createdAt: ISODate
}

export interface ParayanGroup {
  id: UUID
  templeId: UUID
  name: string
  description: string
  startDate: ISODate
  /** Chapters split between members so a family or community finishes together. */
  assignments: { userId: UUID; name: string; chapters: number[] }[]
  createdByUserId: UUID
  createdAt: ISODate
}

export interface SaiAssurance {
  n: number
  text: string
}

export interface Leela {
  id: UUID
  title: string
  summary: string
  theme: 'faith-and-patience' | 'compassion' | 'unity' | 'surrender' | 'guru-grace' | 'service'
  language: LanguageCode
  readMinutes: number
  featured: boolean
  publishedAt: ISODate
  source?: string
}

export interface DailyMessage {
  id: UUID
  /** Day precision. */
  date: ISODate
  text: string
  language: LanguageCode
  templeId: UUID | null
}

/* -------------------------------------------------- shop, shipping, annadanam */

export interface ShopItem {
  id: UUID
  templeId: UUID
  key: 'udi' | 'prasad-box' | 'book' | 'photo' | 'ring' | 'other'
  name: string
  description: string
  price: number
  currency: CurrencyCode
  weightGrams: number
  shipsTo: CountryCode[]
  active: boolean
  stock: number | null
}

export type ShipmentStatus =
  | 'placed'
  | 'paid'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'held-customs'
  | 'cancelled'

export interface ShipmentOrder {
  id: UUID
  templeId: UUID
  userId: UUID | null
  items: { itemId: UUID; name: string; qty: number; unitPrice: number }[]
  address: Address
  subtotal: number
  shippingFee: number
  total: number
  currency: CurrencyCode
  status: ShipmentStatus
  carrier?: string
  tracking?: string
  paymentRef?: string
  createdAt: ISODate
  events: { at: ISODate; status: ShipmentStatus; note?: string }[]
}

export interface AnnadanamDrive {
  id: UUID
  templeId: UUID
  title: string
  date: ISODate
  mealsTarget: number
  pricePerMeal: number
  currency: CurrencyCode
  mealsFunded: number
  menuNote: string
  status: 'open' | 'served' | 'reported'
  report?: { mealsServed: number; photos: string[]; note: string; postedAt: ISODate }
}

export interface AnnadanamPledge {
  id: UUID
  driveId: UUID
  templeId: UUID
  userId: UUID | null
  donorName: string
  meals: number
  amount: number
  currency: CurrencyCode
  dedicatedTo?: string
  donationId?: UUID
  createdAt: ISODate
}

/* --------------------------------------------------------------- community */

export interface PrayerRequest {
  id: UUID
  templeId: UUID
  userId?: UUID
  displayName: string
  category: 'health' | 'family' | 'peace' | 'gratitude' | 'guidance' | 'other'
  body: string
  visibility: 'public' | 'temple' | 'private'
  status: 'pending' | 'approved' | 'rejected'
  prayerCount: number
  createdAt: ISODate
}

export interface SatsangGroup {
  id: UUID
  templeId: UUID
  name: string
  kind: 'satsang' | 'youth' | 'bal-vikas' | 'seniors' | 'bhajan'
  schedule: string
  contactName: string
  contactEmail: string
  description: string
  memberIds: UUID[]
  capacity?: number
}

/* ---------------------------------------------------------- notifications */

export type NotifyTopic =
  | 'aarti'
  | 'vrat'
  | 'festival'
  | 'daily-message'
  | 'giving'
  | 'shipping'
  | 'volunteer'

export interface NotificationPref {
  userId: UUID
  channels: Record<NotifyChannel, boolean>
  topics: Record<NotifyTopic, boolean>
  /** Local 'HH:mm' window in which nothing is sent. */
  quietHours?: { from: string; to: string }
}

export interface NotificationLog {
  id: UUID
  templeId: UUID
  userId?: UUID
  channel: NotifyChannel
  topic: NotifyTopic
  subject: string
  status: 'queued' | 'sent' | 'failed'
  createdAt: ISODate
}

/* --------------------------------------------------------- payments & tax */

export interface PaymentRequest {
  templeId: UUID
  amount: number
  currency: CurrencyCode
  purpose: 'donation' | 'sponsorship' | 'shop' | 'annadanam'
  /** Booking / order / drive id the payment settles. */
  reference: string
  provider: PaymentProviderKey
  payer: { name: string; email: string; phone: string; country: CountryCode }
  /** Recurring gifts. */
  recurring?: 'monthly' | 'yearly'
}

export interface PaymentResult {
  status: 'succeeded' | 'pending' | 'requires-action' | 'failed'
  provider: PaymentProviderKey
  providerRef: string
  clientSecret?: string
  redirectUrl?: string
  message?: string
}

/** What a donor declares so the temple can issue a valid receipt in their regime. */
export interface TaxDeclaration {
  userId: UUID
  regime: TaxRegime
  /** UK: taxpayer confirms Gift Aid eligibility. */
  giftAid?: boolean
  giftAidDeclaredAt?: ISODate
  /** India 80G: PAN is mandatory for a deductible receipt. */
  pan?: string
  /** Indian residents only; foreign contributions are handled separately (FCRA). */
  residentStatus?: 'resident' | 'non-resident'
  updatedAt: ISODate
}

export interface ReceiptLine {
  description: string
  amount: number
}

export interface Receipt {
  id: UUID
  templeId: UUID
  donationId?: UUID
  bookingId?: UUID
  regime: TaxRegime
  /** Human-facing sequential number, e.g. SAI-2026-000123. */
  number: string
  issuedAt: ISODate
  donorName: string
  donorAddress?: string
  amount: number
  currency: CurrencyCode
  lines: ReceiptLine[]
  templeName: string
  taxId: string
  taxIdLabel: string
  declarations: string[]
  pdfUrl?: string
}

export interface MatchingGiftRequest {
  id: UUID
  donationId: UUID
  templeId: UUID
  employer: string
  status: 'submitted' | 'verified' | 'matched' | 'declined'
  matchedAmount?: number
  createdAt: ISODate
}
