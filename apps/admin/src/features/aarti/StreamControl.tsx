import { useEffect, useState } from 'react'
import { Radio, RotateCcw, Save } from 'lucide-react'
import { useCurrentTemple } from '@saibaba/core/tenant'
import { useT } from '@saibaba/core/i18n'
import { clearLiveStreamOverride, getLiveStream, setLiveStream } from '@saibaba/core/features/aarti'
import type { LiveStream } from '@saibaba/core/types.sai'
import { PageShell } from '@/components/layout/PageShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { useAsync } from '@/lib/hooks'
import { AartiTabs, ConfirmDialog, isHttpsUrl } from './shared'

const PROVIDERS: LiveStream['provider'][] = ['youtube', 'vimeo', 'facebook', 'hls', 'none']

export default function StreamControl() {
  const t = useT()
  const { toast } = useToast()
  const temple = useCurrentTemple()
  const { data, loading, refresh } = useAsync(() => getLiveStream(temple.id), [temple.id])
  const [provider, setProvider] = useState<LiveStream['provider']>('youtube')
  const [embedUrl, setEmbedUrl] = useState('')
  const [replay, setReplay] = useState('')
  const [preview, setPreview] = useState(false)
  const [confirm, setConfirm] = useState<null | 'live' | 'end'>(null)

  useEffect(() => {
    if (!data) return
    setProvider(data.provider)
    setEmbedUrl(data.embedUrl)
    setReplay(data.replayPlaylistUrl ?? '')
  }, [data])

  const urlOk = provider === 'none' || isHttpsUrl(embedUrl)
  const replayOk = !replay || isHttpsUrl(replay)
  const isLive = Boolean(data?.isLive)

  const save = async () => {
    await setLiveStream({ templeId: temple.id, provider, embedUrl, replayPlaylistUrl: replay || undefined })
    toast(t('aarti.admin.streamSaved', 'Stream settings saved'))
    refresh()
  }

  const toggle = async (live: boolean) => {
    await setLiveStream({ templeId: temple.id, provider, embedUrl, isLive: live })
    toast(
      live
        ? t('aarti.admin.nowLive', 'Darshan is now live for devotees')
        : t('aarti.admin.nowOffline', 'Darshan marked offline'),
      { tone: live ? 'success' : 'warn' },
    )
    setConfirm(null)
    refresh()
  }

  return (
    <PageShell
      eyebrow={t('aarti.admin.group', 'Darshan')}
      title={t('aarti.admin.streamTitle', 'Live stream control')}
      description={temple.name}
      tabs={<AartiTabs />}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card className="space-y-5 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {t('aarti.admin.status', 'Status')}
              </p>
              <Badge variant={isLive ? 'solid' : 'neutral'} className="mt-1" role="status">
                <Radio className="size-3" aria-hidden="true" />
                {isLive ? t('aarti.live', 'Live now') : t('aarti.offline', 'Offline')}
              </Badge>
            </div>
            <Button
              size="lg"
              variant={isLive ? 'destructive' : 'leaf'}
              disabled={loading || (!isLive && !urlOk)}
              onClick={() => setConfirm(isLive ? 'end' : 'live')}
              className="min-w-40"
            >
              {isLive ? t('aarti.admin.endStream', 'End live darshan') : t('aarti.admin.goLive', 'Go live')}
            </Button>
          </div>
          <p className="text-sm text-muted">
            {t(
              'aarti.admin.autoNote',
              'By default the stream shows as live whenever an aarti is on (from 10 minutes before). Going live or ending it here overrides that until you return to automatic.',
            )}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await clearLiveStreamOverride(temple.id)
              toast(t('aarti.admin.autoRestored', 'Back to automatic'))
              refresh()
            }}
          >
            <RotateCcw /> {t('aarti.admin.returnAuto', 'Return to automatic')}
          </Button>

          <hr className="border-line" />

          <Field label={t('aarti.admin.provider', 'Provider')} htmlFor="st-prov">
            <Select id="st-prov" value={provider} onChange={(e) => setProvider(e.target.value as LiveStream['provider'])}>
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={t('aarti.admin.embedUrl', 'Embed URL')}
            htmlFor="st-url"
            hint={t('aarti.admin.embedHint', 'https only — use the provider’s embed link')}
            error={!urlOk ? t('aarti.admin.urlInvalid', 'Enter a valid https:// URL') : undefined}
          >
            <Input
              id="st-url"
              inputMode="url"
              disabled={provider === 'none'}
              value={embedUrl}
              onChange={(e) => setEmbedUrl(e.target.value)}
              aria-invalid={!urlOk}
            />
          </Field>
          <Field
            label={t('aarti.admin.replayUrl', 'Replay playlist URL')}
            htmlFor="st-replay"
            error={!replayOk ? t('aarti.admin.urlInvalid', 'Enter a valid https:// URL') : undefined}
          >
            <Input id="st-replay" inputMode="url" value={replay} onChange={(e) => setReplay(e.target.value)} aria-invalid={!replayOk} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={!urlOk || !replayOk}>
              <Save /> {t('aarti.admin.save', 'Save')}
            </Button>
            <Button variant="outline" disabled={provider === 'none' || !urlOk} onClick={() => setPreview((p) => !p)}>
              {preview ? t('aarti.admin.hidePreview', 'Hide preview') : t('aarti.admin.testEmbed', 'Test embed')}
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 font-serif text-lg text-ink">{t('aarti.admin.preview', 'Preview')}</h2>
          {preview && provider !== 'none' && urlOk ? (
            provider === 'hls' ? (
              <video className="aspect-video w-full rounded-lg bg-ink" src={embedUrl} controls playsInline />
            ) : (
              <iframe
                title={t('aarti.admin.previewTitle', 'Embed preview')}
                src={embedUrl}
                className="aspect-video w-full rounded-lg border border-line bg-ink"
                allow="encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            )
          ) : (
            <div className="grid aspect-video place-items-center rounded-lg border border-dashed border-line bg-tint/50 p-4 text-center text-sm text-muted">
              {t('aarti.admin.previewEmpty', 'Press “Test embed” to load the live player stream.')}
            </div>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        tone={confirm === 'end' ? 'destructive' : 'default'}
        title={
          confirm === 'end'
            ? t('aarti.admin.confirmEndTitle', 'End live darshan?')
            : t('aarti.admin.confirmLiveTitle', 'Go live now?')
        }
        description={
          confirm === 'end'
            ? t('aarti.admin.confirmEndBody', 'Devotees will see the stream as offline.')
            : t('aarti.admin.confirmLiveBody', 'Devotees of {temple} will see the stream as live immediately.', {
                temple: temple.name,
              })
        }
        confirmLabel={confirm === 'end' ? t('aarti.admin.endStream', 'End live darshan') : t('aarti.admin.goLive', 'Go live')}
        onClose={() => setConfirm(null)}
        onConfirm={() => toggle(confirm === 'live')}
      />
    </PageShell>
  )
}
