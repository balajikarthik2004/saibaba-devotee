/** Day-precision helpers. Dates are local 'YYYY-MM-DD' strings throughout the devotion slice. */
const pad = (n: number) => String(n).padStart(2, '0')

export const toISODate = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function parseISODate(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

export const todayISO = (): string => toISODate(new Date())

export function addDaysISO(s: string, n: number): string {
  const d = parseISODate(s)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

/** Whole days from a to b (b - a). */
export const diffDays = (a: string, b: string): number =>
  Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86400000)

export const weekdayOf = (s: string): number => parseISODate(s).getDay()

/** The first date on or after `s` that falls on `weekday` (0 = Sunday … 6 = Saturday). */
export function nextWeekdayOnOrAfter(s: string, weekday: number): string {
  const delta = (weekday - weekdayOf(s) + 7) % 7
  return addDaysISO(s, delta)
}

/** The most recent date strictly before `s` that falls on `weekday`. */
export function weekdayBefore(s: string, weekday: number): string {
  const delta = ((weekdayOf(s) - weekday + 7) % 7) || 7
  return addDaysISO(s, -delta)
}
