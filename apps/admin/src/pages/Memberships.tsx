import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarClock, Gift, Loader2, Mail } from 'lucide-react'
import type { Membership, MembershipTier, User } from '@/lib/data/types'
import { PageShell } from '@/components/layout/PageShell'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { StatTile } from '@/components/shared/StatTile'
import { StatusPill, TierBadge } from '@/components/shared/badges'
import { LoadingSkeleton } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox, Field, Select } from '@/components/ui/input'
import { Sheet } from '@/components/ui/overlay'
import { Tabs } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/toast'
import { createMembership, listDevotees, listMemberships } from '@/lib/data/api'
import { TIERS } from '@/lib/data/mock'
import { useAsync } from '@/lib/hooks'
import { fmtDate, money, titleCase } from '@/lib/utils'

interface Row {
  membership: Membership
  user?: User
  daysToRenewal: number
}

const WINDOWS = [
  { key: '30', label: 'Next 30 days' },
  { key: '60', label: 'Next 60 days' },
  { key: '90', label: 'Next 90 days' },
]

export default function Memberships() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [tier, setTier] = useState('')
  const [status, setStatus] = useState('')
  const [window, setWindow] = useState('30')
  const [gifting, setGifting] = useState(false)
  const [giftTo, setGiftTo] = useState('')
  const [giftTier, setGiftTier] = useState<MembershipTier>('gold')
  const [giftFamily, setGiftFamily] = useState(false)
  const [busy, setBusy] = useState(false)

  const { data, loading, refresh } = useAsync(
    async () => Promise.all([listMemberships(), listDevotees()]),
    [],
  )

  const rows = useMemo<Row[]>(() => {
    if (!data) return []
    const [memberships, devotees] = data
    const byId = new Map(devotees.map((d) => [d.id, d]))
    const now = Date.now()
    return memberships
      .filter((m) => (tier ? m.tier === tier : true))
      .filter((m) => (status ? m.status === status : true))
      .map((membership) => ({
        membership,
        user: byId.get(membership.userId),
        daysToRenewal: Math.round((new Date(membership.endDate).getTime() - now) / 86400000),
      }))
  }, [data, tier, status])

  const allRows = useMemo<Row[]>(() => {
    if (!data) return []
    const [memberships, devotees] = data
    const byId = new Map(devotees.map((d) => [d.id, d]))
    const now = Date.now()
    return memberships.map((membership) => ({
      membership,
      user: byId.get(membership.userId),
      daysToRenewal: Math.round((new Date(membership.endDate).getTime() - now) / 86400000),
    }))
  }, [data])

  const renewalsDue = allRows
    .filter(
      (r) =>
        r.membership.status === 'active' &&
        r.daysToRenewal >= 0 &&
        r.daysToRenewal <= Number(window),
    )
    .sort((a, b) => a.daysToRenewal - b.daysToRenewal)

  const revenue = allRows
    .filter((r) => r.membership.status === 'active')
    .reduce((s, r) => s + (TIERS.find((t) => t.tier === r.membership.tier)?.price ?? 0), 0)

  const gift = async () => {
    if (!giftTo) return
    setBusy(true)
    const start = new Date()
    const end = new Date(start)
    end.setFullYear(end.getFullYear() + 1)
    await createMembership({
      userId: giftTo,
      tier: giftTier,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      autoRenew: false,
      familyPlan: giftFamily,
    })
    setBusy(false)
    setGifting(false)
    setGiftTo('')
    toast('Membership gifted', {
      detail: `${titleCase(giftTier)} membership activated for one year.`,
    })
    refresh()
  }

  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: 'Member',
      sortValue: (r) => r.user?.name ?? '',
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{r.user?.name ?? 'Unknown'}</p>
          <p className="truncate text-sm text-muted">{r.user?.email}</p>
        </div>
      ),
    },
    {
      key: 'tier',
      header: 'Tier',
      sortValue: (r) => r.membership.tier,
      cell: (r) => <TierBadge tier={r.membership.tier} />,
    },
    {
      key: 'plan',
      header: 'Plan',
      sortValue: (r) => (r.membership.familyPlan ? 'family' : 'individual'),
      cell: (r) => (r.membership.familyPlan ? 'Family' : 'Individual'),
    },
    {
      key: 'started',
      header: 'Started',
      sortValue: (r) => r.membership.startDate,
      cell: (r) => (
        <span className="whitespace-nowrap text-muted">{fmtDate(r.membership.startDate)}</span>
      ),
    },
    {
      key: 'renews',
      header: 'Renews',
      sortValue: (r) => r.membership.endDate,
      cell: (r) => (
        <span className="whitespace-nowrap">
          {fmtDate(r.membership.endDate)}
          {r.membership.status === 'active' && r.daysToRenewal <= 60 && r.daysToRenewal >= 0 ? (
            <span className="ml-2 text-sm text-brand-600">in {r.daysToRenewal}d</span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'auto',
      header: 'Auto-renew',
      sortValue: (r) => (r.membership.autoRenew ? 'on' : 'off'),
      align: 'center',
      cell: (r) => (r.membership.autoRenew ? 'On' : 'Off'),
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (r) => r.membership.status,
      cell: (r) => <StatusPill status={r.membership.status} />,
    },
  ]

  return (
    <PageShell
      eyebrow="People"
      title="Memberships"
      description={`${allRows.filter((r) => r.membership.status === 'active').length} active · ${money(revenue)} annual membership revenue`}
      actions={
        <Button onClick={() => setGifting(true)}>
          <Gift />
          Gift a membership
        </Button>
      }
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(['silver', 'gold', 'platinum'] as const).map((t) => (
          <StatTile
            key={t}
            label={`${titleCase(t)} members`}
            value={
              allRows.filter((r) => r.membership.tier === t && r.membership.status === 'active')
                .length
            }
            sub={`${money(TIERS.find((x) => x.tier === t)!.price)} / year`}
            tone={t === 'gold' ? 'gold' : t === 'platinum' ? 'brand' : 'default'}
          />
        ))}
        <StatTile
          label="Lapsed"
          value={allRows.filter((r) => r.membership.status !== 'active').length}
          sub="Expired or cancelled"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr] xl:items-start">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap gap-2">
            <Select
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              aria-label="Filter by tier"
              className="w-[150px]"
            >
              <option value="">All tiers</option>
              {TIERS.map((t) => (
                <option key={t.tier} value={t.tier}>
                  {titleCase(t.tier)}
                </option>
              ))}
            </Select>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Filter by status"
              className="w-[160px]"
            >
              <option value="">All statuses</option>
              {['active', 'expired', 'cancelled'].map((s) => (
                <option key={s} value={s}>
                  {titleCase(s)}
                </option>
              ))}
            </Select>
          </div>

          {loading ? (
            <LoadingSkeleton variant="table" rows={8} />
          ) : (
            <DataTable
              rows={rows}
              columns={columns}
              rowKey={(r) => r.membership.id}
              onRowClick={(r) => r.user && navigate(`/devotees/${r.user.id}`)}
              initialSort={{ key: 'renews', dir: 'asc' }}
              empty={{ title: 'No memberships match', detail: 'Clear the tier or status filter.' }}
            />
          )}
        </div>

        <Card className="xl:sticky xl:top-[calc(var(--page-chrome-h,0px)+1.25rem)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-4">
            <h2 className="flex items-center gap-2 font-bold text-lg">
              <CalendarClock className="size-4 text-brand-500" />
              Renewals due
            </h2>
            <Tabs
              items={WINDOWS.map((w) => ({ key: w.key, label: w.label }))}
              value={window}
              onChange={setWindow}
              className="border-0"
            />
          </div>

          {renewalsDue.length === 0 ? (
            <p className="p-5 text-base text-muted">
              Nothing renews in the next {window} days. The next expiry is{' '}
              {allRows
                .filter((r) => r.membership.status === 'active' && r.daysToRenewal > 0)
                .sort((a, b) => a.daysToRenewal - b.daysToRenewal)[0]
                ? fmtDate(
                    allRows
                      .filter((r) => r.membership.status === 'active' && r.daysToRenewal > 0)
                      .sort((a, b) => a.daysToRenewal - b.daysToRenewal)[0]!.membership.endDate,
                  )
                : 'not scheduled'}
              .
            </p>
          ) : (
            <>
              <ul className="divide-y divide-line">
                {renewalsDue.slice(0, 8).map((r) => (
                  <li key={r.membership.id} className="flex items-center gap-3 p-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-medium text-ink">{r.user?.name}</p>
                      <p className="text-sm text-muted">
                        {titleCase(r.membership.tier)} · {fmtDate(r.membership.endDate)} ·{' '}
                        {r.membership.autoRenew ? 'auto-renews' : 'manual renewal'}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-medium text-brand-600">
                      {r.daysToRenewal}d
                    </span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-line p-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() =>
                    toast(`${renewalsDue.length} renewal reminders queued`, {
                      detail: 'No email leaves the building.',
                    })
                  }
                >
                  <Mail />
                  Send renewal reminders ({renewalsDue.length})
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>

      <Sheet
        open={gifting}
        onClose={() => setGifting(false)}
        title="Gift a membership"
        description="Activates immediately for one year, with auto-renew off."
        footer={
          <>
            <Button variant="outline" onClick={() => setGifting(false)}>
              Cancel
            </Button>
            <Button onClick={gift} disabled={!giftTo || busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Gift />}
              {busy ? 'Activating…' : 'Gift membership'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label="Recipient" htmlFor="gm-user">
            <Select id="gm-user" value={giftTo} onChange={(e) => setGiftTo(e.target.value)}>
              <option value="">Choose a devotee…</option>
              {(data?.[1] ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} — {u.city}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tier" htmlFor="gm-tier">
            <Select
              id="gm-tier"
              value={giftTier}
              onChange={(e) => setGiftTier(e.target.value as MembershipTier)}
            >
              {TIERS.map((t) => (
                <option key={t.tier} value={t.tier}>
                  {titleCase(t.tier)} — {money(t.price)}
                </option>
              ))}
            </Select>
          </Field>
          <label className="flex cursor-pointer items-center gap-3 text-base">
            <Checkbox checked={giftFamily} onChange={(e) => setGiftFamily(e.target.checked)} />
            Include family plan (spouse and minor children)
          </label>
        </div>
      </Sheet>
    </PageShell>
  )
}
