import { useState } from 'react'
import { CheckCircle2, HandHeart, Info, Send } from 'lucide-react'
import {
  hasPrayed,
  listPrayers,
  prayFor,
  prayerSessionKey,
  submitPrayer,
  useCurrentTemple,
  useT,
} from '@saibaba/core'
import type { Prayer, PrayerCategory, PrayerVisibility } from '@saibaba/core'
import { PageHeader } from '@/components/layout/layouts'
import { EmptyState, LoadingSkeleton } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, Radio, Select, Textarea, Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/lib/store/auth'
import { useAsync } from '@/lib/hooks'

const CATEGORIES: { key: PrayerCategory; label: string }[] = [
  { key: 'health', label: 'Health and healing' },
  { key: 'family', label: 'Family' },
  { key: 'peace', label: 'Peace of mind' },
  { key: 'gratitude', label: 'Gratitude' },
  { key: 'guidance', label: 'Guidance' },
  { key: 'other', label: 'Other' },
]

function PrayerCard({ p, sessionKey }: { p: Prayer; sessionKey: string }) {
  const t = useT()
  const [count, setCount] = useState(p.prayerCount)
  const [done, setDone] = useState(() => hasPrayed(p.id, sessionKey))
  const [busy, setBusy] = useState(false)

  async function pray() {
    setBusy(true)
    try {
      const r = await prayFor(p.id, sessionKey)
      setCount(r.prayerCount)
      setDone(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <Badge variant="gold">{CATEGORIES.find((c) => c.key === p.category)?.label}</Badge>
        <span className="text-[12px] text-muted">{new Date(p.createdAt).toLocaleDateString()}</span>
      </div>
      <p className="mt-2 text-[14.5px] leading-relaxed text-ink">{p.body}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12.5px] text-muted">{p.displayName}</span>
        <Button
          size="sm"
          variant={done ? 'subtle' : 'ghost'}
          onClick={pray}
          disabled={done || busy}
          aria-pressed={done}
          aria-label={t('prayer.prayedFor', 'I prayed for this request. {n} so far.', { n: count })}
        >
          <HandHeart />
          {done ? t('prayer.prayedDone', 'You prayed') : t('prayer.prayed', 'I prayed')} · {count}
        </Button>
      </div>
    </Card>
  )
}

export default function Prayers() {
  const t = useT()
  const temple = useCurrentTemple()
  const user = useAuthStore((s) => s.user)
  const { toast } = useToast()
  const sessionKey = prayerSessionKey(user?.id)
  const [category, setCategory] = useState<PrayerCategory | ''>('')
  const { data, loading } = useAsync(
    () => listPrayers({ templeId: temple.id, wall: true, category: category || undefined }),
    [temple.id, category],
  )

  const [name, setName] = useState('')
  const [cat, setCat] = useState<PrayerCategory>('peace')
  const [body, setBody] = useState('')
  const [visibility, setVisibility] = useState<PrayerVisibility>('public')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return setError(t('prayer.err.empty', 'Please write a few words.'))
    setBusy(true)
    setError('')
    try {
      await submitPrayer({
        templeId: temple.id,
        userId: user?.id,
        displayName: name || user?.name.split(' ')[0] || '',
        category: cat,
        body,
        visibility,
      })
      setSubmitted(true)
      setBody('')
      toast(t('prayer.toast', 'Prayer received'), { detail: t('prayer.pending', 'Pending review by the temple team.') })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <PageHeader
        title={t('prayer.title', 'Prayer wall')}
        subtitle={t('prayer.subtitle', 'Shraddha and saburi. Share a request, or quietly pray for someone else.')}
      />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <section aria-labelledby="wall-h">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="wall-h" className="font-serif text-[20px] text-ink">
              {t('prayer.wall', 'Requests from the community')}
            </h2>
            <div className="w-48">
              <Select
                aria-label={t('prayer.filter', 'Filter by category')}
                value={category}
                onChange={(e) => setCategory(e.target.value as PrayerCategory | '')}
              >
                <option value="">{t('prayer.all', 'All categories')}</option>
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {loading ? (
            <LoadingSkeleton variant="tiles" rows={4} />
          ) : (data ?? []).length === 0 ? (
            <EmptyState
              Icon={HandHeart}
              title={t('prayer.empty', 'No requests here yet')}
              detail={t('prayer.emptyDetail', 'Be the first to share a prayer.')}
            />
          ) : (
            <ul className="space-y-3">
              {data!.map((p) => (
                <li key={p.id}>
                  <PrayerCard p={p} sessionKey={sessionKey} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <Card>
          <CardHeader>
            <CardTitle>{t('prayer.submit', 'Submit a prayer')}</CardTitle>
          </CardHeader>
          {submitted ? (
            <div className="space-y-3 p-5 pt-0" role="status">
              <p className="flex items-start gap-2 text-[14px] text-ink">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-leaf-500" aria-hidden="true" />
                {t('prayer.pendingLong', 'Thank you. Your prayer is pending review and will appear once the temple team has read it.')}
              </p>
              <Button variant="outline" size="sm" onClick={() => setSubmitted(false)}>
                {t('prayer.another', 'Share another')}
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4 p-5 pt-0" noValidate>
              <p className="flex items-start gap-2 rounded-md bg-tint p-3 text-[12.5px] leading-relaxed text-muted">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {t(
                  'prayer.moderation',
                  'We moderate every request. Please do not include phone numbers, addresses or medical details of other people.',
                )}
              </p>
              <Field label={t('prayer.name', 'Name to show')} hint={t('prayer.nameHint', '(first name or "Anonymous")')} htmlFor="pr-name">
                <Input id="pr-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label={t('prayer.category', 'Category')} htmlFor="pr-cat">
                <Select id="pr-cat" value={cat} onChange={(e) => setCat(e.target.value as PrayerCategory)}>
                  {CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('prayer.body', 'Your prayer')} htmlFor="pr-body" error={error}>
                <Textarea
                  id="pr-body"
                  value={body}
                  maxLength={800}
                  onChange={(e) => setBody(e.target.value)}
                  aria-invalid={Boolean(error)}
                />
              </Field>
              <fieldset>
                <legend className="mb-1.5 text-[13px] font-medium text-ink">
                  {t('prayer.visibility', 'Who can see it')}
                </legend>
                {(
                  [
                    ['public', 'Everyone (public wall)'],
                    ['temple', 'Temple team and priests only'],
                    ['private', 'Only me'],
                  ] as [PrayerVisibility, string][]
                ).map(([v, label]) => (
                  <label key={v} className="flex cursor-pointer items-center gap-2 py-1 text-[13.5px] text-ink">
                    <Radio name="pr-vis" checked={visibility === v} onChange={() => setVisibility(v)} />
                    {t(`prayer.vis.${v}`, label)}
                  </label>
                ))}
              </fieldset>
              <Button type="submit" disabled={busy}>
                <Send />
                {busy ? t('prayer.sending', 'Sending…') : t('prayer.send', 'Send prayer')}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
