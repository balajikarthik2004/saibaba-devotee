import { Link } from 'react-router-dom'
import { BookOpen, Clock, Flame, HandHeart, Radio, Video, VideoOff } from 'lucide-react'
import { useCurrentTemple } from '@saibaba/core/tenant'
import { useT } from '@saibaba/core/i18n'
import {
  DEMO_EMBED,
  getLiveStream,
  isLiveWindow,
  nextAarti,
  timeUntil,
  todaysAartis,
} from '@saibaba/core/features/aarti'
import type { AartiSlot, LiveStream } from '@saibaba/core/types.sai'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/badge'
import { useAsync } from '@/lib/hooks'
import { cn } from '@/lib/utils'
import { AartiTimes } from './AartiTimes'
import { AddOccurrenceToCalendar, AddWeeklyToCalendar } from './AddToCalendar'
import { useNow, useSlots } from './hooks'
import { FestivalListMini } from './widgets'

const isPlaceholderEmbed = (url: string) => !url || url === DEMO_EMBED || /DEMO/i.test(url)

function Player({ stream, templeName }: { stream: LiveStream; templeName: string }) {
  const t = useT()
  const t0 = t('aarti.playerTitle', 'Live darshan from {temple}', { temple: templeName })
  const playable = stream.provider !== 'none' && !isPlaceholderEmbed(stream.embedUrl)

  if (playable && stream.provider === 'hls') {
    return (
      <video
        className="aspect-video w-full rounded-xl bg-ink"
        src={stream.embedUrl}
        controls
        playsInline
        aria-label={t0}
      />
    )
  }
  if (playable) {
    return (
      <iframe
        title={t0}
        src={stream.embedUrl}
        className="aspect-video w-full rounded-xl border border-line bg-ink"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        loading="lazy"
      />
    )
  }
  return (
    <div
      role="img"
      aria-label={t('aarti.offlineAria', 'The live stream is not available right now')}
      className="grid aspect-video w-full place-items-center rounded-xl border border-line bg-tint p-6 text-center"
    >
      <div className="max-w-sm">
        <VideoOff className="mx-auto mb-3 size-9 text-saffron-600" aria-hidden="true" />
        <p className="font-serif text-[22px] text-ink">
          {t('aarti.offlineTitle', 'Darshan is resting')}
        </p>
        <p className="mt-1 text-[14px] leading-relaxed text-muted">
          {t(
            'aarti.offlineBody',
            'The live stream is not running at the moment. The next aarti time is shown below — join us then, or watch a recent recording.',
          )}
        </p>
        <Link
          to="/recordings"
          className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-medium text-brand-500 hover:text-brand-600"
        >
          <Video className="size-4" aria-hidden="true" />
          {t('aarti.watchRecordings', 'Watch recordings')}
        </Link>
      </div>
    </div>
  )
}

export default function Darshan() {
  const t = useT()
  const temple = useCurrentTemple()
  const now = useNow(1000)
  const { data: slots, loading } = useSlots(temple.id)
  const { data: stream } = useAsync(() => getLiveStream(temple.id), [temple.id])

  const today = slots ? todaysAartis(slots, temple, now) : []
  const next = slots ? nextAarti(slots, temple, now) : null
  const left = next ? timeUntil(next.instant, now) : null
  const liveNow = Boolean(stream?.isLive)

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12.5px] font-medium uppercase tracking-wide text-muted">
            {temple.name}
          </p>
          <h1 className="rule-saffron font-serif text-[30px] leading-tight sm:text-[36px]">
            {t('aarti.darshanTitle', 'Live darshan & aartis')}
          </h1>
        </div>
        <Badge
          variant={liveNow ? 'solid' : 'neutral'}
          className="gap-1.5 text-[12.5px]"
          role="status"
          aria-live="polite"
        >
          <Radio className={cn('size-3.5', liveNow && 'animate-pulse')} aria-hidden="true" />
          {liveNow ? t('aarti.live', 'Live now') : t('aarti.offline', 'Offline')}
        </Badge>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {stream ? (
            <Player stream={stream} templeName={temple.name} />
          ) : (
            <Skeleton className="aspect-video w-full rounded-xl" />
          )}

          <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
            <span className="grid size-10 place-items-center rounded-full bg-tint text-saffron-600">
              <Clock className="size-5" aria-hidden="true" />
            </span>
            {next && left ? (
              <div className="min-w-0">
                <p className="text-[13px] text-muted">
                  {t('aarti.nextIn', 'Next aarti in')} · {next.slot.name}
                </p>
                <p
                  className="font-mono text-[28px] leading-tight text-ink"
                  role="timer"
                  aria-label={t('aarti.countdownAria', 'Time until the next aarti')}
                >
                  {left.clock}
                </p>
                <AartiTimes
                  instant={next.instant}
                  templeTimeZone={temple.timezone}
                  city={temple.city}
                  withDate
                  className="text-[13px]"
                />
              </div>
            ) : (
              <p className="text-[14px] text-muted">
                {loading
                  ? t('aarti.loading', 'Loading aarti times…')
                  : t('aarti.noneScheduled', 'No aartis are scheduled right now.')}
              </p>
            )}
          </Card>
        </div>

        <aside className="space-y-4" aria-label={t('aarti.weeklyRhythm', 'Weekly rhythm')}>
          <Card className="p-4">
            <h2 className="font-serif text-[19px] text-ink">
              {t('aarti.thursdayTitle', "Thursday — Baba's day")}
            </h2>
            <p className="mt-1 text-[13.5px] leading-relaxed text-muted">
              {t(
                'aarti.thursdayBody',
                'Thursday evenings include a palki procession. Add the weekly rhythm to your calendar so it keeps to your own clock.',
              )}
            </p>
            <div className="mt-3">
              {slots ? <AddWeeklyToCalendar slots={slots} temple={temple} thursdayOnly /> : null}
            </div>
          </Card>
          <div>
            <h2 className="mb-2 font-serif text-[19px] text-ink">
              {t('aarti.festivals', 'Festival dates')}
            </h2>
            <FestivalListMini limit={3} />
          </div>
        </aside>
      </div>

      <section className="mt-10" aria-labelledby="today-aartis">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="today-aartis" className="font-serif text-[24px] text-ink">
            {t('aarti.todayTitle', "Today's aartis")}
          </h2>
          {slots ? <AddWeeklyToCalendar slots={slots} temple={temple} /> : null}
        </div>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : today.length === 0 ? (
          <p className="text-[14px] text-muted">
            {t('aarti.noneToday', 'No aartis are scheduled today.')}
          </p>
        ) : (
          <ol className="relative space-y-3 border-l-2 border-line pl-5">
            {today.map((o) => {
              const slot: AartiSlot = o.slot
              const past = o.instant.getTime() + slot.durationMin * 60000 < now.getTime()
              const live = isLiveWindow(slot, now, temple.timezone)
              const isNext = next?.slot.id === slot.id && next?.date === o.date
              return (
                <li key={slot.id} className="relative">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute -left-6.75 top-5 size-3 rounded-full border-2 border-bg',
                      live ? 'bg-brand-500' : isNext ? 'bg-saffron-400' : past ? 'bg-line' : 'bg-muted',
                    )}
                  />
                  <Card className={cn('p-4', past && !live && 'opacity-70')}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="flex flex-wrap items-center gap-2 font-serif text-[19px] text-ink">
                          {slot.name}
                          {live ? <Badge variant="solid">{t('aarti.inProgress', 'In progress')}</Badge> : null}
                          {isNext && !live ? <Badge variant="gold">{t('aarti.upNext', 'Up next')}</Badge> : null}
                        </h3>
                        <AartiTimes
                          instant={o.instant}
                          templeTimeZone={temple.timezone}
                          city={temple.city}
                          className="text-[14px]"
                        />
                        <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{slot.description}</p>
                      </div>
                      <AddOccurrenceToCalendar occ={o} temple={temple} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        to={`/aarti/${slot.key}`}
                        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-card px-3.5 text-[13px] font-medium text-ink hover:bg-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                      >
                        <BookOpen className="size-4" aria-hidden="true" />
                        {t('aarti.followAlong', 'Follow along')}
                      </Link>
                      {slot.sponsorable ? (
                        <Link
                          to="/puja"
                          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-saffron-400 px-3.5 text-[13px] font-medium text-brand-800 hover:bg-saffron-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                        >
                          <HandHeart className="size-4" aria-hidden="true" />
                          {t('aarti.sponsor', 'Sponsor this aarti')}
                        </Link>
                      ) : null}
                    </div>
                  </Card>
                </li>
              )
            })}
          </ol>
        )}
        <p className="mt-4 flex items-center gap-1.5 text-[12.5px] text-muted">
          <Flame className="size-3.5" aria-hidden="true" />
          {t('aarti.tzNote', "Times are the temple's local time; your own time is shown when it differs.")}
        </p>
      </section>
    </div>
  )
}
