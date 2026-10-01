import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Status pills. Held deliberately quiet — in a table of forty rows the badge is a
 * label, not a highlight, so the tint stays low and the text carries the weight.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-px text-xs font-semibold leading-[18px] tracking-[0.005em] whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'border-line bg-tint text-ink-soft',
        neutral: 'border-line bg-bg text-muted',
        brand: 'border-brand-500/25 bg-brand-500/[0.08] text-brand-600',
        gold: 'border-saffron-500/30 bg-saffron-500/[0.12] text-saffron-600',
        leaf: 'border-leaf-500/28 bg-leaf-500/[0.1] text-leaf-600',
        outline: 'border-line bg-card text-ink-soft',
        solid: 'border-brand-500 bg-brand-500 text-white',
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
  <div className={cn('animate-pulse rounded-[6px] bg-line/60', className)} />
)

/**
 * Initials avatar. A soft inner highlight and a ring of the same hue lift it off the
 * page — a flat disc of maroon beside cream paper reads as a printing error.
 */
export const Avatar = ({
  initials,
  className,
  tone = 'brand',
}: {
  initials: string
  className?: string
  tone?: 'brand' | 'gold' | 'leaf'
}) => (
  <span
    className={cn(
      'inline-grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold tracking-[0.02em] text-white',
      'shadow-[var(--shadow-xs)]',
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
    className={cn('h-1.5 w-full overflow-hidden rounded-full bg-line', className)}
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
