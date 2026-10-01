import { useState } from 'react'
import { Download, FilePlus2, Plus, X } from 'lucide-react'
import {
  createDrive,
  listDrives,
  listPledges,
  pledgesCSV,
  postReport,
  updateDrive,
} from '@saibaba/core/features/fulfilment'
import { formatMoney } from '@saibaba/core/money'
import { useT } from '@saibaba/core/i18n'
import { currentTemple } from '@saibaba/core/tenant'
import type { AnnadanamDrive } from '@saibaba/core/types.sai'
import { PageShell } from '@/components/layout/PageShell'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { LoadingSkeleton } from '@/components/shared/states'
import { Badge, Progress } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { Dialog } from '@/components/ui/overlay'
import { Tabs } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/toast'
import { useAsync, useTempleId } from '@/lib/hooks'
import { fmtDate } from '@/lib/utils'

interface DriveDraft {
  id?: string
  title: string
  date: string
  mealsTarget: string
  pricePerMeal: string
  menuNote: string
  status: AnnadanamDrive['status']
}

const blankDrive = (): DriveDraft => ({
  title: '',
  date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  mealsTarget: '251',
  pricePerMeal: currentTemple().currency === 'INR' ? '40' : '3',
  menuNote: '',
  status: 'open',
})

const readAsDataUrl = (f: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result))
    r.onerror = () => rej(r.error)
    r.readAsDataURL(f)
  })

export default function AnnadanamAdmin() {
  const t = useT()
  const { toast } = useToast()
  const templeId = useTempleId()
  const temple = currentTemple()
  const [tab, setTab] = useState<'drives' | 'pledges'>('drives')
  const [driveFilter, setDriveFilter] = useState('')
  const [draft, setDraft] = useState<DriveDraft | null>(null)
  const [report, setReport] = useState<AnnadanamDrive | null>(null)
  const [err, setErr] = useState('')

  const { data: drives, loading, refresh } = useAsync(() => listDrives(templeId, 'all'), [templeId])
  const { data: pledges, refresh: refreshPledges } = useAsync(() => listPledges(driveFilter || undefined), [templeId, driveFilter])
  const titleOf = new Map((drives ?? []).map((d) => [d.id, d.title]))

  const save = async () => {
    if (!draft) return
    const target = Number(draft.mealsTarget)
    const price = Number(draft.pricePerMeal)
    if (!draft.title.trim()) return setErr(t('shop.req', 'Required'))
    if (!(target >= 1)) return setErr(t('anna.admin.err.target', 'Enter a meals target'))
    if (!(price > 0)) return setErr(t('anna.admin.err.price', 'Enter a price per meal'))
    const date = new Date(draft.date + 'T12:00:00').toISOString()
    if (draft.id) {
      await updateDrive(draft.id, { title: draft.title.trim(), date, mealsTarget: target, pricePerMeal: price, menuNote: draft.menuNote, status: draft.status })
    } else {
      await createDrive({ title: draft.title.trim(), date, mealsTarget: target, pricePerMeal: price, menuNote: draft.menuNote })
    }
    toast(t('anna.admin.saved', 'Drive saved'))
    setDraft(null)
    setErr('')
    refresh()
  }

  const exportCsv = async () => {
    const csv = await pledgesCSV(driveFilter || undefined)
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'annadanam-pledges.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const driveCols: Column<AnnadanamDrive>[] = [
    { key: 'title', header: t('anna.admin.drive', 'Drive'), sortValue: (d) => d.title, cell: (d) => <span className="font-medium">{d.title}</span> },
    { key: 'date', header: t('shop.admin.date', 'Date'), sortValue: (d) => d.date, cell: (d) => fmtDate(d.date) },
    {
      key: 'progress',
      header: t('anna.admin.funded', 'Funded'),
      sortValue: (d) => d.mealsFunded / d.mealsTarget,
      cell: (d) => (
        <div className="w-40">
          <Progress value={(d.mealsFunded / d.mealsTarget) * 100} tone="leaf" label={d.title} />
          <span className="text-xs text-muted">{d.mealsFunded} / {d.mealsTarget} · {formatMoney(d.mealsFunded * d.pricePerMeal, d.currency)}</span>
        </div>
      ),
    },
    { key: 'status', header: t('shop.admin.status', 'Status'), sortValue: (d) => d.status, cell: (d) => <Badge variant={d.status === 'open' ? 'leaf' : 'neutral'}>{d.status}</Badge> },
    {
      key: 'act',
      header: '',
      cell: (d) => (
        <span className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="outline" onClick={() => { setErr(''); setDraft({ id: d.id, title: d.title, date: d.date.slice(0, 10), mealsTarget: String(d.mealsTarget), pricePerMeal: String(d.pricePerMeal), menuNote: d.menuNote, status: d.status }) }}>
            {t('shop.admin.edit', 'Edit')}
          </Button>
          <Button size="sm" variant="subtle" onClick={() => setReport(d)}>
            <FilePlus2 />{d.report ? t('anna.admin.editreport', 'Report') : t('anna.admin.postreport', 'Post report')}
          </Button>
        </span>
      ),
    },
  ]

  return (
    <PageShell
      title={t('anna.admin.title', 'Annadanam')}
      eyebrow={t('shop.admin.group', 'Fulfilment')}
      description={temple.name}
      actions={
        tab === 'drives' ? (
          <Button onClick={() => { setErr(''); setDraft(blankDrive()) }}><Plus />{t('anna.admin.new', 'New drive')}</Button>
        ) : (
          <Button variant="outline" onClick={exportCsv}><Download />{t('anna.admin.csv', 'Export CSV')}</Button>
        )
      }
      tabs={<Tabs value={tab} onChange={(k) => setTab(k as 'drives' | 'pledges')} items={[{ key: 'drives', label: t('anna.admin.drives', 'Drives'), count: drives?.length }, { key: 'pledges', label: t('anna.admin.pledges', 'Pledges'), count: pledges?.length }]} />}
    >
      {tab === 'drives' ? (
        loading ? <LoadingSkeleton variant="table" rows={4} /> : <DataTable rows={drives ?? []} columns={driveCols} rowKey={(d) => d.id} />
      ) : (
        <div className="space-y-3">
          <Select aria-label={t('anna.admin.drive', 'Drive')} value={driveFilter} onChange={(e) => setDriveFilter(e.target.value)} className="max-w-sm">
            <option value="">{t('anna.admin.alldrives', 'All drives')}</option>
            {(drives ?? []).map((d) => <option key={d.id} value={d.id}>{d.title} · {fmtDate(d.date)}</option>)}
          </Select>
          <DataTable
            rows={pledges ?? []}
            rowKey={(p) => p.id}
            initialSort={{ key: 'date', dir: 'desc' }}
            columns={[
              { key: 'date', header: t('shop.admin.date', 'Date'), sortValue: (p) => p.createdAt, cell: (p) => fmtDate(p.createdAt) },
              { key: 'donor', header: t('anna.admin.donor', 'Donor'), sortValue: (p) => p.donorName, cell: (p) => p.donorName },
              { key: 'drive', header: t('anna.admin.drive', 'Drive'), cell: (p) => titleOf.get(p.driveId) ?? p.driveId },
              { key: 'meals', header: t('anna.admin.meals', 'Meals'), align: 'right', sortValue: (p) => p.meals, cell: (p) => p.meals },
              { key: 'amount', header: t('anna.admin.amount', 'Amount'), align: 'right', sortValue: (p) => p.amount, cell: (p) => formatMoney(p.amount, p.currency) },
              { key: 'ded', header: t('anna.admin.dedicated', 'Dedicated to'), cell: (p) => p.dedicatedTo ?? '—' },
            ]}
            empty={{ title: t('anna.admin.nopledges', 'No pledges yet') }}
          />
        </div>
      )}

      <Dialog
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? t('anna.admin.edit', 'Edit drive') : t('anna.admin.new', 'New drive')}
        footer={<><Button variant="outline" onClick={() => setDraft(null)}>{t('shop.admin.cancelbtn', 'Cancel')}</Button><Button onClick={save}>{t('shop.admin.save', 'Save')}</Button></>}
      >
        {draft ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('anna.admin.name', 'Title')} htmlFor="d-title" className="sm:col-span-2">
              <Input id="d-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </Field>
            <Field label={t('shop.admin.date', 'Date')} htmlFor="d-date">
              <Input id="d-date" type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
            </Field>
            <Field label={t('anna.admin.status', 'Status')} htmlFor="d-status">
              <Select id="d-status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as AnnadanamDrive['status'] })}>
                <option value="open">open</option>
                <option value="served">served</option>
                <option value="reported">reported</option>
              </Select>
            </Field>
            <Field label={t('anna.admin.target', 'Meals target')} htmlFor="d-target">
              <Input id="d-target" type="number" min={1} value={draft.mealsTarget} onChange={(e) => setDraft({ ...draft, mealsTarget: e.target.value })} />
            </Field>
            <Field label={t('anna.admin.ppm', 'Price per meal ({c})', { c: temple.currency })} htmlFor="d-price" hint={draft.id ? t('anna.admin.ppm.locked', 'locked once funded') : undefined}>
              <Input id="d-price" type="number" min={1} value={draft.pricePerMeal} onChange={(e) => setDraft({ ...draft, pricePerMeal: e.target.value })} />
            </Field>
            <Field label={t('anna.admin.menu', 'Menu note')} htmlFor="d-menu" className="sm:col-span-2">
              <Textarea id="d-menu" rows={3} value={draft.menuNote} onChange={(e) => setDraft({ ...draft, menuNote: e.target.value })} />
            </Field>
            {err ? <p role="alert" className="text-xs font-medium text-brand-600 sm:col-span-2">{err}</p> : null}
          </div>
        ) : null}
      </Dialog>

      {report ? (
        <ReportDialog
          key={report.id}
          drive={report}
          onClose={() => setReport(null)}
          onSaved={() => {
            setReport(null)
            refresh()
            refreshPledges()
            toast(t('anna.admin.reportposted', 'Report posted'))
          }}
        />
      ) : null}
    </PageShell>
  )
}

function ReportDialog({ drive, onClose, onSaved }: { drive: AnnadanamDrive; onClose: () => void; onSaved: () => void }) {
  const t = useT()
  const [served, setServed] = useState(String(drive.report?.mealsServed ?? drive.mealsFunded))
  const [note, setNote] = useState(drive.report?.note ?? '')
  const [photos, setPhotos] = useState<string[]>(drive.report?.photos ?? [])
  const [url, setUrl] = useState('')
  const [err, setErr] = useState('')

  const addUrl = () => {
    const u = url.trim()
    if (!u) return
    if (!/^(https?:\/\/|data:image\/)/i.test(u)) return setErr(t('anna.admin.err.url', 'Use an http(s) link or an image data URL'))
    setPhotos([...photos, u])
    setUrl('')
    setErr('')
  }
  const addFiles = async (files: FileList | null) => {
    if (!files) return
    const out: string[] = []
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue
      if (f.size > 600_000) {
        setErr(t('anna.admin.err.big', 'Keep each photo under 600 KB, or add it by link.'))
        continue
      }
      out.push(await readAsDataUrl(f))
    }
    setPhotos((p) => [...p, ...out])
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('anna.admin.report.title', 'Report — {title}', { title: drive.title })}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>{t('shop.admin.cancelbtn', 'Cancel')}</Button>
          <Button
            onClick={async () => {
              const n = Number(served)
              if (!(n >= 0)) return setErr(t('anna.admin.err.served', 'Enter meals served'))
              await postReport(drive.id, { mealsServed: n, photos, note })
              onSaved()
            }}
          >
            {t('anna.admin.report.post', 'Post report')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label={t('anna.admin.served', 'Meals served')} htmlFor="r-served">
          <Input id="r-served" type="number" min={0} value={served} onChange={(e) => setServed(e.target.value)} />
        </Field>
        <Field label={t('anna.admin.note', 'Note to donors')} htmlFor="r-note">
          <Textarea id="r-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Field label={t('anna.admin.photourl', 'Photo link')} htmlFor="r-url">
          <div className="flex gap-2">
            <Input id="r-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addUrl() } }} />
            <Button type="button" variant="outline" onClick={addUrl}>{t('anna.admin.add', 'Add')}</Button>
          </div>
        </Field>
        <Field label={t('anna.admin.photofile', 'Or upload photos')} htmlFor="r-file">
          <input id="r-file" type="file" accept="image/*" multiple onChange={(e) => void addFiles(e.target.files)} className="text-sm" />
        </Field>
        {photos.length > 0 ? (
          <ul className="grid grid-cols-3 gap-2">
            {photos.map((p, i) => (
              <li key={i} className="relative">
                <img src={p} alt={t('anna.photo', 'Annadanam photo {n}', { n: i + 1 })} className="aspect-[3/2] w-full rounded-md border border-line object-cover" />
                <button type="button" aria-label={t('shop.remove', 'Remove')} onClick={() => setPhotos(photos.filter((_, j) => j !== i))} className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-card/90 text-ink shadow">
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {err ? <p role="alert" className="text-xs font-medium text-brand-600">{err}</p> : null}
        <p className="text-xs text-muted">{t('anna.admin.report.note', 'Posting a report marks the drive as served and shows it to donors.')}</p>
      </div>
    </Dialog>
  )
}
