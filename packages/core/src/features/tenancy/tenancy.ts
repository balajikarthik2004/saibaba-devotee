import type { Temple } from '../../types'
import type { CountryCode, CurrencyCode } from '../../types.sai'
import { TEMPLES, TEMPLE_BY_ID, TEMPLE_BY_SLUG } from '../../mock/temple'
import { DEVOTEES } from '../../mock/users'
import { DONATIONS } from '../../mock/donations'
import { BOOKINGS } from '../../mock/bookings'
import { readLocal, writeLocal } from '../../local'
import { simulateLatency } from '../../api'

/* ------------------------------------------------------------ persistence */

const KEY = 'saibaba:tenancy:temples'

interface Stored {
  /** Temples created through the console, stored whole. */
  created: Temple[]
  /** Field changes to seeded temples, keyed by id. */
  patches: Record<string, Partial<Temple>>
}

let stored: Stored = readLocal<Stored>(KEY, { created: [], patches: {} })
if (!stored || !Array.isArray(stored.created)) stored = { created: [], patches: {} }

function register(t: Temple) {
  const i = TEMPLES.findIndex((x) => x.id === t.id)
  const old = i >= 0 ? TEMPLES[i]! : undefined
  if (old) {
    Object.assign(old, t) // keep object identity for anything already holding it
    if (old.slug !== t.slug) TEMPLE_BY_SLUG.delete(old.slug)
    TEMPLE_BY_SLUG.set(old.slug, old)
    return old
  }
  TEMPLES.push(t)
  TEMPLE_BY_ID.set(t.id, t)
  TEMPLE_BY_SLUG.set(t.slug, t)
  return t
}

// Hydrate on module load.
for (const [id, patch] of Object.entries(stored.patches)) {
  const t = TEMPLE_BY_ID.get(id)
  if (t) {
    const oldSlug = t.slug
    Object.assign(t, patch)
    if (oldSlug !== t.slug) TEMPLE_BY_SLUG.delete(oldSlug)
    TEMPLE_BY_SLUG.set(t.slug, t)
  }
}
for (const t of stored.created) if (!TEMPLE_BY_ID.has(t.id)) register(t)

const save = () => writeLocal(KEY, stored)

/* ------------------------------------------------------------------ helpers */

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'temple'

function uniqueSlug(base: string): string {
  let slug = base
  let n = 2
  while (TEMPLE_BY_SLUG.has(slug)) slug = `${base}-${n++}`
  return slug
}

/* ---------------------------------------------------------------------- API */

export interface TempleQuery {
  q?: string
  country?: CountryCode
  near?: { lat: number; lng: number }
  /** Include onboarding / suspended temples (platform console). */
  includeAll?: boolean
}

export async function listTemples(query: TempleQuery = {}): Promise<(Temple & { distanceKm?: number })[]> {
  await simulateLatency()
  const q = query.q?.trim().toLowerCase()
  let rows: (Temple & { distanceKm?: number })[] = TEMPLES.filter(
    (t) => query.includeAll || t.status === 'active',
  )
  if (query.country) rows = rows.filter((t) => t.country === query.country)
  if (q)
    rows = rows.filter((t) =>
      [t.name, t.city, t.state, t.zip, t.slug].some((s) => s.toLowerCase().includes(q)),
    )
  const near = query.near
  if (near) {
    return rows
      .map((t) => ({ ...t, distanceKm: Math.round(haversineKm(near, t)) }))
      .sort((a, b) => a.distanceKm! - b.distanceKm!)
  }
  return rows.map((t) => ({ ...t })).sort((a, b) => a.name.localeCompare(b.name))
}

export async function getTempleBySlug(slug: string): Promise<Temple | null> {
  await simulateLatency()
  return TEMPLE_BY_SLUG.get(slug) ?? null
}

export async function getTempleById(id: string): Promise<Temple | null> {
  await simulateLatency()
  return TEMPLE_BY_ID.get(id) ?? null
}

export async function createTemple(
  input: Omit<Temple, 'id' | 'status' | 'isDemo'> & { slug?: string },
): Promise<Temple> {
  await simulateLatency()
  const slug = uniqueSlug(slugify(input.slug || input.name))
  const t: Temple = {
    ...input,
    slug,
    id: `tmp_${slug.replace(/-/g, '_')}_${TEMPLES.length + 1}`,
    status: 'onboarding',
    isDemo: false,
  }
  register(t)
  stored.created.push(t)
  save()
  return t
}

export async function updateTemple(id: string, patch: Partial<Temple>): Promise<Temple> {
  await simulateLatency()
  const t = TEMPLE_BY_ID.get(id)
  if (!t) throw new Error('Temple not found')
  const { id: _id, ...rest } = patch
  void _id
  const oldSlug = t.slug
  if (rest.slug && rest.slug !== oldSlug) {
    const s = slugify(rest.slug)
    rest.slug = TEMPLE_BY_SLUG.has(s) && TEMPLE_BY_SLUG.get(s)!.id !== id ? uniqueSlug(s) : s
  }
  Object.assign(t, rest)
  if (oldSlug !== t.slug) TEMPLE_BY_SLUG.delete(oldSlug)
  TEMPLE_BY_SLUG.set(t.slug, t)
  const ci = stored.created.findIndex((x) => x.id === id)
  if (ci >= 0) stored.created[ci] = { ...t }
  else stored.patches[id] = { ...(stored.patches[id] ?? {}), ...rest }
  save()
  return t
}

export function setTempleStatus(id: string, status: Temple['status']): Promise<Temple> {
  return updateTemple(id, { status })
}

export async function getPlatformStats(): Promise<{
  temples: number
  devotees: number
  giftsByCurrency: Partial<Record<CurrencyCode, number>>
  bookings: number
}> {
  await simulateLatency()
  const giftsByCurrency: Partial<Record<CurrencyCode, number>> = {}
  for (const d of DONATIONS) {
    const t = TEMPLE_BY_ID.get(d.templeId ?? TEMPLES[0]!.id)
    const cur: CurrencyCode = d.currency ?? t?.currency ?? 'USD'
    giftsByCurrency[cur] = (giftsByCurrency[cur] ?? 0) + d.amount
  }
  return {
    temples: TEMPLES.filter((t) => t.status === 'active').length,
    devotees: DEVOTEES.length,
    giftsByCurrency,
    bookings: BOOKINGS.length,
  }
}
