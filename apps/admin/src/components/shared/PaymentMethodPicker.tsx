import { Banknote, CreditCard, Landmark, Smartphone } from 'lucide-react'
import type { Donation } from '@/lib/data/types'
import { cn } from '@/lib/utils'

type Method = Donation['paymentMethod']

const METHODS: { key: Method; label: string; detail: string; Icon: typeof CreditCard }[] = [
  { key: 'card', label: 'Card', detail: 'Visa · Mastercard · Amex', Icon: CreditCard },
  { key: 'ach', label: 'Bank (ACH)', detail: 'No processing fee', Icon: Landmark },
  { key: 'zelle', label: 'Zelle', detail: 'Sent to the temple’s bank', Icon: Smartphone },
  { key: 'check', label: 'Check', detail: 'Mail or drop at the office', Icon: Banknote },
]

export function PaymentMethodPicker({
  value,
  onChange,
  allow = ['card', 'ach', 'zelle'],
  className,
}: {
  value: Method
  onChange: (m: Method) => void
  allow?: Method[]
  className?: string
}) {
  const options = METHODS.filter((m) => allow.includes(m.key))

  return (
    <div
      className={cn('grid gap-2 sm:grid-cols-3', className)}
      role="radiogroup"
      aria-label="Payment method"
    >
      {options.map(({ key, label, detail, Icon }) => {
        const active = value === key
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(key)}
            className={cn(
              'flex items-start gap-2.5 rounded-[var(--radius-lg)] border p-3 text-left transition-colors active:scale-[.99]',
              active
                ? 'border-brand-500 bg-brand-500/[0.06] ring-2 ring-brand-500/20'
                : 'border-line bg-card hover:border-brand-300',
            )}
          >
            <Icon
              className={cn('mt-0.5 size-4 shrink-0', active ? 'text-brand-500' : 'text-muted')}
            />
            <span className="min-w-0">
              <span className="block text-base font-medium text-ink">{label}</span>
              <span className="block truncate text-sm text-muted">{detail}</span>
            </span>
          </button>
        )
      })}
      <p className="col-span-full text-sm text-muted">
        No card is charged and no payment processor is contacted.
      </p>
    </div>
  )
}
