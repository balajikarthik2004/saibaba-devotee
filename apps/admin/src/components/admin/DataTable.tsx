import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { Table, TBody, TD, TH, THead, TR, TableWrap } from '@/components/ui/table'
import { EmptyState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: string
  header: string
  /** Value used for sorting; omit to make the column unsortable. */
  sortValue?: (row: T) => string | number
  cell: (row: T) => React.ReactNode
  className?: string
  align?: 'left' | 'right' | 'center'
}

const PAGE_SIZE = 25

/**
 * Sortable, paginated table over shadcn's `Table` primitives. Every admin list view
 * uses this, so sorting and paging behave identically across the console.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  empty,
  initialSort,
  pageSize = PAGE_SIZE,
  className,
}: {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  empty?: { title: string; detail?: string }
  initialSort?: { key: string; dir: 'asc' | 'desc' }
  pageSize?: number
  className?: string
}) {
  const [sortKey, setSortKey] = useState(initialSort?.key ?? '')
  const [dir, setDir] = useState<'asc' | 'desc'>(initialSort?.dir ?? 'asc')
  const [page, setPage] = useState(0)

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey)
    if (!col?.sortValue) return rows
    const copy = [...rows]
    copy.sort((a, b) => {
      const av = col.sortValue!(a)
      const bv = col.sortValue!(b)
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv))
      return dir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [rows, columns, sortKey, dir])

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const current = Math.min(page, pageCount - 1)
  const visible = sorted.slice(current * pageSize, current * pageSize + pageSize)

  const toggle = (key: string) => {
    setPage(0)
    if (key === sortKey) setDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setDir('asc')
    }
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title={empty?.title ?? 'Nothing to show'}
        detail={empty?.detail ?? 'Adjust your filters to widen the search.'}
      />
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      <TableWrap scroll>
        <Table>
          <THead>
            <TR>
              {columns.map((c) => (
                <TH
                  key={c.key}
                  className={cn(
                    c.align === 'right' && 'text-right',
                    c.align === 'center' && 'text-center',
                    c.className,
                  )}
                >
                  {c.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggle(c.key)}
                      // `uppercase` and the tracking are repeated here on purpose. The
                      // browser's own stylesheet sets `text-transform: none` on
                      // `button`, which beats the `uppercase` inherited from the `th` —
                      // so every sortable heading in the console rendered in sentence
                      // case beside its unsortable neighbours in caps. One table, two
                      // header styles, decided by whether the column happened to sort.
                      className={cn(
                        'inline-flex items-center gap-1 uppercase tracking-[0.1em] transition-colors hover:text-ink',
                        sortKey === c.key && 'text-brand-600',
                      )}
                    >
                      {c.header}
                      {sortKey === c.key ? (
                        dir === 'asc' ? (
                          <ArrowUp className="size-3" />
                        ) : (
                          <ArrowDown className="size-3" />
                        )
                      ) : (
                        <ChevronsUpDown className="size-3 opacity-40" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </TH>
              ))}
            </TR>
          </THead>
          <TBody>
            {visible.map((row) => (
              <TR
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(onRowClick && 'cursor-pointer')}
              >
                {columns.map((c) => (
                  <TD
                    key={c.key}
                    className={cn(
                      // A right-aligned column is a figure column: give it tabular
                      // digits and full ink, so amounts compare down the page.
                      c.align === 'right' && 'text-right font-medium tabular-nums text-ink',
                      c.align === 'center' && 'text-center',
                      c.className,
                    )}
                  >
                    {c.cell(row)}
                  </TD>
                ))}
              </TR>
            ))}
          </TBody>
        </Table>
      </TableWrap>

      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-sm text-muted">
        <p>
          Showing{' '}
          <span className="tabular-nums font-bold text-ink">
            {current * pageSize + 1}–{Math.min(sorted.length, (current + 1) * pageSize)}
          </span>{' '}
          of <span className="tabular-nums font-bold text-ink">{sorted.length}</span>
        </p>
        {pageCount > 1 ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={current === 0}
            >
              Previous
            </Button>
            <span className="tabular-nums font-semibold text-ink-soft">
              {current + 1} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={current >= pageCount - 1}
            >
              Next
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
