import { lazy } from 'react'
import type { FeatureRoute } from '../registry'

/**
 * Temple directory (`/temples`) and a temple's own landing page (`/t/:slug`).
 * Both are public. Tenancy data comes from `@saibaba/core/features/tenancy`.
 */
export const routes: FeatureRoute[] = [
  { path: '/temples', layout: 'public', Component: lazy(() => import('./TemplesFinder')) },
  { path: '/t/:slug', layout: 'public', Component: lazy(() => import('./TempleLanding')) },
]
