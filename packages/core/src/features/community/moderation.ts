import type { PrayerFlag } from './types'

const PROFANITY = ['damn', 'hell', 'crap', 'stupid', 'idiot', 'fool', 'shit', 'fuck', 'bastard', 'bitch']
const MEDICAL =
  /\b(cancer|tumou?r|hiv|aids|diagnos\w*|chemo\w*|surgery|dialysis|schizophreni\w*|depress\w*|suicid\w*|pregnan\w*|miscarriage)\b/i
const MAX_LEN = 600

/**
 * Cheap, explainable checks — a human always makes the final call. Flags never reject
 * a prayer on their own; they tell the moderator where to look.
 */
export function moderateText(body: string, visibility: 'public' | 'temple' | 'private'): PrayerFlag[] {
  const flags: PrayerFlag[] = []
  const text = body.toLowerCase()
  const shared = visibility !== 'private'
  if (/(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|in|co|info)\b)/i.test(body)) flags.push('link')
  if (shared && /(\+?\d[\d\s().-]{8,}\d)/.test(body)) flags.push('phone')
  if (shared && /[^\s@]+@[^\s@]+\.[^\s@]+/.test(body)) flags.push('email')
  if (PROFANITY.some((w) => new RegExp(`\\b${w}\\b`).test(text))) flags.push('profanity')
  if (body.length > MAX_LEN) flags.push('too-long')
  if (shared && MEDICAL.test(body)) flags.push('medical-detail')
  return flags
}

export const FLAG_LABEL: Record<PrayerFlag, string> = {
  link: 'Contains a link',
  phone: 'Looks like a phone number',
  email: 'Contains an email address',
  profanity: 'Possible unkind language',
  'too-long': 'Very long',
  'medical-detail': 'Medical detail — check it is the author’s own',
}
