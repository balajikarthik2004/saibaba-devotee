import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium leading-5 whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'border-line bg-tint text-brand-700',
        neutral: 'border-line bg-bg text-muted',
        brand: 'border-brand-500/25 bg-brand-500/10 text-brand-600',
        gold: 'border-gold-500/35 bg-gold-500/15 text-gold-600',
        leaf: 'border-leaf-500/25 bg-leaf-500/12 text-leaf-600',
        outline: 'border-line bg-card text-ink',
        solid: 'border-transparent bg-brand-500 text-white',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export const Badge = ({ className, variant, ...props }: BadgeProps) => (
  <span className={cn(badgeVariants({ variant }), className)} {...props} />
)

export const Separator = ({ className, vertical }: { className?: string; vertical?: boolean }) => (
  <div
    role="separator"
    className={cn(vertical ? 'w-px self-stretch' : 'h-px w-full', 'bg-line', className)}
  />
)

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn('animate-pulse rounded-md bg-line/70', className)} />
)

export const Avatar = ({
  initials,
  className,
  tone = 'brand',
  style,
}: {
  initials: string
  className?: string
  tone?: 'brand' | 'gold' | 'leaf'
  /** Lets a caller size the disc from a measurement rather than a Tailwind step. */
  style?: React.CSSProperties
}) => (
  <span
    style={style}
    className={cn(
      'inline-flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white',
      tone === 'brand' && 'bg-brand-500',
      tone === 'gold' && 'bg-gold-500',
      tone === 'leaf' && 'bg-leaf-500',
      className,
    )}
  >
    {initials}
  </span>
)

export const Progress = ({
  value,
  label,
  className,
  tone = 'brand',
}: {
  value: number
  /** Accessible name — an ARIA progressbar is meaningless to a screen reader without one. */
  label?: string
  className?: string
  tone?: 'brand' | 'gold' | 'leaf'
}) => (
  <div
    role="progressbar"
    aria-label={label ?? 'Progress'}
    aria-valuenow={Math.round(value)}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuetext={`${Math.round(value)}%`}
    className={cn('h-2 w-full overflow-hidden rounded-full bg-line/80', className)}
  >
    <div
      className={cn(
        'h-full rounded-full transition-[width] duration-500',
        tone === 'brand' && 'bg-brand-500',
        tone === 'gold' && 'bg-gold-500',
        tone === 'leaf' && 'bg-leaf-500',
      )}
      style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
    />
  </div>
)
