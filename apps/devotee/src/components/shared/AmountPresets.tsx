import { CURRENCY_META, GIFT_PRESETS, formatMoney, useT } from '@saibaba/core'
import type { CurrencyCode } from '@saibaba/core'
import { Input } from '@/components/ui/input'
import { cn, money } from '@/lib/utils'

export const DEFAULT_PRESETS = [54, 108, 251, 501, 1001]

/**
 * One-tap gift amounts. Pass `currency` (normally the current temple's) and the presets,
 * symbol and formatting follow it; without it the legacy USD list is used.
 */
export function AmountPresets({
  value,
  onChange,
  presets,
  currency,
  className,
}: {
  value: number
  onChange: (n: number) => void
  presets?: number[]
  currency?: CurrencyCode
  className?: string
}) {
  const t = useT()
  const list = presets ?? (currency ? GIFT_PRESETS[currency] : DEFAULT_PRESETS)
  const isCustom = !list.includes(value)
  const fmt = (n: number) => (currency ? formatMoney(n, currency) : money(n))
  const symbol = currency ? CURRENCY_META[currency].symbol : '$'

  return (
    <div className={cn('space-y-2.5', className)}>
      <div className="flex flex-wrap gap-2">
        {list.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={value === p}
            onClick={() => onChange(p)}
            className={cn(
              'rounded-full border px-4 py-2 text-[14px] font-medium transition-colors active:scale-[.97]',
              value === p
                ? 'border-brand-500 bg-brand-500 text-white'
                : 'border-line bg-card text-ink hover:border-brand-300',
            )}
          >
            {fmt(p)}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={isCustom}
          onClick={() => onChange(list.includes(value) ? 0 : value)}
          className={cn(
            'rounded-full border px-4 py-2 text-[14px] font-medium transition-colors active:scale-[.97]',
            isCustom
              ? 'border-brand-500 bg-brand-500 text-white'
              : 'border-line bg-card text-ink hover:border-brand-300',
          )}
        >
          {t('giving.amount.custom', 'Custom')}
        </button>
      </div>

      {isCustom ? (
        <div className="relative max-w-55">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[15px] text-muted">
            {symbol}
          </span>
          <Input
            type="number"
            min={1}
            step={1}
            autoFocus
            aria-label={t('giving.amount.customLabel', 'Custom amount')}
            value={value || ''}
            onChange={(e) => onChange(Number(e.target.value) || 0)}
            className={symbol.length > 1 ? 'pl-11 text-[15px]' : 'pl-7 text-[15px]'}
            placeholder={t('giving.amount.enter', 'Enter an amount')}
          />
        </div>
      ) : null}
    </div>
  )
}
