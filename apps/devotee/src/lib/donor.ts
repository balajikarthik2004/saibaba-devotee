/**
 * One notion of "who is giving", whether or not they have an account.
 *
 * The giving screens used to read `useAuthStore(s => s.user)!` and were therefore only
 * reachable behind `RequireAuth`. A visitor who clicks Donate on the public site has no
 * user object, but they do have a name, an email and a phone — enough to take a gift,
 * issue a receipt and recognise them next time. `DonorIdentity` is the shape both
 * cases collapse to, so `/donate` and `/my/donations` no longer care which one they got.
 */
import type { DonorContact, User } from '@/lib/data/types'
import { useAuthStore } from '@/lib/store/auth'
import { useGuestDonorStore } from '@/lib/store/guest'
import { initialsOf } from '@/lib/utils'

export { contactMatches, normEmail, normPhone } from '@saibaba/core/donor'
export type { DonorIdentity } from '@saibaba/core/donor'
import type { DonorIdentity } from '@saibaba/core/donor'

/* -------------------------------------------------------------- conversions */

export const donorFullName = (c: DonorContact) => `${c.firstName} ${c.lastName}`.trim()

/**
 * Splits a seeded `User.name` into the two fields the gate collects. Everything after
 * the first space is the surname, so "Santhosh Kumar Iyer" keeps "Kumar Iyer" together
 * rather than silently dropping a name.
 */
export function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') }
}

export function contactFromUser(user: User): DonorContact {
  return { ...splitName(user.name), email: user.email, phone: user.phone }
}

export function identityFromUser(user: User): DonorIdentity {
  return {
    userId: user.id,
    contact: contactFromUser(user),
    name: user.name,
    initials: user.avatarInitials,
    address: user.address
      ? `${user.address}, ${user.city}, ${user.state} ${user.zip}`
      : undefined,
    isGuest: false,
  }
}

export function identityFromContact(contact: DonorContact): DonorIdentity {
  const name = donorFullName(contact)
  return { userId: null, contact, name, initials: initialsOf(name), isGuest: true }
}

/**
 * A sign-up link carrying the details the gate already collected.
 *
 * The whole argument for creating an account is that it costs nothing on top of what
 * they have already typed, so `SignUp` reads these back out of the query string.
 */
export function signUpHrefFor(contact: DonorContact) {
  const params = new URLSearchParams({
    first: contact.firstName,
    last: contact.lastName,
    email: contact.email,
    phone: contact.phone,
  })
  return `/signup?${params.toString()}`
}

/* --------------------------------------------------------------------- hook */

/**
 * The signed-in devotee if there is one, else the guest who has already given their
 * details, else null — which is the cue for the gate to ask for them.
 *
 * An account always wins over a stored guest contact: someone who signs in mid-visit
 * should have the gift land on their real record, not on a shadow copy of it.
 */
export function useDonorIdentity(): DonorIdentity | null {
  const user = useAuthStore((s) => s.user)
  const guest = useGuestDonorStore((s) => s.contact)
  if (user) return identityFromUser(user)
  if (guest) return identityFromContact(guest)
  return null
}
