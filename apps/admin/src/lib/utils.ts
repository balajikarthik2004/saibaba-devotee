import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { currentTemple, formatMoney } from '@saibaba/core'
import type { CurrencyCode } from '@saibaba/core/types'
import { format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Money is whole units of a record's own currency and is never converted. With no
 * `currency` argument these format in the selected temple's currency, so every tile,
 * table and chart follows the temple switcher. Pass a currency for records that carry
 * their own (a platform-wide total, a donation made in another currency).
 */
export const money = (n: number, cents = false, currency?: CurrencyCode) =>
  formatMoney(n, currency ?? currentTemple().currency, { cents })

/** Compact form for stat tiles and chart axes — $723K, ₹1.2L-style per locale. */
export function moneyShort(n: number, currency?: CurrencyCode) {
  return formatMoney(n, currency ?? currentTemple().currency, { compact: true })
}

const toDate = (d: string | Date) => (typeof d === 'string' ? parseISO(d) : d)

export function fmtDate(d: string | Date, pattern = 'MMM d, yyyy') {
  const date = toDate(d)
  return isValid(date) ? format(date, pattern) : '—'
}

export const fmtDay = (d: string | Date) => fmtDate(d, 'EEE, MMM d')
export const fmtDateTime = (d: string | Date) => fmtDate(d, "MMM d, yyyy 'at' h:mm a")
export const fmtTime = (d: string | Date) => fmtDate(d, 'h:mm a')

/**
 * "9 days ago" or "in 9 days", picked from the date rather than assumed.
 *
 * This used to append " ago" unconditionally, which was harmless while every caller
 * passed a timestamp of something that had already happened. A volunteer campaign's
 * briefing is the first forward-looking date in the console, and it read as "9 days ago"
 * for a briefing nine days away — the exact opposite of the truth, on the one field a
 * coordinator uses to decide whether there is still time to recruit.
 */
export function fmtRelative(d: string | Date) {
  const date = toDate(d)
  return isValid(date) ? formatDistanceToNowStrict(date, { addSuffix: true }) : '—'
}

export const pct = (n: number) => `${Math.round(n)}%`

/**
 * Acronyms that must not be sentence-cased. `titleCase` is what turns a stored enum
 * into a column value, and the donation ledger was printing the payment method of a
 * bank transfer as "Ach" in every row — a small thing that tells a treasurer the
 * console was not written by anyone who works with the ledger.
 */
const ACRONYMS = new Set([
  'ach',
  'agm',
  'csv',
  'ein',
  'id',
  'irs',
  'pan',
  'pdf',
  'sms',
  'ssn',
  'usd',
  'zip',
])

export const titleCase = (s: string) =>
  s
    .replace(/[-_]/g, ' ')
    .replace(/\b[\w']+/g, (w) =>
      ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1),
    )

/** Escapes a value for CSV export (used by the devotee and admin download buttons). */
function csvCell(v: unknown) {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0]!)
  return [headers.join(','), ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(','))].join(
    '\n',
  )
}

export function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  const blob = new Blob([toCSV(rows)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Builds a Google Calendar "add event" link for the calendar day drawer. */
export function googleCalendarUrl(opts: {
  title: string
  start: Date
  durationMin?: number
  details?: string
  location?: string
}) {
  const stamp = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, '')
  const end = new Date(opts.start.getTime() + (opts.durationMin ?? 60) * 60000)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: opts.title,
    dates: `${stamp(opts.start)}/${stamp(end)}`,
    details: opts.details ?? '',
    location: opts.location ?? '',
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export const initialsOf = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
