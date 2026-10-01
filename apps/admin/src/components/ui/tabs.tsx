import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TabItem {
  key: string
  label: React.ReactNode
  count?: number
}

/** Underlined tab bar. Stands in for shadcn `Tabs` in its controlled form. */
export function Tabs({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem[]
  value: string
  onChange: (key: string) => void
  className?: string
}) {
  return (
    <div role="tablist" className={cn('scroll-x-clean flex gap-4 overflow-x-auto', className)}>
      {items.map((t) => {
        const active = t.key === value
        return (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={cn(
              'flex items-center gap-1.5 whitespace-nowrap border-b-2 pb-2.5 pt-1 text-sm font-semibold transition-colors',
              active
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-muted hover:border-line hover:text-ink',
            )}
          >
            {t.label}
            {/* The count is a chip, not a trailing number — at 11px beside a label it
                was reading as part of the tab name. */}
            {typeof t.count === 'number' ? (
              <span
                className={cn(
                  'rounded-full px-1.5 py-px text-2xs font-bold tabular-nums',
                  active ? 'bg-brand-500/10 text-brand-600' : 'bg-ink/[0.06] text-muted',
                )}
              >
                {t.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

/** Pill-shaped filter chips (catalogue filters, calendar filters). */
export function Chips({
  items,
  value,
  onChange,
  className,
}: {
  items: { key: string; label: React.ReactNode }[]
  value: string
  onChange: (key: string) => void
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {items.map((c) => {
        const active = c.key === value
        return (
          <button
            key={c.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(c.key)}
            className={cn(
              'rounded-full border px-3 py-1 text-sm font-semibold transition-colors active:scale-[.97]',
              active
                ? 'border-brand-500 bg-brand-500 text-white'
                : 'border-line bg-card text-muted hover:border-muted hover:text-ink',
            )}
          >
            {c.label}
          </button>
        )
      })}
    </div>
  )
}
