import { useEffect, useState } from 'react'
import { EyeOff, Plus, SquarePen, Trash2 } from 'lucide-react'
import type { Cadence, PujaCatalogItem, PujaType } from '@/lib/data/types'
import { PageShell } from '@/components/layout/PageShell'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { PujaCard } from '@/components/shared/PujaCard'
import { LoadingSkeleton } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, Sheet } from '@/components/ui/overlay'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { deletePujaCatalogItem, getPujaCatalog, savePujaCatalogItem } from '@/lib/data/api'
import { currentTemple } from '@saibaba/core'
import { STANDARD_ADDONS } from '@/lib/data/mock'
import { useAsync } from '@/lib/hooks'
import { money, titleCase } from '@/lib/utils'

const TYPES: PujaType[] = ['yearly', 'monthly', 'one-time', 'abhishekam', 'alangaram']
const CADENCES: Cadence[] = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'one-time']

const blank = (): PujaCatalogItem => ({
  id: `puja_${Date.now()}`,
  name: '',
  deity: currentTemple().deities[0] ?? 'Sai Baba',
  type: 'monthly',
  basePrice: 250,
  durationMin: 60,
  defaultCadence: 'monthly',
  recurringRule: '',
  description: '',
  addOns: STANDARD_ADDONS,
  active: true,
})

export default function Catalog() {
  const { toast } = useToast()
  const { data, loading, refresh } = useAsync(() => getPujaCatalog(), [])
  const [editing, setEditing] = useState<PujaCatalogItem | null>(null)
  const [draft, setDraft] = useState<PujaCatalogItem>(blank())
  const [confirmDelete, setConfirmDelete] = useState<PujaCatalogItem | null>(null)

  useEffect(() => {
    if (editing) setDraft(editing)
  }, [editing])

  const items = data ?? []

  const openNew = () => {
    const fresh = blank()
    setDraft(fresh)
    setEditing(fresh)
  }

  const save = async () => {
    if (!draft.name.trim()) return
    await savePujaCatalogItem(draft)
    setEditing(null)
    toast('Catalogue saved', { detail: `${draft.name} is live on the devotee site.` })
    refresh()
  }

  const toggleActive = async (item: PujaCatalogItem) => {
    await savePujaCatalogItem({ ...item, active: !item.active })
    toast(item.active ? `${item.name} deactivated` : `${item.name} reactivated`, {
      tone: item.active ? 'warn' : 'success',
    })
    refresh()
  }

  const remove = async () => {
    if (!confirmDelete) return
    await deletePujaCatalogItem(confirmDelete.id)
    toast(`${confirmDelete.name} removed from the catalogue`, { tone: 'warn' })
    setConfirmDelete(null)
    refresh()
  }

  const columns: Column<PujaCatalogItem>[] = [
    {
      key: 'name',
      header: 'Puja',
      sortValue: (p) => p.name,
      cell: (p) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{p.name}</p>
          <p className="truncate text-sm text-muted">{p.recurringRule}</p>
        </div>
      ),
    },
    { key: 'deity', header: 'Deity', sortValue: (p) => p.deity, cell: (p) => p.deity },
    {
      key: 'type',
      header: 'Type',
      sortValue: (p) => p.type,
      cell: (p) => <Badge variant="gold">{titleCase(p.type)}</Badge>,
    },
    {
      key: 'price',
      header: 'Price',
      sortValue: (p) => p.basePrice,
      align: 'right',
      cell: (p) => <span className="tabular-nums">{money(p.basePrice)}</span>,
    },
    {
      key: 'duration',
      header: 'Duration',
      sortValue: (p) => p.durationMin,
      align: 'right',
      cell: (p) => <span className="tabular-nums text-muted">{p.durationMin} min</span>,
    },
    {
      key: 'active',
      header: 'Status',
      sortValue: (p) => (p.active === false ? 'inactive' : 'active'),
      cell: (p) =>
        p.active === false ? (
          <Badge variant="neutral">Hidden</Badge>
        ) : (
          <Badge variant="leaf">Live</Badge>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (p) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="plain"
            size="icon"
            aria-label={`Edit ${p.name}`}
            onClick={() => setEditing(p)}
          >
            <SquarePen />
          </Button>
          <Button
            variant="plain"
            size="icon"
            aria-label={`Toggle ${p.name}`}
            onClick={() => toggleActive(p)}
          >
            <EyeOff />
          </Button>
          <Button
            variant="plain"
            size="icon"
            aria-label={`Delete ${p.name}`}
            onClick={() => setConfirmDelete(p)}
          >
            <Trash2 />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <PageShell
      eyebrow="Operations"
      title="Puja catalogue"
      description={`${items.length} pujas offered · ${items.filter((p) => p.active !== false).length} live on the devotee site`}
      actions={
        <Button onClick={openNew}>
          <Plus />
          New puja
        </Button>
      }
    >
      {loading ? (
        <LoadingSkeleton variant="table" rows={8} />
      ) : (
        <DataTable
          rows={items}
          columns={columns}
          rowKey={(p) => p.id}
          onRowClick={setEditing}
          initialSort={{ key: 'price', dir: 'desc' }}
          pageSize={20}
          empty={{ title: 'The catalogue is empty', detail: 'Add the first puja to get started.' }}
        />
      )}

      <Sheet
        open={editing != null}
        onClose={() => setEditing(null)}
        title={items.some((p) => p.id === draft.id) ? 'Edit puja' : 'New puja'}
        description="Changes appear on the devotee site immediately."
        className="max-w-2xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!draft.name.trim()}>
              Save puja
            </Button>
          </>
        }
      >
        <div className="grid gap-5 lg:grid-cols-[1fr_236px] lg:items-start">
          <div className="grid gap-4">
            <Field label="Name" htmlFor="pc-name">
              <Input
                id="pc-name"
                value={draft.name}
                autoFocus
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. Murugar Puja"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Deity" htmlFor="pc-deity">
                <Select
                  id="pc-deity"
                  value={draft.deity}
                  onChange={(e) => setDraft({ ...draft, deity: e.target.value })}
                >
                  {currentTemple().deities.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Type" htmlFor="pc-type">
                <Select
                  id="pc-type"
                  value={draft.type}
                  onChange={(e) => setDraft({ ...draft, type: e.target.value as PujaType })}
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {titleCase(t)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label={`Price (${currentTemple().currency})`} htmlFor="pc-price">
                <Input
                  id="pc-price"
                  type="number"
                  min={0}
                  value={draft.basePrice}
                  onChange={(e) => setDraft({ ...draft, basePrice: Number(e.target.value) || 0 })}
                />
              </Field>
              <Field label="Duration (min)" htmlFor="pc-dur">
                <Input
                  id="pc-dur"
                  type="number"
                  min={0}
                  value={draft.durationMin}
                  onChange={(e) => setDraft({ ...draft, durationMin: Number(e.target.value) || 0 })}
                />
              </Field>
              <Field label="Cadence" htmlFor="pc-cad">
                <Select
                  id="pc-cad"
                  value={draft.defaultCadence}
                  onChange={(e) =>
                    setDraft({ ...draft, defaultCadence: e.target.value as Cadence })
                  }
                >
                  {CADENCES.map((c) => (
                    <option key={c} value={c}>
                      {titleCase(c)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Recurring rule" htmlFor="pc-rule" hint="shown to devotees">
              <Input
                id="pc-rule"
                value={draft.recurringRule ?? ''}
                onChange={(e) => setDraft({ ...draft, recurringRule: e.target.value })}
                placeholder="Every 3rd Thursday"
              />
            </Field>

            <Field label="Description" htmlFor="pc-desc">
              <Textarea
                id="pc-desc"
                rows={5}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="What the priest performs, and what the sponsor receives."
              />
            </Field>
          </div>

          <div className="lg:sticky lg:top-0">
            <p className="eyebrow mb-2">Devotee preview</p>
            <PujaCard puja={draft} to="#" />
            <p className="mt-2 text-sm leading-relaxed text-muted">
              This is exactly how the card renders in the devotee catalogue.
            </p>
          </div>
        </div>
      </Sheet>

      <Dialog
        open={confirmDelete != null}
        onClose={() => setConfirmDelete(null)}
        title={`Delete ${confirmDelete?.name}?`}
        description="Existing bookings keep their history, but the puja can no longer be sponsored."
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Keep it
            </Button>
            <Button variant="destructive" onClick={remove}>
              <Trash2 />
              Delete permanently
            </Button>
          </>
        }
      >
        <p className="text-base text-muted">
          Consider deactivating instead — that hides it from the devotee catalogue while keeping the
          record intact for the P&amp;L.
        </p>
      </Dialog>
    </PageShell>
  )
}
