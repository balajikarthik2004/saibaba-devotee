import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink, PackageCheck, Printer, TriangleAlert } from 'lucide-react'
import {
  CARRIERS,
  COUNTRY_NAMES,
  advanceOrder,
  cancelOrder,
  isOverdue,
  listOrders,
  trackingUrl,
  type FulfilmentOrder,
} from '@saibaba/core/features/fulfilment'
import { formatMoney } from '@saibaba/core/money'
import { useT } from '@saibaba/core/i18n'
import { currentTemple } from '@saibaba/core/tenant'
import type { CountryCode, ShipmentStatus } from '@saibaba/core/types.sai'
import { PageShell } from '@/components/layout/PageShell'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { Toolbar, ToolbarSelect } from '@/components/admin/Toolbar'
import { LoadingSkeleton } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox, Field, Input, Select } from '@/components/ui/input'
import { Dialog } from '@/components/ui/overlay'
import { Tabs } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/toast'
import { useAsync, useDebounced, useTempleId } from '@/lib/hooks'
import { useAuthStore } from '@/lib/store/auth'
import { fmtDate, fmtDateTime } from '@/lib/utils'

const TABS: (ShipmentStatus | 'all')[] = ['all', 'placed', 'paid', 'packed', 'shipped', 'held-customs', 'delivered', 'cancelled']

function useLabels() {
  const t = useT()
  const L: Record<ShipmentStatus | 'all', string> = {
    all: t('shop.admin.all', 'All'),
    placed: t('shop.status.placed', 'Order placed'),
    paid: t('shop.status.paid', 'Paid'),
    packed: t('shop.status.packed', 'Packed'),
    shipped: t('shop.status.shipped', 'Shipped'),
    delivered: t('shop.status.delivered', 'Delivered'),
    'held-customs': t('shop.status.held', 'Held at customs'),
    cancelled: t('shop.status.cancelled', 'Cancelled'),
  }
  return L
}

const TONE: Record<ShipmentStatus, 'neutral' | 'gold' | 'leaf' | 'brand'> = {
  placed: 'neutral',
  paid: 'gold',
  packed: 'gold',
  shipped: 'leaf',
  delivered: 'leaf',
  'held-customs': 'brand',
  cancelled: 'neutral',
}

function Status({ s }: { s: ShipmentStatus }) {
  const L = useLabels()
  return <Badge variant={TONE[s]}>{L[s]}</Badge>
}

/** Print sheet: rendered only while printing, through the console's `.print-area` rules. */
function PrintSheet({ orders, mode, onDone }: { orders: FulfilmentOrder[]; mode: 'slips' | 'labels'; onDone: () => void }) {
  const t = useT()
  const temple = currentTemple()
  useEffect(() => {
    const h = window.setTimeout(() => window.print(), 50)
    window.addEventListener('afterprint', onDone, { once: true })
    return () => {
      window.clearTimeout(h)
      window.removeEventListener('afterprint', onDone)
    }
  }, [onDone])
  return createPortal(
    <div className="print-area bg-white text-black">
      {orders.map((o) => (
        <section key={o.id} style={{ breakAfter: 'page', padding: mode === 'labels' ? 16 : 0 }} className="mb-8">
          {mode === 'slips' ? (
            <>
              <h1 className="font-serif text-2xl">{t('shop.admin.slip', 'Packing slip')} · {o.id}</h1>
              <p className="text-sm">{temple.name} · {fmtDate(o.createdAt)}</p>
              <table className="mt-4 w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-black text-left">
                    <th className="py-1">{t('shop.admin.item', 'Item')}</th>
                    <th className="py-1 text-right">{t('shop.qty', 'Quantity')}</th>
                  </tr>
                </thead>
                <tbody>
                  {o.items.map((i) => (
                    <tr key={i.itemId} className="border-b border-gray-300">
                      <td className="py-1">☐ {i.name}</td>
                      <td className="py-1 text-right">{i.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-4 text-sm font-semibold">{t('shop.admin.shipto', 'Ship to')}</p>
            </>
          ) : (
            <p className="text-xs">{temple.name}, {temple.address}, {temple.city} {temple.zip} — {o.id}</p>
          )}
          <address className="mt-2 text-base not-italic leading-snug" style={mode === 'labels' ? { fontSize: 20 } : undefined}>
            {o.address.name}<br />
            {o.address.line1}{o.address.line2 ? `, ${o.address.line2}` : ''}<br />
            {o.address.city}, {o.address.region} {o.address.postcode}<br />
            {COUNTRY_NAMES[o.address.country]}<br />
            <span className="text-sm">{o.address.phone}</span>
          </address>
          {o.address.country !== temple.country ? (
            <p className="mt-2 text-xs">{t('shop.admin.customs', 'International parcel: attach a customs declaration (religious items / ash, no commercial value).')}</p>
          ) : null}
        </section>
      ))}
    </div>,
    document.body,
  )
}

export default function Shipping() {
  const t = useT()
  const { toast } = useToast()
  const L = useLabels()
  const templeId = useTempleId()
  const role = useAuthStore((s) => s.user?.role)
  const canEdit = role !== 'finance'

  const [tab, setTab] = useState<ShipmentStatus | 'all'>('all')
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const [country, setCountry] = useState<CountryCode | 'all'>('all')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState<FulfilmentOrder | null>(null)
  const [printing, setPrinting] = useState<null | 'slips' | 'labels'>(null)

  const { data, loading, refresh } = useAsync(() => listOrders({ templeId, status: 'all' }), [templeId])
  const all = data ?? []
  const overdueCount = all.filter((o) => isOverdue(o)).length

  const rows = useMemo(() => {
    const s = dq.trim().toLowerCase()
    return all.filter((o) => {
      if (tab !== 'all' && o.status !== tab) return false
      if (country !== 'all' && o.address.country !== country) return false
      if (overdueOnly && !isOverdue(o)) return false
      if (s && !`${o.id} ${o.address.name} ${o.contactEmail ?? ''} ${o.tracking ?? ''}`.toLowerCase().includes(s)) return false
      return true
    })
  }, [all, tab, country, overdueOnly, dq])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length }
    for (const o of all) c[o.status] = (c[o.status] ?? 0) + 1
    return c
  }, [all])

  const selected = rows.filter((r) => sel.has(r.id))
  const toggle = (id: string) =>
    setSel((p) => {
      const n = new Set(p)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const bulkPack = async () => {
    const targets = selected.filter((o) => o.status === 'paid')
    await Promise.all(targets.map((o) => advanceOrder(o.id, 'packed')))
    toast(t('shop.admin.packed', '{n} orders marked packed', { n: targets.length }))
    setSel(new Set())
    refresh()
  }

  const cols: Column<FulfilmentOrder>[] = [
    ...(canEdit
      ? [
          {
            key: 'sel',
            header: '',
            cell: (o: FulfilmentOrder) => (
              <span onClick={(e) => e.stopPropagation()}>
                <Checkbox checked={sel.has(o.id)} onChange={() => toggle(o.id)} aria-label={t('shop.admin.select', 'Select order {id}', { id: o.id })} />
              </span>
            ),
          },
        ]
      : []),
    { key: 'id', header: t('shop.admin.order', 'Order'), sortValue: (o) => o.id, cell: (o) => <span className="font-medium">{o.id}</span> },
    { key: 'date', header: t('shop.admin.date', 'Placed'), sortValue: (o) => o.createdAt, cell: (o) => fmtDate(o.createdAt) },
    {
      key: 'who',
      header: t('shop.admin.customer', 'Customer'),
      sortValue: (o) => o.address.name,
      cell: (o) => (
        <div>
          <div>{o.address.name}</div>
          <div className="text-xs text-muted">{o.address.city}, {COUNTRY_NAMES[o.address.country]}</div>
        </div>
      ),
    },
    { key: 'items', header: t('shop.admin.items', 'Items'), cell: (o) => o.items.reduce((a, i) => a + i.qty, 0) },
    { key: 'total', header: t('shop.total', 'Total'), align: 'right', sortValue: (o) => o.total, cell: (o) => formatMoney(o.total, o.currency) },
    {
      key: 'status',
      header: t('shop.admin.status', 'Status'),
      sortValue: (o) => o.status,
      cell: (o) => (
        <span className="inline-flex flex-wrap items-center gap-1">
          <Status s={o.status} />
          {isOverdue(o) ? <Badge variant="brand"><TriangleAlert className="size-3" aria-hidden />{t('shop.admin.overdue', 'Overdue')}</Badge> : null}
        </span>
      ),
    },
    { key: 'track', header: t('shop.admin.tracking', 'Tracking'), cell: (o) => o.tracking ? `${o.carrier ?? ''} ${o.tracking}`.trim() : '—' },
  ]

  return (
    <PageShell
      title={t('shop.admin.title', 'Shipping')}
      eyebrow={t('shop.admin.group', 'Fulfilment')}
      description={
        <>
          {t('shop.admin.count', '{n} orders', { n: all.length })}
          {!canEdit ? ` · ${t('shop.admin.readonly', 'read-only')}` : ''}
        </>
      }
      actions={
        canEdit ? (
          <>
            <Button variant="outline" disabled={selected.length === 0} onClick={() => setPrinting('slips')}>
              <Printer />{t('shop.admin.slips', 'Packing slips')}
            </Button>
            <Button variant="outline" disabled={selected.length === 0} onClick={() => setPrinting('labels')}>
              <Printer />{t('shop.admin.labels', 'Labels')}
            </Button>
            <Button disabled={!selected.some((o) => o.status === 'paid')} onClick={bulkPack}>
              <PackageCheck />{t('shop.admin.markpacked', 'Mark packed')}
            </Button>
          </>
        ) : undefined
      }
      tabs={
        <Tabs
          value={tab}
          onChange={(k) => setTab(k as ShipmentStatus | 'all')}
          items={TABS.map((k) => ({ key: k, label: L[k], count: counts[k] ?? 0 }))}
        />
      }
      toolbar={
        <Toolbar search={q} onSearch={setQ} searchPlaceholder={t('shop.admin.search', 'Search order, name, tracking')}>
          <ToolbarSelect aria-label={t('shop.country', 'Country')} value={country} onChange={(e) => setCountry(e.target.value as CountryCode | 'all')}>
            <option value="all">{t('shop.admin.allcountries', 'All countries')}</option>
            {(Object.keys(COUNTRY_NAMES) as CountryCode[]).map((c) => <option key={c} value={c}>{COUNTRY_NAMES[c]}</option>)}
          </ToolbarSelect>
          <button
            type="button"
            aria-pressed={overdueOnly}
            onClick={() => setOverdueOnly((v) => !v)}
            className={
              'inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-semibold ' +
              (overdueOnly ? 'border-brand-500 bg-brand-500 text-white' : 'border-line bg-card text-ink-soft')
            }
          >
            <TriangleAlert className="size-3.5" aria-hidden />
            {t('shop.admin.overduechip', 'Overdue ({n})', { n: overdueCount })}
          </button>
        </Toolbar>
      }
    >
      {loading ? (
        <LoadingSkeleton variant="table" rows={6} />
      ) : (
        <DataTable
          rows={rows}
          columns={cols}
          rowKey={(o) => o.id}
          onRowClick={setOpen}
          initialSort={{ key: 'date', dir: 'desc' }}
          empty={{ title: t('shop.admin.none', 'No orders match') }}
        />
      )}

      {open ? (
        <OrderDialog
          key={open.id}
          order={open}
          canEdit={canEdit}
          onClose={() => setOpen(null)}
          onChanged={() => {
            setOpen(null)
            refresh()
          }}
        />
      ) : null}
      {printing ? <PrintSheet orders={selected} mode={printing} onDone={() => setPrinting(null)} /> : null}
    </PageShell>
  )
}

function OrderDialog({ order, canEdit, onClose, onChanged }: { order: FulfilmentOrder; canEdit: boolean; onClose: () => void; onChanged: () => void }) {
  const t = useT()
  const { toast } = useToast()
  const L = useLabels()
  const [carrier, setCarrier] = useState(order.carrier ?? defaultCarrier(order.address.country, order))
  const [tracking, setTracking] = useState(order.tracking ?? '')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const url = trackingUrl(order.carrier, order.tracking)

  const go = async (s: ShipmentStatus) => {
    setBusy(true)
    setErr('')
    try {
      await advanceOrder(order.id, s, { carrier, tracking: tracking.trim() || undefined, note: note.trim() || undefined })
      toast(t('shop.admin.updated', 'Order {id} → {status}', { id: order.id, status: L[s] }))
      onChanged()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }
  const cancel = async () => {
    setBusy(true)
    setErr('')
    try {
      await cancelOrder(order.id, note.trim() || undefined)
      onChanged()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed')
      setBusy(false)
    }
  }
  const closed = order.status === 'cancelled' || order.status === 'delivered'

  return (
    <Dialog open onClose={onClose} title={`${order.id} · ${order.address.name}`} description={<Status s={order.status} />} className="max-w-2xl">
      <div className="space-y-4 text-sm">
        <ul>
          {order.items.map((i) => (
            <li key={i.itemId} className="flex justify-between"><span>{i.name} × {i.qty}</span><span>{formatMoney(i.unitPrice * i.qty, order.currency)}</span></li>
          ))}
          <li className="flex justify-between text-muted"><span>{t('shop.shipping', 'Shipping')}</span><span>{formatMoney(order.shippingFee, order.currency)}</span></li>
          <li className="flex justify-between border-t border-line pt-1 font-semibold"><span>{t('shop.total', 'Total')}</span><span>{formatMoney(order.total, order.currency)}</span></li>
        </ul>
        <address className="not-italic text-muted">
          {order.address.line1}{order.address.line2 ? `, ${order.address.line2}` : ''}, {order.address.city}, {order.address.region} {order.address.postcode}, {COUNTRY_NAMES[order.address.country]} · {order.address.phone}
          {order.contactEmail ? ` · ${order.contactEmail}` : ''}
        </address>
        {order.holdNote ? <p role="note" className="rounded-md border border-brand-500/30 bg-brand-500/5 p-2">{order.holdNote}</p> : null}
        {url ? (
          <a href={url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 font-medium text-brand-600">
            {order.carrier} {order.tracking} <ExternalLink className="size-3.5" aria-hidden />
          </a>
        ) : null}
        <ol className="space-y-1 border-l border-line pl-3">
          {order.events.map((e, i) => (
            <li key={i}><span className="font-medium">{L[e.status]}</span> <span className="text-muted">· {fmtDateTime(e.at)}{e.note ? ` · ${e.note}` : ''}</span></li>
          ))}
        </ol>

        {canEdit && !closed ? (
          <div className="space-y-3 border-t border-line pt-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('shop.admin.carrier', 'Carrier')} htmlFor="car">
                <Select id="car" value={carrier} onChange={(e) => setCarrier(e.target.value)}>
                  {CARRIERS.map((c) => <option key={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label={t('shop.admin.trackno', 'Tracking number')} htmlFor="trk">
                <Input id="trk" value={tracking} onChange={(e) => setTracking(e.target.value)} />
              </Field>
            </div>
            <Field label={t('shop.admin.note', 'Note (shown to the devotee)')} htmlFor="note">
              <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            {err ? <p role="alert" className="text-xs font-medium text-brand-600">{err}</p> : null}
            <div className="flex flex-wrap gap-2">
              {order.status === 'placed' ? <Button disabled={busy} onClick={() => go('paid')}>{t('shop.admin.markpaid', 'Mark paid')}</Button> : null}
              {order.status === 'paid' ? <Button disabled={busy} onClick={() => go('packed')}>{t('shop.admin.markpacked', 'Mark packed')}</Button> : null}
              {(order.status === 'paid' || order.status === 'packed' || order.status === 'held-customs') ? <Button disabled={busy} onClick={() => go('shipped')}>{t('shop.admin.markshipped', 'Mark shipped')}</Button> : null}
              {order.status === 'shipped' || order.status === 'held-customs' ? <Button variant="leaf" disabled={busy} onClick={() => go('delivered')}>{t('shop.admin.markdelivered', 'Mark delivered')}</Button> : null}
              {order.status === 'shipped' ? <Button variant="outline" disabled={busy} onClick={() => go('held-customs')}>{t('shop.admin.hold', 'Held at customs')}</Button> : null}
              {['placed', 'paid', 'packed'].includes(order.status) ? <Button variant="destructive" disabled={busy} onClick={cancel}>{t('shop.admin.cancel', 'Cancel order')}</Button> : null}
            </div>
          </div>
        ) : null}
      </div>
    </Dialog>
  )
}

function defaultCarrier(country: CountryCode, order: FulfilmentOrder): string {
  const origin = currentTemple().country
  void order
  if (country !== origin) return 'DHL'
  return { US: 'USPS', IN: 'India Post', GB: 'Royal Mail', CA: 'Canada Post' }[country]
}
