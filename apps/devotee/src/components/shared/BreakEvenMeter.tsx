import { Progress } from '@/components/ui/badge'
import { useT } from '@saibaba/core'
import { cn, useMoney } from '@/lib/utils'

/**
 * Target vs collected vs balance — the single visual that carries the temple's
 * transparency promise. Used publicly on event pages and internally on the P&L.
 */
export function BreakEvenMeter({
  target,
  collected,
  label,
  compact = false,
  className,
}: {
  target: number
  collected: number
  label?: string
  compact?: boolean
  className?: string
}) {
  const t = useT()
  const money = useMoney()
  const moneyShort = money.short
  const pctRaw = target > 0 ? (collected / target) * 100 : 0
  const balance = Math.max(0, target - collected)
  const met = collected >= target

  return (
    <div className={cn('min-w-0', className)}>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-[12.5px] font-medium text-ink">{label ?? t('meter.breakEven', 'Break-even')}</span>
        <span
          className={cn('text-[12.5px] font-semibold', met ? 'text-leaf-500' : 'text-brand-600')}
        >
          {Math.round(pctRaw)}% {t('meter.of', 'of')} {compact ? moneyShort(target) : money(target)}
        </span>
      </div>
      <Progress
        value={pctRaw}
        tone={met ? 'leaf' : 'brand'}
        label={`${label ?? t('meter.breakEven', 'Break-even')} — ${Math.round(pctRaw)}% ${t('meter.raised', 'of target raised')}`}
      />
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[12px] text-muted">
        <span>
          <span className="font-medium text-ink">
            {compact ? moneyShort(collected) : money(collected)}
          </span>{' '}
          {t('meter.collected', 'collected')}
        </span>
        <span>
          {met ? (
            <span className="font-medium text-leaf-500">{t('meter.met', 'Break-even met')}</span>
          ) : (
            <>
              <span className="font-medium text-brand-600">
                {compact ? moneyShort(balance) : money(balance)}
              </span>{' '}
              {t('meter.toGo', 'to go')}
            </>
          )}
        </span>
      </div>
    </div>
  )
}
