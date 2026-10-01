import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Check, Users } from 'lucide-react'
import {
  TOTAL_CHAPTERS,
  listMyParayan,
  listParayanPlans,
  markChapterRead,
  parayanProgress,
} from '@saibaba/core/features/devotion'
import { useT } from '@saibaba/core/i18n'
import { PageHeader } from '@/components/layout/layouts'
import { EmptyState, LoadingSkeleton } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Chips } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/lib/store/auth'
import { useAsync } from '@/lib/hooks'
import { cn } from '@/lib/utils'
import { ProgressRing } from './shared'

const CHAPTERS = Array.from({ length: TOTAL_CHAPTERS }, (_, i) => i + 1)

export default function MyParayan() {
  const t = useT()
  const { toast } = useToast()
  const user = useAuthStore((s) => s.user)!
  const { data, loading, refresh } = useAsync(
    async () => Promise.all([listMyParayan(user.id), listParayanPlans()]),
    [user.id],
  )
  const [selected, setSelected] = useState<string | null>(null)
  const [pending, setPending] = useState<number | null>(null)

  if (loading || !data)
    return (
      <div className="mx-auto max-w-3xl">
        <LoadingSkeleton variant="card" />
      </div>
    )
  const [enrollments, plans] = data
  if (enrollments.length === 0)
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title={t('parayan.mine', 'My reading')} />
        <EmptyState
          Icon={BookOpen}
          title={t('parayan.noneYet', 'You have not begun a parayan yet')}
          action={
            <Link to="/parayan" className={buttonVariants({ size: 'sm' })}>
              {t('parayan.choose', 'Choose a plan')}
            </Link>
          }
        />
      </div>
    )

  const order = [...enrollments].sort(
    (a, b) => Number(b.status === 'active') - Number(a.status === 'active') || b.createdAt.localeCompare(a.createdAt),
  )
  const e = order.find((x) => x.id === selected) ?? order[0]!
  const plan = plans.find((p) => p.id === e.planId)
  const p = parayanProgress(e)
  const readSet = new Set(e.chaptersRead)
  const label = (x: (typeof order)[number]) => {
    const pl = plans.find((q) => q.id === x.planId)
    return x.groupId ? `${t('parayan.group', 'Group')}: ${pl?.name ?? ''}` : (pl?.name ?? '')
  }

  async function toggle(ch: number) {
    if (p.assigned && !p.assigned.includes(ch)) return
    setPending(ch)
    try {
      await markChapterRead(e.id, ch, !readSet.has(ch))
      refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Something went wrong', { tone: 'warn' })
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title={t('parayan.mine', 'My reading')}
        subtitle={t('parayan.mineSub', 'Tap a chapter when you have read it.')}
        actions={
          <Link to="/parayan" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            {t('parayan.choose', 'Choose a plan')}
          </Link>
        }
      />
      {order.length > 1 ? (
        <Chips
          items={order.map((x) => ({ key: x.id, label: label(x) }))}
          value={e.id}
          onChange={setSelected}
        />
      ) : null}

      <Card className="flex flex-wrap items-center gap-5 p-5">
        <ProgressRing
          value={p.pct}
          size={104}
          label={t('parayan.ringLabel', '{n} of {total} chapters read', { n: p.read, total: p.total })}
          center={`${p.pct}%`}
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-[19px] text-ink">{plan?.name}</h2>
            <Badge variant={e.status === 'completed' ? 'brand' : e.status === 'active' ? 'leaf' : 'gold'}>
              {t(`parayan.status.${e.status}`, e.status)}
            </Badge>
          </div>
          <p className="text-[14px] text-muted">
            {t('parayan.ringLabel', '{n} of {total} chapters read', { n: p.read, total: p.total })}
          </p>
          {p.completed ? (
            <p className="text-[14px] font-medium text-leaf-600">
              {t('parayan.completeMsg', 'The parayan is complete. Jai Sai Ram.')}
            </p>
          ) : p.nextUnread ? (
            <p className="text-[13.5px] text-ink">
              {t('parayan.nextChapter', 'Next unread chapter: {n}', { n: p.nextUnread })}
            </p>
          ) : null}
          {e.groupId ? (
            <Link to={`/parayan/groups/${e.groupId}`} className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-brand-600 hover:underline">
              <Users className="size-4" aria-hidden="true" />
              {t('parayan.seeGroup', 'See your group')}
            </Link>
          ) : null}
        </div>
      </Card>

      {/* Day plan */}
      {plan && plan.days > 0 && p.dayNumber !== null ? (
        <Card className="p-5">
          <h2 className="mb-1 font-serif text-[18px] text-ink">
            {plan.key === 'saptah' ? t('parayan.dayPlan', 'Your seven days') : t('parayan.today', 'Today')}
          </h2>
          {p.dayNumber === 0 ? (
            <p className="text-[13.5px] text-muted">{t('parayan.notStarted', 'Your reading has not started yet.')}</p>
          ) : p.todaysChapters.length ? (
            <p className="mb-3 text-[13.5px] text-ink">
              {t('parayan.todayChapters', 'Today, day {d}: chapters {c}', {
                d: p.dayNumber,
                c: p.todaysChapters.length > 1
                  ? `${p.todaysChapters[0]}–${p.todaysChapters[p.todaysChapters.length - 1]}`
                  : String(p.todaysChapters[0]),
              })}
              {p.todaysRemaining.length === 0 ? ` ✓ ${t('parayan.doneToday', 'done')}` : ''}
            </p>
          ) : (
            <p className="mb-3 text-[13.5px] text-muted">
              {t('parayan.pastPlan', 'The planned days have passed. Finish at your own pace.')}
            </p>
          )}
          {p.overdue.length ? (
            <p className="mb-3 rounded-md bg-saffron-100/60 px-3 py-2 text-[13px] text-ink">
              {t('parayan.overdue', 'Catch up when you can: chapters {c}', { c: p.overdue.join(', ') })}
            </p>
          ) : null}
          {plan.key === 'saptah' ? (
            <ol className="grid gap-2 sm:grid-cols-2">
              {plan.schedule.map((s) => {
                const done = s.chapters.every((c) => readSet.has(c))
                const today = s.day === p.dayNumber
                return (
                  <li
                    key={s.day}
                    aria-current={today ? 'step' : undefined}
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-[13.5px]',
                      today ? 'border-saffron-400 bg-saffron-100/60' : 'border-line',
                    )}
                  >
                    <span className="font-medium text-ink">
                      {t('parayan.dayN', 'Day {n}', { n: s.day })}
                      {today ? ` · ${t('parayan.todayTag', 'today')}` : ''}
                    </span>
                    <span className="flex items-center gap-1.5 tabular-nums text-muted">
                      {s.chapters[0]}–{s.chapters[s.chapters.length - 1]}
                      {done ? <Check className="size-4 text-leaf-600" aria-label={t('parayan.done', 'done')} /> : null}
                    </span>
                  </li>
                )
              })}
            </ol>
          ) : null}
        </Card>
      ) : null}

      {/* Chapter grid */}
      <Card className="p-5">
        <h2 className="mb-3 font-serif text-[18px] text-ink">{t('parayan.chapters', 'Chapters')}</h2>
        <ul className="grid grid-cols-6 gap-2 sm:grid-cols-9">
          {CHAPTERS.map((ch) => {
            const read = readSet.has(ch)
            const mine = !p.assigned || p.assigned.includes(ch)
            const today = p.todaysChapters.includes(ch)
            return (
              <li key={ch}>
                <button
                  type="button"
                  aria-pressed={read}
                  aria-label={t('parayan.chapterLabel', 'Chapter {n}', { n: ch })}
                  disabled={!mine || pending === ch}
                  onClick={() => void toggle(ch)}
                  className={cn(
                    'relative grid h-11 w-full place-items-center rounded-md border text-[14px] font-medium tabular-nums transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50',
                    read
                      ? 'border-leaf-500 bg-leaf-500 text-white'
                      : today
                        ? 'border-saffron-400 bg-saffron-100 text-ink ring-1 ring-saffron-400'
                        : 'border-line bg-card text-ink hover:bg-tint',
                    !mine && 'cursor-not-allowed opacity-30',
                  )}
                >
                  {ch}
                </button>
              </li>
            )
          })}
        </ul>
        <p className="mt-3 text-[12.5px] text-muted">
          {p.assigned
            ? t('parayan.groupLegend', 'Faded chapters are read by other members of your group.')
            : t('parayan.legend', 'Green is read. Saffron outline is today’s plan.')}
        </p>
      </Card>
    </div>
  )
}
