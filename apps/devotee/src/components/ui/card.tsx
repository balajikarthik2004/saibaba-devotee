import * as React from 'react'
import { cn } from '@/lib/utils'

type Div = React.HTMLAttributes<HTMLDivElement>

export const Card = React.forwardRef<HTMLDivElement, Div>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    // `min-w-0` so a card never forces its flex/grid parent wider than the viewport —
    // without it an inner `overflow-x-auto` table never gets the chance to clip.
    className={cn(
      'min-w-0 rounded-[12px] border border-line bg-card shadow-[var(--shadow)]',
      className,
    )}
    {...props}
  />
))
Card.displayName = 'Card'

export const CardHeader = ({ className, ...props }: Div) => (
  <div className={cn('flex flex-col gap-1 p-5 pb-3', className)} {...props} />
)

export const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn('font-serif text-[20px] leading-tight text-ink', className)} {...props} />
)

export const CardDescription = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn('text-[13px] text-muted', className)} {...props} />
)

export const CardContent = ({ className, ...props }: Div) => (
  <div className={cn('p-5 pt-0', className)} {...props} />
)

export const CardFooter = ({ className, ...props }: Div) => (
  <div className={cn('flex items-center gap-2 p-5 pt-0', className)} {...props} />
)

/** Small uppercase-tracked section heading (Section 13, h3). */
export const SectionTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3
    className={cn('text-[12px] font-semibold uppercase tracking-[0.09em] text-muted', className)}
    {...props}
  />
)
