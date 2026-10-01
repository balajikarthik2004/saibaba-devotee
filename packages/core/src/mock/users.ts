import type { FamilyMember, FamilyTree, User } from '../types'
import type { LanguageCode } from '../types.sai'
import { chance, id, int, pick, rng } from './seed'
import { FLAGSHIP_ID, PROFILES, PROFILE_BY_ID, tag } from './profiles'
import type { TempleProfile } from './profiles'
import { TEMPLE_BY_ID } from './temple'

export const NAKSHATRAS = [
  'Ashwini',
  'Bharani',
  'Krittika',
  'Rohini',
  'Mrigashira',
  'Ardra',
  'Punarvasu',
  'Pushya',
  'Ashlesha',
  'Magha',
  'Purva Phalguni',
  'Uttara Phalguni',
  'Hasta',
  'Chitra',
  'Swati',
  'Vishakha',
  'Anuradha',
  'Jyeshtha',
  'Moola',
  'Purva Ashadha',
  'Uttara Ashadha',
  'Shravana',
  'Dhanishta',
  'Shatabhisha',
  'Purva Bhadrapada',
  'Uttara Bhadrapada',
  'Revati',
] as const

export const GOTHRAS = [
  'Bharadwaja',
  'Kashyapa',
  'Vashishta',
  'Atri',
  'Vishwamitra',
  'Gautama',
  'Jamadagni',
  'Agastya',
  'Srivatsa',
  'Kaundinya',
  'Harita',
  'Sandilya',
] as const

/** The flagship's localities — kept for the screens that still import a single list. */
export const CITIES: { city: string; zip: string }[] = PROFILES[0]!.localities

/**
 * ~40 devotees across four countries. Names are fictional and deliberately mixed —
 * Gujarati, Telugu, Marathi, Tamil, Hindi and Punjabi households, and devotees with no
 * Indian background at all, because Baba's door is open to everyone.
 */
interface Seed {
  name: string
  lang: LanguageCode
  /** Has filled in nakshatra + gothra. A minority — these fields are optional. */
  vedic?: boolean
}

const HOME: Record<string, Seed[]> = {
  tmp_sugarland: [
    { name: 'Hiren Patel', lang: 'gu' },
    { name: 'Lakshmi Reddy', lang: 'te', vedic: true },
    { name: 'Rajesh Kulkarni', lang: 'mr' },
    { name: 'Anita Sharma', lang: 'hi' },
    { name: 'Suresh Venkatesan', lang: 'ta', vedic: true },
    { name: 'Megan Holloway', lang: 'en' },
    { name: 'Harpreet Gill', lang: 'en' },
    { name: 'Priya Desai', lang: 'gu' },
    { name: 'Kiran Naidu', lang: 'te' },
    { name: 'David Thompson', lang: 'en' },
  ],
  tmp_fremont: [
    { name: 'Vikram Rao', lang: 'te' },
    { name: 'Neha Gupta', lang: 'hi' },
    { name: 'Arvind Subramanian', lang: 'ta', vedic: true },
    { name: 'Jasmine Kaur', lang: 'en' },
    { name: 'Michael Chen', lang: 'en' },
    { name: 'Smita Joshi', lang: 'mr' },
  ],
  tmp_pune: [
    { name: 'Sachin Deshmukh', lang: 'mr' },
    { name: 'Mangal Kulkarni', lang: 'mr', vedic: true },
    { name: 'Prasad Joshi', lang: 'mr' },
    { name: 'Vaishali Pawar', lang: 'mr' },
    { name: 'Rohan Bhosale', lang: 'mr' },
    { name: 'Anjali Jadhav', lang: 'hi' },
    { name: 'Nitin Gokhale', lang: 'mr' },
  ],
  tmp_hyderabad: [
    { name: 'Srinivas Reddy', lang: 'te' },
    { name: 'Padma Naidu', lang: 'te', vedic: true },
    { name: 'Venkat Rao', lang: 'te' },
    { name: 'Sujatha Murthy', lang: 'te' },
    { name: 'Kiran Chowdary', lang: 'te' },
    { name: 'Swathi Pillai', lang: 'en' },
  ],
  tmp_harrow: [
    { name: 'Dipak Mehta', lang: 'gu' },
    { name: 'Nisha Shah', lang: 'gu' },
    { name: 'Rakesh Thakkar', lang: 'gu', vedic: true },
    { name: 'Sarah Mitchell', lang: 'en' },
    { name: 'Amit Trivedi', lang: 'hi' },
  ],
  tmp_mississauga: [
    { name: 'Jagdeep Sandhu', lang: 'en' },
    { name: 'Shilpa Patel', lang: 'gu' },
    { name: 'Karthik Raman', lang: 'ta' },
    { name: 'Emily Carter', lang: 'en' },
    { name: 'Manoj Bhatt', lang: 'hi' },
    { name: 'Sunita Menon', lang: 'en', vedic: true },
  ],
}

export const initialsOfName = (name: string) =>
  name
    .replace(/^Pt\.\s*/, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')

const emailOf = (name: string) => `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@mail.example`

export function phoneFor(p: TempleProfile, r: () => number): string {
  const n = (a: number, b: number) => a + Math.floor(r() * (b - a + 1))
  if (p.country === 'IN') return `+91 ${n(70000, 99999)} ${n(10000, 99999)}`
  if (p.country === 'GB') return `+44 7${n(100, 999)} ${n(100000, 999999)}`
  const area = p.country === 'CA' ? ['905', '416', '647'] : p.id === 'tmp_fremont' ? ['510', '408'] : ['281', '832', '713']
  return `(${area[Math.floor(r() * area.length)]}) ${n(200, 999)}-${n(1000, 9999)}`
}

const slugName = (n: string) => n.replace(/^Pt\.\s*/, '').split(' ')[0]!.toLowerCase()

function buildUsers(): User[] {
  const r = rng(20260817)
  const users: User[] = []
  let n = 0
  let fam = 0

  for (const p of PROFILES) {
    const seeds = HOME[p.id] ?? []
    seeds.forEach((s, i) => {
      n++
      const loc = p.localities[i % p.localities.length]!
      const hasFamily = chance(r, 62)
      if (hasFamily) fam++
      const u: User = {
        id: id('usr', n),
        role: 'devotee',
        name: s.name,
        email: emailOf(s.name),
        phone: phoneFor(p, r),
        address:
          p.country === 'IN'
            ? `${int(r, 2, 88)}, ${pick(r, p.streets)}`
            : `${int(r, 100, 9899)} ${pick(r, p.streets)}`,
        city: loc.city,
        state:
          p.country === 'IN'
            ? p.id === 'tmp_pune'
              ? 'Maharashtra'
              : 'Telangana'
            : p.country === 'GB'
              ? 'Greater London'
              : p.country === 'CA'
                ? 'ON'
                : p.id === 'tmp_fremont'
                  ? 'CA'
                  : 'TX',
        zip: loc.zip,
        country: p.country,
        homeTempleId: p.id,
        language: s.lang,
        dob: new Date(int(r, 1958, 1996), int(r, 0, 11), int(r, 1, 28)).toISOString(),
        familyTreeId: hasFamily ? id('fam', fam) : undefined,
        createdAt: new Date(int(r, 2014, 2025), int(r, 0, 11), int(r, 1, 28)).toISOString(),
        avatarInitials: initialsOfName(s.name),
      }
      // Nakshatra and gothra are optional — most devotees never fill them in.
      if (s.vedic) {
        u.nakshatra = pick(r, NAKSHATRAS)
        u.gothra = pick(r, GOTHRAS)
      }
      users.push(u)
    })
  }

  // Staff: every role at every temple. The flagship keeps the original bare ids
  // (`usr_admin` …) that other code already resolves; the rest carry the temple's short code.
  for (const p of PROFILES) {
    const t = tag(p)
    const tt = TEMPLE_BY_ID.get(p.id)!
    const base = {
      country: p.country,
      homeTempleId: p.id,
      language: 'en' as LanguageCode,
      address: tt.address,
      city: tt.city,
      state: tt.state,
      zip: tt.zip,
    }
    const mk = (idStr: string, role: User['role'], seed: { name: string }, email: string, k: number): User => ({
      id: idStr,
      role,
      name: seed.name,
      email,
      phone: phoneFor(p, r),
      ...base,
      createdAt: new Date(2012 + (k % 8), (k * 3) % 12, 5 + k).toISOString(),
      avatarInitials: initialsOfName(seed.name),
    })
    users.push(
      mk(`usr_admin${t}`, 'admin', p.admin, `admin@${p.domain}`, p.index + 1),
      mk(`usr_board${t}`, 'board', p.board, `board@${p.domain}`, p.index + 2),
      mk(`usr_priest${t}`, 'priest', p.priests[0]!, `${slugName(p.priests[0]!.name)}@${p.domain}`, p.index + 3),
      mk(`usr_finance${t}`, 'finance', p.finance, `accounts@${p.domain}`, p.index + 4),
      mk(`usr_committee${t}`, 'committee', p.committee, `pujacommittee@${p.domain}`, p.index + 5),
    )
  }

  // One platform operator: onboards temples and sees across all of them.
  users.push({
    id: 'usr_platform',
    role: 'platform',
    name: 'Anika Rao',
    email: 'platform@saibaba.org',
    phone: '(281) 555-0199',
    country: 'US',
    language: 'en',
    createdAt: new Date(2024, 0, 10).toISOString(),
    avatarInitials: 'AR',
  })

  return users
}

export const USERS: User[] = buildUsers()

export const DEVOTEES: User[] = USERS.filter((u) => u.role === 'devotee')

/** Devotees whose home temple is `templeId`. */
export const devoteesOf = (templeId: string): User[] =>
  DEVOTEES.filter((u) => (u.homeTempleId ?? FLAGSHIP_ID) === templeId)

export const profileForUser = (u: User) => PROFILE_BY_ID.get(u.homeTempleId ?? FLAGSHIP_ID)

const SPOUSE_NAMES = ['Latha', 'Ramesh', 'Sudha', 'Mahesh', 'Kamala', 'Srinivas', 'Vijaya', 'Nina']
const CHILD_NAMES = ['Aditya', 'Ananya', 'Rohan', 'Meera', 'Nikhil', 'Shreya', 'Arjun', 'Diya']
const PARENT_NAMES = ['Rajam', 'Natesan', 'Saroja', 'Dinkar']

function buildFamilyTrees(): FamilyTree[] {
  const r = rng(770042)
  return DEVOTEES.filter((u) => u.familyTreeId).map((u) => {
    const surname = u.name.split(' ').slice(-1)[0]!
    // Family nakshatra/gothra are optional too: only households that gave their own do.
    const vedic = Boolean(u.nakshatra)
    const members: FamilyMember[] = [
      {
        name: `${pick(r, SPOUSE_NAMES)} ${surname}`,
        relation: 'spouse',
        nakshatra: vedic ? pick(r, NAKSHATRAS) : undefined,
        gothra: u.gothra,
      },
    ]
    const kids = int(r, 0, 2)
    for (let k = 0; k < kids; k++) {
      members.push({
        name: `${pick(r, CHILD_NAMES)} ${surname}`,
        relation: r() > 0.5 ? 'son' : 'daughter',
        nakshatra: vedic ? pick(r, NAKSHATRAS) : undefined,
        gothra: u.gothra,
      })
    }
    if (chance(r, 35)) {
      members.push({
        name: `${pick(r, PARENT_NAMES)} ${surname}`,
        relation: 'parent',
        nakshatra: vedic ? pick(r, NAKSHATRAS) : undefined,
        gothra: u.gothra,
        isAdultBranch: true,
      })
    }
    return { id: u.familyTreeId!, primaryUserId: u.id, members }
  })
}

export const FAMILY_TREES: FamilyTree[] = buildFamilyTrees()
