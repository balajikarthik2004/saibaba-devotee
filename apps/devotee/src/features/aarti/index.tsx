import { lazy } from 'react'
import type { FeatureNav, FeatureRoute } from '../registry'

export * from './widgets'

const Darshan = lazy(() => import('./Darshan'))
const AartiTextPage = lazy(() => import('./AartiText'))
const Recordings = lazy(() => import('./Recordings'))

export const routes: FeatureRoute[] = [
  { path: '/darshan', Component: Darshan, layout: 'public' },
  { path: '/aarti/:key', Component: AartiTextPage, layout: 'public' },
  { path: '/recordings', Component: Recordings, layout: 'public' },
]

export const nav: FeatureNav[] = [
  { to: '/darshan', label: 'Live darshan', labelKey: 'aarti.nav', placement: 'header', order: 15 },
]
