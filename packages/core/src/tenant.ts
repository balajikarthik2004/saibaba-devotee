import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UUID } from './types'

/**
 * The temple the current session is looking at. Devotee app: chosen from the directory
 * (`/t/:slug` also sets it). Admin app: the staff member's temple switcher.
 * Every temple-scoped API reads this instead of taking a `templeId` argument.
 */
interface TenantState {
  templeId: UUID | null
  setTempleId: (id: UUID | null) => void
}

export const useTempleStore = create<TenantState>()(
  persist(
    (set) => ({ templeId: null, setTempleId: (templeId) => set({ templeId }) }),
    { name: 'saibaba:temple' },
  ),
)

/** Non-React read. Null until a temple is chosen — callers fall back to the flagship. */
export const getSelectedTempleId = () => useTempleStore.getState().templeId

/* ------------------------------------------------------------ resolution */
import { TEMPLES, TEMPLE_BY_ID } from './mock/temple'
import type { Temple } from './types'

/** The selected temple's id, falling back to the flagship demo temple. */
export const currentTempleId = (): UUID => getSelectedTempleId() ?? TEMPLES[0]!.id

/** The selected temple record (non-React). */
export const currentTemple = (): Temple => TEMPLE_BY_ID.get(currentTempleId()) ?? TEMPLES[0]!

/** The selected temple record; re-renders when the selection changes. */
export function useCurrentTemple(): Temple {
  const id = useTempleStore((s) => s.templeId)
  return (id ? TEMPLE_BY_ID.get(id) : undefined) ?? TEMPLES[0]!
}
