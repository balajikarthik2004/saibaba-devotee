import type {
  CountryCode,
  CurrencyCode,
  PaymentProviderKey,
  PaymentResult,
  Receipt,
  TaxDeclaration,
  UUID,
} from '../../types'

/** Per-temple giving configuration, edited in admin -> Giving settings. */
export interface GivingSettings {
  templeId: UUID
  /** Providers the temple accepts. Falls back to `temple.payments` when never saved. */
  enabledProviders: PaymentProviderKey[]
  /** UPI virtual payment address (India). Without one, the UPI provider is not offered. */
  upiVpa: string
  upiPayeeName: string
  zelleEmail: string
  achInstructions: string
  bankTransferInstructions: string
  /** Free text; the postal address defaults to the temple address. */
  chequePayableTo: string
  chequeInstructions: string
  cashInstructions: string
  /** Regime wording toggles. */
  giftAidEnabled: boolean
  eightyGEnabled: boolean
  craWordingEnabled: boolean
  /** Receipt number prefix, e.g. `SAI` -> `SAI-sugar-land-2026-000123`. */
  receiptPrefix: string
  /** Offer donors the "cover the processing fee" toggle. */
  offerFeeCover: boolean
  updatedAt: string
}

/** Extra receipt fields per regime. The shared `Receipt` stays the contract. */
export interface GivingReceipt extends Receipt {
  status: 'issued' | 'pending'
  templeSlug: string
  templeAddress: string
  templePhone?: string
  templeEmail?: string
  isDemo: boolean
  provider?: PaymentProviderKey
  /** India 80G */
  donorPan?: string
  regNo?: string
  /** Canada CRA official receipt */
  placeIssued?: string
  eligibleAmount?: number
  advantage?: number
  /** UK Gift Aid */
  giftAidClaimed?: boolean
  giftAidUplift?: number
  /** Employer matching, when a request exists for the gift. */
  employer?: string
}

/** Donor tax profile: the shared declaration plus the address HMRC/CRA need on file. */
export interface DonorTaxProfile extends TaxDeclaration {
  homeAddress?: string
  city?: string
  postcode?: string
}

export type PaymentStatus = PaymentResult['status']

/**
 * What the payment layer knows about a donation or booking that the shared `Donation`
 * record cannot carry (yet): currency, provider, fee, status. Keyed by the record id.
 */
export interface PaymentMeta {
  refId: UUID
  kind: 'donation' | 'booking'
  templeId: UUID
  currency: CurrencyCode
  provider: PaymentProviderKey
  providerRef: string
  status: PaymentStatus
  amount: number
  /** Estimated processing fee for this payment. */
  fee: number
  /** The donor chose to cover the fee (amount above already includes it). */
  feeCovered: boolean
  payerName: string
  payerEmail: string
  payerCountry: CountryCode
  /** Free text the donor quotes on a bank transfer, cheque or UPI payment. */
  reference?: string
  recurring?: 'monthly' | 'yearly'
  /** Who collected it, for manual methods. */
  receivedAt?: string
  createdAt: string
}

export interface AnnualStatementLine {
  date: string
  description: string
  amount: number
  receiptNo?: string
}

/** One donor, one temple, one year, one currency. Never summed across currencies. */
export interface AnnualStatement {
  year: number
  templeId: UUID
  templeName: string
  regime: Receipt['regime']
  currency: CurrencyCode
  donorName: string
  donorAddress?: string
  donorPan?: string
  giftAidClaimed?: boolean
  lines: AnnualStatementLine[]
  total: number
  number: string
  taxId: string
  taxIdLabel: string
  isDemo: boolean
  templeAddress: string
}

export interface BankLine {
  raw: string
  date?: string
  amount: number
  text: string
}
