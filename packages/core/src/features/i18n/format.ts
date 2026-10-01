import { getLanguage } from '../../i18n'
import type { LanguageCode } from '../../types.sai'

const BCP47: Record<LanguageCode, string> = {
  en: 'en',
  hi: 'hi-IN',
  mr: 'mr-IN',
  te: 'te-IN',
  gu: 'gu-IN',
  ta: 'ta-IN',
  es: 'es',
}

/** Locale tag for the active (or given) UI language. `locale` overrides (e.g. temple.locale). */
export function localeFor(lang: LanguageCode = getLanguage(), locale?: string) {
  return locale ?? BCP47[lang] ?? 'en'
}

const toDate = (d: Date | string | number) => (d instanceof Date ? d : new Date(d))

export function formatDate(
  d: Date | string | number,
  opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
  o: { locale?: string; timeZone?: string } = {},
): string {
  const date = toDate(d)
  if (Number.isNaN(date.getTime())) return ''
  try {
    return new Intl.DateTimeFormat(localeFor(undefined, o.locale), { ...opts, timeZone: o.timeZone }).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

export function formatNumber(n: number, opts?: Intl.NumberFormatOptions, locale?: string): string {
  try {
    return new Intl.NumberFormat(localeFor(undefined, locale), opts).format(n)
  } catch {
    return String(n)
  }
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
  ['second', 1],
]

/** "in 3 days", "2 hours ago" in the UI language. */
export function formatRelative(d: Date | string | number, now: Date | number = Date.now(), locale?: string): string {
  const date = toDate(d)
  if (Number.isNaN(date.getTime())) return ''
  const diffSec = Math.round((date.getTime() - +now) / 1000)
  const abs = Math.abs(diffSec)
  const [unit, size] = UNITS.find(([, s]) => abs >= s) ?? UNITS[UNITS.length - 1]
  try {
    return new Intl.RelativeTimeFormat(localeFor(undefined, locale), { numeric: 'auto' }).format(
      Math.trunc(diffSec / size),
      unit,
    )
  } catch {
    return date.toISOString()
  }
}
