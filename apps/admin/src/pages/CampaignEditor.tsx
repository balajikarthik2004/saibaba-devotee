import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Minus, Plus, Save, Trash2, Users } from 'lucide-react'
import type { VolunteerCampaign, VolunteerNeed, VolunteerSkill } from '@/lib/data/types'
import { PageShell } from '@/components/layout/PageShell'
import { Card } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { LoadingSkeleton } from '@/components/shared/states'
import { useToast } from '@/components/ui/toast'
import { getCampaignById, listEvents, newCampaignId, saveCampaign } from '@/lib/data/api'
import { STAFF, VOLUNTEER_ROLES, ROLE_BY_KEY } from '@/lib/data/mock'
import { useAsync } from '@/lib/hooks'
import { fmtDate } from '@/lib/utils'

/**
 * Create or edit a campaign — the ask, before anybody has been asked.
 *
 * A campaign cannot exist without a festival behind it, so the event picker is the first
 * field and has no empty option once loaded. That constraint is what lets the outreach
 * screen put a real festival name into `{{festival}}` instead of asking the coordinator
 * to retype it into every message.
 */

/** `datetime-local` wants `yyyy-MM-ddTHH:mm` in local time; ISO gives neither. */
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`
}

const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : '')

const blankCampaign = (): VolunteerCampaign => ({
  id: '',
  eventId: '',
  title: '',
  description: '',
  briefingAt: '',
  coordinatorId: STAFF[0]?.id ?? 'usr_admin',
  needs: [],
  status: 'draft',
  createdAt: new Date().toISOString(),
})

export default function CampaignEditor({ mode }: { mode: 'create' | 'edit' }) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [form, setForm] = useState<VolunteerCampaign>(blankCampaign())
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const events = useAsync(() => listEvents(), [])
  const existing = useAsync(
    () => (mode === 'edit' && id ? getCampaignById(id) : Promise.resolve(null)),
    [id, mode],
  )

  useEffect(() => {
    if (mode === 'edit' && existing.data) setForm(existing.data)
  }, [mode, existing.data])

  /* A new campaign lands on the next upcoming festival — nine times in ten that is the
     one being staffed, and it saves the coordinator hunting through twenty rows. */
  useEffect(() => {
    if (mode !== 'create' || !events.data || form.eventId) return
    const next = events.data.find((e) => e.status === 'upcoming') ?? events.data[0]
    if (!next) return
    setForm((f) => ({
      ...f,
      eventId: next.id,
      title: f.title || `${next.title} — volunteer drive`,
      // The briefing defaults to the evening two days before the festival, which is when
      // these actually happen. It is a starting point, not a rule.
      briefingAt:
        f.briefingAt || new Date(new Date(next.date).getTime() - 2 * 86400000).toISOString(),
    }))
  }, [mode, events.data, form.eventId])

  const set = <K extends keyof VolunteerCampaign>(k: K, v: VolunteerCampaign[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const addNeed = (roleKey: VolunteerSkill) => {
    if (form.needs.some((n) => n.roleKey === roleKey)) return
    const role = ROLE_BY_KEY.get(roleKey)
    const need: VolunteerNeed = {
      roleKey,
      label: role?.label ?? roleKey,
      blurb: role?.blurb ?? '',
      needed: 4,
    }
    set('needs', [...form.needs, need])
  }

  const setNeeded = (roleKey: VolunteerSkill, needed: number) =>
    set(
      'needs',
      form.needs.map((n) => (n.roleKey === roleKey ? { ...n, needed: Math.max(1, needed) } : n)),
    )

  const removeNeed = (roleKey: VolunteerSkill) =>
    set(
      'needs',
      form.needs.filter((n) => n.roleKey !== roleKey),
    )

  async function save() {
    if (!form.eventId) return setError('Pick the festival this staffs.')
    if (!form.title.trim()) return setError('Give the campaign a title.')
    if (!form.briefingAt) return setError('Set a briefing date and time.')
    if (form.needs.length === 0)
      return setError('Add at least one role — the ask is what the outreach is about.')

    setSaving(true)
    setError('')
    try {
      const record: VolunteerCampaign = {
        ...form,
        id: form.id || (await newCampaignId()),
        title: form.title.trim(),
        description: form.description.trim(),
      }
      await saveCampaign(record)
      toast(mode === 'create' ? 'Campaign created' : 'Campaign updated', {
        detail:
          mode === 'create'
            ? 'Nothing has gone out yet — send the first message from the Outreach tab.'
            : record.title,
        tone: 'success',
      })
      navigate(`/volunteers/campaigns/${record.id}`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (mode === 'edit' && existing.loading) {
    return (
      <PageShell title="Edit campaign" description="Loading…">
        <LoadingSkeleton variant="table" rows={5} />
      </PageShell>
    )
  }

  if (mode === 'edit' && !existing.data) {
    return (
      <PageShell title="Campaign not found">
        <Link to="/volunteers/campaigns" className={buttonVariants({ size: 'sm' })}>
          Back to campaigns
        </Link>
      </PageShell>
    )
  }

  const event = events.data?.find((e) => e.id === form.eventId)
  const totalAsked = form.needs.reduce((s, n) => s + n.needed, 0)
  const unused = VOLUNTEER_ROLES.filter((r) => !form.needs.some((n) => n.roleKey === r.key))

  return (
    <PageShell
      eyebrow="People"
      title={mode === 'create' ? 'New volunteer campaign' : `Edit ${existing.data?.title}`}
      description="The ask, before anybody has been asked. Outreach is the next step, not this one."
      back={{ to: '/volunteers/campaigns', label: 'All campaigns' }}
      actions={
        <Button onClick={save} disabled={saving}>
          <Save />
          {mode === 'create' ? 'Create campaign' : 'Save changes'}
        </Button>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr] xl:items-start">
        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="font-serif text-lg text-ink">Basics</h2>
            <div className="mt-4 space-y-4">
              <Field
                label="Festival"
                hint="a campaign always staffs one event"
                htmlFor="camp-event"
              >
                <Select
                  id="camp-event"
                  value={form.eventId}
                  onChange={(e) => set('eventId', e.target.value)}
                  disabled={events.loading}
                >
                  {events.loading ? <option value="">Loading festivals…</option> : null}
                  {(events.data ?? []).map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title} — {fmtDate(e.date)}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Campaign title" htmlFor="camp-title">
                <Input
                  id="camp-title"
                  value={form.title}
                  onChange={(e) => set('title', e.target.value)}
                  placeholder="Chithirai Festival — volunteer drive"
                />
              </Field>

              <Field
                label="What the volunteers are signing up for"
                hint="quoted in the outreach preview"
                htmlFor="camp-desc"
              >
                <Textarea
                  id="camp-desc"
                  rows={4}
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder="Ten days of processions, the Thirukalyanam on the eighth night and annadanam every evening."
                />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Briefing"
                  hint="earlier than the festival itself"
                  htmlFor="camp-briefing"
                >
                  <Input
                    id="camp-briefing"
                    type="datetime-local"
                    value={toLocalInput(form.briefingAt)}
                    onChange={(e) => set('briefingAt', fromLocalInput(e.target.value))}
                  />
                </Field>
                <Field label="Coordinator" hint="signs the outreach" htmlFor="camp-coord">
                  <Select
                    id="camp-coord"
                    value={form.coordinatorId}
                    onChange={(e) => set('coordinatorId', e.target.value)}
                  >
                    {STAFF.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — {s.title}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              {mode === 'edit' ? (
                <Field
                  label="Status"
                  hint="the first send moves a draft to recruiting on its own"
                >
                  <Select
                    value={form.status}
                    onChange={(e) => set('status', e.target.value as VolunteerCampaign['status'])}
                  >
                    <option value="draft">Draft — nothing sent yet</option>
                    <option value="recruiting">Recruiting — asking around</option>
                    <option value="staffed">Staffed — every role covered</option>
                    <option value="completed">Completed — festival is over</option>
                    <option value="cancelled">Cancelled</option>
                  </Select>
                </Field>
              ) : null}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-serif text-lg text-ink">Roles needed</h2>
              <p className="text-sm text-muted">
                <span className="font-semibold tabular-nums text-ink">{totalAsked}</span>{' '}
                volunteers asked for
              </p>
            </div>

            {form.needs.length === 0 ? (
              <p className="mt-3 rounded-[var(--radius)] border border-dashed border-line bg-faint/40 px-3 py-4 text-sm text-muted">
                Nothing asked for yet. Add a role below — this is what the outreach message
                lists, and what the staffing meter counts against.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {form.needs.map((n) => (
                  <li
                    key={n.roleKey}
                    className="flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-line bg-card px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{n.label}</p>
                      <p className="truncate text-2xs text-muted">{n.blurb}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={() => setNeeded(n.roleKey, n.needed - 1)}
                        aria-label={`One fewer ${n.label}`}
                      >
                        <Minus />
                      </Button>
                      <Input
                        type="number"
                        min={1}
                        value={n.needed}
                        onChange={(e) => setNeeded(n.roleKey, Number(e.target.value))}
                        className="w-16 text-center tabular-nums"
                        aria-label={`${n.label} needed`}
                      />
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={() => setNeeded(n.roleKey, n.needed + 1)}
                        aria-label={`One more ${n.label}`}
                      >
                        <Plus />
                      </Button>
                      <Button
                        variant="plain"
                        size="icon-sm"
                        onClick={() => removeNeed(n.roleKey)}
                        aria-label={`Remove ${n.label}`}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {unused.length > 0 ? (
              <div className="mt-4">
                <p className="eyebrow mb-2">Add a role</p>
                <div className="flex flex-wrap gap-1.5">
                  {unused.map((r) => (
                    <Button
                      key={r.key}
                      variant="outline"
                      size="sm"
                      onClick={() => addNeed(r.key)}
                      title={r.blurb}
                    >
                      <Plus /> {r.label}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>

          {error ? (
            <p className="text-sm font-medium text-brand-600" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <Card className="p-5">
          <h2 className="font-serif text-lg text-ink">Where this sits</h2>
          <p className="mt-1 text-sm text-muted">
            The flow runs in one direction: the ask, then the asking, then the roster.
          </p>

          <ol className="mt-4 space-y-3 text-sm">
            {[
              ['1', 'Define the ask', 'This screen. Which festival, which roles, how many.'],
              [
                '2',
                'Send the outreach',
                'Email or SMS to a filtered slice of the pool. One invite per recipient.',
              ],
              [
                '3',
                'Log the replies',
                'Accepted, declined, or no answer. An acceptance builds the roster place.',
              ],
              [
                '4',
                'Confirm the shifts',
                'Set role and shift, confirm, then check people in on the day.',
              ],
            ].map(([n, title, detail]) => (
              <li key={n} className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-500/[0.08] text-2xs font-bold text-brand-600">
                  {n}
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-ink">{title}</p>
                  <p className="text-xs leading-relaxed text-muted">{detail}</p>
                </div>
              </li>
            ))}
          </ol>

          {event ? (
            <div className="mt-5 rounded-[var(--radius)] border border-line bg-faint/50 p-3.5">
              <p className="eyebrow mb-1.5">Festival</p>
              <p className="font-medium text-ink">{event.title}</p>
              <p className="mt-0.5 text-sm text-muted">{fmtDate(event.date)}</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <Badge variant="outline">
                  <Users className="size-3" /> {event.rsvpCount} attending
                </Badge>
                <Badge variant="outline">{event.status}</Badge>
              </div>
            </div>
          ) : null}
        </Card>
      </div>
    </PageShell>
  )
}
