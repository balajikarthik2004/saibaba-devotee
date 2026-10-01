import { Link } from 'react-router-dom'
import { ArrowRight, Heart } from 'lucide-react'
import { nextOpenDrive } from '@saibaba/core/features/fulfilment'
import { formatMoney } from '@saibaba/core/money'
import { useT } from '@saibaba/core/i18n'
import { useCurrentTemple } from '@saibaba/core/tenant'
import { Progress } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { useAsync } from '@/lib/hooks'
import { fmtDate } from '@/lib/utils'
import { BhikshaBowlIcon, MandalaPattern } from '@/components/shared/SaiIcons'

/** Rich Annadanam Highlight Card for the home page, perfectly proportioned with PrayerWallTeaser. */
export function AnnadanamHighlight() {
  const t = useT()
  const temple = useCurrentTemple()
  const { data: drive } = useAsync(() => nextOpenDrive(temple.id), [temple.id])

  if (!drive) {
    return (
      <Card className="relative flex flex-col justify-between overflow-hidden">
        <MandalaPattern className="absolute -right-12 -top-12 size-48 text-brand-500/10" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BhikshaBowlIcon className="size-5 text-brand-500" aria-hidden="true" />
            {t('anna.title', 'Thursday Annadanam')}
          </CardTitle>
          <p className="text-[13px] text-muted">
            {t('anna.sub', 'Baba’s eternal kitchen — feeding devotees every Thursday.')}
          </p>
        </CardHeader>
        <div className="px-5 pb-5">
          <p className="rounded-lg bg-tint/60 p-4 text-[13.5px] italic text-ink/85">
            &ldquo;If anyone is hungry, feed them; I reside in all beings.&rdquo;
            <span className="mt-1 block text-right text-[12px] font-semibold text-brand-700 not-italic">
              — Shree Sai Baba
            </span>
          </p>
        </div>
        <div className="border-t border-line bg-tint/30 p-4 px-5">
          <Link to="/annadanam" className={buttonVariants({ size: 'sm' })}>
            {t('anna.sponsor', 'Sponsor Meals')}
          </Link>
        </div>
      </Card>
    )
  }

  const pct = drive.mealsTarget ? Math.min(100, Math.round((drive.mealsFunded / drive.mealsTarget) * 100)) : 0
  const remaining = Math.max(0, (drive.mealsTarget || 0) - drive.mealsFunded)

  return (
    <Card className="relative flex flex-col justify-between overflow-hidden">
      <MandalaPattern className="absolute -right-12 -top-12 size-48 text-brand-500/10" />
      <div>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-[17px]">
              <BhikshaBowlIcon className="size-5 text-brand-500" aria-hidden="true" />
              {t('anna.highlight', 'Thursday Annadanam')}
            </CardTitle>
            <span className="rounded-full bg-saffron-100 px-2.5 py-0.5 text-[11.5px] font-semibold text-brand-800">
              {fmtDate(drive.date, 'EEE, MMM d')}
            </span>
          </div>
          <p className="text-[13px] text-muted">
            {t('anna.sub', 'Baba’s kitchen — feeding devotees with love and sanctity.')}
          </p>
        </CardHeader>

        <div className="space-y-4 px-5 pb-3">
          {/* Sacred Baba Quote */}
          <div className="rounded-lg border border-saffron-200/80 bg-saffron-50/70 p-3 text-[13px] text-brand-950">
            <p className="italic">
              &ldquo;He who feeds the hungry gives food to Me.&rdquo;
            </p>
            <p className="mt-0.5 text-right text-[11px] font-semibold text-brand-700 not-italic">
              — Sai Baba
            </p>
          </div>

          {/* Drive Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[13px]">
              <span className="font-semibold text-ink">
                {t('anna.fundedCount', '{funded} of {target} meals sponsored', {
                  funded: drive.mealsFunded,
                  target: drive.mealsTarget,
                })}
              </span>
              <span className="font-mono text-xs font-semibold text-brand-600">
                {pct}% funded
              </span>
            </div>
            <Progress
              value={pct}
              tone="leaf"
              label={t('anna.progress', 'Meals funded for {title}', { title: drive.title })}
            />
            <p className="text-[12px] text-muted">
              {formatMoney(drive.pricePerMeal, drive.currency)} per meal · {remaining} meals needed for this Thursday
            </p>
          </div>

          {/* Quick Meal Sponsorship Presets */}
          <div className="flex flex-wrap gap-2 pt-1">
            {[11, 21, 51].map((meals) => (
              <Link
                key={meals}
                to={`/annadanam/${drive.id}?meals=${meals}`}
                className="rounded-full border border-line bg-tint/60 px-3 py-1 text-[12px] font-medium text-ink transition-colors hover:border-brand-300 hover:bg-tint"
              >
                {meals} meals ({formatMoney(meals * drive.pricePerMeal, drive.currency)})
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-line bg-tint/30 p-3 px-5">
        <Link
          to={`/annadanam/${drive.id}`}
          className={buttonVariants({ size: 'sm' })}
        >
          <Heart className="mr-1.5 size-3.5" />
          {t('anna.feedcta', 'Feed Devotees')}
        </Link>
        <Link
          to="/annadanam"
          className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-600 hover:text-brand-700"
        >
          <span>{t('anna.viewAll', 'All drives')}</span>
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </Card>
  )
}
