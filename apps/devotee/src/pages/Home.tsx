import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useCurrentTemple, useT } from '@saibaba/core'
import { HeroBanner } from '@/components/shared/HeroBanner'
import { SpacesStrip } from '@/components/shared/SpacesStrip'
import { TransparencyStrip } from '@/components/shared/TransparencyStrip'
import { EventCard } from '@/components/shared/EventCard'
import { LoadingSkeleton } from '@/components/shared/states'
import { Skeleton } from '@/components/ui/badge'
import { listEvents } from '@/lib/data/api'
import { useAsync } from '@/lib/hooks'
import { DailyMessageCard } from '@/features/devotion/widgets'
import { FestivalListMini, NextAartiCard } from '@/features/aarti/widgets'
import { AnnadanamHighlight } from '@/features/fulfilment/widgets'
import { PrayerWallTeaser } from '@/features/community/widgets'
import { BhikshaBowlIcon, DhuniFlameIcon, PadukasIcon } from '@/components/shared/SaiIcons'

export default function Home() {
  const t = useT()
  const temple = useCurrentTemple()
  const { data: events, loading } = useAsync(() => listEvents('upcoming'), [temple.id])
  const upcoming = events ?? []

  const actions = [
    {
      to: '/darshan',
      Icon: PadukasIcon,
      title: t('home.qaDarshan', 'Live darshan'),
      detail: t('home.qaDarshanD', 'Sit at Baba’s sacred Padukas from anywhere'),
    },
    {
      to: '/vrat',
      Icon: DhuniFlameIcon,
      title: t('home.qaVrat', 'Thursday vrat'),
      detail: t('home.qaVratD', 'Keep the nine-Thursday vow, one week at a time'),
    },
    {
      to: '/puja',
      Icon: BhikshaBowlIcon,
      title: t('home.qaPuja', 'Sponsor a puja'),
      detail: t('home.qaPujaD', 'Offerings and seva in your family’s name'),
    },
  ]

  return (
    <div>
      {loading ? (
        <Skeleton className="h-130 w-full rounded-none sm:h-145" />
      ) : (
        <HeroBanner next={upcoming[0]} />
      )}

      {/* Three ways in — the things devotees most often come to do. */}
      <section
        aria-label={t('home.quickActions', 'Quick actions')}
        className="border-b border-line bg-tint/70"
      >
        <ul className="mx-auto grid max-w-5xl gap-3 px-6 py-5 sm:grid-cols-3">
          {actions.map(({ to, Icon, title, detail }) => (
            <li key={to}>
              <Link
                to={to}
                className="group flex h-full items-center gap-3.5 rounded-xl border border-line bg-card p-4 shadow-(--shadow-sm) transition-all hover:-translate-y-0.5 hover:border-saffron-300 hover:shadow-(--shadow)"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-saffron-100 text-brand-600">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-serif text-[18px] leading-tight text-ink">{title}</span>
                  <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{detail}</span>
                </span>
                <ArrowRight
                  className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Today with Baba: next aarti, the day's message, and what is coming up. */}
      <section
        aria-label={t('home.today', 'Today with Baba')}
        className="mx-auto grid max-w-6xl gap-5 px-6 pt-14 lg:grid-cols-3"
      >
        <NextAartiCard />
        <DailyMessageCard />
        <FestivalListMini />
      </section>

      <SpacesStrip className="py-16" />

      <TransparencyStrip />

      <section className="mx-auto max-w-6xl px-6 py-16 pb-4">
        <div className="mb-7 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="rule-saffron font-serif text-[30px] leading-tight">
              {t('home.festivals', 'Upcoming festivals')}
            </h2>
            <p className="mt-3 max-w-md text-[14.5px] leading-relaxed text-muted">
              {t(
                'home.festivalsLead',
                'Each festival carries a published budget — you can see what it costs and what has been raised. Dates are confirmed by your temple.',
              )}
            </p>
          </div>
          <Link
            to="/events"
            className="group mt-1.5 inline-flex shrink-0 items-center gap-1.5 text-[14px] font-medium text-brand-500 hover:text-brand-600"
          >
            {t('events.all', 'All festivals')}
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {loading ? (
          <LoadingSkeleton rows={3} className="lg:grid-cols-3" />
        ) : upcoming.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-line bg-card/60 p-6 text-center text-[14px] text-muted">
            {t('home.noFestivals', 'No festivals are published for this temple yet.')}
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.slice(0, 3).map((e) => (
              <EventCard key={e.id} event={e} showMeter />
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-6 pb-16 pt-10 lg:grid-cols-2">
        <AnnadanamHighlight />
        <PrayerWallTeaser />
      </section>
    </div>
  )
}
