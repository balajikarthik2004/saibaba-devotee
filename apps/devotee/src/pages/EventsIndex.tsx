import { useState } from 'react'
import { useT } from '@saibaba/core'
import { PageHeader } from '@/components/layout/layouts'
import { EventCard } from '@/components/shared/EventCard'
import { EmptyState, LoadingSkeleton } from '@/components/shared/states'
import { Chips } from '@/components/ui/tabs'
import { listEvents } from '@/lib/data/api'
import { useAsync } from '@/lib/hooks'

export default function EventsIndex() {
  const t = useT()
  const FILTERS = [
    { key: 'upcoming', label: t('events.fUpcoming', 'Upcoming') },
    { key: 'ongoing', label: t('events.fNow', 'Happening now') },
    { key: 'completed', label: t('events.fPast', 'Past') },
    { key: 'all', label: t('events.fAll', 'All') },
  ]
  const [filter, setFilter] = useState('upcoming')
  const { data, loading } = useAsync(
    () => listEvents(filter === 'all' ? undefined : (filter as 'upcoming')),
    [filter],
  )

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader
        title={t('events.title', 'Festivals & events')}
        subtitle={t('events.subtitle', 'Every festival carries a published budget. You can see exactly what it costs and what has been raised. Dates are confirmed by your temple.')}
        actions={<Chips items={FILTERS} value={filter} onChange={setFilter} />}
      />

      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState
          title={t('events.empty', 'Nothing in this list yet')}
          detail={t('events.emptyD', 'Try another filter, or check back — your temple confirms festival dates as they approach.')}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data!.map((e) => (
            <EventCard key={e.id} event={e} showMeter />
          ))}
        </div>
      )}
    </div>
  )
}
