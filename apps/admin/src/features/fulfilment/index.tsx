import { lazy } from 'react'
import { Package, Truck, Utensils } from 'lucide-react'
import type { FeatureNav, FeatureRoute } from '../registry'

const Shipping = lazy(() => import('./Shipping'))
const Items = lazy(() => import('./Items'))
const AnnadanamAdmin = lazy(() => import('./Annadanam'))

const SHIP_VIEW = ['admin', 'committee', 'priest', 'finance', 'platform'] as const
const SHIP_EDIT = ['admin', 'committee', 'priest', 'platform'] as const
const ANNA = ['admin', 'committee', 'platform'] as const

export const routes: FeatureRoute[] = [
  { path: '/shipping', Component: Shipping, roles: [...SHIP_VIEW] },
  { path: '/shipping/items', Component: Items, roles: [...SHIP_EDIT] },
  { path: '/annadanam', Component: AnnadanamAdmin, roles: [...ANNA] },
]

export const nav: FeatureNav[] = [
  { group: 'Fulfilment', to: '/shipping', label: 'Shipping', Icon: Truck, roles: [...SHIP_VIEW], end: true },
  { group: 'Fulfilment', to: '/shipping/items', label: 'Shop items', Icon: Package, roles: [...SHIP_EDIT] },
  { group: 'Fulfilment', to: '/annadanam', label: 'Annadanam', Icon: Utensils, roles: [...ANNA] },
]
