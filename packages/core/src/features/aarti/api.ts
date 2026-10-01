/**
 * Mock API for aarti & live darshan. Same seam as the rest of core: fake latency, in-memory
 * arrays, edits mirrored to localStorage (`saibaba:aarti:*`) and hydrated on module load.
 */
import type {
  AartiKey,
  AartiRecording,
  AartiSlot,
  FestivalDate,
  LanguageCode,
  LiveStream,
} from '../../types.sai'
import { simulateLatency } from '../../api'
import { currentTemple, currentTempleId } from '../../tenant'
import { readLocal, writeLocal } from '../../local'
import {
  seedFestivals,
  seedRecordings,
  seedSlots,
  seedStreamBase,
  seedTexts,
  type AartiTextEx,
} from './seed'
import { dateInZone, isLiveWindow } from './time'

export type { AartiTextEx } from './seed'

const K = {
  slots: 'saibaba:aarti:slots',
  texts: 'saibaba:aarti:texts',
  streams: 'saibaba:aarti:streams',
  recordings: 'saibaba:aarti:recordings',
  festivals: 'saibaba:aarti:festivals',
} as const

const clone = <T>(x: T): T => structuredClone(x)

let SLOTS: AartiSlot[] = readLocal<AartiSlot[]>(K.slots, seedSlots())
let TEXTS: AartiTextEx[] = readLocal<AartiTextEx[]>(K.texts, seedTexts())
let RECORDINGS: AartiRecording[] = readLocal<AartiRecording[]>(K.recordings, seedRecordings())
let FESTIVALS: FestivalDate[] = readLocal<FestivalDate[]>(K.festivals, seedFestivals())
/** Admin overrides only — absent temples fall back to the seed + the clock. */
let STREAM_OVERRIDES: Record<string, LiveStream> = readLocal(K.streams, {})
const STREAM_BASE = new Map(seedStreamBase().map((s) => [s.templeId, s]))

const order: Record<AartiKey, number> = { kakad: 0, madhyan: 1, dhoop: 2, shej: 3, special: 4 }

function upsertBy<T extends { id: string }>(arr: T[], item: T): T[] {
  const i = arr.findIndex((x) => x.id === item.id)
  if (i === -1) return [...arr, item]
  const next = arr.slice()
  next[i] = item
  return next
}

/* ------------------------------------------------------------------ slots */

export async function listAartiSlots(templeId?: string): Promise<AartiSlot[]> {
  await simulateLatency()
  const id = templeId ?? currentTempleId()
  return clone(
    SLOTS.filter((s) => s.templeId === id).sort(
      (a, b) => a.time.localeCompare(b.time) || order[a.key] - order[b.key],
    ),
  )
}

export async function upsertAartiSlot(
  slot: Omit<AartiSlot, 'id' | 'templeId'> & { id?: string; templeId?: string },
): Promise<AartiSlot> {
  await simulateLatency()
  const full: AartiSlot = {
    ...slot,
    id: slot.id ?? `aslot_${Date.now().toString(36)}`,
    templeId: slot.templeId ?? currentTempleId(),
  }
  SLOTS = upsertBy(SLOTS, full)
  writeLocal(K.slots, SLOTS)
  return clone(full)
}

export async function deleteAartiSlot(id: string): Promise<void> {
  await simulateLatency()
  SLOTS = SLOTS.filter((s) => s.id !== id)
  writeLocal(K.slots, SLOTS)
}

/* ------------------------------------------------------------------ texts */

export async function listAartiTexts(key?: string, lang?: LanguageCode): Promise<AartiTextEx[]> {
  await simulateLatency()
  return clone(
    TEXTS.filter((t) => (!key || t.key === key) && (!lang || t.language === lang)).sort(
      (a, b) =>
        (order[a.key as AartiKey] ?? 9) - (order[b.key as AartiKey] ?? 9) ||
        a.language.localeCompare(b.language),
    ),
  )
}

export async function upsertAartiText(
  text: Omit<AartiTextEx, 'id'> & { id?: string },
): Promise<AartiTextEx> {
  await simulateLatency()
  const full: AartiTextEx = { ...text, id: text.id ?? `atext_${text.key}_${text.language}` }
  TEXTS = upsertBy(TEXTS, full)
  writeLocal(K.texts, TEXTS)
  return clone(full)
}

/* ------------------------------------------------------------ live stream */

function computedStream(templeId: string): LiveStream {
  const base = clone(
    STREAM_BASE.get(templeId) ?? {
      templeId,
      provider: 'none' as const,
      embedUrl: '',
      isLive: false,
    },
  )
  const tz = (templeId === currentTempleId() ? currentTemple() : undefined)?.timezone
  if (tz) {
    const now = new Date()
    base.isLive = SLOTS.some((s) => s.templeId === templeId && isLiveWindow(s, now, tz))
    if (base.isLive) base.startedAt = now.toISOString()
  }
  return base
}

export async function getLiveStream(templeId?: string): Promise<LiveStream> {
  await simulateLatency()
  const id = templeId ?? currentTempleId()
  return clone(STREAM_OVERRIDES[id] ?? computedStream(id))
}

/** Admin: set provider / URL / live flag. Sticks until `clearLiveStreamOverride`. */
export async function setLiveStream(
  patch: Partial<Omit<LiveStream, 'templeId'>> & { templeId?: string },
): Promise<LiveStream> {
  await simulateLatency()
  const id = patch.templeId ?? currentTempleId()
  const cur = STREAM_OVERRIDES[id] ?? computedStream(id)
  const next: LiveStream = { ...cur, ...patch, templeId: id }
  if (patch.isLive === true && !cur.isLive) next.startedAt = new Date().toISOString()
  if (patch.isLive === false) next.startedAt = undefined
  STREAM_OVERRIDES = { ...STREAM_OVERRIDES, [id]: next }
  writeLocal(K.streams, STREAM_OVERRIDES)
  return clone(next)
}

/** Admin: go back to "live whenever an aarti is on". */
export async function clearLiveStreamOverride(templeId?: string): Promise<void> {
  await simulateLatency()
  const { [templeId ?? currentTempleId()]: _drop, ...rest } = STREAM_OVERRIDES
  void _drop
  STREAM_OVERRIDES = rest
  writeLocal(K.streams, STREAM_OVERRIDES)
}

/* ------------------------------------------------------------- recordings */

export async function listRecordings(templeId?: string): Promise<AartiRecording[]> {
  await simulateLatency()
  const id = templeId ?? currentTempleId()
  return clone(
    RECORDINGS.filter((r) => r.templeId === id).sort((a, b) => b.date.localeCompare(a.date)),
  )
}

export async function addRecording(
  rec: Omit<AartiRecording, 'id' | 'templeId'> & { id?: string; templeId?: string },
): Promise<AartiRecording> {
  await simulateLatency()
  const full: AartiRecording = {
    ...rec,
    id: rec.id ?? `arec_${Date.now().toString(36)}`,
    templeId: rec.templeId ?? currentTempleId(),
  }
  RECORDINGS = upsertBy(RECORDINGS, full)
  writeLocal(K.recordings, RECORDINGS)
  return clone(full)
}

export async function deleteRecording(id: string): Promise<void> {
  await simulateLatency()
  RECORDINGS = RECORDINGS.filter((r) => r.id !== id)
  writeLocal(K.recordings, RECORDINGS)
}

/* --------------------------------------------------------------- festivals */

/** Global dates plus this temple's own, soonest first. */
export async function listFestivalDates(templeId?: string, year?: number): Promise<FestivalDate[]> {
  await simulateLatency()
  const id = templeId ?? currentTempleId()
  return clone(
    FESTIVALS.filter(
      (f) =>
        (f.templeId === null || f.templeId === id) &&
        (year === undefined || f.date.startsWith(String(year))),
    ).sort((a, b) => a.date.localeCompare(b.date)),
  )
}

export async function upsertFestivalDate(
  f: Omit<FestivalDate, 'id'> & { id?: string },
): Promise<FestivalDate> {
  await simulateLatency()
  const full: FestivalDate = { ...f, id: f.id ?? `fest_${Date.now().toString(36)}` }
  FESTIVALS = upsertBy(FESTIVALS, full)
  writeLocal(K.festivals, FESTIVALS)
  return clone(full)
}

export async function deleteFestivalDate(id: string): Promise<void> {
  await simulateLatency()
  FESTIVALS = FESTIVALS.filter((f) => f.id !== id)
  writeLocal(K.festivals, FESTIVALS)
}

/** The festival on today's temple-local date for the current temple, if any. */
export async function getTodayFestival(): Promise<FestivalDate | null> {
  await simulateLatency()
  const id = currentTempleId()
  const today = dateInZone(new Date(), currentTemple().timezone)
  const hit = FESTIVALS.filter(
    (f) =>
      (f.templeId === null || f.templeId === id) &&
      f.date <= today &&
      today <= (f.endDate ?? f.date),
  ).sort((a, b) => (a.templeId === id ? -1 : 0) - (b.templeId === id ? -1 : 0))[0]
  return hit ? clone(hit) : null
}
