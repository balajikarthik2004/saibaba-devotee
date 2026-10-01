import type { ParayanPlan, SaiAssurance, VratProgram } from '../../types'

const CUSTOMS_NOTE =
  'Customs differ from family to family and from temple to temple. What follows is the widely shared form. Baba himself emphasised love, sincerity and feeding the hungry over any fixed ritual, so if you cannot do every step, do what you can with a full heart.'

const COMMON_STEPS = [
  {
    title: 'Begin the morning clean and calm',
    body: 'Bathe, put on clean clothes and keep a quiet moment before the day starts. Many people keep a light fast or simple meal on the day; do what suits your health.',
  },
  {
    title: 'Keep Baba before you',
    body: 'Place a photo or murti of Baba on a clean, simple seat in your home or shrine.',
  },
  {
    title: 'Light a lamp',
    body: 'Light a diya and, if you like, incense. Sit for a minute and say why you are observing the vrat.',
  },
  {
    title: 'Offer flowers and naivedya',
    body: 'Offer a few flowers and something simple to eat, such as fruit, sugar or a sweet. Share it with family afterwards as prasad.',
  },
  {
    title: 'Read or recite',
    body: 'Read the vrat katha or a few verses from a book you love, or chant Baba’s name. Finish with the aarti if you know it.',
  },
]

export const VRAT_PROGRAM_SEED: VratProgram[] = [
  {
    id: 'vrat_nine',
    key: 'nine-thursday',
    name: 'Sai Nine-Thursday Vrat',
    weeks: 9,
    weekday: 4,
    summary:
      'Nine consecutive Thursdays of simple prayer, devotion and giving, offered with a wish or simply in gratitude. The best-known Sai vrat.',
    steps: [
      ...COMMON_STEPS,
      {
        title: 'On the 9th Thursday, feed those in need',
        body: 'The widely shared practice is to feed at least five people who are hungry, or to give food to a temple kitchen, on the final Thursday. Many also share a small booklet or a printed copy of the katha with others. Customs vary, so follow your family’s tradition.',
      },
    ],
    kathaSummary:
      `${CUSTOMS_NOTE}\n\nThe vrat is usually taken up after a short sankalp, a personal resolve to observe nine Thursdays without a break, offering worship and sharing food. Devotees say it is not a bargain with God but a practice of steadiness. If a Thursday is missed because of illness, travel or another unavoidable reason, many simply continue the count the next Thursday rather than starting over; ask your temple priest if you would like guidance for your own situation.`,
    udyapanGuidance:
      'Udyapan is the closing of the vrat. On the 9th Thursday, after your usual morning worship, thank Baba for the nine weeks, offer a special naivedya, and feed some people in need. Many families also make a small donation to the temple or sponsor a short puja of thanksgiving. Whatever you offer, let it be simple and sincere. If you would like a priest to perform a udyapan puja for you, you can sponsor one through the temple.',
  },
  {
    id: 'vrat_eleven',
    key: 'eleven-thursday',
    name: 'Sai Eleven-Thursday Vrat',
    weeks: 11,
    weekday: 4,
    summary:
      'A longer form of the Thursday vrat, eleven weeks of steady devotion. Observed by those who wish to offer a little more time and discipline.',
    steps: [
      ...COMMON_STEPS,
      {
        title: 'On the 11th Thursday, feed those in need',
        body: 'On the final Thursday, feed people who are hungry or give to the temple kitchen. As with the nine-week vrat, this is a widely shared custom and not a rule; give according to your means.',
      },
    ],
    kathaSummary:
      `${CUSTOMS_NOTE}\n\nThe eleven-Thursday vrat follows the same outline as the nine-Thursday vrat with two more weeks of practice. Some devotees choose it as a longer commitment after completing the shorter one. If a week is missed, the count simply continues on the next Thursday.`,
    udyapanGuidance:
      'On the 11th Thursday, offer your usual morning worship, thank Baba with a few quiet minutes, share a special naivedya and feed people in need. A temple priest can help you perform a short udyapan puja if you would like one. The heart of udyapan is gratitude, not expense.',
  },
]

/** Sai Satcharitra is read as 51 chapters. Seven-day split: 8,7,7,7,7,8,7. */
const SAPTAH_SPLIT: [number, number][] = [
  [1, 8],
  [9, 15],
  [16, 22],
  [23, 29],
  [30, 36],
  [37, 44],
  [45, 51],
]
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)

export const PARAYAN_PLAN_SEED: ParayanPlan[] = [
  {
    id: 'parayan_saptah',
    key: 'saptah',
    name: 'Saptah — 7 days',
    chapters: 51,
    days: 7,
    summary:
      'The traditional week-long parayan: all 51 chapters of the Sai Satcharitra in seven days, about seven chapters a day. Many begin on a Thursday.',
    schedule: SAPTAH_SPLIT.map(([a, b], i) => ({ day: i + 1, chapters: range(a, b) })),
  },
  {
    id: 'parayan_daily',
    key: 'chapter-a-day',
    name: 'One chapter a day — 51 days',
    chapters: 51,
    days: 51,
    summary: 'A gentle, sustainable pace: one chapter each day, finishing in just over seven weeks.',
    schedule: range(1, 51).map((c) => ({ day: c, chapters: [c] })),
  },
  {
    id: 'parayan_custom',
    key: 'custom',
    name: 'At my own pace',
    chapters: 51,
    days: 0,
    summary: 'Read any chapter any day. Tick them off as you go; no schedule, no pressure.',
    schedule: [],
  },
]

/**
 * The eleven assurances traditionally attributed to Baba. Wording here is an original
 * paraphrase; the traditional lists vary slightly in order and phrasing.
 */
export const ASSURANCE_SEED: SaiAssurance[] = [
  { n: 1, text: 'Whoever sets foot in Shirdi with a sincere heart will find their troubles beginning to ease.' },
  { n: 2, text: 'The tired and sorrowful will find joy when they come to my samadhi with trust.' },
  { n: 3, text: 'Even after I leave this body, I remain active and watchful for those who love me.' },
  { n: 4, text: 'My tomb will bless and answer the needs of my devotees.' },
  { n: 5, text: 'From my samadhi I will continue to guide and respond to those who call on me.' },
  { n: 6, text: 'I am alive and ever-present to help all who turn to me and take refuge in me.' },
  { n: 7, text: 'Look to me with faith, and I will look to you.' },
  { n: 8, text: 'If you ask for my help or counsel, it will be given to you without delay.' },
  { n: 9, text: 'In the home of my devotee there will be no lack of food or clothing.' },
  { n: 10, text: 'Whoever thinks of me and places their burden in my hands, I will help carry it.' },
  { n: 11, text: 'Hold to shraddha and saburi, faith and patience, and I will be with you always.' },
]
