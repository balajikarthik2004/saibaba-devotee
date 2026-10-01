import { LANGUAGES, useLanguageStore } from '../../i18n'
import type { LanguageCode } from '../../types.sai'

const loaded = new Set<LanguageCode>(['en'])
const inflight = new Map<LanguageCode, Promise<void>>()

/** Explicit switch so bundlers create one lazy chunk per language. */
function importer(lang: LanguageCode): Promise<unknown> | null {
  switch (lang) {
    case 'hi': return import('../../i18n-dictionaries/hi')
    case 'mr': return import('../../i18n-dictionaries/mr')
    case 'te': return import('../../i18n-dictionaries/te')
    case 'gu': return import('../../i18n-dictionaries/gu')
    case 'ta': return import('../../i18n-dictionaries/ta')
    case 'es': return import('../../i18n-dictionaries/es')
    default: return null
  }
}

/** Lazily load (once) and register a language's dictionary. English is built in. */
export function loadDictionary(lang: LanguageCode): Promise<void> {
  if (loaded.has(lang)) return Promise.resolve()
  const existing = inflight.get(lang)
  if (existing) return existing
  const p = (importer(lang) ?? Promise.resolve())
    .then(() => {
      loaded.add(lang)
    })
    .catch(() => {
      /* offline / chunk missing: stay on English fallbacks */
    })
    .finally(() => inflight.delete(lang))
  inflight.set(lang, p)
  return p
}

function applyLang(lang: LanguageCode) {
  if (typeof document === 'undefined') return
  document.documentElement.lang = lang
  document.documentElement.dir = LANGUAGES.find((l) => l.code === lang)?.dir ?? 'ltr'
}

let started = false

/**
 * Call once from main.tsx. Sets <html lang>, loads the persisted language's dictionary and
 * reloads on change. After a dictionary arrives, the language store is nudged so `useT()`
 * consumers re-render with the new strings.
 */
export function bootstrapI18n(): void {
  if (started) return
  started = true
  const sync = async (lang: LanguageCode) => {
    applyLang(lang)
    if (loaded.has(lang)) return
    await loadDictionary(lang)
    // Re-notify subscribers (same value, new object) so translations render.
    if (useLanguageStore.getState().language === lang) useLanguageStore.setState({ language: lang })
  }
  const start = () => void sync(useLanguageStore.getState().language)
  const persist = useLanguageStore.persist
  if (persist && !persist.hasHydrated()) persist.onFinishHydration(start)
  else start()
  useLanguageStore.subscribe((s, prev) => {
    if (s.language !== prev.language) void sync(s.language)
  })
}
