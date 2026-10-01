import { useMemo, useState } from 'react'
import { Check, X } from 'lucide-react'
import type { FacilityBooking, User } from '@/lib/data/types'
import { PageShell } from '@/components/layout/PageShell'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { StatTile } from '@/components/shared/StatTile'
import { StatusPill } from '@/components/shared/badges'
import { LoadingSkeleton } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/overlay'
import { Chips } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/toast'
import { listDevotees, listFacilityBookings, setFacilityBookingStatus } from '@/lib/data/api'
import { FACILITIES } from '@/lib/data/mock'
import { useAsync } from '@/lib/hooks'
import { fmtDate, money } from '@/lib/utils'

interface Row {
  booking: FacilityBooking
  user?: User
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'cancelled', label: 'Cancelled' },
]

export default function FacilityAdmin() {
  const { toast } = useToast()
  const [filter, setFilter] = useState('all')
  const [detail, setDetail] = useState<Row | null>(null)

  const { data, loading, refresh } = useAsync(
    async () => Promise.all([listFacilityBookings(), listDevotees()]),
    [],
  )

  const rows = useMemo<Row[]>(() => {
    if (!data) return []
    const [bookings, devotees] = data
    const byId = new Map(devotees.map((d) => [d.id, d]))
    return bookings
      .filter((b) => (filter === 'all' ? true : b.status === filter))
      .map((booking) => ({ booking, user: byId.get(booking.userId) }))
  }, [data, filter])

  const all = data?.[0] ?? []
  const revenue = all.filter((b) => b.status === 'confirmed').reduce((s, b) => s + b.total, 0)

  const act = async (id: string, status: FacilityBooking['status'], label: string) => {
    await setFacilityBookingStatus(id, status)
    toast(label)
    setDetail(null)
    refresh()
  }

  const columns: Column<Row>[] = [
    {
      key: 'date',
      header: 'Date',
      sortValue: (r) => r.booking.date,
      cell: (r) => (
        <span className="whitespace-nowrap font-medium">
          {fmtDate(r.booking.date, 'EEE, MMM d')}
        </span>
      ),
    },
    {
      key: 'facility',
      header: 'Facility',
      sortValue: (r) => r.booking.facility,
      cell: (r) =>
        FACILITIES.find((f) => f.key === r.booking.facility)?.label ?? r.booking.facility,
    },
    {
      key: 'user',
      header: 'Devotee',
      sortValue: (r) => r.user?.name ?? '',
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate">{r.user?.name ?? 'Unknown'}</p>
          <p className="truncate text-sm text-muted">{r.user?.phone}</p>
        </div>
      ),
    },
    {
      key: 'items',
      header: 'Add-ons',
      cell: (r) => (
        <span className="text-muted">
          {r.booking.items.length === 0 ? 'Room only' : `${r.booking.items.length} items`}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      sortValue: (r) => r.booking.total,
      align: 'right',
      cell: (r) => <span className="font-medium tabular-nums">{money(r.booking.total)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (r) => r.booking.status,
      cell: (r) => <StatusPill status={r.booking.status} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (r) =>
        r.booking.status === 'pending' ? (
          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => act(r.booking.id, 'confirmed', 'Booking confirmed')}
            >
              <Check />
              Confirm
            </Button>
          </div>
        ) : null,
    },
  ]

  return (
    <PageShell
      toolbar={<Chips items={FILTERS} value={filter} onChange={setFilter} />}
      eyebrow="Programme"
      title="Facility bookings"
      description="Hall, mini-hall and canteen requests from devotees."
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Requests" value={all.length} sub="All time" />
        <StatTile
          label="Awaiting confirmation"
          value={all.filter((b) => b.status === 'pending').length}
          sub="Needs an office decision"
          tone="brand"
        />
        <StatTile
          label="Confirmed"
          value={all.filter((b) => b.status === 'confirmed').length}
          sub="On the hall calendar"
          tone="leaf"
        />
        <StatTile
          label="Confirmed revenue"
          value={money(revenue)}
          sub="Booked hall income"
          tone="gold"
        />
      </div>

      {loading ? (
        <LoadingSkeleton variant="table" rows={6} />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(r) => r.booking.id}
          onRowClick={setDetail}
          initialSort={{ key: 'date', dir: 'asc' }}
          empty={{ title: 'No facility bookings', detail: 'Try another status filter.' }}
        />
      )}

      <Sheet
        open={detail != null}
        onClose={() => setDetail(null)}
        title={detail ? fmtDate(detail.booking.date, 'EEEE, MMMM d, yyyy') : ''}
        description={
          detail
            ? `${FACILITIES.find((f) => f.key === detail.booking.facility)?.label} · ${detail.user?.name}`
            : ''
        }
        footer={
          detail ? (
            <>
              <Button
                variant="outline"
                onClick={() => act(detail.booking.id, 'cancelled', 'Booking cancelled')}
              >
                <X />
                Cancel
              </Button>
              <Button
                onClick={() => act(detail.booking.id, 'confirmed', 'Booking confirmed')}
                disabled={detail.booking.status === 'confirmed'}
              >
                <Check />
                Confirm booking
              </Button>
            </>
          ) : null
        }
      >
        {detail ? (
          <div className="space-y-5">
            <dl className="divide-y divide-line text-base">
              {[
                ['Devotee', detail.user?.name ?? '—'],
                ['Phone', detail.user?.phone ?? '—'],
                ['Email', detail.user?.email ?? '—'],
                [
                  'Facility',
                  FACILITIES.find((f) => f.key === detail.booking.facility)?.label ?? '—',
                ],
                [
                  'Capacity',
                  `${FACILITIES.find((f) => f.key === detail.booking.facility)?.capacity} seats`,
                ],
                ['Status', detail.booking.status],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right font-medium capitalize">{v}</dd>
                </div>
              ))}
            </dl>

            <div>
              <p className="eyebrow mb-2">Requested add-ons</p>
              {detail.booking.items.length === 0 ? (
                <p className="text-base text-muted">Room only — no extras requested.</p>
              ) : (
                <ul className="divide-y divide-line rounded-[var(--radius-lg)] border border-line">
                  {detail.booking.items.map((it) => (
                    <li
                      key={it.label}
                      className="flex items-center justify-between gap-3 p-3 text-base"
                    >
                      <span>
                        {it.label}
                        <span className="ml-2 text-muted">× {it.qty}</span>
                      </span>
                      <span className="font-medium tabular-nums">{money(it.qty * it.price)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
              <span className="text-base font-medium">Total</span>
              <span className="font-bold text-2xl tabular-nums">{money(detail.booking.total)}</span>
            </div>
          </div>
        ) : null}
      </Sheet>
    </PageShell>
  )
}
