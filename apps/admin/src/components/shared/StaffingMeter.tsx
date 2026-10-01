import type { VolunteerAssignment } from '@/lib/data/types'
import { Progress } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/**
 * Volunteers needed against volunteers confirmed — the one number a campaign is judged on.
 *
 * `BreakEvenMeter` was the obvious thing to reach for and the wrong one: every figure it
 * prints goes through `money()`, so a roster of fourteen people rendered as "$14".
 *
 * Pending places are called out beneath the bar rather than added to it. Eight people who
 * said yes and have not agreed a shift is not eight people at the parking gate, and a
 * meter that reads full on unconfirmed acceptances is a meter that gets somebody stood up.
 */
export function StaffingMeter({
  needed,
  confirmed,
  pending,
  className,
}: {
  needed: number
  confirmed: number
  pending: number
  className?: string
}) {
  const pct = needed > 0 ? (confirmed / needed) * 100 : 100
  const met = confirmed >= needed
  const short = Math.max(0, needed - confirmed)

  return (
    <div className={cn('min-w-0', className)}>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold tabular-nums text-ink">
          {confirmed}
          <span className="font-normal text-muted"> / {needed}</span>
        </span>
        {met ? (
          <span className="text-2xs font-semibold text-leaf-600">Fully staffed</span>
        ) : (
          <span className="text-2xs font-semibold text-brand-600">{short} short</span>
        )}
      </div>
      <Progress
        value={pct}
        tone={met ? 'leaf' : 'brand'}
        label={`${confirmed} of ${needed} volunteers confirmed`}
      />
      {pending > 0 ? (
        <p className="mt-1 text-2xs text-muted">
          {pending} accepted, shift not confirmed — not counted above
        </p>
      ) : null}
    </div>
  )
}

/** Confirmed and checked-in both mean a body that will be, or was, standing there. */
export const countConfirmed = (rows: VolunteerAssignment[]) =>
  rows.filter((a) => a.status === 'confirmed' || a.status === 'checked-in').length
