import { Link } from 'react-router-dom'
import { ArrowRight, Clock, Flame, Radio } from 'lucide-react'
import { useCurrentTemple } from '@saibaba/core/tenant'
import { useT } from '@saibaba/core/i18n'
import {
  listFestivalDates,
  nextAarti,
  timeUntil,
  dateInZone,
} from '@saibaba/core/features/aarti'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { useAsync } from '@/lib/hooks'
import { cn } from '@/lib/utils'
import { AartiTimes } from './AartiTimes'
import { useNow, useSlots } from './hooks'

/** Rich "Next Aarti & Daily Schedule" card for the home page. Links to /darshan. */
export function NextAartiCard({ className }: { className?: string }) {
  const t = useT()
  const temple = useCurrentTemple()
  const { data: slots } = useSlots(temple.id)
  const now = useNow(1000)
  const next = slots ? nextAarti(slots, temple, now) : null
  const left = next ? timeUntil(next.instant, now) : null

  const defaultAartis = [
    { name: 'Kakad Aarti', time: '6:00 AM', slotKey: 'kakad' },
    { name: 'Madhyan Aarti', time: '12:00 PM', slotKey: 'madhyan' },
    { name: 'Dhoop Aarti', time: '6:30 PM', slotKey: 'dhoop' },
    { name: 'Shej Aarti', time: '8:00 PM', slotKey: 'shej' },
  ]

  return (
    <Card className={cn('flex flex-col justify-between overflow-hidden', className)}>
      <div>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-[17px]">
              <Flame className="size-5 text-brand-500" aria-hidden="true" />
              {t('aarti.cardTitle', 'Daily Aartis')}
            </CardTitle>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-saffron-100/70 px-2.5 py-0.5 text-[11.5px] font-semibold text-brand-700">
              <span className="size-1.5 animate-pulse rounded-full bg-brand-500" />
              Live
            </span>
          </div>
          <p className="text-[12.5px] text-muted">
            {temple.city} ({temple.timezone})
          </p>
        </CardHeader>

        <div className="px-5 pb-3">
          {/* Next Aarti Highlight */}
          <div className="rounded-lg border border-saffron-200 bg-saffron-50/60 p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand-700">
                  {t('aarti.nextLabel', 'Next Aarti')} · {next?.slot.name ?? 'Aarti'}
                </p>
                <p className="mt-0.5 font-mono text-[24px] font-bold leading-tight text-ink" aria-live="off">
                  {left ? left.clock : '--:--:--'}
                </p>
              </div>
              <Clock className="size-5 text-saffron-600" />
            </div>
            {next && (
              <div className="mt-2 border-t border-saffron-200/70 pt-2">
                <AartiTimes
                  instant={next.instant}
                  templeTimeZone={temple.timezone}
                  city={temple.city}
                  className="text-[12px] font-medium"
                />
              </div>
            )}
          </div>

          {/* 4 Daily Aartis Mini Schedule */}
          <div className="mt-3.5 space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              {t('aarti.schedule', 'Today’s 4 Aartis')}
            </p>
            <div className="grid grid-cols-2 gap-1.5 text-[12.5px]">
              {defaultAartis.map((a) => {
                const isCurrentNext = next?.slot.name.toLowerCase().includes(a.slotKey)
                return (
                  <div
                    key={a.slotKey}
                    className={cn(
                      'flex items-center justify-between rounded-md px-2.5 py-1.5',
                      isCurrentNext
                        ? 'bg-saffron-100 font-semibold text-brand-800'
                        : 'bg-tint/60 text-ink/80',
                    )}
                  >
                    <span className="truncate">{a.name.split(' ')[0]}</span>
                    <span className="text-[11.5px] text-muted">{a.time}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-line bg-tint/30 p-3 px-5">
        <Link
          to="/darshan"
          className="flex items-center justify-between text-[13px] font-semibold text-brand-600 transition-colors hover:text-brand-700"
        >
          <span className="flex items-center gap-1.5">
            <Radio className="size-4 text-brand-500" />
            {t('aarti.liveDarshan', 'Join Live Darshan')}
          </span>
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </Card>
  )
}

/** Next few festival dates for this temple (global + temple-specific), unverified flagged. */
export function FestivalListMini({ limit = 4, className }: { limit?: number; className?: string }) {
  const t = useT()
  const temple = useCurrentTemple()
  const { data, loading } = useAsync(() => listFestivalDates(temple.id), [temple.id])
  const today = dateInZone(new Date(), temple.timezone)
  const upcoming = (data ?? []).filter((f) => (f.endDate ?? f.date) >= today).slice(0, limit)
  const fmt = new Intl.DateTimeFormat(temple.locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })

  return (
    <Card className={cn('flex flex-col justify-between', className)}>
      <div>
        <CardHeader className="pb-3">
          <CardTitle className="text-[17px]">
            {t('aarti.festivals', 'Festival Dates')}
          </CardTitle>
          <p className="text-[12.5px] text-muted">
            {t('aarti.datesConfirmed', 'Dates confirmed by your temple')}
          </p>
        </CardHeader>

        <div className="px-5 pb-2">
          {loading ? (
            <p className="text-[13.5px] text-muted">{t('aarti.loading', 'Loading festival dates…')}</p>
          ) : upcoming.length === 0 ? (
            <p className="text-[13.5px] text-muted">{t('aarti.noFestivals', 'No festival dates listed yet.')}</p>
          ) : (
            <ul className="divide-y divide-line/70">
              {upcoming.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-serif text-[15px] font-medium text-ink">{f.name}</p>
                    <p className="text-[12px] text-muted">
                      {fmt.format(new Date(`${f.date}T00:00:00Z`))}
                    </p>
                  </div>
                  {f.verified ? (
                    <Badge variant="leaf">{t('aarti.confirmed', 'Confirmed')}</Badge>
                  ) : (
                    <Badge variant="neutral">{t('aarti.tentative', 'Tentative')}</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="border-t border-line bg-tint/30 p-3 px-5">
        <Link
          to="/events"
          className="flex items-center justify-between text-[13px] font-semibold text-brand-600 transition-colors hover:text-brand-700"
        >
          <span>{t('events.viewAll', 'View All Festivals')}</span>
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </Card>
  )
}
