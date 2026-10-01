// Pure helpers (no Deno APIs) so they can be unit-tested in Node or Deno.

/** 'HH:mm' or 'HH:mm:ss' -> minutes since midnight. */
export function toMinutes(t: string): number {
  const [h, m] = t.split(':')
  return Number(h) * 60 + Number(m ?? 0)
}

/** Minutes since local midnight for `at` in IANA zone `tz`. */
export function localMinutes(at: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at)
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return h * 60 + m
}

/**
 * If `at` falls inside the quiet window [from, to) in the recipient's timezone (the window may
 * wrap midnight, e.g. 21:30 -> 07:00), returns when the window ends; otherwise null.
 */
export function quietHoursEnd(at: Date, tz: string, from: string | null, to: string | null): Date | null {
  if (!from || !to) return null
  const f = toMinutes(from)
  const t = toMinutes(to)
  if (f === t) return null
  const now = localMinutes(at, tz)
  const inside = f < t ? now >= f && now < t : now >= f || now < t
  if (!inside) return null
  const wait = (t - now + 1440) % 1440 || 1440
  return new Date(at.getTime() + wait * 60_000 - (at.getUTCSeconds() * 1000 + at.getUTCMilliseconds()))
}

/** Exponential backoff for a failed send: 2, 4, 8, 16 ... minutes (cap 6h). */
export const retryDelayMinutes = (attempts: number) => Math.min(2 ** Math.max(attempts, 1), 360)
export const MAX_ATTEMPTS = 5
