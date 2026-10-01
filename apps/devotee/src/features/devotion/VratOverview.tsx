import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Flame, Info, ListChecks } from 'lucide-react'
import { devotionDates, enrollInVrat, listVratPrograms } from '@saibaba/core/features/devotion'
import type { NotifyChannel, VratProgram } from '@saibaba/core'
import { useT } from '@saibaba/core/i18n'
import { PageHeader } from '@/components/layout/layouts'
import { LoadingSkeleton } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox, Field, Textarea, Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/lib/store/auth'
import { useAsync } from '@/lib/hooks'
import { fmtDay } from '@/lib/utils'
import { CHANNELS, LampRow } from './shared'

const { nextWeekdayOnOrAfter, todayISO } = devotionDates

export default function VratOverview() {
  const t = useT()
  const { data: programs, loading } = useAsync(listVratPrograms, [])
  const user = useAuthStore((s) => s.user)
  const [picked, setPicked] = useState<VratProgram | null>(null)

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader
        title={t('vrat.title', 'The Thursday vrat')}
        subtitle={t(
          'vrat.subtitle',
          'Thursday is Baba’s day. A vrat is a promise to show up, week after week, in simple devotion.',
        )}
        actions={
          user ? (
            <Link to="/vrat/my" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <ListChecks />
              {t('vrat.myVrats', 'My vrats')}
            </Link>
          ) : null
        }
      />

      <Card className="mb-6 space-y-3 p-5">
        <h2 className="font-serif text-[19px] text-ink">{t('vrat.whatIs', 'What is the Sai vrat?')}</h2>
        <p className="text-[14.5px] leading-relaxed text-ink">
          {t(
            'vrat.whatIsBody',
            'Devotees observe nine (or eleven) consecutive Thursdays with morning prayer, a lamp, flowers, a simple offering and a few minutes of reading or chanting. It is taken up with a wish in the heart, or simply in gratitude, and is closed with a small thanksgiving called udyapan.',
          )}
        </p>
        <p className="flex items-start gap-2 rounded-md bg-tint p-3 text-[13.5px] leading-relaxed text-ink">
          <Info className="mt-0.5 size-4 shrink-0 text-saffron-600" aria-hidden="true" />
          <span>
            {t(
              'vrat.customs',
              'Customs differ between families and temples. Baba emphasised love and sincerity over ritual, so do what you can with a full heart. If you miss a Thursday, carry on the next week.',
            )}
          </span>
        </p>
      </Card>

      {loading || !programs ? (
        <LoadingSkeleton variant="tiles" rows={2} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {programs.map((p) => (
            <Card key={p.id} className="flex flex-col gap-4 p-5">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-serif text-[19px] leading-tight text-ink">{p.name}</h2>
                <Badge variant="gold">{t('vrat.weeksBadge', '{n} Thursdays', { n: p.weeks })}</Badge>
              </div>
              <p className="text-[14px] leading-relaxed text-muted">{p.summary}</p>
              <LampRow total={p.weeks} observed={0} />
              <details className="group rounded-md border border-line p-3 text-[13.5px]">
                <summary className="cursor-pointer font-medium text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40">
                  {t('vrat.stepsHeading', 'Each Thursday')}
                </summary>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-ink">
                  {p.steps.map((s) => (
                    <li key={s.title}>
                      <span className="font-medium">{s.title}.</span>{' '}
                      <span className="text-muted">{s.body}</span>
                    </li>
                  ))}
                </ol>
              </details>
              <div className="mt-auto">
                {user ? (
                  <Button onClick={() => setPicked(p)} aria-expanded={picked?.id === p.id}>
                    <Flame />
                    {t('vrat.begin', 'Begin this vrat')}
                  </Button>
                ) : (
                  <Link to="/signin" className={buttonVariants()}>
                    {t('vrat.signInToBegin', 'Sign in to begin')}
                  </Link>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {picked && user ? <EnrollForm program={picked} userId={user.id} onCancel={() => setPicked(null)} /> : null}
    </div>
  )
}

function EnrollForm({ program, userId, onCancel }: { program: VratProgram; userId: string; onCancel: () => void }) {
  const t = useT()
  const nav = useNavigate()
  const { toast } = useToast()
  const [start, setStart] = useState(nextWeekdayOnOrAfter(todayISO(), program.weekday))
  const [intention, setIntention] = useState('')
  const [channels, setChannels] = useState<NotifyChannel[]>(['email'])
  const [busy, setBusy] = useState(false)
  const snapped = nextWeekdayOnOrAfter(start || todayISO(), program.weekday)

  const toggle = (c: NotifyChannel) =>
    setChannels((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const enr = await enrollInVrat({
        userId,
        programId: program.id,
        startDate: start,
        intention,
        reminderChannels: channels,
      })
      toast(t('vrat.started', 'Your vrat has begun. Jai Sai Ram.'), { tone: 'success' })
      nav(`/vrat/${enr.id}`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Something went wrong', { tone: 'warn' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mt-6 p-5" role="region" aria-label={t('vrat.enrollTitle', 'Begin your vrat')}>
      <form onSubmit={submit} className="space-y-4">
        <h2 className="font-serif text-[19px] text-ink">
          {t('vrat.enrollTitle', 'Begin your vrat')}: {program.name}
        </h2>
        <Field
          label={t('vrat.startDate', 'Start date')}
          htmlFor="vrat-start"
          hint={t('vrat.startHint', 'We will begin on the next Thursday: {d}', { d: fmtDay(snapped) })}
        >
          <Input id="vrat-start" type="date" min={todayISO()} value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field
          label={t('vrat.intention', 'Your intention')}
          htmlFor="vrat-intention"
          hint={t('vrat.optional', 'optional, private')}
        >
          <Textarea
            id="vrat-intention"
            rows={2}
            value={intention}
            maxLength={240}
            onChange={(e) => setIntention(e.target.value)}
            placeholder={t('vrat.intentionPh', 'A wish, a prayer, or simply gratitude')}
          />
        </Field>
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-ink">
            {t('vrat.remindMe', 'Remind me on Thursday mornings by')}
          </legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {CHANNELS.map((c) => (
              <label key={c.key} className="flex cursor-pointer items-center gap-2 text-[14px]">
                <Checkbox checked={channels.includes(c.key)} onChange={() => toggle(c.key)} />
                {t(c.label[0], c.label[1])}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? t('vrat.starting', 'Starting…') : t('vrat.confirmBegin', 'Begin the vrat')}
          </Button>
          <Button variant="plain" onClick={onCancel}>
            {t('common.cancel', 'Cancel')}
          </Button>
        </div>
      </form>
    </Card>
  )
}
