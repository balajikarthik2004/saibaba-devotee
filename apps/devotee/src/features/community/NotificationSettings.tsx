import { useEffect, useState } from 'react'
import { Save, Send } from 'lucide-react'
import {
  NOTIFY_TOPICS,
  getPrefs,
  savePrefs,
  sendTestNotification,
  useT,
} from '@saibaba/core'
import type { CommunityPrefs, NotifyChannel, NotifyTopic } from '@saibaba/core'
import { PageHeader } from '@/components/layout/layouts'
import { LoadingSkeleton } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox, Field, Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/lib/store/auth'

const CHANNEL_LABEL: Record<NotifyChannel, string> = {
  email: 'Email',
  push: 'App notification',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
}
const TOPIC_LABEL: Record<NotifyTopic, string> = {
  aarti: 'Aarti and darshan',
  vrat: 'Vrat reminders',
  festival: 'Festivals',
  'daily-message': 'Daily message',
  giving: 'Giving and receipts',
  shipping: 'Prasad and shipping',
  volunteer: 'Volunteering',
}

export default function NotificationSettings() {
  const t = useT()
  const user = useAuthStore((s) => s.user)!
  const { toast } = useToast()
  const [prefs, setPrefs] = useState<CommunityPrefs | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    getPrefs(user.id).then((p) => live && setPrefs(p))
    return () => {
      live = false
    }
  }, [user.id])

  if (!prefs) return <LoadingSkeleton variant="card" />

  const update = (fn: (p: CommunityPrefs) => void) =>
    setPrefs((p) => {
      const n = structuredClone(p!)
      fn(n)
      return n
    })

  const consentChannel = (ch: 'sms' | 'whatsapp', on: boolean) =>
    update((p) => {
      p.channels[ch] = on
      if (on) p.consent[ch] = { at: new Date().toISOString() }
      else delete p.consent[ch]
    })

  async function save() {
    setBusy(true)
    const saved = await savePrefs(prefs!)
    setPrefs(saved)
    setBusy(false)
    toast(t('notify.saved', 'Preferences saved'), { tone: 'success' })
  }

  async function test() {
    await sendTestNotification(user.id, user.name, user.email)
    toast(t('notify.testSent', 'Test message logged'), {
      detail: t('notify.testDetail', 'Test notification sent.'),
    })
  }

  return (
    <>
      <PageHeader
        title={t('notify.title', 'Notification settings')}
        subtitle={t('notify.subtitle', 'Choose how and when the temple may reach you. You can change this any time.')}
        actions={
          <>
            <Button variant="outline" onClick={test}>
              <Send />
              {t('notify.test', 'Send me a test')}
            </Button>
            <Button onClick={save} disabled={busy}>
              <Save />
              {busy ? t('notify.saving', 'Saving…') : t('notify.save', 'Save')}
            </Button>
          </>
        }
      />
      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>{t('notify.channels', 'Channels')}</CardTitle>
          </CardHeader>
          <div className="space-y-3 p-5 pt-0">
            {(['email', 'push'] as const).map((ch) => (
              <label key={ch} className="flex cursor-pointer items-center gap-3 text-[14px] text-ink">
                <Checkbox
                  checked={prefs.channels[ch]}
                  onChange={(e) => update((p) => void (p.channels[ch] = e.target.checked))}
                />
                {t(`notify.ch.${ch}`, CHANNEL_LABEL[ch])}
              </label>
            ))}
            {(['sms', 'whatsapp'] as const).map((ch) => (
              <div key={ch} className="rounded-md bg-tint p-3">
                <label className="flex cursor-pointer items-start gap-3 text-[14px] text-ink">
                  <Checkbox
                    className="mt-0.5"
                    checked={Boolean(prefs.consent[ch]) && prefs.channels[ch]}
                    onChange={(e) => consentChannel(ch, e.target.checked)}
                  />
                  <span>
                    {t(`notify.ch.${ch}`, CHANNEL_LABEL[ch])}
                    <span className="mt-1 block text-[12.5px] leading-relaxed text-muted">
                      {t(
                        'notify.consent',
                        'I agree to receive {channel} messages from my temple on the phone number in my profile. Message and data rates may apply. I can turn this off at any time. This is off unless you tick it.',
                        { channel: CHANNEL_LABEL[ch] },
                      )}
                    </span>
                  </span>
                </label>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('notify.topics', 'Topics')}</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto p-5 pt-0">
            <table className="w-full min-w-105 text-left text-[13.5px]">
              <caption className="sr-only">{t('notify.matrix', 'Topics by channel')}</caption>
              <thead>
                <tr className="text-[12px] uppercase tracking-wide text-muted">
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    {t('notify.topic', 'Topic')}
                  </th>
                  <th scope="col" className="px-3 py-2 text-center font-semibold">
                    {t('notify.on', 'Send me these')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {NOTIFY_TOPICS.map((tp) => (
                  <tr key={tp} className="border-t border-line">
                    <th scope="row" className="py-2.5 pr-3 font-medium text-ink">
                      {t(`notify.topic.${tp}`, TOPIC_LABEL[tp])}
                    </th>
                    <td className="px-3 py-2.5 text-center">
                      <Checkbox
                        aria-label={TOPIC_LABEL[tp]}
                        checked={prefs.topics[tp]}
                        onChange={(e) => update((p) => void (p.topics[tp] = e.target.checked))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[12.5px] text-muted">
              {t('notify.matrixNote', 'Topics apply to every channel you have switched on above.')}
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('notify.quiet', 'Quiet hours')}</CardTitle>
            <p className="text-[13px] text-muted">
              {t('notify.quietSub', 'App, SMS and WhatsApp messages wait until quiet hours end.')}
            </p>
          </CardHeader>
          <div className="grid gap-4 p-5 pt-0 sm:grid-cols-2">
            <Field label={t('notify.from', 'From')} htmlFor="q-from">
              <Input
                id="q-from"
                type="time"
                value={prefs.quietHours?.from ?? '21:30'}
                onChange={(e) =>
                  update((p) => void (p.quietHours = { from: e.target.value, to: p.quietHours?.to ?? '07:00' }))
                }
              />
            </Field>
            <Field label={t('notify.to', 'Until')} htmlFor="q-to">
              <Input
                id="q-to"
                type="time"
                value={prefs.quietHours?.to ?? '07:00'}
                onChange={(e) =>
                  update((p) => void (p.quietHours = { from: p.quietHours?.from ?? '21:30', to: e.target.value }))
                }
              />
            </Field>
          </div>
        </Card>
      </div>
    </>
  )
}
