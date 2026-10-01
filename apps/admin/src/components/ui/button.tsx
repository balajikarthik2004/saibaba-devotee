import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Buttons carry a hairline of their own colour and a whisper of shadow, so a row of
 * them reads as a row of raised controls rather than as flat coloured rectangles.
 * Focus is left to the global ring in `index.css` — every control in the console
 * shares one halo, and repeating it per variant is how they drift apart.
 */
export const buttonVariants = cva(
  'inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius)] font-semibold ' +
    'transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:scale-[.98] ' +
    // Disabled is a state of its own, not a faded copy of the enabled one. Fading a
    // maroon button to 45% produced a pale pink that read as a rendering fault rather
    // than as "not available yet" — and the toolbar above the archana roster shows
    // exactly that button, disabled, every time the page loads. Overriding the fill,
    // border and text outright gives one flat, obviously-inert control instead.
    'disabled:pointer-events-none disabled:border-line disabled:bg-tint disabled:text-faint ' +
    'disabled:shadow-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-brand-500 text-white shadow-[var(--shadow-xs)] hover:bg-brand-600',
        ghost: 'border border-brand-500/30 bg-card text-brand-600 hover:bg-brand-50',
        subtle: 'bg-tint text-ink-soft hover:bg-ink/[0.06] hover:text-ink',
        outline:
          'border border-line bg-card text-ink-soft shadow-[var(--shadow-xs)] hover:border-muted hover:text-ink',
        saffron: 'bg-saffron-500 text-white shadow-[var(--shadow-xs)] hover:bg-saffron-600',
        gold: 'bg-gold-500 text-white shadow-[var(--shadow-xs)] hover:bg-gold-600',
        leaf: 'bg-leaf-500 text-white shadow-[var(--shadow-xs)] hover:bg-leaf-600',
        destructive: 'bg-brand-600 text-white shadow-[var(--shadow-xs)] hover:bg-brand-700',
        link: 'text-brand-600 underline-offset-4 hover:underline',
        plain: 'text-muted hover:bg-tint hover:text-ink',
      },
      size: {
        // Heights step in 4px so a toolbar of mixed controls lines up on one baseline.
        sm: 'h-8 gap-1.5 px-3 text-sm [&_svg]:size-3.5',
        default: 'h-9 px-3.5 text-sm [&_svg]:size-4',
        lg: 'h-10 px-5 text-base [&_svg]:size-[17px]',
        icon: 'size-9 [&_svg]:size-4',
        'icon-sm': 'size-8 [&_svg]:size-3.5',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
)
Button.displayName = 'Button'
