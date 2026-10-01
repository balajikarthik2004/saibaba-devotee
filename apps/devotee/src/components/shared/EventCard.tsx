import { Link } from 'react-router-dom'
import { Users } from 'lucide-react'
import type { TempleEvent } from '@/lib/data/types'
import { buttonVariants } from '@/components/ui/button'
import { BreakEvenMeter } from './BreakEvenMeter'
import { DeityArt } from './DeityArt'
import { useT } from '@saibaba/core'
import { cn, fmtDate, useMoney } from '@/lib/utils'

/** Festivals borrow the motif most associated with them, so cards stay recognisable. */
export function eventImageKey(title: string) {
  if (/guru purnima|datta/i.test(title)) return 'rays'
  if (/ram navami|rama/i.test(title)) return 'marigold'
  if (/vijayadashami|punyatithi|samadhi/i.test(title)) return 'seat'
  if (/diwali|deepavali|deepam|lamp/i.test(title)) return 'diyas'
  if (/dhuni|udi/i.test(title)) return 'dhuni'
  if (/ganesh|om/i.test(title)) return 'om'
  if (/lotus|lakshmi|navaratri/i.test(title)) return 'lotus'
  return 'diya'
}

export function EventCard({
  event,
  showMeter = false,
  to,
  className,
}: {
  event: TempleEvent
  showMeter?: boolean
  /** Override the destination — the admin event editor previews the card off-route. */
  to?: string
  className?: string
}) {
  const t = useT()
  const money = useMoney()
  const date = new Date(event.date)

  return (
    <article
      className={cn(
        'group flex flex-col overflow-hidden rounded-[10px] border border-line bg-card shadow-[var(--shadow-sm)] transition-all duration-300 hover:-translate-y-0.5 hover:border-saffron-300/70 hover:shadow-[var(--shadow)]',
        className,
      )}
    >
      <div className="relative isolate overflow-hidden bg-sai-900">
        <DeityArt
          deity={event.title}
          className="aspect-[16/9] w-full"
          label={event.title}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-sai-900/70 to-transparent" />

        {/* Date medallion, in the temple's brass */}
        <div className="absolute left-3.5 top-3.5 rounded-[8px] border border-saffron-300/50 bg-sai-800/85 px-2.5 py-1 text-center backdrop-blur">
          <span className="block text-[9.5px] font-semibold uppercase tracking-[0.14em] text-saffron-300">
            {fmtDate(date, 'MMM')}
          </span>
          <span className="block text-[19px] leading-none tabular-nums text-white">
            {fmtDate(date, 'd')}
          </span>
        </div>

        <span
          className={cn(
            'absolute right-3 top-3 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
            event.ticketPrice ? 'bg-saffron-400/95 text-brand-800' : 'bg-leaf-500/95 text-white',
          )}
        >
          {event.ticketPrice ? money(event.ticketPrice) : t('events.free', 'Free')}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 p-4">
        <h3 className="font-serif text-[19px] leading-snug">{event.title}</h3>
        <p className="line-clamp-2 text-[13.5px] leading-relaxed text-muted">{event.description}</p>

        {showMeter ? (
          <BreakEvenMeter
            target={event.targetAmount}
            collected={event.collectedAmount}
            label={t('events.budget', 'Festival budget')}
            compact
            className="mt-1.5"
          />
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-3">
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted">
            <Users className="size-3.5 text-saffron-500" />
            {event.rsvpCount} {t('events.attending', 'attending')}
          </span>
          <Link
            to={to ?? `/events/${event.slug}`}
            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
          >
            {t('events.details', 'Details')}
          </Link>
        </div>
      </div>
    </article>
  )
}
