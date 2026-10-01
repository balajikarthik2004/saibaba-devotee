import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Users } from 'lucide-react'
import type { /* MembershipTier, */ User } from '@/lib/data/types'
import { PageShell } from '@/components/layout/PageShell'
import { DataTable, type Column } from '@/components/admin/DataTable'
// Membership temporarily disabled
// import { TierBadge } from '@/components/shared/badges'
import { LoadingSkeleton } from '@/components/shared/states'
import { Avatar } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Toolbar, ToolbarSelect } from '@/components/admin/Toolbar'
import { getMyBookings, listDevotees, listDonations /*, listMemberships */ } from '@/lib/data/api'
import { CITIES } from '@/lib/data/mock'
import { useAsync, useDebounced } from '@/lib/hooks'
import { downloadCSV, fmtDate, money } from '@/lib/utils'

interface Row {
  user: User
  // Membership temporarily disabled
  // tier?: MembershipTier
  contributions: number
  activePujas: number
}

const JOINED_RANGES = [
  { key: 'all', label: 'Any time' },
  { key: '1y', label: 'Last 12 months' },
  { key: '3y', label: 'Last 3 years' },
  { key: '5y', label: 'Last 5 years' },
]

export default function Devotees() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  // Membership temporarily disabled
  // const [tier, setTier] = useState('')
  const [city, setCity] = useState('')
  const [joined, setJoined] = useState('all')
  const debounced = useDebounced(search)

  const { data, loading } = useAsync(
    // Membership temporarily disabled — listMemberships() dropped from the tuple.
    async () => Promise.all([listDevotees(), listDonations()]),
    [],
  )

  const { data: bookingCounts } = useAsync(async () => {
    const devotees = await listDevotees()
    const entries = await Promise.all(
      devotees.map(async (d) => {
        const bookings = await getMyBookings(d.id)
        return [d.id, bookings.filter((b) => b.status === 'active').length] as const
      }),
    )
    return new Map(entries)
  }, [])

  const rows = useMemo<Row[]>(() => {
    if (!data) return []
    const [devotees, donations] = data
    // Membership temporarily disabled
    // const activeMembership = new Map(
    //   memberships.filter((m) => m.status === 'active').map((m) => [m.userId, m.tier]),
    // )
    const totals = new Map<string, number>()
    for (const d of donations) {
      if (!d.userId) continue
      totals.set(d.userId, (totals.get(d.userId) ?? 0) + d.amount)
    }

    const cutoff = (() => {
      const now = new Date()
      if (joined === '1y') return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
      if (joined === '3y') return new Date(now.getFullYear() - 3, now.getMonth(), now.getDate())
      if (joined === '5y') return new Date(now.getFullYear() - 5, now.getMonth(), now.getDate())
      return null
    })()

    const q = debounced.trim().toLowerCase()

    return (
      devotees
        .filter((u) =>
          q ? [u.name, u.email, u.phone].some((f) => f.toLowerCase().includes(q)) : true,
        )
        .filter((u) => (city ? u.city === city : true))
        // Membership temporarily disabled
        // .filter((u) => (tier ? activeMembership.get(u.id) === tier : true))
        .filter((u) => (cutoff ? new Date(u.createdAt) >= cutoff : true))
        .map((user) => ({
          user,
          // Membership temporarily disabled
          // tier: activeMembership.get(user.id),
          contributions: totals.get(user.id) ?? 0,
          activePujas: bookingCounts?.get(user.id) ?? 0,
        }))
    )
    // `tier` dropped from the deps along with the filter above.
  }, [data, debounced, city, joined, bookingCounts])

  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: 'Name',
      sortValue: (r) => r.user.name,
      cell: (r) => (
        <div className="flex items-center gap-2.5">
          <Avatar initials={r.user.avatarInitials} className="size-7 text-2xs" />
          <div className="min-w-0 leading-tight">
            <p className="truncate font-medium text-ink">{r.user.name}</p>
            <p className="truncate text-xs text-muted">{r.user.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', sortValue: (r) => r.user.phone, cell: (r) => r.user.phone },
    {
      key: 'city',
      header: 'City',
      sortValue: (r) => r.user.city ?? '',
      cell: (r) => r.user.city ?? '—',
    },
    // Membership temporarily disabled
    // {
    //   key: 'tier',
    //   header: 'Tier',
    //   sortValue: (r) => r.tier ?? 'zz',
    //   cell: (r) => (r.tier ? <TierBadge tier={r.tier} /> : <span className="text-muted">—</span>),
    // },
    {
      key: 'contributions',
      header: 'Contributions',
      sortValue: (r) => r.contributions,
      align: 'right',
      cell: (r) => <span className="tabular-nums">{money(r.contributions)}</span>,
    },
    {
      key: 'pujas',
      header: 'Active pujas',
      sortValue: (r) => r.activePujas,
      align: 'right',
      cell: (r) => <span className="tabular-nums">{r.activePujas}</span>,
    },
    {
      key: 'joined',
      header: 'Joined',
      sortValue: (r) => r.user.createdAt,
      cell: (r) => (
        <span className="whitespace-nowrap text-muted">
          {fmtDate(r.user.createdAt, 'MMM yyyy')}
        </span>
      ),
    },
  ]

  const exportCSV = () =>
    downloadCSV(
      'saibaba-devotees.csv',
      rows.map((r) => ({
        Name: r.user.name,
        Email: r.user.email,
        Phone: r.user.phone,
        City: r.user.city,
        // Membership temporarily disabled
        // Tier: r.tier ?? '',
        Contributions: r.contributions,
        ActivePujas: r.activePujas,
        Joined: fmtDate(r.user.createdAt, 'yyyy-MM-dd'),
      })),
    )

  const toolbar = (
    <Toolbar
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Search name, phone or email"
      // `tier` dropped from the active-filter count while membership is disabled.
      activeCount={[city, joined !== 'all' ? joined : '', search].filter(Boolean).length}
      onClear={() => {
        setSearch('')
        // setTier('') // Membership temporarily disabled
        setCity('')
        setJoined('all')
      }}
    >
      {/* Membership temporarily disabled */}
      {/* <ToolbarSelect
        value={tier}
        onChange={(e) => setTier(e.target.value)}
        aria-label="Filter by tier"
      >
        <option value="">All tiers</option>
        <option value="silver">Silver</option>
        <option value="gold">Gold</option>
        <option value="platinum">Platinum</option>
      </ToolbarSelect> */}
      <ToolbarSelect
        value={city}
        onChange={(e) => setCity(e.target.value)}
        aria-label="Filter by city"
      >
        <option value="">All cities</option>
        {CITIES.map((c) => (
          <option key={c.city} value={c.city}>
            {c.city}
          </option>
        ))}
      </ToolbarSelect>
      <ToolbarSelect
        value={joined}
        onChange={(e) => setJoined(e.target.value)}
        aria-label="Filter by join date"
      >
        {JOINED_RANGES.map((r) => (
          <option key={r.key} value={r.key}>
            {r.label}
          </option>
        ))}
      </ToolbarSelect>
    </Toolbar>
  )

  return (
    <PageShell
      toolbar={toolbar}
      eyebrow="People"
      title="Devotees"
      description={`${rows.length} on the register${loading ? '' : ` · ${money(rows.reduce((s, r) => s + r.contributions, 0))} lifetime donations`}`}
      actions={
        <Button variant="ghost" size="sm" onClick={exportCSV} disabled={rows.length === 0}>
          <Download />
          Export CSV
        </Button>
      }
    >
      {loading ? (
        <LoadingSkeleton variant="table" rows={8} />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(r) => r.user.id}
          onRowClick={(r) => navigate(`/devotees/${r.user.id}`)}
          initialSort={{ key: 'contributions', dir: 'desc' }}
          empty={{
            title: 'No devotees match those filters',
            // Membership temporarily disabled — copy no longer mentions the tier filter.
            detail: 'Clear the search or widen the city filters.',
          }}
        />
      )}

      {!loading && rows.length > 0 ? (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-muted">
          <Users className="size-3.5" />
          Click any row to open the full devotee record.
        </p>
      ) : null}
    </PageShell>
  )
}
