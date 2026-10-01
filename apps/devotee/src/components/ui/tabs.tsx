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
    <div
      role="tablist"
      className={cn('flex gap-1 overflow-x-auto border-b border-line', className)}
    >
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
              '-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-[13.5px] font-medium transition-colors',
              active
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {t.label}
            {typeof t.count === 'number' ? (
              <span className="ml-1.5 text-[11.5px] text-muted">{t.count}</span>
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
    <div className={cn('flex flex-wrap gap-2', className)}>
      {items.map((c) => {
        const active = c.key === value
        return (
          <button
            key={c.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(c.key)}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors active:scale-[.97]',
              active
                ? 'border-brand-500 bg-brand-500 text-white'
                : 'border-line bg-card text-muted hover:border-brand-300 hover:text-ink',
            )}
          >
            {c.label}
          </button>
        )
      })}
    </div>
  )
}
