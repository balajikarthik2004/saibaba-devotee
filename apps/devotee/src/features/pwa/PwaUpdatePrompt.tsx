import { RefreshCw, X } from 'lucide-react'
import { useT } from '@saibaba/core'
import { Button } from '@/components/ui/button'
import { usePwaUpdate } from './usePwaUpdate'

/** "New version available — refresh" banner. Mount once near the app root. */
export function PwaUpdatePrompt() {
  const t = useT()
  const { updateAvailable, applyUpdate, dismiss } = usePwaUpdate()
  if (!updateAvailable) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="no-print fixed bottom-4 left-4 z-[70] flex w-[min(380px,calc(100vw-2rem))] items-center gap-3 rounded-[10px] border border-line bg-card p-3.5 shadow-[var(--shadow-lg)]"
    >
      <RefreshCw className="size-4 shrink-0 text-brand-500" aria-hidden />
      <p className="flex-1 text-[13px] text-ink">
        {t('pwa.updateAvailable', 'New version available — refresh')}
      </p>
      <Button size="sm" onClick={applyUpdate}>
        {t('pwa.refresh', 'Refresh')}
      </Button>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('pwa.dismiss', 'Dismiss')}
        className="rounded-md p-1 text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  )
}
