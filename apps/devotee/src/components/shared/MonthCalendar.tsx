import { useMemo } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface CalendarEntry {
  id: string
  date: Date
  label: string
  kind: 'puja' | 'my-puja' | 'event' | 'closure'
  time?: string
  detail?: string
}

const KIND_DOT: Record<CalendarEntry['kind'], string> = {
  puja: 'bg-gold-500',
  'my-puja': 'bg-brand-500',
  event: 'bg-leaf-500',
  closure: 'bg-muted',
}

const KIND_CHIP: Record<CalendarEntry['kind'], string> = {
  puja: 'bg-gold-500/12 text-gold-600 border-gold-500/25',
  'my-puja': 'bg-brand-500/10 text-brand-600 border-brand-500/25',
  event: 'bg-leaf-500/12 text-leaf-600 border-leaf-500/25',
  closure: 'bg-bg text-muted border-line',
}

export const CALENDAR_LEGEND: { kind: CalendarEntry['kind']; label: string }[] = [
  { kind: 'my-puja', label: 'Pujas in my name' },
  { kind: 'puja', label: 'Regular temple pujas' },
  { kind: 'event', label: 'Festivals & events' },
  { kind: 'closure', label: 'Temple closed' },
]

/** Month grid used by both the devotee calendar and the admin calendar CMS. */
export function MonthCalendar({
  month,
  onMonthChange,
  entries,
  selected,
  onSelect,
  className,
}: {
  month: Date
  onMonthChange: (d: Date) => void
  entries: CalendarEntry[]
  selected?: Date
  onSelect: (d: Date) => void
  className?: string
}) {
  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(month)),
        end: endOfWeek(endOfMonth(month)),
      }),
    [month],
  )

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>()
    for (const e of entries) {
      const key = e.date.toDateString()
      const list = map.get(key) ?? []
      list.push(e)
      map.set(key, list)
    }
    return map
  }, [entries])

  return (
    <div
      className={cn(
        'rounded-[10px] border border-line bg-card shadow-[var(--shadow-sm)]',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-line p-4">
        <h2 className="font-serif text-[20px]">{format(month, 'MMMM yyyy')}</h2>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={() => onMonthChange(new Date())}>
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous month"
            onClick={() => onMonthChange(addMonths(month, -1))}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next month"
            onClick={() => onMonthChange(addMonths(month, 1))}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-line bg-tint/50">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div
            key={d}
            className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.07em] text-muted"
          >
            <span className="hidden sm:inline">{d}</span>
            <span className="sm:hidden">{d[0]}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayEntries = byDay.get(day.toDateString()) ?? []
          const outside = !isSameMonth(day, month)
          const isSelected = selected ? isSameDay(day, selected) : false

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelect(day)}
              aria-label={`${format(day, 'MMMM d')}, ${dayEntries.length} entries`}
              aria-current={isToday(day) ? 'date' : undefined}
              className={cn(
                'group relative flex min-h-[76px] flex-col gap-1 border-b border-r border-line p-1.5 text-left transition-colors last:border-r-0 sm:min-h-[104px] sm:p-2',
                outside && 'bg-bg/60',
                isSelected
                  ? 'bg-brand-500/[0.07] ring-1 ring-inset ring-brand-500/30'
                  : 'hover:bg-tint/50',
              )}
            >
              <span
                className={cn(
                  'grid size-6 shrink-0 place-items-center rounded-full text-[12px] tabular-nums',
                  isToday(day) && 'bg-brand-500 font-semibold text-white',
                  !isToday(day) && outside && 'text-muted/60',
                  !isToday(day) && !outside && 'text-ink',
                )}
              >
                {format(day, 'd')}
              </span>

              {/* Compact dots on mobile, labelled chips from sm up */}
              <span className="flex flex-wrap gap-0.5 sm:hidden">
                {dayEntries.slice(0, 4).map((e) => (
                  <span key={e.id} className={cn('size-1.5 rounded-full', KIND_DOT[e.kind])} />
                ))}
              </span>

              <span className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                {dayEntries.slice(0, 2).map((e) => (
                  <span
                    key={e.id}
                    className={cn(
                      'truncate rounded border px-1 py-0.5 text-[10.5px] leading-tight',
                      KIND_CHIP[e.kind],
                    )}
                  >
                    {e.label}
                  </span>
                ))}
                {dayEntries.length > 2 ? (
                  <span className="px-1 text-[10.5px] text-muted">
                    +{dayEntries.length - 2} more
                  </span>
                ) : null}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function CalendarLegend({ className }: { className?: string }) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5', className)}>
      {CALENDAR_LEGEND.map((l) => (
        <li key={l.kind} className="flex items-center gap-1.5 text-[12.5px] text-muted">
          <span className={cn('size-2 rounded-full', KIND_DOT[l.kind])} />
          {l.label}
        </li>
      ))}
    </ul>
  )
}
