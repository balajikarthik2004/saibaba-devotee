import { Link } from 'react-router-dom'
import { ArrowRight, Video } from 'lucide-react'
import { useCurrentTemple, useT } from '@saibaba/core'
import { cn } from '@/lib/utils'

/**
 * SLOT: "Next aarti / Live darshan".
 *
 * A deliberately simple placeholder. The aarti feature slice will replace the body of this
 * component with the live next-aarti countdown and stream status; until then it shows
 * the temple's hours and links to /darshan. Keep the `data-slot` attribute and the link —
 * the homepage layout reserves this space for it.
 */
export function NextAartiSlot({ className }: { className?: string }) {
  const t = useT()
  const temple = useCurrentTemple()
  return (
    <aside
      data-slot="next-aarti"
      aria-label={t('home.nextAartiAria', 'Next aarti and live darshan')}
      className={cn(
        'w-full max-w-md rounded-[14px] border border-white/25 bg-white/10 p-4 text-left text-white shadow-[var(--shadow-lg)] backdrop-blur-md',
        className,
      )}
    >
      <p className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.16em] text-saffron-200">
        <Video className="size-4" aria-hidden="true" />
        {t('home.nextAarti', 'Next aarti · Live darshan')}
      </p>
      <p className="mt-2 font-serif text-[20px] leading-snug">
        {t('home.darshanLine', 'Be with Baba from wherever you are')}
      </p>
      <p className="mt-1 text-[13px] text-white/85">
        {t('home.openHours', 'Mandir open')} {temple.timings.morning} · {temple.timings.evening}
      </p>
      <Link
        to="/darshan"
        className="group mt-3 inline-flex items-center gap-1.5 rounded-md bg-saffron-400 px-3.5 py-2 text-[13.5px] font-semibold text-brand-900 transition-colors hover:bg-saffron-300"
      >
        {t('home.openDarshan', 'Open live darshan')}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </aside>
  )
}
