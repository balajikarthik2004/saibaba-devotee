import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, HandCoins, Plus, Users } from 'lucide-react'
import { formatMoney, useT, useTempleStore } from '@saibaba/core'
import { getPlatformStats, listTemples } from '@saibaba/core/features/tenancy'
import type { CurrencyCode, Temple } from '@saibaba/core/types'
import { PageShell } from '@/components/layout/PageShell'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { Toolbar, ToolbarSelect } from '@/components/admin/Toolbar'
import { StatTile } from '@/components/shared/StatTile'
import { LoadingSkeleton } from '@/components/shared/states'
import { STATUS_LABEL, TAX_REGIME_OPTIONS } from '@/components/shared/templeOptions'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { useAsync } from '@/lib/hooks'

const STATUS_VARIANT: Record<Temple['status'], 'leaf' | 'gold' | 'neutral'> = {
  active: 'leaf',
  onboarding: 'gold',
  suspended: 'neutral',
}

export function StatusChip({ status }: { status: Temple['status'] }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
}

const regimeLabel = (r: Temple['taxRegime']) =>
  TAX_REGIME_OPTIONS.find((o) => o.code === r)?.label ?? r

export default function TemplesList() {
  const t = useT()
  const navigate = useNavigate()
  const setTempleId = useTempleStore((s) => s.setTempleId)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'all' | Temple['status']>('all')
  const [country, setCountry] = useState('all')

  const { data: temples, loading } = useAsync(() => listTemples({ includeAll: true }), [])
  const { data: stats } = useAsync(() => getPlatformStats(), [])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (temples ?? []).filter(
      (x) =>
        (status === 'all' || x.status === status) &&
        (country === 'all' || x.country === country) &&
        (!needle || [x.name, x.city, x.state, x.slug].some((s) => s.toLowerCase().includes(needle))),
    )
  }, [temples, q, status, country])

  const columns: Column<Temple>[] = [
    {
      key: 'name',
      header: t('temples.col.temple', 'Temple'),
      sortValue: (r) => r.name,
      cell: (r) => (
        <div className="min-w-0">
          <Link
            to={`/temples/${r.id}`}
            className="font-medium text-ink hover:text-brand-600 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {r.name}
          </Link>
          <p className="text-xs text-muted">/{r.slug}</p>
        </div>
      ),
    },
    {
      key: 'place',
      header: t('temples.col.location', 'Location'),
      sortValue: (r) => `${r.country}${r.city}`,
      cell: (r) => (
        <span className="text-sm text-ink-soft">
          {r.city}
          {r.state ? `, ${r.state}` : ''} · {r.country}
        </span>
      ),
    },
    {
      key: 'cur',
      header: t('temples.col.currency', 'Currency'),
      sortValue: (r) => r.currency,
      cell: (r) => r.currency,
    },
    {
      key: 'tax',
      header: t('temples.col.tax', 'Tax regime'),
      sortValue: (r) => r.taxRegime,
      cell: (r) => <span className="text-sm">{regimeLabel(r.taxRegime)}</span>,
    },
    {
      key: 'status',
      header: t('temples.col.status', 'Status'),
      sortValue: (r) => r.status,
      cell: (r) => (
        <span className="flex items-center gap-1.5">
          <StatusChip status={r.status} />
        </span>
      ),
    },
    {
      key: 'act',
      header: '',
      className: 'w-[1%]',
      cell: (r) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            setTempleId(r.id)
            navigate('/dashboard')
          }}
        >
          {t('temples.open', 'Open console')}
        </Button>
      ),
    },
  ]

  const gifts = Object.entries(stats?.giftsByCurrency ?? {}) as [CurrencyCode, number][]
  const countries = [...new Set((temples ?? []).map((x) => x.country))].sort()

  return (
    <PageShell
      eyebrow={t('nav.group.Platform', 'Platform')}
      title={t('temples.title', 'Temples')}
      description={
        temples ? t('temples.count', '{n} temples on the platform', { n: temples.length }) : undefined
      }
      actions={
        <Link to="/temples/new" className={buttonVariants({ size: 'sm' })}>
          <Plus />
          {t('temples.add', 'Onboard a temple')}
        </Link>
      }
      toolbar={
        <Toolbar
          search={q}
          onSearch={setQ}
          searchPlaceholder={t('temples.search', 'Search name, city, slug')}
          activeCount={(status !== 'all' ? 1 : 0) + (country !== 'all' ? 1 : 0)}
          onClear={() => {
            setStatus('all')
            setCountry('all')
          }}
        >
          <ToolbarSelect
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            aria-label="Status"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="onboarding">Onboarding</option>
            <option value="suspended">Suspended</option>
          </ToolbarSelect>
          <ToolbarSelect
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            aria-label="Country"
          >
            <option value="all">All countries</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </ToolbarSelect>
        </Toolbar>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatTile
          label={t('temples.stat.active', 'Active temples')}
          value={stats?.temples ?? '—'}
          Icon={Building2}
          tone="brand"
        />
        <StatTile
          label={t('temples.stat.devotees', 'Devotees')}
          value={stats?.devotees ?? '—'}
          Icon={Users}
          tone="leaf"
        />
        <StatTile
          label={t('temples.stat.gifts', 'Gifts received')}
          value={
            gifts.length ? gifts.map(([c, n]) => formatMoney(n, c, { compact: true })).join(' · ') : '—'
          }
          sub={t('temples.stat.giftsSub', 'Per currency, never converted')}
          Icon={HandCoins}
          tone="gold"
        />
      </div>

      {loading || !temples ? (
        <LoadingSkeleton variant="table" rows={6} />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate(`/temples/${r.id}`)}
          initialSort={{ key: 'name', dir: 'asc' }}
          empty={{ title: 'No temples match', detail: 'Clear the filters or onboard a new temple.' }}
        />
      )}
    </PageShell>
  )
}
