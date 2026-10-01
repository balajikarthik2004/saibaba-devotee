import * as React from 'react'
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastTone = 'success' | 'info' | 'warn'
interface Toast {
  id: number
  title: string
  detail?: string
  tone: ToastTone
}

interface ToastCtx {
  toast: (title: string, opts?: { detail?: string; tone?: ToastTone }) => void
}

const Ctx = React.createContext<ToastCtx>({ toast: () => {} })

export const useToast = () => React.useContext(Ctx)

const ICONS: Record<ToastTone, typeof Info> = {
  success: CheckCircle2,
  info: Info,
  warn: TriangleAlert,
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])
  const nextId = React.useRef(1)

  const dismiss = React.useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const toast = React.useCallback<ToastCtx['toast']>(
    (title, opts) => {
      const id = nextId.current++
      setToasts((t) => [...t, { id, title, detail: opts?.detail, tone: opts?.tone ?? 'success' }])
      setTimeout(() => dismiss(id), 4000)
    },
    [dismiss],
  )

  const value = React.useMemo(() => ({ toast }), [toast])

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2 no-print">
        {toasts.map((t) => {
          const Icon = ICONS[t.tone]
          return (
            <div
              key={t.id}
              role="status"
              // A tone rail down the left edge, so success and warning stay separable
              // in peripheral vision — the icon alone needs a look to decode.
              className={cn(
                'animate-fade-in pointer-events-auto flex items-start gap-2.5 rounded-[var(--radius)] border border-line border-l-[3px] bg-card p-3.5 shadow-[var(--shadow-lg)]',
                t.tone === 'success' && 'border-l-leaf-500',
                t.tone === 'info' && 'border-l-brand-500',
                t.tone === 'warn' && 'border-l-saffron-400',
              )}
            >
              <Icon
                className={cn(
                  'mt-px size-4 shrink-0',
                  t.tone === 'success' && 'text-leaf-500',
                  t.tone === 'info' && 'text-brand-500',
                  t.tone === 'warn' && 'text-gold-600',
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold leading-snug text-ink">{t.title}</p>
                {t.detail ? (
                  <p className="mt-0.5 text-sm leading-relaxed text-muted">{t.detail}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="-mr-0.5 -mt-0.5 rounded-[4px] p-0.5 text-faint transition-colors hover:bg-tint hover:text-ink"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </Ctx.Provider>
  )
}
