import { useEffect, useMemo, useState } from 'react'
import {
  fcraBlocked,
  getGivingSettingsSync,
  getProviders,
  getTaxDeclarationSync,
  grossUp,
  guestDonorKey,
  hasProcessingFee,
} from '@saibaba/core'
import type {
  CountryCode,
  DonorTaxProfile,
  PaymentProvider,
  PaymentProviderKey,
  Temple,
} from '@saibaba/core'

export type DonorCountry = CountryCode | 'XX'

export interface PaymentChoice {
  providerKey: PaymentProviderKey | null
  donorCountry: DonorCountry
  coverFee: boolean
  declaration: Partial<DonorTaxProfile>
  employer: string
  testCard: string
  razorpayMethod: 'upi' | 'card' | 'netbanking'
  donorReference: string
}

/** Key the tax declaration is stored under: the account id, or the guest's email. */
export const declarationOwner = (userId: string | null, email: string) =>
  userId ?? guestDonorKey(email)

function userCountryToDonorCountry(c: string | undefined, temple: Temple): DonorCountry {
  if (c === 'US' || c === 'IN') return c
  // 'Other' means somewhere outside the four launch countries; it matters for FCRA.
  if (c === 'Other') return 'XX'
  return temple.country
}

/**
 * Everything the payment step decides, plus what follows from it: which providers the
 * temple offers, the chosen one, the processing fee, and whether FCRA blocks the gift.
 * `net` is the gift before any fee the donor chooses to cover.
 */
export function usePaymentChoice(
  temple: Temple,
  net: number,
  who: { userId: string | null; email: string; country?: string },
) {
  const providers = useMemo<PaymentProvider[]>(() => getProviders(temple), [temple])

  const [choice, setChoice] = useState<PaymentChoice>(() => ({
    providerKey: providers[0]?.key ?? null,
    donorCountry: userCountryToDonorCountry(who.country, temple),
    coverFee: false,
    declaration: getTaxDeclarationSync(declarationOwner(who.userId, who.email), temple.taxRegime) ?? {},
    employer: '',
    testCard: '4242 4242 4242 4242',
    razorpayMethod: 'upi',
    donorReference: '',
  }))

  // A different temple means a different provider list, regime and saved declaration.
  useEffect(() => {
    setChoice((c) => ({
      ...c,
      providerKey: providers.some((p) => p.key === c.providerKey) ? c.providerKey : (providers[0]?.key ?? null),
      donorCountry: userCountryToDonorCountry(who.country, temple),
      declaration:
        getTaxDeclarationSync(declarationOwner(who.userId, who.email), temple.taxRegime) ?? {},
    }))
    // `who` is an object literal each render; only its scalar parts matter here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [temple.id, providers, who.userId, who.email])

  const provider = providers.find((p) => p.key === choice.providerKey) ?? null
  const feeApplies = provider ? hasProcessingFee(provider.key, temple.currency) : false
  const offerFeeCover =
    feeApplies && getGivingSettingsSync(temple.id).offerFeeCover && net > 0
  const gross = provider && offerFeeCover && choice.coverFee ? grossUp(provider.key, temple.currency, net) : null
  const charge = gross?.charge ?? net
  const fee = gross?.fee ?? 0
  const blocked = fcraBlocked(temple.taxRegime, choice.donorCountry)

  return {
    choice,
    setChoice,
    patch: (p: Partial<PaymentChoice>) => setChoice((c) => ({ ...c, ...p })),
    providers,
    provider,
    offerFeeCover,
    charge,
    fee,
    blocked,
  }
}
