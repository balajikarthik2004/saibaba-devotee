import type {
  CountryCode,
  CurrencyCode,
  PaymentProviderKey,
  PaymentRequest,
  PaymentResult,
  Temple,
} from '../../../types'

/** A payment request as the mock gateway understands it (adds a test card). */
export interface GivingPaymentRequest extends PaymentRequest {
  /** Mock only: the card number the donor typed. Never sent anywhere. */
  testCard?: string
  /** Free text the donor quotes on a manual payment (UPI ref / UTR / cheque number). */
  donorReference?: string
  /** Mock UPI / netbanking choice inside Razorpay simulation. */
  razorpayMethod?: 'upi' | 'card' | 'netbanking'
  /** Cover-the-fee: `amount` already includes the estimated fee. */
  feeCovered?: boolean
}

/** PaymentResult plus the provider-specific bits the UI needs to finish the payment. */
export interface GivingPaymentResult extends PaymentResult {
  /** Stripe publishable key / Razorpay key id etc. Never a secret. */
  extra?: Record<string, unknown>
  /** 'mock-3ds' | 'stripe-element' | 'razorpay-checkout' | 'upi-qr' | 'manual' */
  next?: 'mock-3ds' | 'stripe-element' | 'razorpay-checkout' | 'upi-qr' | 'manual'
  /** Instruction text for manual providers (already per-temple). */
  instructions?: string[]
  /** upi:// deep link + QR data URL. */
  upi?: { link: string; qr: string; vpa: string }
}

export interface ConfirmInput {
  /** Stripe: the `Stripe` + `Elements` pair the UI mounted. */
  stripe?: { instance: unknown; elements: unknown; returnUrl?: string }
  /** Mock 3-D Secure: the donor completed or abandoned the challenge. */
  mockChallenge?: 'complete' | 'abandon'
  /** UPI / manual: the donor's transaction reference. */
  reference?: string
  /** Razorpay: prefill. */
  prefill?: { name?: string; email?: string; contact?: string }
}

export interface PaymentProvider {
  key: PaymentProviderKey
  label: string
  detail: string
  /** 'online' collects money now; 'manual' creates a pending record for the office to match. */
  kind: 'online' | 'upi' | 'manual'
  /** True when a real gateway is configured; false means the simulator is in use. */
  live(): boolean
  supports(currency: CurrencyCode, country: CountryCode): boolean
  supportsRecurring: boolean
  createPayment(req: GivingPaymentRequest, temple?: Temple): Promise<GivingPaymentResult>
  /** Finish a `requires-action` payment (3-D Secure, Payment Element, checkout.js). */
  confirm?(result: GivingPaymentResult, input: ConfirmInput): Promise<GivingPaymentResult>
}

export interface ProviderMeta {
  key: PaymentProviderKey
  label: string
  detail: string
}
