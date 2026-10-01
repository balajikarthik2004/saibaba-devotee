import { lazy } from 'react'
import type { FeatureNav, FeatureRoute } from '../registry'

/**
 * Giving slice for the devotee app. `/donate`, `/puja/book/:id`, `/my/donations` and
 * `/my/receipts` are registered in App.tsx; this adds the routes the slice owns.
 */
const MyTax = lazy(() => import('./pages/MyTax'))
const Matching = lazy(() => import('./pages/Matching'))

export const routes: FeatureRoute[] = [
  { path: '/my/tax', Component: MyTax, layout: 'app' },
  { path: '/matching', Component: Matching, layout: 'public' },
]

export const nav: FeatureNav[] = [
  {
    to: '/matching',
    label: 'Matching gifts',
    labelKey: 'giving.nav.matching',
    placement: 'footer',
    order: 60,
  },
]
