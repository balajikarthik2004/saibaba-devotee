import { lazy } from 'react'
import type { FeatureNav, FeatureRoute } from '../registry'

export * from './widgets'

const VratOverview = lazy(() => import('./VratOverview'))
const MyVrats = lazy(() => import('./MyVrats'))
const VratTracker = lazy(() => import('./VratTracker'))
const ParayanOverview = lazy(() => import('./ParayanOverview'))
const MyParayan = lazy(() => import('./MyParayan'))
const ParayanGroupPage = lazy(() => import('./ParayanGroupPage'))
const Teachings = lazy(() => import('./Teachings'))
const LeelaReader = lazy(() => import('./LeelaReader'))

export const routes: FeatureRoute[] = [
  { path: '/vrat', Component: VratOverview, layout: 'public' },
  { path: '/vrat/my', Component: MyVrats, layout: 'app' },
  { path: '/vrat/:id', Component: VratTracker, layout: 'app' },
  { path: '/parayan', Component: ParayanOverview, layout: 'public' },
  { path: '/parayan/my', Component: MyParayan, layout: 'app' },
  { path: '/parayan/groups/:id', Component: ParayanGroupPage, layout: 'app' },
  { path: '/teachings', Component: Teachings, layout: 'public' },
  { path: '/teachings/:id', Component: LeelaReader, layout: 'public' },
]

export const nav: FeatureNav[] = [
  { to: '/vrat', label: 'Vrat', labelKey: 'vrat.nav', placement: 'header', order: 25 },
  { to: '/teachings', label: 'Teachings', labelKey: 'teach.nav', placement: 'header', order: 35 },
  { to: '/parayan', label: 'Parayan', labelKey: 'parayan.nav', placement: 'footer', order: 25 },
]
