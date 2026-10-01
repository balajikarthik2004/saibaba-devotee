import { lazy } from 'react'
import { BellRing, HandHeart, Users } from 'lucide-react'
import type { FeatureNav, FeatureRoute } from '../registry'

const PrayerModeration = lazy(() => import('./PrayerModeration'))
const GroupsAdmin = lazy(() => import('./GroupsAdmin'))
const NotificationsAdmin = lazy(() => import('./NotificationsAdmin'))

export const routes: FeatureRoute[] = [
  { path: '/community/prayers', Component: PrayerModeration, roles: ['admin', 'committee'] },
  { path: '/community/groups', Component: GroupsAdmin, roles: ['admin', 'committee'] },
  { path: '/notifications', Component: NotificationsAdmin, roles: ['admin', 'committee'] },
]

export const nav: FeatureNav[] = [
  { group: 'Community', to: '/community/prayers', label: 'Prayer moderation', Icon: HandHeart, roles: ['admin', 'committee'] },
  { group: 'Community', to: '/community/groups', label: 'Groups', Icon: Users, roles: ['admin', 'committee'] },
  { group: 'Community', to: '/notifications', label: 'Notifications', Icon: BellRing, roles: ['admin', 'committee'] },
]
