/**
 * Deterministic, fictional seed for the aarti slice.
 * Aarti lyrics are NOT reproduced: each text carries at most a recognisable opening line
 * and placeholder lines; every temple pastes its own verified copy in the admin CMS.
 */
import type {
  AartiKey,
  AartiRecording,
  AartiSlot,
  AartiText,
  FestivalDate,
  LanguageCode,
  LiveStream,
} from '../../types.sai'
import { TEMPLES } from '../../mock/temple'

/** AartiText plus an optional Latin-script rendering, line-for-line. */
export interface AartiTextEx extends AartiText {
  transliteration?: string[]
}

const STANDARD: AartiKey[] = ['kakad', 'madhyan', 'dhoop', 'shej']

interface Times {
  kakad: string
  madhyan: string
  dhoop: string
  shej: string
  special: string
}

const TIMES: Record<string, Times> = {
  tmp_sugarland: { kakad: '06:00', madhyan: '12:00', dhoop: '18:30', shej: '20:30', special: '19:30' },
  tmp_fremont: { kakad: '06:30', madhyan: '12:00', dhoop: '19:00', shej: '20:30', special: '19:30' },
  tmp_pune: { kakad: '05:15', madhyan: '12:00', dhoop: '18:15', shej: '21:00', special: '19:45' },
  tmp_hyderabad: { kakad: '05:30', madhyan: '12:00', dhoop: '18:30', shej: '21:00', special: '19:45' },
  tmp_harrow: { kakad: '06:00', madhyan: '12:00', dhoop: '18:00', shej: '20:00', special: '19:00' },
  tmp_mississauga: { kakad: '06:00', madhyan: '12:00', dhoop: '18:30', shej: '20:30', special: '19:30' },
}

const META: Record<AartiKey, { name: string; durationMin: number; sponsorable: boolean; description: string }> = {
  kakad: {
    name: 'Kakad Aarti',
    durationMin: 45,
    sponsorable: false,
    description: 'The dawn aarti that wakes Baba — lamps, song and a quiet start to the day.',
  },
  madhyan: {
    name: 'Madhyan Aarti',
    durationMin: 40,
    sponsorable: true,
    description: 'The midday aarti and naivedya offering, followed by prasad.',
  },
  dhoop: {
    name: 'Dhoop Aarti',
    durationMin: 30,
    sponsorable: true,
    description: 'The evening aarti at sunset, with incense and lamps.',
  },
  shej: {
    name: 'Shej Aarti',
    durationMin: 30,
    sponsorable: false,
    description: 'The night aarti, when Baba is put to rest.',
  },
  special: {
    name: 'Thursday palki procession',
    durationMin: 60,
    sponsorable: true,
    description: "Baba's day — a palki procession with bhajans on Thursday evening.",
  },
}

export function seedSlots(): AartiSlot[] {
  const out: AartiSlot[] = []
  for (const t of TEMPLES) {
    const times = TIMES[t.id] ?? TIMES.tmp_sugarland!
    for (const key of STANDARD) {
      out.push({
        id: `aslot_${t.id}_${key}`,
        templeId: t.id,
        key,
        name: META[key].name,
        time: times[key],
        days: [0, 1, 2, 3, 4, 5, 6],
        durationMin: META[key].durationMin,
        description: META[key].description,
        active: true,
        sponsorable: META[key].sponsorable,
      })
    }
    out.push({
      id: `aslot_${t.id}_special`,
      templeId: t.id,
      key: 'special',
      name: META.special.name,
      time: times.special,
      days: [4],
      durationMin: META.special.durationMin,
      description: META.special.description,
      active: true,
      sponsorable: META.special.sponsorable,
    })
  }
  return out
}

/* ------------------------------------------------------------------- texts */

const SOURCE = 'Temple to supply verified text'

/** Opening line only (a recognisable title) — [devanagari, latin]. Null = temple supplies. */
const OPENING: Record<string, { dev: string; lat: string } | null> = {
  kakad: { dev: 'जोडोनिया कर चरणी ठेविला माथा', lat: 'Jodoniya kar charani thevila maatha' },
  madhyan: { dev: 'आरती साईं बाबा, सौख्यदातार जीवा', lat: 'Aarti Sai Baba, saukhyadatar jeeva' },
  dhoop: { dev: 'आरती साईं बाबा, सौख्यदातार जीवा', lat: 'Aarti Sai Baba, saukhyadatar jeeva' },
  shej: null,
  special: null,
}

const TITLES: Record<string, Record<'en' | 'hi' | 'mr', string>> = {
  kakad: { en: 'Kakad Aarti', hi: 'काकड़ आरती', mr: 'काकड आरती' },
  madhyan: { en: 'Madhyan Aarti', hi: 'मध्यान्ह आरती', mr: 'माध्यान्ह आरती' },
  dhoop: { en: 'Dhoop Aarti', hi: 'धूप आरती', mr: 'धूप आरती' },
  shej: { en: 'Shej Aarti', hi: 'शेज आरती', mr: 'शेज आरती' },
  special: { en: 'Palki procession bhajans', hi: 'पालखी भजन', mr: 'पालखी भजन' },
}

const PLACEHOLDER: Record<'en' | 'hi' | 'mr', (n: number) => string> = {
  en: (n) => `[Verse ${n} — temple to supply]`,
  hi: (n) => `[पद ${n} — मंदिर द्वारा उपलब्ध कराया जाएगा]`,
  mr: (n) => `[कडवे ${n} — मंदिराकडून उपलब्ध केले जाईल]`,
}

export function seedTexts(): AartiTextEx[] {
  const out: AartiTextEx[] = []
  for (const key of [...STANDARD, 'special'] as const) {
    const open = OPENING[key]
    for (const lang of ['en', 'hi', 'mr'] as const) {
      const ph = PLACEHOLDER[lang]
      const first =
        lang === 'en'
          ? (open?.lat ?? '[Opening line — temple to supply]')
          : (open?.dev ?? ph(1))
      const lines = [first, ph(2), ph(3), ph(4)]
      const isDev = lang !== 'en'
      out.push({
        id: `atext_${key}_${lang}`,
        key,
        title: TITLES[key]![lang],
        language: lang as LanguageCode,
        script: isDev ? 'devanagari' : 'latin',
        lines,
        source: SOURCE,
        transliteration: isDev
          ? [open?.lat ?? '[Opening line — temple to supply]', '[Verse 2 — temple to supply]', '[Verse 3 — temple to supply]', '[Verse 4 — temple to supply]']
          : undefined,
      })
    }
  }
  return out
}

/* ----------------------------------------------------------- live + replays */

export const DEMO_EMBED = 'https://www.youtube.com/embed/live_stream?channel=DEMO'

export function seedStreamBase(): LiveStream[] {
  return TEMPLES.map((t) => ({
    templeId: t.id,
    provider: 'youtube' as const,
    embedUrl: DEMO_EMBED,
    isLive: false,
    replayPlaylistUrl: 'https://www.youtube.com/playlist?list=DEMO',
  }))
}

export function seedRecordings(): AartiRecording[] {
  const days = ['2026-09-27', '2026-09-28', '2026-09-29']
  const out: AartiRecording[] = []
  for (const t of TEMPLES) {
    days.forEach((date, i) => {
      const key: AartiKey = (['kakad', 'madhyan', 'dhoop'] as const)[i]!
      out.push({
        id: `arec_${t.id}_${date}_${key}`,
        templeId: t.id,
        slotKey: key,
        date,
        title: `${META[key].name} — ${date}`,
        url: 'https://www.youtube.com/watch?v=DEMO_RECORDING',
        durationSec: 1500 + i * 420,
      })
    })
    out.push({
      id: `arec_${t.id}_2026-09-24_special`,
      templeId: t.id,
      slotKey: 'special',
      date: '2026-09-24',
      title: 'Thursday palki procession — 2026-09-24',
      url: 'https://www.youtube.com/watch?v=DEMO_RECORDING',
      durationSec: 3300,
    })
  }
  return out
}

/* --------------------------------------------------------------- festivals */

const NOTE = "Confirm with your temple's panchang."

const FEST: { key: FestivalDate['key']; name: string; dates: Record<number, [string, string?]> }[] = [
  { key: 'ram-navami', name: 'Ram Navami', dates: { 2026: ['2026-03-26'], 2027: ['2027-04-15'] } },
  { key: 'guru-purnima', name: 'Guru Purnima', dates: { 2026: ['2026-07-29'], 2027: ['2027-07-18'] } },
  {
    key: 'vijayadashami',
    name: 'Vijayadashami (Baba Punyatithi)',
    dates: { 2026: ['2026-10-20'], 2027: ['2027-10-09'] },
  },
  { key: 'datta-jayanti', name: 'Datta Jayanti', dates: { 2026: ['2026-12-23'], 2027: ['2027-12-12'] } },
]

export function seedFestivals(): FestivalDate[] {
  const out: FestivalDate[] = []
  for (const f of FEST) {
    for (const [year, [date, endDate]] of Object.entries(f.dates)) {
      out.push({
        id: `fest_${f.key}_${year}`,
        templeId: null,
        key: f.key,
        name: f.name,
        date,
        endDate,
        note: NOTE,
        verified: false,
      })
    }
  }
  out.push({
    id: 'fest_other_tmp_sugarland_2026',
    templeId: 'tmp_sugarland',
    key: 'other',
    name: 'Annual palki utsav (demo)',
    date: '2026-11-14',
    note: NOTE,
    verified: false,
  })
  return out
}
