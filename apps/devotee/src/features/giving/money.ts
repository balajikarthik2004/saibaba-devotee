import { formatMoney } from '@saibaba/core'
import type { CurrencyCode } from '@saibaba/core'

/** Totals per currency. Amounts in different currencies are never added together. */
export type Totals = Partial<Record<CurrencyCode, number>>

export function addTo(totals: Totals, currency: CurrencyCode, amount: number): Totals {
  return { ...totals, [currency]: (totals[currency] ?? 0) + amount }
}

/** "$1,200 · ₹5,000": one figure per currency, in a stable order. */
export function formatTotals(totals: Totals, empty = '—'): string {
  const parts = (Object.keys(totals) as CurrencyCode[])
    .sort()
    .map((c) => formatMoney(totals[c] ?? 0, c))
  return parts.length ? parts.join(' · ') : empty
}
