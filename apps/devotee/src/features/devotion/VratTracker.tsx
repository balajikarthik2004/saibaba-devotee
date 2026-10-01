import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CalendarCheck, Flame, PartyPopper, Pause, Play } from 'lucide-react'
import {
  abandonVrat,
  checkInVrat,
  completeVrat,
  getVratEnrollment,
  getVratProgram,
  getVratProgress,
  pauseVrat,
  resumeVrat,
  updateVratReminders,
} from '@saibaba/core/features/devotion'
import type { VratCompletion } from '@saibaba/core/features/devotion'
import type { NotifyChannel } from '@saibaba/core'
import { useT } from '@saibaba/core/i18n'
import { readLocal, writeLocal } from '@saibaba/core/local'
import { PageHeader } from '@/components/layout/layouts'
import { EmptyState, LoadingSkeleton } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { useAsync } from '@/lib/hooks'
import { fmtDate, fmtDay } from '@/lib/utils'
import { CHANNELS, LampRow } from './shared'
import { STATUS_VARIANT } from './MyVrats'

export default function VratTracker() {
  const t = useT()
  const { id = '' } = useParams()
  const { toast } = useToast()
  const { data, loading, refresh } = useAsync(async () => {
    const e = await getVratEnrollment(id)
    if (!e) return null
    const program = await getVratProgram(e.programId)
    return program ? { e, program } : null
  }, [id])
  const [busy, setBusy] = useState(false)
  const [completion, setCompletion] = useState<VratCompletion | null>(null)

  const enrollment = data?.e
  const isDone = enrollment?.status === 'completed'

  // A finished vrat shows its udyapan guidance again on every visit.
  useEffect(() => {
    if (!isDone || !enrollment) return
    let live = true
    completeVrat(enrollment.id)
      .then((c) => live && setCompletion(c))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [isDone, enrollment])

  if (loading) return <LoadingSkeleton variant="card" />
  if (!data)
    return (
      <EmptyState
        title={t('vrat.notFound', 'We could not find that vrat')}
        action={
          <Link to="/vrat/my" className={buttonVariants({ size: 'sm' })}>
            {t('vrat.myVrats', 'My vrats')}
          </Link>
        }
      />
    )

  const { e, program } = data
  const p = getVratProgress(e)
  const live = e.status === 'active'

  async function run(fn: () => Promise<unknown>, okMsg?: string) {
    setBusy(true)
    try {
      await fn()
      if (okMsg) toast(okMsg, { tone: 'success' })
      refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Something went wrong', { tone: 'warn' })
    } finally {
      setBusy(false)
    }
  }

  const toggleChannel = (c: NotifyChannel) => {
    const next = e.reminderChannels.includes(c)
      ? e.reminderChannels.filter((x) => x !== c)
      : [...e.reminderChannels, c]
    void run(() => updateVratReminders(e.id, next))
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title={program.name}
        backTo="/vrat/my"
        backLabel={t('vrat.myVrats', 'My vrats')}
        subtitle={e.intention ? `“${e.intention}”` : undefined}
        actions={<Badge variant={STATUS_VARIANT[e.status]}>{t(`vrat.status.${e.status}`, e.status)}</Badge>}
      />

      {/* Lamps */}
      <Card className="space-y-4 p-5">
        <LampRow total={p.total} observed={p.observed} currentIndex={p.observed} />
        <div className="grid grid-cols-3 gap-3 text-center">
          <Fact label={t('vrat.weekOf', 'Week')} value={`${p.weekIndex}/${p.total}`} />
          <Fact label={t('vrat.streak', 'Streak')} value={String(p.streak)} />
          <Fact label={t('vrat.missed', 'Missed')} value={String(p.missed)} />
        </div>
        {p.missed > 0 && !p.completed ? (
          <p className="text-center text-[13px] text-muted">
            {t('vrat.missedNote', 'A missed Thursday is alright. Your count simply continues.')}
          </p>
        ) : null}
      </Card>

      {/* Check-in / celebration */}
      {p.completed ? (
        <Card className="space-y-3 border-saffron-300 bg-saffron-100/40 p-5 text-center" role="status">
          <PartyPopper className="mx-auto size-8 text-saffron-600" aria-hidden="true" />
          <h2 className="font-serif text-[22px] text-ink">{t('vrat.celebrate', 'Your vrat is complete. Jai Sai Ram.')}</h2>
          <p className="mx-auto max-w-xl text-[14px] leading-relaxed text-ink">
            {(completion?.udyapanGuidance ?? program.udyapanGuidance)}
          </p>
          {isDone ? null : (
            <Button
              disabled={busy}
              onClick={() =>
                void run(async () => setCompletion(await completeVrat(e.id)), t('vrat.completedToast', 'Vrat marked complete'))
              }
            >
              <Flame />
              {t('vrat.markComplete', 'Mark the vrat complete')}
            </Button>
          )}
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            <Link
              to={completion?.suggestedPujaId ? `/puja/book/${completion.suggestedPujaId}` : '/puja'}
              className={buttonVariants({ variant: isDone ? 'default' : 'outline' })}
            >
              {completion?.suggestedPujaName
                ? t('vrat.sponsorNamed', 'Sponsor {name}', { name: completion.suggestedPujaName })
                : t('vrat.sponsorUdyapan', 'Browse pujas for udyapan')}
            </Link>
          </div>
        </Card>
      ) : live ? (
        <Card className="space-y-3 p-5">
          <h2 className="flex items-center gap-2 font-serif text-[19px] text-ink">
            <CalendarCheck className="size-5 text-brand-500" aria-hidden="true" />
            {p.isTodayObservanceDay && !p.todayObserved
              ? t('vrat.todayIs', 'Today is your Thursday')
              : p.todayObserved
                ? t('vrat.todayDone', 'Today’s Thursday is recorded')
                : p.nextDate
                  ? t('vrat.nextOn', 'Next Thursday: {d}', { d: fmtDay(p.nextDate) })
                  : ''}
          </h2>
          {p.isTodayObservanceDay && !p.todayObserved ? (
            <Button
              size="lg"
              disabled={busy}
              onClick={() => void run(() => checkInVrat(e.id), t('vrat.checkedIn', 'Recorded. A lamp is lit.'))}
            >
              <Flame />
              {t('vrat.checkIn', 'I observed the vrat today')}
            </Button>
          ) : null}
          {p.catchUpDate ? (
            <div className="flex flex-wrap items-center gap-3 rounded-md bg-tint p-3 text-[13.5px]">
              <span className="text-ink">
                {t('vrat.catchUpNote', 'You can still record {d}.', { d: fmtDay(p.catchUpDate) })}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void run(() => checkInVrat(e.id, p.catchUpDate!, { catchUp: true }), t('vrat.checkedIn', 'Recorded. A lamp is lit.'))
                }
              >
                {t('vrat.catchUp', 'Record as catch-up')}
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}

      {/* Steps */}
      {live || p.completed ? <StepChecklist enrollmentId={e.id} steps={program.steps} /> : null}

      {/* Reminders */}
      <Card className="p-5">
        <fieldset disabled={busy}>
          <legend className="mb-2 font-serif text-[17px] text-ink">{t('vrat.reminders', 'Thursday reminders')}</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {CHANNELS.map((c) => (
              <label key={c.key} className="flex cursor-pointer items-center gap-2 text-[14px]">
                <Checkbox checked={e.reminderChannels.includes(c.key)} onChange={() => toggleChannel(c.key)} />
                {t(c.label[0], c.label[1])}
              </label>
            ))}
          </div>
        </fieldset>
      </Card>

      {/* Observed dates */}
      {e.observedOn.length ? (
        <Card className="p-5">
          <h2 className="mb-2 font-serif text-[17px] text-ink">{t('vrat.observedDates', 'Thursdays observed')}</h2>
          <ul className="flex flex-wrap gap-2">
            {e.observedOn.map((d) => (
              <li key={d}>
                <Badge variant="leaf">
                  {fmtDate(d, 'MMM d')}
                  {e.catchUpOn.includes(d) ? ` (${t('vrat.catchUpTag', 'catch-up')})` : ''}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* Controls */}
      {e.status === 'active' || e.status === 'paused' ? (
        <div className="flex flex-wrap gap-2">
          {e.status === 'active' ? (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void run(() => pauseVrat(e.id))}>
              <Pause />
              {t('vrat.pause', 'Pause')}
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void run(() => resumeVrat(e.id))}>
              <Play />
              {t('vrat.resume', 'Resume')}
            </Button>
          )}
          <Button
            variant="plain"
            size="sm"
            disabled={busy}
            onClick={() => {
              if (window.confirm(t('vrat.abandonConfirm', 'Stop this vrat? Your record is kept.')))
                void run(() => abandonVrat(e.id))
            }}
          >
            {t('vrat.abandon', 'Stop this vrat')}
          </Button>
        </div>
      ) : null}

      <p className="text-[12.5px] leading-relaxed text-muted">
        {t(
          'vrat.customs',
          'Customs differ between families and temples. Baba emphasised love and sincerity over ritual, so do what you can with a full heart. If you miss a Thursday, carry on the next week.',
        )}
      </p>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-tint px-2 py-2.5">
      <p className="font-serif text-[22px] leading-none text-ink">{value}</p>
      <p className="mt-1 text-[11.5px] uppercase tracking-[0.08em] text-muted">{label}</p>
    </div>
  )
}

/** This week's steps. Ticks are remembered per enrolment and Thursday, in this browser only. */
function StepChecklist({ enrollmentId, steps }: { enrollmentId: string; steps: { title: string; body: string }[] }) {
  const t = useT()
  const key = `saibaba:devotion:vrat-steps:${enrollmentId}`
  const [done, setDone] = useState<string[]>(() => readLocal<string[]>(key, []))
  const toggle = (title: string) => {
    const next = done.includes(title) ? done.filter((x) => x !== title) : [...done, title]
    setDone(next)
    writeLocal(key, next)
  }
  return (
    <Card className="p-5">
      <h2 className="mb-3 font-serif text-[19px] text-ink">{t('vrat.stepsThisWeek', 'This Thursday’s steps')}</h2>
      <ul className="space-y-2.5">
        {steps.map((s, i) => {
          const checked = done.includes(s.title)
          return (
            <li key={s.title}>
              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox className="mt-1" checked={checked} onChange={() => toggle(s.title)} />
                <span className="min-w-0">
                  <span className={checked ? 'font-medium text-muted line-through' : 'font-medium text-ink'}>
                    {i + 1}. {s.title}
                  </span>
                  <span className="mt-0.5 block text-[13.5px] leading-relaxed text-muted">{s.body}</span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>
      <button
        type="button"
        className="mt-3 text-[13px] font-medium text-brand-600 hover:underline"
        onClick={() => {
          setDone([])
          writeLocal(key, [])
        }}
      >
        {t('vrat.clearTicks', 'Clear ticks for next Thursday')}
      </button>
    </Card>
  )
}
