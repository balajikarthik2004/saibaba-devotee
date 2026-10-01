import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { TodaysArchanaList, type ArchanaRow } from '@/components/admin/TodaysArchanaList'
import { StatTile } from '@/components/shared/StatTile'
import { LoadingSkeleton } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import {
  getFamilyTree,
  getOccurrencesOn,
  listBookings,
  listDevotees,
  setOccurrenceStatus,
} from '@/lib/data/api'
import { useAsync } from '@/lib/hooks'
import { fmtDate } from '@/lib/utils'

export default function BookingsToday() {
  const { toast } = useToast()
  const [date, setDate] = useState(() => new Date())

  const { data, loading, refresh } = useAsync(
    async () => {
      const [occurrences, bookings, devotees] = await Promise.all([
        getOccurrencesOn(date),
        listBookings(),
        listDevotees(),
      ])
      // Family names are optional: only devotees who keep a family tree contribute any.
      const booked = new Set(bookings.map((b) => b.userId))
      const withTree = devotees.filter((d) => d.familyTreeId && booked.has(d.id))
      const trees = await Promise.all(withTree.map((d) => getFamilyTree(d.id)))
      const family = new Map<string, string[]>()
      withTree.forEach((d, i) => {
        const names = (trees[i]?.members ?? []).map((m) => m.name).filter(Boolean)
        if (names.length) family.set(d.id, names)
      })
      return [occurrences, bookings, devotees, family] as const
    },
    [date.toDateString()],
  )

  const shift = (days: number) => {
    const d = new Date(date)
    d.setDate(d.getDate() + days)
    setDate(d)
  }

  const complete = async (ids: string[]) => {
    await Promise.all(ids.map((id) => setOccurrenceStatus(id, 'completed')))
    toast(`${ids.length} puja${ids.length === 1 ? '' : 's'} marked completed`)
    refresh()
  }

  const skip = async (ids: string[]) => {
    await Promise.all(ids.map((id) => setOccurrenceStatus(id, 'skipped')))
    toast(`${ids.length} marked skipped`, { tone: 'warn' })
    refresh()
  }

  let rows: ArchanaRow[] = []
  if (data) {
    const [occurrences, bookings, devotees, family] = data
    const bookingById = new Map(bookings.map((b) => [b.id, b]))
    const devoteeById = new Map(devotees.map((d) => [d.id, d]))
    rows = occurrences
      .map((occurrence) => {
        const booking = bookingById.get(occurrence.bookingId)
        return {
          occurrence,
          booking,
          devotee: booking ? devoteeById.get(booking.userId) : undefined,
          family: booking ? family.get(booking.userId) : undefined,
        }
      })
      .sort((a, b) => a.occurrence.scheduledAt.localeCompare(b.occurrence.scheduledAt))
  }

  const pending = rows.filter((r) => r.occurrence.status === 'scheduled').length
  const completed = rows.filter((r) => r.occurrence.status === 'completed').length
  const skipped = rows.filter((r) => r.occurrence.status === 'skipped').length

  const isToday = date.toDateString() === new Date().toDateString()

  return (
    <PageShell
      eyebrow="Operations"
      title={isToday ? 'Today’s pujas' : 'Puja roster'}
      description={fmtDate(date, 'EEEE, MMMM d, yyyy')}
      actions={
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon" aria-label="Previous day" onClick={() => shift(-1)}>
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDate(new Date())}
            disabled={isToday}
          >
            Today
          </Button>
          <Button variant="outline" size="icon" aria-label="Next day" onClick={() => shift(1)}>
            <ChevronRight />
          </Button>
        </div>
      }
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total Scheduled" value={rows.length} sub="Sponsored occurrences" />
        <StatTile label="Still to perform" value={pending} sub="Awaiting the priest" tone="brand" />
        <StatTile label="Completed" value={completed} sub="Marked done" tone="leaf" />
        <StatTile label="Skipped" value={skipped} sub="Rescheduled or missed" tone="gold" />
      </div>

      {loading ? (
        <LoadingSkeleton variant="table" rows={6} />
      ) : (
        <TodaysArchanaList rows={rows} onComplete={complete} onSkip={skip} date={date} />
      )}
    </PageShell>
  )
}
