import type {
  Cadence,
  ReadinessRow,
  RequirementStage,
  StockItem,
  StockMovement,
} from '@/lib/data/types'
import { OCCURRENCES_PER_YEAR } from '@/lib/data/mock'
import { Badge, Progress } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/**
 * The vocabulary of the stores feature, in one file.
 *
 * Five screens describe the same handful of states — a sheet's stage, a shelf's health,
 * a puja's coverage — and each one that invented its own wording would be a place the
 * console contradicts itself. The approval feature learned this the expensive way: the
 * stage of a booking was described three different ways on three screens before
 * `ApprovalTimeline` and the shared badges pulled it into one.
 */

/**
 * How often a sheet's figure is actually spent, in words.
 *
 * Every requirement figure in this feature is *per performance*, and on its own that is
 * a number nobody can act on — $93 is either trivial or five figures a year depending on
 * a cadence stated somewhere else on the page. Interpolating the raw cadence read badly
 * ("per one time sitting"), so the count is spelled out instead: it is the thing the
 * reader was going to work out anyway.
 */
export function sittingsPerYear(cadence: Cadence): string {
  const n = OCCURRENCES_PER_YEAR[cadence]
  return n === 1 ? 'once a year' : `${n}× a year`
}

const STAGE_META: Record<
  RequirementStage,
  { label: string; variant: 'default' | 'neutral' | 'brand' | 'gold' | 'leaf' | 'outline' }
> = {
  draft: { label: 'Draft', variant: 'neutral' },
  'finance-review': { label: 'With accounts', variant: 'gold' },
  'admin-review': { label: 'With the administrator', variant: 'gold' },
  approved: { label: 'Approved', variant: 'leaf' },
  rejected: { label: 'Rejected', variant: 'brand' },
  superseded: { label: 'Superseded', variant: 'outline' },
}

export const StageBadge = ({ stage }: { stage: RequirementStage }) => (
  <Badge variant={STAGE_META[stage].variant}>{STAGE_META[stage].label}</Badge>
)

/**
 * Where a shelf stands: out, low, or fine.
 *
 * `out` is separated from `low` because they are different problems. Low means order
 * more this week; out means the next puja that needs it cannot go ahead, and a single
 * amber pill covering both would bury the second inside the first.
 */
export const stockLevelOf = (item: StockItem): 'out' | 'low' | 'ok' =>
  item.onHand <= 0 ? 'out' : item.onHand <= item.reorderLevel ? 'low' : 'ok'

export const StockLevelBadge = ({ item }: { item: StockItem }) => {
  const level = stockLevelOf(item)
  if (level === 'out') return <Badge variant="brand">Out of stock</Badge>
  if (level === 'low') return <Badge variant="gold">Low</Badge>
  return <Badge variant="leaf">In stock</Badge>
}

const READINESS_META: Record<
  ReadinessRow['state'],
  { label: string; variant: 'default' | 'neutral' | 'brand' | 'gold' | 'leaf' | 'outline' }
> = {
  'no-sheet': { label: 'No requirement sheet', variant: 'neutral' },
  ready: { label: 'Stock available', variant: 'default' },
  short: { label: 'Short', variant: 'brand' },
  confirmed: { label: 'Confirmed ready', variant: 'leaf' },
  flagged: { label: 'Flagged short', variant: 'gold' },
}

export const ReadinessBadge = ({ state }: { state: ReadinessRow['state'] }) => (
  <Badge variant={READINESS_META[state].variant}>{READINESS_META[state].label}</Badge>
)

export const MOVEMENT_LABELS: Record<StockMovement['kind'], string> = {
  received: 'Received',
  issued: 'Issued',
  adjusted: 'Adjusted',
  wastage: 'Wastage',
}

export const MovementBadge = ({ kind }: { kind: StockMovement['kind'] }) => (
  <Badge
    variant={
      kind === 'received' ? 'leaf' : kind === 'issued' ? 'default' : kind === 'wastage' ? 'brand' : 'neutral'
    }
  >
    {MOVEMENT_LABELS[kind]}
  </Badge>
)

/**
 * On hand against the reorder level, as a bar.
 *
 * Scaled to twice the reorder level rather than to a stock ceiling nobody records, so a
 * full bar means comfortably stocked and the halfway mark is exactly the point at which
 * somebody should be ordering. Scaling to the largest holding instead would make one
 * bulk item of rice shrink every other row to a sliver.
 */
export function StockMeter({ item, className }: { item: StockItem; className?: string }) {
  const ceiling = Math.max(item.reorderLevel * 2, item.onHand, 1)
  const level = stockLevelOf(item)

  return (
    <div className={cn('min-w-0', className)}>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold tabular-nums text-ink">
          {item.onHand}
          <span className="font-normal text-muted"> {item.unit}</span>
        </span>
        <span
          className={cn(
            'text-2xs font-semibold',
            level === 'ok' ? 'text-muted' : level === 'low' ? 'text-saffron-600' : 'text-brand-600',
          )}
        >
          reorder at {item.reorderLevel}
        </span>
      </div>
      <Progress
        value={(item.onHand / ceiling) * 100}
        tone={level === 'ok' ? 'leaf' : level === 'low' ? 'gold' : 'brand'}
        label={`${item.onHand} ${item.unit} on hand, reorder level ${item.reorderLevel}`}
      />
    </div>
  )
}

/**
 * Coverage for one puja: lines covered against lines required.
 *
 * Optional lines are excluded from both halves rather than counted as covered. Counting
 * them would let a sheet whose only shortfall is an optional item read as "7 of 8", which
 * invites the priest to go looking for a problem that was never going to stop him.
 */
export function CoverageMeter({ row, className }: { row: ReadinessRow; className?: string }) {
  const blocking = row.lines.filter((l) => !l.optional)
  const covered = blocking.filter((l) => l.short === 0).length
  const pct = blocking.length > 0 ? (covered / blocking.length) * 100 : 100
  const complete = covered === blocking.length

  return (
    <div className={cn('min-w-0', className)}>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold tabular-nums text-ink">
          {covered}
          <span className="font-normal text-muted"> / {blocking.length}</span>
        </span>
        {complete ? (
          <span className="text-2xs font-semibold text-leaf-600">All items available</span>
        ) : (
          <span className="text-2xs font-semibold text-brand-600">
            {blocking.length - covered} short
          </span>
        )}
      </div>
      <Progress
        value={pct}
        tone={complete ? 'leaf' : 'brand'}
        label={`${covered} of ${blocking.length} required items available`}
      />
    </div>
  )
}
