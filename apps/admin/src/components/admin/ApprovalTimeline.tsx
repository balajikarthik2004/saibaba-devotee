import {
  Archive,
  Ban,
  BadgeCheck,
  CheckCheck,
  FileInput,
  PencilLine,
  RotateCcw,
  Send,
  UserCheck,
  Undo2,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { ApprovalEvent, RequirementEvent } from '@/lib/data/types'
import { RoleBadge } from '@/components/shared/badges'
import { cn, fmtDateTime } from '@/lib/utils'

/**
 * A booking's audit trail, as a vertical rail.
 *
 * This is the screen that answers "why is this sitting here?" — the reason a desk typed
 * when it sent a payment back or refused a sponsorship lives nowhere else. Rendered in
 * both approval sheets so the two desks read the same history in the same shape.
 *
 * It renders a requirement sheet's history too. `RequirementEvent` is structurally the
 * same record — who, when, what, and why — differing only in its set of verbs, and a
 * second component would have been the same forty lines of rail and dot with a different
 * lookup table. The two vocabularies share one map below; a verb belonging to only one
 * chain is simply never produced by the other.
 */

/** Either chain's entry. The two are structurally identical by design. */
export type TimelineEvent = ApprovalEvent | RequirementEvent

const ACTION_META: Record<
  TimelineEvent['action'],
  { label: string; Icon: LucideIcon; tone: string }
> = {
  submitted: { label: 'Submitted', Icon: FileInput, tone: 'text-muted bg-faint' },
  'payment-verified': {
    label: 'Payment verified',
    Icon: CheckCheck,
    tone: 'text-leaf-600 bg-leaf-500/12',
  },
  'sent-back': { label: 'Sent back', Icon: Undo2, tone: 'text-brand-600 bg-brand-500/12' },
  resubmitted: { label: 'Resubmitted', Icon: RotateCcw, tone: 'text-saffron-600 bg-saffron-400/15' },
  declined: { label: 'Declined', Icon: Ban, tone: 'text-brand-700 bg-brand-500/15' },
  'priest-assigned': {
    label: 'Priest assigned',
    Icon: UserCheck,
    tone: 'text-leaf-600 bg-leaf-500/12',
  },
  'priest-reassigned': {
    label: 'Priest reassigned',
    Icon: Send,
    tone: 'text-saffron-600 bg-saffron-400/15',
  },
  /* The requirement chain's own verbs. */
  drafted: { label: 'Drafted', Icon: PencilLine, tone: 'text-muted bg-faint' },
  allocated: { label: 'Budget allocated', Icon: Wallet, tone: 'text-leaf-600 bg-leaf-500/12' },
  approved: { label: 'Approved', Icon: BadgeCheck, tone: 'text-leaf-600 bg-leaf-500/12' },
  rejected: { label: 'Rejected', Icon: Ban, tone: 'text-brand-700 bg-brand-500/15' },
  superseded: { label: 'Superseded', Icon: Archive, tone: 'text-muted bg-faint' },
}

export function ApprovalTimeline({
  history,
  className,
}: {
  history: TimelineEvent[]
  className?: string
}) {
  if (history.length === 0) {
    return <p className={cn('text-sm text-muted', className)}>Nothing recorded yet.</p>
  }

  return (
    <ol className={cn('relative space-y-4', className)}>
      {history.map((e, i) => {
        const meta = ACTION_META[e.action]
        const last = i === history.length - 1
        return (
          <li key={`${e.at}-${e.action}-${i}`} className="relative flex gap-3">
            {/* The connector stops at the last entry, so the rail ends rather than
                trailing into whitespace as if something were still loading. */}
            {last ? null : (
              <span aria-hidden className="absolute left-[13px] top-7 h-full w-px bg-line" />
            )}
            <span
              className={cn(
                'relative z-10 grid size-7 shrink-0 place-items-center rounded-full',
                meta.tone,
              )}
            >
              <meta.Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1 pb-0.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-medium text-ink">{meta.label}</span>
                <RoleBadge role={e.actorRole} />
                <span className="ml-auto whitespace-nowrap text-2xs text-muted">
                  {fmtDateTime(e.at)}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted">{e.actorName}</p>
              {e.note ? (
                <p className="mt-1.5 rounded-[8px] border border-line bg-faint/60 px-2.5 py-1.5 text-xs leading-relaxed text-ink-soft">
                  {e.note}
                </p>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
