import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarPlus, ExternalLink } from 'lucide-react'
import { useCurrentTemple, useT } from '@saibaba/core'
import { PageHeader } from '@/components/layout/layouts'
import {
  CalendarLegend,
  MonthCalendar,
  type CalendarEntry,
} from '@/components/shared/MonthCalendar'
import { LoadingSkeleton } from '@/components/shared/states'
import { Chips } from '@/components/ui/tabs'
import { Sheet } from '@/components/ui/overlay'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import {
  getMyBookings,
  getUpcomingOccurrences,
  listEvents,
  listRecurringRules,
} from '@/lib/data/api'
import { eventEntries, expandRules, occurrenceEntries } from '@/lib/calendar'
import { useAuthStore } from '@/lib/store/auth'
import { useAsync } from '@/lib/hooks'
import { listFestivalDates } from '@saibaba/core/features/aarti'
import { cn, fmtDate, fmtTime, googleCalendarUrl } from '@/lib/utils'

export default function CalendarPage() {
  const t = useT()
  const TEMPLE = useCurrentTemple()
  const user = useAuthStore((s) => s.user)
  const [month, setMonth] = useState(() => new Date())
  const [filter, setFilter] = useState<'all' | 'mine'>('all')
  const [selected, setSelected] = useState<Date | null>(null)

  const { data, loading } = useAsync(
    async () =>
      Promise.all([
        listRecurringRules(),
        listEvents(),
        user ? getUpcomingOccurrences(user.id, 400) : Promise.resolve([]),
        user ? getMyBookings(user.id) : Promise.resolve([]),
        listFestivalDates(TEMPLE.id),
      ]),
    [user?.id, TEMPLE.id],
  )

  const entries = useMemo<CalendarEntry[]>(() => {
    if (!data) return []
    const [rules, events, occurrences, bookings, festivals] = data
    const mine = occurrenceEntries(occurrences, bookings)
    if (filter === 'mine') return mine
    // Festival dates are seed data until each temple confirms them against its panchang.
    const festivalEntries: CalendarEntry[] = festivals.map((f) => ({
      id: f.id,
      date: new Date(f.date),
      label: f.name,
      kind: 'event',
      detail: f.verified
        ? f.note
        : t('cal.unverified', 'Date to be confirmed by your temple’s panchang.'),
    }))
    return [...expandRules(month, rules), ...eventEntries(events), ...festivalEntries, ...mine]
  }, [data, month, filter, t])

  const dayEntries = selected
    ? entries
        .filter((e) => e.date.toDateString() === selected.toDateString())
        .sort((a, b) => a.date.getTime() - b.date.getTime())
    : []

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader
        title={t('cal.title', 'Temple calendar')}
        subtitle={t('cal.subtitle', 'The weekly rhythm, the festival year, and the pujas offered in your name.')}
        backTo={user ? '/dashboard' : '/'}
        backLabel={user ? t('cal.backDash', 'Back to Dashboard') : t('cal.backHome', 'Back to home')}
        actions={
          <Chips
            value={filter}
            onChange={(k) => setFilter(k as 'all' | 'mine')}
            items={[
              { key: 'all', label: t('cal.all', 'All events') },
              { key: 'mine', label: t('cal.mine', 'Only my pujas') },
            ]}
          />
        }
      />

      {!user && filter === 'mine' ? (
        <p className="mb-4 rounded-[10px] border border-line bg-tint/60 p-3.5 text-[13px] text-muted">
          <Link to="/signin" className="font-medium text-brand-500 hover:underline">
            {t('nav.signIn', 'Sign in')}
          </Link>{' '}
          {t('cal.signInNote', 'to see the pujas sponsored in your family’s name.')}
        </p>
      ) : null}

      {loading ? (
        <LoadingSkeleton variant="table" rows={6} />
      ) : (
        <>
          <MonthCalendar
            month={month}
            onMonthChange={setMonth}
            entries={entries}
            selected={selected ?? undefined}
            onSelect={setSelected}
          />
          <CalendarLegend className="mt-4" />
          <p className="mt-3 text-[12.5px] text-muted">
            {t('cal.hint', 'Click any day to see its full schedule and add it to your own calendar. All times are in the temple’s time zone:')}{' '}
            {TEMPLE.timezone.replace(/_/g, ' ')} ({TEMPLE.city}).
          </p>
        </>
      )}

      <Sheet
        open={selected != null}
        onClose={() => setSelected(null)}
        title={selected ? fmtDate(selected, 'EEEE, MMMM d') : ''}
        description={t('cal.items', '{n} scheduled item(s)', { n: dayEntries.length })}
      >
        {dayEntries.length === 0 ? (
          <p className="text-[13.5px] text-muted">
            {t('cal.nothing', 'Nothing scheduled. The temple is open for darshan')} {TEMPLE.timings.morning} {t('cal.and', 'and')}{' '}
            {TEMPLE.timings.evening}.
          </p>
        ) : (
          <ul className="space-y-3">
            {dayEntries.map((e) => (
              <li key={e.id} className="rounded-[10px] border border-line p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-ink">{e.label}</p>
                    <p className="text-[12.5px] text-muted">{fmtTime(e.date)}</p>
                  </div>
                  <Badge
                    variant={e.kind === 'my-puja' ? 'brand' : e.kind === 'event' ? 'leaf' : 'gold'}
                  >
                    {e.kind === 'my-puja'
                      ? t('cal.inYourName', 'In your name')
                      : e.kind === 'event'
                        ? t('cal.festival', 'Festival')
                        : t('cal.puja', 'Puja')}
                  </Badge>
                </div>
                {e.detail ? (
                  <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-muted">
                    {e.detail}
                  </p>
                ) : null}
                <a
                  href={googleCalendarUrl({
                    title: `${e.label} — ${TEMPLE.name}`,
                    start: e.date,
                    durationMin: 60,
                    details: e.detail,
                    location: `${TEMPLE.address}, ${TEMPLE.city}, ${TEMPLE.state} ${TEMPLE.zip}`,
                  })}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'mt-3')}
                >
                  <CalendarPlus />
                  {t('cal.addGoogle', 'Add to Google Calendar')}
                  <ExternalLink className="size-3" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </div>
  )
}
