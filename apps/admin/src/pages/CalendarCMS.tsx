import { useMemo, useState } from 'react'
import { CalendarOff, Plus, Trash2 } from 'lucide-react'
import type { RecurringRule } from '@/lib/data/types'
import { PageShell } from '@/components/layout/PageShell'
import {
  CalendarLegend,
  MonthCalendar,
  type CalendarEntry,
} from '@/components/shared/MonthCalendar'
import { LoadingSkeleton } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/input'
import { Tabs } from '@/components/ui/tabs'
import { Sheet } from '@/components/ui/overlay'
import { useToast } from '@/components/ui/toast'
import {
  deleteRecurringRule,
  listEvents,
  listRecurringRules,
  saveRecurringRule,
} from '@/lib/data/api'
import { eventEntries, expandRules } from '@/lib/calendar'
import { PUJA_CATALOG } from '@/lib/data/mock'
import { useAsync } from '@/lib/hooks'
import { fmtDate, fmtTime } from '@/lib/utils'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const NTH = ['Every', '1st', '2nd', '3rd', '4th']

const FORMS = [
  { key: 'recurring', label: 'Recurring rule' },
  { key: 'oneoff', label: 'One-off' },
  { key: 'closure', label: 'Closure' },
]

export default function CalendarCMS() {
  const { toast } = useToast()
  const [month, setMonth] = useState(() => new Date())
  const [selected, setSelected] = useState<Date | null>(null)
  const [form, setForm] = useState('recurring')

  const [rule, setRule] = useState<Omit<RecurringRule, 'id'>>({
    label: '',
    dayOfWeek: 2,
    time: '19:00',
    pujaCatalogId: PUJA_CATALOG[0]?.id,
  })
  const [oneOff, setOneOff] = useState({ label: '', date: '', time: '18:00' })
  const [closure, setClosure] = useState({ label: 'Temple closed', date: '', reason: '' })

  const [extra, setExtra] = useState<CalendarEntry[]>([])

  const { data, loading, refresh } = useAsync(
    async () => Promise.all([listRecurringRules(), listEvents()]),
    [],
  )

  const entries = useMemo<CalendarEntry[]>(() => {
    if (!data) return extra
    const [rules, events] = data
    return [...expandRules(month, rules), ...eventEntries(events), ...extra]
  }, [data, month, extra])

  const dayEntries = selected
    ? entries
        .filter((e) => e.date.toDateString() === selected.toDateString())
        .sort((a, b) => a.date.getTime() - b.date.getTime())
    : []

  const addRule = async () => {
    if (!rule.label.trim()) return
    await saveRecurringRule({ ...rule, id: `rule_${Date.now()}` })
    toast('Recurring rule added', {
      detail: `${rule.label} — ${rule.nth ? NTH[rule.nth] : 'every'} ${DAYS[rule.dayOfWeek]}.`,
    })
    setRule({ ...rule, label: '' })
    refresh()
  }

  const removeRule = async (r: RecurringRule) => {
    await deleteRecurringRule(r.id)
    toast(`${r.label} removed`, { tone: 'warn' })
    refresh()
  }

  const addOneOff = () => {
    if (!oneOff.label.trim() || !oneOff.date) return
    const at = new Date(`${oneOff.date}T${oneOff.time}`)
    setExtra((x) => [
      ...x,
      { id: `one_${Date.now()}`, date: at, label: oneOff.label, kind: 'puja', time: oneOff.time },
    ])
    toast('One-off puja added to the calendar')
    setOneOff({ label: '', date: '', time: '18:00' })
  }

  const addClosure = () => {
    if (!closure.date) return
    const at = new Date(`${closure.date}T00:00`)
    setExtra((x) => [
      ...x,
      {
        id: `close_${Date.now()}`,
        date: at,
        label: closure.label || 'Temple closed',
        kind: 'closure',
        detail: closure.reason,
      },
    ])
    toast('Closure published to the devotee calendar', { tone: 'warn' })
    setClosure({ label: 'Temple closed', date: '', reason: '' })
  }

  return (
    <PageShell
      eyebrow="Programme"
      title="Calendar CMS"
      description="Publish the weekly rhythm, one-off pujas and closures. Devotees see this immediately."
    >
      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr] xl:items-start">
        <div className="min-w-0">
          {loading ? (
            <LoadingSkeleton variant="table" rows={6} />
          ) : (
            <>
              <MonthCalendar
                month={month}
                onMonthChange={setMonth}
                entries={entries}
                selected={selected ?? undefined}
                onSelect={setSelected}
              />
              <CalendarLegend className="mt-3" />
            </>
          )}

          <Card className="mt-5">
            <div className="border-b border-line p-4">
              <h2 className="font-serif text-lg text-ink">Published recurring rules</h2>
              <p className="mt-0.5 text-sm text-muted">
                These expand automatically across every month on both calendars.
              </p>
            </div>
            <ul className="divide-y divide-line">
              {(data?.[0] ?? []).map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 p-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium text-ink">{r.label}</p>
                    <p className="text-sm text-muted">
                      {r.nth ? `${NTH[r.nth]} ` : 'Every '}
                      {DAYS[r.dayOfWeek]} at {r.time}
                      {r.pujaCatalogId
                        ? ` · ${PUJA_CATALOG.find((p) => p.id === r.pujaCatalogId)?.name}`
                        : ''}
                    </p>
                  </div>
                  <Badge variant="gold">Weekly</Badge>
                  <Button
                    variant="plain"
                    size="icon"
                    aria-label={`Delete ${r.label}`}
                    onClick={() => removeRule(r)}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card className="xl:sticky xl:top-[calc(var(--page-chrome-h,0px)+1.25rem)]">
          <div className="border-b border-line px-4 pt-3">
            <Tabs items={FORMS} value={form} onChange={setForm} />
          </div>

          <div className="space-y-4 p-4">
            {form === 'recurring' ? (
              <>
                <Field label="Label" htmlFor="cr-label">
                  <Input
                    id="cr-label"
                    value={rule.label}
                    onChange={(e) => setRule({ ...rule, label: e.target.value })}
                    placeholder="e.g. Murugan Vel Puja"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Day of week" htmlFor="cr-day">
                    <Select
                      id="cr-day"
                      value={rule.dayOfWeek}
                      onChange={(e) => setRule({ ...rule, dayOfWeek: Number(e.target.value) })}
                    >
                      {DAYS.map((d, i) => (
                        <option key={d} value={i}>
                          {d}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Which week" htmlFor="cr-nth">
                    <Select
                      id="cr-nth"
                      value={rule.nth ?? 0}
                      onChange={(e) =>
                        setRule({ ...rule, nth: Number(e.target.value) || undefined })
                      }
                    >
                      {NTH.map((n, i) => (
                        <option key={n} value={i}>
                          {n}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Time" htmlFor="cr-time">
                    <Input
                      id="cr-time"
                      type="time"
                      value={rule.time}
                      onChange={(e) => setRule({ ...rule, time: e.target.value })}
                    />
                  </Field>
                  <Field label="Puja" htmlFor="cr-puja">
                    <Select
                      id="cr-puja"
                      value={rule.pujaCatalogId ?? ''}
                      onChange={(e) =>
                        setRule({ ...rule, pujaCatalogId: e.target.value || undefined })
                      }
                    >
                      <option value="">None</option>
                      {PUJA_CATALOG.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <Button className="w-full" onClick={addRule} disabled={!rule.label.trim()}>
                  <Plus />
                  Add recurring rule
                </Button>
              </>
            ) : null}

            {form === 'oneoff' ? (
              <>
                <Field label="Label" htmlFor="co-label">
                  <Input
                    id="co-label"
                    value={oneOff.label}
                    onChange={(e) => setOneOff({ ...oneOff, label: e.target.value })}
                    placeholder="e.g. Special Chandi Homam"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Date" htmlFor="co-date">
                    <Input
                      id="co-date"
                      type="date"
                      value={oneOff.date}
                      onChange={(e) => setOneOff({ ...oneOff, date: e.target.value })}
                    />
                  </Field>
                  <Field label="Time" htmlFor="co-time">
                    <Input
                      id="co-time"
                      type="time"
                      value={oneOff.time}
                      onChange={(e) => setOneOff({ ...oneOff, time: e.target.value })}
                    />
                  </Field>
                </div>
                <Button
                  className="w-full"
                  onClick={addOneOff}
                  disabled={!oneOff.label.trim() || !oneOff.date}
                >
                  <Plus />
                  Add one-off
                </Button>
              </>
            ) : null}

            {form === 'closure' ? (
              <>
                <Field label="Label" htmlFor="cc-label">
                  <Input
                    id="cc-label"
                    value={closure.label}
                    onChange={(e) => setClosure({ ...closure, label: e.target.value })}
                  />
                </Field>
                <Field label="Date" htmlFor="cc-date">
                  <Input
                    id="cc-date"
                    type="date"
                    value={closure.date}
                    onChange={(e) => setClosure({ ...closure, date: e.target.value })}
                  />
                </Field>
                <Field label="Reason" htmlFor="cc-reason" hint="shown to devotees">
                  <Input
                    id="cc-reason"
                    value={closure.reason}
                    onChange={(e) => setClosure({ ...closure, reason: e.target.value })}
                    placeholder="Sanctum repainting"
                  />
                </Field>
                <Button
                  className="w-full"
                  variant="destructive"
                  onClick={addClosure}
                  disabled={!closure.date}
                >
                  <CalendarOff />
                  Publish closure
                </Button>
              </>
            ) : null}
          </div>
        </Card>
      </div>

      <Sheet
        open={selected != null}
        onClose={() => setSelected(null)}
        title={selected ? fmtDate(selected, 'EEEE, MMMM d') : ''}
        description={`${dayEntries.length} scheduled item${dayEntries.length === 1 ? '' : 's'}`}
      >
        {dayEntries.length === 0 ? (
          <p className="text-base text-muted">
            Nothing published for this day. Use the forms on the calendar page to add a puja or a
            closure.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {dayEntries.map((e) => (
              <li key={e.id} className="rounded-[var(--radius-lg)] border border-line p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-base font-medium text-ink">{e.label}</p>
                    <p className="text-sm text-muted">{fmtTime(e.date)}</p>
                  </div>
                  <Badge
                    variant={e.kind === 'event' ? 'leaf' : e.kind === 'closure' ? 'brand' : 'gold'}
                  >
                    {e.kind === 'event' ? 'Festival' : e.kind === 'closure' ? 'Closed' : 'Puja'}
                  </Badge>
                </div>
                {e.detail ? (
                  <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-muted">
                    {e.detail}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </PageShell>
  )
}
