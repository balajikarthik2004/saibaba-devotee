/**
 * Repository layer: the swap pattern from mock API to Supabase, demonstrated end-to-end for three
 * vertical slices (temples list, donations list/create, aarti slots).
 *
 *   UI  ->  getRepositories().temples.list()  ->  mock: existing in-memory API (default)
 *                                             ->  supabase: PostgREST + RLS + row mappers
 *
 * Each interface mirrors the existing mock API function it replaces, so migrating a screen is a
 * one-line import change. Slices not listed here still use the mock API (see docs/BACKEND.md).
 * UNTESTED AGAINST A LIVE PROJECT.
 */
import type { AartiSlot, CountryCode, Donation, Temple } from '../types'
import { createDonation, listDonations } from '../api'
import { listTemples, getTempleBySlug, haversineKm, type TempleQuery } from '../features/tenancy/tenancy'
import { deleteAartiSlot, listAartiSlots, upsertAartiSlot } from '../features/aarti/api'
import { getSupabase, unwrap } from './client'
import { isSupabaseMode } from './mode'
import {
  aartiSlotFromRow,
  aartiSlotToRow,
  donationFromRow,
  donationToInsert,
  templeFromRow,
  type DbAartiSlotRow,
  type DbDonationRow,
  type DbTempleRow,
} from './mappers'

export interface TempleRepository {
  list(query?: TempleQuery): Promise<(Temple & { distanceKm?: number })[]>
  getBySlug(slug: string): Promise<Temple | null>
}

export interface DonationRepository {
  /** `userId` = one devotee's gifts across temples; omitted = the given temple's ledger (staff). */
  list(opts?: { userId?: string; templeId?: string }): Promise<Donation[]>
  /**
   * Mock: records a completed gift immediately. Supabase: records a PENDING gift; money is confirmed
   * by the payment webhook, never by the browser (see supabase/migrations/0003_rls.sql).
   */
  create(input: Omit<Donation, 'id' | 'createdAt' | 'taxReceiptId'>): Promise<Donation>
}

export interface AartiRepository {
  listSlots(templeId?: string): Promise<AartiSlot[]>
  upsertSlot(slot: Omit<AartiSlot, 'id'> & { id?: string }): Promise<AartiSlot>
  deleteSlot(id: string): Promise<void>
}

export interface Repositories {
  mode: 'mock' | 'supabase'
  temples: TempleRepository
  donations: DonationRepository
  aarti: AartiRepository
}

/* ---------------------------------------------------------------------- mock */

const mockRepos: Repositories = {
  mode: 'mock',
  temples: { list: listTemples, getBySlug: getTempleBySlug },
  donations: {
    list: ({ userId } = {}) => listDonations(userId),
    create: createDonation,
  },
  aarti: {
    listSlots: listAartiSlots,
    upsertSlot: (s) => upsertAartiSlot(s as Parameters<typeof upsertAartiSlot>[0]),
    deleteSlot: deleteAartiSlot,
  },
}

/* ------------------------------------------------------------------ supabase */

/** Strip characters that have meaning inside a PostgREST `or=(...)` filter. */
const safeTerm = (q: string) => q.replace(/[,()*%\\]/g, ' ').trim()

const supabaseRepos: Repositories = {
  mode: 'supabase',
  temples: {
    async list(query = {}) {
      const sb = await getSupabase()
      let req = sb.from('temples').select('*').order('name')
      // RLS already hides non-active temples from non-staff; `includeAll` only matters for staff.
      if (!query.includeAll) req = req.eq('status', 'active')
      if (query.country) req = req.eq('country', query.country satisfies CountryCode)
      const term = query.q ? safeTerm(query.q) : ''
      if (term) req = req.or(['name', 'city', 'state', 'zip', 'slug'].map((c) => `${c}.ilike.%${term}%`).join(','))
      const rows = unwrap(await req) as DbTempleRow[]
      const temples: (Temple & { distanceKm?: number })[] = rows.map(templeFromRow)
      const near = query.near
      if (!near) return temples
      return temples
        .map((t) => ({ ...t, distanceKm: Math.round(haversineKm(near, t)) }))
        .sort((a, b) => a.distanceKm - b.distanceKm)
    },
    async getBySlug(slug) {
      const sb = await getSupabase()
      const row = unwrap(await sb.from('temples').select('*').eq('slug', slug).maybeSingle()) as DbTempleRow | null
      return row ? templeFromRow(row) : null
    },
  },

  donations: {
    async list({ userId, templeId } = {}) {
      const sb = await getSupabase()
      // RLS does the real scoping; these filters just narrow the query.
      let req = sb.from('donations').select('*').order('created_at', { ascending: false })
      if (userId) req = req.eq('user_id', userId)
      if (templeId) req = req.eq('temple_id', templeId)
      return (unwrap(await req) as DbDonationRow[]).map(donationFromRow)
    },
    async create(input) {
      const sb = await getSupabase()
      const templeId = input.templeId
      if (!templeId || !input.currency) throw new Error('A donation needs a temple and a currency.')
      const row = unwrap(
        await sb.from('donations').insert(donationToInsert(input, templeId, input.currency)).select('*').single(),
      ) as DbDonationRow
      return donationFromRow(row)
    },
  },

  aarti: {
    async listSlots(templeId) {
      const sb = await getSupabase()
      let req = sb.from('aarti_slots').select('*').order('time')
      if (templeId) req = req.eq('temple_id', templeId)
      return (unwrap(await req) as DbAartiSlotRow[]).map(aartiSlotFromRow)
    },
    async upsertSlot(slot) {
      const sb = await getSupabase()
      const row = unwrap(await sb.from('aarti_slots').upsert(aartiSlotToRow(slot)).select('*').single()) as DbAartiSlotRow
      return aartiSlotFromRow(row)
    },
    async deleteSlot(id) {
      const sb = await getSupabase()
      unwrap(await sb.from('aarti_slots').delete().eq('id', id).select('id'))
    },
  },
}

/** The repositories for the current `VITE_DATA_MODE` (mock unless supabase is selected AND configured). */
export function getRepositories(): Repositories {
  return isSupabaseMode() ? supabaseRepos : mockRepos
}
