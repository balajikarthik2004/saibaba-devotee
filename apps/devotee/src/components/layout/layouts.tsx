import { useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarDays,
  Flame,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
  Settings,
  X,
} from 'lucide-react'
import { Header } from './Header'
import { Footer } from './Footer'
import { useCurrentTemple, useT } from '@saibaba/core'
import { Logo, LogoWordmark } from '@/components/shared/Logo'
import { LanguageSwitcher } from './LanguageSwitcher'
import { A11yMenu } from '@/features/a11y'
import { TempleSwitcher } from './TempleSwitcher'
import { getFamilyTree } from '@/lib/data/api'
import { useAsync } from '@/lib/hooks'
import { AvatarWithCompletion, profileCompletion } from '@/components/shared/ProfileCompletion'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/store/auth'
import { useGuestDonorStore } from '@/lib/store/guest'
import { useProfileSignal } from '@/lib/store/profile'
import { cn } from '@/lib/utils'

/* -------------------------------------------------------------------- public */

export function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main id="main-content" tabIndex={-1} className="animate-fade-in flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

/* ------------------------------------------------------------------- minimal */

export function MinimalLayout() {
  return (
    <div className="min-h-dvh bg-bg">
      <div className="animate-fade-in">
        <Outlet />
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------- app */

const APP_NAV = [
  { to: '/dashboard', label: 'Dashboard', key: 'nav.dashboardShort', Icon: LayoutDashboard },
  // { to: '/my/pujas', label: 'My Pujas', Icon: Flame },
  { to: '/puja', label: 'Sponsor a Puja', key: 'nav.puja', Icon: Flame },
  { to: '/donate', label: 'Donate', key: 'nav.donate', Icon: HandCoins },
  // Membership temporarily disabled
  // { to: '/membership', label: 'Membership', Icon: Heart },
  { to: '/calendar', label: 'Calendar', key: 'nav.calendar', Icon: CalendarDays },
  { to: '/my/donations', label: 'My Donations', key: 'nav.myDonations', Icon: ReceiptText },
  { to: '/profile', label: 'Profile', key: 'nav.profile', Icon: Settings },
]

export function RequireAuth() {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()
  if (!user) return <Navigate to="/signin" state={{ from: location.pathname }} replace />
  return <Outlet />
}

/* ------------------------------------------------------------------- giving */

/**
 * Guards the screens a guest donor may see: their own giving history.
 *
 * Weaker than `RequireAuth` on purpose — a visitor who gave their name, email and phone
 * at the donation gate has earned sight of the gifts *they* made from this browser, and
 * nothing else. Anyone with neither an account nor a stored contact is sent to the gate
 * rather than to the sign-in screen, because signing in is not what they came to do.
 */
export function RequireDonor() {
  const user = useAuthStore((s) => s.user)
  const guest = useGuestDonorStore((s) => s.contact)
  if (!user && !guest) return <Navigate to="/donate" replace />
  return <Outlet />
}

/**
 * Wraps the giving screens in whichever chrome fits the visitor.
 *
 * A signed-in devotee keeps the app rail they navigated from. A guest gets the public
 * header and footer — dropping them into a dashboard shell with a Sign out button and
 * links to pages they cannot open would be a worse lie than the redirect it replaced.
 * The inner container mirrors `AppLayout`'s so the page itself measures the same in both.
 */
export function DonorLayout() {
  const user = useAuthStore((s) => s.user)
  if (user) return <AppLayout />
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main id="main-content" tabIndex={-1} className="animate-fade-in flex-1">
        <div className="mx-auto max-w-[1080px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </main>
      <Footer />
    </div>
  )
}

export function AppLayout() {
  const t = useT()
  const temple = useCurrentTemple()
  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)
  const navigate = useNavigate()
  const [mobileNav, setMobileNav] = useState(false)

  // Family members count toward completion, and they live outside the user object.
  // `familyVersion` is what re-runs this the moment the profile page saves.
  const familyVersion = useProfileSignal((s) => s.familyVersion)
  const { data: family } = useAsync(
    async () => (user ? getFamilyTree(user.id) : null),
    [user?.id, familyVersion],
  )
  const completion = user ? profileCompletion(user, family?.members ?? []) : null

  /* On the sand rail the current page is a white card rather than a tinted block —
     the surface underneath is already warm, so a second tint would barely register. */
  const navItem = ({ isActive }: { isActive: boolean }) =>
    cn(
      'group relative flex items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-[13.5px] font-medium transition-all duration-200',
      isActive
        ? 'bg-gradient-to-r from-white to-white/60 text-brand-700 shadow-sm ring-1 ring-saffron-400/20'
        : 'text-muted hover:bg-white/40 hover:text-brand-900 hover:translate-x-0.5',
    )

  const nav = (
    <nav className="flex flex-col gap-0.5">
      {APP_NAV.map(({ to, label, key, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/puja'}
          onClick={() => setMobileNav(false)}
          className={navItem}
        >
          {({ isActive }) => (
            <>
              {isActive ? (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-saffron-400"
                />
              ) : null}
              <Icon className="size-4 shrink-0" />
              {t(key, label)}
            </>
          )}
        </NavLink>
      ))}
      <button
        type="button"
        onClick={() => {
          signOut()
          navigate('/')
        }}
        className="group mt-1 flex items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-left text-[13.5px] font-medium text-muted transition-all duration-200 hover:bg-white/40 hover:text-brand-900 hover:translate-x-0.5"
      >
        <LogOut className="size-4 shrink-0" />
        {t('nav.signOut', 'Sign out')}
      </button>
    </nav>
  )

  return (
    <div className="app-shell min-h-dvh">
      {/* Mobile bar */}
      <div className="app-rail sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line px-4 lg:hidden">
        <Button
          variant="plain"
          size="icon"
          aria-label={t('nav.toggle', 'Toggle menu')}
          onClick={() => setMobileNav((o) => !o)}
        >
          {mobileNav ? <X /> : <Menu />}
        </Button>
        <Link to="/dashboard" className="min-w-0 max-w-[55%]">
          <LogoWordmark compact />
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <TempleSwitcher />
          <LanguageSwitcher className="hidden sm:flex" />
          <A11yMenu />
        </div>
        {user && completion ? (
          <Link to="/profile">
            <AvatarWithCompletion initials={user.avatarInitials} pct={completion.pct} size={32} />
          </Link>
        ) : null}
      </div>
      {mobileNav ? (
        <div className="app-rail animate-fade-in border-b border-line p-3 lg:hidden">{nav}</div>
      ) : null}

      <div className="lg:flex">
        {/* A full-height rail rather than a column of links floating on the page: the
            navigation gets its own surface, and the left edge of every screen is
            anchored at any window height. */}
        <aside className="app-rail sticky top-0 hidden h-dvh w-[254px] shrink-0 flex-col overflow-y-auto border-r border-line px-4 py-6 lg:flex">
          <Link to="/" className="mb-3 flex items-center gap-2.5 px-1">
            <Logo size={34} />
            <span className="min-w-0 leading-tight">
              <span className="block font-serif text-[17px] text-sai-700">Shree Saibaba</span>
              <span className="block text-[10.5px] uppercase tracking-[0.12em] text-muted">
                {t('nav.portal', 'Devotee portal')}
              </span>
            </span>
          </Link>
          <div className="mb-4 flex flex-col gap-2 px-1">
            <TempleSwitcher className="w-full max-w-none justify-between" />
            <LanguageSwitcher className="w-full" />
          </div>

          {user && completion ? (
            // The whole block is the link. A devotee who sees an incomplete ring should
            // be one click from the page that completes it.
            <Link
              to="/profile"
              className="mb-4 flex items-center gap-2.5 rounded-[12px] border border-line bg-card p-3 shadow-[var(--shadow-sm)] transition-colors hover:border-brand-300"
            >
              <AvatarWithCompletion initials={user.avatarInitials} pct={completion.pct} size={40} />
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-medium">{user.name}</p>
                <p className="truncate text-[12px] text-muted">
                  {completion.pct === 100 ? (
                    user.city
                  ) : (
                    <span className="text-brand-600">
                      {t('profile.pctComplete', 'Profile {pct}% complete', { pct: completion.pct })}
                    </span>
                  )}
                </p>
              </div>
            </Link>
          ) : null}

          {nav}

          <p className="mt-auto px-3 pt-6 text-[11px] leading-relaxed text-muted/70">
            {temple.name}
            <br />
            {temple.city}
            {temple.state ? `, ${temple.state}` : ''}
          </p>
        </aside>

        <main id="main-content" tabIndex={-1} className="animate-fade-in min-w-0 flex-1">
          <div className="mx-auto max-w-[1080px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

/** Standard page heading used by every authenticated screen. */
export function PageHeader({
  title,
  subtitle,
  actions,
  backTo,
  backLabel = 'Back',
  className,
}: {
  title: string
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  backTo?: string
  backLabel?: string
  className?: string
}) {
  return (
    <div className={cn('mb-6', className)}>
      {backTo ? (
        <Link
          to={backTo}
          className="mb-3 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-brand-600 hover:text-brand-700"
        >
          <ArrowLeft className="size-4" />
          {backLabel}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-serif text-[26px] leading-tight text-ink">{title}</h1>
          {subtitle ? <p className="mt-1 text-[13.5px] text-muted">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  )
}
