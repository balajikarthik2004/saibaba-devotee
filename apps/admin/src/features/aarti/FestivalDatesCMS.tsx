import { useState } from 'react'
import { BadgeCheck, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCurrentTemple } from '@saibaba/core/tenant'
import { useT } from '@saibaba/core/i18n'
import {
  deleteFestivalDate,
  listFestivalDates,
  upsertFestivalDate,
} from '@saibaba/core/features/aarti'
import type { FestivalDate } from '@saibaba/core/types.sai'
import { PageShell } from '@/components/layout/PageShell'
import { LoadingSkeleton } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/input'
import { Dialog } from '@/components/ui/overlay'
import { Table, TableWrap, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { useAsync } from '@/lib/hooks'
import { AartiTabs, ConfirmDialog } from './shared'

type Draft = Omit<FestivalDate, 'id'> & { id?: string }
const KEYS: FestivalDate['key'][] = ['ram-navami', 'guru-purnima', 'vijayadashami', 'datta-jayanti', 'sai-jayanti', 'other']

export default function FestivalDatesCMS() {
  const t = useT()
  const { toast } = useToast()
  const temple = useCurrentTemple()
  const [year, setYear] = useState<string>('all')
  const { data, loading, refresh } = useAsync(
    () => listFestivalDates(temple.id, year === 'all' ? undefined : Number(year)),
    [temple.id, year],
  )
  const [draft, setDraft] = useState<Draft | null>(null)
  const [del, setDel] = useState<FestivalDate | null>(null)

  const blank = (): Draft => ({
    templeId: null,
    key: 'other',
    name: '',
    date: '',
    note: "Confirm with your temple's panchang.",
    verified: false,
  })
  const thisYear = new Date().getFullYear()
  const years = [thisYear - 1, thisYear, thisYear + 1, thisYear + 2]
  const valid = draft && draft.name.trim() && /^\d{4}-\d{2}-\d{2}$/.test(draft.date) && (!draft.endDate || draft.endDate >= draft.date)
  const unverified = (data ?? []).filter((f) => !f.verified).length

  return (
    <PageShell
      eyebrow={t('aarti.admin.group', 'Darshan')}
      title={t('aarti.admin.festivalsTitle', 'Festival dates')}
      description={t('aarti.admin.festivalsDesc', 'Global dates plus those specific to {temple}.', { temple: temple.name })}
      tabs={<AartiTabs />}
      actions={
        <>
          <Select
            aria-label={t('aarti.admin.yearFilter', 'Filter by year')}
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-32"
          >
            <option value="all">{t('aarti.all', 'All')}</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
          <Button onClick={() => setDraft(blank())}>
            <Plus /> {t('aarti.admin.addDate', 'Add date')}
          </Button>
        </>
      }
    >
      {unverified > 0 ? (
        <Card className="mb-4 border-saffron-500/40 bg-saffron-100/40 p-3 text-sm text-ink-soft" role="note">
          {t(
            'aarti.admin.unverifiedNote',
            '{n} dates are unverified seed values. Devotees are told dates are confirmed by the temple — check each against your panchang, then mark it verified.',
            { n: unverified },
          )}
        </Card>
      ) : null}

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <TR>
                <TH>{t('aarti.admin.colDate', 'Date')}</TH>
                <TH>{t('aarti.admin.fName', 'Name')}</TH>
                <TH>{t('aarti.admin.colScope', 'Applies to')}</TH>
                <TH>{t('aarti.admin.colVerified', 'Verified')}</TH>
                <TH>
                  <span className="sr-only">{t('aarti.admin.actions', 'Actions')}</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {(data ?? []).map((f) => (
                <TR key={f.id}>
                  <TD className="font-mono whitespace-nowrap">
                    {f.date}
                    {f.endDate ? ` → ${f.endDate}` : ''}
                  </TD>
                  <TD>
                    <div className="font-semibold text-ink">{f.name}</div>
                    {f.note ? <div className="text-xs text-muted">{f.note}</div> : null}
                  </TD>
                  <TD>
                    <Badge variant={f.templeId ? 'gold' : 'neutral'}>
                      {f.templeId ? t('aarti.admin.thisTemple', 'This temple') : t('aarti.admin.allTemples', 'All temples')}
                    </Badge>
                  </TD>
                  <TD>
                    <label className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={f.verified}
                        onChange={async (e) => {
                          await upsertFestivalDate({ ...f, verified: e.target.checked })
                          refresh()
                        }}
                        aria-label={`${t('aarti.admin.colVerified', 'Verified')}: ${f.name}`}
                      />
                      {f.verified ? (
                        <BadgeCheck className="size-4 text-leaf-600" aria-hidden="true" />
                      ) : (
                        <span className="text-muted">{t('aarti.admin.unverified', 'Unverified')}</span>
                      )}
                    </label>
                  </TD>
                  <TD className="text-right whitespace-nowrap">
                    <Button size="icon-sm" variant="plain" onClick={() => setDraft({ ...f })} aria-label={`${t('aarti.admin.edit', 'Edit')} ${f.name}`}>
                      <Pencil />
                    </Button>
                    <Button size="icon-sm" variant="plain" onClick={() => setDel(f)} aria-label={`${t('aarti.admin.delete', 'Delete')} ${f.name}`}>
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
        title={draft?.id ? t('aarti.admin.editDate', 'Edit festival date') : t('aarti.admin.addDate', 'Add date')}
        footer={
          <>
            <Button variant="outline" onClick={() => setDraft(null)}>
              {t('aarti.admin.cancel', 'Cancel')}
            </Button>
            <Button
              disabled={!valid}
              onClick={async () => {
                if (!draft) return
                await upsertFestivalDate({ ...draft, endDate: draft.endDate || undefined })
                toast(t('aarti.admin.dateSaved', 'Festival date saved'), { detail: draft.name })
                setDraft(null)
                refresh()
              }}
            >
              {t('aarti.admin.save', 'Save')}
            </Button>
          </>
        }
      >
        {draft ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('aarti.admin.fName', 'Name')} htmlFor="fd-name">
                <Input id="fd-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </Field>
              <Field label={t('aarti.admin.fKey', 'Type')} htmlFor="fd-key">
                <Select id="fd-key" value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value as FestivalDate['key'] })}>
                  {KEYS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('aarti.admin.colDate', 'Date')} htmlFor="fd-date">
                <Input id="fd-date" type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
              </Field>
              <Field label={t('aarti.admin.fEnd', 'End date (optional)')} htmlFor="fd-end">
                <Input id="fd-end" type="date" value={draft.endDate ?? ''} min={draft.date} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} />
              </Field>
            </div>
            <Field label={t('aarti.admin.colScope', 'Applies to')} htmlFor="fd-scope">
              <Select
                id="fd-scope"
                value={draft.templeId ? 'temple' : 'all'}
                onChange={(e) => setDraft({ ...draft, templeId: e.target.value === 'temple' ? temple.id : null })}
              >
                <option value="all">{t('aarti.admin.allTemples', 'All temples')}</option>
                <option value="temple">{temple.name}</option>
              </Select>
            </Field>
            <Field label={t('aarti.admin.fNote', 'Note')} htmlFor="fd-note">
              <Textarea id="fd-note" rows={2} value={draft.note ?? ''} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={draft.verified} onChange={(e) => setDraft({ ...draft, verified: e.target.checked })} />
              {t('aarti.admin.markVerified', 'Verified against the temple’s panchang')}
            </label>
          </div>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={del !== null}
        tone="destructive"
        title={t('aarti.admin.deleteDateTitle', 'Delete this date?')}
        description={del ? `${del.name} — ${del.date}` : undefined}
        confirmLabel={t('aarti.admin.delete', 'Delete')}
        onClose={() => setDel(null)}
        onConfirm={async () => {
          if (del) await deleteFestivalDate(del.id)
          toast(t('aarti.admin.dateDeleted', 'Festival date deleted'), { tone: 'warn' })
          setDel(null)
          refresh()
        }}
      />
    </PageShell>
  )
}
