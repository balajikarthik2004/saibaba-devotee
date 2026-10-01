import type { CountryCode, CurrencyCode } from '../../../types'
import { createMockProvider } from './mock'
import { loadScript, postJson, razorpayKeyId, razorpayLive } from './env'
import type {
  ConfirmInput,
  GivingPaymentRequest,
  GivingPaymentResult,
  PaymentProvider,
} from './types'

interface RazorpayHandlerResponse {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}
interface RazorpayCtor {
  new (opts: Record<string, unknown>): {
    open(): void
    on(ev: string, cb: (r: unknown) => void): void
  }
}
declare global {
  interface Window {
    Razorpay?: RazorpayCtor
  }
}

interface OrderReply {
  orderId: string
  /** Publishable key id; the server may send it so the client needs no env. */
  keyId?: string
  /** Minor units (paise), exactly as created on the server. */
  amount: number
  currency: string
}

const sim = createMockProvider('razorpay')

/**
 * Razorpay Checkout (UPI, cards, netbanking, wallets). The order is created on the
 * server and the signature is verified on the server. Demo mode without a backend.
 */
export const razorpayProvider: PaymentProvider = {
  key: 'razorpay',
  label: 'UPI, cards, netbanking',
  detail: 'Razorpay Checkout: UPI, RuPay, cards and netbanking',
  kind: 'online',
  live: razorpayLive,
  supports: (c: CurrencyCode, _k: CountryCode) => c === 'INR',
  supportsRecurring: true,

  async createPayment(req: GivingPaymentRequest): Promise<GivingPaymentResult> {
    if (!razorpayLive()) return sim.createPayment(req)
    const o = await postJson<OrderReply>('/payments/razorpay/order', {
      templeId: req.templeId,
      amount: req.amount,
      currency: req.currency,
      purpose: req.purpose,
      reference: req.reference,
      payer: req.payer,
      recurring: req.recurring ?? null,
    })
    return {
      status: 'requires-action',
      provider: 'razorpay',
      providerRef: o.orderId,
      next: 'razorpay-checkout',
      extra: { keyId: o.keyId ?? razorpayKeyId(), amount: o.amount, currency: o.currency },
    }
  },

  async confirm(result: GivingPaymentResult, input: ConfirmInput): Promise<GivingPaymentResult> {
    if (!razorpayLive() || result.next === 'mock-3ds') return sim.confirm!(result, input)
    await loadScript('https://checkout.razorpay.com/v1/checkout.js')
    const Ctor = window.Razorpay
    if (!Ctor) return { ...result, status: 'failed', message: 'Razorpay failed to load.' }
    const extra = result.extra ?? {}
    return new Promise<GivingPaymentResult>((resolve) => {
      const rz = new Ctor({
        key: extra.keyId,
        order_id: result.providerRef,
        amount: extra.amount,
        currency: extra.currency,
        prefill: input.prefill,
        modal: {
          ondismiss: () =>
            resolve({
              ...result,
              status: 'failed',
              message: 'Payment window closed. You have not been charged.',
            }),
        },
        handler: async (r: RazorpayHandlerResponse) => {
          try {
            const v = await postJson<{ verified: boolean }>('/payments/razorpay/verify', {
              orderId: r.razorpay_order_id,
              paymentId: r.razorpay_payment_id,
              signature: r.razorpay_signature,
            })
            resolve(
              v.verified
                ? {
                    ...result,
                    status: 'succeeded',
                    providerRef: r.razorpay_payment_id,
                    next: undefined,
                  }
                : { ...result, status: 'failed', message: 'Payment could not be verified.' },
            )
          } catch (e) {
            resolve({ ...result, status: 'failed', message: (e as Error).message })
          }
        },
      })
      rz.on('payment.failed', () =>
        resolve({ ...result, status: 'failed', message: 'The payment failed. Please try again.' }),
      )
      rz.open()
    })
  },
}
