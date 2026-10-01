import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * One field recipe for every control. The inset hairline shadow is what makes an input
 * read as a well rather than a bordered box, and it is the cheapest way to tell a
 * disabled field from an enabled one at a glance.
 */
const field =
  'w-full rounded-[var(--radius)] border border-line bg-card px-2.5 text-sm text-ink ' +
  'placeholder:text-faint ' +
  'transition-[border-color,box-shadow] duration-150 hover:border-muted ' +
  'focus-visible:border-brand-400 ' +
  'disabled:cursor-not-allowed disabled:border-line-soft disabled:bg-tint/50 disabled:text-muted ' +
  'aria-[invalid=true]:border-brand-500 aria-[invalid=true]:bg-brand-50/40'

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(field, 'h-9', className)} {...props} />
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
      'h-9 cursor-pointer appearance-none bg-[length:13px] bg-[right_10px_center] bg-no-repeat pr-8',
      className,
    )}
    style={{
      backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236f6157' stroke-width='2.25' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
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
    className={cn(
      'mb-1 flex items-baseline gap-1.5 text-xs font-semibold text-ink-soft',
      className,
    )}
    {...props}
  >
    {children}
    {hint ? <span className="text-xs font-normal text-faint">{hint}</span> : null}
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
    {error ? (
      <p className="mt-1 text-xs font-medium text-brand-600" role="alert">
        {error}
      </p>
    ) : null}
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
      'size-4 shrink-0 cursor-pointer rounded-[3px] border border-line accent-[var(--color-brand-500)] ' +
        'transition-colors hover:border-muted',
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
    className={cn('size-4 shrink-0 cursor-pointer accent-[var(--color-brand-500)]', className)}
    {...props}
  />
))
Radio.displayName = 'Radio'
