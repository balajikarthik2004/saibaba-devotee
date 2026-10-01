import { lazy } from 'react'
import { BookOpen, Flame, ScrollText } from 'lucide-react'
import type { FeatureNav, FeatureRoute } from '../registry'

const AdminVrat = lazy(() => import('./AdminVrat'))
const AdminParayan = lazy(() => import('./AdminParayan'))
const AdminContent = lazy(() => import('./AdminContent'))

const ROLES: ('admin' | 'priest' | 'committee')[] = ['admin', 'priest', 'committee']

export const routes: FeatureRoute[] = [
  { path: '/devotion/vrat', Component: AdminVrat, roles: ROLES },
  { path: '/devotion/parayan', Component: AdminParayan, roles: ROLES },
  { path: '/devotion/content', Component: AdminContent, roles: ROLES },
]

export const nav: FeatureNav[] = [
  { group: 'Devotion', to: '/devotion/vrat', label: 'Thursday vrat', Icon: Flame, roles: ROLES },
  { group: 'Devotion', to: '/devotion/parayan', label: 'Parayan', Icon: BookOpen, roles: ROLES },
  { group: 'Devotion', to: '/devotion/content', label: 'Teachings content', Icon: ScrollText, roles: ROLES },
]
