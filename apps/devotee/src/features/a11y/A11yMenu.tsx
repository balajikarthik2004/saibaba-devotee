import { Accessibility, Minus, Plus } from 'lucide-react'
import { useT } from '@saibaba/core'
import { Popover } from '@/components/ui/overlay'
import {
  TEXT_SCALE_MAX,
  TEXT_SCALE_MIN,
  TEXT_SCALE_STEP,
  useA11yStore,
} from './store'

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-md px-2.5 py-2 hover:bg-tint">
      <span>
        <span className="block text-[13px] text-ink">{label}</span>
        {hint ? <span className="block text-[12px] text-muted">{hint}</span> : null}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 size-4 shrink-0 accent-[var(--color-brand-500)]"
      />
    </label>
  )
}

/** Accessibility popover: text size, high contrast, reduce motion, low-light mode. */
export function A11yMenu({ className }: { className?: string }) {
  const t = useT()
  const s = useA11yStore()
  return (
    <Popover
      className="w-[min(300px,calc(100vw-2rem))] p-2"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={t('a11y.menu', 'Accessibility settings')}
          className={
            'inline-grid size-9 place-items-center rounded-md text-muted hover:bg-tint hover:text-ink ' +
            (className ?? '')
          }
        >
          <Accessibility className="size-[18px]" aria-hidden />
        </button>
      )}
    >
      {() => (
        <div role="dialog" aria-label={t('a11y.menu', 'Accessibility settings')}>
          <div className="px-2.5 pb-2 pt-1">
            <p className="text-[13px] font-medium text-ink">{t('a11y.textSize', 'Text size')}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => s.setTextScale(s.textScale - TEXT_SCALE_STEP)}
                disabled={s.textScale <= TEXT_SCALE_MIN}
                aria-label={t('a11y.smaller', 'Smaller text')}
                className="inline-grid size-9 place-items-center rounded-md border border-line hover:bg-tint disabled:opacity-40"
              >
                <Minus className="size-4" aria-hidden />
              </button>
              <output className="min-w-12 text-center text-[14px] tabular-nums" aria-live="polite">
                {s.textScale}%
              </output>
              <button
                type="button"
                onClick={() => s.setTextScale(s.textScale + TEXT_SCALE_STEP)}
                disabled={s.textScale >= TEXT_SCALE_MAX}
                aria-label={t('a11y.larger', 'Larger text')}
                className="inline-grid size-9 place-items-center rounded-md border border-line hover:bg-tint disabled:opacity-40"
              >
                <Plus className="size-4" aria-hidden />
              </button>
            </div>
          </div>
          <Toggle
            label={t('a11y.highContrast', 'High contrast')}
            checked={s.highContrast}
            onChange={s.setHighContrast}
          />
          <Toggle
            label={t('a11y.reduceMotion', 'Reduce motion')}
            checked={s.reduceMotion}
            onChange={s.setReduceMotion}
          />
          <Toggle
            label={t('a11y.dim', 'Low-light mode')}
            hint={t('a11y.dimHint', 'Warm, dark colours for dawn and evening aarti')}
            checked={s.dimMode}
            onChange={s.setDimMode}
          />
          <button
            type="button"
            onClick={s.reset}
            className="mt-1 w-full rounded-md px-2.5 py-2 text-left text-[13px] text-brand-500 hover:bg-tint"
          >
            {t('a11y.reset', 'Reset to defaults')}
          </button>
        </div>
      )}
    </Popover>
  )
}
