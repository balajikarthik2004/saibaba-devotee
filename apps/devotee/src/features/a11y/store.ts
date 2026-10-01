import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const TEXT_SCALE_MIN = 90
export const TEXT_SCALE_MAX = 150
export const TEXT_SCALE_STEP = 10

interface A11yState {
  /** Percent, 90–150. */
  textScale: number
  highContrast: boolean
  /** Force reduced motion regardless of the OS setting. */
  reduceMotion: boolean
  /** Low-light devotion mode: warm dark palette for evening / dawn aarti reading. */
  dimMode: boolean
  setTextScale: (pct: number) => void
  setHighContrast: (v: boolean) => void
  setReduceMotion: (v: boolean) => void
  setDimMode: (v: boolean) => void
  reset: () => void
}

const DEFAULTS = { textScale: 100, highContrast: false, reduceMotion: false, dimMode: false }
const clamp = (n: number) => Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, Math.round(n)))

export const useA11yStore = create<A11yState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setTextScale: (pct) => set({ textScale: clamp(pct) }),
      setHighContrast: (highContrast) => set({ highContrast }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      setDimMode: (dimMode) => set({ dimMode }),
      reset: () => set({ ...DEFAULTS }),
    }),
    { name: 'saibaba:a11y' },
  ),
)

/** Write the current preferences onto <html> as classes + CSS variables (see a11y.css). */
export function applyA11y(s: Pick<A11yState, 'textScale' | 'highContrast' | 'reduceMotion' | 'dimMode'>) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.setProperty('--a11y-text-scale', String(clamp(s.textScale) / 100))
  root.classList.toggle('a11y-scaled', clamp(s.textScale) !== 100)
  root.classList.toggle('a11y-high-contrast', s.highContrast)
  root.classList.toggle('a11y-reduce-motion', s.reduceMotion)
  root.classList.toggle('a11y-dim', s.dimMode)
}

let started = false
/** Call once from main.tsx: applies persisted prefs immediately and on every change. */
export function initA11y() {
  if (started) return
  started = true
  applyA11y(useA11yStore.getState())
  useA11yStore.subscribe(applyA11y)
  // Persist hydration can land after first apply.
  useA11yStore.persist?.onFinishHydration((s) => applyA11y(s))
}
