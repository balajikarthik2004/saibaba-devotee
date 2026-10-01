import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, Locate, MapPin, Search, SearchX } from 'lucide-react'
import { useT, useTempleStore } from '@saibaba/core'
import type { CountryCode, Temple } from '@saibaba/core'
import { listTemples } from '@saibaba/core/features/tenancy'
import { PageHeader } from '@/components/layout/layouts'
import { EmptyState, LoadingSkeleton } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Chips } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { osmLink } from './osm'

type Row = Temple & { distanceKm?: number }

const COUNTRIES: { key: 'all' | CountryCode; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'US', label: 'US' },
  { key: 'IN', label: 'India' },
  { key: 'GB', label: 'UK' },
  { key: 'CA', label: 'Canada' },
]

export default function TemplesFinder() {
  const t = useT()
  const selectedId = useTempleStore((s) => s.templeId)
  const [q, setQ] = useState('')
  const [country, setCountry] = useState<'all' | CountryCode>('all')
  const [near, setNear] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[] | null>(null)

  useEffect(() => {
    let live = true
    setRows(null)
    const id = setTimeout(() => {
      listTemples({
        q,
        country: country === 'all' ? undefined : country,
        near: near ?? undefined,
      }).then((r) => live && setRows(r))
    }, 150)
    return () => {
      live = false
      clearTimeout(id)
    }
  }, [q, country, near])

  const useMyLocation = () => {
    setLocError(null)
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setLocError(t('temples.noGeo', 'Your browser cannot share a location. Search by city or pick a country instead.'))
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNear({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
      },
      () => {
        setLocating(false)
        setLocError(
          t('temples.geoDenied', 'We could not get your location. You can still search by city or pick a country.'),
        )
      },
      { timeout: 8000, maximumAge: 600000 },
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader
        title={t('temples.title', 'Find a Sai temple')}
        subtitle={t(
          'temples.subtitle',
          'Every temple on Shree Saibaba keeps its own schedule, currency and giving. Choose the one closest to your heart.',
        )}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('temples.search', 'Search by name, city or postcode')}
            aria-label={t('temples.searchAria', 'Search temples')}
            className="pl-9"
          />
        </div>
        <Button variant="outline" onClick={useMyLocation} disabled={locating}>
          <Locate />
          {locating
            ? t('temples.locating', 'Finding you…')
            : near
              ? t('temples.located', 'Sorted by distance')
              : t('temples.useLocation', 'Use my location')}
        </Button>
        {near ? (
          <Button variant="plain" size="sm" onClick={() => setNear(null)}>
            {t('temples.clearLocation', 'Clear location')}
          </Button>
        ) : null}
      </div>

      <Chips
        className="mb-5"
        items={COUNTRIES.map((c) => ({ key: c.key, label: t(`temples.c.${c.key}`, c.label) }))}
        value={country}
        onChange={(k) => setCountry(k as 'all' | CountryCode)}
      />

      {locError ? (
        <p role="status" className="mb-4 rounded-[10px] border border-line bg-tint/60 p-3 text-[13px] text-muted">
          {locError}
        </p>
      ) : null}

      {rows === null ? (
        <LoadingSkeleton rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          Icon={SearchX}
          title={t('temples.empty', 'No temples match that search')}
          detail={t('temples.emptyD', 'Try a different spelling, another country, or clear the filters to see every temple.')}
          action={
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setQ('')
                setCountry('all')
              }}
            >
              {t('temples.clear', 'Clear filters')}
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((tp) => (
            <li
              key={tp.id}
              className={cn(
                'flex flex-col rounded-[10px] border bg-card p-5 shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow)]',
                tp.id === selectedId ? 'border-brand-400' : 'border-line',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-serif text-[19px] leading-snug text-ink">{tp.name}</h2>
              </div>
              <p className="mt-1.5 flex items-start gap-1.5 text-[13px] text-muted">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-brand-500" aria-hidden="true" />
                <span>
                  {tp.address}, {tp.city}
                  {tp.state ? `, ${tp.state}` : ''} {tp.zip}
                </span>
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
                <Badge variant="outline">{tp.country}</Badge>
                <Badge variant="outline">{tp.currency}</Badge>
                {typeof tp.distanceKm === 'number' ? (
                  <Badge variant="brand">
                    {t('temples.away', '{n} km away', { n: tp.distanceKm.toLocaleString() })}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-muted">{tp.about}</p>

              <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                <Link to={`/t/${tp.slug}`} className={buttonVariants({ size: 'sm' })}>
                  {t('temples.visit', 'Visit temple')}
                </Link>
                <a
                  href={osmLink(tp)}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                >
                  {t('temples.map', 'Map')}
                  <ExternalLink className="size-3" aria-hidden="true" />
                  <span className="sr-only">{t('temples.opensNew', '(opens OpenStreetMap in a new tab)')}</span>
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
