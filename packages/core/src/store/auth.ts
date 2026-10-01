import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Role, User } from '../types'
import { TEMPLE, USERS } from '../mock'
import { currentTempleId } from '../tenant'

/**
 * Mock auth. There is no credential check anywhere — `signIn` accepts any input and
 * resolves it to a seeded user. Replace this store's bodies with a real session call
 * and every guarded route keeps working unchanged.
 */
interface AuthState {
  user: User | null
  templeId: string
  signIn: (identifier: string, role?: Role) => Promise<void>
  signOut: () => void
  setUser: (user: User) => void
}

/** Roles that belong to one temple — a sign-in by role prefers the temple being viewed. */
const TEMPLE_ROLES: Role[] = ['admin', 'board', 'priest', 'finance', 'committee']

const firstDevotee = () => {
  const here = currentTempleId()
  return (
    USERS.find((u) => u.role === 'devotee' && u.homeTempleId === here) ??
    USERS.find((u) => u.role === 'devotee')!
  )
}

function resolveUser(identifier: string, role?: Role): User {
  if (role) {
    if (TEMPLE_ROLES.includes(role)) {
      const here = currentTempleId()
      const match =
        USERS.find((u) => u.role === role && u.homeTempleId === here) ??
        USERS.find((u) => u.role === role)
      return match ?? firstDevotee()
    }
    if (role === 'devotee') return firstDevotee()
    return USERS.find((u) => u.role === role) ?? firstDevotee()
  }
  const q = identifier.trim().toLowerCase()
  if (!q) return firstDevotee()
  const digits = q.replace(/\D/g, '')
  const match = USERS.find(
    (u) =>
      u.email.toLowerCase() === q ||
      u.name.toLowerCase() === q ||
      (digits.length >= 7 && u.phone.replace(/\D/g, '').endsWith(digits.slice(-7))),
  )
  return match ?? firstDevotee()
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      templeId: TEMPLE.id,
      signIn: async (identifier, role) => {
        await new Promise((r) => setTimeout(r, 500))
        set({ user: resolveUser(identifier, role) })
      },
      signOut: () => set({ user: null }),
      setUser: (user) => set({ user }),
    }),
    { name: 'saibaba-auth' },
  ),
)
