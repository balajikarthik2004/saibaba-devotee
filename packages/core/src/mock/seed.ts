/**
 * Deterministic pseudo-randomness for the mock seed.
 *
 * Every mock array is built from `rng(seedNumber)` so a rebuild always produces
 * byte-identical data — no `Math.random()` anywhere in the seed. Dates are the one
 * exception: they are derived from the current clock so "today's bookings" and
 * "upcoming events" stay meaningful whenever the app is demoed.
 */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Rand = () => number

export const pick = <T>(r: Rand, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!
export const int = (r: Rand, min: number, max: number) => min + Math.floor(r() * (max - min + 1))
export const chance = (r: Rand, pct: number) => r() * 100 < pct

/** Stable, human-readable ids — far friendlier than real UUIDs when demoing. */
export const id = (prefix: string, n: number) => `${prefix}_${String(n).padStart(4, '0')}`

/** Midnight today, in local (America/Chicago for the demo machine) time. */
export function today(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function addDays(base: Date, days: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

/**
 * A date inside a given calendar year, capped at today for the current year so nothing
 * is ever dated in the future. The receipt seeds use this to place at least one gift and
 * one sponsorship per devotee in each of the last two tax years.
 */
export function dayInYear(r: Rand, year: number, base: Date): Date {
  const start = new Date(year, 0, 1)
  const end = year === base.getFullYear() ? base : new Date(year, 11, 31)
  const span = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000))
  return addDays(start, int(r, 0, span))
}

export function addMonths(base: Date, months: number): Date {
  const d = new Date(base)
  d.setMonth(d.getMonth() + months)
  return d
}

/** ISO-8601 string, per Section 4 conventions. */
export const iso = (d: Date): string => d.toISOString()

/** Day offset from today, at a given hour, as ISO. */
export function offsetISO(days: number, hour = 9, minute = 0): string {
  const d = addDays(today(), days)
  d.setHours(hour, minute, 0, 0)
  return iso(d)
}

/**
 * ISO for a fixed calendar date, rolled forward to the next year if it has already
 * passed — keeps the festival calendar looking live year after year.
 */
export function festivalISO(month: number, day: number, hour = 18): string {
  const now = today()
  const year = now.getFullYear()
  let d = new Date(year, month - 1, day, hour, 0, 0, 0)
  if (d.getTime() < now.getTime() - 45 * 86400000) d = new Date(year + 1, month - 1, day, hour)
  return iso(d)
}

/** The next Thursday (Baba's day) strictly after today, `weeksAhead` weeks on, at `hour`. */
export function nextThursday(weeksAhead = 0, hour = 18): string {
  const d = today()
  const until = ((4 - d.getDay() + 7) % 7) || 7
  d.setDate(d.getDate() + until + weeksAhead * 7)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}
