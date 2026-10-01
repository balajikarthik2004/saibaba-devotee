import type { CurrencyCode, PaymentProviderKey } from '../../../types'

/**
 * Published-rate estimates, good enough to tell a donor roughly what "cover the fee"
 * means. The real fee is whatever the processor charges; this is never used to settle
 * anything. Amounts are whole currency units, so the gross-up rounds up.
 */
const RATES: Partial<Record<PaymentProviderKey, Partial<Record<CurrencyCode, { pct: number; fixed: number }>>>> = {
  stripe: {
    USD: { pct: 0.029, fixed: 0.3 },
    CAD: { pct: 0.029, fixed: 0.3 },
    GBP: { pct: 0.015, fixed: 0.2 },
  },
  razorpay: { INR: { pct: 0.02, fixed: 0 } },
  upi: { INR: { pct: 0, fixed: 0 } },
}

export function feeRate(provider: PaymentProviderKey, currency: CurrencyCode) {
  return RATES[provider]?.[currency] ?? { pct: 0, fixed: 0 }
}

/** Processing fee on a given charge total. */
export function estimateFee(provider: PaymentProviderKey, currency: CurrencyCode, charge: number) {
  const r = feeRate(provider, currency)
  return Math.round((charge * r.pct + r.fixed) * 100) / 100
}

/**
 * The charge that leaves `net` after fees: what the donor pays if they choose to cover
 * the processing fee. Whole units, rounded up.
 */
export function grossUp(provider: PaymentProviderKey, currency: CurrencyCode, net: number) {
  const r = feeRate(provider, currency)
  if (r.pct === 0 && r.fixed === 0) return { charge: net, fee: 0 }
  const charge = Math.ceil((net + r.fixed) / (1 - r.pct))
  return { charge, fee: charge - net }
}

/** Providers that charge a processing fee at all. */
export const hasProcessingFee = (provider: PaymentProviderKey, currency: CurrencyCode) => {
  const r = feeRate(provider, currency)
  return r.pct > 0 || r.fixed > 0
}
