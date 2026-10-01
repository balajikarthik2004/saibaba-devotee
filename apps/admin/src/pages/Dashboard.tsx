import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  CalendarCheck,
  HandCoins,
  Package,
  // ShieldCheck, // Membership temporarily disabled
  TrendingUp,
  UserPlus,
  Wallet,
} from 'lucide-react'
import { useT } from '@saibaba/core'
import { PlatformTiles } from '@/components/admin/PlatformTiles'
import { PageShell } from '@/components/layout/PageShell'
import { MetricCard, BarChartByPuja, TrendChart } from '@/components/admin/charts'
import { Toolbar, ToolbarDate, ToolbarSelect } from '@/components/admin/Toolbar'
import { type ArchanaRow } from '@/components/admin/TodaysArchanaList'
import { BreakEvenMeter } from '@/components/shared/BreakEvenMeter'
import { LoadingSkeleton } from '@/components/shared/states'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import {
  getAdminStats,
  getOccurrencesOn,
  getTransparencySnapshot,
  listBookings,
} from '@/lib/data/api'
import { USERS } from '@/lib/data/mock'
import { useAuthStore } from '@/lib/store/auth'
import { useAsync } from '@/lib/hooks'
import { fmtDate, money, moneyShort } from '@/lib/utils'

/* ---------------------------------------------------------------- date range */

const iso = (d: Date) => {
  // Local calendar date, not UTC — `toISOString` on a midnight local Date rolls back
  // a day for anyone west of Greenwich, which is most of the Americas.
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

/** Presets cover the questions actually asked at a desk; custom covers the rest. */
const PRESETS = {
  '7d': { label: 'Last 7 days', from: () => daysAgo(6), to: () => new Date() },
  '30d': { label: 'Last 30 days', from: () => daysAgo(29), to: () => new Date() },
  '90d': { label: 'Last 90 days', from: () => daysAgo(89), to: () => new Date() },
  ytd: {
    label: 'Year to date',
    from: () => new Date(new Date().getFullYear(), 0, 1),
    to: () => new Date(),
  },
  '12m': { label: 'Last 12 months', from: () => daysAgo(364), to: () => new Date() },
} as const

type PresetKey = keyof typeof PRESETS

/**
 * Delta vs the preceding window of equal length, as a MetricCard trend chip.
 *
 * Nothing is shown when the previous period was empty: the chip is colour-coded, and a
 * green badge against a zero baseline reads as good news when the truth is only that
 * there is nothing to compare. The caption under the figure carries the prior number
 * either way.
 */
function delta(current: number, previous: number) {
  if (previous === 0) return undefined
  const pct = Math.round(((current - previous) / previous) * 100)
  return {
    value: pct === 0 ? 'level on previous' : `${pct > 0 ? '+' : ''}${pct}% vs previous`,
    direction: pct >= 0 ? ('up' as const) : ('down' as const),
  }
}

/* --------------------------------------------------------------------- page */

export default function Dashboard() {
  const user = useAuthStore((s) => s.user)!
  const t = useT()

  const [preset, setPreset] = useState<PresetKey | 'custom'>('30d')
  const [customFrom, setCustomFrom] = useState(iso(daysAgo(29)))
  const [customTo, setCustomTo] = useState(iso(new Date()))

  const range = useMemo(() => {
    if (preset === 'custom') {
      // Tolerate the two dates being entered in either order.
      return customFrom <= customTo
        ? { from: customFrom, to: customTo }
        : { from: customTo, to: customFrom }
    }
    const p = PRESETS[preset]
    return { from: iso(p.from()), to: iso(p.to()) }
  }, [preset, customFrom, customTo])

  const { data, loading } = useAsync(
    async () =>
      Promise.all([
        getAdminStats(range),
        getTransparencySnapshot(),
        getOccurrencesOn(new Date()),
        listBookings(),
      ]),
    [range.from, range.to],
  )

  const rangeLabel =
    preset === 'custom'
      ? `${fmtDate(range.from, 'MMM d, yyyy')} — ${fmtDate(range.to, 'MMM d, yyyy')}`
      : PRESETS[preset].label

  // A preset name reads fine mid-sentence lowercased ("across last 30 days"); a date
  // does not ("across jan 1, 2026"). Only the preset gets folded.
  const rangePhrase = preset === 'custom' ? rangeLabel : rangeLabel.toLowerCase()

  const toolbar = (
    <Toolbar
      activeCount={preset === '30d' ? 0 : 1}
      onClear={() => {
        setPreset('30d')
        setCustomFrom(iso(daysAgo(29)))
        setCustomTo(iso(new Date()))
      }}
    >
      <ToolbarSelect
        value={preset}
        onChange={(e) => setPreset(e.target.value as PresetKey | 'custom')}
        aria-label="Reporting period"
      >
        {Object.entries(PRESETS).map(([k, p]) => (
          <option key={k} value={k}>
            {p.label}
          </option>
        ))}
        <option value="custom">Custom range</option>
      </ToolbarSelect>

      {/* The two date inputs appear only for a custom range — shown always, they read
          as filters that are already narrowing the page when they are not. */}
      {preset === 'custom' ? (
        <>
          <ToolbarDate
            label="From"
            value={customFrom}
            max={iso(new Date())}
            onChange={(e) => setCustomFrom(e.target.value)}
          />
          <ToolbarDate
            label="To"
            value={customTo}
            max={iso(new Date())}
            onChange={(e) => setCustomTo(e.target.value)}
          />
        </>
      ) : (
        <span className="text-sm text-muted">
          {fmtDate(range.from, 'MMM d')} — {fmtDate(range.to, 'MMM d, yyyy')}
        </span>
      )}
    </Toolbar>
  )

  if (loading || !data) {
    return (
      <PageShell
        eyebrow="Operations"
        title="Operations dashboard"
        description="Loading the figures…"
        toolbar={toolbar}
      >
        <LoadingSkeleton variant="tiles" rows={4} />
      </PageShell>
    )
  }

  const [stats, snapshot, todayOccurrences, bookings] = data
  const bookingById = new Map(bookings.map((b) => [b.id, b]))

  const rows: ArchanaRow[] = todayOccurrences
    .map((occurrence) => {
      const booking = bookingById.get(occurrence.bookingId)
      return {
        occurrence,
        booking,
        devotee: booking ? USERS.find((u) => u.id === booking.userId) : undefined,
      }
    })
    .sort((a, b) => a.occurrence.scheduledAt.localeCompare(b.occurrence.scheduledAt))

  const grainWord = stats.grain === 'day' ? 'day' : stats.grain === 'week' ? 'week' : 'month'

  return (
    <PageShell
      eyebrow="Operations"
      title={t('dash.greeting', 'Good morning, {name}', { name: user.name.split(' ')[0] ?? '' })}
      description={`${fmtDate(new Date(), 'EEEE, MMMM d, yyyy')} · ${rows.length} pujas on today’s roster`}
      toolbar={toolbar}
      actions={
        <>
          <Link to="/bookings/today" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            <CalendarCheck />
            {t('dash.todaysPujas', 'Today’s pujas')}
          </Link>
          <Link to="/transparency" className={buttonVariants({ size: 'sm' })}>
            <TrendingUp />
            {t('dash.transparency', 'Transparency')}
          </Link>
        </>
      }
    >
      {user.role === 'platform' ? <PlatformTiles /> : null}

      {/* Row 1 — everything here answers "over the selected period". Each carries its
          own comparison against the window immediately before it, so a figure that is
          up on a quiet fortnight cannot be mistaken for a figure that is simply large. */}
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="font-serif text-lg text-ink">{rangeLabel}</h2>
        <p className="text-sm text-muted">
          {stats.days} {stats.days === 1 ? 'day' : 'days'}, compared with the previous{' '}
          {stats.days === 1 ? 'day' : `${stats.days} days`}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Donations received"
          value={money(stats.donations)}
          sub={`${money(stats.donationsPrev)} in the previous period`}
          Icon={Wallet}
          series={stats.trend.map((t) => t.amount)}
          trend={delta(stats.donations, stats.donationsPrev)}
          tone="brand"
        />
        <MetricCard
          label="New sponsorships"
          value={stats.sponsorships}
          sub={`${money(stats.sponsorshipRevenue)} booked`}
          Icon={HandCoins}
          trend={delta(stats.sponsorships, stats.sponsorshipsPrev)}
          tone="gold"
        />
        <MetricCard
          label="New devotees"
          value={stats.newDevotees}
          sub={`${stats.devoteeCount} on the register in total`}
          Icon={UserPlus}
          trend={delta(stats.newDevotees, stats.newDevoteesPrev)}
          tone="leaf"
        />
      </div>

      {/* Row 2 — charts, both scoped to the same range as the row above. */}
      <div className="mt-3 grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Donations received</CardTitle>
            <CardDescription>
              By {grainWord} across {rangePhrase}. Excludes puja sponsorships.
            </CardDescription>
          </CardHeader>
          <div className="px-4 py-4">
            {stats.trend.some((t) => t.amount > 0) ? (
              <TrendChart data={stats.trend} />
            ) : (
              <p className="py-16 text-center text-base text-muted">
                No donations recorded in this period.
              </p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sponsorships by puja type</CardTitle>
            <CardDescription>
              Booked in this period. Cancelled and unapproved excluded.
            </CardDescription>
          </CardHeader>
          <div className="px-4 py-4">
            {stats.byPujaType.length > 0 ? (
              <BarChartByPuja data={stats.byPujaType} />
            ) : (
              <p className="py-16 text-center text-base text-muted">
                No sponsorships booked in this period.
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Row 3 — the live counters. Deliberately below the period block and headed as
          "right now": an overdue shipment or a puja still to be performed today has no
          reporting period, and re-labelling one under a date filter would be a lie. */}
      <div className="mb-2 mt-6 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-line pt-5">
        <h2 className="font-serif text-lg text-ink">{t('dash.rightNow', 'Right now')}</h2>
        <p className="text-sm text-muted">Live counts — not affected by the period above</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-4">
        <Card className="p-4">
          <p className="eyebrow">Break-even snapshot</p>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="stat-figure">{moneyShort(snapshot.ytdCollected)}</span>
            <span className="text-sm text-muted">of {moneyShort(snapshot.annualTarget)}</span>
          </div>
          <BreakEvenMeter
            className="mt-3"
            target={snapshot.annualTarget}
            collected={snapshot.ytdCollected}
            label="Annual operating target"
            compact
          />
        </Card>

        <MetricCard
          label="Active bookings"
          value={stats.activeBookings}
          sub="Live puja sponsorships"
          Icon={BookOpen}
          tone="gold"
        />
        <MetricCard
          label="Today’s action queue"
          value={stats.todayQueue}
          sub="Pujas still to be performed today"
          Icon={CalendarCheck}
          tone="brand"
        />
        <MetricCard
          label="Overdue prasadam shipments"
          value={stats.overduePrasadam}
          sub="Sponsorships with prasadam-by-post"
          Icon={Package}
          tone="gold"
        />
      </div>
    </PageShell>
  )
}
