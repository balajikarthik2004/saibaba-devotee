import { Link } from 'react-router-dom'
import { useCurrentTemple, useT } from '@saibaba/core'
import { DeityArt } from './DeityArt'
import { cn } from '@/lib/utils'

/**
 * The places of worship inside the current temple (Samadhi Mandir, Dwarakamai …), as a
 * devotee would walk through them. Each links to the puja catalogue filtered by that space.
 */
export function SpacesStrip({ className }: { className?: string }) {
  const t = useT()
  const temple = useCurrentTemple()
  if (temple.spaces.length === 0) return null

  return (
    <section className={cn('mx-auto max-w-6xl px-6', className)}>
      <div className="mb-7 text-center">
        <h2 className="rule-saffron rule-center font-serif text-[30px] leading-tight">
          {t('home.spacesTitle', 'Places of worship at this temple')}
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-[14.5px] leading-relaxed text-muted">
          {t(
            'home.spacesLead',
            'Choose a space to see the pujas offered there. All are welcome, of every faith.',
          )}
        </p>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {temple.spaces.map((space) => (
          <li key={space.key}>
            <Link
              to={`/puja?space=${encodeURIComponent(space.key)}`}
              className="group relative isolate block overflow-hidden rounded-[10px] shadow-[var(--shadow)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lg)]"
            >
              <DeityArt
                deity={`${space.key} ${space.name}`}
                className="aspect-[3/4] w-full"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-sai-900/90 via-sai-900/25 to-transparent" />
              <div className="pointer-events-none absolute inset-0 rounded-[10px] ring-1 ring-inset ring-saffron-300/0 transition-all duration-300 group-hover:ring-saffron-300/60" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3.5 sm:p-4">
                <p className="font-serif text-[17px] leading-tight text-white sm:text-[19px]">
                  {space.name}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-saffron-100">
                  {space.blurb}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
