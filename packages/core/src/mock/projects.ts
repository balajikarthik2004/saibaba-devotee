import type { Project } from '../types'
import { formatMoney } from '../money'
import { PROFILES, locBig, tag } from './profiles'
import type { TempleProfile } from './profiles'

interface Template {
  key: string
  title: string
  /** USD: target, raised, spent. */
  usd: [number, number, number]
  status: Project['status']
  notes: (m: (n: number) => string) => string[]
}

const TEMPLATES: Template[] = [
  {
    key: 'floor',
    title: 'Samadhi Mandir Marble Flooring',
    usd: [22000, 18040, 14600],
    status: 'in-progress',
    notes: (m) => [
      'Mason team begins the second phase once the festival season is over.',
      'Municipal work permit approved.',
      `Baba’s padukas canopy quoted separately at ${m(4200)} — not yet in scope.`,
    ],
  },
  {
    key: 'parking',
    title: 'Parking Extension',
    usd: [40000, 6000, 2150],
    status: 'in-progress',
    notes: (m) => [
      'Adds 48 spaces beside the temple — festival overflow currently parks on the street.',
      'Civil drawings complete; drainage review pending.',
      `Trustees approved a matching-gift campaign up to ${m(10000)}.`,
    ],
  },
  {
    key: 'kitchen',
    title: 'Annadanam Kitchen Upgrade',
    usd: [30000, 31200, 29450],
    status: 'completed',
    notes: () => [
      'Commercial range, walk-in cooler and new exhaust hood commissioned.',
      'Food-safety inspection passed on the first visit.',
      'Thursday annadanam capacity up from 250 to 600 plates.',
    ],
  },
  {
    key: 'dwarakamai',
    title: 'Dwarakamai & Dhuni Restoration',
    usd: [65000, 4800, 0],
    status: 'planned',
    notes: () => [
      'Faithful restoration of the Dwarakamai replica and its sacred dhuni.',
      'Awaiting a lead gift before work begins.',
      'Heritage architect consultation scheduled.',
    ],
  },
  {
    key: 'library',
    title: 'Sai Satcharitra Digital Library',
    usd: [5000, 3000, 2400],
    status: 'in-progress',
    notes: () => [
      '1,850 of roughly 3,000 titles catalogued by the youth volunteer team.',
      'Scanner and label printer purchased.',
      'Borrowing kiosk goes live once cataloguing crosses 90%.',
    ],
  },
]

/** Which templates each temple runs, and how big its version is relative to the flagship. */
const PLAN: Record<string, { keys: string[]; k: number }> = {
  tmp_sugarland: { keys: ['floor', 'parking', 'kitchen', 'dwarakamai', 'library'], k: 1 },
  tmp_fremont: { keys: ['floor', 'kitchen', 'library'], k: 0.7 },
  tmp_pune: { keys: ['floor', 'kitchen', 'dwarakamai', 'library'], k: 0.8 },
  tmp_hyderabad: { keys: ['kitchen', 'floor', 'library'], k: 0.5 },
  tmp_harrow: { keys: ['kitchen', 'library'], k: 0.45 },
  tmp_mississauga: { keys: ['parking', 'kitchen', 'library'], k: 0.6 },
}

function amount(usd: number, k: number, p: TempleProfile): number {
  const v = usd * k
  if (p.currency === 'USD') return Math.round(v / 10) * 10
  return locBig(v, p.currency)
}

function buildProjects(): Project[] {
  const out: Project[] = []
  for (const p of PROFILES) {
    const plan = PLAN[p.id]
    if (!plan) continue
    const m = (n: number) => formatMoney(amount(n, plan.k, p), p.currency)
    plan.keys.forEach((key, i) => {
      const t = TEMPLATES.find((x) => x.key === key)!
      const target = amount(t.usd[0], plan.k, p)
      const raised = amount(t.usd[1], plan.k, p)
      const spent = amount(t.usd[2], plan.k, p)
      out.push({
        id: `prj${tag(p)}_${String(i + 1).padStart(4, '0')}`,
        templeId: p.id,
        currency: p.currency,
        title: t.title,
        targetAmount: target,
        raisedAmount: raised,
        spentAmount: spent,
        progressPct: Math.min(100, Math.round((raised / target) * 100)),
        status: t.status,
        notes: t.notes(m),
      })
    })
  }
  return out
}

export const PROJECTS: Project[] = buildProjects()
