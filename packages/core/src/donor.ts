import type { DonorContact, UUID } from './types'

export interface DonorIdentity {
  /** Set only for a signed-in devotee; null for a guest. */
  userId: UUID | null
  /** The contact details, however they were obtained. */
  contact: DonorContact
  /** `"Firstname Lastname"`, ready for a receipt or a greeting. */
  name: string
  initials: string
  /** One line of address, or undefined — a guest is never asked for one. */
  address?: string
  isGuest: boolean
}

/* ------------------------------------------------------------- normalisation */

/** Case- and whitespace-insensitive email key. */
export const normEmail = (email: string) => email.trim().toLowerCase()

/**
 * Phone reduced to its last ten digits.
 *
 * A devotee types `(281) 555-0148` at the gate and `+1 281 555 0148` six months later.
 * Both have to resolve to the same donor, so formatting, spaces and the country code
 * are all discarded before comparison.
 */
export const normPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, '')
  return digits.length > 10 ? digits.slice(-10) : digits
}

/** A phone shorter than this cannot identify anybody, so it never matches. */
const MIN_PHONE_DIGITS = 10

/**
 * Whether two sets of contact details describe the same person.
 *
 * Either identifier is sufficient — a devotee who changed email keeps their phone, and
 * one who changed phone keeps their email. Blank fields never match blank fields.
 */
export function contactMatches(
  a: { email?: string; phone?: string } | null | undefined,
  b: { email?: string; phone?: string } | null | undefined,
): boolean {
  if (!a || !b) return false

  const aEmail = normEmail(a.email ?? '')
  const bEmail = normEmail(b.email ?? '')
  if (aEmail && aEmail === bEmail) return true

  const aPhone = normPhone(a.phone ?? '')
  const bPhone = normPhone(b.phone ?? '')
  return aPhone.length >= MIN_PHONE_DIGITS && aPhone === bPhone
}

