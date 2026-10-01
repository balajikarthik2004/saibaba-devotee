import { readLocal, writeLocal } from '../../local'
import { TEMPLES, TEMPLE_BY_ID } from '../../mock/temple'
import type { CurrencyCode, Donation, Money, UUID } from '../../types'
import type { PaymentMeta } from './types'

/**
 * Payment metadata the shared `Donation` / `Booking` records do not carry yet (currency,
 * provider, fee, settlement status), keyed by the record id and mirrored to
 * localStorage. When the data layer grows `templeId` / `currency` on the records
 * themselves, those win; this store fills the gap for everything else.
 */

const KEY = 'saibaba:giving:meta'
let metas: Record<string, PaymentMeta> = readLocal<Record<string, PaymentMeta>>(KEY, {})

const persist = () => writeLocal(KEY, metas)

export const getPaymentMeta = (refId: UUID): PaymentMeta | undefined => metas[refId]
export const listPaymentMeta = (): PaymentMeta[] => Object.values(metas)

export function savePaymentMeta(meta: PaymentMeta): PaymentMeta {
  metas = { ...metas, [meta.refId]: meta }
  persist()
  return meta
}

export function updatePaymentMeta(refId: UUID, patch: Partial<PaymentMeta>): PaymentMeta | null {
  const cur = metas[refId]
  if (!cur) return null
  return savePaymentMeta({ ...cur, ...patch })
}

type Scoped = Donation & { templeId?: UUID; currency?: CurrencyCode }

export const FLAGSHIP_ID: UUID = TEMPLES[0]!.id

/** The temple a donation belongs to, if anything records it explicitly. */
export function explicitTempleId(d: Donation): UUID | null {
  const s = d as Scoped
  return s.templeId ?? metas[d.id]?.templeId ?? null
}

/** The temple a donation belongs to; the flagship for legacy seed rows. */
export const donationTempleId = (d: Donation): UUID => explicitTempleId(d) ?? FLAGSHIP_ID

export function donationCurrency(d: Donation): CurrencyCode {
  const s = d as Scoped
  return (
    s.currency ?? metas[d.id]?.currency ?? TEMPLE_BY_ID.get(donationTempleId(d))?.currency ?? 'USD'
  )
}

/**
 * Money counts towards receipts and statements once it has arrived. A seed row with no
 * metadata predates the payment layer and is treated as settled.
 */
export function isSettled(refId: UUID): boolean {
  const m = metas[refId]
  return !m || m.status === 'succeeded'
}

export type ReceiptState = 'issued' | 'awaiting-payment' | 'failed' | 'not-issued'

/** Totals per currency; amounts in different currencies are never added together. */
export function sumByCurrency<T>(
  rows: T[],
  amountOf: (r: T) => Money,
  currencyOf: (r: T) => CurrencyCode,
): Partial<Record<CurrencyCode, Money>> {
  const out: Partial<Record<CurrencyCode, Money>> = {}
  for (const r of rows) out[currencyOf(r)] = (out[currencyOf(r)] ?? 0) + amountOf(r)
  return out
}
