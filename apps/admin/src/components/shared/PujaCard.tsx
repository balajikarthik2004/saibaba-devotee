import { Link } from 'react-router-dom'
import { Clock, Repeat } from 'lucide-react'
import type { PujaCatalogItem } from '@/lib/data/types'
import { Button, buttonVariants } from '@/components/ui/button'
import { DeityArt } from './DeityArt'
import { cn, money, titleCase } from '@/lib/utils'

export function PujaCard({
  puja,
  to,
  onSponsor,
  className,
}: {
  puja: PujaCatalogItem
  to?: string
  onSponsor?: () => void
  className?: string
}) {
  const href = to ?? `/puja/book/${puja.id}`

  return (
    <article
      className={cn(
        'group flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-line bg-card shadow-[var(--shadow-sm)] transition-all duration-300 hover:-translate-y-0.5 hover:border-hairline hover:shadow-[var(--shadow)]',
        className,
      )}
    >
      <div className="relative isolate">
        <DeityArt
          deity={puja.deity}
          className="aspect-[16/10] w-full transition-transform duration-500 group-hover:scale-[1.05]"
          label={`${puja.deity} — ${puja.name}`}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-900/75 to-transparent" />
        <span className="absolute bottom-2.5 left-3.5 font-bold text-md text-white drop-shadow">
          {puja.deity}
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-saffron-500 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-brand-800">
          {titleCase(puja.type)}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 p-4">
        <h3 className="font-bold text-xl leading-snug text-ink">{puja.name}</h3>

        <p className="line-clamp-2 text-base leading-relaxed text-muted">{puja.description}</p>

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Repeat className="size-3.5 text-saffron-500" />
            {puja.recurringRule ?? titleCase(puja.defaultCadence)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5 text-saffron-500" />
            {puja.durationMin} min
          </span>
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-line pt-3">
          <p className="font-bold text-xl leading-none text-ink">
            {money(puja.basePrice)}
            <span className="ml-1.5 font-sans text-xs text-muted">
              {puja.defaultCadence === 'one-time' ? 'one-time' : 'per year'}
            </span>
          </p>
          {onSponsor ? (
            <Button size="sm" onClick={onSponsor}>
              Sponsor
            </Button>
          ) : (
            <Link to={href} className={buttonVariants({ size: 'sm' })}>
              Sponsor
            </Link>
          )}
        </div>
      </div>
    </article>
  )
}
