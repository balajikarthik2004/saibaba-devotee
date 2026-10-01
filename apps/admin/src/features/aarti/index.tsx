import { lazy } from 'react'
import { CalendarClock, CalendarHeart, Radio, ScrollText, Video } from 'lucide-react'
import type { FeatureNav, FeatureRoute } from '../registry'

const ScheduleCMS = lazy(() => import('./ScheduleCMS'))
const StreamControl = lazy(() => import('./StreamControl'))
const TextsCMS = lazy(() => import('./TextsCMS'))
const RecordingsCMS = lazy(() => import('./RecordingsCMS'))
const FestivalDatesCMS = lazy(() => import('./FestivalDatesCMS'))

const STAFF = ['admin', 'priest', 'platform'] as const
const FESTIVAL_ROLES = ['admin', 'priest', 'committee', 'platform'] as const

export const routes: FeatureRoute[] = [
  { path: '/aarti', Component: ScheduleCMS, roles: [...STAFF] },
  { path: '/aarti/stream', Component: StreamControl, roles: [...STAFF] },
  { path: '/aarti/texts', Component: TextsCMS, roles: [...STAFF] },
  { path: '/aarti/recordings', Component: RecordingsCMS, roles: [...STAFF] },
  { path: '/aarti/festival-dates', Component: FestivalDatesCMS, roles: [...FESTIVAL_ROLES] },
]

export const nav: FeatureNav[] = [
  { group: 'Darshan', to: '/aarti', label: 'Aarti schedule', Icon: CalendarClock, roles: [...STAFF], end: true },
  { group: 'Darshan', to: '/aarti/stream', label: 'Live stream', Icon: Radio, roles: [...STAFF] },
  { group: 'Darshan', to: '/aarti/texts', label: 'Aarti texts', Icon: ScrollText, roles: [...STAFF] },
  { group: 'Darshan', to: '/aarti/recordings', label: 'Recordings', Icon: Video, roles: [...STAFF] },
  { group: 'Darshan', to: '/aarti/festival-dates', label: 'Festival dates', Icon: CalendarHeart, roles: [...FESTIVAL_ROLES] },
]
