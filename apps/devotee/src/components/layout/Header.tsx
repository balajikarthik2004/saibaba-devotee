import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { ChevronDown, Clock, LogOut, MapPin, Menu, Phone, UserRound, X } from 'lucide-react'
import { useCurrentTemple, useT } from '@saibaba/core'
import { buttonVariants } from '@/components/ui/button'
import { Avatar } from '@/components/ui/badge'
import { MenuItem, Popover } from '@/components/ui/overlay'
import { LogoWordmark } from '@/components/shared/Logo'
import { useAuthStore } from '@/lib/store/auth'
import { cn } from '@/lib/utils'
import { FEATURE_NAV } from '@/features/registry'
import { LanguageSwitcher } from './LanguageSwitcher'
import { A11yMenu } from '@/features/a11y'
import { TempleSwitcher } from './TempleSwitcher'

interface NavEntry {
  to: string
  label: string
  labelKey?: string
  end?: boolean
  order?: number
}

const BASE_NAV: NavEntry[] = [
  { to: '/', label: 'Home', labelKey: 'nav.home', end: true, order: 10 },
  { to: '/puja', label: 'Sponsor a Puja', labelKey: 'nav.puja', order: 20 },
  { to: '/events', label: 'Festivals', labelKey: 'nav.festivals', order: 30 },
  { to: '/calendar', label: 'Calendar', labelKey: 'nav.calendar', order: 40 },
  { to: '/about', label: 'About', labelKey: 'nav.about', order: 90 },
]

const ALL_NAV: NavEntry[] = [...BASE_NAV, ...FEATURE_NAV.filter((n) => n.placement === 'header')].sort(
  (a, b) => (a.order ?? 100) - (b.order ?? 100),
)

// Primary nav items shown directly in header
const PRIMARY_PATHS = new Set(['/', '/darshan', '/puja', '/vrat', '/events', '/annadanam', '/teachings'])
const PRIMARY_NAV = ALL_NAV.filter((n) => PRIMARY_PATHS.has(n.to) && n.to !== '/')
const MORE_NAV = ALL_NAV.filter((n) => !PRIMARY_PATHS.has(n.to))

export function Header() {
  const t = useT()
  const temple = useCurrentTemple()
  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const label = (n: NavEntry) => (n.labelKey ? t(n.labelKey, n.label) : n.label)

  return (
    <header className="sticky top-0 z-30">
      {/* Saffron welcome strip — current temple's address and hours */}
      <div className="bg-linear-to-r from-saffron-400 via-saffron-300 to-saffron-400 text-brand-950">
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-between gap-4 px-4 text-[12px] sm:px-6">
          <span className="flex min-w-0 items-center gap-1.5 font-medium">
            <MapPin className="size-3.5 shrink-0 text-saffron-800" aria-hidden="true" />
            <span className="truncate">
              {temple.address}, {temple.city}
              {temple.state ? `, ${temple.state}` : ''}
            </span>
          </span>
          <span className="hidden shrink-0 items-center gap-4 md:flex">
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5 text-saffron-800" aria-hidden="true" />
              {temple.timings.morning} · {temple.timings.evening}
            </span>
            <a href={`tel:${temple.phone}`} className="flex items-center gap-1.5 font-medium hover:underline">
              <Phone className="size-3.5 text-saffron-800" aria-hidden="true" />
              {temple.phone}
            </a>
          </span>
        </div>
      </div>

      <div className="border-b border-line bg-card/95 backdrop-blur-md">
        <div className="mx-auto flex h-17 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          {/* Logo & Brand Identity */}
          <Link
            to="/"
            className="flex shrink-0 items-center py-1 transition-opacity hover:opacity-95"
            aria-label={t('nav.homeAria', 'Shree Saibaba — home')}
          >
            <LogoWordmark />
          </Link>

          {/* Desktop Navigation Links */}
          <nav
            aria-label={t('nav.main', 'Main')}
            className="hidden items-center gap-1 2xl:gap-1.5 xl:flex"
          >
            {PRIMARY_NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn(
                    'relative rounded-md px-2.5 py-1.5 text-[13.5px] font-medium transition-all duration-150',
                    isActive
                      ? 'bg-saffron-100/60 font-semibold text-brand-700'
                      : 'text-ink/80 hover:bg-tint hover:text-brand-600',
                  )
                }
              >
                {n.to === '/darshan' && (
                  <span className="mr-1.5 inline-block size-2 animate-pulse rounded-full bg-saffron-500 align-middle" />
                )}
                {label(n)}
              </NavLink>
            ))}

            {/* More Navigation Dropdown */}
            {MORE_NAV.length > 0 && (
              <Popover
                trigger={({ toggle, open: isOpen }) => (
                  <button
                    type="button"
                    onClick={toggle}
                    className={cn(
                      'flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[13.5px] font-medium transition-all duration-150',
                      isOpen
                        ? 'bg-saffron-100/60 text-brand-700'
                        : 'text-ink/80 hover:bg-tint hover:text-brand-600',
                    )}
                  >
                    <span>{t('nav.more', 'More')}</span>
                    <ChevronDown
                      className={cn('size-3.5 transition-transform duration-200', isOpen && 'rotate-180')}
                    />
                  </button>
                )}
              >
                {(close) => (
                  <div className="min-w-48 p-1">
                    {MORE_NAV.map((n) => (
                      <NavLink
                        key={n.to}
                        to={n.to}
                        onClick={close}
                        className={({ isActive }) =>
                          cn(
                            'block rounded-md px-3 py-2 text-[13px] font-medium transition-colors',
                            isActive ? 'bg-saffron-50 font-semibold text-brand-700' : 'text-ink/85 hover:bg-tint',
                          )
                        }
                      >
                        {label(n)}
                      </NavLink>
                    ))}
                    <div className="my-1 border-t border-line" />
                    <NavLink
                      to="/temples"
                      onClick={close}
                      className="block rounded-md px-3 py-2 text-[13px] font-medium text-brand-600 hover:bg-tint"
                    >
                      {t('temple.find', 'Find all temples')}
                    </NavLink>
                  </div>
                )}
              </Popover>
            )}
          </nav>

          {/* Right Action Controls */}
          <div className="flex shrink-0 items-center gap-2">
            <TempleSwitcher />
            <LanguageSwitcher className="hidden sm:flex" />
            <A11yMenu />
            
            <Link
              to="/donate"
              className={cn(
                buttonVariants({ size: 'sm' }),
                'hidden shadow-xs hover:shadow-sm md:inline-flex font-semibold',
              )}
            >
              {t('nav.donate', 'Donate')}
            </Link>

            {user ? (
              <Popover
                trigger={({ toggle }) => (
                  <button
                    type="button"
                    onClick={toggle}
                    aria-label={t('nav.account', 'Account menu')}
                    className="flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3 transition-colors hover:bg-tint"
                  >
                    <Avatar initials={user.avatarInitials} className="size-7 text-[11px]" />
                    <span className="hidden text-[13px] font-medium sm:inline">
                      {user.name.split(' ')[0]}
                    </span>
                  </button>
                )}
              >
                {(close) => (
                  <>
                    <div className="border-b border-line px-2.5 pb-2 pt-1">
                      <p className="text-[13px] font-medium">{user.name}</p>
                      <p className="truncate text-[12px] text-muted">{user.email}</p>
                    </div>
                    <MenuItem
                      onClick={() => {
                        close()
                        navigate('/dashboard')
                      }}
                    >
                      <UserRound className="size-4" />
                      {t('nav.dashboard', 'My dashboard')}
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        close()
                        signOut()
                        navigate('/')
                      }}
                    >
                      <LogOut className="size-4" />
                      {t('nav.signOut', 'Sign out')}
                    </MenuItem>
                  </>
                )}
              </Popover>
            ) : (
              <Link
                to="/signin"
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'sm' }),
                  'hidden sm:inline-flex text-[13px]',
                )}
              >
                {t('nav.signIn', 'Sign in')}
              </Link>
            )}

            {/* Mobile Hamburger Menu Toggle */}
            <button
              type="button"
              className="grid size-9 place-items-center rounded-md text-ink/70 transition-colors hover:bg-tint xl:hidden"
              aria-label={t('nav.toggle', 'Toggle menu')}
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {open ? (
        <nav
          aria-label={t('nav.mobile', 'Mobile')}
          className="animate-fade-in max-h-[70dvh] overflow-y-auto border-b border-line bg-card px-4 py-3 shadow-lg xl:hidden"
        >
          <div className="space-y-1">
            {[
              ...ALL_NAV,
              { to: '/donate', label: 'Donate', labelKey: 'nav.donate', end: false },
              { to: '/temples', label: 'Find a temple', labelKey: 'temple.find', end: false },
            ].map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'block rounded-md px-3 py-2 text-[14px] font-medium transition-colors',
                    isActive ? 'bg-saffron-100/70 font-semibold text-brand-700' : 'text-ink hover:bg-tint',
                  )
                }
              >
                {label(n)}
              </NavLink>
            ))}
            {!user ? (
              <NavLink
                to="/signin"
                onClick={() => setOpen(false)}
                className="block rounded-md px-3 py-2 text-[14px] font-medium text-brand-700 hover:bg-tint"
              >
                {t('nav.signIn', 'Sign in')}
              </NavLink>
            ) : null}
          </div>
          <div className="mt-3 border-t border-line pt-3 sm:hidden">
            <LanguageSwitcher className="w-full justify-between" />
          </div>
        </nav>
      ) : null}
    </header>
  )
}
