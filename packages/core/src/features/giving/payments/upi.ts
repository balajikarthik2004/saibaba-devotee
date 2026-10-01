import type { CountryCode, CurrencyCode, Temple } from '../../../types'
import { currentTemple } from '../../../tenant'
import { getGivingSettingsSync } from '../settings'
import type { GivingPaymentRequest, GivingPaymentResult, PaymentProvider } from './types'

/** `upi://pay?...` deep link per the NPCI UPI linking spec. */
export function buildUpiLink(opts: {
  vpa: string
  payeeName: string
  amount: number
  note?: string
  reference?: string
}) {
  const p = new URLSearchParams()
  p.set('pa', opts.vpa)
  p.set('pn', opts.payeeName)
  p.set('am', opts.amount.toFixed(2))
  p.set('cu', 'INR')
  if (opts.note) p.set('tn', opts.note.slice(0, 80))
  if (opts.reference) p.set('tr', opts.reference.slice(0, 35))
  return `upi://pay?${p.toString().replace(/\+/g, '%20')}`
}

export async function qrDataUrl(text: string): Promise<string> {
  const mod = (await import('qrcode')) as unknown as {
    toDataURL?: (t: string, o?: Record<string, unknown>) => Promise<string>
    default?: { toDataURL: (t: string, o?: Record<string, unknown>) => Promise<string> }
  }
  const fn = mod.toDataURL ?? mod.default?.toDataURL
  if (!fn) throw new Error('QR generator unavailable')
  return fn(text, { margin: 1, width: 240, errorCorrectionLevel: 'M' })
}

export const templeVpa = (temple: Temple) => getGivingSettingsSync(temple.id).upiVpa.trim()

/**
 * UPI intent / QR. The donor pays in their own UPI app and then confirms here with the
 * UTR; the office matches it against the bank statement (manual confirmation flow).
 * Only offered when the temple has a VPA configured.
 */
export const upiProvider: PaymentProvider = {
  key: 'upi',
  label: 'UPI (QR or app)',
  detail: 'Pay with any UPI app: GPay, PhonePe, Paytm, BHIM',
  kind: 'upi',
  live: () => false,
  supports: (c: CurrencyCode, _k: CountryCode) => c === 'INR',
  // Simulated UPI AutoPay mandate; a real mandate needs the bank's e-mandate rails.
  supportsRecurring: true,

  async createPayment(req: GivingPaymentRequest, temple?: Temple): Promise<GivingPaymentResult> {
    const t = temple ?? currentTemple()
    const s = getGivingSettingsSync(t.id)
    const vpa = s.upiVpa.trim()
    if (!vpa) {
      return {
        status: 'failed',
        provider: 'upi',
        providerRef: '',
        message: 'This temple has not set up a UPI address yet.',
      }
    }
    const providerRef = `upi_${Date.now().toString(36)}`
    const link = buildUpiLink({
      vpa,
      payeeName: s.upiPayeeName || t.name,
      amount: req.amount,
      note: `Donation ${req.reference}`,
      reference: providerRef,
    })
    return {
      status: 'pending',
      provider: 'upi',
      providerRef,
      next: 'upi-qr',
      message: req.recurring
        ? 'Demo only: a UPI AutoPay mandate is simulated. Approve the first payment in your UPI app.'
        : 'Pay in your UPI app, then confirm below with the transaction reference.',
      upi: { link, qr: await qrDataUrl(link), vpa },
    }
  },

  async confirm(result, input) {
    return {
      ...result,
      status: 'pending',
      next: undefined,
      message: input.reference
        ? `Thank you. The office will match UPI reference ${input.reference} to the bank statement.`
        : 'Thank you. The office will match your payment to the bank statement.',
    }
  },
}
