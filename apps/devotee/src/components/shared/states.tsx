import type { LucideIcon } from 'lucide-react'
import { Inbox } from 'lucide-react'
import { Skeleton } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function EmptyState({
  title,
  detail,
  Icon = Inbox,
  action,
  className,
}: {
  title: string
  detail?: string
  Icon?: LucideIcon
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-line bg-card/60 px-6 py-10 text-center',
        className,
      )}
    >
      <span className="grid size-11 place-items-center rounded-full bg-tint text-brand-400">
        <Icon className="size-5" />
      </span>
      <p className="font-serif text-[17px] text-ink">{title}</p>
      {detail ? <p className="max-w-sm text-[13px] text-muted">{detail}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

export function LoadingSkeleton({
  variant = 'card',
  rows = 3,
  className,
}: {
  variant?: 'card' | 'table' | 'tiles' | 'text'
  rows?: number
  className?: string
}) {
  if (variant === 'tiles') {
    return (
      <div className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-3', className)}>
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-[104px]" />
        ))}
      </div>
    )
  }

  if (variant === 'table') {
    return (
      <div className={cn('space-y-2 rounded-[10px] border border-line bg-card p-4', className)}>
        <Skeleton className="h-7 w-1/3" />
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    )
  }

  if (variant === 'text') {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className={cn('h-4', i === rows - 1 ? 'w-2/3' : 'w-full')} />
        ))}
      </div>
    )
  }

  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="space-y-3 rounded-[10px] border border-line bg-card p-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      ))}
    </div>
  )
}
