import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useCurrentTemple } from '@saibaba/core/tenant'
import { useT } from '@saibaba/core/i18n'
import { deleteAartiSlot, listAartiSlots, upsertAartiSlot } from '@saibaba/core/features/aarti'
import type { AartiKey, AartiSlot } from '@saibaba/core/types.sai'
import { PageShell } from '@/components/layout/PageShell'
import { LoadingSkeleton } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/input'
import { Dialog } from '@/components/ui/overlay'
import { Table, TableWrap, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { useAsync } from '@/lib/hooks'
import { AartiTabs, ConfirmDialog, WEEKDAYS } from './shared'

type Draft = Omit<AartiSlot, 'id' | 'templeId'> & { id?: string }

const KEYS: AartiKey[] = ['kakad', 'madhyan', 'dhoop', 'shej', 'special']
const blank = (): Draft => ({
  key: 'special',
  name: '',
  time: '18:00',
  days: [4],
  durationMin: 30,
  description: '',
  active: true,
  sponsorable: false,
})

export default function ScheduleCMS() {
  const t = useT()
  const { toast } = useToast()
  const temple = useCurrentTemple()
  const { data, loading, refresh } = useAsync(() => listAartiSlots(temple.id), [temple.id])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [del, setDel] = useState<AartiSlot | null>(null)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!draft) return
    setSaving(true)
    await upsertAartiSlot({ ...draft, templeId: temple.id })
    setSaving(false)
    toast(t('aarti.admin.slotSaved', 'Aarti saved'), { detail: draft.name })
    setDraft(null)
    refresh()
  }

  const quick = async (s: AartiSlot, patch: Partial<AartiSlot>) => {
    await upsertAartiSlot({ ...s, ...patch })
    refresh()
  }

  const valid = draft && draft.name.trim() && /^\d{2}:\d{2}$/.test(draft.time) && draft.days.length > 0

  return (
    <PageShell
      eyebrow={t('aarti.admin.group', 'Darshan')}
      title={t('aarti.admin.scheduleTitle', 'Aarti schedule')}
      description={t('aarti.admin.scheduleDesc', 'Times are local to {tz}.', { tz: temple.timezone })}
      tabs={<AartiTabs />}
      actions={
        <Button onClick={() => setDraft(blank())}>
          <Plus /> {t('aarti.admin.addSlot', 'Add aarti')}
        </Button>
      }
    >
      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <TR>
                <TH>{t('aarti.admin.colName', 'Aarti')}</TH>
                <TH>{t('aarti.admin.colTime', 'Time')}</TH>
                <TH>{t('aarti.admin.colDays', 'Days')}</TH>
                <TH>{t('aarti.admin.colDuration', 'Minutes')}</TH>
                <TH>{t('aarti.admin.colActive', 'Active')}</TH>
                <TH>{t('aarti.admin.colSponsor', 'Sponsorable')}</TH>
                <TH className="text-right">
                  <span className="sr-only">{t('aarti.admin.actions', 'Actions')}</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {(data ?? []).map((s) => (
                <TR key={s.id}>
                  <TD>
                    <div className="font-semibold text-ink">{s.name}</div>
                    <Badge variant="neutral">{s.key}</Badge>
                  </TD>
                  <TD className="font-mono">{s.time}</TD>
                  <TD>
                    {s.days.length === 7
                      ? t('aarti.admin.everyDay', 'Every day')
                      : s.days.map((d) => WEEKDAYS[d]).join(', ')}
                  </TD>
                  <TD>{s.durationMin}</TD>
                  <TD>
                    <Checkbox
                      checked={s.active}
                      onChange={(e) => quick(s, { active: e.target.checked })}
                      aria-label={`${t('aarti.admin.colActive', 'Active')}: ${s.name}`}
                    />
                  </TD>
                  <TD>
                    <Checkbox
                      checked={s.sponsorable}
                      onChange={(e) => quick(s, { sponsorable: e.target.checked })}
                      aria-label={`${t('aarti.admin.colSponsor', 'Sponsorable')}: ${s.name}`}
                    />
                  </TD>
                  <TD className="text-right whitespace-nowrap">
                    <Button
                      size="icon-sm"
                      variant="plain"
                      onClick={() => setDraft({ ...s })}
                      aria-label={`${t('aarti.admin.edit', 'Edit')} ${s.name}`}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="plain"
                      onClick={() => setDel(s)}
                      aria-label={`${t('aarti.admin.delete', 'Delete')} ${s.name}`}
                    >
                      <Trash2 />
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      )}

      <Dialog
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? t('aarti.admin.editSlot', 'Edit aarti') : t('aarti.admin.addSlot', 'Add aarti')}
        footer={
          <>
            <Button variant="outline" onClick={() => setDraft(null)}>
              {t('aarti.admin.cancel', 'Cancel')}
            </Button>
            <Button onClick={save} disabled={!valid || saving}>
              {t('aarti.admin.save', 'Save')}
            </Button>
          </>
        }
      >
        {draft ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('aarti.admin.fName', 'Name')} htmlFor="sl-name">
                <Input id="sl-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </Field>
              <Field label={t('aarti.admin.fKey', 'Type')} htmlFor="sl-key">
                <Select id="sl-key" value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value as AartiKey })}>
                  {KEYS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('aarti.admin.fTime', 'Start time (temple local)')} htmlFor="sl-time">
                <Input id="sl-time" type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} />
              </Field>
              <Field label={t('aarti.admin.fDuration', 'Duration (minutes)')} htmlFor="sl-dur">
                <Input
                  id="sl-dur"
                  type="number"
                  min={5}
                  max={240}
                  value={draft.durationMin}
                  onChange={(e) => setDraft({ ...draft, durationMin: Number(e.target.value) || 30 })}
                />
              </Field>
            </div>
            <fieldset>
              <legend className="mb-1 text-xs font-semibold text-ink-soft">{t('aarti.admin.fDays', 'Days')}</legend>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((label, d) => {
                  const on = draft.days.includes(d)
                  return (
                    <label
                      key={label}
                      className="flex cursor-pointer items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-sm"
                    >
                      <Checkbox
                        checked={on}
                        onChange={() =>
                          setDraft({
                            ...draft,
                            days: on ? draft.days.filter((x) => x !== d) : [...draft.days, d].sort(),
                          })
                        }
                      />
                      {label}
                    </label>
                  )
                })}
              </div>
            </fieldset>
            <Field label={t('aarti.admin.fDesc', 'Description')} htmlFor="sl-desc">
              <Textarea id="sl-desc" rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </Field>
            <div className="flex flex-wrap gap-5">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
                {t('aarti.admin.colActive', 'Active')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={draft.sponsorable} onChange={(e) => setDraft({ ...draft, sponsorable: e.target.checked })} />
                {t('aarti.admin.colSponsor', 'Sponsorable')}
              </label>
            </div>
          </div>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={del !== null}
        tone="destructive"
        title={t('aarti.admin.deleteTitle', 'Delete this aarti?')}
        description={del?.name}
        confirmLabel={t('aarti.admin.delete', 'Delete')}
        onClose={() => setDel(null)}
        onConfirm={async () => {
          if (del) await deleteAartiSlot(del.id)
          toast(t('aarti.admin.slotDeleted', 'Aarti deleted'), { tone: 'warn' })
          setDel(null)
          refresh()
        }}
      />
    </PageShell>
  )
}
