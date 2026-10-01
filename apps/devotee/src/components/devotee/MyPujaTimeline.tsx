import type { PujaOccurrence } from '@/lib/data/types'
import { useT } from '@saibaba/core'
import { cn, fmtDate, fmtTime } from '@/lib/utils'

/** Mini timeline of the next three occurrences for one booking. */
export function MyPujaTimeline({
  occurrences,
  className,
}: {
  occurrences: PujaOccurrence[]
  className?: string
}) {
  const t = useT()
  const next = occurrences.slice(0, 3)

  if (next.length === 0) {
    return (
      <p className={cn('text-[12.5px] text-muted', className)}>
        {t('timeline.none', 'No occurrences scheduled in the next 30 days.')}
      </p>
    )
  }

  return (
    <ol className={cn('relative space-y-3 pl-4', className)}>
      <span
        className="absolute left-[3px] top-1.5 h-[calc(100%-12px)] w-px bg-line"
        aria-hidden="true"
      />
      {next.map((o, i) => (
        <li key={o.id} className="relative">
          <span
            className={cn(
              'absolute -left-4 top-1.5 size-[7px] rounded-full ring-2 ring-card',
              i === 0 ? 'bg-brand-500' : 'bg-line',
            )}
            aria-hidden="true"
          />
          <p className={cn('text-[13px]', i === 0 ? 'font-medium text-ink' : 'text-muted')}>
            {fmtDate(o.scheduledAt, 'EEE, MMM d')}
            <span className="ml-2 font-normal text-muted">{fmtTime(o.scheduledAt)}</span>
          </p>
          {o.officiant ? <p className="text-[12px] text-muted">{o.officiant}</p> : null}
        </li>
      ))}
    </ol>
  )
}
