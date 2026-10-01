import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlayCircle } from 'lucide-react'
import { useCurrentTemple } from '@saibaba/core/tenant'
import { useT } from '@saibaba/core/i18n'
import { listRecordings } from '@saibaba/core/features/aarti'
import type { AartiKey } from '@saibaba/core/types.sai'
import { Badge, Skeleton } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Chips } from '@/components/ui/tabs'
import { useAsync } from '@/lib/hooks'

const fmtDuration = (sec: number) => {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function Recordings() {
  const t = useT()
  const temple = useCurrentTemple()
  const { data, loading } = useAsync(() => listRecordings(temple.id), [temple.id])
  const [filter, setFilter] = useState<'all' | AartiKey>('all')

  const items = useMemo(
    () => (data ?? []).filter((r) => filter === 'all' || r.slotKey === filter),
    [data, filter],
  )
  const fmt = new Intl.DateTimeFormat(temple.locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <p className="text-[12.5px] font-medium uppercase tracking-wide text-muted">{temple.name}</p>
      <h1 className="rule-saffron font-serif text-[30px] leading-tight sm:text-[36px]">
        {t('aarti.recordingsTitle', 'Aarti recordings')}
      </h1>
      <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-muted">
        {t('aarti.recordingsIntro', 'Missed an aarti? Watch a recent recording from the temple.')}
      </p>

      <Chips
        className="mt-6"
        value={filter}
        onChange={(k) => setFilter(k as 'all' | AartiKey)}
        items={[
          { key: 'all', label: t('aarti.all', 'All') },
          { key: 'kakad', label: t('aarti.kakad', 'Kakad') },
          { key: 'madhyan', label: t('aarti.madhyan', 'Madhyan') },
          { key: 'dhoop', label: t('aarti.dhoop', 'Dhoop') },
          { key: 'shej', label: t('aarti.shej', 'Shej') },
          { key: 'special', label: t('aarti.thursday', 'Thursday palki') },
        ]}
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <>
            <Skeleton className="h-36 rounded-[12px]" />
            <Skeleton className="h-36 rounded-[12px]" />
            <Skeleton className="h-36 rounded-[12px]" />
          </>
        ) : items.length === 0 ? (
          <p className="text-[14px] text-muted sm:col-span-2 lg:col-span-3">
            {t('aarti.noRecordings', 'No recordings yet.')}
          </p>
        ) : (
          items.map((r) => (
            <Card key={r.id} className="flex flex-col p-4">
              <div className="mb-3 grid aspect-video place-items-center rounded-lg bg-tint text-saffron-600">
                <PlayCircle className="size-10" aria-hidden="true" />
              </div>
              <h2 className="font-serif text-[17px] leading-snug text-ink">{r.title}</h2>
              <p className="mt-1 flex items-center gap-2 text-[12.5px] text-muted">
                {fmt.format(new Date(`${r.date}T00:00:00Z`))}
                <Badge variant="neutral">{fmtDuration(r.durationSec)}</Badge>
              </p>
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex h-9 items-center justify-center gap-1.5 self-start rounded-md border border-line bg-card px-3.5 text-[13px] font-medium text-ink hover:bg-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                aria-label={`${t('aarti.watch', 'Watch')}: ${r.title}`}
              >
                {t('aarti.watch', 'Watch')}
              </a>
            </Card>
          ))
        )}
      </div>

      <p className="mt-8 text-[14px]">
        <Link to="/darshan" className="font-medium text-brand-500 hover:text-brand-600">
          {t('aarti.backToDarshan', 'Back to live darshan')}
        </Link>
      </p>
    </div>
  )
}
