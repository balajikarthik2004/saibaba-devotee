import { createDonation, simulateLatency } from '../../api'
import { readLocal, writeLocal } from '../../local'
import { TEMPLE_BY_ID } from '../../mock/temple'
import { currentTempleId } from '../../tenant'
import type { AnnadanamDrive, PaymentProviderKey, PaymentRequest } from '../../types.sai'
import type { Donation } from '../../types'
import { createPayment } from './payments'
import { buildDrives } from './seed'
import type { FulfilmentPledge, PledgeInput } from './types'

const K_DRIVES = 'saibaba:fulfilment:drives'
const K_PLEDGES = 'saibaba:fulfilment:pledges'

const SEED = buildDrives()
export const DRIVES: AnnadanamDrive[] = readLocal<AnnadanamDrive[] | null>(K_DRIVES, null) ?? SEED.drives
export const PLEDGES: FulfilmentPledge[] =
  readLocal<FulfilmentPledge[] | null>(K_PLEDGES, null) ?? SEED.pledges

const save = () => {
  writeLocal(K_DRIVES, DRIVES)
  writeLocal(K_PLEDGES, PLEDGES)
}

/** Sensible one-tap meal counts. */
export const MEAL_PRESETS = [1, 5, 11, 21, 51, 101]

export async function listDrives(
  templeId: string | 'all' = currentTempleId(),
  status?: AnnadanamDrive['status'] | 'all',
): Promise<AnnadanamDrive[]> {
  await simulateLatency()
  return DRIVES.filter(
    (d) => (templeId === 'all' || d.templeId === templeId) && (!status || status === 'all' || d.status === status),
  )
    .sort((a, b) => {
      // Open drives soonest first, then history newest first.
      if ((a.status === 'open') !== (b.status === 'open')) return a.status === 'open' ? -1 : 1
      return a.status === 'open' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)
    })
    .map((d) => ({ ...d }))
}

export async function getDrive(id: string): Promise<AnnadanamDrive | null> {
  await simulateLatency()
  const d = DRIVES.find((x) => x.id === id)
  return d ? { ...d } : null
}

/** The next open drive (soonest date not in the past), for the home-page highlight. */
export async function nextOpenDrive(templeId: string = currentTempleId()): Promise<AnnadanamDrive | null> {
  const open = await listDrives(templeId, 'open')
  const now = Date.now() - 86400000
  return open.find((d) => new Date(d.date).getTime() >= now) ?? open[0] ?? null
}

const PAY_METHOD: Record<PaymentProviderKey, Donation['paymentMethod']> = {
  stripe: 'card',
  razorpay: 'card',
  upi: 'card',
  zelle: 'zelle',
  ach: 'ach',
  'bank-transfer': 'ach',
  cheque: 'check',
  cash: 'cash',
}

export async function pledgeMeals(input: PledgeInput): Promise<FulfilmentPledge> {
  await simulateLatency()
  const drive = DRIVES.find((d) => d.id === input.driveId)
  if (!drive) throw new Error('Drive not found')
  if (drive.status !== 'open') throw new Error('This drive is no longer taking pledges.')
  const meals = Math.floor(input.meals)
  if (!(meals >= 1 && meals <= 5000)) throw new Error('Choose between 1 and 5,000 meals.')
  const temple = TEMPLE_BY_ID.get(drive.templeId)
  if (!temple) throw new Error('Unknown temple')

  const amount = meals * drive.pricePerMeal
  const donorName = input.guest?.name?.trim() || 'A devotee'
  const req: PaymentRequest = {
    templeId: drive.templeId,
    amount,
    currency: drive.currency,
    purpose: 'annadanam',
    reference: drive.id,
    provider: input.provider,
    payer: {
      name: donorName,
      email: input.guest?.email ?? '',
      phone: input.guest?.phone ?? '',
      country: temple.country,
    },
  }
  const res = await createPayment(temple, req)
  if (res.status === 'failed') throw new Error(res.message ?? 'Payment failed. You have not been charged.')

  const [firstName = donorName, ...rest] = donorName.split(' ')
  const donation = await createDonation({
    userId: input.userId ?? null,
    donor: input.guest
      ? { firstName, lastName: rest.join(' '), email: input.guest.email, phone: input.guest.phone }
      : undefined,
    category: 'annadanam',
    amount,
    isRecurring: false,
    paymentMethod: PAY_METHOD[input.provider] ?? 'card',
    dedicatedTo: input.dedicatedTo?.trim() || undefined,
  })

  const pledge: FulfilmentPledge = {
    id: `plg_${String(PLEDGES.length + 1).padStart(4, '0')}`,
    driveId: drive.id,
    templeId: drive.templeId,
    userId: input.userId ?? null,
    donorName,
    meals,
    amount,
    currency: drive.currency,
    dedicatedTo: input.dedicatedTo?.trim() || undefined,
    donationId: donation.id,
    createdAt: new Date().toISOString(),
    contactEmail: input.guest?.email,
    provider: input.provider,
  }
  PLEDGES.unshift(pledge)
  drive.mealsFunded += meals
  save()
  return { ...pledge }
}

export async function listMyPledges(who: {
  userId?: string | null
  email?: string
}): Promise<FulfilmentPledge[]> {
  await simulateLatency()
  const email = who.email?.trim().toLowerCase()
  return PLEDGES.filter(
    (p) => (who.userId && p.userId === who.userId) || (email && p.contactEmail?.toLowerCase() === email),
  )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((p) => ({ ...p }))
}

/* ------------------------------------------------------------------- admin */

export async function listPledges(driveId?: string): Promise<FulfilmentPledge[]> {
  await simulateLatency()
  const tid = currentTempleId()
  return PLEDGES.filter((p) => (driveId ? p.driveId === driveId : p.templeId === tid)).map((p) => ({ ...p }))
}

export async function createDrive(
  input: Omit<AnnadanamDrive, 'id' | 'mealsFunded' | 'status' | 'report' | 'templeId' | 'currency'> &
    Partial<Pick<AnnadanamDrive, 'templeId' | 'currency'>>,
): Promise<AnnadanamDrive> {
  await simulateLatency()
  const templeId = input.templeId ?? currentTempleId()
  const temple = TEMPLE_BY_ID.get(templeId)
  const drive: AnnadanamDrive = {
    ...input,
    id: `adr_${templeId.replace('tmp_', '')}_${Date.now().toString(36)}`,
    templeId,
    currency: input.currency ?? temple?.currency ?? 'USD',
    mealsFunded: 0,
    status: 'open',
  }
  DRIVES.push(drive)
  save()
  return { ...drive }
}

export async function updateDrive(id: string, patch: Partial<AnnadanamDrive>): Promise<AnnadanamDrive> {
  await simulateLatency()
  const d = DRIVES.find((x) => x.id === id)
  if (!d) throw new Error('Drive not found')
  // Price is fixed once meals are funded, otherwise pledged amounts would stop adding up.
  const { id: _id, templeId: _t, mealsFunded: _m, pricePerMeal, ...safe } = patch
  Object.assign(d, safe)
  if (pricePerMeal !== undefined && d.mealsFunded === 0) d.pricePerMeal = pricePerMeal
  save()
  return { ...d }
}

export async function postReport(
  driveId: string,
  report: { mealsServed: number; photos: string[]; note: string },
): Promise<AnnadanamDrive> {
  await simulateLatency()
  const d = DRIVES.find((x) => x.id === driveId)
  if (!d) throw new Error('Drive not found')
  d.report = {
    mealsServed: Math.max(0, Math.floor(report.mealsServed)),
    photos: report.photos.filter(Boolean),
    note: report.note,
    postedAt: new Date().toISOString(),
  }
  d.status = 'reported'
  save()
  return { ...d }
}

const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function pledgesCSV(driveId?: string): Promise<string> {
  const rows = await listPledges(driveId)
  const title = new Map(DRIVES.map((d) => [d.id, d.title]))
  const head = ['Pledge', 'Drive', 'Donor', 'Email', 'Meals', 'Amount', 'Currency', 'Dedicated to', 'Date']
  const lines = rows.map((p) =>
    [p.id, title.get(p.driveId) ?? p.driveId, p.donorName, p.contactEmail ?? '', p.meals, p.amount, p.currency, p.dedicatedTo ?? '', p.createdAt.slice(0, 10)]
      .map(csvCell)
      .join(','),
  )
  return [head.join(','), ...lines].join('\n')
}
