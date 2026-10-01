import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { Role } from '@/lib/data/types'

/**
 * Feature slices plug into the console by adding `src/features/<slice>/index.ts(x)`
 * exporting `routes` and/or `nav`. Nothing else needs editing — App.tsx and nav.ts
 * read this registry. Components should be `lazy()` so each screen is its own chunk.
 */
export interface FeatureRoute {
  path: string
  Component: ComponentType
  roles: Role[]
  /** Where a role that may not open the route is sent. */
  fallback?: string
}

export interface FeatureNav {
  /** Sidebar group title; a new title creates a new group. */
  group: string
  to: string
  label: string
  Icon: LucideIcon
  roles: Role[]
  end?: boolean
}

interface FeatureModule {
  routes?: FeatureRoute[]
  nav?: FeatureNav[]
}

const modules = import.meta.glob<FeatureModule>('./*/index.{ts,tsx}', { eager: true })

export const FEATURE_ROUTES: FeatureRoute[] = Object.values(modules).flatMap((m) => m.routes ?? [])
export const FEATURE_NAV: FeatureNav[] = Object.values(modules).flatMap((m) => m.nav ?? [])
