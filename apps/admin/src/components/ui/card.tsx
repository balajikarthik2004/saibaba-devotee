import * as React from 'react'
import { cn } from '@/lib/utils'

type Div = React.HTMLAttributes<HTMLDivElement>

export const Card = React.forwardRef<HTMLDivElement, Div>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    // `min-w-0` so a card never forces its flex/grid parent wider than the viewport —
    // without it an inner `overflow-x-auto` table never gets the chance to clip.
    // `border-hairline`, not `border-line`: this is the boundary between the card and
    // the cream wash behind it, and at `line` strength the top edge of a white card
    // simply disappeared into the page.
    className={cn(
      'min-w-0 rounded-[var(--radius-lg)] border border-hairline bg-card shadow-[var(--shadow-sm)]',
      className,
    )}
    {...props}
  />
))
Card.displayName = 'Card'

/**
 * Header sits on a tinted band with a hairline under it, so a card with a table or a
 * chart in it has a visible title bar instead of a heading floating in white space.
 */
export const CardHeader = ({ className, ...props }: Div) => (
  <div
    className={cn(
      'flex flex-col gap-0.5 rounded-t-[var(--radius-lg)] border-b border-line-soft px-4 py-3',
      className,
    )}
    {...props}
  />
)

export const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn('font-serif text-lg text-ink', className)} {...props} />
)

export const CardDescription = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) => (
  // A description sits directly under a title it is explaining, so it is capped to a
  // reading measure. Left to run the full width of a chart card it became a single
  // 90-character line that read as a caption to nothing.
  <p className={cn('max-w-[62ch] text-sm leading-relaxed text-muted', className)} {...props} />
)

export const CardContent = ({ className, ...props }: Div) => (
  <div className={cn('p-4', className)} {...props} />
)

export const CardFooter = ({ className, ...props }: Div) => (
  <div
    className={cn(
      'flex items-center gap-2 rounded-b-[var(--radius-lg)] border-t border-line-soft bg-tint/60 px-4 py-2.5',
      className,
    )}
    {...props}
  />
)
