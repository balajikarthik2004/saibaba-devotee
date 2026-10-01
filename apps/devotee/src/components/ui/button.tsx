import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium tracking-[0.01em] ' +
    'transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[.97] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-1 ' +
    'disabled:pointer-events-none disabled:opacity-40 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-brand-500 text-white hover:bg-brand-600',
        ghost:
          'bg-transparent text-brand-500 border border-brand-500/45 hover:bg-brand-50 hover:border-brand-500/70',
        subtle: 'bg-tint text-brand-700 hover:bg-saffron-100',
        outline: 'bg-card text-ink border border-line hover:bg-tint',
        saffron: 'bg-saffron-400 text-brand-800 hover:bg-saffron-500',
        gold: 'bg-gold-500 text-white hover:bg-gold-600',
        leaf: 'bg-leaf-500 text-white hover:bg-leaf-600',
        destructive: 'bg-brand-600 text-white hover:bg-brand-700',
        link: 'text-brand-500 underline-offset-4 hover:underline',
        plain: 'text-muted hover:text-ink hover:bg-tint',
      },
      size: {
        sm: 'h-9 px-3.5 text-[13px] [&_svg]:size-4',
        default: 'h-10 px-4.5 text-[14px] [&_svg]:size-4',
        lg: 'h-12 px-7 text-[15px] [&_svg]:size-[18px]',
        icon: 'h-9 w-9 [&_svg]:size-4',
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
