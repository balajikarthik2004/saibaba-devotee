import { useState } from 'react'
import { Download, Share, X } from 'lucide-react'
import { useT } from '@saibaba/core'
import { readLocal, writeLocal } from '@saibaba/core/local'
import { Button } from '@/components/ui/button'
import { useInstallPrompt } from './useInstallPrompt'

const DISMISS_KEY = 'saibaba:pwa:install-dismissed'
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000

/**
 * "Install app" card. Chromium/Android: uses beforeinstallprompt. iOS Safari: shows
 * "Share → Add to Home Screen" instructions. Hidden once installed or dismissed (14 days).
 * Pass `inline` to render as a flow-layout card (e.g. in a footer/settings) instead of fixed.
 */
export function InstallPrompt({ inline = false }: { inline?: boolean }) {
  const t = useT()
  const { canInstall, showIosHint, install } = useInstallPrompt()
  const [hidden, setHidden] = useState(() => {
    const at = readLocal<number>(DISMISS_KEY, 0)
    return Date.now() - at < SNOOZE_MS
  })
  if (hidden || (!canInstall && !showIosHint)) return null

  const dismiss = () => {
    writeLocal(DISMISS_KEY, Date.now())
    setHidden(true)
  }
  return (
    <section
      aria-label={t('pwa.installTitle', 'Install the Shree Saibaba app')}
      className={
        'no-print flex items-start gap-3 rounded-[10px] border border-line bg-card p-3.5 shadow-[var(--shadow-lg)] ' +
        (inline
          ? 'w-full'
          : 'fixed bottom-4 right-4 z-[65] w-[min(380px,calc(100vw-2rem))] max-sm:bottom-20')
      }
    >
      <img src="/icons/icon-192.png" alt="" className="size-10 rounded-[10px]" />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-ink">
          {t('pwa.installTitle', 'Install the Shree Saibaba app')}
        </p>
        {canInstall ? (
          <>
            <p className="mt-0.5 text-[13px] text-muted">
              {t('pwa.installBody', 'Open aartis and today’s schedule in one tap, even offline.')}
            </p>
            <Button size="sm" className="mt-2" onClick={() => void install()}>
              <Download aria-hidden /> {t('pwa.install', 'Install')}
            </Button>
          </>
        ) : (
          <p className="mt-0.5 text-[13px] text-muted">
            {t('pwa.iosPre', 'Tap')}{' '}
            <Share className="inline size-4 align-text-bottom" aria-label={t('pwa.iosShare', 'Share')} />{' '}
            {t('pwa.iosPost', 'then “Add to Home Screen”.')}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('pwa.dismiss', 'Dismiss')}
        className="rounded-md p-1 text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <X className="size-4" aria-hidden />
      </button>
    </section>
  )
}
