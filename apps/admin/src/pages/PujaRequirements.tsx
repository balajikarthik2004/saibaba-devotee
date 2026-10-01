import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, FilePlus2, Layers, TriangleAlert } from 'lucide-react'
import type { PujaCatalogItem, PujaRequirementSheet, RequirementStage } from '@/lib/data/types'
import { PageShell } from '@/components/layout/PageShell'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { Toolbar, ToolbarSelect } from '@/components/admin/Toolbar'
import { StatTile } from '@/components/shared/StatTile'
import { LoadingSkeleton } from '@/components/shared/states'
import { StageBadge } from '@/components/shared/StockBadges'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/overlay'
import { Select } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import {
  getPujaCatalog,
  getStoresStats,
  listRequirementSheets,
  startRequirementSheet,
} from '@/lib/data/api'
import { useAuthStore } from '@/lib/store/auth'
import { useAsync, useDebounced } from '@/lib/hooks'
import { fmtDate, money } from '@/lib/utils'

/**
 * Every requirement sheet in the temple, at whatever stage it has reached.
 *
 * The list is of *sheets*, not of pujas, and the difference matters: a puja can have an
 * approved v1 in force and a v2 draft being written at the same time, and folding them
 * into one row per puja would hide exactly the state a priest most needs to see. The
 * "Pujas with nothing on file" tile covers the other direction — a catalogue entry that
 * has never had a sheet at all is invisible in a list of sheets, and it is the gap that
 * actually stops a puja on the morning.
 */

const FILTERS: { key: RequirementStage | 'all'; label: string }[] = [
  { key: 'all', label: 'Every stage' },
  { key: 'draft', label: 'Drafts' },
  { key: 'finance-review', label: 'With accounts' },
  { key: 'admin-review', label: 'With the administrator' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'superseded', label: 'Superseded' },
]

export default function PujaRequirements() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const actor = useAuthStore((s) => s.user)!

  const [stage, setStage] = useState<RequirementStage | 'all'>('all')
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search)
  const [starting, setStarting] = useState(false)
  const [pickPuja, setPickPuja] = useState('')
  const [busy, setBusy] = useState(false)

  const { data, loading } = useAsync(
    async () => Promise.all([listRequirementSheets('all'), getPujaCatalog(), getStoresStats()]),
    [],
  )

  const [sheets, catalog, stats] = useMemo(() => {
    if (!data) return [[] as PujaRequirementSheet[], [] as PujaCatalogItem[], null] as const
    return data
  }, [data])

  const pujaById = useMemo(() => new Map(catalog.map((p) => [p.id, p])), [catalog])

  const rows = useMemo(() => {
    const q = debounced.trim().toLowerCase()
    return sheets.filter((s) => {
      if (stage !== 'all' && s.stage !== stage) return false
      if (q && !(pujaById.get(s.pujaCatalogId)?.name.toLowerCase().includes(q) ?? false))
        return false
      return true
    })
  }, [sheets, stage, debounced, pujaById])

  /** Catalogue entries with no sheet in force — the list the "start" dialog offers first. */
  const uncovered = useMemo(
    () =>
      catalog.filter(
        (p) =>
          p.active !== false &&
          !sheets.some((s) => s.pujaCatalogId === p.id && s.stage === 'approved'),
      ),
    [catalog, sheets],
  )

  const start = async () => {
    if (!pickPuja) return
    setBusy(true)
    const sheet = await startRequirementSheet(pickPuja, actor)
    setBusy(false)
    setStarting(false)
    setPickPuja('')
    // Reopening an existing draft is the common case and reads as a surprise if the
    // app says "created" — so the toast reports which it was.
    toast(sheet.lines.length > 0 ? 'Opened the sheet already in progress' : 'Sheet started', {
      detail: pujaById.get(pickPuja)?.name,
    })
    navigate(`/requirements/${sheet.id}`)
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
              {puja?.deity} · v{s.version} · {s.lines.length} item
              {s.lines.length === 1 ? '' : 's'}
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
      header: 'Estimated',
      align: 'right',
      sortValue: (s) => s.estimatedCost,
      cell: (s) => <span className="tabular-nums text-ink-soft">{money(s.estimatedCost)}</span>,
    },
    {
      key: 'allocated',
      header: 'Allocated',
      align: 'right',
      sortValue: (s) => s.allocatedAmount ?? -1,
      cell: (s) =>
        s.allocatedAmount === undefined ? (
          <span className="text-xs text-faint">Not yet</span>
        ) : (
          <div className="text-right">
            <p className="font-semibold tabular-nums text-ink">{money(s.allocatedAmount)}</p>
            {s.allocatedAmount !== s.estimatedCost ? (
              <p className="text-2xs text-muted">
                {s.allocatedAmount > s.estimatedCost ? '+' : ''}
                {money(s.allocatedAmount - s.estimatedCost)} vs estimate
              </p>
            ) : null}
          </div>
        ),
    },
    {
      key: 'updated',
      header: 'Last moved',
      sortValue: (s) => s.updatedAt,
      cell: (s) => (
        <div className="min-w-0">
          <p className="whitespace-nowrap text-xs text-ink-soft">{fmtDate(s.updatedAt)}</p>
          <p className="truncate text-2xs text-muted">
            {s.history[s.history.length - 1]?.actorName ?? s.preparedByName}
          </p>
        </div>
      ),
    },
  ]

  const toolbar = (
    <Toolbar
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Search by puja"
      activeCount={stage !== 'all' ? 1 : 0}
      onClear={() => {
        setSearch('')
        setStage('all')
      }}
    >
      <ToolbarSelect
        value={stage}
        onChange={(e) => setStage(e.target.value as RequirementStage | 'all')}
        aria-label="Stage"
      >
        {FILTERS.map((f) => (
          <option key={f.key} value={f.key}>
            {f.label}
          </option>
        ))}
      </ToolbarSelect>
    </Toolbar>
  )

  return (
    <PageShell
      eyebrow="Stores"
      title="Puja requirements"
      description="What each puja needs, per performance — flowers, dravyam and provisions."
      toolbar={toolbar}
      actions={
        <Button onClick={() => setStarting(true)}>
          <FilePlus2 />
          Start a sheet
        </Button>
      }
    >
      {loading || !stats ? (
        <LoadingSkeleton variant="tiles" rows={4} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Approved &amp; in force"
              value={stats.approvedSheets}
              tone="leaf"
              Icon={ClipboardList}
              sub="One per puja"
            />
            <StatTile
              label="With accounts"
              value={stats.awaitingFinance}
              tone={stats.awaitingFinance > 0 ? 'gold' : 'default'}
              Icon={Layers}
              sub="Awaiting a budget allocation"
            />
            <StatTile
              label="With the administrator"
              value={stats.awaitingAdmin}
              tone={stats.awaitingAdmin > 0 ? 'gold' : 'default'}
              Icon={Layers}
              sub="Costed, awaiting sign-off"
            />
            <StatTile
              label="Pujas with nothing on file"
              value={stats.pujasWithoutSheet}
              tone={stats.pujasWithoutSheet > 0 ? 'brand' : 'leaf'}
              Icon={TriangleAlert}
              sub="No approved sheet at all"
            />
          </div>

          <div className="mt-5">
            <DataTable
              rows={rows}
              columns={columns}
              rowKey={(s) => s.id}
              onRowClick={(s) => navigate(`/requirements/${s.id}`)}
              initialSort={{ key: 'updated', dir: 'desc' }}
              empty={{
                title: 'No sheets at this stage',
                detail: 'Start one from a puja in the catalogue.',
              }}
            />
          </div>
        </>
      )}

      <Dialog
        open={starting}
        onClose={() => setStarting(false)}
        title="Start a requirement sheet"
        description="Pick the puja. A sheet already in progress is reopened rather than duplicated."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStarting(false)}>
              Cancel
            </Button>
            <Button onClick={start} disabled={busy || !pickPuja}>
              Open the sheet
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Select value={pickPuja} onChange={(e) => setPickPuja(e.target.value)}>
            <option value="">Choose a puja…</option>
            {uncovered.length > 0 ? (
              <optgroup label="No approved sheet yet">
                {uncovered.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
            <optgroup label="Revise an approved sheet">
              {catalog
                .filter((p) => !uncovered.some((u) => u.id === p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </optgroup>
          </Select>

          {pickPuja && !uncovered.some((u) => u.id === pickPuja) ? (
            <p className="rounded-[8px] border border-line bg-faint/60 px-3 py-2 text-xs leading-relaxed text-ink-soft">
              <Badge variant="gold" className="mr-1.5">
                Revision
              </Badge>
              This puja already has an approved sheet. The new one opens as a copy of it and only
              replaces it once the administrator signs it off.
            </p>
          ) : null}
        </div>
      </Dialog>
    </PageShell>
  )
}
