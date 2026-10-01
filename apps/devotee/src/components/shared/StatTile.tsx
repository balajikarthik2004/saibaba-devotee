import type { LucideIcon } from 'lucide-react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface StatTileProps {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  Icon?: LucideIcon
  trend?: { value: string; direction: 'up' | 'down' }
  tone?: 'default' | 'brand' | 'gold' | 'leaf'
  className?: string
}

/* The tone tints the card only faintly — the colour that actually carries the meaning
   is the hairline along the top edge, which reads at a glance across a row of four. */
const TONE_RING: Record<NonNullable<StatTileProps['tone']>, string> = {
  default: 'border-line bg-card',
  brand: 'border-brand-500/20 bg-brand-500/[0.04]',
  gold: 'border-gold-500/25 bg-gold-500/[0.06]',
  leaf: 'border-leaf-500/20 bg-leaf-500/[0.05]',
}

const TONE_ACCENT: Record<NonNullable<StatTileProps['tone']>, string> = {
  default: 'from-line via-gold-400/50 to-transparent',
  brand: 'from-brand-500/70 via-brand-400/40 to-transparent',
  gold: 'from-gold-500/80 via-saffron-300/50 to-transparent',
  leaf: 'from-leaf-500/70 via-leaf-400/40 to-transparent',
}

const TONE_ICON: Record<NonNullable<StatTileProps['tone']>, string> = {
  default: 'bg-tint text-brand-500 ring-line',
  brand: 'bg-brand-500/10 text-brand-600 ring-brand-500/15',
  gold: 'bg-gold-500/12 text-gold-600 ring-gold-500/20',
  leaf: 'bg-leaf-500/10 text-leaf-600 ring-leaf-500/15',
}

export function StatTile({
  label,
  value,
  sub,
  Icon,
  trend,
  tone = 'default',
  className,
}: StatTileProps) {
  return (
    <div
      className={cn(
        'group relative isolate overflow-hidden rounded-[12px] border p-4 shadow-[var(--shadow-sm)]',
        'transition-[box-shadow,transform] duration-200 hover:-translate-y-px hover:shadow-[var(--shadow)]',
        TONE_RING[tone],
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r',
          TONE_ACCENT[tone],
        )}
      />

      <div className="flex items-start justify-between gap-3">
        <p className="pt-0.5 text-[11px] font-semibold uppercase tracking-[0.09em] text-muted">
          {label}
        </p>
        {Icon ? (
          <span
            className={cn(
              'grid size-8 shrink-0 place-items-center rounded-[9px] ring-1 ring-inset',
              TONE_ICON[tone],
            )}
          >
            <Icon className="size-[15px]" />
          </span>
        ) : null}
      </div>

      <p className="mt-2.5 text-[28px] leading-none tabular-nums text-ink">{value}</p>

      {sub || trend ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          {sub ? <p className="text-[12.5px] leading-snug text-muted">{sub}</p> : null}
          {trend ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 text-[12px] font-medium',
                trend.direction === 'up' ? 'text-leaf-500' : 'text-brand-500',
              )}
            >
              {trend.direction === 'up' ? (
                <TrendingUp className="size-3.5" />
              ) : (
                <TrendingDown className="size-3.5" />
              )}
              {trend.value}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
