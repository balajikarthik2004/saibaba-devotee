import type { CountryCode, CurrencyCode } from './types.sai'

export const CURRENCY_META: Record<
  CurrencyCode,
  { symbol: string; locale: string; country: CountryCode; label: string }
> = {
  USD: { symbol: '$', locale: 'en-US', country: 'US', label: 'US dollar' },
  INR: { symbol: '₹', locale: 'en-IN', country: 'IN', label: 'Indian rupee' },
  GBP: { symbol: '£', locale: 'en-GB', country: 'GB', label: 'Pound sterling' },
  CAD: { symbol: 'CA$', locale: 'en-CA', country: 'CA', label: 'Canadian dollar' },
}

const cache = new Map<string, Intl.NumberFormat>()

/**
 * Formats a whole-unit amount in its own currency. Never converts: a ₹501 gift stays ₹501.
 * `compact` gives 1.2K style figures for tiles.
 */
export function formatMoney(
  amount: number,
  currency: CurrencyCode = 'USD',
  opts: { locale?: string; cents?: boolean; compact?: boolean } = {},
): string {
  const locale = opts.locale ?? CURRENCY_META[currency].locale
  const key = `${locale}|${currency}|${opts.cents ? 'c' : ''}|${opts.compact ? 'k' : ''}`
  let f = cache.get(key)
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: opts.cents ? 2 : 0,
      maximumFractionDigits: opts.compact ? 1 : opts.cents ? 2 : 0,
      ...(opts.compact ? { notation: 'compact' as const } : {}),
    })
    cache.set(key, f)
  }
  return f.format(amount)
}

/** Sensible one-tap gift amounts per currency. */
export const GIFT_PRESETS: Record<CurrencyCode, number[]> = {
  USD: [11, 21, 51, 101, 251, 501],
  INR: [101, 251, 501, 1001, 2501, 5001],
  GBP: [11, 21, 51, 101, 251],
  CAD: [11, 21, 51, 101, 251, 501],
}
