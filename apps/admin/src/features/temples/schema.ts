import { z } from 'zod'
import type { Temple } from '@saibaba/core/types'

const num = (min: number, max: number, label: string) =>
  z.coerce.number({ error: `${label} must be a number` }).min(min, `${label} is out of range`).max(max, `${label} is out of range`)

export const templeSchema = z.object({
  name: z.string().trim().min(3, 'Enter the temple’s name'),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]*$/, 'Lowercase letters, numbers and hyphens only')
    .optional(),
  about: z.string().trim().min(10, 'Add a sentence or two about the temple'),
  email: z.string().trim().email('Enter a valid email'),
  phone: z.string().trim().min(5, 'Enter a phone number'),
  address: z.string().trim().min(3, 'Enter the street address'),
  city: z.string().trim().min(2, 'Enter the city'),
  state: z.string().trim().min(1, 'Enter the state or region'),
  zip: z.string().trim().min(2, 'Enter the postcode'),
  country: z.enum(['US', 'IN', 'GB', 'CA']),
  timezone: z.string().min(3, 'Choose a timezone'),
  lat: num(-90, 90, 'Latitude'),
  lng: num(-180, 180, 'Longitude'),
  currency: z.enum(['USD', 'INR', 'GBP', 'CAD']),
  taxRegime: z.enum(['us-501c3', 'in-80g', 'uk-giftaid', 'ca-cra']),
  taxIdLabel: z.string().trim().min(2, 'Name the tax id (for example EIN)'),
  taxId: z.string().trim().min(3, 'Enter the registration number'),
  morning: z.string().trim().min(3, 'Enter morning hours'),
  evening: z.string().trim().min(3, 'Enter evening hours'),
  languages: z.array(z.enum(['en', 'hi', 'mr', 'te', 'gu', 'ta', 'es'])).min(1, 'Choose at least one language'),
  payments: z
    .array(z.enum(['stripe', 'razorpay', 'upi', 'zelle', 'ach', 'cheque', 'bank-transfer', 'cash']))
    .min(1, 'Choose at least one way to give'),
  shipsTo: z.array(z.enum(['US', 'IN', 'GB', 'CA'])),
  spaces: z.array(z.string()),
})

export type TempleForm = z.infer<typeof templeSchema>

/** What the platform team gets by default for each tax regime. */
export function formFromTemple(t: Temple): TempleForm {
  return {
    name: t.name,
    slug: t.slug,
    about: t.about,
    email: t.email,
    phone: t.phone,
    address: t.address,
    city: t.city,
    state: t.state,
    zip: t.zip,
    country: t.country,
    timezone: t.timezone,
    lat: t.lat,
    lng: t.lng,
    currency: t.currency,
    taxRegime: t.taxRegime,
    taxIdLabel: t.taxIdLabel,
    taxId: t.taxId,
    morning: t.timings.morning,
    evening: t.timings.evening,
    languages: t.languages,
    payments: t.payments,
    shipsTo: t.shipsTo,
    spaces: t.spaces.map((s) => s.key),
  }
}

/** The standard Sai temple places of worship a new temple can tick. */
export const SPACE_PRESETS = [
  { key: 'samadhi', name: 'Samadhi Mandir', blurb: 'The main sanctum with Baba’s murti, where the daily aartis are offered.' },
  { key: 'dwarakamai', name: 'Dwarakamai', blurb: 'Replica of Baba’s mosque home, with the sacred dhuni (fire) and udi.' },
  { key: 'chavadi', name: 'Chavadi', blurb: 'The hall of the Thursday and Saturday night processions.' },
  { key: 'lendi', name: 'Lendi Baug', blurb: 'A quiet garden for meditation and the Nandadeep lamp.' },
  { key: 'ganapati', name: 'Ganapati Shrine', blurb: 'Vighneshwara, invoked before every puja.' },
  { key: 'datta', name: 'Dattatreya Shrine', blurb: 'Sri Dattatreya, the Guru tradition Baba is honoured within.' },
  { key: 'maruti', name: 'Maruti Shrine', blurb: 'Hanuman, protector of the temple.' },
  { key: 'shani', name: 'Shani Shrine', blurb: 'Offerings for steadiness through hard times.' },
]

export function templeFromForm(f: TempleForm): Omit<Temple, 'id' | 'status' | 'isDemo'> & { slug?: string } {
  const locale = { US: 'en-US', IN: 'en-IN', GB: 'en-GB', CA: 'en-CA' }[f.country]
  return {
    slug: f.slug || undefined,
    name: f.name,
    about: f.about,
    email: f.email,
    phone: f.phone,
    address: f.address,
    city: f.city,
    state: f.state,
    zip: f.zip,
    country: f.country,
    timezone: f.timezone,
    lat: f.lat,
    lng: f.lng,
    currency: f.currency,
    locale,
    taxRegime: f.taxRegime,
    taxIdLabel: f.taxIdLabel,
    taxId: f.taxId,
    timings: { morning: f.morning, evening: f.evening },
    languages: f.languages,
    payments: f.payments,
    shipsTo: f.shipsTo,
    spaces: SPACE_PRESETS.filter((s) => f.spaces.includes(s.key)),
    logoUrl: '/logo.svg',
    deities: ['Sai Baba'],
  } as Omit<Temple, 'id' | 'status' | 'isDemo'> & { slug?: string }
}
