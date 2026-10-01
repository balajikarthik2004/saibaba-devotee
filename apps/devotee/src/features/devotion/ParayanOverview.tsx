import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, Users } from 'lucide-react'
import { enrollInParayan, listParayanGroups, listParayanPlans } from '@saibaba/core/features/devotion'
import { useT } from '@saibaba/core/i18n'
import { useCurrentTemple } from '@saibaba/core/tenant'
import { PageHeader } from '@/components/layout/layouts'
import { EmptyState, LoadingSkeleton } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/lib/store/auth'
import { useAsync } from '@/lib/hooks'
import { fmtDate } from '@/lib/utils'

export default function ParayanOverview() {
  const t = useT()
  const nav = useNavigate()
  const { toast } = useToast()
  const temple = useCurrentTemple()
  const user = useAuthStore((s) => s.user)
  const [busy, setBusy] = useState<string | null>(null)
  const { data, loading } = useAsync(
    async () => Promise.all([listParayanPlans(), listParayanGroups(temple.id)]),
    [temple.id],
  )

  async function start(planId: string) {
    if (!user) return
    setBusy(planId)
    try {
      await enrollInParayan({ userId: user.id, planId })
      toast(t('parayan.started', 'Your parayan has begun. Jai Sai Ram.'), { tone: 'success' })
      nav('/parayan/my')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong', { tone: 'warn' })
      if (e instanceof Error && /already/i.test(e.message)) nav('/parayan/my')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader
        title={t('parayan.title', 'Sai Satcharitra parayan')}
        subtitle={t(
          'parayan.subtitle',
          'Read the Sai Satcharitra, 51 chapters, in a week, a chapter a day, or at your own pace.',
        )}
        actions={
          user ? (
            <Link to="/parayan/my" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <BookOpen />
              {t('parayan.mine', 'My reading')}
            </Link>
          ) : null
        }
      />

      <Card className="mb-6 p-5">
        <p className="text-[14.5px] leading-relaxed text-ink">
          {t(
            'parayan.what',
            'Parayan means reading a sacred text through, start to finish, as an act of devotion. Many devotees complete the Sai Satcharitra in seven days (a saptah), often beginning on a Thursday. Whatever pace you choose, read with attention and a quiet heart.',
          )}
        </p>
      </Card>

      {loading || !data ? (
        <LoadingSkeleton variant="tiles" rows={3} />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {data[0].map((p) => (
              <Card key={p.id} className="flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-serif text-[18px] leading-tight text-ink">{p.name}</h2>
                  {p.days ? <Badge variant="gold">{t('parayan.daysBadge', '{n} days', { n: p.days })}</Badge> : null}
                </div>
                <p className="text-[13.5px] leading-relaxed text-muted">{p.summary}</p>
                {p.key === 'saptah' ? (
                  <ul className="space-y-0.5 text-[12.5px] text-ink">
                    {p.schedule.map((s) => (
                      <li key={s.day} className="flex justify-between gap-2">
                        <span className="text-muted">{t('parayan.dayN', 'Day {n}', { n: s.day })}</span>
                        <span className="tabular-nums">
                          {t('parayan.chaptersRange', 'Chapters {a}–{b}', {
                            a: s.chapters[0]!,
                            b: s.chapters[s.chapters.length - 1]!,
                          })}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-auto pt-1">
                  {user ? (
                    <Button disabled={busy === p.id} onClick={() => void start(p.id)}>
                      {t('parayan.begin', 'Begin this plan')}
                    </Button>
                  ) : (
                    <Link to="/signin" className={buttonVariants()}>
                      {t('parayan.signIn', 'Sign in to begin')}
                    </Link>
                  )}
                </div>
              </Card>
            ))}
          </div>

          <h2 className="mb-3 mt-10 font-serif text-[21px] text-ink">
            {t('parayan.groupsTitle', 'Read together')}
          </h2>
          <p className="mb-4 text-[14px] text-muted">
            {t(
              'parayan.groupsBody',
              'In a group, the 51 chapters are shared out fairly so a family or community finishes together.',
            )}
          </p>
          {data[1].length === 0 ? (
            <EmptyState Icon={Users} title={t('parayan.noGroups', 'No groups yet at this temple')} />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {data[1].map((g) => (
                <li key={g.id}>
                  <Link
                    to={`/parayan/groups/${g.id}`}
                    className="block rounded-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                  >
                    <Card className="h-full p-4 transition-shadow hover:shadow-[var(--shadow-lg)]">
                      <h3 className="font-serif text-[17px] text-ink">{g.name}</h3>
                      <p className="mt-1 line-clamp-2 text-[13px] text-muted">{g.description}</p>
                      <p className="mt-2 text-[12.5px] text-muted">
                        {t('parayan.membersStart', '{n} members · started {d}', {
                          n: g.assignments.length,
                          d: fmtDate(g.startDate, 'MMM d'),
                        })}
                      </p>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
