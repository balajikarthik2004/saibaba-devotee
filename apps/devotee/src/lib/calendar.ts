import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  getDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import type { CalendarEntry } from '@/components/shared/MonthCalendar'
import type { Booking, PujaOccurrence, RecurringRule, TempleEvent } from '@/lib/data/types'
import { PUJA_BY_ID } from '@/lib/data/mock'

/** Which occurrence of that weekday in the month this date is (1st, 2nd, 3rd…). */
function nthWeekdayOfMonth(d: Date) {
  return Math.floor((d.getDate() - 1) / 7) + 1
}

/**
 * Expands the published weekly rules across a visible month grid. The real build would
 * read these from an iCal feed; here they are plain day-of-week rules.
 */
export function expandRules(month: Date, rules: RecurringRule[]): CalendarEntry[] {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month)),
    end: endOfWeek(endOfMonth(month)),
  })

  const out: CalendarEntry[] = []
  for (const day of days) {
    for (const rule of rules) {
      if (getDay(day) !== rule.dayOfWeek) continue
      if (rule.nth && nthWeekdayOfMonth(day) !== rule.nth) continue
      const at = new Date(day)
      const [h, m] = rule.time.split(':').map(Number)
      at.setHours(h ?? 18, m ?? 0, 0, 0)
      out.push({
        id: `${rule.id}-${day.toISOString().slice(0, 10)}`,
        date: at,
        label: rule.label,
        kind: 'puja',
        time: rule.time,
        detail: rule.pujaCatalogId ? PUJA_BY_ID.get(rule.pujaCatalogId)?.name : undefined,
      })
    }
  }
  return out
}

export function eventEntries(events: TempleEvent[]): CalendarEntry[] {
  return events.map((e) => ({
    id: e.id,
    date: new Date(e.date),
    label: e.title,
    kind: 'event',
    detail: e.description,
  }))
}

export function occurrenceEntries(
  occurrences: PujaOccurrence[],
  bookings: Booking[],
): CalendarEntry[] {
  const byId = new Map(bookings.map((b) => [b.id, b]))
  return occurrences.map((o) => {
    const b = byId.get(o.bookingId)
    const puja = b ? PUJA_BY_ID.get(b.pujaCatalogId) : undefined
    return {
      id: o.id,
      date: new Date(o.scheduledAt),
      label: puja?.name ?? 'Sponsored puja',
      kind: 'my-puja' as const,
      detail: b?.sankalpamNames.join(', '),
    }
  })
}
