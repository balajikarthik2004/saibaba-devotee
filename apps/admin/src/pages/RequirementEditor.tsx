import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, Save, Send, Trash2, TriangleAlert } from 'lucide-react'
import type { PujaCatalogItem, RequirementLine, StockItem } from '@/lib/data/types'
import { PageShell } from '@/components/layout/PageShell'
import { ApprovalTimeline } from '@/components/admin/ApprovalTimeline'
import { EmptyState, LoadingSkeleton } from '@/components/shared/states'
import { StageBadge, StockLevelBadge, sittingsPerYear } from '@/components/shared/StockBadges'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { Table, TBody, TD, TH, THead, TR, TableWrap } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import {
  getPujaCatalog,
  getRequirementSheet,
  listStockItems,
  saveRequirementLines,
  submitRequirementSheet,
} from '@/lib/data/api'
import { useAuthStore } from '@/lib/store/auth'
import { useAsync } from '@/lib/hooks'
import { money } from '@/lib/utils'

/**
 * Where the priest writes the list.
 *
 * The editable state is local and saved explicitly. An autosaving line editor was the
 * first instinct and the wrong one here: this sheet is a costed document that a finance
 * desk allocates against, and a half-typed quantity of "1" on its way to "12" briefly
 * being the saved truth is not a state anything downstream should ever be able to read.
 *
 * Everything after `draft` is read-only. The screen still renders — the priest, the
 * accounts desk and the administrator all need to *see* the sheet — but the controls
 * are gone rather than disabled, because a form full of inert inputs invites somebody to
 * keep clicking at it looking for the one that works.
 */

/** A line being edited. `qty` stays a string so the field can be empty mid-typing. */
interface DraftLine {
  itemId: string
  qty: string
  optional: boolean
  note: string
}

const toDraft = (l: RequirementLine): DraftLine => ({
  itemId: l.itemId,
  qty: String(l.qty),
  optional: Boolean(l.optional),
  note: l.note ?? '',
})

export default function RequirementEditor() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const actor = useAuthStore((s) => s.user)!

  const { data, loading, refresh } = useAsync(
    async () => Promise.all([getRequirementSheet(id), listStockItems(), getPujaCatalog()]),
    [id],
  )

  const [sheet, items, catalog] = useMemo(() => {
    if (!data) return [null, [] as StockItem[], [] as PujaCatalogItem[]] as const
    return data
  }, [data])

  const puja = useMemo(
    () => catalog.find((p) => p.id === sheet?.pujaCatalogId),
    [catalog, sheet],
  )
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])

  const [lines, setLines] = useState<DraftLine[]>([])
  const [dirty, setDirty] = useState(false)
  const [addId, setAddId] = useState('')
  const [submitNote, setSubmitNote] = useState('')
  const [busy, setBusy] = useState(false)

  // Reloading the sheet replaces the local copy. Merging would be the wrong call: the
  // only thing that reloads it is a save or a submit, both of which mean the server
  // copy is now the authority.
  useEffect(() => {
    if (sheet) {
      setLines(sheet.lines.map(toDraft))
      setDirty(false)
    }
  }, [sheet])

  const editable = sheet?.stage === 'draft' || sheet?.stage === 'rejected'

  const materialise = (): RequirementLine[] =>
    lines.flatMap((l) => {
      const item = itemById.get(l.itemId)
      const qty = Number(l.qty)
      if (!item || !Number.isFinite(qty) || qty <= 0) return []
      return [
        {
          itemId: item.id,
          label: item.name,
          unit: item.unit,
          qty,
          unitCost: item.unitCost,
          optional: l.optional || undefined,
          note: l.note.trim() || undefined,
        },
      ]
    })

  const estimate = materialise().reduce((sum, l) => sum + l.qty * l.unitCost, 0)

  /** Lines that would be dropped on save — a typo the priest should see before it vanishes. */
  const incomplete = lines.filter((l) => {
    const qty = Number(l.qty)
    return !l.itemId || !Number.isFinite(qty) || qty <= 0
  }).length

  const addLine = () => {
    if (!addId || lines.some((l) => l.itemId === addId)) return
    setLines((ls) => [...ls, { itemId: addId, qty: '1', optional: false, note: '' }])
    setAddId('')
    setDirty(true)
  }

  const patch = (i: number, p: Partial<DraftLine>) => {
    setLines((ls) => ls.map((l, n) => (n === i ? { ...l, ...p } : l)))
    setDirty(true)
  }

  const remove = (i: number) => {
    setLines((ls) => ls.filter((_, n) => n !== i))
    setDirty(true)
  }

  const save = async () => {
    if (!sheet) return
    setBusy(true)
    await saveRequirementLines(sheet.id, materialise())
    setBusy(false)
    toast('Requirements saved', { detail: `Estimated at ${money(estimate)} per performance.` })
    refresh()
  }

  const submit = async () => {
    if (!sheet) return
    setBusy(true)
    try {
      // Saving first is not a convenience — submitting what is on screen rather than
      // what was last saved is the only behaviour that cannot surprise anybody.
      await saveRequirementLines(sheet.id, materialise())
      await submitRequirementSheet(sheet.id, actor, submitNote)
      toast('Sent to the accounts desk', {
        detail: 'They will allocate a budget before it reaches the administrator.',
      })
      navigate('/requirements')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not submit', { tone: 'warn' })
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <PageShell eyebrow="Stores" title="Requirement sheet" back={{ to: '/requirements', label: 'All sheets' }}>
        <LoadingSkeleton variant="tiles" rows={4} />
      </PageShell>
    )
  }

  if (!sheet) {
    return (
      <PageShell eyebrow="Stores" title="Requirement sheet" back={{ to: '/requirements', label: 'All sheets' }}>
        <EmptyState title="No such sheet" detail="It may have been superseded by a later version." />
      </PageShell>
    )
  }

  const unusedItems = items.filter((i) => !lines.some((l) => l.itemId === i.id))

  return (
    <PageShell
      eyebrow="Stores"
      back={{ to: '/requirements', label: 'All sheets' }}
      title={puja?.name ?? 'Requirement sheet'}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <StageBadge stage={sheet.stage} />
          <span className="text-muted">
            Version {sheet.version} · prepared by {sheet.preparedByName}
          </span>
        </span>
      }
      actions={
        editable ? (
          <>
            <Button variant="outline" onClick={save} disabled={busy || !dirty}>
              <Save />
              Save draft
            </Button>
            <Button onClick={submit} disabled={busy || materialise().length === 0}>
              <Send />
              Submit to accounts
            </Button>
          </>
        ) : null
      }
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Requirements, per performance</CardTitle>
              <CardDescription>
                Quantities for one sitting of this puja. The store checks against these before
                every occurrence.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {lines.length === 0 ? (
                <EmptyState
                  title="Nothing on the list yet"
                  detail={
                    editable
                      ? 'Add the flowers, dravyam and provisions this puja consumes.'
                      : 'This sheet was submitted without any lines.'
                  }
                />
              ) : (
                <TableWrap>
                  <Table>
                    <THead>
                      <TR>
                        <TH>Item</TH>
                        <TH className="w-28">Quantity</TH>
                        <TH className="w-24 text-right">Line cost</TH>
                        <TH className="w-32">In store</TH>
                        {editable ? <TH className="w-10" /> : null}
                      </TR>
                    </THead>
                    <TBody>
                      {lines.map((l, i) => {
                        const item = itemById.get(l.itemId)
                        const qty = Number(l.qty)
                        const valid = item && Number.isFinite(qty) && qty > 0
                        return (
                          <TR key={l.itemId || i}>
                            <TD>
                              <div className="min-w-0">
                                <p className="truncate font-medium text-ink">
                                  {item?.name ?? 'Item no longer in the store'}
                                  {l.optional ? (
                                    <Badge variant="neutral" className="ml-2">
                                      Optional
                                    </Badge>
                                  ) : null}
                                </p>
                                {editable ? (
                                  <div className="mt-1.5 flex flex-wrap items-center gap-3">
                                    <label className="flex cursor-pointer items-center gap-1.5 text-2xs text-muted">
                                      <input
                                        type="checkbox"
                                        className="size-3.5 accent-[var(--brand-500)]"
                                        checked={l.optional}
                                        onChange={(e) => patch(i, { optional: e.target.checked })}
                                      />
                                      Optional — never blocks a puja
                                    </label>
                                    <Input
                                      value={l.note}
                                      onChange={(e) => patch(i, { note: e.target.value })}
                                      placeholder="Note (e.g. white only)"
                                      className="h-7 max-w-[220px] text-xs"
                                    />
                                  </div>
                                ) : l.note ? (
                                  <p className="text-xs text-muted">{l.note}</p>
                                ) : null}
                              </div>
                            </TD>
                            <TD>
                              {editable ? (
                                <div className="flex items-center gap-1.5">
                                  <Input
                                    type="number"
                                    min={0}
                                    value={l.qty}
                                    onChange={(e) => patch(i, { qty: e.target.value })}
                                    className="h-8 w-20"
                                  />
                                  <span className="text-xs text-muted">{item?.unit}</span>
                                </div>
                              ) : (
                                <span className="tabular-nums text-ink-soft">
                                  {l.qty} {item?.unit}
                                </span>
                              )}
                            </TD>
                            <TD className="text-right tabular-nums text-ink-soft">
                              {valid ? money(qty * item.unitCost) : '—'}
                            </TD>
                            <TD>{item ? <StockLevelBadge item={item} /> : null}</TD>
                            {editable ? (
                              <TD>
                                <Button
                                  size="icon-sm"
                                  variant="plain"
                                  aria-label={`Remove ${item?.name ?? 'line'}`}
                                  onClick={() => remove(i)}
                                >
                                  <Trash2 />
                                </Button>
                              </TD>
                            ) : null}
                          </TR>
                        )
                      })}
                    </TBody>
                  </Table>
                </TableWrap>
              )}

              {editable ? (
                <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-hairline pt-4">
                  <Field label="Add an item" className="min-w-[240px] flex-1">
                    <Select value={addId} onChange={(e) => setAddId(e.target.value)}>
                      <option value="">Choose from the store…</option>
                      {unusedItems.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({i.unit}) — {money(i.unitCost)}/{i.unit}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Button variant="ghost" onClick={addLine} disabled={!addId}>
                    <Plus />
                    Add line
                  </Button>
                </div>
              ) : null}

              {incomplete > 0 ? (
                <p className="mt-3 flex items-start gap-2 rounded-[8px] border border-saffron-500/30 bg-saffron-500/[0.08] px-3 py-2 text-xs text-saffron-700">
                  <TriangleAlert className="mt-px size-3.5 shrink-0" />
                  {incomplete} line{incomplete === 1 ? '' : 's'} without a quantity will be dropped
                  when this is saved.
                </p>
              ) : null}
            </CardContent>
          </Card>

          {editable ? (
            <Card>
              <CardHeader>
                <CardTitle>Note for the accounts desk</CardTitle>
                <CardDescription>
                  Anything they need to know before putting a figure against this — a festival
                  month, a price that has moved.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  rows={3}
                  value={submitNote}
                  onChange={(e) => setSubmitNote(e.target.value)}
                  placeholder="Flower prices are up ahead of Navaratri; the estimate reflects last week’s market."
                />
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* ------------------------------------------------------ the rail */}
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Costing</CardTitle>
              <CardDescription>Priced at what the store pays today.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-muted">Estimated, per performance</span>
                <span className="stat-figure text-xl">{money(estimate)}</span>
              </div>

              {sheet.allocatedAmount === undefined ? (
                <p className="text-xs text-muted">
                  Accounts have not allocated a budget yet.
                </p>
              ) : (
                <>
                  <div className="flex items-baseline justify-between gap-3 border-t border-hairline pt-3">
                    <span className="text-sm text-muted">Allocated by accounts</span>
                    <span className="text-lg font-bold tabular-nums text-leaf-600">
                      {money(sheet.allocatedAmount)}
                    </span>
                  </div>
                  {sheet.allocationNote ? (
                    <p className="rounded-[8px] border border-line bg-faint/60 px-2.5 py-1.5 text-xs leading-relaxed text-ink-soft">
                      {sheet.allocationNote}
                    </p>
                  ) : null}
                </>
              )}

              {puja ? (
                <p className="border-t border-hairline pt-3 text-2xs leading-relaxed text-muted">
                  {puja.name} is performed {sittingsPerYear(puja.defaultCadence)}. The figure
                  above is for one sitting — the annual cost follows from the cadence, not from
                  this sheet.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
              <CardDescription>Who moved it, when, and why.</CardDescription>
            </CardHeader>
            <CardContent>
              <ApprovalTimeline history={sheet.history} />
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  )
}
