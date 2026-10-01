import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LanguageCode } from './types.sai'

/**
 * Minimal i18n.
 *
 *   const t = useT()
 *   t('aarti.title', 'Daily aartis')                 // English fallback is REQUIRED
 *   t('vrat.week', 'Week {n} of {total}', { n: 3, total: 9 })
 *
 * Keys are namespaced by slice ('home.', 'aarti.', 'vrat.' …). English lives in the code
 * as the fallback, so a screen is never blank because a translation is missing. Other
 * languages are registered as dictionaries (see `registerDictionary`) and filled in by
 * the i18n slice's extraction pass.
 */
export const LANGUAGES: { code: LanguageCode; native: string; english: string; dir: 'ltr' }[] = [
  { code: 'en', native: 'English', english: 'English', dir: 'ltr' },
  { code: 'hi', native: 'हिन्दी', english: 'Hindi', dir: 'ltr' },
  { code: 'mr', native: 'मराठी', english: 'Marathi', dir: 'ltr' },
  { code: 'te', native: 'తెలుగు', english: 'Telugu', dir: 'ltr' },
  { code: 'gu', native: 'ગુજરાતી', english: 'Gujarati', dir: 'ltr' },
  { code: 'ta', native: 'தமிழ்', english: 'Tamil', dir: 'ltr' },
  { code: 'es', native: 'Español', english: 'Spanish', dir: 'ltr' },
]

type Dict = Record<string, string>
const dictionaries: Partial<Record<LanguageCode, Dict>> = {}

/** Merge translations for a language. Safe to call from any slice, any number of times. */
export function registerDictionary(lang: LanguageCode, dict: Dict) {
  dictionaries[lang] = { ...(dictionaries[lang] ?? {}), ...dict }
}

interface LangState {
  language: LanguageCode
  setLanguage: (l: LanguageCode) => void
}

export const useLanguageStore = create<LangState>()(
  persist(
    (set) => ({
      language: 'en',
      setLanguage: (language) => {
        set({ language })
        if (typeof document !== 'undefined') document.documentElement.lang = language
      },
    }),
    { name: 'saibaba:language' },
  ),
)

export const getLanguage = () => useLanguageStore.getState().language

function format(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`))
}

/** Non-React translate. */
export function translate(
  lang: LanguageCode,
  key: string,
  fallback: string,
  vars?: Record<string, string | number>,
) {
  return format(dictionaries[lang]?.[key] ?? fallback, vars)
}

/** React hook — re-renders when the language changes. */
export function useT() {
  const lang = useLanguageStore((s) => s.language)
  return (key: string, fallback: string, vars?: Record<string, string | number>) =>
    translate(lang, key, fallback, vars)
}
