import type { ComponentType } from 'react'

/**
 * Feature slices plug into the devotee app by adding `src/features/<slice>/index.ts(x)`
 * exporting `routes` and/or `nav`. App.tsx and Header.tsx read this registry, so a slice
 * never edits shared files. Components should be `lazy()`.
 *
 * layout:
 *  - public : open to everyone, with header + footer
 *  - donor  : open to a signed-in devotee or a guest donor (giving screens)
 *  - app    : signed-in devotee, inside the app shell
 *  - minimal: auth-style bare layout
 */
export interface FeatureRoute {
  path: string
  Component: ComponentType
  layout: 'public' | 'donor' | 'app' | 'minimal'
}

export interface FeatureNav {
  to: string
  label: string
  /** i18n key, if the slice registers translations. */
  labelKey?: string
  end?: boolean
  /** 'header' = main nav bar; 'footer' = footer link column. */
  placement: 'header' | 'footer'
  /** Lower comes first. Existing items sit at 10, 20, 30 … */
  order?: number
}

interface FeatureModule {
  routes?: FeatureRoute[]
  nav?: FeatureNav[]
}

const modules = import.meta.glob<FeatureModule>('./*/index.{ts,tsx}', { eager: true })

export const FEATURE_ROUTES: FeatureRoute[] = Object.values(modules).flatMap((m) => m.routes ?? [])
export const FEATURE_NAV: FeatureNav[] = Object.values(modules)
  .flatMap((m) => m.nav ?? [])
  .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
