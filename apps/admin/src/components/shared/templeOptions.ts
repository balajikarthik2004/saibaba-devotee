import type { Temple } from '@saibaba/core/types'
import type {
  CountryCode,
  CurrencyCode,
  PaymentProviderKey,
  TaxRegime,
} from '@saibaba/core/types'

/** Option lists shared by the temple settings page and the platform onboarding wizard. */

export const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Vancouver',
  'Europe/London',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Australia/Sydney',
]

export const COUNTRIES: { code: CountryCode; label: string }[] = [
  { code: 'US', label: 'United States' },
  { code: 'IN', label: 'India' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'CA', label: 'Canada' },
]

export const CURRENCY_OPTIONS: { code: CurrencyCode; label: string }[] = [
  { code: 'USD', label: 'USD · US dollar' },
  { code: 'INR', label: 'INR · Indian rupee' },
  { code: 'GBP', label: 'GBP · Pound sterling' },
  { code: 'CAD', label: 'CAD · Canadian dollar' },
]

export const TAX_REGIME_OPTIONS: {
  code: TaxRegime
  label: string
  idLabel: string
  country: CountryCode
  currency: CurrencyCode
  locale: string
  timezone: string
}[] = [
  { code: 'us-501c3', label: 'US · 501(c)(3)', idLabel: 'EIN', country: 'US', currency: 'USD', locale: 'en-US', timezone: 'America/Chicago' },
  { code: 'in-80g', label: 'India · 80G', idLabel: 'PAN / 80G reg. no.', country: 'IN', currency: 'INR', locale: 'en-IN', timezone: 'Asia/Kolkata' },
  { code: 'uk-giftaid', label: 'UK · Gift Aid', idLabel: 'Registered charity no.', country: 'GB', currency: 'GBP', locale: 'en-GB', timezone: 'Europe/London' },
  { code: 'ca-cra', label: 'Canada · CRA', idLabel: 'CRA registration no.', country: 'CA', currency: 'CAD', locale: 'en-CA', timezone: 'America/Toronto' },
]

export const PAYMENT_OPTIONS: { key: PaymentProviderKey; label: string }[] = [
  { key: 'stripe', label: 'Card (Stripe)' },
  { key: 'razorpay', label: 'Razorpay (cards, UPI, netbanking)' },
  { key: 'upi', label: 'UPI' },
  { key: 'zelle', label: 'Zelle' },
  { key: 'ach', label: 'Bank debit (ACH)' },
  { key: 'bank-transfer', label: 'Bank transfer' },
  { key: 'cheque', label: 'Cheque' },
  { key: 'cash', label: 'Cash at the office' },
]

export const STATUS_LABEL: Record<Temple['status'], string> = {
  active: 'Active',
  onboarding: 'Onboarding',
  suspended: 'Suspended',
}
