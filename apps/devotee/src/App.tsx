import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'
import {
  AppLayout,
  DonorLayout,
  MinimalLayout,
  PublicLayout,
  RequireAuth,
  RequireDonor,
} from '@/components/layout/layouts'
import { ScrollToTop } from '@/components/layout/ScrollToTop'
import { LoadingSkeleton } from '@/components/shared/states'
import { FEATURE_ROUTES } from '@/features/registry'
import { InstallPrompt, PwaUpdatePrompt } from '@/features/pwa'
import { SkipLink, useTempleSeo } from '@/features/a11y'
import { useCurrentTemple } from '@saibaba/core'

/** Keeps <title>, meta and JSON-LD in step with the temple being viewed. */
function SeoSync() {
  useTempleSeo(useCurrentTemple())
  return null
}

/**
 * Routes are lazy so the first paint ships only the homepage. The booking wizard,
 * calendar and receipt screens each land in their own chunk.
 */
const Home = lazy(() => import('@/pages/Home'))
const CalendarPage = lazy(() => import('@/pages/CalendarPage'))
const EventsIndex = lazy(() => import('@/pages/EventsIndex'))
const EventDetail = lazy(() => import('@/pages/EventDetail'))
const About = lazy(() => import('@/pages/About'))
const SignIn = lazy(() => import('@/pages/SignIn'))
const SignUp = lazy(() => import('@/pages/SignUp'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const PujaCatalogue = lazy(() => import('@/pages/PujaCatalogue'))
const BookingFlow = lazy(() => import('@/pages/BookingFlow'))
const Donate = lazy(() => import('@/pages/Donate'))
// Membership temporarily disabled
// const MembershipPage = lazy(() => import('@/pages/Membership'))
const Profile = lazy(() => import('@/pages/Profile'))
const MyPujas = lazy(() => import('@/pages/MyPujas'))
const MyDonations = lazy(() => import('@/pages/MyDonations'))
const MyReceipts = lazy(() => import('@/pages/MyReceipts'))
const Facility = lazy(() => import('@/pages/Facility'))
const DevGallery = lazy(() => import('@/pages/DevGallery'))
const NotFound = lazy(() => import('@/pages/NotFound'))

const RouteFallback = () => (
  <div className="mx-auto max-w-6xl px-6 py-10">
    <LoadingSkeleton variant="tiles" rows={3} />
  </div>
)

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <SkipLink />
        <SeoSync />
        <ScrollToTop />
        <PwaUpdatePrompt />
        <InstallPrompt />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Public */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/events" element={<EventsIndex />} />
              <Route path="/events/:slug" element={<EventDetail />} />
              <Route path="/about" element={<About />} />
              <Route path="/dev" element={<DevGallery />} />
              {FEATURE_ROUTES.filter((r) => r.layout === 'public').map((r) => (
                <Route key={r.path} path={r.path} element={<r.Component />} />
              ))}
            </Route>

            {/* Auth */}
            <Route element={<MinimalLayout />}>
              <Route path="/signin" element={<SignIn />} />
              <Route path="/signup" element={<SignUp />} />
              {FEATURE_ROUTES.filter((r) => r.layout === 'minimal').map((r) => (
                <Route key={r.path} path={r.path} element={<r.Component />} />
              ))}
            </Route>

            {/* Giving — open to a signed-in devotee and to a guest donor alike.
                `/donate` asks an unrecognised visitor for their details in place of
                bouncing them to sign-in; `/my/donations` needs one identity or the
                other, and `RequireDonor` accepts either. */}
            <Route element={<DonorLayout />}>
              <Route path="/donate" element={<Donate />} />
              {FEATURE_ROUTES.filter((r) => r.layout === 'donor').map((r) => (
                <Route key={r.path} path={r.path} element={<r.Component />} />
              ))}
              <Route element={<RequireDonor />}>
                <Route path="/my/donations" element={<MyDonations />} />
              </Route>
            </Route>

            {/* Devotee app */}
            <Route element={<RequireAuth />}>
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/puja" element={<PujaCatalogue />} />
                <Route path="/puja/yearly" element={<PujaCatalogue filter="yearly" />} />
                <Route path="/puja/monthly" element={<PujaCatalogue filter="monthly" />} />
                <Route path="/puja/one-time" element={<PujaCatalogue filter="one-time" />} />
                <Route path="/puja/abhishekam" element={<PujaCatalogue filter="abhishekam" />} />
                <Route path="/puja/book/:pujaId" element={<BookingFlow />} />
                {/* Membership temporarily disabled */}
                {/* <Route path="/membership" element={<MembershipPage />} /> */}
                <Route path="/profile" element={<Profile />} />
                <Route path="/my/pujas" element={<MyPujas />} />
                <Route path="/my/receipts" element={<MyReceipts />} />
                <Route path="/facility" element={<Facility />} />
                {FEATURE_ROUTES.filter((r) => r.layout === 'app').map((r) => (
                  <Route key={r.path} path={r.path} element={<r.Component />} />
                ))}
              </Route>
            </Route>

            <Route path="/home" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ToastProvider>
  )
}
