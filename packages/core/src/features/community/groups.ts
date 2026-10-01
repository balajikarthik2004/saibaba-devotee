import { simulateLatency } from '../../api'
import { readLocal, writeLocal } from '../../local'
import { currentTempleId } from '../../tenant'
import { TEMPLES } from '../../mock/temple'
import type { SatsangGroup } from '../../types.sai'

const KEY = 'saibaba:community:groups'

export type GroupKind = SatsangGroup['kind']

export const GROUP_KIND_LABEL: Record<GroupKind, string> = {
  satsang: 'Satsang',
  youth: 'Youth',
  'bal-vikas': 'Bal Vikas (children)',
  seniors: 'Seniors',
  bhajan: 'Bhajan',
}

export const SAFEGUARDING_NOTE =
  'Children’s programmes follow the temple’s safeguarding policy: two adult volunteers are always present, and contact details are shown only to signed-in members.'

const SPECS: { kind: GroupKind; name: string; schedule: string; description: string; capacity?: number }[] = [
  { kind: 'satsang', name: 'Thursday Evening Satsang', schedule: 'Thursdays, 7:00 pm', description: 'A quiet hour of Sai Satcharitra reading, bhajans and shared reflection, followed by prasad. Everyone is welcome.' },
  { kind: 'youth', name: 'Sai Youth Circle', schedule: 'Second and fourth Saturdays, 4:00 pm', description: 'Teens and young adults meet for seva projects, discussion over snacks, and a short bhajan session.', capacity: 40 },
  { kind: 'bal-vikas', name: 'Bal Vikas (Children’s Programme)', schedule: 'Sundays, 10:30 am', description: 'Stories from Baba’s life, simple values, songs and crafts for children ages 5 to 12. Volunteers are background-checked.', capacity: 30 },
  { kind: 'seniors', name: 'Seniors’ Morning Satsang', schedule: 'Tuesdays, 10:00 am', description: 'A relaxed gathering with tea, gentle chanting and company. Rides can often be arranged through volunteers.' },
  { kind: 'bhajan', name: 'Sai Bhajan Mandali', schedule: 'Fridays, 6:30 pm', description: 'Weekly bhajan practice. Beginners welcome; no experience with instruments needed.', capacity: 25 },
]

function seed(): SatsangGroup[] {
  const out: SatsangGroup[] = []
  TEMPLES.forEach((t) => {
    SPECS.forEach((s, i) => {
      out.push({
        id: `grp_${t.id.slice(4)}_${s.kind}`,
        templeId: t.id,
        name: s.name,
        kind: s.kind,
        schedule: s.schedule,
        contactName: `${['Coordinator', 'Group lead', 'Volunteer lead'][i % 3]!} (demo)`,
        contactEmail: `${s.kind}@${t.id.slice(4)}.example.org`,
        description: s.description,
        memberIds: [],
        capacity: s.capacity,
      })
    })
  })
  return out
}

let GROUPS: SatsangGroup[] = readLocal<SatsangGroup[] | null>(KEY, null) ?? seed()
const persist = () => writeLocal(KEY, GROUPS)
const clone = <T>(x: T): T => structuredClone(x)

export async function listGroups(templeId?: string, kind?: GroupKind): Promise<SatsangGroup[]> {
  await simulateLatency()
  const tid = templeId ?? currentTempleId()
  return clone(GROUPS.filter((g) => g.templeId === tid && (kind ? g.kind === kind : true)))
}

export async function getGroup(id: string): Promise<SatsangGroup | null> {
  await simulateLatency()
  const g = GROUPS.find((x) => x.id === id)
  return g ? clone(g) : null
}

export async function joinGroup(groupId: string, userId: string): Promise<SatsangGroup> {
  await simulateLatency()
  const g = GROUPS.find((x) => x.id === groupId)
  if (!g) throw new Error('Group not found')
  if (g.memberIds.includes(userId)) return clone(g)
  if (g.capacity && g.memberIds.length >= g.capacity) throw new Error('This group is full right now.')
  g.memberIds = [...g.memberIds, userId]
  persist()
  return clone(g)
}

export async function leaveGroup(groupId: string, userId: string): Promise<SatsangGroup> {
  await simulateLatency()
  const g = GROUPS.find((x) => x.id === groupId)
  if (!g) throw new Error('Group not found')
  g.memberIds = g.memberIds.filter((m) => m !== userId)
  persist()
  return clone(g)
}

export type GroupInput = Omit<SatsangGroup, 'id' | 'memberIds' | 'templeId'> & { templeId?: string }

export async function createGroup(input: GroupInput): Promise<SatsangGroup> {
  await simulateLatency()
  const g: SatsangGroup = {
    ...input,
    templeId: input.templeId ?? currentTempleId(),
    id: `grp_${Date.now().toString(36)}`,
    memberIds: [],
  }
  GROUPS = [...GROUPS, g]
  persist()
  return clone(g)
}

export async function updateGroup(id: string, patch: Partial<GroupInput>): Promise<SatsangGroup> {
  await simulateLatency()
  const g = GROUPS.find((x) => x.id === id)
  if (!g) throw new Error('Group not found')
  Object.assign(g, patch)
  persist()
  return clone(g)
}

export async function deleteGroup(id: string): Promise<void> {
  await simulateLatency()
  GROUPS = GROUPS.filter((g) => g.id !== id)
  persist()
}
