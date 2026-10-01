import type { CountryCode, PaymentProviderKey, Temple } from '../../../types'
import { getGivingSettingsSync } from '../settings'
import {
  achProvider,
  bankTransferProvider,
  cashProvider,
  chequeProvider,
  zelleProvider,
} from './manual'
import { razorpayProvider } from './razorpay'
import { stripeProvider } from './stripe'
import type { PaymentProvider } from './types'
import { templeVpa, upiProvider } from './upi'

export * from './types'
export * from './fees'
export { env, apiBase, stripeLive, razorpayLive } from './env'
export { mockProvider, createMockProvider, MOCK_TEST_CARDS } from './mock'
export { stripeProvider, loadStripe } from './stripe'
export type { StripeJs, StripeElements } from './stripe'
export { razorpayProvider } from './razorpay'
export { upiProvider, buildUpiLink, qrDataUrl } from './upi'
export {
  zelleProvider,
  achProvider,
  chequeProvider,
  bankTransferProvider,
  cashProvider,
  manualInstructions,
} from './manual'
export type { ManualInstructions } from './manual'

const ALL: Record<PaymentProviderKey, PaymentProvider> = {
  stripe: stripeProvider,
  razorpay: razorpayProvider,
  upi: upiProvider,
  zelle: zelleProvider,
  ach: achProvider,
  cheque: chequeProvider,
  'bank-transfer': bankTransferProvider,
  cash: cashProvider,
}

export const providerByKey = (key: PaymentProviderKey) => ALL[key]

/** Display order per country: online first, then the nearest local rail, then manual. */
const ORDER: Record<CountryCode, PaymentProviderKey[]> = {
  IN: ['upi', 'razorpay', 'bank-transfer', 'cheque', 'cash'],
  US: ['stripe', 'zelle', 'ach', 'cheque', 'cash'],
  GB: ['stripe', 'bank-transfer', 'cheque', 'cash'],
  CA: ['stripe', 'bank-transfer', 'cheque', 'cash'],
}

/**
 * The providers a donor can actually use at this temple: enabled in Giving settings
 * (default: the temple's `payments`), valid for the temple's currency and country, and
 * ordered sensibly for the country. UPI additionally needs a VPA on file.
 */
export function getProviders(temple: Temple): PaymentProvider[] {
  const s = getGivingSettingsSync(temple.id)
  const order = ORDER[temple.country]
  const rank = (k: PaymentProviderKey) => {
    const i = order.indexOf(k)
    return i === -1 ? order.length : i
  }
  return [...new Set<PaymentProviderKey>(s.enabledProviders)]
    .map((k) => ALL[k])
    .filter((p): p is PaymentProvider => Boolean(p))
    .filter((p) => p.supports(temple.currency, temple.country))
    .filter((p) => (p.key === 'upi' ? Boolean(templeVpa(temple)) : true))
    .sort((a, b) => rank(a.key) - rank(b.key))
}

/** Every provider a temple could enable in settings, valid for its currency. */
export function configurableProviders(temple: Temple): PaymentProvider[] {
  return Object.values(ALL).filter((p) => p.supports(temple.currency, temple.country))
}
