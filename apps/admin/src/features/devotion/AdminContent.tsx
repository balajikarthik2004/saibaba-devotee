import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { DailyMessage, LanguageCode, Leela } from '@saibaba/core'
import {
  addDailyMessage,
  addLeela,
  deleteDailyMessage,
  deleteLeela,
  devotionDates,
  listAssurances,
  listDailyMessageBank,
  listDailyMessages,
  listLeelas,
  updateDailyMessage,
  updateLeela,
} from '@saibaba/core/features/devotion'
import { LANGUAGES, useT } from '@saibaba/core/i18n'
import { currentTempleId } from '@saibaba/core/tenant'
import { PageShell } from '@/components/layout/PageShell'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { LoadingSkeleton } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/overlay'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/input'
import { Tabs } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/toast'
import { useAsync } from '@/lib/hooks'
import { fmtDate } from '@/lib/utils'

const { todayISO } = devotionDates

const THEMES: { key: Leela['theme']; label: string }[] = [
  { key: 'faith-and-patience', label: 'Faith and patience' },
  { key: 'compassion', label: 'Compassion' },
  { key: 'unity', label: 'Unity' },
  { key: 'surrender', label: 'Surrender' },
  { key: 'guru-grace', label: 'Guru’s grace' },
  { key: 'service', label: 'Service' },
]

export default function AdminContent() {
  const t = useT()
  const [tab, setTab] = useState('leelas')
  return (
    <PageShell
      eyebrow={t('devotion.group', 'Devotion')}
      title={t('teach.admin.title', 'Teachings content')}
      description={t('teach.admin.desc', 'Leelas and daily reflections shown to devotees. Keep the wording your own.')}
      tabs={
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { key: 'leelas', label: t('teach.admin.leelas', 'Leelas') },
            { key: 'daily', label: t('teach.admin.daily', 'Daily messages') },
            { key: 'assurances', label: t('teach.admin.assurances', 'Assurances') },
          ]}
        />
      }
    >
      {tab === 'leelas' ? <LeelasCMS /> : tab === 'daily' ? <DailyCMS /> : <AssurancesView />}
    </PageShell>
  )
}

/* ------------------------------------------------------------------ leelas */

interface LeelaDraft {
  id?: string
  title: string
  theme: Leela['theme']
  summary: string
  language: LanguageCode
  featured: boolean
}
const blankLeela = (): LeelaDraft => ({ title: '', theme: 'faith-and-patience', summary: '', language: 'en', featured: false })

function LeelasCMS() {
  const t = useT()
  const { toast } = useToast()
  const { data, loading, refresh } = useAsync(() => listLeelas(), [])
  const [draft, setDraft] = useState<LeelaDraft | null>(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!draft || !draft.title.trim() || !draft.summary.trim()) return
    setBusy(true)
    try {
      if (draft.id) {
        await updateLeela(draft.id, {
          title: draft.title.trim(),
          theme: draft.theme,
          summary: draft.summary.trim(),
          language: draft.language,
          featured: draft.featured,
        })
      } else {
        await addLeela({
          title: draft.title.trim(),
          theme: draft.theme,
          summary: draft.summary.trim(),
          language: draft.language,
          featured: draft.featured,
          source: 'Added by temple',
        })
      }
      toast(t('teach.admin.saved', 'Saved'), { tone: 'success' })
      setDraft(null)
      refresh()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong', { tone: 'warn' })
    } finally {
      setBusy(false)
    }
  }

  const cols: Column<Leela>[] = [
    { key: 'title', header: t('teach.admin.titleCol', 'Title'), sortValue: (l) => l.title, cell: (l) => <span className="font-medium text-ink">{l.title}</span> },
    { key: 'theme', header: t('teach.admin.theme', 'Theme'), sortValue: (l) => l.theme, cell: (l) => <Badge variant="gold">{THEMES.find((x) => x.key === l.theme)?.label}</Badge> },
    { key: 'lang', header: t('teach.admin.language', 'Language'), sortValue: (l) => l.language, cell: (l) => l.language.toUpperCase() },
    { key: 'feat', header: t('teach.admin.featured', 'Featured'), cell: (l) => (l.featured ? <Badge variant="leaf">Featured</Badge> : '—') },
    { key: 'pub', header: t('teach.admin.published', 'Published'), sortValue: (l) => l.publishedAt, cell: (l) => fmtDate(l.publishedAt) },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (l) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="plain"
            size="icon-sm"
            aria-label={`${t('common.edit', 'Edit')} ${l.title}`}
            onClick={() => setDraft({ id: l.id, title: l.title, theme: l.theme, summary: l.summary, language: l.language, featured: l.featured })}
          >
            <Pencil />
          </Button>
          <Button
            variant="plain"
            size="icon-sm"
            aria-label={`${t('common.delete', 'Delete')} ${l.title}`}
            onClick={async () => {
              if (!window.confirm(t('teach.admin.confirmDelete', 'Delete this leela?'))) return
              await deleteLeela(l.id)
              refresh()
            }}
          >
            <Trash2 />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setDraft(blankLeela())}>
          <Plus />
          {t('teach.admin.addLeela', 'Add leela')}
        </Button>
      </div>
      {loading || !data ? (
        <LoadingSkeleton variant="table" rows={5} />
      ) : (
        <DataTable rows={data} columns={cols} rowKey={(l) => l.id} empty={{ title: t('teach.admin.noLeelas', 'No leelas yet') }} />
      )}
      <Dialog
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? t('teach.admin.editLeela', 'Edit leela') : t('teach.admin.addLeela', 'Add leela')}
        description={t('teach.admin.leelaHint', 'Write in your own words, about 90 to 150 words. Do not paste text from published books.')}
        footer={
          <>
            <Button variant="plain" onClick={() => setDraft(null)}>{t('common.cancel', 'Cancel')}</Button>
            <Button disabled={busy || !draft?.title.trim() || !draft?.summary.trim()} onClick={() => void save()}>
              {t('common.save', 'Save')}
            </Button>
          </>
        }
      >
        {draft ? (
          <div className="space-y-3">
            <Field label={t('teach.admin.titleCol', 'Title')} htmlFor="l-title">
              <Input id="l-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('teach.admin.theme', 'Theme')} htmlFor="l-theme">
                <Select id="l-theme" value={draft.theme} onChange={(e) => setDraft({ ...draft, theme: e.target.value as Leela['theme'] })}>
                  {THEMES.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
                </Select>
              </Field>
              <Field label={t('teach.admin.language', 'Language')} htmlFor="l-lang">
                <Select id="l-lang" value={draft.language} onChange={(e) => setDraft({ ...draft, language: e.target.value as LanguageCode })}>
                  {LANGUAGES.map((x) => <option key={x.code} value={x.code}>{x.english}</option>)}
                </Select>
              </Field>
            </div>
            <Field
              label={t('teach.admin.text', 'Text')}
              htmlFor="l-text"
              hint={`${draft.summary.trim() ? draft.summary.trim().split(/\s+/).length : 0} words`}
            >
              <Textarea id="l-text" rows={8} value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} />
            </Field>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={draft.featured} onChange={(e) => setDraft({ ...draft, featured: e.target.checked })} />
              {t('teach.admin.feature', 'Feature at the top of the list')}
            </label>
          </div>
        ) : null}
      </Dialog>
    </>
  )
}

/* ------------------------------------------------------------ daily messages */

interface MsgDraft {
  id?: string
  date: string
  text: string
  language: LanguageCode
  thisTempleOnly: boolean
}

function DailyCMS() {
  const t = useT()
  const { toast } = useToast()
  const { data, loading, refresh } = useAsync(listDailyMessages, [])
  const { data: bank } = useAsync(listDailyMessageBank, [])
  const [draft, setDraft] = useState<MsgDraft | null>(null)
  const [showBank, setShowBank] = useState(false)

  async function save() {
    if (!draft || !draft.text.trim()) return
    const base = {
      date: draft.date,
      text: draft.text.trim(),
      language: draft.language,
      templeId: draft.thisTempleOnly ? currentTempleId() : null,
    }
    try {
      if (draft.id) await updateDailyMessage(draft.id, base)
      else await addDailyMessage(base)
      toast(t('teach.admin.saved', 'Saved'), { tone: 'success' })
      setDraft(null)
      refresh()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong', { tone: 'warn' })
    }
  }

  const cols: Column<DailyMessage>[] = [
    { key: 'date', header: t('teach.admin.date', 'Date'), sortValue: (m) => m.date, cell: (m) => fmtDate(m.date) },
    { key: 'text', header: t('teach.admin.text', 'Text'), cell: (m) => <span className="block max-w-[520px] whitespace-normal">{m.text}</span> },
    { key: 'lang', header: t('teach.admin.language', 'Language'), cell: (m) => m.language.toUpperCase() },
    { key: 'scope', header: t('teach.admin.scope', 'Shown at'), cell: (m) => (m.templeId ? 'This temple' : 'All temples') },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (m) => (
        <div className="flex justify-end gap-1">
          <Button variant="plain" size="icon-sm" aria-label={`${t('common.edit', 'Edit')} ${m.date}`} onClick={() => setDraft({ id: m.id, date: m.date, text: m.text, language: m.language, thisTempleOnly: !!m.templeId })}>
            <Pencil />
          </Button>
          <Button
            variant="plain"
            size="icon-sm"
            aria-label={`${t('common.delete', 'Delete')} ${m.date}`}
            onClick={async () => {
              if (!window.confirm(t('teach.admin.confirmDeleteMsg', 'Delete this message?'))) return
              await deleteDailyMessage(m.id)
              refresh()
            }}
          >
            <Trash2 />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <p className="mb-4 max-w-2xl text-sm text-muted">
        {t(
          'teach.admin.dailyNote',
          'Every day a reflection is chosen from a rotating bank of {n}. Schedule a message here to replace the bank on a particular date, for example a festival.',
          { n: bank?.length ?? 60 },
        )}
      </p>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setDraft({ date: todayISO(), text: '', language: 'en', thisTempleOnly: false })}>
          <Plus />
          {t('teach.admin.schedule', 'Schedule a message')}
        </Button>
      </div>
      {loading || !data ? (
        <LoadingSkeleton variant="table" rows={3} />
      ) : (
        <DataTable
          rows={data}
          columns={cols}
          rowKey={(m) => m.id}
          initialSort={{ key: 'date', dir: 'desc' }}
          empty={{ title: t('teach.admin.noMessages', 'Nothing scheduled'), detail: t('teach.admin.noMessagesD', 'The rotating bank is in use every day.') }}
        />
      )}

      <div className="mt-8">
        <Button variant="outline" size="sm" aria-expanded={showBank} onClick={() => setShowBank(!showBank)}>
          {showBank ? t('teach.admin.hideBank', 'Hide the rotating bank') : t('teach.admin.showBank', 'Show the rotating bank')}
        </Button>
        {showBank && bank ? (
          <ol className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
            {bank.map((b) => (
              <li key={b.index} className="rounded-[var(--radius)] border border-line bg-card px-3 py-2 text-ink-soft">
                <span className="mr-2 text-xs tabular-nums text-faint">{b.index + 1}</span>
                {b.text}
              </li>
            ))}
          </ol>
        ) : null}
      </div>

      <Dialog
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? t('teach.admin.editMsg', 'Edit message') : t('teach.admin.schedule', 'Schedule a message')}
        footer={
          <>
            <Button variant="plain" onClick={() => setDraft(null)}>{t('common.cancel', 'Cancel')}</Button>
            <Button disabled={!draft?.text.trim()} onClick={() => void save()}>{t('common.save', 'Save')}</Button>
          </>
        }
      >
        {draft ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('teach.admin.date', 'Date')} htmlFor="m-date">
                <Input id="m-date" type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
              </Field>
              <Field label={t('teach.admin.language', 'Language')} htmlFor="m-lang">
                <Select id="m-lang" value={draft.language} onChange={(e) => setDraft({ ...draft, language: e.target.value as LanguageCode })}>
                  {LANGUAGES.map((x) => <option key={x.code} value={x.code}>{x.english}</option>)}
                </Select>
              </Field>
            </div>
            <Field label={t('teach.admin.text', 'Text')} htmlFor="m-text" hint={t('teach.admin.short', 'one or two short sentences')}>
              <Textarea id="m-text" rows={3} maxLength={280} value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
            </Field>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={draft.thisTempleOnly} onChange={(e) => setDraft({ ...draft, thisTempleOnly: e.target.checked })} />
              {t('teach.admin.thisTempleOnly', 'Show only at this temple')}
            </label>
          </div>
        ) : null}
      </Dialog>
    </>
  )
}

/* --------------------------------------------------------------- assurances */

function AssurancesView() {
  const t = useT()
  const { data } = useAsync(listAssurances, [])
  return (
    <div className="max-w-3xl">
      <p className="mb-4 text-sm text-muted">
        {t('teach.admin.assuranceNote', 'Read-only. The eleven assurances traditionally attributed to Baba, in paraphrase. Wording varies between tellings.')}
      </p>
      {!data ? (
        <LoadingSkeleton variant="text" rows={5} />
      ) : (
        <ol className="space-y-2">
          {data.map((a) => (
            <li key={a.n} className="flex gap-3 rounded-[var(--radius)] border border-line bg-card px-4 py-3 text-sm text-ink">
              <span className="font-serif text-brand-600">{a.n}.</span>
              {a.text}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
