import { create } from 'zustand'

/**
 * A change signal for the family tree.
 *
 * The completion ring in the app rail and the family tree on the profile page read the
 * same record through two different fetches. Without a shared signal the rail keeps
 * showing the figure it loaded with — a devotee adds their spouse, watches the card
 * beside them reach 100%, and the ring in the corner still says 86% until a reload.
 *
 * `saveFamilyTree` bumps this; anything deriving state from the tree lists it as a
 * dependency and refetches.
 */
interface ProfileSignal {
  familyVersion: number
  bumpFamily: () => void
}

export const useProfileSignal = create<ProfileSignal>((set) => ({
  familyVersion: 0,
  bumpFamily: () => set((s) => ({ familyVersion: s.familyVersion + 1 })),
}))
