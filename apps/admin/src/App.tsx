import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'
import {
  AdminLayout,
  MinimalLayout,
  RequireAdminAuth,
  RequireBoard,
  RequireRole,
} from '@/components/layout/AdminLayout'
import { ScrollToTop } from '@/components/layout/ScrollToTop'
import { LoadingSkeleton } from '@/components/shared/states'
import { FEATURE_ROUTES } from '@/features/registry'

/**
 * Lazy routes keep recharts out of the initial bundle — only the dashboard and the
 * transparency screens pull the charting library.
 */
const SignIn = lazy(() => import('@/pages/SignIn'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Devotees = lazy(() => import('@/pages/Devotees'))
const DevoteeDetail = lazy(() => import('@/pages/DevoteeDetail'))
const Bookings = lazy(() => import('@/pages/Bookings'))
const BookingsToday = lazy(() => import('@/pages/BookingsToday'))
const FinanceApprovals = lazy(() => import('@/pages/FinanceApprovals'))
const CommitteeApprovals = lazy(() => import('@/pages/CommitteeApprovals'))
const Catalog = lazy(() => import('@/pages/Catalog'))
const Donations = lazy(() => import('@/pages/Donations'))
const Receipts = lazy(() => import('@/pages/Receipts'))
// Membership temporarily disabled
// const Memberships = lazy(() => import('@/pages/Memberships'))
const Volunteers = lazy(() => import('@/pages/Volunteers'))
const Campaigns = lazy(() => import('@/pages/Campaigns'))
const CampaignEditor = lazy(() => import('@/pages/CampaignEditor'))
const CampaignDetail = lazy(() => import('@/pages/CampaignDetail'))
const Inventory = lazy(() => import('@/pages/Inventory'))
const PujaRequirements = lazy(() => import('@/pages/PujaRequirements'))
const RequirementEditor = lazy(() => import('@/pages/RequirementEditor'))
const RequirementFinance = lazy(() => import('@/pages/RequirementFinance'))
const RequirementApprovals = lazy(() => import('@/pages/RequirementApprovals'))
const PujaReadiness = lazy(() => import('@/pages/PujaReadiness'))
const Events = lazy(() => import('@/pages/Events'))
const EventEditor = lazy(() => import('@/pages/EventEditor'))
const CalendarCMS = lazy(() => import('@/pages/CalendarCMS'))
const FacilityAdmin = lazy(() => import('@/pages/FacilityAdmin'))
const Transparency = lazy(() => import('@/pages/Transparency'))
const BoardView = lazy(() => import('@/pages/BoardView'))
const Settings = lazy(() => import('@/pages/Settings'))
const NotFound = lazy(() => import('@/pages/NotFound'))

const RouteFallback = () => (
  <div className="py-4">
    <LoadingSkeleton variant="tiles" rows={4} />
  </div>
)

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route element={<MinimalLayout />}>
              <Route path="/signin" element={<SignIn />} />
            </Route>

            <Route element={<RequireAdminAuth />}>
              <Route element={<AdminLayout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />

                <Route path="/devotees" element={<Devotees />} />
                <Route path="/devotees/:id" element={<DevoteeDetail />} />

                {/* Volunteers belong to whoever runs the festival, so the puja
                    committee holds them alongside the administrator. The child routes
                    inherit access through `canAccess`'s longest-prefix match, so
                    /volunteers/campaigns/:id resolves to /volunteers/campaigns. */}
                <Route element={<RequireRole roles={['admin', 'committee']} />}>
                  <Route path="/volunteers" element={<Volunteers />} />
                  <Route path="/volunteers/campaigns" element={<Campaigns />} />
                  <Route
                    path="/volunteers/campaigns/new"
                    element={<CampaignEditor mode="create" />}
                  />
                  <Route path="/volunteers/campaigns/:id" element={<CampaignDetail />} />
                  <Route
                    path="/volunteers/campaigns/:id/edit"
                    element={<CampaignEditor mode="edit" />}
                  />
                </Route>

                <Route path="/bookings" element={<Bookings />} />
                <Route path="/bookings/today" element={<BookingsToday />} />

                {/* The two approval desks. Each belongs to its department, with the
                    administrator holding a key to both so an unstaffed desk never
                    leaves a devotee's sponsorship stuck. */}
                <Route element={<RequireRole roles={['finance', 'admin']} />}>
                  <Route path="/approvals/finance" element={<FinanceApprovals />} />
                </Route>
                <Route element={<RequireRole roles={['committee', 'admin']} />}>
                  <Route path="/approvals/committee" element={<CommitteeApprovals />} />
                </Route>

                <Route path="/catalog" element={<Catalog />} />

                {/* Stores.
                    The store, the sheets that draw on it and the priest's pre-puja check
                    all belong to whoever handles the physical items, so they sit with the
                    priest and the administrator. The two desks in the middle of the chain
                    are gated to the department that staffs them, the administrator holding
                    a key to both exactly as on the booking chain.

                    Fallbacks are named rather than left at `/dashboard`: a priest who
                    follows a stale link to the approvals desk would otherwise be bounced
                    onto a screen of donation revenue that is not their business. The
                    `:id` route comes last so the three fixed paths match ahead of it. */}
                <Route element={<RequireRole roles={['admin', 'priest']} fallback="/bookings" />}>
                  <Route path="/inventory" element={<Inventory />} />
                  <Route path="/requirements" element={<PujaRequirements />} />
                  <Route path="/requirements/readiness" element={<PujaReadiness />} />
                </Route>
                <Route element={<RequireRole roles={['finance', 'admin']} fallback="/bookings" />}>
                  <Route path="/requirements/finance" element={<RequirementFinance />} />
                </Route>
                <Route element={<RequireRole roles={['admin']} fallback="/requirements" />}>
                  <Route path="/requirements/approvals" element={<RequirementApprovals />} />
                </Route>
                {/* Read-only for the accounts desk, which reaches it from its own queue. */}
                <Route
                  element={<RequireRole roles={['admin', 'priest', 'finance']} fallback="/bookings" />}
                >
                  <Route path="/requirements/:id" element={<RequirementEditor />} />
                </Route>

                <Route path="/donations" element={<Donations />} />
                <Route path="/donations/receipts" element={<Receipts />} />
                {/* Membership temporarily disabled */}
                {/* <Route path="/memberships" element={<Memberships />} /> */}

                <Route path="/events" element={<Events />} />
                <Route path="/events/new" element={<EventEditor mode="create" />} />
                <Route path="/events/:id/edit" element={<EventEditor mode="edit" />} />

                <Route path="/calendar" element={<CalendarCMS />} />
                <Route path="/facility" element={<FacilityAdmin />} />
                <Route path="/transparency" element={<Transparency />} />
                <Route path="/settings" element={<Settings />} />

                {/* Feature slices register themselves in src/features/registry.ts */}
                {FEATURE_ROUTES.map((r) => (
                  <Route key={r.path} element={<RequireRole roles={r.roles} fallback={r.fallback} />}>
                    <Route path={r.path} element={<r.Component />} />
                  </Route>
                ))}

                <Route element={<RequireBoard />}>
                  <Route path="/board" element={<BoardView />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ToastProvider>
  )
}
