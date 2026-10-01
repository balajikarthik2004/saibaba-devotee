import type { CountryCode, CurrencyCode, PaymentProviderKey, Temple } from '../../../types'
import { currentTemple } from '../../../tenant'
import { getGivingSettingsSync } from '../settings'
import type { GivingPaymentRequest, GivingPaymentResult, PaymentProvider } from './types'

export interface ManualInstructions {
  title: string
  lines: string[]
  /** Postal address block, for cheques. */
  postal?: string[]
  payableTo?: string
}

/** Per-temple instruction text for a manual method, from Giving settings. */
export function manualInstructions(
  key: PaymentProviderKey,
  temple: Temple = currentTemple(),
  reference?: string,
): ManualInstructions {
  const s = getGivingSettingsSync(temple.id)
  const ref = reference ? [`Quote this reference: ${reference}`] : []
  switch (key) {
    case 'zelle':
      return {
        title: 'Pay with Zelle',
        lines: [
          s.zelleEmail
            ? `Send to ${s.zelleEmail} from the Zelle screen in your bank app.`
            : 'Ask the temple office for the Zelle address.',
          ...ref,
          'Your gift is recorded as pending until the office matches it to the bank statement.',
        ],
      }
    case 'ach':
      return {
        title: 'Pay by bank transfer (ACH)',
        lines: [s.achInstructions, ...ref].filter(Boolean),
      }
    case 'bank-transfer':
      return {
        title: 'Pay by bank transfer',
        lines: [s.bankTransferInstructions, ...ref].filter(Boolean),
      }
    case 'cheque':
      return {
        title: 'Pay by cheque',
        payableTo: s.chequePayableTo || temple.name,
        postal: [temple.name, temple.address, `${temple.city}, ${temple.state} ${temple.zip}`],
        lines: [s.chequeInstructions, ...ref].filter(Boolean),
      }
    case 'cash':
      return { title: 'Give in person', lines: [s.cashInstructions, ...ref].filter(Boolean) }
    default:
      return { title: 'Payment instructions', lines: ref }
  }
}

type ManualKey = 'zelle' | 'ach' | 'cheque' | 'bank-transfer' | 'cash'

const META: Record<
  ManualKey,
  { label: string; detail: string; currencies: CurrencyCode[] | 'any' }
> = {
  zelle: { label: 'Zelle', detail: 'Free, from your US bank app', currencies: ['USD'] },
  ach: { label: 'Bank transfer (ACH)', detail: 'No processing fee', currencies: ['USD'] },
  cheque: { label: 'Cheque', detail: 'Mail it or drop it at the office', currencies: 'any' },
  'bank-transfer': {
    label: 'Bank transfer',
    detail: 'Direct to the temple account, no fee',
    currencies: 'any',
  },
  cash: { label: 'Cash at the temple', detail: 'Give at the office', currencies: 'any' },
}

function makeManual(key: ManualKey): PaymentProvider {
  const m = META[key]
  return {
    key,
    label: m.label,
    detail: m.detail,
    kind: 'manual',
    live: () => true,
    supports: (c: CurrencyCode, _k: CountryCode) =>
      m.currencies === 'any' || m.currencies.includes(c),
    supportsRecurring: false,
    async createPayment(req: GivingPaymentRequest, temple?: Temple): Promise<GivingPaymentResult> {
      await new Promise((r) => setTimeout(r, 300))
      const t = temple ?? currentTemple()
      const ins = manualInstructions(key, t, req.reference)
      return {
        status: 'pending',
        provider: key,
        providerRef: `${key}_${Date.now().toString(36)}`,
        next: 'manual',
        instructions: [ins.title, ...ins.lines],
        message: 'Recorded as pending until the office receives it.',
      }
    },
  }
}

export const zelleProvider = makeManual('zelle')
export const achProvider = makeManual('ach')
export const chequeProvider = makeManual('cheque')
export const bankTransferProvider = makeManual('bank-transfer')
export const cashProvider = makeManual('cash')
