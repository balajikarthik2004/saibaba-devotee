import * as React from 'react'
import { cn } from '@/lib/utils'

export const TableWrap = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'w-full overflow-x-auto rounded-[12px] border border-line bg-card shadow-[var(--shadow-sm)]',
      className,
    )}
    {...props}
  />
)

export const Table = ({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) => (
  <table className={cn('w-full border-collapse text-left text-[13.5px]', className)} {...props} />
)

export const THead = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className={cn('bg-tint/60', className)} {...props} />
)

export const TBody = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody className={cn('divide-y divide-line', className)} {...props} />
)

export const TR = ({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr className={cn('transition-colors', className)} {...props} />
)

export const TH = ({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th
    className={cn(
      'border-b border-line px-3 py-2.5 text-[11.5px] font-semibold uppercase tracking-[0.07em] text-muted whitespace-nowrap',
      className,
    )}
    {...props}
  />
)

export const TD = ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn('px-3 py-2.5 align-middle', className)} {...props} />
)
