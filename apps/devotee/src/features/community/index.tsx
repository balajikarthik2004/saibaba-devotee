import { lazy } from 'react'
import type { FeatureNav, FeatureRoute } from '../registry'

const CommunityHub = lazy(() => import('./CommunityHub'))
const Prayers = lazy(() => import('./Prayers'))
const Groups = lazy(() => import('./Groups'))
const GroupDetail = lazy(() => import('./GroupDetail'))
const NotificationSettings = lazy(() => import('./NotificationSettings'))

export const routes: FeatureRoute[] = [
  { path: '/community', Component: CommunityHub, layout: 'public' },
  { path: '/prayers', Component: Prayers, layout: 'public' },
  { path: '/groups', Component: Groups, layout: 'public' },
  { path: '/groups/:id', Component: GroupDetail, layout: 'public' },
  { path: '/settings/notifications', Component: NotificationSettings, layout: 'app' },
]

export const nav: FeatureNav[] = [
  { to: '/community', label: 'Community', labelKey: 'community.nav', placement: 'header', order: 55 },
]
