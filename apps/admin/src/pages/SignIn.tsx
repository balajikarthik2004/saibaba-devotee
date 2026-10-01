import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Gauge,
  Globe2,
  Loader2,
  Lock,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react'
import { dataMode, getAuthProvider, mockAuthProvider, useCurrentTemple, useT, type AuthSession } from '@saibaba/core'
import type { Role } from '@/lib/data/types'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/shared/Logo'
import { USERS } from '@/lib/data/mock'
import { cn } from '@/lib/utils'
import { OtpSignIn } from '@/features/auth/OtpSignIn'

type StaffRole = Extract<Role, 'admin' | 'priest' | 'board' | 'finance' | 'committee' | 'platform'>

const ROLES: {
  role: StaffRole
  title: string
  Icon: typeof Users
  blurb: string
  sees: string[]
}[] = [
  {
    role: 'platform',
    title: 'Platform team',
    Icon: Globe2,
    blurb: 'Onboard and oversee all temples.',
    sees: ['Temples directory', 'Onboarding', 'Platform overview'],
  },
  {
    role: 'admin',
    title: 'Temple Administrator',
    Icon: Users,
    blurb: 'Full operational access — devotees, bookings, ledger, events and settings.',
    sees: ['Devotee records', 'Donation ledger', 'Event CMS', 'Settings'],
  },
  {
    role: 'priest',
    title: 'Priest',
    Icon: BookOpen,
    blurb: 'The daily worklist — today’s archana names, sankalpam details and fulfilment.',
    sees: ['Today’s pujas', 'Archana list', 'Puja catalogue'],
  },
  {
    role: 'board',
    title: 'Board Member',
    Icon: Gauge,
    blurb: 'Strategic and financial oversight, including the read-only AGM view.',
    sees: ['Transparency dashboard', 'Board view', 'Projects tracker'],
  },
  {
    role: 'finance',
    title: 'Accounts & Finance',
    Icon: BadgeCheck,
    blurb: 'Verifies that a sponsorship payment actually reached the temple account.',
    sees: ['Payment approvals', 'Donation ledger', 'Tax receipts'],
  },
  {
    role: 'committee',
    title: 'Puja Committee',
    Icon: UserCheck,
    blurb: 'Puts a priest on every sponsorship accounts has cleared, day by day.',
    sees: ['Priest assignment', 'Today’s pujas', 'Puja catalogue'],
  },
]

/** Where each role lands after signing in — the desk it actually works at. */
const ROLE_HOME: Partial<Record<Role, string>> = {
  board: '/board',
  finance: '/approvals/finance',
  committee: '/approvals/committee',
  platform: '/temples',
}

export default function SignIn() {
  const navigate = useNavigate()
  const location = useLocation()
  const temple = useCurrentTemple()
  const t = useT()
  const [busy, setBusy] = useState<Role | null>(null)
  const [denied, setDenied] = useState<string | null>(null)
  const live = dataMode() === 'supabase'

  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'

  /** Demo only: pick a role card. Never rendered when the data mode is supabase. */
  const pick = async (role: Role) => {
    setBusy(role)
    await mockAuthProvider.signInAsRole(role)
    setBusy(null)
    navigate(ROLE_HOME[role] ?? from, { replace: true })
  }

  /** Live: staff sign in with a one-time code and are resolved to their temple_members role. */
  const onVerified = async (session: AuthSession) => {
    if (session.user.role === 'devotee') {
      await getAuthProvider().signOut()
      setDenied(
        t('auth.noStaff', 'This account has no staff access. Ask your temple administrator to invite you.'),
      )
      return
    }
    navigate(ROLE_HOME[session.user.role] ?? from, { replace: true })
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-10 sm:px-8">
      <div className="w-full max-w-4xl">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Logo size={52} />
          <div>
            <p className="eyebrow mb-2">{t('auth.staffAccess', 'Staff access')}</p>
            <h1 className="font-bold text-3xl leading-none text-ink">{t('auth.console', 'Operations Console')}</h1>
            {!live ? (
              <p className="mx-auto mt-3 max-w-[46ch] text-base leading-relaxed text-muted">
                {temple.name} · {temple.city}, {temple.state}
              </p>
            ) : null}
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1 text-xs font-semibold text-muted shadow-(--shadow-xs)">
            <Lock className="size-3 text-gold-500" />
            {live ? t('auth.staffOtp', 'Sign in with a one-time code') : t('auth.chooseRole', 'Choose a role to continue')}
          </span>
        </div>

        {live ? (
          <div className="mx-auto w-full max-w-sm space-y-4">
            {denied ? (
              <p role="alert" className="rounded-md border border-brand-500/40 bg-brand-50 px-3 py-2 text-sm text-brand-700">
                {denied}
              </p>
            ) : null}
            {/* createUser=false: the console never creates accounts; staff are invited by an admin. */}
            <OtpSignIn createUser={false} onVerified={onVerified} />
          </div>
        ) : (
          <>
            <p role="note" className="mx-auto mb-5 max-w-xl rounded-md border border-saffron-300 bg-saffron-50 px-3 py-2 text-center text-sm text-brand-800">
              {t('auth.demoAdmin', 'Select a staff role below or sign in with verification code 123456.')}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ROLES.map(({ role, title, Icon, blurb, sees }) => {
                const person = USERS.find((u) => u.role === role)
                const loading = busy === role
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => pick(role)}
                    disabled={busy != null}
                    className={cn(
                      'card-interactive group flex flex-col rounded-lg border border-line bg-card p-5 text-left shadow-(--shadow-sm)',
                      'disabled:pointer-events-none disabled:opacity-55',
                      loading && 'border-brand-300 opacity-100',
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="grid size-10 place-items-center rounded-[9px] bg-tint text-brand-500 ring-1 ring-line transition-colors group-hover:bg-brand-500 group-hover:text-white group-hover:ring-brand-600">
                        {loading ? <Loader2 className="size-5 animate-spin" /> : <Icon className="size-5" />}
                      </span>
                      <ArrowRight className="size-4 text-line transition-colors group-hover:text-brand-500" />
                    </span>

                    <span className="mt-3.5 font-bold text-lg leading-snug text-ink">{title}</span>
                    <span className="mt-1 text-sm font-bold text-brand-600">{person?.name}</span>
                    <span className="mt-2 text-sm leading-relaxed text-muted">{blurb}</span>

                    <span className="mt-auto block w-full pt-4">
                      <span className="eyebrow mb-1.5 block">Can see</span>
                      <ul className="space-y-1 border-t border-line-soft pt-2">
                        {sees.map((s) => (
                          <li key={s} className="flex items-center gap-1.5 text-sm text-ink-soft">
                            <ShieldCheck className="size-3 shrink-0 text-leaf-500" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="mt-6 flex flex-col items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => pick('admin')} disabled={busy != null}>
                Skip — sign in as administrator
                <ArrowRight />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
