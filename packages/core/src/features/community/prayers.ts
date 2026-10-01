import { simulateLatency } from '../../api'
import { readLocal, writeLocal } from '../../local'
import { currentTempleId } from '../../tenant'
import { TEMPLES } from '../../mock/temple'
import { rng } from '../../mock/seed'
import { moderateText } from './moderation'
import type { Prayer, PrayerCategory, PrayerVisibility } from './types'

const KEY = 'saibaba:community:prayers'
const PRAYED_KEY = 'saibaba:community:prayed'

const BANK: { category: PrayerCategory; body: string }[] = [
  { category: 'health', body: 'Please keep my father in your prayers as he recovers from a long illness. May Baba give him strength and patience.' },
  { category: 'health', body: 'Praying for a safe and peaceful recovery for a dear friend after her operation.' },
  { category: 'health', body: 'For the doctors and nurses who care for our elders. May they be blessed with energy and kindness.' },
  { category: 'family', body: 'Our family is moving to a new city this month. We ask for Baba’s guidance and a gentle settling-in.' },
  { category: 'family', body: 'Praying for harmony at home and for my children to grow up with kindness and faith.' },
  { category: 'family', body: 'We are expecting a new little one this winter. Grateful for every blessing, asking for a healthy and calm arrival.' },
  { category: 'family', body: 'May my parents, far away, be safe and well. Shraddha and saburi for all of us.' },
  { category: 'peace', body: 'My mind has been restless for weeks. I ask for a little quiet and the steadiness to keep going.' },
  { category: 'peace', body: 'Praying for peace in our community and for kindness between neighbours.' },
  { category: 'peace', body: 'Wishing peace for all those who are grieving this season.' },
  { category: 'gratitude', body: 'Thank you, Baba, for carrying us through a difficult year. We are grateful for every Thursday at the mandir.' },
  { category: 'gratitude', body: 'Completed the nine-Thursday vrat today with a full heart. Thank you for patience and the small miracles along the way.' },
  { category: 'gratitude', body: 'Grateful for a good result after months of worry. Sab ka malik ek.' },
  { category: 'gratitude', body: 'Thankful for the volunteers who cooked and served at the last annadanam. May their kindness return to them.' },
  { category: 'guidance', body: 'I am choosing between two paths for my work. Asking for clarity and the courage to choose well.' },
  { category: 'guidance', body: 'Praying for guidance for my son as he begins university. May he be honest and diligent.' },
  { category: 'guidance', body: 'Please pray that I find the right words for a hard conversation with someone I love.' },
  { category: 'other', body: 'For all travellers this week, that they reach home safely.' },
  { category: 'other', body: 'For the farmers and everyone who has lost crops or homes to storms. May help reach them quickly.' },
  { category: 'other', body: 'A quiet prayer for everyone who will sit alone this festival. May they feel Baba’s presence.' },
  { category: 'peace', body: 'Om Sai Ram. Praying for steadiness for our teachers and students as exams approach.' },
  { category: 'family', body: 'For our grandmother’s 80th birthday next week. Thank you for her long life and her stories.' },
]
const NAMES = ['A devotee', 'Anonymous', 'A Sai family', 'A grateful devotee', 'A devotee from the satsang', 'Sai bhakt', 'A mother', 'A volunteer']

function seed(): Prayer[] {
  const out: Prayer[] = []
  const r = rng(8800)
  const now = Date.now()
  TEMPLES.forEach((t, ti) => {
    for (let i = 0; i < 20; i++) {
      const b = BANK[(i + ti * 3) % BANK.length]!
      const roll = r()
      const status: Prayer['status'] = i < 14 ? 'approved' : roll < 0.6 ? 'pending' : 'rejected'
      const visibility: PrayerVisibility = i % 9 === 8 ? 'temple' : 'public'
      const body = status === 'pending' && i % 2 === 0 ? `${b.body} Call me on 713 555 0142 if you can.` : b.body
      out.push({
        id: `pry_${t.id.slice(4)}_${String(i + 1).padStart(3, '0')}`,
        templeId: t.id,
        displayName: NAMES[Math.floor(r() * NAMES.length)]!,
        category: b.category,
        body,
        visibility,
        status,
        prayerCount: status === 'approved' ? Math.floor(r() * 40) : 0,
        createdAt: new Date(now - (i * 1.3 + r() * 2) * 86400000).toISOString(),
        flags: moderateText(body, visibility),
        moderationReason: status === 'rejected' ? 'Not suitable for the public wall' : undefined,
      })
    }
  })
  return out
}

let PRAYERS: Prayer[] = readLocal<Prayer[] | null>(KEY, null) ?? seed()
const persist = () => writeLocal(KEY, PRAYERS)
let PRAYED: Record<string, string[]> = readLocal(PRAYED_KEY, {})

const clone = <T>(x: T): T => structuredClone(x)

export interface SubmitPrayerInput {
  templeId?: string
  userId?: string
  displayName: string
  category: PrayerCategory
  body: string
  visibility: PrayerVisibility
}

export async function submitPrayer(input: SubmitPrayerInput): Promise<Prayer> {
  await simulateLatency()
  const body = input.body.trim()
  if (!body) throw new Error('Please write a few words for your prayer.')
  const p: Prayer = {
    id: `pry_${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`,
    templeId: input.templeId ?? currentTempleId(),
    userId: input.userId,
    displayName: input.displayName.trim() || 'Anonymous',
    category: input.category,
    body,
    visibility: input.visibility,
    status: 'pending',
    prayerCount: 0,
    createdAt: new Date().toISOString(),
    flags: moderateText(body, input.visibility),
  }
  PRAYERS = [p, ...PRAYERS]
  persist()
  return clone(p)
}

export interface ListPrayersQuery {
  templeId?: string
  status?: Prayer['status'] | 'all'
  /** Only this user's own prayers (any status/visibility). */
  mine?: string
  category?: PrayerCategory
  /** Public wall mode: approved + public only. */
  wall?: boolean
}

export async function listPrayers(q: ListPrayersQuery = {}): Promise<Prayer[]> {
  await simulateLatency()
  const tid = q.templeId ?? currentTempleId()
  return clone(
    PRAYERS.filter((p) => !p.withdrawn && p.templeId === tid)
      .filter((p) => (q.mine ? p.userId === q.mine : true))
      .filter((p) => (q.status && q.status !== 'all' ? p.status === q.status : true))
      .filter((p) => (q.category ? p.category === q.category : true))
      .filter((p) => (q.wall ? p.status === 'approved' && p.visibility === 'public' : true))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  )
}

/** One 'I prayed' per session/user per prayer. Returns the new count and whether it counted. */
export async function prayFor(
  id: string,
  sessionKey: string,
): Promise<{ prayerCount: number; counted: boolean }> {
  await simulateLatency()
  const p = PRAYERS.find((x) => x.id === id)
  if (!p) throw new Error('Prayer not found')
  const who = PRAYED[sessionKey] ?? []
  if (who.includes(id)) return { prayerCount: p.prayerCount, counted: false }
  PRAYED = { ...PRAYED, [sessionKey]: [...who, id] }
  writeLocal(PRAYED_KEY, PRAYED)
  p.prayerCount += 1
  persist()
  return { prayerCount: p.prayerCount, counted: true }
}

export function hasPrayed(id: string, sessionKey: string): boolean {
  return (PRAYED[sessionKey] ?? []).includes(id)
}

/** A stable anonymous key for this browser when nobody is signed in. */
export function prayerSessionKey(userId?: string): string {
  if (userId) return `user:${userId}`
  const k = 'saibaba:community:session'
  let v = readLocal<string | null>(k, null)
  if (!v) {
    v = `anon:${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`
    writeLocal(k, v)
  }
  return v
}

export async function moderatePrayer(
  id: string,
  decision: 'approved' | 'rejected',
  reason?: string,
): Promise<Prayer> {
  await simulateLatency()
  const p = PRAYERS.find((x) => x.id === id)
  if (!p) throw new Error('Prayer not found')
  p.status = decision
  p.moderationReason = reason?.trim() || undefined
  p.moderatedAt = new Date().toISOString()
  persist()
  return clone(p)
}

export async function moderatePrayers(
  ids: string[],
  decision: 'approved' | 'rejected',
  reason?: string,
): Promise<void> {
  for (const id of ids) await moderatePrayer(id, decision, reason)
}

export async function withdrawPrayer(id: string, userId?: string): Promise<void> {
  await simulateLatency()
  const p = PRAYERS.find((x) => x.id === id)
  if (!p) return
  if (userId && p.userId && p.userId !== userId) throw new Error('You can only withdraw your own prayer.')
  p.withdrawn = true
  persist()
}
