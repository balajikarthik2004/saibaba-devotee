import { Search, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * One filter row for every list view.
 *
 * It no longer draws its own card. `PageShell` gives the filters a band of their own
 * under the page title and pins the whole block, so a bordered rail here would be a
 * box inside a box — two rules two pixels apart, which is the sort of thing that reads
 * as untidy long before anyone can say why.
 */
export function Toolbar({
  search,
  onSearch,
  searchPlaceholder = 'Search',
  children,
  onClear,
  activeCount = 0,
  className,
}: {
  search?: string
  onSearch?: (v: string) => void
  searchPlaceholder?: string
  children?: React.ReactNode
  onClear?: () => void
  /** Number of filters currently narrowing the list, shown as a badge. */
  activeCount?: number
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {onSearch ? (
        <div className="relative min-w-[200px] max-w-[380px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
          <Input
            value={search ?? ''}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-8 border-line bg-card pl-8 text-sm"
          />
        </div>
      ) : null}

      {children ? (
        <div className="flex flex-wrap items-center gap-2">
          {/* A hairline divider, not just a gap: it separates "what am I searching for"
              from "how am I narrowing it" without another bordered box. */}
          {onSearch ? (
            <span className="mx-0.5 hidden h-5 w-px shrink-0 bg-line sm:block" aria-hidden="true" />
          ) : null}
          <SlidersHorizontal className="size-3.5 shrink-0 text-faint" aria-hidden="true" />
          {children}
        </div>
      ) : null}

      {onClear && activeCount > 0 ? (
        <Button variant="plain" size="sm" onClick={onClear} className="ml-auto text-brand-600">
          <X />
          Clear {activeCount} filter{activeCount === 1 ? '' : 's'}
        </Button>
      ) : null}
    </div>
  )
}

/** Compact select sized for the toolbar rail. */
export function ToolbarSelect({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-8 cursor-pointer appearance-none rounded-[var(--radius)] border border-line bg-card pl-2.5 pr-7 text-sm font-medium text-ink-soft',
        'bg-[length:13px] bg-[right_8px_center] bg-no-repeat transition-colors',
        'hover:border-muted hover:text-ink focus-visible:border-brand-400',
        className,
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236f6157' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
      {...props}
    />
  )
}

/** Date input sized to match ToolbarSelect, with its label inline. */
export function ToolbarDate({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-semibold text-faint">
      {label}
      <input
        type="date"
        className="h-8 rounded-[var(--radius)] border border-line bg-card px-2 text-sm font-medium tabular-nums text-ink-soft transition-colors hover:border-muted focus-visible:border-brand-400"
        {...props}
      />
    </label>
  )
}
