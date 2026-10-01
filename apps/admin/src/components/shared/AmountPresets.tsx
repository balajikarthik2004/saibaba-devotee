import { CURRENCY_META, currentTemple } from '@saibaba/core'
import { Input } from '@/components/ui/input'
import { cn, money } from '@/lib/utils'

export const DEFAULT_PRESETS = [54, 108, 251, 501, 1001]

export function AmountPresets({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  className,
}: {
  value: number
  onChange: (n: number) => void
  presets?: number[]
  className?: string
}) {
  const isCustom = !presets.includes(value)

  return (
    <div className={cn('space-y-2.5', className)}>
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={value === p}
            onClick={() => onChange(p)}
            className={cn(
              'rounded-full border px-4 py-2 text-base font-medium transition-colors active:scale-[.97]',
              value === p
                ? 'border-brand-500 bg-brand-500 text-white'
                : 'border-line bg-card text-ink hover:border-brand-300',
            )}
          >
            {money(p)}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={isCustom}
          onClick={() => onChange(presets.includes(value) ? 0 : value)}
          className={cn(
            'rounded-full border px-4 py-2 text-base font-medium transition-colors active:scale-[.97]',
            isCustom
              ? 'border-brand-500 bg-brand-500 text-white'
              : 'border-line bg-card text-ink hover:border-brand-300',
          )}
        >
          Custom
        </button>
      </div>

      {isCustom ? (
        <div className="relative max-w-[220px]">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-md text-muted">
            {CURRENCY_META[currentTemple().currency].symbol}
          </span>
          <Input
            type="number"
            min={1}
            step={1}
            autoFocus
            aria-label="Custom amount"
            value={value || ''}
            onChange={(e) => onChange(Number(e.target.value) || 0)}
            className="pl-7 text-md"
            placeholder="Enter an amount"
          />
        </div>
      ) : null}
    </div>
  )
}
