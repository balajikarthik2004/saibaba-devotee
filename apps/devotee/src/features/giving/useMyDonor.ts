import { useMemo } from 'react'
import { getTaxDeclarationSync } from '@saibaba/core'
import { TEMPLE_BY_ID } from '@/lib/data/mock'
import type { Donation, ReceiptDonor, Temple } from '@saibaba/core'
import { donationTempleId } from '@saibaba/core'
import type { DonorIdentity } from '@/lib/donor'
import { declarationOwner } from './usePaymentChoice'

/** The donor as a receipt sees them, for the signed-in devotee or the guest. */
export function donorForReceipts(identity: DonorIdentity, temple?: Temple): ReceiptDonor {
  const owner = declarationOwner(identity.userId, identity.contact.email)
  return {
    userId: identity.userId,
    name: identity.name,
    email: identity.contact.email,
    address: identity.address,
    profile: temple ? getTaxDeclarationSync(owner, temple.taxRegime) : null,
  }
}

export function useDonationTemples(donations: Donation[]) {
  return useMemo(
    () => new Map(donations.map((d) => [d.id, TEMPLE_BY_ID.get(donationTempleId(d))] as const)),
    [donations],
  )
}
