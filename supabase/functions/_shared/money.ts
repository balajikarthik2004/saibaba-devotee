export type Currency = 'USD' | 'INR' | 'GBP' | 'CAD'
export const CURRENCIES = ['USD', 'INR', 'GBP', 'CAD'] as const

/** Whole currency units -> minor units (all four supported currencies have 2 decimals). */
export function toMinor(amount: number): number {
  return Math.round(amount * 100)
}
export function fromMinor(minor: number): number {
  return Math.round(minor) / 100
}

/** Sane per-gift bounds; larger gifts use bank transfer. Whole currency units. */
export const GIFT_LIMITS: Record<Currency, { min: number; max: number }> = {
  USD: { min: 1, max: 25_000 },
  GBP: { min: 1, max: 20_000 },
  CAD: { min: 1, max: 30_000 },
  INR: { min: 10, max: 2_000_000 },
}

/** True when `amount` has at most 2 decimals. */
export const hasValidPrecision = (amount: number) => Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-6

export function checkAmountBounds(amount: number, currency: Currency): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return 'Amount must be positive.'
  if (!hasValidPrecision(amount)) return 'Amount has too many decimal places.'
  const l = GIFT_LIMITS[currency]
  if (amount < l.min) return `Minimum amount is ${l.min} ${currency}.`
  if (amount > l.max) {
    return `Amounts above ${l.max} ${currency} are handled by bank transfer. Please contact the temple office.`
  }
  return null
}

/** Platform fee in minor units from basis points (0 = none). */
export const platformFeeMinor = (amountMinor: number, bps: number) =>
  Math.max(0, Math.round((amountMinor * bps) / 10_000))
