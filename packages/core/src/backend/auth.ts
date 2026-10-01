import type { LanguageCode, Role, User } from '../types'
import { useAuthStore } from '../store/auth'
import { getSupabase } from './client'
import { isSupabaseMode } from './mode'

/** Email OR phone (E.164, e.g. +14155550123). */
export type OtpContact = { email: string; phone?: never } | { phone: string; email?: never }

export interface StaffGrant {
  templeId: string
  role: Exclude<Role, 'devotee' | 'platform'>
}

export interface AuthSession {
  /** Domain user the app's guarded routes read (role = platform | highest staff role | devotee). */
  user: User
  staff: StaffGrant[]
  isPlatform: boolean
}

export interface OtpOptions {
  /** false for staff sign-in: never create an account from the console. Default true. */
  createUser?: boolean
  /** Extra profile data stored on first sign-up (user_metadata). */
  metadata?: Record<string, string | boolean | undefined>
}

export type OAuthProviderKey = 'google' | 'apple'
export type Unsubscribe = () => void

export interface AuthProvider {
  readonly kind: 'mock' | 'supabase'
  /** Send a 6-digit code to the email/phone. Rejects with a human-readable Error. */
  signInWithOtp(contact: OtpContact, opts?: OtpOptions): Promise<void>
  verifyOtp(contact: OtpContact, code: string): Promise<AuthSession>
  /** Redirects the browser; resolves only if the redirect could not start. */
  signInWithOAuth(provider: OAuthProviderKey): Promise<void>
  signOut(): Promise<void>
  getSession(): Promise<AuthSession | null>
  onAuthStateChange(cb: (session: AuthSession | null) => void): Unsubscribe
}

/** The code the demo accepts. Shown in the UI so nobody has to guess. */
export const MOCK_OTP_CODE = '123456'

const contactKey = (c: OtpContact) => ('email' in c && c.email ? c.email : (c as { phone: string }).phone)

function mockSession(user: User): AuthSession {
  const staff = user.role === 'devotee' || user.role === 'platform' ? [] : [{ templeId: user.homeTempleId ?? '', role: user.role }]
  return { user, staff, isPlatform: user.role === 'platform' }
}

/**
 * Mock auth: any email/phone works, the code is always 123456. Wraps the existing zustand
 * `useAuthStore` so every guarded route behaves exactly as before. `signInAsRole` is demo-only
 * (the admin role cards); it does not exist on the supabase provider.
 */
export const mockAuthProvider: AuthProvider & { signInAsRole(role: Role): Promise<AuthSession> } = {
  kind: 'mock',
  async signInWithOtp(contact) {
    if (!contactKey(contact).trim()) throw new Error('Enter your email or phone number.')
    await new Promise((r) => setTimeout(r, 400))
  },
  async verifyOtp(contact, code) {
    await new Promise((r) => setTimeout(r, 300))
    if (code !== MOCK_OTP_CODE) throw new Error(`That code is not right. In demo mode use ${MOCK_OTP_CODE}.`)
    await useAuthStore.getState().signIn(contactKey(contact))
    return mockSession(useAuthStore.getState().user!)
  },
  async signInAsRole(role) {
    await useAuthStore.getState().signIn('', role)
    return mockSession(useAuthStore.getState().user!)
  },
  async signInWithOAuth() {
    throw new Error('Social sign-in is available when the app is connected to a live backend.')
  },
  async signOut() {
    useAuthStore.getState().signOut()
  },
  async getSession() {
    const u = useAuthStore.getState().user
    return u ? mockSession(u) : null
  },
  onAuthStateChange(cb) {
    return useAuthStore.subscribe((s) => cb(s.user ? mockSession(s.user) : null))
  },
}

/* ------------------------------------------------------------------ supabase */

const ROLE_PRIORITY: StaffGrant['role'][] = ['admin', 'finance', 'board', 'committee', 'priest']

interface ProfileRow {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  country: string | null
  city: string | null
  home_temple_id: string | null
  preferred_language: string | null
  nakshatra: string | null
  gothra: string | null
  avatar_initials: string
  created_at: string
}

/** Builds the domain session for the signed-in auth user: profile + temple_members + platform_admins. */
async function loadSession(authUserId: string, email?: string | null, phone?: string | null): Promise<AuthSession> {
  const sb = await getSupabase()
  const [profile, members, platform] = await Promise.all([
    sb.from('profiles').select('*').eq('id', authUserId).maybeSingle(),
    sb.from('temple_members').select('temple_id,role').eq('user_id', authUserId),
    sb.from('platform_admins').select('user_id').eq('user_id', authUserId).maybeSingle(),
  ])
  const p = profile.data as ProfileRow | null
  const staff = ((members.data ?? []) as { temple_id: string; role: StaffGrant['role'] }[]).map((m) => ({ templeId: m.temple_id, role: m.role }))
  const isPlatform = Boolean(platform.data)
  const role: Role = isPlatform ? 'platform' : (ROLE_PRIORITY.find((r) => staff.some((s) => s.role === r)) ?? 'devotee')
  const name = p?.full_name ?? ''
  const country = p?.country === 'US' || p?.country === 'IN' || p?.country === 'GB' || p?.country === 'CA' ? p.country : 'Other'
  const user: User = {
    id: authUserId,
    role,
    name: name || (email ?? phone ?? 'Devotee'),
    email: p?.email ?? email ?? '',
    phone: p?.phone ?? phone ?? '',
    city: p?.city ?? undefined,
    country,
    homeTempleId: p?.home_temple_id ?? undefined,
    language: (p?.preferred_language ?? undefined) as LanguageCode | undefined,
    nakshatra: p?.nakshatra ?? undefined,
    gothra: p?.gothra ?? undefined,
    createdAt: p?.created_at ?? new Date().toISOString(),
    avatarInitials: p?.avatar_initials || (name || email || '?').slice(0, 1).toUpperCase(),
  }
  return { user, staff, isPlatform }
}

/**
 * Real auth through Supabase (email OTP, phone OTP via your SMS provider, Google/Apple OAuth).
 * UNTESTED AGAINST A LIVE PROJECT: written against the documented supabase-js v2 API.
 * It also mirrors the signed-in user into `useAuthStore` so existing route guards keep working.
 */
export const supabaseAuthProvider: AuthProvider = {
  kind: 'supabase',
  async signInWithOtp(contact, opts) {
    const sb = await getSupabase()
    const options = { shouldCreateUser: opts?.createUser ?? true, data: opts?.metadata }
    const { error } =
      'email' in contact && contact.email
        ? await sb.auth.signInWithOtp({ email: contact.email, options: { ...options, emailRedirectTo: window.location.origin } })
        : await sb.auth.signInWithOtp({ phone: (contact as { phone: string }).phone, options })
    if (error) throw new Error(friendly(error.message))
  },
  async verifyOtp(contact, code) {
    const sb = await getSupabase()
    const { data, error } =
      'email' in contact && contact.email
        ? await sb.auth.verifyOtp({ email: contact.email, token: code, type: 'email' })
        : await sb.auth.verifyOtp({ phone: (contact as { phone: string }).phone, token: code, type: 'sms' })
    if (error || !data.user) throw new Error(friendly(error?.message ?? 'Verification failed.'))
    const session = await loadSession(data.user.id, data.user.email, data.user.phone)
    useAuthStore.getState().setUser(session.user)
    return session
  },
  async signInWithOAuth(provider) {
    const sb = await getSupabase()
    const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/signin` } })
    if (error) throw new Error(friendly(error.message))
  },
  async signOut() {
    const sb = await getSupabase()
    await sb.auth.signOut()
    useAuthStore.getState().signOut()
  },
  async getSession() {
    const sb = await getSupabase()
    const { data } = await sb.auth.getSession()
    const u = data.session?.user
    if (!u) return null
    const session = await loadSession(u.id, u.email, u.phone)
    useAuthStore.getState().setUser(session.user)
    return session
  },
  onAuthStateChange(cb) {
    let unsub: Unsubscribe = () => undefined
    let cancelled = false
    void getSupabase().then((sb) => {
      if (cancelled) return
      const { data } = sb.auth.onAuthStateChange((_event, s) => {
        // Never call supabase from inside this callback synchronously (deadlock risk): defer.
        setTimeout(() => {
          if (!s?.user) {
            useAuthStore.getState().signOut()
            cb(null)
            return
          }
          void loadSession(s.user.id, s.user.email, s.user.phone).then((session) => {
            useAuthStore.getState().setUser(session.user)
            cb(session)
          })
        }, 0)
      })
      unsub = () => data.subscription.unsubscribe()
    })
    return () => {
      cancelled = true
      unsub()
    }
  },
}

/** Turns GoTrue's terse messages into something a devotee can act on. */
function friendly(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('rate limit') || m.includes('too many') || m.includes('security purposes')) return 'Please wait a minute before asking for another code.'
  if (m.includes('expired') || m.includes('invalid')) return 'That code is invalid or has expired. Request a new one.'
  if (m.includes('signups not allowed') || m.includes('not found')) return 'We could not find an account for that contact.'
  if (m.includes('phone') && m.includes('provider')) return 'Phone sign-in is not enabled yet. Please use email.'
  return msg
}

/** The provider for the current data mode. */
export function getAuthProvider(): AuthProvider {
  return isSupabaseMode() ? supabaseAuthProvider : mockAuthProvider
}

/** OAuth buttons only make sense against a live project. */
export const oauthAvailable = () => isSupabaseMode()
