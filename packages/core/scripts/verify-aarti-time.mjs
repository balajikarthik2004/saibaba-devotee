// Dev-only check of features/aarti/time.ts (DST, zones, next-aarti, ICS). Not shipped.
// Usage: node packages/core/scripts/verify-aarti-time.mjs
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const ts = require(require.resolve('typescript', { paths: [here, process.cwd()] }))
const out = mkdtempSync(join(tmpdir(), 'aarti-'))

function load(file, patch = (s) => s) {
  const src = patch(readFileSync(join(here, '../src/features/aarti', file), 'utf8'))
  const js = ts.transpileModule(src, { compilerOptions: { module: 'esnext', target: 'es2022' } }).outputText
  const p = join(out, file.replace('.ts', '.mjs'))
  writeFileSync(p, js)
  return p
}
const timePath = load('time.ts', (s) =>
  s.replace(/import \{ currentTemple \} from '..\/..\/tenant'/, "const currentTemple = () => ({ timezone: 'UTC' })"),
)
const icsPath = load('ics.ts', (s) => s.replace("from './time'", `from '${pathToFileURL(timePath).href}'`))
const T = await import(pathToFileURL(timePath).href)
const I = await import(pathToFileURL(icsPath).href)

const iso = (d) => d.toISOString()
let n = 0
const eq = (a, b, m) => (assert.equal(a, b, m), n++)

// Plain offsets
eq(T.tzOffsetMinutes(Date.UTC(2026, 6, 1, 12), 'America/Chicago'), -300, 'Chicago CDT')
eq(T.tzOffsetMinutes(Date.UTC(2026, 0, 1, 12), 'America/Chicago'), -360, 'Chicago CST')
eq(T.tzOffsetMinutes(Date.UTC(2026, 0, 1, 12), 'Asia/Kolkata'), 330, 'IST')
eq(T.tzOffsetMinutes(Date.UTC(2026, 6, 1, 12), 'Europe/London'), 60, 'BST')

// Slot -> instant
eq(iso(T.slotToInstant({ time: '18:30' }, 'America/Chicago', '2026-07-01')), '2026-07-01T23:30:00.000Z', 'Houston summer')
eq(iso(T.slotToInstant({ time: '18:30' }, 'America/Chicago', '2026-01-15')), '2026-01-16T00:30:00.000Z', 'Houston winter')
eq(iso(T.slotToInstant({ time: '05:15' }, 'Asia/Kolkata', '2026-09-30')), '2026-09-30T23:45:00.000Z'.replace('30T23', '29T23'), 'Pune')

// US spring forward 2026-03-08 (02:00 -> 03:00 Chicago). 06:00 CDT = 11:00Z, day before 06:00 CST = 12:00Z
eq(iso(T.slotToInstant({ time: '06:00' }, 'America/Chicago', '2026-03-07')), '2026-03-07T12:00:00.000Z')
eq(iso(T.slotToInstant({ time: '06:00' }, 'America/Chicago', '2026-03-08')), '2026-03-08T11:00:00.000Z')
// Gap: 02:30 on 2026-03-08 does not exist -> resolves forward to 03:30 CDT = 08:30Z
eq(iso(T.slotToInstant({ time: '02:30' }, 'America/Chicago', '2026-03-08')), '2026-03-08T08:30:00.000Z', 'gap')
// US fall back 2026-11-01 (02:00 -> 01:00). 01:30 is ambiguous -> first (CDT, 06:30Z)
eq(iso(T.slotToInstant({ time: '01:30' }, 'America/Chicago', '2026-11-01')), '2026-11-01T06:30:00.000Z', 'overlap')
eq(iso(T.slotToInstant({ time: '20:30' }, 'America/Chicago', '2026-11-01')), '2026-11-02T02:30:00.000Z', 'after fall back')
// UK fall back 2026-10-25, spring 2026-03-29
eq(iso(T.slotToInstant({ time: '06:00' }, 'Europe/London', '2026-03-29')), '2026-03-29T05:00:00.000Z', 'UK spring')
eq(iso(T.slotToInstant({ time: '06:00' }, 'Europe/London', '2026-10-25')), '2026-10-25T06:00:00.000Z', 'UK fall')
// Mismatched DST weeks: Toronto vs London (US changes before UK)
eq(iso(T.slotToInstant({ time: '12:00' }, 'America/Toronto', '2026-03-10')), '2026-03-10T16:00:00.000Z')
// Southern-hemisphere / half-hour zone sanity
eq(iso(T.slotToInstant({ time: '12:00' }, 'Australia/Lord_Howe', '2026-01-10')), '2026-01-10T01:00:00.000Z', 'Lord Howe DST 30min')

// dates
eq(T.addDaysIso('2026-12-31', 1), '2027-01-01')
eq(T.weekdayOfIso('2026-09-24'), 4, 'Thursday')
eq(T.dateInZone(new Date('2026-09-30T02:00:00Z'), 'America/Chicago'), '2026-09-29')

// nextAarti
const mk = (key, time, days = [0, 1, 2, 3, 4, 5, 6], dur = 30) => ({ id: key, templeId: 't', key, name: key, time, days, durationMin: dur, description: '', active: true, sponsorable: false })
const slots = [mk('kakad', '06:00'), mk('dhoop', '18:30'), mk('special', '19:30', [4])]
const temple = { timezone: 'America/Chicago' }
// Wed 2026-09-30 19:00 CDT = 00:00Z Oct 1 -> next = kakad Thu 06:00
let nx = T.nextAarti(slots, temple, new Date('2026-10-01T00:00:00Z'))
eq(nx.slot.key, 'kakad'); eq(nx.date, '2026-10-01')
// Thu 2026-10-01 18:45 CDT after dhoop -> special 19:30
nx = T.nextAarti(slots, temple, new Date('2026-10-01T23:45:00Z'))
eq(nx.slot.key, 'special')
// Sat after 18:30 -> kakad on Sunday
nx = T.nextAarti(slots, temple, new Date('2026-10-04T00:00:00Z')) // Sat 19:00 CDT
eq(nx.slot.key, 'kakad'); eq(nx.date, '2026-10-04')
// Across a DST change, the wall clock stays 06:00
nx = T.nextAarti([mk('kakad', '06:00')], temple, new Date('2026-03-08T00:00:00Z'))
eq(iso(nx.instant), '2026-03-08T11:00:00.000Z')
eq(T.nextAarti([{ ...mk('x', '06:00'), active: false }], temple, new Date()), null)

// isLiveWindow (dhoop 18:30 Chicago, 30min): 18:20 live, 19:01 not, 18:19 not
const dh = mk('dhoop', '18:30')
eq(T.isLiveWindow(dh, new Date('2026-07-01T23:20:00Z'), 'America/Chicago'), true)
eq(T.isLiveWindow(dh, new Date('2026-07-01T23:19:00Z'), 'America/Chicago'), false)
eq(T.isLiveWindow(dh, new Date('2026-07-02T00:01:00Z'), 'America/Chicago'), false)
// spills past midnight
const late = mk('shej', '23:45', undefined, 60)
eq(T.isLiveWindow(late, new Date('2026-07-02T05:10:00Z'), 'America/Chicago'), true, 'past midnight')

// timeUntil
eq(T.timeUntil(new Date(8073000 + 1000), new Date(1000)).clock, '02:14:33')
eq(T.timeUntil(new Date(0), new Date(5000)).clock, '00:00:00')

// formatting
eq(T.formatInViewerTz(new Date('2026-07-01T23:30:00Z'), { timeZone: 'America/Chicago', locale: 'en-US' }).replace(/\s/g, ' '), '6:30 PM')
eq(T.zonesDiffer(new Date('2026-07-01T23:30:00Z'), 'America/Chicago', 'America/New_York'), true)
eq(T.zonesDiffer(new Date('2026-07-01T23:30:00Z'), 'America/Chicago', 'America/Chicago'), false)

// ICS
const ics = I.buildIcs([{ uid: 'a@x', title: 'Dhoop, Aarti; "test"', start: new Date('2026-07-01T23:30:00Z'), end: new Date('2026-07-02T00:00:00Z'), description: 'x'.repeat(200) + '\nline2', location: 'Temple' }])
assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'))
assert.ok(ics.includes('DTSTART:20260701T233000Z') && ics.includes('DTEND:20260702T000000Z'))
assert.ok(ics.includes('SUMMARY:Dhoop\\, Aarti\\; "test"'))
for (const l of ics.split('\r\n')) assert.ok(new TextEncoder().encode(l).length <= 75, 'fold: ' + l.length)
assert.ok(!/VTIMEZONE|TZID/.test(ics))
n += 5
const g = I.googleCalendarUrl({ title: 'Dhoop', start: new Date('2026-07-01T23:30:00Z') })
assert.ok(g.includes('dates=20260701T233000Z%2F20260702T000000Z')); n++
const evs = I.slotIcsEvents(slots, { timezone: 'America/Chicago', id: 't', name: 'Temple' }, { weeks: 2, now: new Date('2026-03-01T00:00:00Z') })
eq(evs.length, 29, 'two weeks of events')

console.log(`aarti time: ${n} checks passed`)
