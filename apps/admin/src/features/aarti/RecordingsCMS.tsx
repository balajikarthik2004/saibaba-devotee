import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useCurrentTemple } from '@saibaba/core/tenant'
import { useT } from '@saibaba/core/i18n'
import { addRecording, deleteRecording, listRecordings } from '@saibaba/core/features/aarti'
import type { AartiKey, AartiRecording } from '@saibaba/core/types.sai'
import { PageShell } from '@/components/layout/PageShell'
import { LoadingSkeleton } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/input'
import { Dialog } from '@/components/ui/overlay'
import { Table, TableWrap, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { useAsync } from '@/lib/hooks'
import { AartiTabs, ConfirmDialog, isHttpsUrl } from './shared'

const KEYS: AartiKey[] = ['kakad', 'madhyan', 'dhoop', 'shej', 'special']
const today = () => new Date().toISOString().slice(0, 10)

export default function RecordingsCMS() {
  const t = useT()
  const { toast } = useToast()
  const temple = useCurrentTemple()
  const { data, loading, refresh } = useAsync(() => listRecordings(temple.id), [temple.id])
  const [open, setOpen] = useState(false)
  const [del, setDel] = useState<AartiRecording | null>(null)
  const [f, setF] = useState({ slotKey: 'kakad' as AartiKey, date: today(), title: '', url: '', minutes: 25 })

  const valid = f.title.trim() && isHttpsUrl(f.url) && f.date && f.minutes > 0

  return (
    <PageShell
      eyebrow={t('aarti.admin.group', 'Darshan')}
      title={t('aarti.admin.recordingsTitle', 'Aarti recordings')}
      description={temple.name}
      tabs={<AartiTabs />}
      actions={
        <Button onClick={() => setOpen(true)}>
          <Plus /> {t('aarti.admin.addRecording', 'Add recording')}
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
                <TH>{t('aarti.admin.colDate', 'Date')}</TH>
                <TH>{t('aarti.admin.fTitle', 'Title')}</TH>
                <TH>{t('aarti.admin.fKey', 'Type')}</TH>
                <TH>{t('aarti.admin.colLength', 'Length')}</TH>
                <TH>
                  <span className="sr-only">{t('aarti.admin.actions', 'Actions')}</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {(data ?? []).map((r) => (
                <TR key={r.id}>
                  <TD className="font-mono whitespace-nowrap">{r.date}</TD>
                  <TD>
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-600 hover:underline">
                      {r.title}
                    </a>
                  </TD>
                  <TD>
                    <Badge variant="neutral">{r.slotKey}</Badge>
                  </TD>
                  <TD className="font-mono">
                    {Math.floor(r.durationSec / 60)}:{String(r.durationSec % 60).padStart(2, '0')}
                  </TD>
                  <TD className="text-right">
                    <Button size="icon-sm" variant="plain" onClick={() => setDel(r)} aria-label={`${t('aarti.admin.delete', 'Delete')} ${r.title}`}>
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
        open={open}
        onClose={() => setOpen(false)}
        title={t('aarti.admin.addRecording', 'Add recording')}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('aarti.admin.cancel', 'Cancel')}
            </Button>
            <Button
              disabled={!valid}
              onClick={async () => {
                await addRecording({
                  templeId: temple.id,
                  slotKey: f.slotKey,
                  date: f.date,
                  title: f.title.trim(),
                  url: f.url.trim(),
                  durationSec: Math.round(f.minutes * 60),
                })
                toast(t('aarti.admin.recordingAdded', 'Recording added'))
                setOpen(false)
                setF({ ...f, title: '', url: '' })
                refresh()
              }}
            >
              {t('aarti.admin.save', 'Save')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label={t('aarti.admin.fTitle', 'Title')} htmlFor="rc-title">
            <Input id="rc-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </Field>
          <Field
            label={t('aarti.admin.fUrl', 'Video URL')}
            htmlFor="rc-url"
            error={f.url && !isHttpsUrl(f.url) ? t('aarti.admin.urlInvalid', 'Enter a valid https:// URL') : undefined}
          >
            <Input id="rc-url" inputMode="url" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t('aarti.admin.fKey', 'Type')} htmlFor="rc-key">
              <Select id="rc-key" value={f.slotKey} onChange={(e) => setF({ ...f, slotKey: e.target.value as AartiKey })}>
                {KEYS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('aarti.admin.colDate', 'Date')} htmlFor="rc-date">
              <Input id="rc-date" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
            </Field>
            <Field label={t('aarti.admin.fMinutes', 'Minutes')} htmlFor="rc-min">
              <Input id="rc-min" type="number" min={1} value={f.minutes} onChange={(e) => setF({ ...f, minutes: Number(e.target.value) })} />
            </Field>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={del !== null}
        tone="destructive"
        title={t('aarti.admin.deleteRecTitle', 'Remove this recording?')}
        description={del?.title}
        confirmLabel={t('aarti.admin.delete', 'Delete')}
        onClose={() => setDel(null)}
        onConfirm={async () => {
          if (del) await deleteRecording(del.id)
          toast(t('aarti.admin.recordingDeleted', 'Recording removed'), { tone: 'warn' })
          setDel(null)
          refresh()
        }}
      />
    </PageShell>
  )
}
