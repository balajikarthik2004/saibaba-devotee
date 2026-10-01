import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calculator, Clock, Undo2, Wallet } from 'lucide-react'
import type { PujaCatalogItem, PujaRequirementSheet } from '@/lib/data/types'
import { PageShell } from '@/components/layout/PageShell'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { ApprovalTimeline } from '@/components/admin/ApprovalTimeline'
import { StatTile } from '@/components/shared/StatTile'
import { LoadingSkeleton } from '@/components/shared/states'
import { StageBadge, sittingsPerYear } from '@/components/shared/StockBadges'
import { Button, buttonVariants } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/input'
import { Sheet } from '@/components/ui/overlay'
import { Table, TBody, TD, TH, THead, TR, TableWrap } from '@/components/ui/table'
import { Chips } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/toast'
import {
  allocateRequirementBudget,
  getPujaCatalog,
  listRequirementSheets,
  sendBackRequirementSheet,
} from '@/lib/data/api'
import { OCCURRENCES_PER_YEAR } from '@/lib/data/mock'
import { useAuthStore } from '@/lib/store/auth'
import { useAsync } from '@/lib/hooks'
import { cn, fmtDate, money } from '@/lib/utils'

/**
 * The accounts desk, for requirements.
 *
 * It answers one question — what will the temple actually put behind this list? — and the
 * screen is built around making that number defensible rather than quick. The estimate
 * the priest submitted is costed line by line at store prices; the desk types its own
 * figure beside it and the annual implication is shown live underneath, because a $40
 * sheet on a weekly puja is $2,080 a year and nobody allocating per performance holds
 * that multiplication in their head.
 *
 * Deliberately parallel to `FinanceApprovals`, which does the same job for sponsorship
 * payments. Same queue-plus-sheet shape, same send-back-with-a-reason, same timeline —
 * one desk, two kinds of paper, and no reason for them to feel like different products.
 */

type Filter = 'queue' | 'moved-on' | 'all'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'queue', label: 'Awaiting allocation' },
  { key: 'moved-on', label: 'Allocated' },
  { key: 'all', label: 'Everything' },
]

const ageInDays = (iso: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000))

export default function RequirementFinance() {
  const { toast } = useToast()
  const actor = useAuthStore((s) => s.user)!

  const [filter, setFilter] = useState<Filter>('queue')
  const [openId, setOpenId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [mode, setMode] = useState<'allocate' | 'send-back'>('allocate')
  const [busy, setBusy] = useState(false)

  const { data, loading, refresh } = useAsync(
    async () => Promise.all([listRequirementSheets('all'), getPujaCatalog()]),
    [],
  )

  const [all, catalog] = useMemo(() => {
    if (!data) return [[] as PujaRequirementSheet[], [] as PujaCatalogItem[]] as const
    return data
  }, [data])

  const pujaById = useMemo(() => new Map(catalog.map((p) => [p.id, p])), [catalog])

  const queue = all.filter((s) => s.stage === 'finance-review')
  const allocated = all.filter(
    (s) => s.stage === 'admin-review' || s.stage === 'approved' || s.stage === 'superseded',
  )

  const rows = filter === 'queue' ? queue : filter === 'moved-on' ? allocated : all

  const open = all.find((s) => s.id === openId) ?? null
  const openPuja = open ? pujaById.get(open.pujaCatalogId) : undefined

  /** What the allocation comes to over a year at this puja's own rhythm. */
  const annualised = (sheet: PujaRequirementSheet, perPerformance: number) => {
    const puja = pujaById.get(sheet.pujaCatalogId)
    return puja ? perPerformance * OCCURRENCES_PER_YEAR[puja.defaultCadence] : 0
  }

  const openSheet = (s: PujaRequirementSheet) => {
    setOpenId(s.id)
    // Pre-filled with the priest's own estimate. The desk's job is usually to agree
    // with it or round it, and starting from an empty box invites a typo instead.
    setAmount(String(s.allocatedAmount ?? s.estimatedCost))
    setNote('')
    setMode('allocate')
  }

  const run = async (fn: () => Promise<unknown>, message: string, tone?: 'warn') => {
    setBusy(true)
    await fn()
    setBusy(false)
    setOpenId(null)
    toast(message, tone ? { tone } : undefined)
    refresh()
  }

  const columns: Column<PujaRequirementSheet>[] = [
    {
      key: 'puja',
      header: 'Puja',
      sortValue: (s) => pujaById.get(s.pujaCatalogId)?.name ?? '',
      cell: (s) => {
        const puja = pujaById.get(s.pujaCatalogId)
        return (
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{puja?.name ?? s.pujaCatalogId}</p>
            <p className="truncate text-xs text-muted">
              v{s.version} · {s.lines.length} items · prepared by {s.preparedByName}
            </p>
          </div>
        )
      },
    },
    {
      key: 'stage',
      header: 'Stage',
      sortValue: (s) => s.stage,
      cell: (s) => <StageBadge stage={s.stage} />,
    },
    {
      key: 'estimate',
      header: 'Costed estimate',
      align: 'right',
      sortValue: (s) => s.estimatedCost,
      cell: (s) => {
        const puja = pujaById.get(s.pujaCatalogId)
        return (
          <div className="text-right">
            <p className="font-semibold tabular-nums text-ink">{money(s.estimatedCost)}</p>
            <p className="text-2xs text-muted">
              per sitting · {puja ? sittingsPerYear(puja.defaultCadence) : '—'}
            </p>
          </div>
        )
      },
    },
    {
      key: 'annual',
      header: 'Annual implication',
      align: 'right',
      sortValue: (s) => annualised(s, s.allocatedAmount ?? s.estimatedCost),
      cell: (s) => (
        <span className="tabular-nums text-ink-soft">
          {money(annualised(s, s.allocatedAmount ?? s.estimatedCost))}
        </span>
      ),
    },
    {
      key: 'age',
      header: 'Waiting',
      sortValue: (s) => -new Date(s.updatedAt).getTime(),
      cell: (s) => {
        const days = ageInDays(s.updatedAt)
        return (
          <span
            className={cn(
              'whitespace-nowrap text-xs',
              days > 7 ? 'font-semibold text-brand-600' : 'text-muted',
            )}
          >
            {days === 0 ? 'Today' : `${days} day${days === 1 ? '' : 's'}`}
          </span>
        )
      },
    },
  ]

  const parsed = Number(amount)
  const validAmount = Number.isFinite(parsed) && parsed >= 0

  return (
    <PageShell
      eyebrow="Stores"
      title="Requirement budgets"
      description="What the temple will put behind each puja's requirement list, per performance."
      tabs={
        <Chips
          items={FILTERS.map((f) => ({
            key: f.key,
            label: f.key === 'queue' ? `${f.label} (${queue.length})` : f.label,
          }))}
          value={filter}
          onChange={(k) => setFilter(k as Filter)}
        />
      }
    >
      {loading ? (
        <LoadingSkeleton variant="tiles" rows={3} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile
              label="Awaiting allocation"
              value={queue.length}
              tone={queue.length > 0 ? 'brand' : 'leaf'}
              Icon={Clock}
              sub="Submitted by a priest"
            />
            <StatTile
              label="Costed value in the queue"
              value={money(queue.reduce((sum, s) => sum + s.estimatedCost, 0))}
              tone="gold"
              Icon={Calculator}
              sub="Per performance, at store prices"
            />
            <StatTile
              label="Annual implication in the queue"
              value={money(queue.reduce((sum, s) => sum + annualised(s, s.estimatedCost), 0))}
              Icon={Wallet}
              sub="Estimate × each puja's cadence"
            />
          </div>

          <div className="mt-5">
            <DataTable
              rows={rows}
              columns={columns}
              rowKey={(s) => s.id}
              onRowClick={openSheet}
              initialSort={{ key: 'age', dir: 'asc' }}
              empty={{
                title: 'Nothing waiting',
                detail: 'Requirement sheets arrive here once a priest submits them.',
              }}
            />
          </div>
        </>
      )}

      <Sheet
        open={Boolean(open)}
        onClose={() => setOpenId(null)}
        title={openPuja?.name ?? 'Requirement sheet'}
        description={
          open ? `Version ${open.version} · submitted by ${open.preparedByName}` : undefined
        }
        footer={
          open?.stage === 'finance-review' ? (
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="plain"
                onClick={() => setMode(mode === 'send-back' ? 'allocate' : 'send-back')}
              >
                <Undo2 />
                {mode === 'send-back' ? 'Back to allocating' : 'Send back'}
              </Button>
              {mode === 'send-back' ? (
                <Button
                  variant="destructive"
                  disabled={busy || !note.trim()}
                  onClick={() =>
                    run(
                      () => sendBackRequirementSheet(open.id, actor, note),
                      'Sent back to the priest',
                      'warn',
                    )
                  }
                >
                  Send back with this reason
                </Button>
              ) : (
                <Button
                  disabled={busy || !validAmount}
                  onClick={() =>
                    run(
                      () => allocateRequirementBudget(open.id, parsed, actor, note),
                      'Budget allocated',
                    )
                  }
                >
                  Allocate {validAmount ? money(parsed) : ''}
                </Button>
              )}
            </div>
          ) : (
            <div className="flex justify-end">
              <Link
                to={`/requirements/${open?.id ?? ''}`}
                className={buttonVariants({ variant: 'outline' })}
              >
                Open the full sheet
              </Link>
            </div>
          )
        }
      >
        {open ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StageBadge stage={open.stage} />
              <span className="text-xs text-muted">Last moved {fmtDate(open.updatedAt)}</span>
            </div>

            <div>
              <h3 className="eyebrow mb-2">What it buys</h3>
              <TableWrap>
                <Table>
                  <THead>
                    <TR>
                      <TH>Item</TH>
                      <TH className="w-20 text-right">Qty</TH>
                      <TH className="w-24 text-right">Cost</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {open.lines.map((l) => (
                      <TR key={l.itemId}>
                        <TD>
                          <span className="text-ink-soft">{l.label}</span>
                          {l.optional ? <span className="text-2xs text-muted"> · optional</span> : null}
                        </TD>
                        <TD className="text-right tabular-nums text-muted">
                          {l.qty} {l.unit}
                        </TD>
                        <TD className="text-right tabular-nums text-ink-soft">
                          {money(l.qty * l.unitCost)}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableWrap>
              <div className="mt-2 flex items-baseline justify-between border-t border-hairline pt-2">
                <span className="text-sm font-semibold text-ink">Costed estimate</span>
                <span className="text-lg font-bold tabular-nums text-ink">
                  {money(open.estimatedCost)}
                </span>
              </div>
            </div>

            {open.stage === 'finance-review' ? (
              mode === 'allocate' ? (
                <div className="space-y-3">
                  <Field
                    label="Allocation, per performance"
                    hint="What the temple will actually put behind this list"
                  >
                    <Input
                      type="number"
                      min={0}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </Field>

                  {validAmount ? (
                    <div className="rounded-[8px] border border-line bg-faint/60 px-3 py-2.5 text-xs leading-relaxed text-ink-soft">
                      <p className="flex items-center justify-between gap-3">
                        <span>Against the estimate</span>
                        <span
                          className={cn(
                            'font-semibold tabular-nums',
                            parsed < open.estimatedCost ? 'text-brand-600' : 'text-leaf-600',
                          )}
                        >
                          {parsed > open.estimatedCost ? '+' : ''}
                          {money(parsed - open.estimatedCost)}
                        </span>
                      </p>
                      <p className="mt-1 flex items-center justify-between gap-3">
                        <span>
                          Over a year ({openPuja ? sittingsPerYear(openPuja.defaultCadence) : '—'})
                        </span>
                        <span className="font-semibold tabular-nums">
                          {money(annualised(open, parsed))}
                        </span>
                      </p>
                      {parsed < open.estimatedCost ? (
                        <p className="mt-1.5 text-brand-600">
                          Below the costed lines. The priest will be short unless quantities come
                          down — say so in the note.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <Field label="Note" hint="Read by the administrator and the priest">
                    <Textarea
                      rows={3}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Rounded up to cover market variation on flowers."
                    />
                  </Field>
                </div>
              ) : (
                <Field
                  label="Why are you sending it back?"
                  hint="Required — this is the only thing the priest will see"
                >
                  <Textarea
                    rows={4}
                    autoFocus
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ghee at 1 litre a sitting is well above last year's usage — please recheck."
                  />
                </Field>
              )
            ) : null}

            <div>
              <h3 className="eyebrow mb-2">History</h3>
              <ApprovalTimeline history={open.history} />
            </div>
          </div>
        ) : null}
      </Sheet>
    </PageShell>
  )
}
