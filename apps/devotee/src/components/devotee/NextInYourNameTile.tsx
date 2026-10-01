import { Link } from 'react-router-dom'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { CalendarPlus, ChevronRight, Flame, MapPin } from 'lucide-react'
import { useCurrentTemple, useT } from '@saibaba/core'
import { DeityArt } from '@/components/shared/DeityArt'
import type { PujaCatalogItem, PujaOccurrence } from '@/lib/data/types'
import { cn, fmtDate, fmtTime, googleCalendarUrl } from '@/lib/utils'

/**
 * "Next puja in your name" — the tile devotees look at first. Deliberately reads as a
 * sentence, not a stat: a date, a deity, and who it is being offered for.
 *
 * A piece of the illustrated art sits behind the right edge, faded into the indigo, so the
 * tile is recognisable before a word of it is read. It is a container query, not a media
 * query: the tile is also dropped into narrow cards where the art would only crowd.
 */
export function NextInYourNameTile({
  occurrence,
  puja,
  names,
  className,
}: {
  occurrence?: PujaOccurrence
  puja?: PujaCatalogItem
  names?: string[]
  className?: string
}) {
  const t = useT()
  const temple = useCurrentTemple()
  const has = Boolean(occurrence && puja)
  const when = occurrence ? parseISO(occurrence.scheduledAt) : undefined
  const days = when ? differenceInCalendarDays(when, new Date()) : undefined

  const countdown =
    days == null
      ? undefined
      : days < 0
        ? t('when.past', 'Past')
        : days === 0
          ? t('when.today', 'Today')
          : days === 1
            ? t('when.tomorrow', 'Tomorrow')
            : t('when.inDays', 'In {n} days', { n: days })

  return (
    <section
      className={cn(
        '@container relative isolate overflow-hidden rounded-[14px] border border-saffron-300/45',
        'bg-gradient-to-br from-sai-800 via-sai-700 to-sai-800 text-white shadow-[var(--shadow)]',
        className,
      )}
    >
      {/* Deity art, faded into the gradient rather than framed against it. */}
      {has && puja ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-[42%] max-w-[340px] @md:block"
          style={{
            WebkitMaskImage: 'linear-gradient(to right, transparent 2%, #000 62%)',
            maskImage: 'linear-gradient(to right, transparent 2%, #000 62%)',
          }}
        >
          <DeityArt
            deity={puja.deity}
            label=""
            className="h-full w-full bg-transparent opacity-70"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-sai-800/70 via-sai-800/25 to-transparent" />
        </div>
      ) : null}

      {/* A lamp glow in the top-left, so the flat gradient has a light source. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 -top-20 size-56 rounded-full opacity-60"
        style={{
          background: 'radial-gradient(circle, rgba(244,174,34,0.30) 0%, rgba(244,174,34,0) 70%)',
        }}
      />

      <div className="relative p-5 @md:max-w-[62%] @md:p-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="grid size-7 place-items-center rounded-full bg-saffron-400/15 text-saffron-300 ring-1 ring-inset ring-saffron-300/30">
            <Flame className="size-3.5" />
          </span>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-saffron-300">
            {t('next.title', 'Next puja in your name')}
          </p>
          {countdown ? (
            <span className="rounded-full bg-saffron-400/15 px-2.5 py-0.5 text-[11.5px] font-semibold text-saffron-200 ring-1 ring-inset ring-saffron-300/25">
              {countdown}
            </span>
          ) : null}
        </div>

        {has && occurrence && puja && when ? (
          <>
            <p className="mt-3 font-serif text-[27px] leading-tight text-white @md:text-[30px]">
              {puja.name}
            </p>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] text-saffron-100">
              <span className="font-medium text-white/95">{fmtDate(when, 'EEEE, MMM d')}</span>
              <span aria-hidden className="text-white/30">
                ·
              </span>
              <span>{fmtTime(when)}</span>
              <span aria-hidden className="text-white/30">
                ·
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5 opacity-70" />
                {puja.deity} · {temple.name}
              </span>
            </p>

            {names?.length ? (
              <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                <span className="text-[12px] uppercase tracking-[0.1em] text-sai-100/70">
                  {t('next.sankalpam', 'Sankalpam')}
                </span>
                {names.slice(0, 3).map((n) => (
                  <span
                    key={n}
                    className="rounded-full bg-white/10 px-2.5 py-0.5 text-[12.5px] text-white/90"
                  >
                    {n}
                  </span>
                ))}
                {names.length > 3 ? (
                  <span className="text-[12.5px] text-sai-100/80">{t('next.more', '+{n} more', { n: names.length - 3 })}</span>
                ) : null}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Link
                to="/my/pujas"
                className="inline-flex items-center gap-1.5 rounded-md bg-saffron-400 px-3.5 py-2 text-[13px] font-semibold text-brand-900 transition-colors hover:bg-saffron-300"
              >
                {t('next.schedule', 'View my schedule')}
                <ChevronRight className="size-4" />
              </Link>
              <a
                href={googleCalendarUrl({
                  title: `${puja.name} — ${temple.name}`,
                  start: when,
                  details: names?.length ? `Sankalpam for ${names.join(', ')}` : undefined,
                  location: `${temple.name}, ${temple.address}, ${temple.city}`,
                })}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-white/25 px-3.5 py-2 text-[13px] font-medium text-white/90 transition-colors hover:bg-white/10"
              >
                <CalendarPlus className="size-4" />
                {t('next.addCal', 'Add to calendar')}
              </a>
            </div>
          </>
        ) : (
          <>
            <p className="mt-3 font-serif text-[26px] leading-tight text-white/80">
              {t('next.none', 'Nothing scheduled')}
            </p>
            <p className="mt-1.5 max-w-[46ch] text-[13.5px] text-sai-100/85">
              {t('next.noneD', 'Sponsor a puja and your family’s names will be offered at every occurrence — the date will appear here.')}
            </p>
            <Link
              to="/puja"
              className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-saffron-400 px-3.5 py-2 text-[13px] font-semibold text-brand-900 transition-colors hover:bg-saffron-300"
            >
              {t('next.browse', 'Browse pujas')}
              <ChevronRight className="size-4" />
            </Link>
          </>
        )}
      </div>
    </section>
  )
}
