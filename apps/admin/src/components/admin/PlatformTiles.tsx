import { Link } from 'react-router-dom'
import { Building2, HandCoins, HeartHandshake, Users } from 'lucide-react'
import { formatMoney, useT } from '@saibaba/core'
import { getPlatformStats } from '@saibaba/core/features/tenancy'
import type { CurrencyCode } from '@saibaba/core/types'
import { MetricCard } from '@/components/admin/charts'
import { LoadingSkeleton } from '@/components/shared/states'
import { useAsync } from '@/lib/hooks'

/** Dashboard strip for the `platform` role: network-wide counts, gifts per currency. */
export function PlatformTiles() {
  const t = useT()
  const { data } = useAsync(() => getPlatformStats(), [])
  if (!data) return <LoadingSkeleton variant="tiles" rows={1} />

  const gifts = Object.entries(data.giftsByCurrency) as [CurrencyCode, number][]

  return (
    <section aria-label={t('platform.overview', 'Platform overview')} className="mb-6">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 className="font-serif text-lg text-ink">{t('platform.network', 'Across all temples')}</h2>
        <Link to="/temples" className="text-sm font-medium text-brand-600 hover:underline">
          {t('platform.manage', 'Manage temples')}
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={t('platform.temples', 'Active temples')}
          value={data.temples}
          sub={t('platform.templesSub', 'Live on the platform')}
          Icon={Building2}
          tone="brand"
        />
        <MetricCard
          label={t('platform.devotees', 'Devotees')}
          value={data.devotees}
          sub={t('platform.devoteesSub', 'Registered across temples')}
          Icon={Users}
          tone="leaf"
        />
        <MetricCard
          label={t('platform.bookings', 'Sponsorships')}
          value={data.bookings}
          sub={t('platform.bookingsSub', 'Puja sponsorships, all time')}
          Icon={HeartHandshake}
          tone="gold"
        />
        <MetricCard
          label={t('platform.gifts', 'Gifts by currency')}
          value={gifts.length}
          sub={
            gifts.length
              ? gifts.map(([c, n]) => formatMoney(n, c, { compact: true })).join(' · ')
              : t('platform.noGifts', 'No gifts yet')
          }
          Icon={HandCoins}
          tone="brand"
        />
      </div>
      <p className="mt-1.5 text-xs text-muted">
        {t(
          'platform.noConvert',
          'Each currency is shown in its own units and is never converted.',
        )}
      </p>
    </section>
  )
}
