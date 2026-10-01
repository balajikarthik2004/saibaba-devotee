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

/**
 * Tones colour the icon chip and a hairline rail, not the card body. Four fully tinted
 * boxes in a row compete with each other and with the figures inside them; a white body
 * with a coloured edge lets the row read as one band of numbers.
 */
const TONE_RAIL: Record<NonNullable<StatTileProps['tone']>, string> = {
  default: 'before:bg-line',
  brand: 'before:bg-brand-500',
  gold: 'before:bg-saffron-500',
  leaf: 'before:bg-leaf-500',
}

const TONE_ICON: Record<NonNullable<StatTileProps['tone']>, string> = {
  default: 'bg-tint text-muted ring-line',
  brand: 'bg-brand-500/[0.09] text-brand-600 ring-brand-500/15',
  gold: 'bg-gold-500/[0.13] text-gold-600 ring-gold-500/20',
  leaf: 'bg-leaf-500/[0.11] text-leaf-600 ring-leaf-500/18',
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
        'relative flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] border border-hairline bg-card py-3.5 pl-4 pr-3.5 shadow-[var(--shadow-sm)]',
        'before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:content-[""]',
        TONE_RAIL[tone],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow min-w-0 truncate">{label}</p>
        {Icon ? (
          <span
            className={cn(
              'grid size-7 shrink-0 place-items-center rounded-[7px] ring-1',
              TONE_ICON[tone],
            )}
          >
            <Icon className="size-[15px]" />
          </span>
        ) : null}
      </div>

      <p className="stat-figure mt-2.5">{value}</p>

      {/* The caption absorbs the slack, not the number: `mt-auto` holds every caption in
          the row along one bottom edge while the figures stay tucked under their labels. */}
      {sub || trend ? (
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-2">
          {sub ? <p className="text-sm leading-tight text-muted">{sub}</p> : null}
          {trend ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-1.5 py-px text-xs font-bold',
                trend.direction === 'up'
                  ? 'bg-leaf-500/10 text-leaf-600'
                  : 'bg-brand-500/[0.08] text-brand-600',
              )}
            >
              {trend.direction === 'up' ? (
                <TrendingUp className="size-3" />
              ) : (
                <TrendingDown className="size-3" />
              )}
              {trend.value}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
