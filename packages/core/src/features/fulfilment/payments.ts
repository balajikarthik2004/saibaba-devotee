import type { PaymentProviderKey, PaymentRequest, PaymentResult } from '../../types.sai'
import type { Temple } from '../../types'

/**
 * Thin adapter over the giving slice's payment abstraction (`@saibaba/core/features/giving`).
 *
 * The giving module is built in parallel, so it is discovered lazily with a glob: when
 * `../giving/index.ts` exists its `getProviders(temple)` is used, otherwise we fall back
 * to an instant mock result so orders and pledges are never blocked. Nothing here moves
 * real money.
 */

interface GivingProvider {
  key?: string
  id?: string
  createPayment: (req: PaymentRequest) => Promise<PaymentResult>
}
interface GivingModule {
  getProviders?: (temple: Temple) => GivingProvider[]
}

// @ts-ignore -- Vite-only API; absent types in the core package, resolved by the apps' bundler.
const loaders = import.meta.glob('../giving/index.ts') as Record<string, () => Promise<unknown>>

async function loadGiving(): Promise<GivingModule | null> {
  try {
    const load = Object.values(loaders ?? {})[0]
    return load ? ((await load()) as GivingModule) : null
  } catch {
    return null
  }
}

/** Providers that settle instantly in the mock; everything else is "pending" (offline). */
const INSTANT: PaymentProviderKey[] = ['stripe', 'razorpay', 'upi', 'cash']

export const PROVIDER_LABELS: Record<PaymentProviderKey, string> = {
  stripe: 'Card',
  razorpay: 'Razorpay (card / netbanking)',
  upi: 'UPI',
  zelle: 'Zelle',
  ach: 'Bank debit (ACH)',
  cheque: 'Cheque',
  'bank-transfer': 'Bank transfer',
  cash: 'Cash at temple',
}

function mockPayment(req: PaymentRequest): PaymentResult {
  const instant = INSTANT.includes(req.provider)
  return {
    status: instant ? 'succeeded' : 'pending',
    provider: req.provider,
    providerRef: `mock_${req.provider}_${Date.now().toString(36)}`,
    message: instant ? undefined : 'Awaiting payment — the temple will confirm once received.',
  }
}

export async function createPayment(temple: Temple, req: PaymentRequest): Promise<PaymentResult> {
  const giving = await loadGiving()
  try {
    const providers = giving?.getProviders?.(temple) ?? []
    const p = providers.find((x) => (x.key ?? x.id) === req.provider)
    if (p) return await p.createPayment(req)
  } catch (e) {
    return {
      status: 'failed',
      provider: req.provider,
      providerRef: '',
      message: e instanceof Error ? e.message : 'Payment could not be started.',
    }
  }
  return mockPayment(req)
}

/** Providers a devotee can pick for shop / annadanam payments at this temple. */
export function paymentOptions(temple: Temple): PaymentProviderKey[] {
  return temple.payments.length ? temple.payments : ['stripe']
}
