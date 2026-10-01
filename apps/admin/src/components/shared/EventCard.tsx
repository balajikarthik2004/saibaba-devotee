import { Link } from 'react-router-dom'
import { Users } from 'lucide-react'
import type { TempleEvent } from '@/lib/data/types'
import { buttonVariants } from '@/components/ui/button'
import { BreakEvenMeter } from './BreakEvenMeter'
import { DeityArt } from './DeityArt'
import { cn, fmtDate, money } from '@/lib/utils'

/** Festivals borrow the deity most associated with them, so cards stay recognisable. */
export function eventImageKey(title: string) {
  if (/navaratri|durga|vijayadashami/i.test(title)) return 'Durga'
  if (/ganesh/i.test(title)) return 'Ganesha'
  if (/lakshmi/i.test(title)) return 'Lakshmi'
  if (/murugan|thai pusam|panguni/i.test(title)) return 'Murugan'
  if (/vaikunta|rama/i.test(title)) return 'Venkateshwara'
  if (/deepavali|karthigai|deepam/i.test(title)) return 'deepam'
  if (/aadi|pournami|pradosha/i.test(title)) return 'Sundareswarar'
  return 'lamps'
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
  const date = new Date(event.date)

  return (
    <article
      className={cn(
        'group flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-line bg-card shadow-[var(--shadow-sm)] transition-all duration-300 hover:-translate-y-0.5 hover:border-hairline hover:shadow-[var(--shadow)]',
        className,
      )}
    >
      <div className="relative isolate">
        <DeityArt
          deity={eventImageKey(event.title)}
          className="aspect-[16/9] w-full transition-transform duration-500 group-hover:scale-[1.05]"
          label={event.title}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-900/70 to-transparent" />

        {/* Date medallion, in the temple's brass */}
        <div className="absolute left-3.5 top-3.5 rounded-[8px] border border-hairline bg-brand-800/85 px-2.5 py-1 text-center backdrop-blur">
          <span className="block text-2xs font-semibold uppercase tracking-[0.14em] text-saffron-400">
            {fmtDate(date, 'MMM')}
          </span>
          <span className="block font-bold text-xl leading-none text-white">
            {fmtDate(date, 'd')}
          </span>
        </div>

        <span
          className={cn(
            'absolute right-3 top-3 rounded-full px-2.5 py-0.5 text-xs font-semibold',
            event.ticketPrice ? 'bg-saffron-500 text-brand-800' : 'bg-leaf-500/95 text-white',
          )}
        >
          {event.ticketPrice ? money(event.ticketPrice) : 'Free'}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 p-4">
        <h3 className="font-bold text-xl leading-snug">{event.title}</h3>
        <p className="line-clamp-2 text-base leading-relaxed text-muted">{event.description}</p>

        {showMeter ? (
          <BreakEvenMeter
            target={event.targetAmount}
            collected={event.collectedAmount}
            label="Festival budget"
            compact
            className="mt-1.5"
          />
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-3">
          <span className="inline-flex items-center gap-1.5 text-sm text-muted">
            <Users className="size-3.5 text-saffron-500" />
            {event.rsvpCount} attending
          </span>
          <Link
            to={to ?? `/events/${event.slug}`}
            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
          >
            Details
          </Link>
        </div>
      </div>
    </article>
  )
}
