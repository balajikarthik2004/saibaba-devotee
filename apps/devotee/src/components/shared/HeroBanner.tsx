import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays } from 'lucide-react'
import { useCurrentTemple, useT } from '@saibaba/core'
import type { TempleEvent } from '@/lib/data/types'
import { buttonVariants } from '@/components/ui/button'
import { HERO_PETALS, HeroScene } from '@/components/shared/SaiArt'
import { Sai3DCenterpiece } from '@/components/shared/Sai3DCenterpiece'
import { NextAartiSlot } from '@/components/shared/NextAartiSlot'
import { cn, fmtDate } from '@/lib/utils'

/**
 * The front door: an animated dawn with 3D Sai Baba centerpiece in the sun,
 * one sentence, two actions, and the reserved "Next aarti / Live darshan" slot.
 */
export function HeroBanner({ next, className }: { next?: TempleEvent; className?: string }) {
  const t = useT()
  const temple = useCurrentTemple()

  return (
    <section className={cn('relative isolate overflow-hidden bg-sai-800', className)}>
      <HeroScene className="absolute inset-0 h-full w-full" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {HERO_PETALS.map((p, i) => (
          <span
            key={i}
            className="petal"
            style={
              {
                left: p.left,
                animationDelay: p.delay,
                animationDuration: p.dur,
                '--petal-dx': p.dx,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      <div className="absolute inset-0 bg-linear-to-b from-sai-900/60 via-sai-900/25 to-transparent" />

      <div className="relative mx-auto flex min-h-140 max-w-[1420px] flex-col items-center justify-between gap-8 px-4 py-12 sm:min-h-160 sm:px-8 xl:px-12 lg:flex-row lg:items-center lg:justify-between">
        {/* Left Section: Welcome title, mantra and CTAs shifted to the left */}
        <div className="flex flex-col items-start gap-4 sm:gap-5 lg:max-w-md xl:max-w-lg z-10">
          <p className="text-[11.5px] uppercase tracking-[0.3em] text-saffron-200">
            {temple.name} · {temple.city}
          </p>

          <h1 className="font-serif text-[38px] leading-[1.08] text-white [text-shadow:0_2px_24px_rgba(18,24,51,.6)] sm:text-[52px]">
            Shree Saibaba
            <span className="mt-1 block text-[22px] text-saffron-200 sm:text-[28px]">
              {t('home.tagline', 'Shraddha & Saburi — faith and patience')}
            </span>
          </h1>

          <p className="max-w-lg text-[15px] leading-relaxed text-white/90 [text-shadow:0_1px_10px_rgba(18,24,51,.8)]">
            {t(
              'home.intro',
              'A welcome for every devotee, of every faith. Sit for darshan, keep the Thursday vrat, offer a puja in your family’s name, and see exactly where every gift goes.',
            )}
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-3">
            <Link to="/puja" className={buttonVariants({ size: 'lg', variant: 'saffron' })}>
              {t('home.sponsorPuja', 'Sponsor a puja')}
              <ArrowRight />
            </Link>
            <Link
              to="/donate"
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'lg' }),
                'border-white/50 bg-white/10 text-white backdrop-blur hover:bg-white/20 hover:text-white',
              )}
            >
              {t('home.donate', 'Make a donation')}
            </Link>
          </div>

          {next ? (
            <Link
              to={`/events/${next.slug}`}
              className="group mt-2 inline-flex max-w-full items-center gap-2.5 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-[13px] text-white/90 backdrop-blur transition-colors hover:border-saffron-300/60 hover:bg-white/15"
            >
              <CalendarDays className="size-4 shrink-0 text-saffron-300" aria-hidden="true" />
              <span className="truncate">
                {t('home.nextFestival', 'Next festival')} ·{' '}
                <span className="font-medium text-white">{next.title}</span> ·{' '}
                {fmtDate(next.date, 'MMMM d')}
              </span>
              <ArrowRight className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ) : null}
        </div>

        {/* Right Section: Next Aarti Card shifted to the right */}
        <div className="flex justify-center lg:justify-end z-10 w-full lg:w-auto">
          <NextAartiSlot />
        </div>
      </div>

      {/* 3D Sai Baba Murti positioned directly in the middle core of the rising sun */}
      <div className="pointer-events-none absolute inset-x-0 bottom-10 sm:bottom-12 lg:bottom-24 xl:bottom-18 z-20 flex justify-center">
        <div className="pointer-events-auto">
          <Sai3DCenterpiece />
        </div>
      </div>
    </section>
  )
}
