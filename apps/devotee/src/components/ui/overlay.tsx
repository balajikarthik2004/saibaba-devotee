import * as React from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'

function useDismiss(open: boolean, onClose: () => void) {
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
}

interface OverlayProps {
  open: boolean
  onClose: () => void
  title?: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}

/** Centred modal. Stands in for shadcn `Dialog`. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: OverlayProps) {
  useDismiss(open, onClose)
  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div
        className="fixed inset-0 bg-ink/35 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={cn(
          'animate-fade-in relative z-10 my-auto w-full max-w-lg rounded-[14px] border border-line bg-card shadow-[var(--shadow-lg)]',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line p-5">
          <div className="min-w-0">
            {title ? <h2 className="font-serif text-[20px] leading-tight">{title}</h2> : null}
            {description ? <p className="mt-1 text-[13px] text-muted">{description}</p> : null}
          </div>
          <Button
            variant="plain"
            size="icon"
            onClick={onClose}
            aria-label="Close"
            className="no-print"
          >
            <X />
          </Button>
        </div>
        <div className="p-5">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line p-4 no-print">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

/** Right-hand slide-over. Stands in for shadcn `Sheet`. */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  side = 'right',
}: OverlayProps & { side?: 'right' | 'left' | 'bottom' }) {
  useDismiss(open, onClose)
  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={cn(
          'absolute flex flex-col border-line bg-card shadow-[var(--shadow-lg)]',
          side === 'right' && 'inset-y-0 right-0 w-full max-w-md border-l',
          side === 'left' && 'inset-y-0 left-0 w-full max-w-xs border-r',
          side === 'bottom' && 'inset-x-0 bottom-0 max-h-[85vh] rounded-t-[14px] border-t',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line p-5">
          <div className="min-w-0">
            {title ? <h2 className="font-serif text-[20px] leading-tight">{title}</h2> : null}
            {description ? <p className="mt-1 text-[13px] text-muted">{description}</p> : null}
          </div>
          <Button variant="plain" size="icon" onClick={onClose} aria-label="Close">
            <X />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-line p-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

/** Click-outside dropdown. Stands in for shadcn `DropdownMenu` / `Popover`. */
export function Popover({
  trigger,
  children,
  align = 'end',
  className,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode
  children: (close: () => void) => React.ReactNode
  align?: 'start' | 'end'
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open ? (
        <div
          className={cn(
            'animate-fade-in absolute z-40 mt-2 min-w-[200px] rounded-[10px] border border-line bg-card p-1.5 shadow-[var(--shadow-lg)]',
            align === 'end' ? 'right-0' : 'left-0',
            className,
          )}
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  )
}

export const MenuItem = ({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    type="button"
    className={cn(
      'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] text-ink transition-colors hover:bg-tint disabled:opacity-40',
      className,
    )}
    {...props}
  />
)
