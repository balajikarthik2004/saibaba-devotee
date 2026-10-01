import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, Menu, X } from 'lucide-react'
import type { Role } from '@/lib/data/types'
import { navGroupsFor } from '@/lib/nav'
import { Logo } from '@/components/shared/Logo'
import { Avatar } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useCurrentTemple, useT, useTempleStore } from '@saibaba/core'
import { TempleSwitcher } from '@/components/layout/TempleSwitcher'
import { useAuthStore } from '@/lib/store/auth'
import { cn } from '@/lib/utils'

/* The nav table, the route guard and the sign-in cards all read `@/lib/nav`, so a page's
   audience is stated once rather than restated in three files that can drift apart. */

export function RequireAdminAuth() {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()
  if (!user) return <Navigate to="/signin" state={{ from: location.pathname }} replace />
  return <Outlet />
}

/** Board-only routes. Anyone else is bounced to the operational equivalent. */
export function RequireBoard() {
  const user = useAuthStore((s) => s.user)
  if (user?.role !== 'board') return <Navigate to="/transparency" replace />
  return <Outlet />
}

/**
 * Gates a route to a set of roles, sending everyone else somewhere they can actually use.
 *
 * The approval desks needed the same shape `RequireBoard` has, but for two roles at once
 * and with the administrator holding a key to both — the temple has one administrator and
 * two desks that are not always staffed, so an approval must never be unreachable. Who
 * actually pressed the button is still recorded on the booking either way.
 */
export function RequireRole({ roles, fallback = '/dashboard' }: { roles: Role[]; fallback?: string }) {
  const user = useAuthStore((s) => s.user)
  // `platform` staff oversee every temple, so a role gate never turns them away.
  if (!user || !(roles.includes(user.role) || user.role === 'platform'))
    return <Navigate to={fallback} replace />
  return <Outlet />
}

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrator',
  board: 'Board member',
  priest: 'Priest',
  devotee: 'Devotee',
  finance: 'Accounts & finance',
  committee: 'Puja committee',
  platform: 'Platform team',
}

export function AdminLayout() {
  const user = useAuthStore((s) => s.user)!
  const signOut = useAuthStore((s) => s.signOut)
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileNav, setMobileNav] = useState(false)
  const t = useT()
  const temple = useCurrentTemple()
  const homeTempleId = useAuthStore((s) => s.templeId)
  const setTempleId = useTempleStore((s) => s.setTempleId)

  // Staff are scoped to their own temple; only the platform role moves between temples.
  useEffect(() => {
    if (user.role !== 'platform' && homeTempleId) setTempleId(homeTempleId)
  }, [user.role, homeTempleId, setTempleId])

  // The mobile drawer used to survive a route change, so tapping a link left the nav
  // covering the page you had just asked for.
  useEffect(() => setMobileNav(false), [location.pathname])

  /* The portal's nav item, item for item: a 12px radius, the current page lifted onto a
     white card ringed in saffron with a marigold bar at its left edge, and everything
     else sliding half a pixel right on hover. On a sand rail a tint barely registers —
     the surface underneath is already warm — so the active row becomes paper instead.

     One departure. The portal's items are `text-muted` because its rail is a flat list
     of eight with no headings. This one carries sixteen items under four headings, and
     if the headings and the links are the same colour the grouping stops working. So
     items take `ink-soft` and the group headings keep `muted`: the label is quieter
     than the things it labels, which is the way round it should be. */
  const navClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'group relative flex items-center gap-2.5 rounded-[12px] px-3 py-1.5 text-sm font-medium',
      'transition-all duration-200',
      isActive
        ? 'bg-gradient-to-r from-white to-white/60 text-brand-700 shadow-[var(--shadow-sm)] ring-1 ring-saffron-400/20'
        : 'text-ink-soft hover:translate-x-0.5 hover:bg-white/40 hover:text-brand-900',
    )

  const nav = (
    <nav className="flex flex-col gap-3">
      {navGroupsFor(user.role).map((group) => {
        const items = group.items
        if (items.length === 0) return null
        return (
          <div key={group.title}>
            <p className="eyebrow mb-1 px-3">{t(`nav.group.${group.title}`, group.title)}</p>
            <div className="flex flex-col gap-0.5">
              {items.map(({ to, label, Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  // The effect above covers navigation; this covers tapping the route
                  // you are already on, which changes no pathname and so fires nothing.
                  onClick={() => setMobileNav(false)}
                  className={navClass}
                >
                  {({ isActive }) => (
                    <>
                      {isActive ? (
                        <span
                          aria-hidden
                          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-saffron-400"
                        />
                      ) : null}
                      <Icon
                        className={cn(
                          'size-4 shrink-0 transition-colors',
                          isActive ? 'text-brand-600' : 'text-muted group-hover:text-brand-900',
                        )}
                      />
                      <span className="truncate">{t(`nav.${to}`, label)}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        )
      })}

      {/* Sign out sits at the foot of the list wearing the same clothes as a link,
          exactly as it does in the portal. It replaces the popover that used to hang
          off the user card — Settings is already a route in Programme, so the menu
          had one real item in it. */}
      <button
        type="button"
        onClick={() => {
          signOut()
          navigate('/signin')
        }}
        className={cn(
          'group relative flex items-center gap-2.5 rounded-[12px] px-3 py-1.5 text-left text-sm font-medium',
          'text-ink-soft transition-all duration-200 hover:translate-x-0.5 hover:bg-white/40 hover:text-brand-900',
        )}
      >
        <LogOut className="size-4 shrink-0 text-muted transition-colors group-hover:text-brand-900" />
        {t('nav.signOut', 'Sign out')}
      </button>
    </nav>
  )

  return (
    <div className="app-shell min-h-dvh lg:flex">
      {/* The portal's rail: one scrolling column at 254px, its own surface rather than a
          set of banded regions. The brand sits at the top, the signed-in user directly
          under it — you should be able to see who you are before you see where you can
          go — then the navigation, then the temple's address holding the foot. */}
      <aside className="app-rail sticky top-0 hidden h-dvh w-[254px] shrink-0 flex-col overflow-y-auto px-4 py-5 lg:flex">
        <Link to="/dashboard" className="mb-4 flex items-center gap-2.5 px-1">
          <Logo size={32} />
          <span className="min-w-0 leading-tight">
            <span className="wordmark block truncate text-md text-ink">
              Shree Saibaba
            </span>
            <span className="block text-2xs uppercase tracking-[0.12em] text-muted">
              {t('brand.consoleShort', 'Operations Console')}
            </span>
          </span>
        </Link>

        {/* A card on the rail, matching the portal's. It shows the role rather than the
            city, because which hat you are wearing is what changes what this console
            will let you do. */}
        <div className="mb-3 flex items-center gap-2.5 rounded-[12px] border border-line bg-card p-2.5 shadow-[var(--shadow-sm)]">
          <Avatar initials={user.avatarInitials} className="size-8 text-xs" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{user.name}</p>
            <p className="truncate text-xs text-muted">{ROLE_LABEL[user.role]}</p>
          </div>
        </div>

        <TempleSwitcher className="mb-3" />

        {nav}

        <p className="mt-auto px-3 pt-5 text-2xs leading-relaxed text-muted/70">
          {temple.name}
          <br />
          {[temple.city, temple.state].filter(Boolean).join(', ')}
        </p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* The portal's mobile bar: the rail's own surface rather than a separate piece
            of chrome, so the drawer that opens under it is visibly the same material. */}
        <header className="app-rail sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-line px-4 lg:hidden">
          <Button
            variant="plain"
            size="icon"
            aria-label="Toggle navigation"
            aria-expanded={mobileNav}
            onClick={() => setMobileNav((o) => !o)}
          >
            {mobileNav ? <X /> : <Menu />}
          </Button>
          <Link to="/dashboard" className="flex min-w-0 items-center gap-2.5">
            <Logo size={30} />
            <span className="wordmark truncate text-md text-ink">Shree Saibaba</span>
          </Link>
          {/* No menu hangs off this any more — sign out is the last row of the drawer,
              and Settings is a route in it. */}
          <TempleSwitcher className="ml-auto w-[150px] sm:w-[220px]" />
          <Avatar initials={user.avatarInitials} className="size-8 text-xs" />
        </header>

        {mobileNav ? (
          <div className="app-rail animate-fade-in border-b border-line p-3 lg:hidden">{nav}</div>
        ) : null}

        {/* Keyed on the temple so a switch remounts the routed page and every screen
            refetches against the newly selected temple. */}
        <main key={temple.id} className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export function MinimalLayout() {
  return (
    <div className="app-shell min-h-dvh">
      <div className="animate-fade-in">
        <Outlet />
      </div>
    </div>
  )
}
