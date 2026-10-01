import { readLocal, writeLocal } from '../../../local'
import type { TaxRegime, UUID } from '../../../types'
import type { DonorTaxProfile } from '../types'

/**
 * A donor's tax declarations, one per regime (a devotee who gives to a US and a UK temple
 * keeps both). Persisted locally. For a guest donor the key is derived from their email.
 */

const KEY = 'saibaba:giving:tax'
const sleep = (ms = 120) => new Promise((r) => setTimeout(r, ms))

type Store = Record<string, DonorTaxProfile>
let store: Store = readLocal<Store>(KEY, {})

const k = (userId: string, regime: TaxRegime) => `${userId}|${regime}`

/** Stable key for a guest donor. */
export const guestDonorKey = (email: string) => `guest:${email.trim().toLowerCase()}`

export const getTaxDeclarationSync = (userId: UUID, regime: TaxRegime): DonorTaxProfile | null =>
  store[k(userId, regime)] ?? null

export async function getMyTaxDeclaration(
  userId: UUID,
  regime: TaxRegime,
): Promise<DonorTaxProfile | null> {
  await sleep()
  return getTaxDeclarationSync(userId, regime)
}

export async function listMyTaxDeclarations(userId: UUID): Promise<DonorTaxProfile[]> {
  await sleep()
  return Object.values(store).filter((d) => d.userId === userId)
}

export async function saveTaxDeclaration(
  input: Omit<DonorTaxProfile, 'updatedAt'> & { updatedAt?: string },
): Promise<DonorTaxProfile> {
  await sleep(200)
  const now = new Date().toISOString()
  const prev = getTaxDeclarationSync(input.userId, input.regime)
  const next: DonorTaxProfile = {
    ...prev,
    ...input,
    pan: input.pan ? input.pan.trim().toUpperCase() : undefined,
    // Re-stamp the declaration whenever the taxpayer (re)confirms Gift Aid.
    giftAidDeclaredAt: input.giftAid
      ? prev?.giftAid && prev.giftAidDeclaredAt
        ? prev.giftAidDeclaredAt
        : now
      : undefined,
    updatedAt: now,
  }
  store = { ...store, [k(next.userId, next.regime)]: next }
  writeLocal(KEY, store)
  return next
}
