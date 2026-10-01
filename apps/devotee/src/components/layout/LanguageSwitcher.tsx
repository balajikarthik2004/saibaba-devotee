import { Globe } from 'lucide-react'
import { LANGUAGES, useLanguageStore, useT } from '@saibaba/core'
import type { LanguageCode } from '@saibaba/core'
import { cn } from '@/lib/utils'

/** A plain, accessible language select built on the core i18n store. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const setLanguage = useLanguageStore((s) => s.setLanguage)

  return (
    <label
      className={cn(
        'relative flex h-9 items-center gap-1.5 rounded-full border border-line bg-card pl-2.5 pr-1.5 text-[13px] text-ink transition-colors focus-within:ring-2 focus-within:ring-brand-500/40 hover:bg-tint',
        className,
      )}
    >
      <Globe className="size-4 shrink-0 text-brand-500" aria-hidden="true" />
      <span className="sr-only">{t('language.label', 'Language')}</span>
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value as LanguageCode)}
        className="h-full cursor-pointer appearance-none bg-transparent pr-1 text-[13px] font-medium focus:outline-none"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.native}
          </option>
        ))}
      </select>
    </label>
  )
}
