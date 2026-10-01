import type { CountryCode, LanguageCode, User } from '../types'
import { registerDevotee, updateDevotee } from '../api'
import { useAuthStore } from '../store/auth'
import { defaultPrefs, getPrefs, savePrefs } from '../features/community/notifications'
import { getSupabase, unwrap } from './client'
import { isSupabaseMode } from './mode'

/** Bump when the wording shown at sign-up changes, so each consent record names the text it agreed to. */
export const CONSENT_TEXT_VERSION = '2026-09-v1'

export interface SignupDetails {
  firstName: string
  lastName: string
  email: string
  phone: string
  country: CountryCode
  city: string
  language: LanguageCode
  homeTempleId?: string
  nakshatra?: string
  gothra?: string
  consent: {
    /** Required: has seen the privacy notice. */
    privacy: boolean
    /** Each optional channel is a SEPARATE, unticked-by-default choice. */
    email: boolean
    sms: boolean
    whatsapp: boolean
  }
}

/**
 * Finishes account creation after the OTP is verified.
 *   mock     -> registerDevotee + consent recorded in the mock notification prefs
 *   supabase -> updates the profile row the auth trigger created, and notification_prefs
 * Consent is recorded with a timestamp and the version of the text shown (DPDP / UK GDPR support;
 * engineering considerations, not legal advice). UNTESTED AGAINST A LIVE PROJECT for supabase mode.
 */
export async function completeSignup(userId: string, d: SignupDetails): Promise<User> {
  if (!d.consent.privacy) throw new Error('Please confirm you have read the privacy notice.')
  const now = new Date().toISOString()

  if (!isSupabaseMode()) {
    const created = await registerDevotee({
      firstName: d.firstName,
      lastName: d.lastName,
      email: d.email,
      phone: d.phone,
      city: d.city,
      nakshatra: d.nakshatra,
      gothra: d.gothra,
    })
    const user = await updateDevotee(created.id, { country: d.country, language: d.language, homeTempleId: d.homeTempleId })
    useAuthStore.getState().setUser(user)
    const prefs = { ...defaultPrefs(user.id), ...(await getPrefs(user.id)) }
    prefs.channels = { ...prefs.channels, email: d.consent.email, sms: d.consent.sms, whatsapp: d.consent.whatsapp }
    prefs.consent = {
      ...(d.consent.sms ? { sms: { at: now } } : {}),
      ...(d.consent.whatsapp ? { whatsapp: { at: now } } : {}),
    }
    await savePrefs(prefs)
    return user
  }

  const sb = await getSupabase()
  const fullName = `${d.firstName} ${d.lastName}`.trim()
  unwrap(
    await sb
      .from('profiles')
      .update({
        full_name: fullName,
        email: d.email || null,
        phone: d.phone || null,
        country: d.country,
        city: d.city || null,
        preferred_language: d.language,
        home_temple_id: d.homeTempleId ?? null,
        nakshatra: d.nakshatra || null,
        gothra: d.gothra || null,
        avatar_initials: fullName.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
        consent_privacy_at: now,
        consent_text_version: CONSENT_TEXT_VERSION,
        consent_email: d.consent.email,
        consent_sms: d.consent.sms,
        consent_whatsapp: d.consent.whatsapp,
        consent_recorded_at: now,
      })
      .eq('id', userId)
      .select('id'),
  )
  unwrap(
    await sb
      .from('notification_prefs')
      .upsert({
        user_id: userId,
        channels: { email: d.consent.email, sms: d.consent.sms, whatsapp: d.consent.whatsapp, push: false },
      })
      .select('user_id'),
  )
  const session = await (await import('./auth')).supabaseAuthProvider.getSession()
  if (!session) throw new Error('Signed out while finishing your account. Please sign in again.')
  return session.user
}
