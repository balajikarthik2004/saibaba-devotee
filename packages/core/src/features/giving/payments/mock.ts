import type { CountryCode, CurrencyCode, PaymentProviderKey } from '../../../types'
import type {
  ConfirmInput,
  GivingPaymentRequest,
  GivingPaymentResult,
  PaymentProvider,
} from './types'

/**
 * The demo gateway. Nothing leaves the browser.
 *
 * Test cards (any expiry / CVC):
 *   4242 4242 4242 4242  succeeds
 *   4000 0027 6000 3184  asks for a simulated 3-D Secure challenge, then succeeds
 *   4000 0000 0000 0002  is declined
 *   4000 0000 0000 9995  is declined for insufficient funds
 * Any other number succeeds.
 */
export const MOCK_TEST_CARDS = [
  { number: '4242 4242 4242 4242', outcome: 'Succeeds' },
  { number: '4000 0027 6000 3184', outcome: 'Asks for 3-D Secure, then succeeds' },
  { number: '4000 0000 0000 0002', outcome: 'Declined' },
  { number: '4000 0000 0000 9995', outcome: 'Declined: insufficient funds' },
]

let counter = 0
const ref = (prefix: string) => `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}`
const digits = (s?: string) => (s ?? '').replace(/\D/g, '')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function mockCharge(
  key: PaymentProviderKey,
  req: GivingPaymentRequest,
): GivingPaymentResult {
  const card = digits(req.testCard)
  const providerRef = ref(key === 'razorpay' ? 'mock_order' : 'mock_pi')
  if (card === '4000000000000002') {
    return { status: 'failed', provider: key, providerRef, message: 'Your card was declined.' }
  }
  if (card === '4000000000009995') {
    return {
      status: 'failed',
      provider: key,
      providerRef,
      message: 'Your card has insufficient funds.',
    }
  }
  if (card === '4000002760003184') {
    return {
      status: 'requires-action',
      provider: key,
      providerRef,
      message: 'Your bank needs to confirm this payment.',
      next: 'mock-3ds',
    }
  }
  return {
    status: 'succeeded',
    provider: key,
    providerRef,
    message: 'Demo payment approved. No money moved.',
  }
}

export async function mockConfirm(
  result: GivingPaymentResult,
  input: ConfirmInput,
): Promise<GivingPaymentResult> {
  await sleep(600)
  if (input.mockChallenge === 'complete') {
    return { ...result, status: 'succeeded', next: undefined, message: 'Authentication complete.' }
  }
  return {
    ...result,
    status: 'failed',
    next: undefined,
    message: 'Authentication was not completed, so you have not been charged.',
  }
}

/**
 * A simulator that answers to any online provider key. Used directly as the default
 * provider, and as the fallback inside stripe/razorpay when no backend is configured.
 */
export function createMockProvider(
  key: PaymentProviderKey = 'stripe',
  over: Partial<Pick<PaymentProvider, 'label' | 'detail' | 'supports' | 'supportsRecurring'>> = {},
): PaymentProvider {
  return {
    key,
    label: over.label ?? 'Card (demo)',
    detail: over.detail ?? 'Visa, Mastercard, Amex. Demo gateway: no money moves.',
    kind: 'online',
    live: () => false,
    supports: over.supports ?? ((_c: CurrencyCode, _k: CountryCode) => true),
    supportsRecurring: over.supportsRecurring ?? true,
    async createPayment(req) {
      await sleep(700)
      return mockCharge(key, req)
    },
    confirm: mockConfirm,
  }
}

export const mockProvider = createMockProvider('stripe')
