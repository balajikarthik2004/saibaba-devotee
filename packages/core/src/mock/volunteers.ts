import type {
  UUID,
  Volunteer,
  VolunteerAssignment,
  VolunteerCampaign,
  VolunteerChannel,
  VolunteerInvite,
  VolunteerMessage,
  VolunteerSkill,
} from '../types'
import { id, int, offsetISO, pick, rng } from './seed'
import { devoteesOf, initialsOfName, phoneFor } from './users'
import { EVENTS } from './events'
import { PROFILES, tag } from './profiles'
import type { TempleProfile } from './profiles'

/**
 * The volunteer pool, and campaigns sitting at different points of the flow.
 *
 * Every campaign below is attached to a festival the event seed actually produces, and
 * every `source: 'invited'` assignment traces back to an invite whose status is
 * `accepted`. That coherence is the point of seeding this by hand rather than sprinkling
 * random statuses: the roster screen's whole job is showing that the people standing at
 * the Punyatithi are the people who said yes, and a seed that cannot survive that
 * comparison teaches the coordinator to distrust the screen.
 */

export const VOLUNTEER_ROLES: { key: VolunteerSkill; label: string; blurb: string }[] = [
  {
    key: 'kitchen',
    label: 'Kitchen & annadanam',
    blurb: 'Cooking, running the serving line and washing up after the free meal.',
  },
  {
    key: 'decoration',
    label: 'Decoration & alankar',
    blurb: 'Flower garlands, rangoli at the entrance, mandir draping and lamp setting.',
  },
  {
    key: 'parking',
    label: 'Parking & traffic',
    blurb: 'Directing cars across the lot and keeping the fire lane clear all evening.',
  },
  {
    key: 'registration',
    label: 'Registration desk',
    blurb: 'Signing in sponsors, handing out archana slips and prasad tokens.',
  },
  {
    key: 'prasadam',
    label: 'Prasad distribution',
    blurb: 'Packing and handing out prasad and udi after each aarti.',
  },
  {
    key: 'crowd',
    label: 'Queue & crowd care',
    blurb: 'Holding the darshan queue and walking elderly devotees to the front.',
  },
  {
    key: 'cleanup',
    label: 'Clean-up crew',
    blurb: 'Clearing the hall between sessions and the full reset at the end of the night.',
  },
  {
    key: 'av',
    label: 'Audio, video & streaming',
    blurb: 'Mic checks, the livestream feed and the projection screens in the hall.',
  },
  {
    key: 'youth',
    label: 'Youth programme',
    blurb: 'Shepherding the bhajan and Bal Vikas groups through their slots on time.',
  },
  {
    key: 'security',
    label: 'Doors & safety',
    blurb: 'Entry points, the lost-child protocol and the first-aid corner.',
  },
]

export const ROLE_BY_KEY = new Map(VOLUNTEER_ROLES.map((r) => [r.key, r]))

export const roleLabel = (key: VolunteerSkill) => ROLE_BY_KEY.get(key)?.label ?? key

/** Shift wording the coordinator picks from — a volunteer reads a time, not a timestamp. */
export const VOLUNTEER_SHIFTS = [
  'Morning — 6:00am to 11:00am',
  'Midday — 11:00am to 4:00pm',
  'Evening — 4:00pm to 9:00pm',
  'Full day — 6:00am to 9:00pm',
] as const

/** Volunteers who help out but have never registered as devotees. */
const VOLUNTEER_ONLY_NAMES: Record<string, string[]> = {
  tmp_sugarland: [
    'Jitendra Bhatt',
    'Indira Venkatesh',
    'Ashok Varma',
    'Rukmini Balan',
    'Bhavesh Modi',
    'Saroja Devi',
    'Manoj Chakravarty',
    'Hemlata Rangarajan',
    'Gurpreet Bedi',
    'Aruna Krishnan',
    'Jagan Mohan Rao',
    'Sudha Lakshman',
    'Prabhakar Deshpande',
    'Vimala Sundar',
    'Chandran Ramesh',
    'Kausalya Prasad',
    'Anand Thirumal',
    'Nithya Somu',
    'Raghu Nandan',
    'Brinda Ayyar',
    'Kevin O’Brien',
    'Janaki Perumal',
  ],
  tmp_fremont: ['Sanjay Kapoor', 'Padmini Rao', 'Ajay Sethi', 'Rina Patel', 'Tom Nguyen', 'Usha Raman', 'Dev Malhotra', 'Geeta Iyer'],
  tmp_pune: ['Suhas Kamble', 'Rekha Shinde', 'Anil Gaikwad', 'Sunita Mane', 'Dilip Pawar', 'Seema Nimbalkar', 'Yogesh Sathe', 'Pratibha More', 'Ketan Dalvi'],
  tmp_hyderabad: ['Raju Goud', 'Bhavani Devi', 'Mohan Krishna', 'Sridevi Varma', 'Prakash Babu', 'Anusha Reddy', 'Naresh Yadav', 'Kalyani Sastry'],
  tmp_harrow: ['Pankaj Desai', 'Reena Vora', 'Mitesh Parekh', 'Helen Brooks', 'Kirit Shah', 'Bina Kotecha', 'Sameer Khan'],
  tmp_mississauga: ['Gurdeep Dhaliwal', 'Anita Nair', 'Rajan Pillai', 'Olivia Martin', 'Kalpesh Thakor', 'Harsha Nadig', 'Vinod Chopra', 'Meenal Kulkarni'],
}

/** Notes the coordinator has jotted against particular people, by pool index (flagship). */
const VOLUNTEER_NOTES: Record<number, string> = {
  3: 'Cannot lift heavy vessels — kitchen prep only, please.',
  6: 'Available weekends only. Leaves by 8pm.',
  11: 'Drives the temple van and holds the gate key.',
  19: 'Speaks Telugu and Hindi — good on the registration desk.',
  27: 'Moved to Austin, still drives down for the big festivals.',
}

let volunteerCounter = 0

function buildVolunteersFor(p: TempleProfile): Volunteer[] {
  const r = rng(931744 + p.index * 53)
  const out: Volunteer[] = []

  const skillsFor = (): VolunteerSkill[] => {
    const n = int(r, 1, 3)
    const picked = new Set<VolunteerSkill>()
    while (picked.size < n) picked.add(pick(r, VOLUNTEER_ROLES).key)
    return [...picked]
  }

  // Roughly a third of the pool are registered devotees. Linking by `userId` rather than
  // copying the record means the volunteer sheet and the devotee file cannot drift apart.
  devoteesOf(p.id)
    .filter((_, i) => i % 2 === 0)
    .slice(0, 12)
    .forEach((u) => {
      volunteerCounter++
      out.push({
        id: id('vol', volunteerCounter),
        templeId: p.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        city: u.city ?? p.localities[0]!.city,
        skills: skillsFor(),
        userId: u.id,
        status: 'active',
        joinedAt: offsetISO(-int(r, 120, 900), 10),
        avatarInitials: u.avatarInitials,
      })
    })

  for (const name of VOLUNTEER_ONLY_NAMES[p.id] ?? []) {
    const loc = pick(r, p.localities)
    volunteerCounter++
    out.push({
      id: id('vol', volunteerCounter),
      templeId: p.id,
      name,
      email: name.toLowerCase().replace(/[^a-z]+/g, '.') + '@mail.example',
      phone: phoneFor(p, r),
      city: loc.city,
      skills: skillsFor(),
      status: 'active',
      joinedAt: offsetISO(-int(r, 20, 700), 10),
      avatarInitials: initialsOfName(name),
    })
  }

  // Dormant records, named rather than rolled, so the "active only" filter has something
  // predictable to hide and the directory shows both states on first load.
  out.forEach((v, i) => {
    if (i === 7 || i === 15 || i === 23 || i === 31) v.status = 'paused'
    if (p.index === 0) {
      const note = VOLUNTEER_NOTES[i]
      if (note) v.notes = note
    }
  })

  return out
}

export const VOLUNTEERS: Volunteer[] = PROFILES.flatMap((p) => buildVolunteersFor(p))

/* ------------------------------------------------------------------ campaigns */

interface SendSeed {
  channel: VolunteerChannel
  subject: string
  body: string
  daysAgo: number
  /** Empty means the whole active pool — "anyone who can help". */
  skills: VolunteerSkill[]
  count: number
}

interface CampaignSeed {
  eventTitle: string
  title: string
  description: string
  /** Briefing, as a day offset from today. Negative for a campaign already run. */
  briefingDays: number
  /** Which staff role coordinates: admin or priest. */
  coordinator: 'admin' | 'priest'
  status: VolunteerCampaign['status']
  needs: { key: VolunteerSkill; needed: number }[]
  sends: SendSeed[]
  /** How the invites came back. Any remainder stays `sent` — still waiting. */
  responses: { accepted: number; declined: number; noResponse: number }
  /** Volunteers the coordinator placed straight onto the roster, never invited. */
  directCount: number
  /** A campaign that has already happened: how the roster actually turned out. */
  outcome?: { checkedIn: number; noShow: number }
}

const EMAIL_BODY =
  'Om Sai Ram {{name}},\n\n' +
  'The temple is preparing for {{festival}}, and we are looking for volunteers to help ' +
  'the day run smoothly. If you can spare a few hours we would be grateful for your seva — ' +
  'the areas we most need help with are {{role}}.\n\n' +
  'Reply to this note and the coordinator will place you on a shift and send the briefing ' +
  'details. There is no obligation, and a "not this time" is always welcome.\n\n' +
  'Shraddha and saburi,\n{{templeName}}'

const SMS_BODY =
  'Sai Temple: Volunteers needed for {{festival}}. Can you help with {{role}}? Reply YES to join.'

const DECLINE_NOTES = [
  'Travelling that week — next festival for certain.',
  'Working the evening shift, sorry.',
  'Recovering from surgery; sending my son instead.',
  'Already committed to the Navaratri kitchen.',
  'Out of town for a wedding.',
]

const FLAGSHIP_SEEDS: CampaignSeed[] = [
  {
    eventTitle: 'Vijayadashami — Sai Baba Punyatithi',
    title: 'Punyatithi — volunteer drive',
    description:
      'The procession of the padukas, special abhishekam and annadanam through the day. ' +
      'The largest volunteer ask of the year — kitchen and parking carry the load.',
    briefingDays: 9,
    coordinator: 'admin',
    status: 'recruiting',
    needs: [
      { key: 'kitchen', needed: 14 },
      { key: 'parking', needed: 8 },
      { key: 'decoration', needed: 6 },
      { key: 'registration', needed: 4 },
      { key: 'crowd', needed: 6 },
    ],
    sends: [
      {
        channel: 'both',
        subject: 'Volunteers needed — Punyatithi',
        body: EMAIL_BODY,
        daysAgo: 18,
        skills: [],
        count: 22,
      },
      {
        channel: 'sms',
        subject: 'Punyatithi — kitchen and parking still short',
        body: SMS_BODY,
        daysAgo: 6,
        skills: ['kitchen', 'parking'],
        count: 9,
      },
    ],
    responses: { accepted: 12, declined: 5, noResponse: 3 },
    directCount: 2,
  },
  {
    eventTitle: 'Diwali Deepotsav',
    title: 'Diwali night — hall and prasad crew',
    description:
      'Lamp lighting at dusk and prasad for roughly six hundred devotees. Fully staffed as ' +
      'of the last briefing.',
    briefingDays: 4,
    coordinator: 'priest',
    status: 'staffed',
    needs: [
      { key: 'prasadam', needed: 8 },
      { key: 'security', needed: 4 },
      { key: 'cleanup', needed: 6 },
      { key: 'av', needed: 2 },
    ],
    sends: [
      {
        channel: 'email',
        subject: 'Diwali volunteers — a few hours on the night',
        body: EMAIL_BODY,
        daysAgo: 24,
        skills: [],
        count: 18,
      },
    ],
    responses: { accepted: 15, declined: 2, noResponse: 1 },
    directCount: 3,
  },
  {
    eventTitle: 'Datta Jayanti',
    title: 'Datta Jayanti — puja and Guru Charitra crew',
    description:
      'Abhishekam to Sri Dattatreya and the Guru Charitra reading. Roles drafted; nothing ' +
      'sent out yet.',
    briefingDays: 21,
    coordinator: 'priest',
    status: 'draft',
    needs: [
      { key: 'decoration', needed: 12 },
      { key: 'crowd', needed: 5 },
      { key: 'cleanup', needed: 4 },
    ],
    sends: [],
    responses: { accepted: 0, declined: 0, noResponse: 0 },
    directCount: 0,
  },
  {
    eventTitle: 'Navaratri Bhajan Nights',
    title: 'Navaratri Bhajan Nights — youth and registration',
    description:
      'Evening bhajans and garba for families. A short SMS-only ask, since the same crew ' +
      'helps on every one of the nine nights.',
    briefingDays: 7,
    coordinator: 'admin',
    status: 'recruiting',
    needs: [
      { key: 'youth', needed: 6 },
      { key: 'registration', needed: 3 },
      { key: 'av', needed: 2 },
    ],
    sends: [
      {
        channel: 'sms',
        subject: 'Navaratri Bhajan Nights — youth programme help',
        body: SMS_BODY,
        daysAgo: 5,
        skills: ['youth', 'av', 'registration'],
        count: 11,
      },
    ],
    responses: { accepted: 5, declined: 3, noResponse: 0 },
    directCount: 1,
  },
  {
    eventTitle: 'Guru Purnima',
    title: 'Guru Purnima — padukas puja and annadanam',
    description:
      'Padukas puja at dawn, then annadanam in the hall. Closed out, and kept as the ' +
      'reference for how many of the people who accept actually turn up.',
    briefingDays: -68,
    coordinator: 'admin',
    status: 'completed',
    needs: [
      { key: 'kitchen', needed: 10 },
      { key: 'parking', needed: 4 },
      { key: 'prasadam', needed: 5 },
    ],
    sends: [
      {
        channel: 'both',
        subject: 'Guru Purnima — volunteers for the padukas puja',
        body: EMAIL_BODY,
        daysAgo: 96,
        skills: [],
        count: 16,
      },
    ],
    responses: { accepted: 11, declined: 4, noResponse: 1 },
    directCount: 2,
    outcome: { checkedIn: 9, noShow: 2 },
  },
]

/** Smaller temples run two campaigns: the coming Punyatithi and the Guru Purnima just gone. */
const SMALL_SEEDS: CampaignSeed[] = [
  {
    ...FLAGSHIP_SEEDS[0]!,
    needs: [
      { key: 'kitchen', needed: 6 },
      { key: 'parking', needed: 3 },
      { key: 'decoration', needed: 3 },
    ],
    sends: [{ ...FLAGSHIP_SEEDS[0]!.sends[0]!, count: 8 }],
    responses: { accepted: 4, declined: 2, noResponse: 1 },
    directCount: 1,
  },
  {
    ...FLAGSHIP_SEEDS[4]!,
    needs: [
      { key: 'kitchen', needed: 4 },
      { key: 'prasadam', needed: 3 },
    ],
    sends: [{ ...FLAGSHIP_SEEDS[4]!.sends[0]!, count: 7 }],
    responses: { accepted: 5, declined: 1, noResponse: 1 },
    directCount: 1,
    outcome: { checkedIn: 4, noShow: 1 },
  },
]

interface Seeded {
  campaigns: VolunteerCampaign[]
  messages: VolunteerMessage[]
  invites: VolunteerInvite[]
  assignments: VolunteerAssignment[]
}

function buildCampaigns(): Seeded {
  const r = rng(604318)
  const campaigns: VolunteerCampaign[] = []
  const messages: VolunteerMessage[] = []
  const invites: VolunteerInvite[] = []
  const assignments: VolunteerAssignment[] = []
  let campaignNo = 0

  for (const p of PROFILES) {
    const pool = VOLUNTEERS.filter((v) => v.templeId === p.id)
    const active = pool.filter((v) => v.status === 'active')
    if (active.length === 0) continue
    let cursor = 0
    const seeds = p.index === 0 ? FLAGSHIP_SEEDS : SMALL_SEEDS
    const priestId = `usr_priest${tag(p)}`
    const adminId = `usr_admin${tag(p)}`

    /** Walks the active pool without repeating anybody already spoken for. */
    const nextBatch = (n: number, taken: Set<UUID>): Volunteer[] => {
      const out: Volunteer[] = []
      for (let guard = 0; out.length < n && guard < active.length * 2; guard++) {
        const v = active[cursor++ % active.length]!
        if (taken.has(v.id)) continue
        taken.add(v.id)
        out.push(v)
      }
      return out
    }

    seeds.forEach((s) => {
      const event = EVENTS.find((e) => e.templeId === p.id && e.title === s.eventTitle)
      // A renamed festival should cost us one campaign, not the whole module.
      if (!event) return

      campaignNo++
      const ci = campaignNo
      const campaignId = id('vcm', ci)
      const coordinatorId = s.coordinator === 'admin' ? adminId : priestId
      const coordinatorName = s.coordinator === 'admin' ? p.admin.name : p.priests[0]!.name
      campaigns.push({
        id: campaignId,
        templeId: p.id,
        eventId: event.id,
        title: s.title,
        description: s.description,
        briefingAt: offsetISO(s.briefingDays, 18, 30),
        coordinatorId,
        needs: s.needs.map((n) => ({
          roleKey: n.key,
          label: roleLabel(n.key),
          blurb: ROLE_BY_KEY.get(n.key)?.blurb ?? '',
          needed: n.needed,
        })),
        status: s.status,
        createdAt: offsetISO(s.briefingDays - 45, 9),
      })

      const invitedHere = new Set<UUID>()
      const rosteredHere = new Set<UUID>()

      /* Outreach: one message, then one invite per resolved recipient. */
      s.sends.forEach((send, si) => {
        const audience = send.skills.length
          ? active.filter((v) => v.skills.some((sk) => send.skills.includes(sk)))
          : active
        const source = audience.length ? audience : active

        const recipients: Volunteer[] = []
        for (let guard = 0; recipients.length < send.count && guard < source.length * 3; guard++) {
          const v = source[cursor++ % source.length]!
          // A follow-up may legitimately reach somebody the first send already found. What
          // must not happen is the same person appearing twice inside one broadcast.
          if (recipients.some((x) => x.id === v.id)) continue
          recipients.push(v)
        }

        const messageId = id('vms' + ci, si + 1)
        messages.push({
          id: messageId,
          campaignId,
          channel: send.channel,
          subject: send.subject,
          body: send.body,
          recipientIds: recipients.map((v) => v.id),
          sentAt: offsetISO(-send.daysAgo, 11, 15),
          sentByName: coordinatorName,
          audience: {
            skills: send.skills,
            // A follow-up is by definition aimed at the people who have not answered yet.
            excludeInvited: si > 0,
            excludeRostered: si > 0,
          },
        })

        recipients.forEach((v) => {
          if (invitedHere.has(v.id)) return
          invitedHere.add(v.id)
          invites.push({
            id: id('vin' + ci, invitedHere.size),
            campaignId,
            volunteerId: v.id,
            messageId,
            channel: send.channel,
            status: 'sent',
            sentAt: offsetISO(-send.daysAgo, 11, 15),
          })
        })
      })

      /* Responses, applied to this campaign's invites in seeded order. */
      const mine = invites.filter((x) => x.campaignId === campaignId)
      const { accepted, declined, noResponse } = s.responses

      mine.forEach((inv, i) => {
        if (i < accepted) {
          inv.status = 'accepted'
          inv.respondedAt = offsetISO(-int(r, 1, 12), int(r, 9, 20))
        } else if (i < accepted + declined) {
          inv.status = 'declined'
          inv.respondedAt = offsetISO(-int(r, 1, 12), int(r, 9, 20))
          inv.note = DECLINE_NOTES[(i + ci) % DECLINE_NOTES.length]
        } else if (i < accepted + declined + noResponse) {
          // The coordinator rang round and closed these off by hand — nothing here
          // expires on its own.
          inv.status = 'no-response'
          inv.respondedAt = offsetISO(-int(r, 1, 4), 17)
        }
      })

      /* Roster: every acceptance becomes an assignment, matched where possible to a role
         the volunteer can actually do. */
      const needKeys = s.needs.map((n) => n.key)
      const roleFor = (v: Volunteer) =>
        v.skills.find((sk) => needKeys.includes(sk)) ?? needKeys[cursor++ % needKeys.length]!
      const countHere = () => assignments.filter((a) => a.campaignId === campaignId).length

      mine
        .filter((inv) => inv.status === 'accepted')
        .forEach((inv, i) => {
          const v = VOLUNTEERS.find((x) => x.id === inv.volunteerId)
          if (!v) return
          rosteredHere.add(v.id)
          assignments.push({
            id: id('vas' + ci, countHere() + 1),
            campaignId,
            volunteerId: v.id,
            roleKey: roleFor(v),
            shift: VOLUNTEER_SHIFTS[i % VOLUNTEER_SHIFTS.length]!,
            // A fresh acceptance sits `pending` until the coordinator confirms the shift
            // with them, so a live campaign shows both states side by side.
            status: i % 4 === 3 ? 'pending' : 'confirmed',
            source: 'invited',
            inviteId: inv.id,
            addedAt: inv.respondedAt ?? inv.sentAt,
          })
        })

      /* Direct adds: the people the coordinator simply put on the sheet. */
      nextBatch(s.directCount, new Set([...invitedHere, ...rosteredHere])).forEach((v, i) => {
        assignments.push({
          id: id('vas' + ci, countHere() + 1),
          campaignId,
          volunteerId: v.id,
          roleKey: roleFor(v),
          shift: VOLUNTEER_SHIFTS[(i + 1) % VOLUNTEER_SHIFTS.length]!,
          status: 'confirmed',
          source: 'direct',
          addedAt: offsetISO(-int(r, 2, 9), 15),
          note: i === 0 ? 'Walked in and offered — put straight on the sheet.' : undefined,
        })
      })

      /* Outcome, for a campaign that has already happened. */
      const outcome = s.outcome
      if (outcome) {
        assignments
          .filter((a) => a.campaignId === campaignId)
          .forEach((a, i) => {
            if (i < outcome.checkedIn) a.status = 'checked-in'
            else if (i < outcome.checkedIn + outcome.noShow) a.status = 'no-show'
            else a.status = 'confirmed'
          })
      }
    })
  }

  return { campaigns, messages, invites, assignments }
}

const SEEDED = buildCampaigns()

export const VOLUNTEER_CAMPAIGNS: VolunteerCampaign[] = SEEDED.campaigns
export const VOLUNTEER_MESSAGES: VolunteerMessage[] = SEEDED.messages
export const VOLUNTEER_INVITES: VolunteerInvite[] = SEEDED.invites
export const VOLUNTEER_ASSIGNMENTS: VolunteerAssignment[] = SEEDED.assignments
