import type { CountryCode, CurrencyCode } from '../../../types'
import { apiBase, loadScript, postJson, stripeLive, stripePublishableKey } from './env'
import { mockCharge, mockConfirm } from './mock'
import type {
  ConfirmInput,
  GivingPaymentRequest,
  GivingPaymentResult,
  PaymentProvider,
} from './types'

/** The slice of Stripe.js we use. Declared here so core needs no `@stripe/stripe-js`. */
export interface StripeJs {
  elements(opts: { clientSecret: string; appearance?: Record<string, unknown> }): StripeElements
  confirmPayment(opts: {
    elements: StripeElements
    confirmParams?: { return_url?: string }
    redirect?: 'if_required' | 'always'
  }): Promise<{
    error?: { message?: string }
    paymentIntent?: { id: string; status: string }
  }>
}
export interface StripeElements {
  create(
    type: 'payment',
    opts?: Record<string, unknown>,
  ): { mount(el: string | HTMLElement): void; destroy(): void }
  submit?(): Promise<{ error?: { message?: string } }>
}

declare global {
  interface Window {
    Stripe?: (key: string) => StripeJs
  }
}

let stripePromise: Promise<StripeJs> | null = null

/**
 * Lazily loads https://js.stripe.com/v3 — only once a publishable key AND a backend are
 * configured, and only when a donor actually picks card. Never in the initial bundle.
 */
export function loadStripe(): Promise<StripeJs> {
  const key = stripePublishableKey()
  if (!key || !apiBase()) return Promise.reject(new Error('Stripe is not configured.'))
  stripePromise ??= loadScript('https://js.stripe.com/v3').then(() => {
    if (!window.Stripe) throw new Error('Stripe.js failed to initialise.')
    return window.Stripe(key)
  })
  return stripePromise
}

interface IntentReply {
  clientSecret: string
  id: string
}

/**
 * Stripe (card, Apple Pay, Google Pay through the Payment Element, which surfaces the
 * wallets the browser and the Stripe account support). Without
 * VITE_STRIPE_PUBLISHABLE_KEY + VITE_API_BASE this runs the demo simulator.
 */
export const stripeProvider: PaymentProvider = {
  key: 'stripe',
  label: 'Card, Apple Pay, Google Pay',
  detail: 'Visa, Mastercard, Amex and wallets',
  kind: 'online',
  live: stripeLive,
  supports: (_c: CurrencyCode, _k: CountryCode) => true,
  supportsRecurring: true,

  async createPayment(req: GivingPaymentRequest): Promise<GivingPaymentResult> {
    if (!stripeLive()) {
      await new Promise((r) => setTimeout(r, 700))
      return mockCharge('stripe', req)
    }
    const r = await postJson<IntentReply>('/payments/stripe/intent', {
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
      provider: 'stripe',
      providerRef: r.id,
      clientSecret: r.clientSecret,
      next: 'stripe-element',
      message: 'Enter your payment details to complete the gift.',
    }
  },

  async confirm(result: GivingPaymentResult, input: ConfirmInput): Promise<GivingPaymentResult> {
    if (!stripeLive() || result.next === 'mock-3ds') return mockConfirm(result, input)
    const s = input.stripe
    if (!s) return { ...result, status: 'failed', message: 'Payment form is not ready.' }
    const instance = s.instance as StripeJs
    const elements = s.elements as StripeElements
    const submitted = await elements.submit?.()
    if (submitted?.error) {
      return {
        ...result,
        status: 'failed',
        message: submitted.error.message ?? 'Please check your details.',
      }
    }
    const out = await instance.confirmPayment({
      elements,
      confirmParams: { return_url: s.returnUrl ?? window.location.href },
      redirect: 'if_required',
    })
    if (out.error) {
      return { ...result, status: 'failed', message: out.error.message ?? 'Payment failed.' }
    }
    const st = out.paymentIntent?.status
    if (st === 'succeeded') return { ...result, status: 'succeeded', next: undefined }
    if (st === 'processing') {
      return {
        ...result,
        status: 'pending',
        next: undefined,
        message: 'Your bank is processing the payment.',
      }
    }
    return { ...result, status: 'requires-action', message: 'Further authentication is needed.' }
  },
}
