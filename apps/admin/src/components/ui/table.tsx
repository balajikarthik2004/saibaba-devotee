import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * `scroll` turns the table into its own scroll region, which is the only way the sticky
 * column headings below actually work.
 *
 * The wrapper has always had `overflow-x-auto` so a wide ledger could scroll sideways.
 * What that quietly did was make the wrapper a scroll container on *both* axes — CSS
 * computes `overflow-y: visible` to `auto` as soon as the other axis is not visible — so
 * the sticky `<thead>` inside it was sticking to a box that never scrolls vertically.
 * The headings looked pinned in a short table and vanished in a long one, which is the
 * exact opposite of what a sticky header is for.
 *
 * Making the region explicit fixes it and reads better besides: the page header, the
 * filters and the column headings all hold still, the rows move inside them, and the
 * pagination stays on screen instead of being 25 rows below the fold.
 */
export const TableWrap = ({
  className,
  scroll = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { scroll?: boolean }) => (
  <div
    className={cn(
      'w-full overflow-x-auto rounded-[var(--radius-lg)] border border-hairline bg-card shadow-[var(--shadow-sm)]',
      // `lg` and up only, matching where `PageShell` actually pins its header. Below
      // that the page header scrolls away, so reserving room for it would leave the
      // table short by the height of something no longer on screen — and a phone is
      // better served by one long page than by a scroll region inside a scroll region.
      //
      // Floored at 20rem so a short laptop window still shows a usable number of rows
      // rather than collapsing to a two-row slot.
      scroll &&
        'lg:overflow-y-auto lg:[max-height:max(20rem,calc(100dvh-var(--page-chrome-h,0px)-8.5rem))]',
      className,
    )}
    {...props}
  />
)

export const Table = ({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) => (
  <table className={cn('w-full border-collapse text-left text-base', className)} {...props} />
)

/**
 * Sticky by default. An ops table routinely runs past a screenful, and losing the column
 * headings three rows into a donation ledger is the fastest way to misread a figure.
 *
 * The header keeps a solid fallback fill: with a translucent tint, rows scrolling
 * underneath showed through and the headings became unreadable exactly when they
 * mattered most.
 */
export const THead = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead
    // `top-0` is relative to the scroll region `TableWrap scroll` establishes, not to
    // the viewport — so the headings settle directly under the page's pinned filters
    // rather than behind them.
    //
    // Solid fill, not a tint: with anything translucent the rows scrolling underneath
    // showed through and the headings became unreadable exactly when they mattered.
    className={cn('sticky top-0 z-10 bg-tint shadow-[0_1px_0_var(--color-line)]', className)}
    {...props}
  />
)

/** Hairlines between rows are the soft weight — a full rule per row builds a cage. */
export const TBody = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody className={cn('divide-y divide-line-soft', className)} {...props} />
)

/**
 * Rows tint on hover. Scanning a wide ledger means tracking one row across eight
 * columns, and a hover band is what keeps your eye on it without a cursor ruler.
 */
export const TR = ({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr className={cn('transition-colors hover:bg-tint/60', className)} {...props} />
)

/**
 * Column headings are set in `muted`, not `faint`. Faint is the right weight for a
 * stat-tile label sitting on white, but a table header sits on the tint band, and at
 * 11px against that ground it fell under 4.5:1 — the labels that tell you which column
 * holds the money were the least legible text on the page.
 *
 * The first and last cells in a row take extra outside padding so the content clears
 * the card's rounded corner instead of running into it.
 */
export const TH = ({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th
    className={cn(
      'px-3.5 py-2.5 text-2xs font-bold uppercase tracking-[0.1em] whitespace-nowrap text-muted',
      'first:pl-4 last:pr-4',
      className,
    )}
    {...props}
  />
)

export const TD = ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td
    className={cn('px-3.5 py-2.5 align-middle text-ink-soft first:pl-4 last:pr-4', className)}
    {...props}
  />
)

/**
 * Money and counts, right-aligned and tabular. Figures only compare if their digits
 * sit in the same columns, so amounts get their own cell rather than a utility class
 * remembered per page.
 */
export const TDNum = ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <TD className={cn('text-right font-medium tabular-nums text-ink', className)} {...props} />
)

export const THNum = ({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <TH className={cn('text-right', className)} {...props} />
)
