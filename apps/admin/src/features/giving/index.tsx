import { lazy } from 'react'
import { HeartHandshake, SlidersHorizontal } from 'lucide-react'
import type { FeatureNav, FeatureRoute } from '../registry'

/**
 * Giving slice for the console. `/donations` and `/donations/receipts` stay registered in
 * App.tsx and the base nav; this adds the settings and matching-gift screens under a new
 * "Giving" sidebar group.
 */
const GivingSettings = lazy(() => import('./pages/GivingSettings'))
const MatchingRequests = lazy(() => import('./pages/MatchingRequests'))

export const routes: FeatureRoute[] = [
  { path: '/giving/settings', Component: GivingSettings, roles: ['admin', 'finance', 'platform'] },
  {
    path: '/giving/matching',
    Component: MatchingRequests,
    roles: ['admin', 'finance', 'platform'],
  },
]

export const nav: FeatureNav[] = [
  {
    group: 'Giving',
    to: '/giving/settings',
    label: 'Giving settings',
    Icon: SlidersHorizontal,
    roles: ['admin', 'finance', 'platform'],
  },
  {
    group: 'Giving',
    to: '/giving/matching',
    label: 'Matching gifts',
    Icon: HeartHandshake,
    roles: ['admin', 'finance', 'platform'],
  },
]
