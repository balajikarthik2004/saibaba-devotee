import { getDevoteeById, getMyBookings, listDonations } from '../../../api'
import { readLocal, writeLocal } from '../../../local'
import { PUJA_BY_ID } from '../../../mock/catalog'
import { TEMPLES, TEMPLE_BY_ID } from '../../../mock/temple'
import type {
  Booking,
  CurrencyCode,
  Donation,
  PaymentProviderKey,
  Temple,
  TaxRegime,
  UUID,
} from '../../../types'
import {
  donationCurrency,
  donationTempleId,
  getPaymentMeta,
  isSettled,
} from '../ledger'
import { getGivingSettingsSync } from '../settings'
import type {
  AnnualStatement,
  AnnualStatementLine,
  DonorTaxProfile,
  GivingReceipt,
} from '../types'
import { getTaxDeclarationSync, guestDonorKey } from './declaration'
import { giftAidUplift, gt, regimeConfig } from './regimes'

/* ------------------------------------------------------------------ sources */

export type ReceiptSource =
  | { kind: 'donation'; donation: Donation; description?: string }
  | { kind: 'booking'; booking: Booking; description?: string }

export interface ReceiptDonor {
  userId: UUID | null
  name: string
  /** One-line postal address, if known. */
  address?: string
  email?: string
  /** The donor's tax declaration for the temple's regime, if any. */
  profile?: DonorTaxProfile | null
}

const FLAGSHIP: Temple = TEMPLES[0]!

function infoOf(src: ReceiptSource) {
  if (src.kind === 'donation') {
    const d = src.donation
    const meta = getPaymentMeta(d.id)
    return {
      id: d.id,
      createdAt: d.createdAt,
      amount: d.amount,
      templeId: donationTempleId(d),
      currency: donationCurrency(d),
      provider: meta?.provider,
      description:
        src.description ??
        `${d.category.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} donation${
          d.dedicatedTo ? ` - ${d.dedicatedTo}` : ''
        }`,
    }
  }
  const b = src.booking
  const meta = getPaymentMeta(b.id)
  const templeId = meta?.templeId ?? FLAGSHIP.id
  return {
    id: b.id,
    createdAt: b.createdAt,
    amount: b.amount,
    templeId,
    currency: meta?.currency ?? TEMPLE_BY_ID.get(templeId)?.currency ?? 'USD',
    provider: meta?.provider,
    description:
      src.description ??
      `${PUJA_BY_ID.get(b.pujaCatalogId)?.name ?? 'Puja'} sponsorship (${b.cadence})`,
  }
}

/* ------------------------------------------------------------ amount in words */

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
]
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

function below100(n: number): string {
  if (n < 20) return ONES[n]!
  const t = TENS[Math.floor(n / 10)]!
  return n % 10 ? `${t}-${ONES[n % 10]}` : t
}
function below1000(n: number): string {
  const h = Math.floor(n / 100)
  const r = n % 100
  return [h ? `${ONES[h]} hundred` : '', r ? below100(r) : ''].filter(Boolean).join(' and ')
}

/** "one thousand and one", or "one lakh one thousand" for INR. Whole units only. */
export function amountInWords(amount: number, currency: CurrencyCode): string {
  const n = Math.floor(Math.abs(amount))
  if (n === 0) return 'zero'
  const parts: string[] = []
  let rest = n
  if (currency === 'INR') {
    const crore = Math.floor(rest / 10_000_000)
    rest %= 10_000_000
    const lakh = Math.floor(rest / 100_000)
    rest %= 100_000
    const thousand = Math.floor(rest / 1000)
    rest %= 1000
    if (crore) parts.push(`${below1000(crore)} crore`)
    if (lakh) parts.push(`${below100(lakh)} lakh`)
    if (thousand) parts.push(`${below100(thousand)} thousand`)
    if (rest) parts.push(below1000(rest))
  } else {
    const billion = Math.floor(rest / 1_000_000_000)
    rest %= 1_000_000_000
    const million = Math.floor(rest / 1_000_000)
    rest %= 1_000_000
    const thousand = Math.floor(rest / 1000)
    rest %= 1000
    if (billion) parts.push(`${below1000(billion)} billion`)
    if (million) parts.push(`${below1000(million)} million`)
    if (thousand) parts.push(`${below1000(thousand)} thousand`)
    if (rest) parts.push(below1000(rest))
  }
  return parts.join(' ')
}

const CURRENCY_WORD: Record<CurrencyCode, string> = {
  USD: 'US dollars',
  INR: 'rupees',
  GBP: 'pounds sterling',
  CAD: 'Canadian dollars',
}

export const amountInWordsFull = (amount: number, currency: CurrencyCode) => {
  const w = amountInWords(amount, currency)
  return `${w.charAt(0).toUpperCase()}${w.slice(1)} ${CURRENCY_WORD[currency]} only`
}

const PROVIDER_LABEL: Record<PaymentProviderKey, string> = {
  stripe: 'Card',
  razorpay: 'Online (Razorpay)',
  upi: 'UPI',
  zelle: 'Zelle',
  ach: 'Bank transfer (ACH)',
  cheque: 'Cheque',
  'bank-transfer': 'Bank transfer',
  cash: 'Cash',
}
export const providerLabel = (k: PaymentProviderKey) => PROVIDER_LABEL[k]

/* ------------------------------------------------------------------ numbering */

export function receiptNumber(prefix: string, slug: string, year: number, seq: number | null) {
  return `${prefix}-${slug}-${year}-${seq === null ? 'PENDING' : String(seq).padStart(6, '0')}`
}

/* ------------------------------------------------------------------- building */

/**
 * Pure: the receipt a source would produce in its temple's regime. `seq` is the
 * sequential number within temple and year; omit it for a pending (unpaid) preview.
 */
export function buildReceipt(
  src: ReceiptSource,
  temple: Temple,
  donor: ReceiptDonor,
  opts: { seq?: number | null; status?: 'issued' | 'pending'; employer?: string } = {},
): GivingReceipt {
  const info = infoOf(src)
  const cfg = regimeConfig(temple.taxRegime)
  const settings = getGivingSettingsSync(temple.id)
  const issuedAt = new Date(info.createdAt)
  const year = issuedAt.getFullYear()
  const seq = opts.seq === undefined ? null : opts.seq
  const status = opts.status ?? (seq === null ? 'pending' : 'issued')
  const profile = donor.profile ?? null

  const declarations = [...cfg.wording]
  let giftAidClaimed: boolean | undefined
  let uplift: number | undefined

  if (temple.taxRegime === 'uk-giftaid' && settings.giftAidEnabled) {
    giftAidClaimed = Boolean(profile?.giftAid)
    if (giftAidClaimed) {
      uplift = giftAidUplift(info.amount)
      declarations.push(cfg.giftAidText ?? '')
      declarations.push(
        gt('giving.receipt.giftAidOn', 'Gift Aid declaration made on {date}.', {
          date: (profile?.giftAidDeclaredAt ?? info.createdAt).slice(0, 10),
        }),
      )
    } else {
      declarations.push(
        gt('giving.receipt.noGiftAid', 'No Gift Aid declaration has been made for this donation.'),
      )
    }
  }

  if (temple.taxRegime === 'in-80g') {
    if (profile?.pan) declarations.push(`Donor PAN: ${profile.pan}`)
    else declarations.push(gt('giving.receipt.noPan', 'Donor PAN not provided: not claimable under 80G.'))
    if (info.provider) declarations.push(`Mode of payment: ${PROVIDER_LABEL[info.provider]}`)
  }

  const receipt: GivingReceipt = {
    id: `rcp_${info.id}`,
    templeId: temple.id,
    donationId: src.kind === 'donation' ? info.id : undefined,
    bookingId: src.kind === 'booking' ? info.id : undefined,
    regime: temple.taxRegime,
    number: receiptNumber(settings.receiptPrefix || 'SAI', temple.slug, year, seq),
    issuedAt: info.createdAt,
    donorName: donor.name,
    donorAddress:
      [donor.address, profile?.homeAddress, profile?.city, profile?.postcode]
        .filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i)
        .join(', ') || undefined,
    amount: info.amount,
    currency: info.currency,
    lines: [{ description: info.description, amount: info.amount }],
    templeName: temple.name,
    taxId: temple.taxId,
    taxIdLabel: temple.taxIdLabel,
    declarations: declarations.filter(Boolean),
    status,
    templeSlug: temple.slug,
    templeAddress: `${temple.address}, ${temple.city}, ${temple.state} ${temple.zip}`,
    templePhone: temple.phone,
    templeEmail: temple.email,
    isDemo: temple.isDemo,
    provider: info.provider,
    employer: opts.employer,
  }

  if (temple.taxRegime === 'in-80g') {
    receipt.donorPan = profile?.pan
    receipt.regNo = temple.taxId
  }
  if (temple.taxRegime === 'ca-cra') {
    receipt.placeIssued = `${temple.city}, ${temple.state}, Canada`
    receipt.advantage = 0
    receipt.eligibleAmount = info.amount
  }
  if (giftAidClaimed !== undefined) {
    receipt.giftAidClaimed = giftAidClaimed
    receipt.giftAidUplift = uplift
  }
  return receipt
}

/* -------------------------------------------------------------------- registry */

const KEY = 'saibaba:giving:receipts'
let registry: GivingReceipt[] = readLocal<GivingReceipt[]>(KEY, [])

export const listIssuedReceipts = (templeId?: UUID): GivingReceipt[] =>
  registry.filter((r) => (templeId ? r.templeId === templeId : true))

export const findIssuedReceipt = (refId: UUID): GivingReceipt | undefined =>
  registry.find((r) => r.donationId === refId || r.bookingId === refId)

const seqOf = (n: string) => Number(n.split('-').at(-1)) || 0

function nextSeq(templeId: UUID, year: number) {
  let max = 0
  for (const r of registry) {
    if (r.templeId === templeId && new Date(r.issuedAt).getFullYear() === year) {
      max = Math.max(max, seqOf(r.number))
    }
  }
  return max + 1
}

/**
 * Issue (or return the existing) receipt for a settled payment. Idempotent: the same
 * donation always gets the same number. Returns null while the money has not arrived.
 */
export function issueReceipt(
  src: ReceiptSource,
  temple: Temple,
  donor: ReceiptDonor,
  opts: { employer?: string } = {},
): GivingReceipt | null {
  const info = infoOf(src)
  const existing = findIssuedReceipt(info.id)
  if (existing) return existing
  if (!isSettled(info.id)) return null
  const year = new Date(info.createdAt).getFullYear()
  const receipt = buildReceipt(src, temple, donor, { seq: nextSeq(temple.id, year), ...opts })
  registry = [...registry, receipt]
  writeLocal(KEY, registry)
  return receipt
}

/** Receipt state for the ledger. `legacy` rows carry only the old `taxReceiptId`. */
export function receiptStateFor(d: Donation): 'issued' | 'awaiting-payment' | 'failed' | 'not-issued' {
  if (findIssuedReceipt(d.id)) return 'issued'
  const m = getPaymentMeta(d.id)
  if (m?.status === 'failed') return 'failed'
  if (m && m.status !== 'succeeded') return 'awaiting-payment'
  return d.taxReceiptId ? 'issued' : 'not-issued'
}

/* ------------------------------------------------------------ annual statement */

const slugOf = (id: UUID) => (TEMPLE_BY_ID.get(id) ?? FLAGSHIP).slug

interface StatementInput {
  year: number
  donations: Donation[]
  bookings?: Booking[]
  donor: ReceiptDonor
  templeId?: UUID
}

/**
 * Pure builder: one statement per (temple, currency) for the year. A temple has one
 * currency, so in practice one per temple; amounts are never summed across temples.
 */
export function buildAnnualStatements(input: StatementInput): AnnualStatement[] {
  const { year, donations, bookings = [], donor, templeId } = input
  const groups = new Map<string, { temple: Temple; currency: CurrencyCode; lines: AnnualStatementLine[] }>()

  const add = (src: ReceiptSource) => {
    const info = infoOf(src)
    if (new Date(info.createdAt).getFullYear() !== year) return
    if (!isSettled(info.id)) return
    if (templeId && info.templeId !== templeId) return
    const temple = TEMPLE_BY_ID.get(info.templeId) ?? FLAGSHIP
    const key = `${temple.id}|${info.currency}`
    const g = groups.get(key) ?? { temple, currency: info.currency, lines: [] }
    g.lines.push({
      date: info.createdAt,
      description: info.description,
      amount: info.amount,
      receiptNo: findIssuedReceipt(info.id)?.number,
    })
    groups.set(key, g)
  }

  for (const d of donations) add({ kind: 'donation', donation: d })
  for (const b of bookings) if (b.status !== 'cancelled') add({ kind: 'booking', booking: b })

  const who = donor.userId ?? guestDonorKey(donor.email ?? donor.name)
  return [...groups.values()]
    .map(({ temple, currency, lines }) => {
      const profile = donor.profile ?? getTaxDeclarationSync(who, temple.taxRegime)
      const sorted = lines.sort((a, b) => a.date.localeCompare(b.date))
      return {
        year,
        templeId: temple.id,
        templeName: temple.name,
        regime: temple.taxRegime as TaxRegime,
        currency,
        donorName: donor.name,
        donorAddress:
          [donor.address, profile?.homeAddress, profile?.city, profile?.postcode]
            .filter(Boolean)
            .join(', ') || undefined,
        donorPan: profile?.pan,
        giftAidClaimed: temple.taxRegime === 'uk-giftaid' ? Boolean(profile?.giftAid) : undefined,
        lines: sorted,
        total: sorted.reduce((s, l) => s + l.amount, 0),
        number: `STMT-${slugOf(temple.id)}-${year}-${who.replace(/[^a-z0-9]/gi, '').slice(-8).toUpperCase()}`,
        taxId: temple.taxId,
        taxIdLabel: temple.taxIdLabel,
        isDemo: temple.isDemo,
        templeAddress: `${temple.address}, ${temple.city}, ${temple.state} ${temple.zip}`,
      }
    })
    .sort((a, b) => a.templeName.localeCompare(b.templeName))
}

/** The donor's annual statements for a year, optionally for one temple. */
export async function annualStatement(
  userId: UUID,
  year: number,
  templeId?: UUID,
): Promise<AnnualStatement[]> {
  const [user, donations, bookings] = await Promise.all([
    getDevoteeById(userId),
    listDonations(userId),
    getMyBookings(userId),
  ])
  return buildAnnualStatements({
    year,
    donations,
    bookings,
    templeId,
    donor: {
      userId,
      name: user?.name ?? 'Devotee',
      address: user?.address ? `${user.address}, ${user.city ?? ''} ${user.zip ?? ''}`.trim() : undefined,
      email: user?.email,
    },
  })
}
