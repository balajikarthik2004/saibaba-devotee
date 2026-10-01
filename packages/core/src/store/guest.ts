import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DonorContact } from '../types'

/**
 * The contact details of a visitor giving without an account.
 *
 * Persisted for the same reason the auth store is: a devotee who gave last Deepavali
 * and comes back for Navaratri should not be asked who they are a second time. This is
 * deliberately *not* a session — there is no login, nothing is trusted on the strength
 * of it, and it grants access to nothing beyond this browser's own giving history.
 */
interface GuestDonorState {
  contact: DonorContact | null
  setContact: (contact: DonorContact) => void
  clearContact: () => void
}

export const useGuestDonorStore = create<GuestDonorState>()(
  persist(
    (set) => ({
      contact: null,
      setContact: (contact) => set({ contact }),
      clearContact: () => set({ contact: null }),
    }),
    { name: 'meenakshi-guest-donor' },
  ),
)
