import {
  Banknote,
  Building2,
  CreditCard,
  Landmark,
  QrCode,
  Smartphone,
  Wallet,
} from 'lucide-react'
import type { PaymentProvider, PaymentProviderKey } from '@saibaba/core'
import { useT } from '@saibaba/core'
import type { Donation } from '@/lib/data/types'
import { ChequeInstructions } from '@/components/shared/ChequeInstructions'
import { cn } from '@/lib/utils'

type Method = Donation['paymentMethod']

/* ------------------------------------------------------------- legacy method mode */

const METHODS: { key: Method; label: string; detail: string; Icon: typeof CreditCard }[] = [
  { key: 'card', label: 'Card', detail: 'Visa · Mastercard · Amex', Icon: CreditCard },
  { key: 'ach', label: 'Bank (ACH)', detail: 'No processing fee', Icon: Landmark },
  { key: 'zelle', label: 'Zelle', detail: 'Free, from your bank app', Icon: Smartphone },
  { key: 'check', label: 'Check', detail: 'Mail or drop at the office', Icon: Banknote },
]

const PROVIDER_ICON: Record<PaymentProviderKey, typeof CreditCard> = {
  stripe: CreditCard,
  razorpay: Wallet,
  upi: QrCode,
  zelle: Smartphone,
  ach: Landmark,
  'bank-transfer': Building2,
  cheque: Banknote,
  cash: Banknote,
}

/**
 * Payment method chooser.
 *
 * Two modes. Pass `providers` (from `getProviders(temple)`) and it lists exactly what the
 * current temple accepts, in the right order for its country. Without it, it falls back to
 * the original four-method list that other screens still use.
 */
export function PaymentMethodPicker({
  value,
  onChange,
  allow = ['card', 'ach', 'zelle'],
  providers,
  providerValue,
  onProviderChange,
  className,
}: {
  value?: Method
  onChange?: (m: Method) => void
  allow?: Method[]
  providers?: PaymentProvider[]
  providerValue?: PaymentProviderKey
  onProviderChange?: (k: PaymentProviderKey) => void
  className?: string
}) {
  const t = useT()

  if (providers) {
    return (
      <div
        className={cn('grid gap-2 sm:grid-cols-2', className)}
        role="radiogroup"
        aria-label={t('giving.payment.method', 'Payment method')}
      >
        {providers.map((p) => {
          const active = providerValue === p.key
          const Icon = PROVIDER_ICON[p.key]
          return (
            <button
              key={p.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onProviderChange?.(p.key)}
              className={cn(
                'flex items-start gap-2.5 rounded-[10px] border p-3 text-left transition-colors active:scale-[.99]',
                active
                  ? 'border-brand-500 bg-brand-500/6 ring-2 ring-brand-500/20'
                  : 'border-line bg-card hover:border-brand-300',
              )}
            >
              <Icon
                className={cn('mt-0.5 size-4 shrink-0', active ? 'text-brand-500' : 'text-muted')}
              />
              <span className="min-w-0">
                <span className="block text-[13.5px] font-medium text-ink">{p.label}</span>
                <span className="block text-[12px] leading-snug text-muted">{p.detail}</span>
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  const options = METHODS.filter((m) => allow.includes(m.key))

  return (
    <div
      className={cn('grid gap-2 sm:grid-cols-3', className)}
      role="radiogroup"
      aria-label={t('giving.payment.method', 'Payment method')}
    >
      {options.map(({ key, label, detail, Icon }) => {
        const active = value === key
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange?.(key)}
            className={cn(
              'flex items-start gap-2.5 rounded-[10px] border p-3 text-left transition-colors active:scale-[.99]',
              active
                ? 'border-brand-500 bg-brand-500/6 ring-2 ring-brand-500/20'
                : 'border-line bg-card hover:border-brand-300',
            )}
          >
            <Icon
              className={cn('mt-0.5 size-4 shrink-0', active ? 'text-brand-500' : 'text-muted')}
            />
            <span className="min-w-0">
              <span className="block text-[13.5px] font-medium text-ink">{label}</span>
              <span className="block truncate text-[12px] text-muted">{detail}</span>
            </span>
          </button>
        )
      })}
      {/* Picking "Check" raises the one question the button cannot answer: where do I
          send it? Answered here so any flow that offers the method gets the address. */}
      {value === 'check' ? <ChequeInstructions className="col-span-full" /> : null}

      <p className="col-span-full text-[12px] text-muted">
        {t('giving.payment.noCharge', 'No card is charged and no payment processor is contacted.')}
      </p>
    </div>
  )
}
