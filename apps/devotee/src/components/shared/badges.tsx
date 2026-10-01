import { Crown, Gem, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { MembershipTier, Role } from '@/lib/data/types'
import { titleCase } from '@/lib/utils'

const ROLE_VARIANT: Record<Role, 'brand' | 'gold' | 'leaf' | 'neutral'> = {
  admin: 'brand',
  board: 'gold',
  priest: 'leaf',
  devotee: 'neutral',
  finance: 'gold',
  committee: 'leaf',
  platform: 'brand',
}

export const RoleBadge = ({ role }: { role: Role }) => (
  <Badge variant={ROLE_VARIANT[role]}>{titleCase(role)}</Badge>
)

const TIER_META: Record<
  MembershipTier,
  { variant: 'neutral' | 'gold' | 'brand'; Icon: typeof Crown }
> = {
  silver: { variant: 'neutral', Icon: ShieldCheck },
  gold: { variant: 'gold', Icon: Crown },
  platinum: { variant: 'brand', Icon: Gem },
}

export const TierBadge = ({ tier }: { tier: MembershipTier }) => {
  const { variant, Icon } = TIER_META[tier]
  return (
    <Badge variant={variant}>
      <Icon className="size-3" />
      {titleCase(tier)}
    </Badge>
  )
}

type AnyStatus =
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'scheduled'
  | 'skipped'
  | 'expired'
  | 'pending'
  | 'confirmed'
  | 'upcoming'
  | 'ongoing'
  | 'planned'
  | 'in-progress'

const STATUS_VARIANT: Record<AnyStatus, 'leaf' | 'gold' | 'brand' | 'neutral' | 'default'> = {
  active: 'leaf',
  confirmed: 'leaf',
  completed: 'neutral',
  scheduled: 'default',
  upcoming: 'default',
  ongoing: 'leaf',
  'in-progress': 'gold',
  planned: 'neutral',
  pending: 'gold',
  paused: 'gold',
  expired: 'brand',
  cancelled: 'brand',
  skipped: 'brand',
}

export const StatusPill = ({ status }: { status: string }) => (
  <Badge variant={STATUS_VARIANT[status as AnyStatus] ?? 'neutral'}>{titleCase(status)}</Badge>
)
