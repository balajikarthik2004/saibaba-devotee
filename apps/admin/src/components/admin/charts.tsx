import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { LucideIcon } from 'lucide-react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { AXIS_TICK, CHART, TOOLTIP_STYLE } from './chart-theme'
import { cn, money, moneyShort, titleCase } from '@/lib/utils'

/* ------------------------------------------------------------ donations trend */

/**
 * Receipts over whatever window the dashboard is filtered to. One series, so no legend
 * box — the card title names it — and no per-point labels; the hover crosshair carries
 * the exact figure. The x key is `label` rather than `month` because the caller decides
 * the bucket: days for a short range, weeks or months for a long one.
 */
export function TrendChart({ data }: { data: { label: string; amount: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART.categorical[0]} stopOpacity={0.22} />
            <stop offset="100%" stopColor={CHART.categorical[0]} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={CHART.grid} strokeDasharray="2 4" vertical={false} />
        <XAxis
          dataKey="label"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: CHART.grid }}
          minTickGap={16}
        />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={54}
          tickFormatter={(v: number) => moneyShort(v)}
        />
        <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [money(Number(v)), 'Received']} />
        {/* `monotone` invented smooth troughs between points and made a spiky series
            look like data that was never recorded — a single major gift can move one
            bucket by six figures. A straight join tells the truth, and visible dots mark
            where the real readings are. */}
        <Area
          type="linear"
          dataKey="amount"
          stroke={CHART.categorical[0]}
          strokeWidth={2}
          fill="url(#trendFill)"
          dot={{ r: 2.5, fill: CHART.categorical[0], strokeWidth: 0 }}
          activeDot={{ r: 5, strokeWidth: 2, stroke: CHART.surface }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/* --------------------------------------------------------- bookings by puja type */

/**
 * A single measure across categories, so this is magnitude — one hue stepped along
 * the sequential ramp by rank, not five identity colours.
 */
export function BarChartByPuja({ data }: { data: { type: string; bookings: number }[] }) {
  const sorted = [...data].sort((a, b) => b.bookings - a.bookings)
  const max = Math.max(...sorted.map((d) => d.bookings), 1)

  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={sorted} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={CHART.grid} strokeDasharray="2 4" vertical={false} />
        <XAxis
          dataKey="type"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: CHART.grid }}
          tickFormatter={(v: string) => titleCase(v)}
        />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={34}
          allowDecimals={false}
        />
        <Tooltip
          {...TOOLTIP_STYLE}
          cursor={{ fill: 'rgba(163,52,31,0.05)' }}
          formatter={(v) => [`${Number(v)} bookings`, '']}
          labelFormatter={(l) => titleCase(String(l))}
        />
        <Bar dataKey="bookings" radius={[4, 4, 0, 0]} maxBarSize={54}>
          {sorted.map((d) => {
            const step = Math.min(
              CHART.sequential.length - 1,
              Math.floor((d.bookings / max) * (CHART.sequential.length - 1)),
            )
            return <Cell key={d.type} fill={CHART.sequential[step]} />
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ---------------------------------------------------------------- metric card */

/** Dashboard tile with a sparkline. The number is the headline; the line is texture. */
export function MetricCard({
  label,
  value,
  sub,
  Icon,
  series,
  trend,
  tone = 'default',
  className,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  Icon?: LucideIcon
  series?: number[]
  trend?: { value: string; direction: 'up' | 'down' }
  tone?: 'default' | 'brand' | 'gold' | 'leaf'
  className?: string
}) {
  const stroke =
    tone === 'leaf'
      ? CHART.categorical[2]
      : tone === 'gold'
        ? CHART.categorical[1]
        : CHART.categorical[0]

  const accent =
    tone === 'leaf'
      ? 'before:bg-leaf-500'
      : tone === 'gold'
        ? 'before:bg-saffron-500'
        : tone === 'brand'
          ? 'before:bg-brand-500'
          : 'before:bg-line'

  const chip =
    tone === 'leaf'
      ? 'bg-leaf-500/[0.11] text-leaf-600 ring-leaf-500/18'
      : tone === 'gold'
        ? 'bg-gold-500/[0.13] text-gold-600 ring-gold-500/20'
        : tone === 'brand'
          ? 'bg-brand-500/[0.09] text-brand-600 ring-brand-500/15'
          : 'bg-tint text-muted ring-line'

  return (
    <div
      className={cn(
        // A 3px rail on the left carries the tone, so the card body stays white and the
        // row reads as one band of figures rather than four separately tinted boxes.
        'relative flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] border border-hairline bg-card py-3.5 pl-4 pr-3.5 shadow-[var(--shadow-sm)]',
        'before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:content-[""]',
        accent,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="eyebrow min-w-0 truncate">{label}</p>
        {/* The bare 14px icon read as a stray glyph next to the label. In a chip it
            matches the tone rail and gives the tile a fixed top-right anchor. */}
        {Icon ? (
          <span
            className={cn('grid size-7 shrink-0 place-items-center rounded-[7px] ring-1', chip)}
          >
            <Icon className="size-[15px]" />
          </span>
        ) : null}
      </div>

      {/* The figure stays where the eye expects it — directly under the label — and the
          sparkline shares its baseline. */}
      <div className="mt-2.5 flex items-end justify-between gap-3">
        <p className="stat-figure min-w-0">{value}</p>

        {/* The sparkline sits beside the number rather than under it — same information,
            roughly half the card height, so the row stops stretching to match it. */}
        {series && series.length > 1 ? (
          <div className="h-8 w-20 shrink-0" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={series.map((v, i) => ({ i, v }))}
                margin={{ top: 2, right: 0, left: 0, bottom: 2 }}
              >
                <Line type="linear" dataKey="v" stroke={stroke} strokeWidth={1.75} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </div>

      {/* It is the caption that absorbs the slack, not the number. `mt-auto` here holds
          every caption in the row on one line along the bottom edge while the figures
          stay tucked under their labels; putting it on the figure instead opened a band
          of dead white between label and number on any tile shorter than its neighbour. */}
      <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-2">
        {sub ? <p className="text-sm leading-tight text-muted">{sub}</p> : null}
        {trend ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-1.5 py-px text-xs font-bold',
              trend.direction === 'up'
                ? 'bg-leaf-500/10 text-leaf-600'
                : 'bg-brand-500/[0.08] text-brand-600',
            )}
          >
            {trend.direction === 'up' ? (
              <TrendingUp className="size-3" />
            ) : (
              <TrendingDown className="size-3" />
            )}
            {trend.value}
          </span>
        ) : null}
      </div>
    </div>
  )
}
