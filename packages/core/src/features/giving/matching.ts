import { readLocal, writeLocal } from '../../local'
import { currentTempleId } from '../../tenant'
import type { MatchingGiftRequest, UUID } from '../../types'

/**
 * Employer matching-gift requests. The donor names their employer on the donation; the
 * temple verifies eligibility with the employer's programme and records the match.
 * (Corporate programmes such as Benevity or Double the Donation are US-centric, so the
 * UI only offers this for US temples.)
 */
const KEY = 'saibaba:giving:matching'
const sleep = (ms = 120) => new Promise((r) => setTimeout(r, ms))

let requests: MatchingGiftRequest[] = readLocal<MatchingGiftRequest[]>(KEY, [])
const persist = () => writeLocal(KEY, requests)

export async function submitMatchingGift(input: {
  donationId: UUID
  employer: string
  templeId?: UUID
}): Promise<MatchingGiftRequest> {
  await sleep()
  const req: MatchingGiftRequest = {
    id: `mg_${String(requests.length + 1).padStart(4, '0')}`,
    donationId: input.donationId,
    templeId: input.templeId ?? currentTempleId(),
    employer: input.employer.trim(),
    status: 'submitted',
    createdAt: new Date().toISOString(),
  }
  requests = [req, ...requests]
  persist()
  return req
}

export async function listMatchingGifts(templeId: UUID = currentTempleId()): Promise<MatchingGiftRequest[]> {
  await sleep()
  return requests.filter((r) => r.templeId === templeId)
}

export const matchingGiftFor = (donationId: UUID) =>
  requests.find((r) => r.donationId === donationId)

export async function setMatchingGiftStatus(
  id: UUID,
  status: MatchingGiftRequest['status'],
  matchedAmount?: number,
): Promise<MatchingGiftRequest | null> {
  await sleep()
  const cur = requests.find((r) => r.id === id)
  if (!cur) return null
  const next: MatchingGiftRequest = {
    ...cur,
    status,
    matchedAmount: status === 'matched' ? (matchedAmount ?? cur.matchedAmount) : cur.matchedAmount,
  }
  requests = requests.map((r) => (r.id === id ? next : r))
  persist()
  return next
}
