import { createDonation, listDonations, getDevoteeById } from '../../api'
import { readLocal, writeLocal } from '../../local'
import { currentTempleId } from '../../tenant'
import { TEMPLE_BY_ID } from '../../mock/temple'
import type {
  Booking,
  Cadence,
  CountryCode,
  CurrencyCode,
  Donation,
  DonationCategory,
  DonorContact,
  PaymentProviderKey,
  Temple,
  UUID,
} from '../../types'
import {
  donationCurrency,
  donationTempleId,
  getPaymentMeta,
  savePaymentMeta,
  updatePaymentMeta,
} from './ledger'
import { matchingGiftFor, submitMatchingGift } from './matching'
import type { GivingPaymentResult } from './payments/types'
import { getTaxDeclarationSync, guestDonorKey } from './tax/declaration'
import { issueReceipt, receiptStateFor } from './tax/receipts'
import type { ReceiptDonor } from './tax/receipts'
import type { GivingReceipt, PaymentMeta } from './types'

const sleep = (ms = 120) => new Promise((r) => setTimeout(r, ms))

/** Donation.paymentMethod predates the payment layer; this maps a provider onto it. */
export function legacyMethod(p: PaymentProviderKey): Donation['paymentMethod'] {
  switch (p) {
    case 'zelle':
      return 'zelle'
    case 'ach':
    case 'bank-transfer':
      return 'ach'
    case 'cheque':
      return 'check'
    case 'cash':
      return 'cash'
    default:
      return 'card'
  }
}

export interface GiftDonor {
  userId: UUID | null
  contact: DonorContact
  name: string
  /** One-line address if the donor has one on file. */
  address?: string
  country: CountryCode
}

export interface RecordGiftInput {
  temple: Temple
  donor: GiftDonor
  category: DonationCategory
  /** What was charged, fee included when the donor covered it. */
  charge: number
  fee: number
  feeCovered: boolean
  provider: PaymentProviderKey
  result: GivingPaymentResult
  recurring?: 'monthly' | 'yearly'
  dedicatedTo?: string
  eventId?: UUID
  eventItems?: string[]
  employer?: string
  reference?: string
  receiptDonor: ReceiptDonor
}

export interface RecordedGift {
  donation: Donation
  meta: PaymentMeta
  receipt: GivingReceipt | null
}

/**
 * Persist a finished gift: the donation itself (through the data layer), its payment
 * metadata, a matching-gift request if an employer was named, and a receipt if the money
 * has already arrived. Pending (manual) gifts get their receipt when the office marks
 * them received.
 */
export async function recordGift(input: RecordGiftInput): Promise<RecordedGift> {
  const { temple, donor, result } = input
  const extra = { templeId: temple.id, currency: temple.currency }
  const donation = await createDonation({
    userId: donor.userId,
    donor: donor.userId ? undefined : donor.contact,
    category: input.category,
    amount: input.charge,
    isRecurring: Boolean(input.recurring),
    recurringCadence: input.recurring as Cadence | undefined,
    paymentMethod: legacyMethod(input.provider),
    dedicatedTo: input.dedicatedTo,
    eventId: input.eventId,
    eventItems: input.eventItems,
    ...extra,
  } as unknown as Parameters<typeof createDonation>[0])

  const meta = savePaymentMeta({
    refId: donation.id,
    kind: 'donation',
    templeId: temple.id,
    currency: temple.currency,
    provider: input.provider,
    providerRef: result.providerRef,
    status: result.status === 'succeeded' ? 'succeeded' : 'pending',
    amount: input.charge,
    fee: input.fee,
    feeCovered: input.feeCovered,
    payerName: donor.name,
    payerEmail: donor.contact.email,
    payerCountry: donor.country,
    reference: input.reference,
    recurring: input.recurring,
    createdAt: new Date().toISOString(),
  })

  if (input.employer?.trim()) {
    await submitMatchingGift({
      donationId: donation.id,
      employer: input.employer,
      templeId: temple.id,
    })
  }

  const receipt = issueReceipt({ kind: 'donation', donation }, temple, input.receiptDonor, {
    employer: input.employer?.trim() || undefined,
  })
  return { donation, meta, receipt }
}

/** Payment metadata for a booking paid through the provider layer. */
export function recordBookingPayment(input: {
  booking: Booking
  temple: Temple
  provider: PaymentProviderKey
  result: GivingPaymentResult
  fee: number
  feeCovered: boolean
  payerName: string
  payerEmail: string
  payerCountry: CountryCode
  reference?: string
}): PaymentMeta {
  return savePaymentMeta({
    refId: input.booking.id,
    kind: 'booking',
    templeId: input.temple.id,
    currency: input.temple.currency,
    provider: input.provider,
    providerRef: input.result.providerRef,
    status: input.result.status === 'succeeded' ? 'succeeded' : 'pending',
    amount: input.booking.amount,
    fee: input.fee,
    feeCovered: input.feeCovered,
    payerName: input.payerName,
    payerEmail: input.payerEmail,
    payerCountry: input.payerCountry,
    reference: input.reference,
    createdAt: new Date().toISOString(),
  })
}

/* ---------------------------------------------------------------- admin ledger */

export interface LedgerRow {
  donation: Donation
  templeId: UUID
  currency: CurrencyCode
  provider: PaymentProviderKey | null
  status: PaymentMeta['status']
  fee: number
  payerName: string
  reference?: string
  receipt: ReturnType<typeof receiptStateFor>
  employer?: string
}

/** Donations for the current temple, enriched with payment metadata. */
export async function listLedger(): Promise<LedgerRow[]> {
  const [donations] = await Promise.all([listDonations()])
  const here = currentTempleId()
  return donations
    .filter((d) => donationTempleId(d) === here)
    .map((d) => {
      const m = getPaymentMeta(d.id)
      return {
        donation: d,
        templeId: donationTempleId(d),
        currency: donationCurrency(d),
        provider: m?.provider ?? null,
        status: m?.status ?? 'succeeded',
        fee: m?.fee ?? 0,
        payerName: m?.payerName ?? '',
        reference: m?.reference,
        receipt: receiptStateFor(d),
        employer: matchingGiftFor(d.id)?.employer,
      }
    })
}

/** Office confirms a manual payment arrived; issues the receipt. */
export async function markPaymentReceived(
  donationId: UUID,
  opts: { reference?: string } = {},
): Promise<GivingReceipt | null> {
  await sleep(200)
  const meta = updatePaymentMeta(donationId, {
    status: 'succeeded',
    receivedAt: new Date().toISOString(),
    reference: opts.reference ?? getPaymentMeta(donationId)?.reference,
  })
  if (!meta) return null
  const donations = await listDonations()
  const donation = donations.find((d) => d.id === donationId)
  const temple = TEMPLE_BY_ID.get(meta.templeId)
  if (!donation || !temple) return null
  return issueReceipt(
    { kind: 'donation', donation },
    temple,
    await receiptDonorFor(donation, temple),
  )
}

/** Who a donation's receipt is addressed to, from the account or the guest contact. */
export async function receiptDonorFor(d: Donation, temple?: Temple): Promise<ReceiptDonor> {
  const base = await donorBase(d)
  const owner = base.userId ?? guestDonorKey(base.email ?? base.name)
  return { ...base, profile: temple ? getTaxDeclarationSync(owner, temple.taxRegime) : null }
}

async function donorBase(d: Donation): Promise<ReceiptDonor> {
  if (d.userId) {
    const u = await getDevoteeById(d.userId)
    if (u) {
      return {
        userId: u.id,
        name: u.name,
        email: u.email,
        address: u.address ? `${u.address}, ${u.city ?? ''} ${u.state ?? ''} ${u.zip ?? ''}`.replace(/\s+/g, ' ').trim() : undefined,
      }
    }
  }
  const c = d.donor
  return {
    userId: null,
    name: c ? `${c.firstName} ${c.lastName}`.trim() : (getPaymentMeta(d.id)?.payerName ?? 'Anonymous donor'),
    email: c?.email ?? getPaymentMeta(d.id)?.payerEmail,
  }
}

/** Issue receipts for donations (admin bulk action). Only settled, same-temple gifts. */
export async function issueReceiptsFor(ids: UUID[]): Promise<{ issued: GivingReceipt[]; skipped: number }> {
  const donations = (await listDonations()).filter((d) => ids.includes(d.id))
  const issued: GivingReceipt[] = []
  let skipped = 0
  for (const d of donations) {
    const temple = TEMPLE_BY_ID.get(donationTempleId(d))
    if (!temple) {
      skipped++
      continue
    }
    const r = issueReceipt({ kind: 'donation', donation: d }, temple, await receiptDonorFor(d, temple))
    if (r) issued.push(r)
    else skipped++
  }
  return { issued, skipped }
}

/* ------------------------------------------------------------ mock notification */

interface OutboxItem {
  at: string
  to: string
  subject: string
  receiptNo: string
}
const OUTBOX = 'saibaba:giving:outbox'

/** Mock "send by email": records the notification, sends nothing. */
export async function emailReceipt(receipt: GivingReceipt, to: string): Promise<OutboxItem> {
  await sleep(350)
  const item: OutboxItem = {
    at: new Date().toISOString(),
    to,
    subject: `Your donation receipt ${receipt.number}`,
    receiptNo: receipt.number,
  }
  writeLocal(OUTBOX, [item, ...readLocal<OutboxItem[]>(OUTBOX, []).slice(0, 49)])
  return item
}
