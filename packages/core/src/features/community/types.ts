import type { NotificationLog, NotificationPref, PrayerRequest } from '../../types.sai'

/** Automatic moderation hints the admin queue shows. */
export type PrayerFlag = 'link' | 'phone' | 'email' | 'profanity' | 'too-long' | 'medical-detail'

/** A prayer plus moderation metadata. */
export interface Prayer extends PrayerRequest {
  flags: PrayerFlag[]
  moderationReason?: string
  moderatedAt?: string
  /** Withdrawn by its author — kept for audit, never shown. */
  withdrawn?: boolean
}

export type PrayerCategory = PrayerRequest['category']
export type PrayerVisibility = PrayerRequest['visibility']

/** Preferences plus the explicit opt-in records WhatsApp / SMS require. */
export interface CommunityPrefs extends NotificationPref {
  /** Present only when the devotee ticked the explicit consent box. */
  consent: { sms?: { at: string }; whatsapp?: { at: string } }
}

export interface NotificationLogEntry extends NotificationLog {
  broadcastId?: string
  /** Masked recipient, e.g. "r***@example.com". */
  recipient?: string
  body?: string
  note?: string
}
