/**
 * Time-zone helpers for aarti schedules.
 *
 * A slot's `time` is 'HH:mm' on the *temple's* wall clock. Turning that into an absolute
 * instant needs the IANA zone's offset on that particular date (DST!), which we derive
 * from `Intl.DateTimeFormat` — no external library.
 */
import type { AartiSlot } from '../../types.sai'
import { currentTemple } from '../../tenant'

export interface HasTimeZone {
  timezone: string
}

const dtfCache = new Map<string, Intl.DateTimeFormat>()
function partsFormatter(timeZone: string) {
  let f = dtfCache.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    dtfCache.set(timeZone, f)
  }
  return f
}

interface Wall {
  y: number
  mo: number
  d: number
  h: number
  mi: number
  s: number
}

/** Wall-clock components of an instant in a zone. */
export function wallClock(instant: Date | number, timeZone: string): Wall {
  const ms = typeof instant === 'number' ? instant : instant.getTime()
  const p: Record<string, number> = {}
  for (const part of partsFormatter(timeZone).formatToParts(ms)) {
    if (part.type !== 'literal') p[part.type] = Number(part.value)
  }
  return { y: p.year!, mo: p.month!, d: p.day!, h: p.hour! % 24, mi: p.minute!, s: p.second! }
}

/** Offset of `timeZone` from UTC at `instant`, in minutes (Chicago summer = -300). */
export function tzOffsetMinutes(instant: Date | number, timeZone: string): number {
  const ms = typeof instant === 'number' ? instant : instant.getTime()
  const w = wallClock(ms, timeZone)
  const asUtc = Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s)
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000)
}

/**
 * Convert a wall-clock time in an IANA zone to an absolute instant.
 * Non-existent times (spring-forward gap) resolve forward; ambiguous times (fall-back
 * overlap) resolve to the first occurrence.
 */
export function zonedTimeToInstant(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi, 0)
  // Candidate instants using every offset that is in force within a day either side.
  const offs = new Set([
    tzOffsetMinutes(guess - 86400000, timeZone),
    tzOffsetMinutes(guess, timeZone),
    tzOffsetMinutes(guess + 86400000, timeZone),
  ])
  const valid: number[] = []
  for (const off of offs) {
    const t = guess - off * 60000
    if (tzOffsetMinutes(t, timeZone) === off) valid.push(t)
  }
  if (valid.length > 0) return new Date(Math.min(...valid)) // overlap -> first occurrence
  // Gap: the wall time never happened. Shift forward using the pre-gap offset.
  const before = tzOffsetMinutes(guess - 86400000, timeZone)
  return new Date(guess - before * 60000)
}

const pad = (n: number) => String(n).padStart(2, '0')

/** 'YYYY-MM-DD' of the given instant on the zone's calendar. */
export function dateInZone(instant: Date | number, timeZone: string): string {
  const w = wallClock(instant, timeZone)
  return `${w.y}-${pad(w.mo)}-${pad(w.d)}`
}

/** Add whole days to a 'YYYY-MM-DD' string (calendar arithmetic, zone-free). */
export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

/** 0 = Sunday … 6 = Saturday for a 'YYYY-MM-DD' calendar date. */
export function weekdayOfIso(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/**
 * Absolute instant of a slot on a calendar date of the temple.
 * `date` is 'YYYY-MM-DD' (temple-local) or a Date (its temple-local calendar day is used).
 */
export function slotToInstant(
  slot: Pick<AartiSlot, 'time'>,
  timeZone: string,
  date: string | Date = new Date(),
): Date {
  const iso = typeof date === 'string' ? date : dateInZone(date, timeZone)
  const [y, mo, d] = iso.split('-').map(Number) as [number, number, number]
  const [h, mi] = slot.time.split(':').map(Number) as [number, number]
  return zonedTimeToInstant(y, mo, d, h, mi ?? 0, timeZone)
}

export interface NextAarti {
  slot: AartiSlot
  /** Start, absolute. */
  instant: Date
  /** Temple-local calendar date of the occurrence. */
  date: string
}

/** Every occurrence of the active slots from a temple-local date for `days` days, in time order. */
export function slotOccurrences(
  slots: AartiSlot[],
  temple: HasTimeZone,
  fromIso: string,
  days: number,
): NextAarti[] {
  const out: NextAarti[] = []
  for (let i = 0; i < days; i++) {
    const date = addDaysIso(fromIso, i)
    const wd = weekdayOfIso(date)
    for (const slot of slots) {
      if (!slot.active || !slot.days.includes(wd)) continue
      out.push({ slot, date, instant: slotToInstant(slot, temple.timezone, date) })
    }
  }
  return out.sort((a, b) => a.instant.getTime() - b.instant.getTime())
}

/** The first active slot that starts after `now`, looking up to 9 temple-days ahead. */
export function nextAarti(
  slots: AartiSlot[],
  temple: HasTimeZone,
  now: Date = new Date(),
): NextAarti | null {
  const today = dateInZone(now, temple.timezone)
  return slotOccurrences(slots, temple, today, 9).find((o) => o.instant > now) ?? null
}

/** Today's (temple-local) active slots in time order. */
export function todaysAartis(
  slots: AartiSlot[],
  temple: HasTimeZone,
  now: Date = new Date(),
): NextAarti[] {
  const today = dateInZone(now, temple.timezone)
  return slotOccurrences(slots, temple, today, 1)
}

/**
 * True from 10 minutes before the start until the aarti ends. Checks today and yesterday
 * in the temple's zone so a late-night slot spilling past midnight still counts.
 */
export function isLiveWindow(
  slot: AartiSlot,
  now: Date = new Date(),
  timeZone: string = currentTemple().timezone,
): boolean {
  if (!slot.active) return false
  const today = dateInZone(now, timeZone)
  for (const date of [today, addDaysIso(today, -1)]) {
    if (!slot.days.includes(weekdayOfIso(date))) continue
    const start = slotToInstant(slot, timeZone, date).getTime()
    const n = now.getTime()
    if (n >= start - 10 * 60000 && n <= start + slot.durationMin * 60000) return true
  }
  return false
}

export interface TimeUntil {
  totalSec: number
  days: number
  hours: number
  minutes: number
  seconds: number
  /** 'HH:MM:SS' (hours may exceed 24 — days are folded in). */
  clock: string
}

export function timeUntil(target: Date | number, now: Date | number = new Date()): TimeUntil {
  const a = typeof target === 'number' ? target : target.getTime()
  const b = typeof now === 'number' ? now : now.getTime()
  const totalSec = Math.max(0, Math.floor((a - b) / 1000))
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60
  const totalHours = Math.floor(totalSec / 3600)
  return {
    totalSec,
    days,
    hours,
    minutes,
    seconds,
    clock: `${pad(totalHours)}:${pad(minutes)}:${pad(seconds)}`,
  }
}

/** The browser's IANA zone ('UTC' if it cannot be determined). */
export function viewerTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export interface FormatOpts {
  /** Defaults to the viewer's zone. */
  timeZone?: string
  locale?: string
  /** Include the weekday + date. */
  withDate?: boolean
  /** Append the short zone name ('CDT'). */
  withZone?: boolean
}

export function formatInViewerTz(instant: Date, opts: FormatOpts = {}): string {
  const { timeZone = viewerTimeZone(), locale, withDate = false, withZone = false } = opts
  const o: Intl.DateTimeFormatOptions = { timeZone, hour: 'numeric', minute: '2-digit' }
  if (withDate) {
    o.weekday = 'short'
    o.month = 'short'
    o.day = 'numeric'
  }
  if (withZone) o.timeZoneName = 'short'
  try {
    return new Intl.DateTimeFormat(locale, o).format(instant)
  } catch {
    return instant.toISOString()
  }
}

/** True when the viewer's clock differs from the temple's at that instant. */
export function zonesDiffer(instant: Date, templeTz: string, viewerTz = viewerTimeZone()): boolean {
  return tzOffsetMinutes(instant, templeTz) !== tzOffsetMinutes(instant, viewerTz)
}

/** City part of an IANA id ('America/Chicago' -> 'Chicago'). */
export const zoneCity = (tz: string) => (tz.split('/').pop() ?? tz).replace(/_/g, ' ')
