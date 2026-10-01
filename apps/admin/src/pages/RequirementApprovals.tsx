import { useMemo, useState } from 'react'
import { Ban, BadgeCheck, Clock, History, Wallet } from 'lucide-react'
import type { PujaCatalogItem, PujaRequirementSheet } from '@/lib/data/types'
import { PageShell } from '@/components/layout/PageShell'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { ApprovalTimeline } from '@/components/admin/ApprovalTimeline'
import { StatTile } from '@/components/shared/StatTile'
import { LoadingSkeleton } from '@/components/shared/states'
import { StageBadge } from '@/components/shared/StockBadges'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, Textarea } from '@/components/ui/input'
import { Sheet } from '@/components/ui/overlay'
import { Table, TBody, TD, TH, THead, TR, TableWrap } from '@/components/ui/table'
import { Chips } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/toast'
import {
  approveRequirementSheet,
  getPujaCatalog,
  listRequirementSheets,
  rejectRequirementSheet,
} from '@/lib/data/api'
import { OCCURRENCES_PER_YEAR } from '@/lib/data/mock'
import { useAuthStore } from '@/lib/store/auth'
import { useAsync } from '@/lib/hooks'
import { fmtDate, money } from '@/lib/utils'

/**
 * The administrator's sign-off — the last gate before a sheet governs the store.
 *
 * The thing this screen has to make obvious, and the reason it is not just a list with
 * two buttons, is *what approving actually does*. It does two things at once: it puts
 * this sheet in force, and it stands the current one down. So when a sheet under review
 * is a revision, the incumbent version is shown beside it with its lines diffed — an
 * administrator approving v2 without seeing that v3 of the ghee quantity tripled is an
 * approval that means nothing.
 */

type Filter = 'queue' | 'in-force' | 'all'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'queue', label: 'Awaiting sign-off' },
  { key: 'in-force', label: 'In force' },
  { key: 'all', label: 'Everything' },
]

/** Per-item change between the sheet under review and the one it would replace. */
interface DiffRow {
  label: string
  unit: string
  from?: number
  to?: number
}

function diffLines(next: PujaRequirementSheet, prev?: PujaRequirementSheet): DiffRow[] {
  const rows = new Map<string, DiffRow>()
  for (const l of prev?.lines ?? []) {
    rows.set(l.itemId, { label: l.label, unit: l.unit, from: l.qty })
  }
  for (const l of next.lines) {
    const existing = rows.get(l.itemId)
    if (existing) existing.to = l.qty
    else rows.set(l.itemId, { label: l.label, unit: l.unit, to: l.qty })
  }
  return [...rows.values()].sort((a, b) => a.label.localeCompare(b.label))
}

export default function RequirementApprovals() {
  const { toast } = useToast()
  const actor = useAuthStore((s) => s.user)!

  const [filter, setFilter] = useState<Filter>('queue')
  const [openId, setOpenId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [mode, setMode] = useState<'approve' | 'reject'>('approve')
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

  const queue = all.filter((s) => s.stage === 'admin-review')
  const inForce = all.filter((s) => s.stage === 'approved')
  const rows = filter === 'queue' ? queue : filter === 'in-force' ? inForce : all

  const open = all.find((s) => s.id === openId) ?? null
  const openPuja = open ? pujaById.get(open.pujaCatalogId) : undefined
  /** The sheet this one would replace, if any. */
  const incumbent = open
    ? all.find(
        (s) => s.pujaCatalogId === open.pujaCatalogId && s.stage === 'approved' && s.id !== open.id,
      )
    : undefined

  const annualCommitment = inForce.reduce((sum, s) => {
    const puja = pujaById.get(s.pujaCatalogId)
    return sum + (s.allocatedAmount ?? s.estimatedCost) * (puja ? OCCURRENCES_PER_YEAR[puja.defaultCadence] : 0)
  }, 0)

  const openSheet = (s: PujaRequirementSheet) => {
    setOpenId(s.id)
    setNote('')
    setMode('approve')
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
        const replaces = all.find(
          (x) => x.pujaCatalogId === s.pujaCatalogId && x.stage === 'approved' && x.id !== s.id,
        )
        return (
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">
              {puja?.name ?? s.pujaCatalogId}
              {replaces && s.stage === 'admin-review' ? (
                <Badge variant="gold" className="ml-2">
                  Replaces v{replaces.version}
                </Badge>
              ) : null}
            </p>
            <p className="truncate text-xs text-muted">
              v{s.version} · {s.lines.length} items · {s.preparedByName}
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
      key: 'allocated',
      header: 'Allocated',
      align: 'right',
      sortValue: (s) => s.allocatedAmount ?? 0,
      cell: (s) => (
        <div className="text-right">
          <p className="font-semibold tabular-nums text-ink">
            {money(s.allocatedAmount ?? s.estimatedCost)}
          </p>
          <p className="text-2xs text-muted">estimate {money(s.estimatedCost)}</p>
        </div>
      ),
    },
    {
      key: 'annual',
      header: 'Per year',
      align: 'right',
      sortValue: (s) => {
        const puja = pujaById.get(s.pujaCatalogId)
        return (s.allocatedAmount ?? s.estimatedCost) * (puja ? OCCURRENCES_PER_YEAR[puja.defaultCadence] : 0)
      },
      cell: (s) => {
        const puja = pujaById.get(s.pujaCatalogId)
        return (
          <span className="tabular-nums text-ink-soft">
            {money(
              (s.allocatedAmount ?? s.estimatedCost) *
                (puja ? OCCURRENCES_PER_YEAR[puja.defaultCadence] : 0),
            )}
          </span>
        )
      },
    },
    {
      key: 'updated',
      header: 'Costed',
      sortValue: (s) => s.updatedAt,
      cell: (s) => (
        <span className="whitespace-nowrap text-xs text-muted">{fmtDate(s.updatedAt)}</span>
      ),
    },
  ]

  const diff = open ? diffLines(open, incumbent) : []
  const changed = diff.filter((d) => d.from !== d.to).length

  return (
    <PageShell
      eyebrow="Stores"
      title="Requirement approvals"
      description="Sign off what each puja may draw from the store, and what it costs to do so."
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
              label="Awaiting sign-off"
              value={queue.length}
              tone={queue.length > 0 ? 'brand' : 'leaf'}
              Icon={Clock}
              sub="Costed by accounts"
            />
            <StatTile
              label="Sheets in force"
              value={inForce.length}
              tone="leaf"
              Icon={BadgeCheck}
              sub="One per puja"
            />
            <StatTile
              label="Committed per year"
              value={money(annualCommitment)}
              tone="gold"
              Icon={Wallet}
              sub="Allocations × each puja's cadence"
            />
          </div>

          <div className="mt-5">
            <DataTable
              rows={rows}
              columns={columns}
              rowKey={(s) => s.id}
              onRowClick={openSheet}
              initialSort={{ key: 'updated', dir: 'asc' }}
              empty={{
                title: 'Nothing to sign off',
                detail: 'Sheets arrive here once the accounts desk has allocated a budget.',
              }}
            />
          </div>
        </>
      )}

      <Sheet
        open={Boolean(open)}
        onClose={() => setOpenId(null)}
        title={openPuja?.name ?? 'Requirement sheet'}
        description={open ? `Version ${open.version} · prepared by ${open.preparedByName}` : undefined}
        footer={
          open?.stage === 'admin-review' ? (
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="plain"
                onClick={() => setMode(mode === 'reject' ? 'approve' : 'reject')}
              >
                <Ban />
                {mode === 'reject' ? 'Back to approving' : 'Reject'}
              </Button>
              {mode === 'reject' ? (
                <Button
                  variant="destructive"
                  disabled={busy || !note.trim()}
                  onClick={() =>
                    run(
                      () => rejectRequirementSheet(open.id, actor, note),
                      'Sheet rejected',
                      'warn',
                    )
                  }
                >
                  Reject with this reason
                </Button>
              ) : (
                <Button
                  variant="leaf"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => approveRequirementSheet(open.id, actor, note),
                      incumbent
                        ? `Approved — v${incumbent.version} superseded`
                        : 'Approved and in force',
                    )
                  }
                >
                  <BadgeCheck />
                  Approve
                </Button>
              )}
            </div>
          ) : null
        }
      >
        {open ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StageBadge stage={open.stage} />
              {incumbent ? (
                <Badge variant="gold">
                  <History className="size-3" />
                  Would replace v{incumbent.version}
                </Badge>
              ) : (
                <Badge variant="neutral">First sheet for this puja</Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[var(--radius)] border border-hairline bg-faint/50 px-3 py-2.5">
                <p className="eyebrow">Costed estimate</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-ink">
                  {money(open.estimatedCost)}
                </p>
              </div>
              <div className="rounded-[var(--radius)] border border-leaf-500/25 bg-leaf-500/[0.07] px-3 py-2.5">
                <p className="eyebrow">Allocated by accounts</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-leaf-600">
                  {money(open.allocatedAmount ?? open.estimatedCost)}
                </p>
              </div>
            </div>

            {open.allocationNote ? (
              <p className="rounded-[8px] border border-line bg-faint/60 px-3 py-2 text-xs leading-relaxed text-ink-soft">
                <span className="font-semibold text-ink">Accounts: </span>
                {open.allocationNote}
              </p>
            ) : null}

            <div>
              <h3 className="eyebrow mb-2">
                {incumbent
                  ? `What changes — ${changed} line${changed === 1 ? '' : 's'}`
                  : 'What this puja may draw'}
              </h3>
              <TableWrap>
                <Table>
                  <THead>
                    <TR>
                      <TH>Item</TH>
                      {incumbent ? <TH className="w-20 text-right">v{incumbent.version}</TH> : null}
                      <TH className="w-20 text-right">v{open.version}</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {diff.map((d) => {
                      const isChange = d.from !== d.to
                      return (
                        <TR key={d.label}>
                          <TD>
                            <span className={isChange ? 'font-medium text-ink' : 'text-ink-soft'}>
                              {d.label}
                            </span>
                            {incumbent && d.from === undefined ? (
                              <Badge variant="leaf" className="ml-2">
                                New
                              </Badge>
                            ) : null}
                            {incumbent && d.to === undefined ? (
                              <Badge variant="brand" className="ml-2">
                                Dropped
                              </Badge>
                            ) : null}
                          </TD>
                          {incumbent ? (
                            <TD className="text-right tabular-nums text-muted">
                              {d.from === undefined ? '—' : `${d.from} ${d.unit}`}
                            </TD>
                          ) : null}
                          <TD
                            className={
                              isChange && incumbent
                                ? 'text-right font-semibold tabular-nums text-brand-600'
                                : 'text-right tabular-nums text-ink-soft'
                            }
                          >
                            {d.to === undefined ? '—' : `${d.to} ${d.unit}`}
                          </TD>
                        </TR>
                      )
                    })}
                  </TBody>
                </Table>
              </TableWrap>
            </div>

            {open.stage === 'admin-review' ? (
              mode === 'reject' ? (
                <Field
                  label="Why are you rejecting it?"
                  hint="Required — the priest revises from this"
                >
                  <Textarea
                    rows={4}
                    autoFocus
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="The silk vastram belongs to the festival budget, not the weekly sheet."
                  />
                </Field>
              ) : (
                <Field label="Note" hint="Optional — recorded on the sheet's history">
                  <Textarea
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Approved for the coming year."
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
