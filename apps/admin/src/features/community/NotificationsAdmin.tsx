import { useEffect, useState } from 'react'
import { Send } from 'lucide-react'
import {
  MERGE_TAGS,
  NOTIFY_CHANNELS,
  NOTIFY_TOPICS,
  composeBroadcast,
  currentTempleId,
  estimateBroadcast,
  listGroups,
  listNotificationLog,
  renderTemplate,
  useCurrentTemple,
  useT,
} from '@saibaba/core'
import type { Audience, BroadcastResult, NotificationLogEntry, NotifyChannel, NotifyTopic } from '@saibaba/core'
import { PageShell } from '@/components/layout/PageShell'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { useAsync } from '@/lib/hooks'

const CH_LABEL: Record<NotifyChannel, string> = { email: 'Email', push: 'Push', sms: 'SMS', whatsapp: 'WhatsApp' }

export default function NotificationsAdmin() {
  const t = useT()
  const { toast } = useToast()
  const temple = useCurrentTemple()
  const tid = currentTempleId()
  const [topic, setTopic] = useState<NotifyTopic>('festival')
  const [channels, setChannels] = useState<NotifyChannel[]>(['email', 'push'])
  const [audience, setAudience] = useState('all')
  const [subject, setSubject] = useState('Guru Purnima at {temple}')
  const [body, setBody] = useState('Om Sai Ram {first_name}, you are warmly invited to join us at {temple}.')
  const [estimate, setEstimate] = useState<BroadcastResult | null>(null)
  const [busy, setBusy] = useState(false)

  const { data: groups } = useAsync(() => listGroups(tid), [tid])
  const { data: log, refresh } = useAsync(() => listNotificationLog(tid), [tid])

  const aud: Audience = audience === 'all' ? { kind: 'all' } : { kind: 'group', groupId: audience }

  useEffect(() => {
    let live = true
    void estimateBroadcast({ templeId: tid, topic, channels, subject, body, audience: aud }).then(
      (r) => live && setEstimate(r),
    )
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tid, topic, channels, audience])

  const toggle = (c: NotifyChannel) =>
    setChannels((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]))

  async function send() {
    if (!subject.trim() || !body.trim() || channels.length === 0) {
      return toast('Add a subject, a message and at least one channel', { tone: 'warn' })
    }
    setBusy(true)
    try {
      const r = await composeBroadcast({ templeId: tid, topic, channels, subject, body, audience: aud })
      toast('Broadcast logged', { detail: `${r.total} messages sent now`, tone: 'success' })
      refresh()
    } finally {
      setBusy(false)
    }
  }

  const preview = renderTemplate(body, { first_name: 'Asha', temple: temple.name })
  const previewSubject = renderTemplate(subject, { first_name: 'Asha', temple: temple.name })

  const columns: Column<NotificationLogEntry>[] = [
    { key: 'at', header: 'When', sortValue: (e) => e.createdAt, cell: (e) => new Date(e.createdAt).toLocaleString() },
    { key: 'subject', header: 'Subject', sortValue: (e) => e.subject, cell: (e) => e.subject },
    { key: 'ch', header: 'Channel', sortValue: (e) => e.channel, cell: (e) => CH_LABEL[e.channel] },
    { key: 'to', header: 'To', cell: (e) => e.recipient ?? '' },
    { key: 'topic', header: 'Topic', sortValue: (e) => e.topic, cell: (e) => e.topic },
    {
      key: 'status',
      header: 'Status',
      sortValue: (e) => e.status,
      cell: (e) => (
        <Badge variant={e.status === 'sent' ? 'leaf' : e.status === 'failed' ? 'brand' : 'gold'}>
          {e.status}
          {e.note ? ` · ${e.note}` : ''}
        </Badge>
      ),
    },
  ]

  return (
    <PageShell
      eyebrow="Community"
      title={t('notify.admin.title', 'Notifications')}
      description="Compose a message, check who it will reach, then send to registered devotees."
    >
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr] lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle>{t('notify.admin.compose', 'Compose')}</CardTitle>
          </CardHeader>
          <div className="grid gap-4 p-5 pt-0 sm:grid-cols-2">
            <Field label="Audience" htmlFor="n-aud">
              <Select id="n-aud" value={audience} onChange={(e) => setAudience(e.target.value)}>
                <option value="all">Everyone at this temple</option>
                {(groups ?? []).map((g) => (
                  <option key={g.id} value={g.id}>
                    Group: {g.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Topic" htmlFor="n-topic">
              <Select id="n-topic" value={topic} onChange={(e) => setTopic(e.target.value as NotifyTopic)}>
                {NOTIFY_TOPICS.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </Select>
            </Field>
            <fieldset className="sm:col-span-2">
              <legend className="mb-1.5 text-[13px] font-medium text-ink">Channels</legend>
              <div className="flex flex-wrap gap-4">
                {NOTIFY_CHANNELS.map((c) => (
                  <label key={c} className="flex items-center gap-2 text-sm text-ink">
                    <Checkbox checked={channels.includes(c)} onChange={() => toggle(c)} />
                    {CH_LABEL[c]}
                  </label>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted">
                SMS and WhatsApp reach only devotees who have explicitly opted in.
              </p>
            </fieldset>
            <Field label="Subject" htmlFor="n-sub" className="sm:col-span-2">
              <Input id="n-sub" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </Field>
            <Field
              label="Message"
              hint={`Merge tags: ${MERGE_TAGS.join('  ')}`}
              htmlFor="n-body"
              className="sm:col-span-2"
            >
              <Textarea id="n-body" rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <Button onClick={() => void send()} disabled={busy}>
                <Send />
                {busy ? 'Sending…' : 'Send broadcast'}
              </Button>
            </div>
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
            </CardHeader>
            <div className="p-5 pt-0 text-sm">
              <p className="font-semibold text-ink">{previewSubject}</p>
              <p className="mt-1 whitespace-pre-wrap leading-relaxed text-ink-soft">{preview}</p>
            </div>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Estimated reach</CardTitle>
            </CardHeader>
            <div className="p-5 pt-0" aria-live="polite">
              {estimate ? (
                <>
                  <p className="text-sm text-ink">
                    <span className="font-serif text-2xl">{estimate.total}</span> messages now
                  </p>
                  <ul className="mt-2 space-y-1 text-[13px] text-muted">
                    {channels.map((c) => (
                      <li key={c}>
                        {CH_LABEL[c]}: {estimate[c].send} now, {estimate[c].deferred} held for quiet hours,{' '}
                        {estimate[c].skipped} skipped (prefs or consent)
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-muted">Calculating…</p>
              )}
            </div>
          </Card>
        </div>
      </div>

      <h2 className="mb-3 mt-8 font-serif text-xl text-ink">History</h2>
      <DataTable
        rows={log ?? []}
        columns={columns}
        rowKey={(e) => e.id}
        initialSort={{ key: 'at', dir: 'desc' }}
        empty={{ title: 'Nothing sent yet', detail: 'Broadcasts and test messages appear here.' }}
      />
    </PageShell>
  )
}
