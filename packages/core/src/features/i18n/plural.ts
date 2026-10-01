import { getLanguage, translate } from '../../i18n'

export interface PluralForms {
  zero?: string
  one: string
  two?: string
  few?: string
  many?: string
  other: string
}

/**
 * Pluralised translate. `tp('vrat.weeks', n, { one: '{count} week', other: '{count} weeks' })`.
 * Dictionary keys are `<key>.<category>` (one/other/few/…), so translators can supply the
 * categories their language needs; missing ones fall back to the English form.
 */
export function tp(
  key: string,
  count: number,
  forms: PluralForms,
  vars?: Record<string, string | number>,
): string {
  const lang = getLanguage()
  let category: Intl.LDMLPluralRule = 'other'
  try {
    category = new Intl.PluralRules(lang).select(count)
  } catch {
    category = count === 1 ? 'one' : 'other'
  }
  const fallback = forms[category] ?? forms.other
  return translate(lang, `${key}.${category}`, fallback, { count, ...vars })
}
