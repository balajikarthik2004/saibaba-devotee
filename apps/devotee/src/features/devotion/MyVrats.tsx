import { Link } from 'react-router-dom'
import { ArrowRight, Flame } from 'lucide-react'
import { getVratProgress, listMyVrats, listVratPrograms } from '@saibaba/core/features/devotion'
import { useT } from '@saibaba/core/i18n'
import { PageHeader } from '@/components/layout/layouts'
import { EmptyState, LoadingSkeleton } from '@/components/shared/states'
import { Badge, Progress } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAuthStore } from '@/lib/store/auth'
import { useAsync } from '@/lib/hooks'
import { fmtDay } from '@/lib/utils'

export const STATUS_VARIANT = {
  active: 'leaf',
  paused: 'gold',
  completed: 'brand',
  abandoned: 'neutral',
} as const

export default function MyVrats() {
  const t = useT()
  const user = useAuthStore((s) => s.user)!
  const { data, loading } = useAsync(
    async () => Promise.all([listMyVrats(user.id), listVratPrograms()]),
    [user.id],
  )

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t('vrat.myVrats', 'My vrats')}
        subtitle={t('vrat.myVratsSub', 'Your Thursday practice, week by week.')}
        actions={
          <Link to="/vrat" className={buttonVariants({ size: 'sm' })}>
            <Flame />
            {t('vrat.beginAnother', 'Begin a vrat')}
          </Link>
        }
      />
      {loading || !data ? (
        <LoadingSkeleton variant="table" rows={3} />
      ) : data[0].length === 0 ? (
        <EmptyState
          Icon={Flame}
          title={t('vrat.noneYet', 'You have not begun a vrat yet')}
          detail={t('vrat.noneYetDetail', 'Nine Thursdays of simple devotion. You can begin any week.')}
          action={
            <Link to="/vrat" className={buttonVariants({ size: 'sm' })}>
              {t('vrat.learnMore', 'Learn about the vrat')}
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {data[0].map((e) => {
            const program = data[1].find((p) => p.id === e.programId)
            const p = getVratProgress(e)
            const pct = Math.round((Math.min(p.observed, p.total) / p.total) * 100)
            return (
              <li key={e.id}>
                <Link
                  to={`/vrat/${e.id}`}
                  className="block rounded-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                >
                  <Card className="space-y-3 p-4 transition-shadow hover:shadow-[var(--shadow-lg)]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="font-serif text-[18px] text-ink">{program?.name}</h2>
                      <Badge variant={STATUS_VARIANT[e.status]}>{t(`vrat.status.${e.status}`, e.status)}</Badge>
                    </div>
                    <Progress
                      value={pct}
                      tone="gold"
                      label={t('vrat.progressLabel', '{n} of {total} Thursdays observed', {
                        n: p.observed,
                        total: p.total,
                      })}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted">
                      <span>
                        {t('vrat.progressLabel', '{n} of {total} Thursdays observed', {
                          n: p.observed,
                          total: p.total,
                        })}
                      </span>
                      <span className="inline-flex items-center gap-1 font-medium text-brand-600">
                        {p.completed
                          ? t('vrat.readyToComplete', 'All weeks done')
                          : p.nextDate
                            ? t('vrat.next', 'Next: {d}', { d: fmtDay(p.nextDate) })
                            : ''}
                        <ArrowRight className="size-3.5" aria-hidden="true" />
                      </span>
                    </div>
                  </Card>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
