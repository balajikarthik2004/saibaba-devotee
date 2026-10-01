import { simulateLatency } from '../../api'
import { readLocal, writeLocal } from '../../local'
import { currentTempleId } from '../../tenant'
import { TEMPLE_BY_ID } from '../../mock/temple'
import { DEVOTEES } from '../../mock/users'
import type { NotifyChannel, NotifyTopic } from '../../types.sai'
import type { User } from '../../types'
import type { CommunityPrefs, NotificationLogEntry } from './types'
import { listGroups } from './groups'

const PREFS_KEY = 'saibaba:community:notify-prefs'
const LOG_KEY = 'saibaba:community:notify-log'

export const NOTIFY_CHANNELS: NotifyChannel[] = ['email', 'push', 'sms', 'whatsapp']
export const NOTIFY_TOPICS: NotifyTopic[] = [
  'aarti',
  'vrat',
  'festival',
  'daily-message',
  'giving',
  'shipping',
  'volunteer',
]
/** Channels that need an explicit, recorded opt-in before anything is sent. */
export const CONSENT_CHANNELS = ['sms', 'whatsapp'] as const

/* ---------------------------------------------------------------- preferences */

export function defaultPrefs(userId: string): CommunityPrefs {
  return {
    userId,
    channels: { email: true, push: true, sms: false, whatsapp: false },
    topics: Object.fromEntries(NOTIFY_TOPICS.map((t) => [t, true])) as Record<NotifyTopic, boolean>,
    quietHours: { from: '21:30', to: '07:00' },
    consent: {},
  }
}

/** A few demo devotees have opted in already, so broadcast estimates are not all zero. */
function seededPrefs(): Record<string, CommunityPrefs> {
  const out: Record<string, CommunityPrefs> = {}
  DEVOTEES.forEach((u, i) => {
    if (i % 6 !== 0 && i % 9 !== 0) return
    const p = defaultPrefs(u.id)
    if (i % 6 === 0) {
      p.channels.whatsapp = true
      p.consent.whatsapp = { at: '2026-01-10T10:00:00.000Z' }
    }
    if (i % 9 === 0) {
      p.channels.sms = true
      p.consent.sms = { at: '2026-01-10T10:00:00.000Z' }
    }
    out[u.id] = p
  })
  return out
}

let PREFS: Record<string, CommunityPrefs> = { ...seededPrefs(), ...readLocal<Record<string, CommunityPrefs>>(PREFS_KEY, {}) }

export async function getPrefs(userId: string): Promise<CommunityPrefs> {
  await simulateLatency()
  return structuredClone(PREFS[userId] ?? defaultPrefs(userId))
}

/**
 * Saves preferences. WhatsApp / SMS can only be on when an explicit consent record
 * exists — `grantConsent` is how the UI records the tick-box.
 */
export async function savePrefs(prefs: CommunityPrefs): Promise<CommunityPrefs> {
  await simulateLatency()
  const next = structuredClone(prefs)
  for (const ch of CONSENT_CHANNELS) {
    if (!next.consent[ch]) next.channels[ch] = false
    if (!next.channels[ch]) delete next.consent[ch]
  }
  PREFS = { ...PREFS, [next.userId]: next }
  writeLocal(PREFS_KEY, PREFS)
  return structuredClone(next)
}

const hasConsent = (p: CommunityPrefs, ch: NotifyChannel) =>
  !(ch === 'sms' || ch === 'whatsapp') || Boolean(p.consent[ch])

/* ------------------------------------------------------------------ templating */

export function renderTemplate(tpl: string, vars: { first_name: string; temple: string }): string {
  return tpl.replace(/\{(first_name|temple)\}/g, (_, k: 'first_name' | 'temple') => vars[k])
}
export const MERGE_TAGS = ['{first_name}', '{temple}'] as const

/* ------------------------------------------------------------------- transport */

export interface NotifyMessage {
  templeId: string
  userId?: string
  /** Email address or phone; masked before it is logged. */
  to: string
  channel: NotifyChannel
  topic: NotifyTopic
  subject: string
  body: string
  broadcastId?: string
}
export interface SendResult {
  status: 'queued' | 'sent' | 'failed'
  note?: string
}
export interface NotificationService {
  send(msg: NotifyMessage): Promise<SendResult>
}

const mask = (to: string) =>
  to.includes('@')
    ? `${to[0]}***@${to.split('@')[1]}`
    : `${to.slice(0, 2)}${'*'.repeat(Math.max(0, to.length - 5))}${to.slice(-3)}`

let LOG: NotificationLogEntry[] = readLocal<NotificationLogEntry[]>(LOG_KEY, [])
function append(e: NotificationLogEntry) {
  LOG = [e, ...LOG].slice(0, 500)
  writeLocal(LOG_KEY, LOG)
}
let seq = 0
const logId = () => `ntf_${Date.now().toString(36)}_${(seq++).toString(36)}`

/** Mock transport: only appends to the persisted log. Never touches the network. */
export const mockTransport: NotificationService = {
  async send(msg) {
    append({
      id: logId(),
      templeId: msg.templeId,
      userId: msg.userId,
      channel: msg.channel,
      topic: msg.topic,
      subject: msg.subject,
      body: msg.body,
      recipient: mask(msg.to),
      broadcastId: msg.broadcastId,
      status: 'sent',
      createdAt: new Date().toISOString(),
    })
    return { status: 'sent' }
  },
}

/** POSTs to `${baseUrl}/notify` (the backend edge function). Server keeps its own log. */
export function httpTransport(baseUrl?: string): NotificationService {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
  const base = (baseUrl ?? env?.VITE_API_BASE ?? '').replace(/\/$/, '')
  return {
    async send(msg) {
      try {
        const res = await fetch(`${base}/notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(msg),
        })
        if (!res.ok) return { status: 'failed', note: `HTTP ${res.status}` }
        const j = (await res.json().catch(() => ({}))) as { status?: SendResult['status'] }
        return { status: j.status ?? 'queued' }
      } catch (e) {
        return { status: 'failed', note: e instanceof Error ? e.message : 'Network error' }
      }
    },
  }
}

let service: NotificationService | null = null
export function setNotificationService(s: NotificationService | null) {
  service = s
}
/** Mock by default; http when VITE_DATA_MODE=supabase and an API base is configured. */
export function getNotificationService(): NotificationService {
  if (service) return service
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
  return env?.VITE_DATA_MODE === 'supabase' && env?.VITE_API_BASE ? httpTransport() : mockTransport
}

/* ------------------------------------------------------------------- broadcast */

export type Audience = { kind: 'all' } | { kind: 'group'; groupId: string }

export interface BroadcastInput {
  templeId?: string
  topic: NotifyTopic
  channels: NotifyChannel[]
  subject: string
  body: string
  audience: Audience
  /** Override "now" (tests / previews). */
  now?: Date
}

export interface ChannelCounts {
  /** Would be / was sent now. */
  send: number
  /** Held until quiet hours end. */
  deferred: number
  /** Skipped: channel off, topic off, or no consent. */
  skipped: number
}
export type BroadcastResult = Record<NotifyChannel, ChannelCounts> & { total: number }

const inQuiet = (q: CommunityPrefs['quietHours'], now: Date) => {
  if (!q) return false
  const m = now.getHours() * 60 + now.getMinutes()
  const [fh = 0, fm = 0] = q.from.split(':').map(Number)
  const [th = 0, tm = 0] = q.to.split(':').map(Number)
  const f = fh * 60 + fm
  const t = th * 60 + tm
  if (f === t) return false
  return f < t ? m >= f && m < t : m >= f || m < t
}

async function audienceUsers(templeId: string, a: Audience): Promise<User[]> {
  if (a.kind === 'all') return DEVOTEES
  const g = (await listGroups(templeId)).find((x) => x.id === a.groupId)
  const ids = new Set(g?.memberIds ?? [])
  return DEVOTEES.filter((u) => ids.has(u.id))
}

interface Plan {
  user: User
  channel: NotifyChannel
  action: 'send' | 'deferred' | 'skipped'
  to: string
}

async function plan(input: BroadcastInput): Promise<{ plans: Plan[]; result: BroadcastResult }> {
  const templeId = input.templeId ?? currentTempleId()
  const now = input.now ?? new Date()
  const users = await audienceUsers(templeId, input.audience)
  const empty = (): ChannelCounts => ({ send: 0, deferred: 0, skipped: 0 })
  const result: BroadcastResult = { email: empty(), sms: empty(), whatsapp: empty(), push: empty(), total: 0 }
  const plans: Plan[] = []
  for (const user of users) {
    const p = PREFS[user.id] ?? defaultPrefs(user.id)
    for (const channel of input.channels) {
      let action: Plan['action'] = 'send'
      if (!p.channels[channel] || !p.topics[input.topic] || !hasConsent(p, channel)) action = 'skipped'
      else if (channel !== 'email' && inQuiet(p.quietHours, now)) action = 'deferred'
      result[channel][action === 'send' ? 'send' : action === 'deferred' ? 'deferred' : 'skipped']++
      if (action === 'send') result.total++
      plans.push({ user, channel, action, to: channel === 'email' ? user.email : user.phone })
    }
  }
  return { plans, result }
}

/** Recipient-count estimate honouring prefs, quiet hours and consent. Sends nothing. */
export async function estimateBroadcast(input: BroadcastInput): Promise<BroadcastResult> {
  await simulateLatency()
  return (await plan(input)).result
}

export async function composeBroadcast(input: BroadcastInput): Promise<BroadcastResult> {
  await simulateLatency()
  const templeId = input.templeId ?? currentTempleId()
  const templeName = TEMPLE_BY_ID.get(templeId)?.name ?? 'your temple'
  const svc = getNotificationService()
  const { plans, result } = await plan(input)
  const broadcastId = `bc_${Date.now().toString(36)}`
  for (const pl of plans) {
    if (pl.action === 'skipped') continue
    const vars = { first_name: pl.user.name.split(' ')[0] ?? pl.user.name, temple: templeName }
    const subject = renderTemplate(input.subject, vars)
    const body = renderTemplate(input.body, vars)
    if (pl.action === 'deferred') {
      append({
        id: logId(),
        templeId,
        userId: pl.user.id,
        channel: pl.channel,
        topic: input.topic,
        subject,
        body,
        recipient: mask(pl.to),
        broadcastId,
        status: 'queued',
        note: 'Held for quiet hours',
        createdAt: new Date().toISOString(),
      })
      continue
    }
    const r = await svc.send({
      templeId,
      userId: pl.user.id,
      to: pl.to,
      channel: pl.channel,
      topic: input.topic,
      subject,
      body,
      broadcastId,
    })
    if (r.status === 'failed') {
      append({
        id: logId(),
        templeId,
        userId: pl.user.id,
        channel: pl.channel,
        topic: input.topic,
        subject,
        recipient: mask(pl.to),
        broadcastId,
        status: 'failed',
        note: r.note,
        createdAt: new Date().toISOString(),
      })
    }
  }
  return result
}

/** "Send me a test" — bypasses quiet hours, honours consent. Logs through the service. */
export async function sendTestNotification(userId: string, name: string, email: string): Promise<void> {
  await simulateLatency()
  const templeId = currentTempleId()
  await getNotificationService().send({
    templeId,
    userId,
    to: email,
    channel: 'email',
    topic: 'daily-message',
    subject: `Test message for ${name.split(' ')[0] ?? name}`,
    body: 'This is a test from your notification settings. Om Sai Ram.',
  })
}

export async function listNotificationLog(templeId?: string): Promise<NotificationLogEntry[]> {
  await simulateLatency()
  const tid = templeId ?? currentTempleId()
  return structuredClone(LOG.filter((e) => e.templeId === tid))
}
