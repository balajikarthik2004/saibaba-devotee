/**
 * Calendar export. RFC 5545 with UTC instants only (no VTIMEZONE needed), plus a Google
 * Calendar "template" link. Recurring rhythms are exported as individual dated events so
 * DST shifts stay correct (a UTC RRULE would drift by an hour twice a year).
 */
import type { AartiSlot } from '../../types.sai'
import { dateInZone, slotOccurrences, type HasTimeZone } from './time'

export interface IcsEvent {
  uid: string
  title: string
  start: Date
  end?: Date
  description?: string
  location?: string
  url?: string
}

const utc = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')

function esc(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,')
}

/** Fold to <= 75 octets per line, continuation lines start with one space. */
function fold(line: string): string {
  const enc = new TextEncoder()
  if (enc.encode(line).length <= 75) return line
  const out: string[] = []
  let cur = ''
  let bytes = 0
  let limit = 75
  for (const ch of line) {
    const b = enc.encode(ch).length
    if (bytes + b > limit) {
      out.push(cur)
      cur = ''
      bytes = 0
      limit = 74
    }
    cur += ch
    bytes += b
  }
  out.push(cur)
  return out.join('\r\n ')
}

export function buildIcs(events: IcsEvent[], calName = 'Aarti schedule'): string {
  const stamp = utc(new Date())
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Shree Saibaba Platform//Aarti//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(calName)}`,
  ]
  for (const e of events) {
    const end = e.end ?? new Date(e.start.getTime() + 30 * 60000)
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${utc(e.start)}`,
      `DTEND:${utc(end)}`,
      `SUMMARY:${esc(e.title)}`,
    )
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`)
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`)
    if (e.url) lines.push(`URL:${e.url}`)
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

export function googleCalendarUrl(e: {
  title: string
  start: Date
  end?: Date
  description?: string
  location?: string
  /** Optional RFC5545 rule, e.g. 'FREQ=WEEKLY;BYDAY=TH' (drifts across DST — prefer ICS). */
  recur?: string
}): string {
  const end = e.end ?? new Date(e.start.getTime() + 30 * 60000)
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${utc(e.start)}/${utc(end)}`,
  })
  if (e.description) p.set('details', e.description)
  if (e.location) p.set('location', e.location)
  if (e.recur) p.set('recur', `RRULE:${e.recur}`)
  return `https://calendar.google.com/calendar/render?${p.toString()}`
}

/** Dated events for the given slots over the next `weeks` weeks (temple-local dates). */
export function slotIcsEvents(
  slots: AartiSlot[],
  temple: HasTimeZone & { id: string; name: string },
  opts: { weeks?: number; now?: Date; description?: string } = {},
): IcsEvent[] {
  const { weeks = 12, now = new Date(), description } = opts
  const from = dateInZone(now, temple.timezone)
  return slotOccurrences(slots, temple, from, weeks * 7)
    .filter((o) => o.instant > now)
    .map((o) => ({
      uid: `${o.slot.id}-${o.date}@saibaba.platform`,
      title: `${o.slot.name} — ${temple.name}`,
      start: o.instant,
      end: new Date(o.instant.getTime() + o.slot.durationMin * 60000),
      description,
      location: temple.name,
    }))
}
