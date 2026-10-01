import * as React from 'react'
import { cn } from '@/lib/utils'

const field =
  'w-full rounded-md border border-line bg-card px-3 text-sm text-ink placeholder:text-muted/70 ' +
  'transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/35 ' +
  'focus-visible:border-brand-400 disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-tint/60'

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(field, 'h-10', className)} {...props} />
))
Input.displayName = 'Input'

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, rows = 4, ...props }, ref) => (
  <textarea
    ref={ref}
    rows={rows}
    className={cn(field, 'py-2 leading-relaxed', className)}
    {...props}
  />
))
Textarea.displayName = 'Textarea'

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      field,
      'h-10 cursor-pointer appearance-none bg-[length:14px] bg-[right_10px_center] bg-no-repeat pr-8',
      className,
    )}
    style={{
      backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b625a' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
    }}
    {...props}
  />
))
Select.displayName = 'Select'

export const Label = ({
  className,
  children,
  hint,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { hint?: React.ReactNode }) => (
  <label
    className={cn('mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-ink', className)}
    {...props}
  >
    {children}
    {hint ? <span className="text-[12px] font-normal text-muted">{hint}</span> : null}
  </label>
)

export const Field = ({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label?: React.ReactNode
  hint?: React.ReactNode
  error?: string
  htmlFor?: string
  children: React.ReactNode
  className?: string
}) => (
  <div className={cn('min-w-0', className)}>
    {label ? (
      <Label htmlFor={htmlFor} hint={hint}>
        {label}
      </Label>
    ) : null}
    {children}
    {error ? <p className="mt-1 text-[12px] text-brand-600">{error}</p> : null}
  </div>
)

export const Checkbox = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    type="checkbox"
    className={cn(
      'size-4 shrink-0 cursor-pointer rounded-[4px] border border-line accent-[var(--color-brand-500)] ' +
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/35',
      className,
    )}
    {...props}
  />
))
Checkbox.displayName = 'Checkbox'

export const Radio = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    type="radio"
    className={cn(
      'size-4 shrink-0 cursor-pointer accent-[var(--color-brand-500)] ' +
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/35',
      className,
    )}
    {...props}
  />
))
Radio.displayName = 'Radio'
