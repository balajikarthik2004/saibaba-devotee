import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, SquarePen, Trash2, Users } from 'lucide-react'
import type { TempleEvent } from '@/lib/data/types'
import { PageShell } from '@/components/layout/PageShell'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { BreakEvenMeter } from '@/components/shared/BreakEvenMeter'
import { StatusPill } from '@/components/shared/badges'
import { StatTile } from '@/components/shared/StatTile'
import { LoadingSkeleton } from '@/components/shared/states'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog } from '@/components/ui/overlay'
import { Chips } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/toast'
import { deleteEvent, listEvents } from '@/lib/data/api'
import { useAsync } from '@/lib/hooks'
import { fmtDate, money } from '@/lib/utils'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'ongoing', label: 'Happening now' },
  { key: 'completed', label: 'Past' },
]

export default function Events() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [filter, setFilter] = useState('all')
  const [confirmDelete, setConfirmDelete] = useState<TempleEvent | null>(null)

  const { data, loading, refresh } = useAsync(
    () => listEvents(filter === 'all' ? undefined : (filter as 'upcoming')),
    [filter],
  )

  const events = data ?? []
  const totalTarget = events.reduce((s, e) => s + e.targetAmount, 0)
  const totalCollected = events.reduce((s, e) => s + e.collectedAmount, 0)
  const totalRsvp = events.reduce((s, e) => s + e.rsvpCount, 0)

  const remove = async () => {
    if (!confirmDelete) return
    await deleteEvent(confirmDelete.id)
    toast(`${confirmDelete.title} deleted`, { tone: 'warn' })
    setConfirmDelete(null)
    refresh()
  }

  const columns: Column<TempleEvent>[] = [
    {
      key: 'title',
      header: 'Event',
      sortValue: (e) => e.title,
      cell: (e) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{e.title}</p>
          <p className="truncate font-mono text-xs text-muted">/{e.slug}</p>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      sortValue: (e) => e.date,
      cell: (e) => (
        <span className="whitespace-nowrap">
          {fmtDate(e.date, 'MMM d, yyyy')}
          {e.endDate ? (
            <span className="block text-sm text-muted">to {fmtDate(e.endDate, 'MMM d')}</span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'budget',
      header: 'Budget vs raised',
      sortValue: (e) => e.collectedAmount / (e.targetAmount || 1),
      className: 'min-w-[210px]',
      cell: (e) => (
        <BreakEvenMeter target={e.targetAmount} collected={e.collectedAmount} label="" compact />
      ),
    },
    {
      key: 'ticket',
      header: 'Ticket',
      sortValue: (e) => e.ticketPrice ?? 0,
      align: 'right',
      cell: (e) =>
        e.ticketPrice ? money(e.ticketPrice) : <span className="text-muted">Free</span>,
    },
    {
      key: 'rsvp',
      header: 'RSVPs',
      sortValue: (e) => e.rsvpCount,
      align: 'right',
      cell: (e) => <span className="tabular-nums">{e.rsvpCount}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (e) => e.status,
      cell: (e) => <StatusPill status={e.status} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (e) => (
        <div className="flex justify-end gap-1" onClick={(ev) => ev.stopPropagation()}>
          <Button
            variant="plain"
            size="icon"
            aria-label={`Edit ${e.title}`}
            onClick={() => navigate(`/events/${e.id}/edit`)}
          >
            <SquarePen />
          </Button>
          <Button
            variant="plain"
            size="icon"
            aria-label={`Delete ${e.title}`}
            onClick={() => setConfirmDelete(e)}
          >
            <Trash2 />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <PageShell
      toolbar={<Chips items={FILTERS} value={filter} onChange={setFilter} />}
      eyebrow="Programme"
      title="Events"
      description="Every festival carries a published budget — devotees see the same meter you do."
      actions={
        <Link to="/events/new" className={buttonVariants({})}>
          <Plus />
          New event
        </Link>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Events in view" value={events.length} sub="Across the temple year" />
        <StatTile
          label="Combined target"
          value={money(totalTarget)}
          sub="Festival budgets"
          tone="gold"
        />
        <StatTile
          label="Raised so far"
          value={money(totalCollected)}
          sub={`${totalTarget ? Math.round((totalCollected / totalTarget) * 100) : 0}% of target`}
          tone="leaf"
        />
        <StatTile
          label="Total RSVPs"
          value={totalRsvp}
          sub="Expected attendance"
          Icon={Users}
          tone="brand"
        />
      </div>

      {loading ? (
        <LoadingSkeleton variant="table" rows={8} />
      ) : (
        <DataTable
          rows={events}
          columns={columns}
          rowKey={(e) => e.id}
          onRowClick={(e) => navigate(`/events/${e.id}/edit`)}
          initialSort={{ key: 'date', dir: 'asc' }}
          pageSize={15}
          empty={{ title: 'No events in this view', detail: 'Try another filter or create one.' }}
        />
      )}

      <Dialog
        open={confirmDelete != null}
        onClose={() => setConfirmDelete(null)}
        title={`Delete ${confirmDelete?.title}?`}
        description="This removes it from the devotee site and the public calendar."
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Keep it
            </Button>
            <Button variant="destructive" onClick={remove}>
              <Trash2 />
              Delete event
            </Button>
          </>
        }
      >
        <p className="text-base text-muted">
          {confirmDelete?.rsvpCount} devotees have already RSVP’d. They will not be notified
          automatically.
        </p>
      </Dialog>
    </PageShell>
  )
}
