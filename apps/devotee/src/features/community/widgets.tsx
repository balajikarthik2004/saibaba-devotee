import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { listPrayers, useCurrentTemple, useT } from '@saibaba/core'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { useAsync } from '@/lib/hooks'
import { MandalaPattern, NeemLeavesIcon } from '@/components/shared/SaiIcons'

/** Three recent approved prayers with a link to the full wall. Safe to drop on any page. */
export function PrayerWallTeaser() {
  const t = useT()
  const temple = useCurrentTemple()
  const { data } = useAsync(() => listPrayers({ templeId: temple.id, wall: true }), [temple.id])
  const items = (data ?? []).slice(0, 3)

  return (
    <Card className="relative flex flex-col justify-between overflow-hidden">
      <MandalaPattern className="absolute -left-12 -top-12 size-48 text-brand-500/10" />
      <div>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-[17px]">
            <NeemLeavesIcon className="size-5 text-leaf-500" aria-hidden="true" />
            {t('prayer.teaser.title', 'Gurusthan Prayer Wall')}
          </CardTitle>
          <p className="text-[13px] text-muted">
            {t('prayer.teaser.sub', 'Held gently by the community. Read one, and pray for someone today.')}
          </p>
        </CardHeader>
        <ul className="space-y-2.5 px-5 pb-2">
          {items.map((p) => (
            <li
              key={p.id}
              className="rounded-lg border border-line/60 bg-tint/40 p-3 text-[13px] leading-relaxed text-ink transition-colors hover:bg-tint/70"
            >
              <p className="line-clamp-2">{p.body}</p>
              <p className="mt-1 text-[11.5px] font-medium text-muted">
                {p.displayName} · <span className="text-brand-600">{t('prayer.prayedCount', '{n} prayed', { n: p.prayerCount })}</span>
              </p>
            </li>
          ))}
        </ul>
      </div>
      <div className="border-t border-line bg-tint/30 p-3 px-5">
        <Link
          to="/prayers"
          className="flex items-center justify-between text-[13px] font-semibold text-brand-600 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
        >
          <span>{t('prayer.teaser.cta', 'Visit the Prayer Wall')}</span>
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </Card>
  )
}
