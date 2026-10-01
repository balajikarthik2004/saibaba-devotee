import { useMemo, useState } from 'react'
import { Boxes, PackagePlus, Plus, Scale, Trash2, TriangleAlert, Wallet } from 'lucide-react'
import type { StockItem, StockMovement } from '@/lib/data/types'
import { PageShell } from '@/components/layout/PageShell'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { Toolbar, ToolbarSelect } from '@/components/admin/Toolbar'
import { StatTile } from '@/components/shared/StatTile'
import { LoadingSkeleton } from '@/components/shared/states'
import {
  MovementBadge,
  StockLevelBadge,
  StockMeter,
  stockLevelOf,
} from '@/components/shared/StockBadges'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { Dialog, Sheet } from '@/components/ui/overlay'
import { Tabs } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/toast'
import {
  adjustStock,
  getStoresStats,
  listStockItems,
  listStockMovements,
  receiveStock,
  retireStockItem,
  saveStockItem,
} from '@/lib/data/api'
import { PUJA_BY_ID, STOCK_CATEGORY_LABELS, STOCK_UNITS } from '@/lib/data/mock'
import { useAuthStore } from '@/lib/store/auth'
import { useAsync, useDebounced } from '@/lib/hooks'
import { fmtDateTime, money } from '@/lib/utils'

/**
 * The temple store.
 *
 * Two tabs, because there are two genuinely different questions: "what do we have?" and
 * "where did it go?". The first is a state, the second is a history, and a single table
 * trying to be both ends up a list of items with a mysterious "last changed" column that
 * answers neither.
 *
 * Nothing on this screen sets a balance directly. Receiving, counting and wastage all go
 * through the ledger in `api.ts`, so the number in the first tab is always the sum of
 * what the second tab says happened. That constraint is why the edit form below has no
 * "on hand" field once an item exists — it would be a second writer, and the two would
 * eventually disagree in a way nobody could unpick.
 */

const CATEGORIES = Object.entries(STOCK_CATEGORY_LABELS) as [StockItem['category'], string][]

const blank = (): StockItem => ({
  id: '',
  name: '',
  category: 'flowers',
  unit: 'pc',
  onHand: 0,
  reorderLevel: 5,
  unitCost: 1,
  storage: '',
  perishable: false,
  active: true,
  updatedAt: new Date().toISOString(),
})

/** What the movement dialog is being used for. Three verbs, one form. */
type MoveMode = 'receive' | 'count' | 'wastage'

const MOVE_COPY: Record<MoveMode, { title: string; label: string; hint: string; cta: string }> = {
  receive: {
    title: 'Receive stock',
    label: 'Quantity received',
    hint: 'Added to what is already on the shelf.',
    cta: 'Record receipt',
  },
  count: {
    title: 'Record a stock count',
    label: 'Counted quantity',
    hint: 'The figure you actually counted — not the difference.',
    cta: 'Record count',
  },
  wastage: {
    title: 'Record wastage',
    label: 'Quantity discarded',
    hint: 'Spoiled or unusable stock. Subtracted from the shelf.',
    cta: 'Record wastage',
  },
}

export default function Inventory() {
  const { toast } = useToast()
  const actor = useAuthStore((s) => s.user)!

  const [tab, setTab] = useState<'items' | 'ledger'>('items')
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search)
  const [category, setCategory] = useState<StockItem['category'] | 'all'>('all')
  const [lowOnly, setLowOnly] = useState(false)
  const [kind, setKind] = useState<StockMovement['kind'] | 'all'>('all')

  const { data, loading, refresh } = useAsync(
    async () =>
      Promise.all([
        listStockItems(),
        listStockMovements({ limit: 400 }),
        getStoresStats(),
      ]),
    [],
  )

  const [all, movements, stats] = useMemo(() => {
    if (!data) return [[] as StockItem[], [] as StockMovement[], null] as const
    return data
  }, [data])

  const itemById = useMemo(() => new Map(all.map((i) => [i.id, i])), [all])

  const rows = useMemo(() => {
    const q = debounced.trim().toLowerCase()
    return all.filter((i) => {
      if (q && !i.name.toLowerCase().includes(q)) return false
      if (category !== 'all' && i.category !== category) return false
      if (lowOnly && stockLevelOf(i) === 'ok') return false
      return true
    })
  }, [all, debounced, category, lowOnly])

  const ledger = useMemo(() => {
    const q = debounced.trim().toLowerCase()
    return movements.filter((m) => {
      if (kind !== 'all' && m.kind !== kind) return false
      if (q && !(itemById.get(m.itemId)?.name.toLowerCase().includes(q) ?? false)) return false
      return true
    })
  }, [movements, kind, debounced, itemById])

  /* ------------------------------------------------------------ the forms */

  const [editing, setEditing] = useState<StockItem | null>(null)
  const [draft, setDraft] = useState<StockItem>(blank())
  const [confirmRetire, setConfirmRetire] = useState<StockItem | null>(null)

  const [moving, setMoving] = useState<{ item: StockItem; mode: MoveMode } | null>(null)
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const openNew = () => {
    setDraft(blank())
    setEditing(blank())
  }

  const openEdit = (item: StockItem) => {
    setDraft(item)
    setEditing(item)
  }

  const openMove = (item: StockItem, mode: MoveMode) => {
    setMoving({ item, mode })
    // The count form opens pre-filled with the book figure, so the common case —
    // "yes, that is what I counted" — is one keystroke rather than a lookup.
    setQty(mode === 'count' ? String(item.onHand) : '')
    setNote('')
  }

  const saveItem = async () => {
    if (!draft.name.trim()) return
    setBusy(true)
    await saveStockItem(draft)
    setBusy(false)
    setEditing(null)
    toast(draft.id ? 'Item updated' : 'Item added to the store')
    refresh()
  }

  const commitMove = async () => {
    if (!moving) return
    const n = Number(qty)
    if (!Number.isFinite(n) || n < 0) return

    setBusy(true)
    if (moving.mode === 'receive') await receiveStock(moving.item.id, n, actor, note)
    else if (moving.mode === 'count') await adjustStock(moving.item.id, n, actor, note, 'adjusted')
    else await adjustStock(moving.item.id, n, actor, note, 'wastage')
    setBusy(false)

    toast(`${MOVE_COPY[moving.mode].title} recorded`, {
      detail: `${moving.item.name} — the ledger has been updated.`,
      tone: moving.mode === 'wastage' ? 'warn' : undefined,
    })
    setMoving(null)
    refresh()
  }

  const retire = async () => {
    if (!confirmRetire) return
    await retireStockItem(confirmRetire.id)
    toast(`${confirmRetire.name} retired`, {
      detail: 'Its ledger history is kept.',
      tone: 'warn',
    })
    setConfirmRetire(null)
    refresh()
  }

  /* ------------------------------------------------------------- columns */

  const itemColumns: Column<StockItem>[] = [
    {
      key: 'name',
      header: 'Item',
      sortValue: (i) => i.name,
      cell: (i) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{i.name}</p>
          <p className="truncate text-xs text-muted">
            {STOCK_CATEGORY_LABELS[i.category]}
            {i.storage ? ` · ${i.storage}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'level',
      header: 'On hand',
      sortValue: (i) => i.onHand - i.reorderLevel,
      cell: (i) => <StockMeter item={i} className="w-40" />,
      className: 'w-48',
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (i) => stockLevelOf(i),
      cell: (i) => <StockLevelBadge item={i} />,
    },
    {
      key: 'value',
      header: 'Value',
      align: 'right',
      sortValue: (i) => i.onHand * i.unitCost,
      cell: (i) => (
        <div className="text-right">
          <p className="font-semibold tabular-nums text-ink">{money(i.onHand * i.unitCost)}</p>
          <p className="text-xs text-muted">
            {money(i.unitCost)}/{i.unit}
          </p>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (i) => (
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => openMove(i, 'receive')}>
            <PackagePlus />
            Receive
          </Button>
          <Button size="sm" variant="outline" onClick={() => openMove(i, 'count')}>
            <Scale />
            Count
          </Button>
          <Button size="sm" variant="plain" onClick={() => openEdit(i)}>
            Edit
          </Button>
        </div>
      ),
    },
  ]

  const ledgerColumns: Column<StockMovement>[] = [
    {
      key: 'at',
      header: 'When',
      sortValue: (m) => m.at,
      cell: (m) => <span className="whitespace-nowrap text-xs text-muted">{fmtDateTime(m.at)}</span>,
    },
    {
      key: 'item',
      header: 'Item',
      sortValue: (m) => itemById.get(m.itemId)?.name ?? '',
      cell: (m) => (
        <span className="font-medium text-ink">{itemById.get(m.itemId)?.name ?? m.itemId}</span>
      ),
    },
    { key: 'kind', header: 'Movement', sortValue: (m) => m.kind, cell: (m) => <MovementBadge kind={m.kind} /> },
    {
      key: 'qty',
      header: 'Change',
      align: 'right',
      sortValue: (m) => m.qty,
      cell: (m) => (
        <span
          className={
            m.qty >= 0
              ? 'font-semibold tabular-nums text-leaf-600'
              : 'font-semibold tabular-nums text-brand-600'
          }
        >
          {m.qty > 0 ? '+' : ''}
          {m.qty} {itemById.get(m.itemId)?.unit ?? ''}
        </span>
      ),
    },
    {
      key: 'balance',
      header: 'Balance',
      align: 'right',
      sortValue: (m) => m.balance,
      cell: (m) => <span className="tabular-nums text-ink-soft">{m.balance}</span>,
    },
    {
      key: 'why',
      header: 'Reason',
      cell: (m) => (
        <div className="min-w-0 max-w-[280px]">
          <p className="truncate text-xs text-ink-soft">{m.note ?? '—'}</p>
          <p className="truncate text-2xs text-muted">
            {m.actorName}
            {m.pujaCatalogId ? ` · ${PUJA_BY_ID.get(m.pujaCatalogId)?.name ?? ''}` : ''}
          </p>
        </div>
      ),
    },
  ]

  /* ---------------------------------------------------------------- render */

  const tabs = (
    <Tabs
      items={[
        { key: 'items', label: 'Stock on hand', count: all.length },
        { key: 'ledger', label: 'Movement ledger', count: movements.length },
      ]}
      value={tab}
      onChange={(k) => setTab(k as 'items' | 'ledger')}
    />
  )

  const toolbar = (
    <Toolbar
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Search items"
      activeCount={(category !== 'all' ? 1 : 0) + (lowOnly ? 1 : 0) + (kind !== 'all' ? 1 : 0)}
      onClear={() => {
        setSearch('')
        setCategory('all')
        setLowOnly(false)
        setKind('all')
      }}
    >
      {tab === 'items' ? (
        <>
          <ToolbarSelect
            value={category}
            onChange={(e) => setCategory(e.target.value as StockItem['category'] | 'all')}
            aria-label="Category"
          >
            <option value="all">All categories</option>
            {CATEGORIES.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </ToolbarSelect>
          <Button
            size="sm"
            variant={lowOnly ? 'saffron' : 'outline'}
            onClick={() => setLowOnly((v) => !v)}
          >
            <TriangleAlert />
            Needs reordering
          </Button>
        </>
      ) : (
        <ToolbarSelect
          value={kind}
          onChange={(e) => setKind(e.target.value as StockMovement['kind'] | 'all')}
          aria-label="Movement type"
        >
          <option value="all">All movements</option>
          <option value="received">Received</option>
          <option value="issued">Issued</option>
          <option value="adjusted">Adjusted</option>
          <option value="wastage">Wastage</option>
        </ToolbarSelect>
      )}
    </Toolbar>
  )

  return (
    <PageShell
      eyebrow="Stores"
      title="Inventory"
      description={
        stats
          ? `${stats.itemsTracked} items tracked · ${money(stats.stockValue)} on the shelf`
          : 'The temple store, item by item'
      }
      tabs={tabs}
      toolbar={toolbar}
      actions={
        <Button onClick={openNew}>
          <Plus />
          New item
        </Button>
      }
    >
      {loading || !stats ? (
        <LoadingSkeleton variant="tiles" rows={4} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Items tracked" value={stats.itemsTracked} Icon={Boxes} />
            <StatTile
              label="Needs reordering"
              value={stats.lowStock}
              tone={stats.lowStock > 0 ? 'brand' : 'leaf'}
              Icon={TriangleAlert}
              sub="At or below the reorder level"
            />
            <StatTile
              label="Value on the shelf"
              value={money(stats.stockValue)}
              tone="gold"
              Icon={Wallet}
              sub="On hand × unit cost"
            />
            <StatTile
              label="Pujas without a sheet"
              value={stats.pujasWithoutSheet}
              tone={stats.pujasWithoutSheet > 0 ? 'gold' : 'leaf'}
              Icon={PackagePlus}
              sub="No approved requirements on file"
            />
          </div>

          <div className="mt-5">
            {tab === 'items' ? (
              <DataTable
                rows={rows}
                columns={itemColumns}
                rowKey={(i) => i.id}
                initialSort={{ key: 'status', dir: 'asc' }}
                empty={{
                  title: 'Nothing matches',
                  detail: 'Try a different category, or clear the filters.',
                }}
              />
            ) : (
              <DataTable
                rows={ledger}
                columns={ledgerColumns}
                rowKey={(m) => m.id}
                initialSort={{ key: 'at', dir: 'desc' }}
                empty={{
                  title: 'No movements',
                  detail: 'Receiving stock or confirming a puja will write the first entry.',
                }}
              />
            )}
          </div>
        </>
      )}

      {/* ------------------------------------------------------ item editor */}
      <Sheet
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={draft.id ? draft.name : 'New stock item'}
        description={
          draft.id
            ? 'Quantities are changed through the ledger, not here.'
            : 'An opening count is recorded as the first ledger entry.'
        }
        footer={
          <div className="flex items-center justify-between gap-2">
            {draft.id ? (
              <Button
                variant="plain"
                onClick={() => {
                  setConfirmRetire(draft)
                  setEditing(null)
                }}
              >
                <Trash2 />
                Retire
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button onClick={saveItem} disabled={busy || !draft.name.trim()}>
                Save item
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Name">
            <Input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="Rose garland"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <Select
                value={draft.category}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, category: e.target.value as StockItem['category'] }))
                }
              >
                {CATEGORIES.map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Unit" hint="How the store counts it">
              <Select
                value={draft.unit}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, unit: e.target.value as StockItem['unit'] }))
                }
              >
                {STOCK_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Reorder level" hint="Below this it shows as low">
              <Input
                type="number"
                min={0}
                value={draft.reorderLevel}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, reorderLevel: Number(e.target.value) || 0 }))
                }
              />
            </Field>
            <Field label={`Cost per ${draft.unit}`} hint="Prices every requirement line">
              <Input
                type="number"
                min={0}
                value={draft.unitCost}
                onChange={(e) => setDraft((d) => ({ ...d, unitCost: Number(e.target.value) || 0 }))}
              />
            </Field>
          </div>

          {draft.id ? null : (
            <Field label="Opening count" hint="Recorded as the first ledger entry">
              <Input
                type="number"
                min={0}
                value={draft.onHand}
                onChange={(e) => setDraft((d) => ({ ...d, onHand: Number(e.target.value) || 0 }))}
              />
            </Field>
          )}

          <Field label="Where it is kept">
            <Input
              value={draft.storage ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, storage: e.target.value }))}
              placeholder="Cold room, rack A"
            />
          </Field>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-[var(--radius)] border border-line bg-faint/50 p-3">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-[var(--brand-500)]"
              checked={draft.perishable}
              onChange={(e) => setDraft((d) => ({ ...d, perishable: e.target.checked }))}
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink">Perishable</span>
              <span className="block text-xs text-muted">
                Cannot be stocked ahead, so a shortfall is more urgent.
              </span>
            </span>
          </label>
        </div>
      </Sheet>

      {/* ------------------------------------------------- movement dialog */}
      <Dialog
        open={Boolean(moving)}
        onClose={() => setMoving(null)}
        title={moving ? `${MOVE_COPY[moving.mode].title} — ${moving.item.name}` : ''}
        description={
          moving
            ? `${moving.item.onHand} ${moving.item.unit} on hand right now.`
            : undefined
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setMoving(null)}>
              Cancel
            </Button>
            <Button
              variant={moving?.mode === 'wastage' ? 'destructive' : 'default'}
              onClick={commitMove}
              disabled={busy || qty.trim() === '' || Number(qty) < 0}
            >
              {moving ? MOVE_COPY[moving.mode].cta : ''}
            </Button>
          </div>
        }
      >
        {moving ? (
          <div className="space-y-4">
            <Field
              label={`${MOVE_COPY[moving.mode].label} (${moving.item.unit})`}
              hint={MOVE_COPY[moving.mode].hint}
            >
              <Input
                type="number"
                min={0}
                autoFocus
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </Field>
            <Field
              label="Note"
              hint={moving.mode === 'receive' ? 'Invoice or supplier reference' : 'Optional'}
            >
              <Textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  moving.mode === 'receive'
                    ? 'Inv. 4417 — Local Flower Mart'
                    : moving.mode === 'wastage'
                      ? 'Wilted, not usable'
                      : 'Shelf count, Saturday morning'
                }
              />
            </Field>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={Boolean(confirmRetire)}
        onClose={() => setConfirmRetire(null)}
        title={`Retire ${confirmRetire?.name ?? ''}?`}
        description="It leaves the store list and every requirement picker. Its ledger history is kept."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmRetire(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={retire}>
              Retire item
            </Button>
          </div>
        }
      >
        <p className="text-sm text-ink-soft">
          Approved requirement sheets that name this item keep their line — the label and the
          cost were frozen onto the sheet when it was approved.
        </p>
      </Dialog>
    </PageShell>
  )
}
