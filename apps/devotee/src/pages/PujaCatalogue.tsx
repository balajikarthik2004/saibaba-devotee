import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { useCurrentTemple, useT } from '@saibaba/core'
import type { PujaType } from '@/lib/data/types'
import { PageHeader } from '@/components/layout/layouts'
import { PujaCard } from '@/components/shared/PujaCard'
import { EmptyState, LoadingSkeleton } from '@/components/shared/states'
import { Chips } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { DeityArt } from '@/components/shared/DeityArt'
import { Input, Select } from '@/components/ui/input'
import { getPujaCatalog } from '@/lib/data/api'
import { useAsync } from '@/lib/hooks'

const FILTERS: { key: string; label: string; labelKey: string; path: string }[] = [
  { key: 'all', label: 'All', labelKey: 'puja.fAll', path: '/puja' },
  { key: 'yearly', label: 'Yearly', labelKey: 'puja.fYearly', path: '/puja/yearly' },
  { key: 'monthly', label: 'Monthly', labelKey: 'puja.fMonthly', path: '/puja/monthly' },
  { key: 'one-time', label: 'One-time', labelKey: 'puja.fOneTime', path: '/puja/one-time' },
  { key: 'abhishekam', label: 'Abhishekam', labelKey: 'puja.fAbhishekam', path: '/puja/abhishekam' },
]

type Sort = 'price-asc' | 'price-desc' | 'space'

export default function PujaCatalogue({ filter }: { filter?: PujaType }) {
  const t = useT()
  const temple = useCurrentTemple()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  // The spaces strip on the homepage deep-links here with ?space=dwarakamai.
  const spaceKey = params.get('space')
  const space = spaceKey ? temple.spaces.find((s) => s.key === spaceKey) : undefined
  const active = filter ?? 'all'
  const [sort, setSort] = useState<Sort>('price-asc')
  const [q, setQ] = useState('')

  const HEADINGS: Record<string, { title: string; subtitle: string }> = {
    all: {
      title: t('puja.title', 'Sponsor a puja'),
      subtitle: t(
        'puja.subtitle',
        'Every sponsorship is offered in your family’s name. Traditional details like gothra and nakshatra are entirely optional.',
      ),
    },
    yearly: {
      title: t('puja.yearly', 'Yearly pujas'),
      subtitle: t('puja.yearlyD', 'One sponsorship, a full year of offerings in your name.'),
    },
    monthly: {
      title: t('puja.monthly', 'Monthly pujas'),
      subtitle: t('puja.monthlyD', 'A steady monthly rhythm at the space you choose.'),
    },
    'one-time': {
      title: t('puja.oneTimeTitle', 'One-time archana'),
      subtitle: t('puja.oneTimeD', 'A single offering for a birthday, a milestone or a remembrance.'),
    },
    abhishekam: {
      title: t('puja.abhishekam', 'Special abhishekam'),
      subtitle: t('puja.abhishekamD', 'Sacred ablutions with milk, honey, sandal and vibhuti.'),
    },
  }

  const { data, loading } = useAsync(() => getPujaCatalog(filter), [filter, temple.id])

  const items = useMemo(() => {
    const matchesSpace = (deity: string) =>
      !space ||
      deity.toLowerCase() === space.name.toLowerCase() ||
      deity.toLowerCase().includes(space.key.toLowerCase())
    const list = (data ?? [])
      .filter((p) => matchesSpace(p.deity))
      .filter((p) => (q ? `${p.name} ${p.deity}`.toLowerCase().includes(q.toLowerCase()) : true))
    return [...list].sort((a, b) => {
      if (sort === 'price-asc') return a.basePrice - b.basePrice
      if (sort === 'price-desc') return b.basePrice - a.basePrice
      return a.deity.localeCompare(b.deity)
    })
  }, [data, sort, q, space])

  const heading = HEADINGS[active] ?? HEADINGS.all!
  const suffix = spaceKey ? `?space=${encodeURIComponent(spaceKey)}` : ''

  const setSpace = (key: string) => {
    if (key === 'all') params.delete('space')
    else params.set('space', key)
    setParams(params, { replace: true })
  }

  return (
    <>
      <PageHeader title={heading.title} subtitle={heading.subtitle} />

      {space ? (
        <div className="mb-5 flex items-center gap-4 overflow-hidden rounded-[10px] border border-line bg-card shadow-[var(--shadow-sm)]">
          <DeityArt
            deity={`${space.key} ${space.name}`}
            className="hidden h-24 w-32 shrink-0 sm:block"
            label={space.name}
          />
          <div className="min-w-0 flex-1 py-3 pl-4 sm:pl-0">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-saffron-600">
              {t('puja.space', 'Space')}
            </p>
            <p className="font-serif text-[21px] leading-tight">{space.name}</p>
            <p className="text-[13px] text-muted">
              {t('puja.countAt', '{n} puja(s) offered here', { n: items.length })}
            </p>
          </div>
          <Button variant="plain" size="sm" className="mr-3 shrink-0" onClick={() => setSpace('all')}>
            <X />
            {t('puja.clear', 'Clear')}
          </Button>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Chips
          items={FILTERS.map((f) => ({ key: f.key, label: t(f.labelKey, f.label) }))}
          value={active}
          onChange={(k) => navigate(FILTERS.find((f) => f.key === k)!.path + suffix)}
          className="flex-1"
        />
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('puja.search', 'Search pujas')}
            aria-label={t('puja.searchAria', 'Search the catalogue')}
            className="w-[210px] pl-9"
          />
        </div>
        <Select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label={t('puja.sortAria', 'Sort pujas')}
          className="w-[168px]"
        >
          <option value="price-asc">{t('puja.sortLow', 'Price — low to high')}</option>
          <option value="price-desc">{t('puja.sortHigh', 'Price — high to low')}</option>
          <option value="space">{t('puja.sortSpace', 'Space A–Z')}</option>
        </Select>
      </div>

      {temple.spaces.length > 0 ? (
        <Chips
          className="mb-5"
          items={[
            { key: 'all', label: t('puja.allSpaces', 'All spaces') },
            ...temple.spaces.map((s) => ({ key: s.key, label: s.name })),
          ]}
          value={space ? space.key : 'all'}
          onChange={setSpace}
        />
      ) : null}

      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : items.length === 0 ? (
        <EmptyState
          title={
            space
              ? t('puja.emptySpace', 'No pujas listed for {space} in this view', { space: space.name })
              : t('puja.empty', 'No pujas match that search')
          }
          detail={t('puja.emptyD', 'Try a different word, or clear the filter to see the whole catalogue.')}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((p) => (
            <PujaCard key={p.id} puja={p} />
          ))}
        </div>
      )}
    </>
  )
}
