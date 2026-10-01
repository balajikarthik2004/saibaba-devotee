import { lazy } from 'react'
import { Building2, PlusCircle } from 'lucide-react'
import type { FeatureNav, FeatureRoute } from '../registry'

/**
 * Platform tenancy screens. Only the `platform` role reaches them; temple staff never
 * see the Platform group. Route order matters: the fixed `/temples/new` is listed before
 * the `:id` pattern so it is not read as a temple id.
 */
const TemplesList = lazy(() => import('./TemplesList'))
const TempleWizard = lazy(() => import('./TempleWizard'))
const TempleDetail = lazy(() => import('./TempleDetail'))

export const routes: FeatureRoute[] = [
  { path: '/temples', Component: TemplesList, roles: ['platform'], fallback: '/dashboard' },
  { path: '/temples/new', Component: TempleWizard, roles: ['platform'], fallback: '/dashboard' },
  { path: '/temples/:id', Component: TempleDetail, roles: ['platform'], fallback: '/dashboard' },
]

export const nav: FeatureNav[] = [
  { group: 'Platform', to: '/temples', label: 'Temples', Icon: Building2, roles: ['platform'], end: true },
  { group: 'Platform', to: '/temples/new', label: 'Onboard a temple', Icon: PlusCircle, roles: ['platform'] },
]
