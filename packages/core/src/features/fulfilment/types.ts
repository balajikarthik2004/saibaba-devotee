import type {
  Address,
  AnnadanamDrive,
  AnnadanamPledge,
  CountryCode,
  CurrencyCode,
  PaymentProviderKey,
  ShipmentOrder,
  ShipmentStatus,
} from '../../types.sai'

/** An order as stored by this slice: the shared contract plus contact + payment metadata. */
export interface FulfilmentOrder extends ShipmentOrder {
  /** Needed to find a guest's orders and send tracking updates. */
  contactEmail?: string
  provider?: PaymentProviderKey
  /** Why a parcel is held (customs note from the carrier), when status is 'held-customs'. */
  holdNote?: string
}

export interface FulfilmentPledge extends AnnadanamPledge {
  contactEmail?: string
  provider?: PaymentProviderKey
}

export interface CartLine {
  itemId: string
  qty: number
  currency: CurrencyCode
}

export interface QuoteLine {
  itemId: string
  qty: number
}

export interface ShippingQuote {
  ok: boolean
  /** Whole units of `currency`; 0 when `ok` is false. */
  fee: number
  currency: CurrencyCode
  /** Estimated transit, in days (range). Estimates only. */
  days: { min: number; max: number }
  domestic: boolean
  totalGrams: number
  /** Advisory notes (customs, perishables). Never a statement of legal certainty. */
  restrictions: string[]
  /** Items that cannot go to this destination, and why. */
  blocked: { itemId: string; name: string; reason: string }[]
  /** Set when `ok` is false and nothing more specific applies. */
  reason?: string
}

export interface ShipTier {
  maxGrams: number
  fee: number
  days: [number, number]
}

export interface RateTable {
  currency: CurrencyCode
  domestic: ShipTier[]
  /** Destination country -> tiers. A missing destination means "not offered". */
  international: Partial<Record<CountryCode, ShipTier[]>>
  /** Added per started 500 g beyond the last tier. */
  extraPer500g: { domestic: number; international: number }
  /** Orders at or above this subtotal ship free domestically. */
  freeDomesticOver?: number
}

export interface OrderFilters {
  templeId?: string | 'all'
  status?: ShipmentStatus | 'all'
  q?: string
  overdueOnly?: boolean
  country?: CountryCode | 'all'
}

export interface PlaceOrderInput {
  templeId?: string
  items: QuoteLine[]
  address: Address
  email?: string
  userId?: string | null
  provider: PaymentProviderKey
}

export interface PledgeInput {
  driveId: string
  meals: number
  userId?: string | null
  guest?: { name: string; email: string; phone: string }
  dedicatedTo?: string
  provider: PaymentProviderKey
}

export type { AnnadanamDrive }
