import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, Flame, Sun } from 'lucide-react'
import type { LanguageCode } from '@saibaba/core'
import {
  dailyMessageFor,
  getVratProgress,
  listMyParayan,
  listMyVrats,
  listVratPrograms,
  parayanProgress,
  devotionDates,
} from '@saibaba/core/features/devotion'
import { useT, useLanguageStore } from '@saibaba/core/i18n'
import { Progress } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { useAuthStore } from '@/lib/store/auth'
import { useAsync } from '@/lib/hooks'
import { cn, fmtDay } from '@/lib/utils'
import { MandalaPattern } from '@/components/shared/SaiIcons'
import { ShareButton } from './shared'

const { todayISO } = devotionDates

/** Today's short reflection with a share button. Works signed-out. */
export function DailyMessageCard({ lang, className }: { lang?: LanguageCode; className?: string }) {
  const t = useT()
  const current = useLanguageStore((s) => s.language)
  const language = lang ?? current
  const day = todayISO()
  const msg = useMemo(() => dailyMessageFor(day, language), [day, language])
  return (
    <Card className={cn('relative flex flex-col justify-between overflow-hidden border-gold-500/40 bg-linear-to-br from-saffron-100/60 via-card to-saffron-50/40 p-5 shadow-xs', className)}>
      <MandalaPattern className="absolute -right-8 -top-8 size-44 text-gold-500/20" />
      <div>
        <p className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-saffron-600">
          <Sun className="size-4 text-gold-500" aria-hidden="true" />
          {t('teach.today', 'Today’s Reflection')}
        </p>
        <blockquote className="mt-3 font-serif text-[20px] font-medium leading-snug text-ink">
          &ldquo;{msg.text}&rdquo;
        </blockquote>
      </div>
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-line/60 pt-3">
        <span className="text-[12px] font-medium text-muted">{fmtDay(day)}</span>
        <ShareButton text={msg.text} title={t('teach.today', 'Today’s reflection')} />
      </div>
    </Card>
  )
}

function TileShell({
  to,
  Icon,
  title,
  children,
  className,
}: {
  to: string
  Icon: typeof Flame
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Link
      to={to}
      className={cn(
        'group block rounded-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
        className,
      )}
    >
      <Card className="h-full space-y-2.5 p-4 transition-shadow group-hover:shadow-[var(--shadow-lg)]">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 font-serif text-[16px] text-ink">
            <span className="grid size-8 place-items-center rounded-[9px] bg-tint text-brand-500 ring-1 ring-inset ring-line">
              <Icon className="size-[15px]" aria-hidden="true" />
            </span>
            {title}
          </span>
          <ArrowRight className="size-4 text-brand-500 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </div>
        {children}
      </Card>
    </Link>
  )
}

/** Compact vrat tile for the dashboard: progress of the devotee's current vrat, or an invitation. */
export function VratProgressTile({ className }: { className?: string }) {
  const t = useT()
  const user = useAuthStore((s) => s.user)
  const { data, loading } = useAsync(
    async () => (user ? Promise.all([listMyVrats(user.id), listVratPrograms()]) : null),
    [user?.id],
  )
  const title = t('vrat.tileTitle', 'Thursday vrat')
  if (loading) return <TileShell to="/vrat" Icon={Flame} title={title} className={className}><div className="h-10 animate-pulse rounded bg-line/60" /></TileShell>

  const live = data?.[0].find((e) => e.status === 'active') ?? data?.[0].find((e) => e.status === 'paused')
  if (!data || !live)
    return (
      <TileShell to="/vrat" Icon={Flame} title={title} className={className}>
        <p className="text-[13.5px] leading-relaxed text-muted">
          {t('vrat.tileInvite', 'Nine Thursdays of simple devotion. Begin any week.')}
        </p>
      </TileShell>
    )
  const p = getVratProgress(live)
  const program = data[1].find((x) => x.id === live.programId)
  const pct = Math.round((Math.min(p.observed, p.total) / p.total) * 100)
  return (
    <TileShell to={`/vrat/${live.id}`} Icon={Flame} title={title} className={className}>
      <p className="text-[13px] text-muted">{program?.name}</p>
      <Progress
        value={pct}
        tone="gold"
        label={t('vrat.progressLabel', '{n} of {total} Thursdays observed', { n: p.observed, total: p.total })}
      />
      <p className="text-[13px] text-ink">
        {p.completed
          ? t('vrat.readyToComplete', 'All weeks done')
          : p.isTodayObservanceDay && !p.todayObserved
            ? t('vrat.tileToday', 'Today is your Thursday. Tap to check in.')
            : t('vrat.tileWeek', 'Week {n} of {total}', { n: p.weekIndex, total: p.total }) +
              (p.nextDate ? ` · ${fmtDay(p.nextDate)}` : '')}
      </p>
    </TileShell>
  )
}

/** Compact parayan tile for the dashboard. */
export function ParayanProgressTile({ className }: { className?: string }) {
  const t = useT()
  const user = useAuthStore((s) => s.user)
  const { data, loading } = useAsync(async () => (user ? listMyParayan(user.id) : null), [user?.id])
  const title = t('parayan.tileTitle', 'Sai Satcharitra')
  if (loading) return <TileShell to="/parayan" Icon={BookOpen} title={title} className={className}><div className="h-10 animate-pulse rounded bg-line/60" /></TileShell>

  const live = data?.find((e) => e.status === 'active')
  if (!live)
    return (
      <TileShell to="/parayan" Icon={BookOpen} title={title} className={className}>
        <p className="text-[13.5px] leading-relaxed text-muted">
          {t('parayan.tileInvite', 'Read the 51 chapters in a week, or a chapter a day.')}
        </p>
      </TileShell>
    )
  const p = parayanProgress(live)
  return (
    <TileShell to="/parayan/my" Icon={BookOpen} title={title} className={className}>
      <Progress
        value={p.pct}
        tone="leaf"
        label={t('parayan.ringLabel', '{n} of {total} chapters read', { n: p.read, total: p.total })}
      />
      <p className="text-[13px] text-ink">
        {t('parayan.ringLabel', '{n} of {total} chapters read', { n: p.read, total: p.total })}
        {p.todaysRemaining.length
          ? ` · ${t('parayan.tileToday', 'today: {c}', { c: p.todaysRemaining.join(', ') })}`
          : ''}
      </p>
    </TileShell>
  )
}
