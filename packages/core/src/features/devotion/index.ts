/**
 * Devotion slice — Thursday vrat, Sai Satcharitra parayan, teachings & daily message.
 *
 * Mock API in the house style: `simulateLatency()`, in-memory arrays, user/admin-authored
 * changes mirrored to localStorage (`saibaba:devotion:*`) and hydrated on load. Seeds are
 * deterministic and their dates follow the clock so progress screens are never empty.
 *
 * Note on names: group functions are prefixed (`listParayanGroups`, `joinParayanGroup` …)
 * so they cannot collide with the community slice's own group API under `export *`.
 */
import { simulateLatency, getPujaCatalog } from '../../api'
import { currentTempleId } from '../../tenant'
import { USERS } from '../../mock'
import type {
  DailyMessage,
  ISODate,
  LanguageCode,
  Leela,
  NotifyChannel,
  ParayanEnrollment,
  ParayanGroup,
  ParayanPlan,
  SaiAssurance,
  UUID,
  VratEnrollment,
  VratProgram,
} from '../../types'
import {
  addDaysISO,
  diffDays,
  nextWeekdayOnOrAfter,
  parseISODate,
  todayISO,
  toISODate,
  weekdayBefore,
  weekdayOf,
} from './dates'
import { makeCollection, newId } from './store'
import { rebalance, splitChapters, TOTAL_CHAPTERS } from './split'
import { ASSURANCE_SEED, PARAYAN_PLAN_SEED, VRAT_PROGRAM_SEED } from './content-programs'
import { LEELA_SEED } from './content-leelas'
import { DAILY_MESSAGE_BANK } from './content-messages'

export { TOTAL_CHAPTERS }
/** Day-precision helpers, namespaced so they cannot collide with other slices' exports. */
export const devotionDates = {
  todayISO,
  addDaysISO,
  diffDays,
  toISODate,
  parseISODate,
  weekdayOf,
  nextWeekdayOnOrAfter,
}

const K = {
  vrat: 'saibaba:devotion:vrat-enrollments',
  parayan: 'saibaba:devotion:parayan-enrollments',
  groups: 'saibaba:devotion:parayan-groups',
  leelas: 'saibaba:devotion:leelas',
  messages: 'saibaba:devotion:daily-messages',
} as const

const clone = <T>(x: T): T => structuredClone(x)
const FLAGSHIP = 'tmp_sugarland'
const userName = (id: UUID) => USERS.find((u) => u.id === id)?.name ?? 'Devotee'

/* ====================================================================== types */

/** A vrat enrolment plus the bookkeeping the tracker needs. Assignable to `VratEnrollment`. */
export interface VratEnrollmentEx extends VratEnrollment {
  /** Observance dates that were recorded late (within the catch-up window). */
  catchUpOn: ISODate[]
  pausedOn?: ISODate
  /** Thursdays before this date are not counted as missed (set when a pause is resumed). */
  missCountFrom?: ISODate
}

export interface VratProgress {
  /** The week the devotee is on (1-based, capped at `total`). */
  weekIndex: number
  total: number
  observed: number
  missed: number
  /** The next Thursday still to be observed; null once complete. */
  nextDate: ISODate | null
  isTodayObservanceDay: boolean
  todayObserved: boolean
  completed: boolean
  /** Consecutive observed Thursdays ending at the latest Thursday. */
  streak: number
  /** A recent unobserved Thursday that can still be recorded as a catch-up. */
  catchUpDate: ISODate | null
  /** The scheduled Thursday for each week, week 1 first, extended if weeks were missed. */
  dates: ISODate[]
}

/** How many days after a Thursday a late check-in is still accepted. */
export const VRAT_CATCH_UP_DAYS = 3

export interface VratEnrollmentRow {
  enrollment: VratEnrollmentEx
  program: VratProgram
  userName: string
  progress: VratProgress
}

export interface ParayanProgress {
  /** Chapters in scope: 51, or the member's own share in a group. */
  total: number
  read: number
  pct: number
  /** 1-based day of the plan today; 0 before it starts. Null for the open-pace plan. */
  dayNumber: number | null
  todaysChapters: number[]
  todaysRemaining: number[]
  /** Scheduled for an earlier day but not yet read. */
  overdue: number[]
  nextUnread: number | null
  completed: boolean
  /** Null outside a group. */
  assigned: number[] | null
}

export interface ParayanGroupMember {
  userId: UUID
  name: string
  chapters: number[]
  read: number[]
  pct: number
}

export interface ParayanGroupView {
  group: ParayanGroup
  members: ParayanGroupMember[]
  readCount: number
  pct: number
}

/* ================================================================ vrat: seed */

const enrolId = (n: number) => `venr_${String(n).padStart(4, '0')}`

function seedVrat(): VratEnrollmentEx[] {
  const t = todayISO()
  const lastThu = weekdayBefore(t, 4)
  const nextThu = nextWeekdayOnOrAfter(t, 4)
  // observed/missed describe the past Thursdays since start, oldest first; missed ones are
  // spread from the front so the recent weeks are the observed ones.
  const make = (
    n: number,
    userId: UUID,
    programId: UUID,
    observed: number,
    missedAt: number[],
    opts: {
      status?: VratEnrollment['status']
      intention?: string
      channels?: NotifyChannel[]
      templeId?: string
    } = {},
  ): VratEnrollmentEx => {
    const past = observed + missedAt.length
    const start = past === 0 ? nextThu : addDaysISO(lastThu, -7 * (past - 1))
    const observedOn: ISODate[] = []
    for (let i = 0; i < past; i++) if (!missedAt.includes(i)) observedOn.push(addDaysISO(start, 7 * i))
    const status = opts.status ?? 'active'
    const program = VRAT_PROGRAM_SEED.find((p) => p.id === programId)!
    const done = observedOn.length >= program.weeks
    return {
      id: enrolId(n),
      userId,
      templeId: opts.templeId ?? FLAGSHIP,
      programId,
      startDate: start,
      intention: opts.intention,
      observedOn,
      status: done && status === 'completed' ? 'completed' : status,
      completedAt: status === 'completed' ? (observedOn[observedOn.length - 1] ?? t) : undefined,
      reminderChannels: opts.channels ?? ['email'],
      createdAt: addDaysISO(start, -1),
      catchUpOn: [],
      pausedOn: status === 'paused' ? addDaysISO(t, -4) : undefined,
    }
  }
  return [
    make(1, 'usr_0001', 'vrat_nine', 4, [], {
      intention: 'Peace at home and good health for my parents.',
      channels: ['email', 'whatsapp'],
    }),
    make(2, 'usr_0002', 'vrat_nine', 6, [], { intention: 'Gratitude.', channels: ['sms'] }),
    make(3, 'usr_0003', 'vrat_nine', 8, [], { intention: 'A steady mind for my exams.' }),
    make(4, 'usr_0004', 'vrat_eleven', 4, [1], { channels: ['email', 'push'] }),
    make(5, 'usr_0005', 'vrat_nine', 9, [], { status: 'completed', intention: 'Thanksgiving.' }),
    make(6, 'usr_0006', 'vrat_nine', 2, [], { status: 'paused' }),
    make(7, 'usr_0007', 'vrat_nine', 0, [], { channels: ['whatsapp'] }),
    make(8, 'usr_0008', 'vrat_nine', 5, [0, 2], { intention: 'Guidance in a hard season.' }),
    make(9, 'usr_0009', 'vrat_eleven', 11, [], { intention: 'For my family’s wellbeing.' }),
    make(10, 'usr_0010', 'vrat_nine', 2, [0, 1, 2], { status: 'abandoned' }),
    make(11, 'usr_0011', 'vrat_nine', 3, [], { templeId: 'tmp_fremont', channels: ['email'] }),
    make(12, 'usr_0012', 'vrat_eleven', 1, [], { templeId: 'tmp_fremont' }),
  ]
}

const vratPrograms = makeCollection<VratProgram>('saibaba:devotion:vrat-programs', VRAT_PROGRAM_SEED)
const vratEnrollments = makeCollection<VratEnrollmentEx>(K.vrat, seedVrat())

/* ============================================================ vrat: progress */

export function getVratProgress(e: VratEnrollment): VratProgress {
  const program = vratPrograms.get(e.programId) ?? VRAT_PROGRAM_SEED[0]!
  const wd = program.weekday
  const ex = e as VratEnrollmentEx
  const t = todayISO()
  const observedSet = new Set(e.observedOn)
  const observed = observedSet.size
  const total = program.weeks
  const completed = observed >= total

  // The count frozen at a pause, or at the final observed date, rather than running on.
  const cutoffBase = e.status === 'paused' && ex.pausedOn ? ex.pausedOn : t
  const lastObserved = [...observedSet].sort().pop()
  const countUntil = completed && lastObserved ? addDaysISO(lastObserved, 1) : cutoffBase
  const from = ex.missCountFrom && ex.missCountFrom > e.startDate ? ex.missCountFrom : e.startDate
  let missed = 0
  for (let d = e.startDate; d < countUntil; d = addDaysISO(d, 7)) {
    if (d >= from && !observedSet.has(d)) missed++
  }

  const isToday = weekdayOf(t) === wd && t >= e.startDate
  const todayObserved = observedSet.has(t)
  let nextDate: ISODate | null = null
  if (!completed) {
    if (t < e.startDate) nextDate = e.startDate
    else if (isToday && !todayObserved) nextDate = t
    else nextDate = nextWeekdayOnOrAfter(addDaysISO(t, 1), wd)
  }

  // Streak: back from the latest Thursday that has had its chance.
  let probe = isToday && !todayObserved ? addDaysISO(t, -7) : isToday ? t : weekdayBefore(t, wd)
  let streak = 0
  while (probe >= e.startDate && observedSet.has(probe)) {
    streak++
    probe = addDaysISO(probe, -7)
  }

  let catchUpDate: ISODate | null = null
  if (!completed && e.status === 'active') {
    const prev = weekdayBefore(t, wd)
    if (
      prev >= e.startDate &&
      !observedSet.has(prev) &&
      diffDays(prev, t) <= VRAT_CATCH_UP_DAYS &&
      prev >= from
    )
      catchUpDate = prev
  }

  // Display dates: week 1 first; if weeks were missed, later weeks simply follow.
  const dates: ISODate[] = []
  const scheduled = Math.max(total, 0)
  for (let i = 0; i < scheduled; i++) dates.push(addDaysISO(e.startDate, 7 * i))

  return {
    weekIndex: Math.min(observed + 1, total),
    total,
    observed,
    missed,
    nextDate,
    isTodayObservanceDay: isToday,
    todayObserved,
    completed,
    streak,
    catchUpDate,
    dates,
  }
}

/* ================================================================== vrat: API */

export async function listVratPrograms(): Promise<VratProgram[]> {
  await simulateLatency()
  return clone(vratPrograms.all())
}

export async function getVratProgram(id: UUID): Promise<VratProgram | null> {
  await simulateLatency()
  const p = vratPrograms.get(id)
  return p ? clone(p) : null
}

export async function enrollInVrat(input: {
  userId: UUID
  programId: UUID
  startDate: ISODate
  intention?: string
  reminderChannels: NotifyChannel[]
}): Promise<VratEnrollmentEx> {
  await simulateLatency()
  const program = vratPrograms.get(input.programId)
  if (!program) throw new Error('Unknown vrat programme')
  const already = vratEnrollments
    .all()
    .find(
      (e) =>
        e.userId === input.userId &&
        e.programId === input.programId &&
        (e.status === 'active' || e.status === 'paused'),
    )
  if (already) throw new Error('You already have this vrat in progress.')
  const t = todayISO()
  const wanted = input.startDate && input.startDate > t ? input.startDate : t
  const startDate = nextWeekdayOnOrAfter(wanted, program.weekday)
  const e: VratEnrollmentEx = {
    id: newId('venr'),
    userId: input.userId,
    templeId: currentTempleId(),
    programId: program.id,
    startDate,
    intention: input.intention?.trim() || undefined,
    observedOn: [],
    status: 'active',
    reminderChannels: [...input.reminderChannels],
    createdAt: t,
    catchUpOn: [],
  }
  return clone(vratEnrollments.add(e))
}

export async function listMyVrats(userId: UUID): Promise<VratEnrollmentEx[]> {
  await simulateLatency()
  return clone(vratEnrollments.all().filter((e) => e.userId === userId))
}

export async function getVratEnrollment(id: UUID): Promise<VratEnrollmentEx | null> {
  await simulateLatency()
  const e = vratEnrollments.get(id)
  return e ? clone(e) : null
}

function mustVrat(id: UUID): VratEnrollmentEx {
  const e = vratEnrollments.get(id)
  if (!e) throw new Error('Vrat enrolment not found')
  return e
}

/**
 * Record a Thursday as observed. Idempotent. Only the programme weekday, not before the
 * start and not in the future. A past Thursday is accepted only as a catch-up
 * (`opts.catchUp`) within `VRAT_CATCH_UP_DAYS`; otherwise the count simply continues.
 */
export async function checkInVrat(
  enrollmentId: UUID,
  date: ISODate = todayISO(),
  opts: { catchUp?: boolean } = {},
): Promise<VratEnrollmentEx> {
  await simulateLatency()
  const e = mustVrat(enrollmentId)
  const program = vratPrograms.get(e.programId)!
  if (e.status !== 'active') throw new Error('Resume the vrat before checking in.')
  if (e.observedOn.includes(date)) return clone(e)
  if (e.observedOn.length >= program.weeks) return clone(e)
  const t = todayISO()
  if (weekdayOf(date) !== program.weekday) throw new Error('This vrat is observed on Thursdays.')
  if (date < e.startDate) throw new Error('That is before your start date.')
  if (date > t) throw new Error('You can check in on the day itself.')
  const late = date < t
  if (late && !opts.catchUp) throw new Error('That Thursday has passed. Use catch-up to record it.')
  if (late && diffDays(date, t) > VRAT_CATCH_UP_DAYS)
    throw new Error('Too late to record that Thursday. Your count simply continues next Thursday.')
  const next: VratEnrollmentEx = {
    ...e,
    observedOn: [...e.observedOn, date].sort(),
    catchUpOn: late ? [...e.catchUpOn, date] : e.catchUpOn,
  }
  return clone(vratEnrollments.replace(next))
}

export async function updateVratReminders(
  enrollmentId: UUID,
  channels: NotifyChannel[],
): Promise<VratEnrollmentEx> {
  await simulateLatency()
  return clone(vratEnrollments.replace({ ...mustVrat(enrollmentId), reminderChannels: [...channels] }))
}

export async function pauseVrat(enrollmentId: UUID): Promise<VratEnrollmentEx> {
  await simulateLatency()
  const e = mustVrat(enrollmentId)
  if (e.status !== 'active') return clone(e)
  return clone(vratEnrollments.replace({ ...e, status: 'paused', pausedOn: todayISO() }))
}

export async function resumeVrat(enrollmentId: UUID): Promise<VratEnrollmentEx> {
  await simulateLatency()
  const e = mustVrat(enrollmentId)
  if (e.status !== 'paused') return clone(e)
  return clone(
    vratEnrollments.replace({ ...e, status: 'active', pausedOn: undefined, missCountFrom: todayISO() }),
  )
}

export async function abandonVrat(enrollmentId: UUID): Promise<VratEnrollmentEx> {
  await simulateLatency()
  return clone(vratEnrollments.replace({ ...mustVrat(enrollmentId), status: 'abandoned' }))
}

export interface VratCompletion {
  enrollment: VratEnrollmentEx
  udyapanGuidance: string
  /** Id of a catalogue puja named 'Sai Vratam Udyapan', when the temple offers one. */
  suggestedPujaId: UUID | null
  suggestedPujaName: string | null
}

export async function completeVrat(enrollmentId: UUID): Promise<VratCompletion> {
  await simulateLatency()
  const e = mustVrat(enrollmentId)
  const program = vratPrograms.get(e.programId)!
  if (getVratProgress(e).observed < program.weeks) throw new Error('Not all weeks are observed yet.')
  const done =
    e.status === 'completed'
      ? e
      : vratEnrollments.replace({ ...e, status: 'completed', completedAt: todayISO() })
  const catalog = await getPujaCatalog()
  const puja = catalog.find((p) => /sai\s+vratam\s+udyapan/i.test(p.name))
  return {
    enrollment: clone(done),
    udyapanGuidance: program.udyapanGuidance,
    suggestedPujaId: puja?.id ?? null,
    suggestedPujaName: puja?.name ?? null,
  }
}

/* admin */

export async function listVratEnrollments(
  filters: { programId?: UUID; status?: VratEnrollment['status']; q?: string; templeId?: UUID } = {},
): Promise<VratEnrollmentRow[]> {
  await simulateLatency()
  const temple = filters.templeId ?? currentTempleId()
  const q = filters.q?.trim().toLowerCase()
  return vratEnrollments
    .all()
    .filter((e) => e.templeId === temple)
    .filter((e) => !filters.programId || e.programId === filters.programId)
    .filter((e) => !filters.status || e.status === filters.status)
    .filter((e) => !q || userName(e.userId).toLowerCase().includes(q))
    .map((e) => ({
      enrollment: clone(e),
      program: clone(vratPrograms.get(e.programId)!),
      userName: userName(e.userId),
      progress: getVratProgress(e),
    }))
    .sort((a, b) => b.enrollment.createdAt.localeCompare(a.enrollment.createdAt))
}

export interface VratStats {
  total: number
  active: number
  paused: number
  completed: number
  abandoned: number
  completionRate: number
  avgProgressPct: number
  observedThisWeek: number
  needingNudge: number
  byProgram: { programId: UUID; name: string; enrolled: number; completed: number }[]
}

export async function vratStats(templeId?: UUID): Promise<VratStats> {
  await simulateLatency()
  const temple = templeId ?? currentTempleId()
  const rows = vratEnrollments.all().filter((e) => e.templeId === temple)
  const t = todayISO()
  const weekStart = addDaysISO(t, -6)
  const count = (s: VratEnrollment['status']) => rows.filter((r) => r.status === s).length
  const pcts = rows
    .filter((r) => r.status !== 'abandoned')
    .map((r) => {
      const p = getVratProgress(r)
      return (Math.min(p.observed, p.total) / p.total) * 100
    })
  const live = rows.filter((r) => r.status === 'active')
  return {
    total: rows.length,
    active: count('active'),
    paused: count('paused'),
    completed: count('completed'),
    abandoned: count('abandoned'),
    completionRate: rows.length ? Math.round((count('completed') / rows.length) * 100) : 0,
    avgProgressPct: pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0,
    observedThisWeek: rows.reduce((n, r) => n + r.observedOn.filter((d) => d >= weekStart && d <= t).length, 0),
    needingNudge: live.filter((r) => getVratProgress(r).missed >= 2).length,
    byProgram: vratPrograms.all().map((p) => {
      const mine = rows.filter((r) => r.programId === p.id)
      return {
        programId: p.id,
        name: p.name,
        enrolled: mine.length,
        completed: mine.filter((r) => r.status === 'completed').length,
      }
    }),
  }
}

/* ============================================================ parayan: seed */

const parayanPlans = makeCollection<ParayanPlan>('saibaba:devotion:parayan-plans', PARAYAN_PLAN_SEED)
const rangeOf = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)

const GROUP_A = splitChapters(4)
const GROUP_B = splitChapters(6)

function seedGroups(): ParayanGroup[] {
  const t = todayISO()
  const mk = (
    id: string,
    name: string,
    description: string,
    start: string,
    members: UUID[],
    split: number[][],
    by: UUID,
    templeId = FLAGSHIP,
  ): ParayanGroup => ({
    id,
    templeId,
    name,
    description,
    startDate: start,
    assignments: members.map((userId, i) => ({ userId, name: userName(userId), chapters: split[i]! })),
    createdByUserId: by,
    createdAt: addDaysISO(start, -2),
  })
  return [
    mk(
      'pgrp_0001',
      'Family Thursday Parayan',
      'Our family reads the Satcharitra together, each taking a share, and finishes with aarti on Thursday.',
      addDaysISO(t, -5),
      ['usr_0001', 'usr_0002', 'usr_0003', 'usr_0004'],
      GROUP_A,
      'usr_0001',
    ),
    mk(
      'pgrp_0002',
      'Temple Community Saptah',
      'An open community parayan: six volunteers, one complete reading.',
      addDaysISO(t, -2),
      ['usr_0005', 'usr_0006', 'usr_0007', 'usr_0008', 'usr_0009', 'usr_0010'],
      GROUP_B,
      'usr_0005',
    ),
  ]
}

function seedParayan(groups: ParayanGroup[]): ParayanEnrollment[] {
  const t = todayISO()
  const out: ParayanEnrollment[] = []
  let n = 1
  const add = (
    userId: UUID,
    planId: UUID,
    startAgo: number,
    chaptersRead: number[],
    extra: Partial<ParayanEnrollment> = {},
  ) =>
    out.push({
      id: `penr_${String(n++).padStart(4, '0')}`,
      userId,
      planId,
      templeId: FLAGSHIP,
      startDate: addDaysISO(t, -startAgo),
      chaptersRead,
      status: 'active',
      createdAt: addDaysISO(t, -startAgo),
      ...extra,
    })
  add('usr_0001', 'parayan_saptah', 3, [...rangeOf(1, 15), ...rangeOf(16, 20)])
  add('usr_0002', 'parayan_daily', 20, rangeOf(1, 18))
  add('usr_0003', 'parayan_custom', 30, [1, 2, 3, 5, 8, 13, 21, 34, 40])
  add('usr_0011', 'parayan_saptah', 12, rangeOf(1, 51), { status: 'completed' })
  add('usr_0012', 'parayan_saptah', 2, rangeOf(1, 14))
  // Group members: each has read part of their own share.
  const progressByIdx = [0.6, 0.35, 0.0, 0.8]
  const progressB = [0.5, 0.25, 0.0, 0.4, 0.0, 0.0]
  for (const g of groups) {
    g.assignments.forEach((a, i) => {
      const frac = (g.id === 'pgrp_0001' ? progressByIdx : progressB)[i] ?? 0
      const read = a.chapters.slice(0, Math.round(a.chapters.length * frac))
      add(a.userId, 'parayan_custom', diffDays(g.startDate, t), read, {
        groupId: g.id,
        startDate: g.startDate,
      })
    })
  }
  return out
}

const parayanGroups = makeCollection<ParayanGroup>(K.groups, seedGroups())
const parayanEnrollments = makeCollection<ParayanEnrollment>(K.parayan, seedParayan(seedGroups()))

/* ========================================================== parayan: progress */

export function parayanProgress(e: ParayanEnrollment): ParayanProgress {
  const plan = parayanPlans.get(e.planId) ?? PARAYAN_PLAN_SEED[2]!
  const group = e.groupId ? parayanGroups.get(e.groupId) : undefined
  const assigned = group?.assignments.find((a) => a.userId === e.userId)?.chapters ?? null
  const scope = assigned ?? rangeOf(1, TOTAL_CHAPTERS)
  const readSet = new Set(e.chaptersRead.filter((c) => scope.includes(c)))
  const read = readSet.size
  const total = scope.length
  const unread = scope.filter((c) => !readSet.has(c))
  const t = todayISO()
  const open = plan.days === 0 || !!assigned
  const dayNumber = open ? null : Math.max(0, diffDays(e.startDate, t) + 1)
  let todaysChapters: number[] = []
  let overdue: number[] = []
  if (dayNumber !== null && dayNumber > 0) {
    const today = plan.schedule.find((s) => s.day === dayNumber)
    todaysChapters = today?.chapters ?? []
    const earlier = new Set(plan.schedule.filter((s) => s.day < dayNumber).flatMap((s) => s.chapters))
    overdue = unread.filter((c) => earlier.has(c))
  }
  return {
    total,
    read,
    pct: total ? Math.round((read / total) * 100) : 0,
    dayNumber,
    todaysChapters,
    todaysRemaining: todaysChapters.filter((c) => !readSet.has(c)),
    overdue,
    nextUnread: unread[0] ?? null,
    completed: total > 0 && read >= total,
    assigned,
  }
}

/* ============================================================= parayan: API */

export async function listParayanPlans(): Promise<ParayanPlan[]> {
  await simulateLatency()
  return clone(parayanPlans.all())
}

export async function getParayanPlan(id: UUID): Promise<ParayanPlan | null> {
  await simulateLatency()
  const p = parayanPlans.get(id)
  return p ? clone(p) : null
}

export async function enrollInParayan(input: {
  userId: UUID
  planId: UUID
  startDate?: ISODate
}): Promise<ParayanEnrollment> {
  await simulateLatency()
  const plan = parayanPlans.get(input.planId)
  if (!plan) throw new Error('Unknown parayan plan')
  const mine = parayanEnrollments
    .all()
    .find((e) => e.userId === input.userId && e.planId === plan.id && !e.groupId && e.status !== 'completed')
  if (mine) throw new Error('You are already reading this plan.')
  const t = todayISO()
  const e: ParayanEnrollment = {
    id: newId('penr'),
    userId: input.userId,
    planId: plan.id,
    templeId: currentTempleId(),
    startDate: input.startDate && input.startDate > t ? input.startDate : t,
    chaptersRead: [],
    status: 'active',
    createdAt: t,
  }
  return clone(parayanEnrollments.add(e))
}

export async function listMyParayan(userId: UUID): Promise<ParayanEnrollment[]> {
  await simulateLatency()
  return clone(parayanEnrollments.all().filter((e) => e.userId === userId))
}

export async function getParayanEnrollment(id: UUID): Promise<ParayanEnrollment | null> {
  await simulateLatency()
  const e = parayanEnrollments.get(id)
  return e ? clone(e) : null
}

/** Mark (or, with `read: false`, unmark) a chapter. Idempotent. */
export async function markChapterRead(
  enrollmentId: UUID,
  chapter: number,
  read = true,
): Promise<ParayanEnrollment> {
  await simulateLatency()
  const e = parayanEnrollments.get(enrollmentId)
  if (!e) throw new Error('Parayan enrolment not found')
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > TOTAL_CHAPTERS)
    throw new Error('Chapter must be between 1 and 51')
  const assigned = parayanProgress(e).assigned
  if (assigned && !assigned.includes(chapter)) throw new Error('That chapter belongs to another member.')
  const set = new Set(e.chaptersRead)
  if (read) set.add(chapter)
  else set.delete(chapter)
  const next: ParayanEnrollment = { ...e, chaptersRead: [...set].sort((a, b) => a - b) }
  next.status = parayanProgress(next).completed ? 'completed' : e.status === 'completed' ? 'active' : e.status
  return clone(parayanEnrollments.replace(next))
}

/* groups */

function groupEnrollment(groupId: UUID, userId: UUID) {
  return parayanEnrollments.all().find((e) => e.groupId === groupId && e.userId === userId)
}

function rebalanceGroup(group: ParayanGroup): ParayanGroup {
  const split = rebalance(
    group.assignments.map((a) => ({
      key: a.userId,
      assigned: a.chapters,
      read: groupEnrollment(group.id, a.userId)?.chaptersRead ?? [],
    })),
  )
  return { ...group, assignments: group.assignments.map((a) => ({ ...a, chapters: split[a.userId] ?? [] })) }
}

export async function createParayanGroup(input: {
  name: string
  startDate: ISODate
  description: string
  memberUserIds: UUID[]
  createdByUserId?: UUID
  templeId?: UUID
}): Promise<ParayanGroup> {
  await simulateLatency()
  const creator = input.createdByUserId ?? input.memberUserIds[0] ?? 'usr_admin'
  const members = [...new Set(input.memberUserIds)]
  if (members.length === 0) throw new Error('Add at least one member.')
  const split = splitChapters(members.length)
  const t = todayISO()
  const group: ParayanGroup = {
    id: newId('pgrp'),
    templeId: input.templeId ?? currentTempleId(),
    name: input.name.trim() || 'Parayan group',
    description: input.description.trim(),
    startDate: input.startDate && input.startDate > t ? input.startDate : t,
    assignments: members.map((userId, i) => ({ userId, name: userName(userId), chapters: split[i]! })),
    createdByUserId: creator,
    createdAt: t,
  }
  parayanGroups.add(group)
  for (const userId of members) {
    parayanEnrollments.add({
      id: newId('penr'),
      userId,
      planId: 'parayan_custom',
      templeId: group.templeId,
      startDate: group.startDate,
      chaptersRead: [],
      groupId: group.id,
      status: 'active',
      createdAt: t,
    })
  }
  return clone(group)
}

export async function joinParayanGroup(groupId: UUID, userId: UUID, name?: string): Promise<ParayanGroup> {
  await simulateLatency()
  const g = parayanGroups.get(groupId)
  if (!g) throw new Error('Group not found')
  if (g.assignments.some((a) => a.userId === userId)) return clone(g)
  const t = todayISO()
  parayanEnrollments.add({
    id: newId('penr'),
    userId,
    planId: 'parayan_custom',
    templeId: g.templeId,
    startDate: g.startDate < t ? t : g.startDate,
    chaptersRead: [],
    groupId,
    status: 'active',
    createdAt: t,
  })
  const withMember: ParayanGroup = {
    ...g,
    assignments: [...g.assignments, { userId, name: name ?? userName(userId), chapters: [] }],
  }
  return clone(parayanGroups.replace(rebalanceGroup(withMember)))
}

/**
 * Leave a group. The leaver's enrolment is detached and paused; their unread chapters are
 * re-dealt to the others (chapters they had read return to the pool, since the group can
 * no longer vouch for them).
 */
export async function leaveParayanGroup(groupId: UUID, userId: UUID): Promise<ParayanGroup | null> {
  await simulateLatency()
  const g = parayanGroups.get(groupId)
  if (!g) throw new Error('Group not found')
  const mine = groupEnrollment(groupId, userId)
  if (mine) parayanEnrollments.replace({ ...mine, groupId: undefined, status: 'paused' })
  const remaining = g.assignments.filter((a) => a.userId !== userId)
  if (remaining.length === 0) {
    parayanGroups.remove(groupId)
    return null
  }
  return clone(parayanGroups.replace(rebalanceGroup({ ...g, assignments: remaining })))
}

export async function listParayanGroups(templeId?: UUID): Promise<ParayanGroup[]> {
  await simulateLatency()
  return clone(parayanGroups.all().filter((g) => !templeId || g.templeId === templeId))
}

export async function listMyParayanGroups(userId: UUID): Promise<ParayanGroup[]> {
  await simulateLatency()
  return clone(parayanGroups.all().filter((g) => g.assignments.some((a) => a.userId === userId)))
}

export async function getParayanGroup(id: UUID): Promise<ParayanGroupView | null> {
  await simulateLatency()
  const g = parayanGroups.get(id)
  if (!g) return null
  const members = g.assignments.map((a) => {
    const enr = groupEnrollment(g.id, a.userId)
    const read = (enr?.chaptersRead ?? []).filter((c) => a.chapters.includes(c))
    return {
      userId: a.userId,
      name: a.name,
      chapters: [...a.chapters],
      read,
      pct: a.chapters.length ? Math.round((read.length / a.chapters.length) * 100) : 0,
    }
  })
  const readCount = members.reduce((n, m) => n + m.read.length, 0)
  return {
    group: clone(g),
    members,
    readCount,
    pct: Math.round((readCount / TOTAL_CHAPTERS) * 100),
  }
}

/* admin */

export interface ParayanEnrollmentRow {
  enrollment: ParayanEnrollment
  plan: ParayanPlan
  userName: string
  groupName: string | null
  progress: ParayanProgress
}

export async function listParayanEnrollments(
  filters: { planId?: UUID; status?: ParayanEnrollment['status']; q?: string; templeId?: UUID } = {},
): Promise<ParayanEnrollmentRow[]> {
  await simulateLatency()
  const temple = filters.templeId ?? currentTempleId()
  const q = filters.q?.trim().toLowerCase()
  return parayanEnrollments
    .all()
    .filter((e) => (e.templeId ?? temple) === temple)
    .filter((e) => !filters.planId || e.planId === filters.planId)
    .filter((e) => !filters.status || e.status === filters.status)
    .filter((e) => !q || userName(e.userId).toLowerCase().includes(q))
    .map((e) => ({
      enrollment: clone(e),
      plan: clone(parayanPlans.get(e.planId)!),
      userName: userName(e.userId),
      groupName: e.groupId ? (parayanGroups.get(e.groupId)?.name ?? null) : null,
      progress: parayanProgress(e),
    }))
}

export async function parayanStats(templeId?: UUID) {
  await simulateLatency()
  const temple = templeId ?? currentTempleId()
  const rows = parayanEnrollments.all().filter((e) => (e.templeId ?? temple) === temple)
  return {
    total: rows.length,
    active: rows.filter((r) => r.status === 'active').length,
    completed: rows.filter((r) => r.status === 'completed').length,
    groups: parayanGroups.all().filter((g) => g.templeId === temple).length,
    chaptersRead: rows.reduce((n, r) => n + r.chaptersRead.length, 0),
  }
}

/* ============================================================ teachings: API */

const leelas = makeCollection<Leela>(K.leelas, LEELA_SEED)
const messages = makeCollection<DailyMessage>(K.messages, [])

export async function listAssurances(): Promise<SaiAssurance[]> {
  await simulateLatency()
  return clone(ASSURANCE_SEED)
}

export async function listLeelas(theme?: Leela['theme']): Promise<Leela[]> {
  await simulateLatency()
  return clone(
    leelas
      .all()
      .filter((l) => !theme || l.theme === theme)
      .sort((a, b) => Number(b.featured) - Number(a.featured) || a.id.localeCompare(b.id)),
  )
}

export async function getLeela(id: UUID): Promise<Leela | null> {
  await simulateLatency()
  const l = leelas.get(id)
  return l ? clone(l) : null
}

export async function addLeela(input: Omit<Leela, 'id' | 'publishedAt' | 'readMinutes'> & Partial<Pick<Leela, 'readMinutes' | 'publishedAt'>>): Promise<Leela> {
  await simulateLatency()
  const words = input.summary.trim().split(/\s+/).length
  const l: Leela = {
    ...input,
    id: newId('leela'),
    publishedAt: input.publishedAt ?? todayISO(),
    readMinutes: input.readMinutes ?? Math.max(1, Math.round(words / 140)),
  }
  return clone(leelas.add(l))
}

export async function updateLeela(id: UUID, patch: Partial<Omit<Leela, 'id'>>): Promise<Leela> {
  await simulateLatency()
  const l = leelas.get(id)
  if (!l) throw new Error('Leela not found')
  return clone(leelas.replace({ ...l, ...patch }))
}

export async function deleteLeela(id: UUID): Promise<void> {
  await simulateLatency()
  leelas.remove(id)
}

const dayOrdinal = (iso: string) => {
  const d = parseISODate(iso)
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000)
}

/** Synchronous, deterministic pick for a date; admin-scheduled messages win over the bank. */
export function dailyMessageFor(date: ISODate | Date = new Date(), lang: LanguageCode = 'en'): DailyMessage {
  const iso = typeof date === 'string' ? date.slice(0, 10) : toISODate(date)
  const temple = currentTempleId()
  const scheduled = messages
    .all()
    .filter((m) => m.date === iso && m.language === lang && (m.templeId === null || m.templeId === temple))
    .sort((a, b) => Number(b.templeId === temple) - Number(a.templeId === temple))[0]
  if (scheduled) return clone(scheduled)
  const i = ((dayOrdinal(iso) % DAILY_MESSAGE_BANK.length) + DAILY_MESSAGE_BANK.length) % DAILY_MESSAGE_BANK.length
  return { id: `bank_${i}`, date: iso, text: DAILY_MESSAGE_BANK[i]!, language: 'en', templeId: null }
}

export async function getDailyMessage(date: ISODate | Date = new Date(), lang: LanguageCode = 'en'): Promise<DailyMessage> {
  await simulateLatency()
  return dailyMessageFor(date, lang)
}

/** Admin-scheduled messages (overrides for a particular day). */
export async function listDailyMessages(): Promise<DailyMessage[]> {
  await simulateLatency()
  return clone([...messages.all()].sort((a, b) => b.date.localeCompare(a.date)))
}

/** The rotating bank (read-only; edit by scheduling a message for a date). */
export async function listDailyMessageBank(): Promise<{ index: number; text: string }[]> {
  await simulateLatency()
  return DAILY_MESSAGE_BANK.map((text, index) => ({ index, text }))
}

export async function addDailyMessage(input: Omit<DailyMessage, 'id'>): Promise<DailyMessage> {
  await simulateLatency()
  return clone(messages.add({ ...input, id: newId('dmsg') }))
}

export async function updateDailyMessage(id: UUID, patch: Partial<Omit<DailyMessage, 'id'>>): Promise<DailyMessage> {
  await simulateLatency()
  const m = messages.get(id)
  if (!m) throw new Error('Message not found')
  return clone(messages.replace({ ...m, ...patch }))
}

export async function deleteDailyMessage(id: UUID): Promise<void> {
  await simulateLatency()
  messages.remove(id)
}
