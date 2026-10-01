import { useState } from 'react'
import { Check, Copy, Share2 } from 'lucide-react'
import type { Leela } from '@saibaba/core'
import { useT } from '@saibaba/core/i18n'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

/** Circular progress. Decorative ring plus an accessible text value. */
export function ProgressRing({
  value,
  size = 96,
  label,
  center,
  className,
}: {
  value: number
  size?: number
  label: string
  center?: React.ReactNode
  className?: string
}) {
  const stroke = Math.max(6, Math.round(size / 11))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(100, value))
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('relative inline-grid shrink-0 place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-line" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
          className="stroke-saffron-500 transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="absolute text-center font-serif text-ink" style={{ fontSize: size / 4.2 }}>
        {center ?? `${Math.round(v)}%`}
      </span>
    </div>
  )
}

/** One diya. Lit = observed. Purely visual; the row carries the accessible label. */
export function Diya({ lit, current }: { lit: boolean; current?: boolean }) {
  return (
    <svg viewBox="0 0 40 48" className="h-11 w-9" aria-hidden="true">
      {lit ? (
        <>
          <ellipse cx="20" cy="15" rx="9" ry="12" className="fill-saffron-300/50" />
          <path
            d="M20 4c4 5 6 8 6 12a6 6 0 0 1-12 0c0-4 2-7 6-12z"
            className="fill-saffron-400 stroke-saffron-600"
            strokeWidth="1"
          />
          <path d="M20 12c2 3 3 4.5 3 6.5a3 3 0 0 1-6 0c0-2 1-3.5 3-6.5z" className="fill-saffron-100" />
        </>
      ) : (
        <path
          d="M20 12v8"
          strokeWidth="2"
          strokeLinecap="round"
          className={current ? 'stroke-brand-400' : 'stroke-line'}
        />
      )}
      <path
        d="M4 28h32c0 9-7 16-16 16S4 37 4 28z"
        className={cn(lit ? 'fill-brand-300 stroke-brand-500' : 'fill-tint stroke-line')}
        strokeWidth="1.5"
      />
    </svg>
  )
}

export function LampRow({
  total,
  observed,
  currentIndex,
}: {
  total: number
  observed: number
  currentIndex?: number
}) {
  const t = useT()
  return (
    <ol
      className="grid grid-cols-5 justify-items-center gap-x-2 gap-y-3 sm:flex sm:flex-wrap sm:justify-center"
      aria-label={t('vrat.lampsLabel', '{n} of {total} lamps lit', { n: observed, total })}
    >
      {Array.from({ length: total }, (_, i) => (
        <li key={i} className="flex flex-col items-center gap-0.5">
          <Diya lit={i < observed} current={i === currentIndex} />
          <span className="text-[11px] tabular-nums text-muted">
            <span className="sr-only">{t('vrat.weekWord', 'Week')} </span>
            {i + 1}
            <span className="sr-only">{i < observed ? `, ${t('vrat.lit', 'lit')}` : ''}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

export const THEME_LABEL: Record<Leela['theme'], [string, string]> = {
  'faith-and-patience': ['teach.theme.faith', 'Faith and patience'],
  compassion: ['teach.theme.compassion', 'Compassion'],
  unity: ['teach.theme.unity', 'Unity'],
  surrender: ['teach.theme.surrender', 'Surrender'],
  'guru-grace': ['teach.theme.guru', 'Guru’s grace'],
  service: ['teach.theme.service', 'Service'],
}

/** Share via the Web Share API; fall back to copying the text. */
export function ShareButton({
  text,
  title,
  size = 'sm',
  variant = 'outline',
}: {
  text: string
  title?: string
  size?: 'sm' | 'default'
  variant?: 'outline' | 'ghost' | 'subtle'
}) {
  const t = useT()
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)

  async function share() {
    const payload = { title: title ?? 'Sai Baba', text, url: window.location.origin + '/teachings' }
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share(payload)
        return
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${payload.url}`)
      setCopied(true)
      toast(t('teach.copied', 'Copied to your clipboard'), { tone: 'success' })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast(t('teach.copyFailed', 'Could not copy. Please select the text and copy it.'), { tone: 'warn' })
    }
  }

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  return (
    <Button size={size} variant={variant} onClick={share}>
      {copied ? <Check /> : canShare ? <Share2 /> : <Copy />}
      {copied ? t('teach.copiedShort', 'Copied') : canShare ? t('teach.share', 'Share') : t('teach.copy', 'Copy')}
    </Button>
  )
}

export const CHANNELS: { key: 'email' | 'sms' | 'whatsapp' | 'push'; label: [string, string] }[] = [
  { key: 'email', label: ['vrat.ch.email', 'Email'] },
  { key: 'sms', label: ['vrat.ch.sms', 'SMS'] },
  { key: 'whatsapp', label: ['vrat.ch.whatsapp', 'WhatsApp'] },
  { key: 'push', label: ['vrat.ch.push', 'Push notification'] },
]
