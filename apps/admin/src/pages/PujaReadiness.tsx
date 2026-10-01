import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCheck, ClipboardList, PackageCheck, ShoppingBasket, TriangleAlert } from 'lucide-react'
import type { ReadinessRow } from '@/lib/data/types'
import { PageShell } from '@/components/layout/PageShell'
import { StatTile } from '@/components/shared/StatTile'
import { EmptyState, LoadingSkeleton } from '@/components/shared/states'
import { CoverageMeter, ReadinessBadge } from '@/components/shared/StockBadges'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, Textarea } from '@/components/ui/input'
import { Dialog } from '@/components/ui/overlay'
import { Table, TBody, TD, TH, THead, TR, TableWrap } from '@/components/ui/table'
import { Chips } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/toast'
import { confirmReadiness, flagReadiness, listReadiness, READINESS_WINDOW_DAYS } from '@/lib/data/api'
import { useAuthStore } from '@/lib/store/auth'
import { useAsync } from '@/lib/hooks'
import { cn, fmtDay, fmtTime, money } from '@/lib/utils'

/**
 * The priest's check, one and two days out.
 *
 * Grouped by day rather than listed flat, because the question being asked is "what do I
 * need to buy before tomorrow?" and a single sorted table makes the reader do the
 * grouping in their head. Today and tomorrow are different shopping trips.
 *
 * The shortfall figures here are cumulative across the window by design — see
 * `buildReadinessRows` in `api.ts`. Six coconuts cover the first puja that wants six;
 * the second one that wants six is shown short, because it is. A per-puja check against
 * the raw shelf count would show both as fine and send the priest into Thursday evening
 * one puja short of coconuts, which is the exact failure this screen exists to prevent.
 */

type Filter = 'all' | 'todo' | 'short'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'todo', label: 'Needs a decision' },
  { key: 'short', label: 'Short or flagged' },
  { key: 'all', label: 'Everything in the window' },
]

const DAY_LABELS = ['Today', 'Tomorrow']
const dayLabel = (n: number) => DAY_LABELS[n] ?? `In ${n} days`

export default function PujaReadiness() {
  const { toast } = useToast()
  const actor = useAuthStore((s) => s.user)!

  const [filter, setFilter] = useState<Filter>('todo')
  const [openId, setOpenId] = useState<string | null>(null)
  const [mode, setMode] = useState<'confirm' | 'flag'>('confirm')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const { data, loading, refresh } = useAsync(() => listReadiness(READINESS_WINDOW_DAYS), [])
  const rows = useMemo(() => data ?? [], [data])

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (filter === 'todo') return r.state === 'ready' || r.state === 'short'
        if (filter === 'short') return r.state === 'short' || r.state === 'flagged'
        return true
      }),
    [rows, filter],
  )

  /** Grouped by day so the list reads as a plan rather than as a queue. */
  const byDay = useMemo(() => {
    const map = new Map<number, ReadinessRow[]>()
    for (const r of filtered) {
      const list = map.get(r.daysAway) ?? []
      list.push(r)
      map.set(r.daysAway, list)
    }
    return [...map.entries()].sort(([a], [b]) => a - b)
  }, [filtered])

  const pending = rows.filter((r) => r.state === 'ready' || r.state === 'short')
  const shortRows = rows.filter((r) => r.state === 'short')
  const confirmed = rows.filter((r) => r.state === 'confirmed')

  /**
   * Everything missing across the whole window, added up per item.
   *
   * The one thing a priest actually carries to the shop. Per-puja shortfalls are what
   * the rows show; a shopping list is the sum of them, and asking somebody to add
   * "2 lotus" and "6 lotus" across four cards is how a second trip happens.
   */
  const shoppingList = useMemo(() => {
    const map = new Map<string, { label: string; unit: string; qty: number }>()
    for (const r of rows) {
      if (r.state === 'confirmed') continue
      for (const l of r.lines) {
        if (l.optional || l.short <= 0) continue
        const row = map.get(l.itemId) ?? { label: l.label, unit: l.unit, qty: 0 }
        row.qty += l.short
        map.set(l.itemId, row)
      }
    }
    return [...map.values()].sort((a, b) => b.qty - a.qty)
  }, [rows])

  const open = rows.find((r) => r.occurrence.id === openId) ?? null

  const openRow = (r: ReadinessRow, m: 'confirm' | 'flag') => {
    setOpenId(r.occurrence.id)
    setMode(m)
    setNote('')
  }

  const commit = async () => {
    if (!open) return
    setBusy(true)
    try {
      if (mode === 'confirm') {
        await confirmReadiness(open.occurrence.id, actor, note)
        toast('Confirmed ready', {
          detail: 'The items have been issued from the store.',
        })
      } else {
        await flagReadiness(open.occurrence.id, actor, note)
        toast('Flagged as short', {
          detail: 'Nothing has been issued. It stays on the worklist.',
          tone: 'warn',
        })
      }
      setOpenId(null)
      refresh()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not record that', { tone: 'warn' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageShell
      eyebrow="Stores"
      title="Puja readiness"
      description={`Everything scheduled in the next ${READINESS_WINDOW_DAYS} days, checked against the store.`}
      tabs={
        <Chips
          items={FILTERS.map((f) => ({
            key: f.key,
            label: f.key === 'todo' ? `${f.label} (${pending.length})` : f.label,
          }))}
          value={filter}
          onChange={(k) => setFilter(k as Filter)}
        />
      }
    >
      {loading ? (
        <LoadingSkeleton variant="tiles" rows={4} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Awaiting your check"
              value={pending.length}
              tone={pending.length > 0 ? 'brand' : 'leaf'}
              Icon={ClipboardList}
              sub={`Next ${READINESS_WINDOW_DAYS} days`}
            />
            <StatTile
              label="Short of stock"
              value={shortRows.length}
              tone={shortRows.length > 0 ? 'brand' : 'leaf'}
              Icon={TriangleAlert}
              sub="Required items missing"
            />
            <StatTile
              label="Confirmed ready"
              value={confirmed.length}
              tone="leaf"
              Icon={CheckCheck}
              sub="Stock issued from the store"
            />
            <StatTile
              label="To buy"
              value={money(rows.reduce((sum, r) => sum + (r.state === 'confirmed' ? 0 : r.shortfallCost), 0))}
              tone="gold"
              Icon={ShoppingBasket}
              sub={`${shoppingList.length} item${shoppingList.length === 1 ? '' : 's'} across the window`}
            />
          </div>

          {shoppingList.length > 0 ? (
            <Card className="mt-5 border-saffron-500/30 bg-saffron-500/[0.05]">
              <CardContent className="py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-sm font-bold text-ink">
                    Shopping list for the next {READINESS_WINDOW_DAYS} days
                  </h2>
                  <span className="text-xs text-muted">
                    Everything missing, summed across every puja in the window
                  </span>
                </div>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {shoppingList.map((s) => (
                    <li
                      key={s.label}
                      className="rounded-full border border-saffron-500/30 bg-card px-3 py-1 text-sm"
                    >
                      <span className="font-semibold text-ink">
                        {s.qty} {s.unit}
                      </span>
                      <span className="text-muted"> {s.label}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          <div className="mt-5 space-y-6">
            {byDay.length === 0 ? (
              <EmptyState
                title={
                  filter === 'todo' ? 'Everything is checked' : 'Nothing scheduled in the window'
                }
                detail={
                  filter === 'todo'
                    ? `Every puja in the next ${READINESS_WINDOW_DAYS} days has been signed off.`
                    : 'Bookings materialise their occurrences once a priest is assigned.'
                }
              />
            ) : (
              byDay.map(([days, group]) => (
                <section key={days}>
                  <div className="mb-2.5 flex items-baseline gap-2">
                    <h2 className="text-sm font-bold text-ink">{dayLabel(days)}</h2>
                    <span className="text-xs text-muted">
                      {fmtDay(group[0]!.occurrence.scheduledAt)} · {group.length} puja
                      {group.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    {group.map((r) => (
                      <ReadinessCard
                        key={r.occurrence.id}
                        row={r}
                        onConfirm={() => openRow(r, 'confirm')}
                        onFlag={() => openRow(r, 'flag')}
                      />
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </>
      )}

      <Dialog
        open={Boolean(open)}
        onClose={() => setOpenId(null)}
        className="max-w-xl"
        title={
          open
            ? mode === 'confirm'
              ? `Confirm ${open.puja.name} is ready`
              : `Flag ${open.puja.name} as short`
            : ''
        }
        description={
          open
            ? mode === 'confirm'
              ? 'Confirming issues these items from the store and writes them to the ledger.'
              : 'Nothing is issued. The puja stays on the worklist until the stock arrives.'
            : undefined
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpenId(null)}>
              Cancel
            </Button>
            <Button
              variant={mode === 'confirm' ? 'leaf' : 'saffron'}
              disabled={busy || (mode === 'flag' && !note.trim())}
              onClick={commit}
            >
              {mode === 'confirm' ? 'Confirm and issue stock' : 'Flag as short'}
            </Button>
          </div>
        }
      >
        {open ? (
          <div className="space-y-4">
            {mode === 'confirm' && open.shortCount > 0 ? (
              <p className="flex items-start gap-2 rounded-[8px] border border-brand-500/30 bg-brand-500/[0.07] px-3 py-2 text-xs leading-relaxed text-brand-700">
                <TriangleAlert className="mt-px size-3.5 shrink-0" />
                {open.shortCount} required item{open.shortCount === 1 ? ' is' : 's are'} short. Only
                what is actually on the shelf will be issued — confirm anyway if you are bringing
                the rest yourself.
              </p>
            ) : null}

            <TableWrap>
              <Table>
                <THead>
                  <TR>
                    <TH>Item</TH>
                    <TH className="w-20 text-right">Needs</TH>
                    <TH className="w-20 text-right">In store</TH>
                    <TH className="w-20 text-right">Short</TH>
                  </TR>
                </THead>
                <TBody>
                  {open.lines.map((l) => (
                    <TR key={l.itemId}>
                      <TD>
                        <span className={l.short > 0 && !l.optional ? 'font-medium text-ink' : 'text-ink-soft'}>
                          {l.label}
                        </span>
                        {l.optional ? (
                          <Badge variant="neutral" className="ml-2">
                            Optional
                          </Badge>
                        ) : null}
                      </TD>
                      <TD className="text-right tabular-nums text-muted">
                        {l.required} {l.unit}
                      </TD>
                      <TD className="text-right tabular-nums text-muted">{l.onHand}</TD>
                      <TD
                        className={cn(
                          'text-right font-semibold tabular-nums',
                          l.short > 0 && !l.optional ? 'text-brand-600' : 'text-faint',
                        )}
                      >
                        {l.short > 0 ? l.short : '—'}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>

            <Field
              label={mode === 'flag' ? 'What is missing, and what is being done?' : 'Note'}
              hint={mode === 'flag' ? 'Required — the administrator reads this' : 'Optional'}
            >
              <Textarea
                rows={3}
                autoFocus={mode === 'flag'}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  mode === 'flag'
                    ? 'Lotus not available at the market today — trying the Sugar Land supplier tomorrow morning.'
                    : 'Garlands collected, kept in the cold room.'
                }
              />
            </Field>
          </div>
        ) : null}
      </Dialog>
    </PageShell>
  )
}

/**
 * One puja in the window.
 *
 * A card rather than a table row because each one carries four different kinds of thing —
 * a time, a coverage bar, a list of shortfalls and two decisions — and a table wide
 * enough for all four stops being readable at exactly the width a priest opens it on.
 */
function ReadinessCard({
  row,
  onConfirm,
  onFlag,
}: {
  row: ReadinessRow
  onConfirm: () => void
  onFlag: () => void
}) {
  const missing = row.lines.filter((l) => !l.optional && l.short > 0)
  const settled = row.state === 'confirmed'

  return (
    <Card
      className={cn(
        'flex flex-col',
        row.state === 'short' && 'border-brand-500/30',
        row.state === 'flagged' && 'border-saffron-500/35',
        settled && 'border-leaf-500/30 bg-leaf-500/[0.03]',
      )}
    >
      <CardContent className="flex flex-1 flex-col gap-3 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{row.puja.name}</p>
            <p className="truncate text-xs text-muted">
              {fmtTime(row.occurrence.scheduledAt)}
              {row.occurrence.officiant ? ` · ${row.occurrence.officiant}` : ''}
            </p>
          </div>
          <ReadinessBadge state={row.state} />
        </div>

        {row.state === 'no-sheet' ? (
          <div className="rounded-[8px] border border-line bg-faint/60 px-3 py-2.5">
            <p className="text-xs leading-relaxed text-ink-soft">
              No approved requirement sheet for this puja, so there is nothing to check against.
            </p>
            <Link
              to="/requirements"
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'mt-2')}
            >
              <ClipboardList />
              Start one
            </Link>
          </div>
        ) : (
          <>
            <CoverageMeter row={row} />

            {missing.length > 0 ? (
              <ul className="space-y-1">
                {missing.map((l) => (
                  <li key={l.itemId} className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate text-ink-soft">
                      {l.label}
                      {l.perishable ? <span className="text-muted"> · perishable</span> : null}
                    </span>
                    <span className="whitespace-nowrap font-semibold tabular-nums text-brand-600">
                      {l.short} {l.unit} short
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            {row.readiness?.note ? (
              <p className="rounded-[8px] border border-line bg-faint/60 px-2.5 py-1.5 text-xs leading-relaxed text-ink-soft">
                <span className="font-semibold text-ink">{row.readiness.byName}: </span>
                {row.readiness.note}
              </p>
            ) : null}

            <div className="mt-auto flex items-center gap-2 pt-1">
              {settled ? (
                <p className="text-xs text-leaf-600">
                  Confirmed by {row.readiness?.byName} — stock issued.
                </p>
              ) : (
                <>
                  <Button size="sm" variant="leaf" onClick={onConfirm}>
                    <PackageCheck />
                    Confirm ready
                  </Button>
                  <Button size="sm" variant="outline" onClick={onFlag}>
                    Flag short
                  </Button>
                  {row.shortfallCost > 0 ? (
                    <span className="ml-auto text-xs text-muted">
                      {money(row.shortfallCost)} to buy
                    </span>
                  ) : null}
                </>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
