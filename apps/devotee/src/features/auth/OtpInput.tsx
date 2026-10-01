import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

/**
 * Six boxes, one digit each. Auto-advances, Backspace steps back, arrow keys move, and pasting a
 * full code (or an SMS autofill via autocomplete="one-time-code") fills every box.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled,
  invalid,
  label,
}: {
  value: string
  onChange: (v: string) => void
  onComplete?: (v: string) => void
  length?: number
  disabled?: boolean
  invalid?: boolean
  label: string
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const digits = Array.from({ length }, (_, i) => value[i] ?? '')

  useEffect(() => {
    refs.current[0]?.focus()
  }, [])

  const commit = (next: string) => {
    const clean = next.replace(/\D/g, '').slice(0, length)
    onChange(clean)
    if (clean.length === length) onComplete?.(clean)
    return clean
  }

  return (
    <div role="group" aria-label={label} className="flex gap-2">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          value={d}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={length} // allows a whole code to land in one box on autofill; we slice below
          disabled={disabled}
          aria-label={`${label}, digit ${i + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          onChange={(e) => {
            const typed = e.target.value.replace(/\D/g, '')
            if (!typed) {
              commit(value.slice(0, i) + value.slice(i + 1))
              return
            }
            if (typed.length > 1) {
              // paste / autofill into a single box
              const clean = commit(value.slice(0, i) + typed)
              refs.current[Math.min(clean.length, length - 1)]?.focus()
              return
            }
            const next = value.slice(0, i) + typed + value.slice(i + 1)
            commit(next)
            refs.current[Math.min(i + 1, length - 1)]?.focus()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !d && i > 0) {
              e.preventDefault()
              commit(value.slice(0, i - 1) + value.slice(i))
              refs.current[i - 1]?.focus()
            } else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus()
            else if (e.key === 'ArrowRight' && i < length - 1) refs.current[i + 1]?.focus()
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text')
            if (!/\d/.test(text)) return
            e.preventDefault()
            const clean = commit(text)
            refs.current[Math.min(clean.length, length - 1)]?.focus()
          }}
          onFocus={(e) => e.currentTarget.select()}
          className={cn(
            'h-12 w-full min-w-0 rounded-md border bg-card text-center font-serif text-xl text-ink',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/35 focus-visible:border-brand-400',
            'disabled:opacity-60',
            invalid ? 'border-brand-500' : 'border-line',
          )}
        />
      ))}
    </div>
  )
}
