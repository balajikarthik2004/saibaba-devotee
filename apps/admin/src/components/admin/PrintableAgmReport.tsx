import type { Project, PujaPnLRow, TempleEvent, TransparencySnapshot } from '@/lib/data/types'
import { Logo } from '@/components/shared/Logo'
import { useCurrentTemple } from '@saibaba/core'
import { TAX_REGIME_COPY } from '@/components/shared/taxRegime'
import { fmtDate, money, pct } from '@/lib/utils'

/**
 * The document the temple prints for the Annual General Meeting. Deliberately plain —
 * no colour fills, no charts, nothing that fails on an office laser printer.
 */
export function PrintableAgmReport({
  snapshot,
  pnl,
  events,
  projects,
}: {
  snapshot: TransparencySnapshot
  pnl: PujaPnLRow[]
  events: TempleEvent[]
  projects: Project[]
}) {
  const TEMPLE = useCurrentTemple()
  const pujaTotals = pnl.reduce(
    (a, r) => ({ collected: a.collected + r.collected, cost: a.cost + r.cost, net: a.net + r.net }),
    { collected: 0, cost: 0, net: 0 },
  )

  const allocations = [...snapshot.allocations].sort((a, b) => b.targetAmount - a.targetAmount)
  const allocTotals = allocations.reduce(
    (a, r) => ({
      target: a.target + r.targetAmount,
      collected: a.collected + r.collectedAmount,
      spent: a.spent + r.spentAmount,
    }),
    { target: 0, collected: 0, spent: 0 },
  )

  return (
    <div className="print-area space-y-6 text-sm leading-relaxed text-ink">
      <header className="flex items-start justify-between gap-4 border-b-2 border-ink/20 pb-4">
        <div className="flex items-start gap-3">
          <Logo size={44} />
          <div>
            <p className="font-bold text-xl leading-tight">{TEMPLE.name}</p>
            <p className="text-sm text-muted">
              {[TEMPLE.address, TEMPLE.city, TEMPLE.state, TEMPLE.zip].filter(Boolean).join(', ')} · {TEMPLE.taxIdLabel} {TEMPLE.taxId}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-[0.09em] text-muted">
            Annual General Meeting
          </p>
          <p className="font-bold text-md">Financial Summary</p>
          <p className="text-sm text-muted">Prepared {fmtDate(snapshot.updatedAt)}</p>
        </div>
      </header>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.09em] text-muted">
          1 · Operating position
        </h2>
        <table className="w-full border-collapse">
          <tbody className="divide-y divide-line">
            {[
              ['Collected year to date', money(snapshot.ytdCollected)],
              ['Annual operating target', money(snapshot.annualTarget)],
              ['Balance to break-even', money(snapshot.balanceToBreakeven)],
              ['Achieved', pct(snapshot.achievedPct)],
            ].map(([k, v]) => (
              <tr key={k}>
                <td className="py-1.5">{k}</td>
                <td className="py-1.5 text-right font-medium tabular-nums">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.09em] text-muted">
          2 · Annual target by budget head
        </h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-line">
              {['Allocation', 'Share', 'Target', 'Raised', 'Spent', 'Funded'].map((h, i) => (
                <th
                  key={h}
                  className={`py-1.5 text-2xs font-semibold uppercase tracking-[0.07em] text-muted ${i === 0 ? 'text-left' : 'text-right'}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {allocations.map((a) => (
              <tr key={a.key}>
                <td className="py-1.5">{a.label}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {allocTotals.target > 0
                    ? `${((a.targetAmount / allocTotals.target) * 100).toFixed(1)}%`
                    : '—'}
                </td>
                <td className="py-1.5 text-right tabular-nums">{money(a.targetAmount)}</td>
                <td className="py-1.5 text-right tabular-nums">{money(a.collectedAmount)}</td>
                <td className="py-1.5 text-right tabular-nums">{money(a.spentAmount)}</td>
                <td className="py-1.5 text-right font-medium tabular-nums">
                  {a.targetAmount > 0
                    ? pct(Math.round((a.collectedAmount / a.targetAmount) * 100))
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-ink/20">
              <td className="py-2 font-medium">Total</td>
              <td className="py-2 text-right font-medium tabular-nums">100.0%</td>
              <td className="py-2 text-right font-medium tabular-nums">
                {money(allocTotals.target)}
              </td>
              <td className="py-2 text-right font-medium tabular-nums">
                {money(allocTotals.collected)}
              </td>
              <td className="py-2 text-right font-medium tabular-nums">
                {money(allocTotals.spent)}
              </td>
              <td className="py-2 text-right font-medium tabular-nums">
                {allocTotals.target > 0
                  ? pct(Math.round((allocTotals.collected / allocTotals.target) * 100))
                  : '—'}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.09em] text-muted">
          3 · Puja sponsorship profit &amp; loss
        </h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-line">
              {['Puja', 'Sponsors', 'Collected', 'Expenses', 'Net'].map((h, i) => (
                <th
                  key={h}
                  className={`py-1.5 text-2xs font-semibold uppercase tracking-[0.07em] text-muted ${i === 0 ? 'text-left' : 'text-right'}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {pnl.map((r) => (
              <tr key={r.puja.id}>
                <td className="py-1.5">{r.puja.name}</td>
                <td className="py-1.5 text-right tabular-nums">{r.sponsors}</td>
                <td className="py-1.5 text-right tabular-nums">{money(r.collected)}</td>
                <td className="py-1.5 text-right tabular-nums">{money(r.cost)}</td>
                <td className="py-1.5 text-right font-medium tabular-nums">{money(r.net)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-ink/20">
              <td className="py-2 font-medium">Total</td>
              <td />
              <td className="py-2 text-right font-medium tabular-nums">
                {money(pujaTotals.collected)}
              </td>
              <td className="py-2 text-right font-medium tabular-nums">{money(pujaTotals.cost)}</td>
              <td className="py-2 text-right font-medium tabular-nums">{money(pujaTotals.net)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.09em] text-muted">
          4 · Festival break-even
        </h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-line">
              {['Festival', 'Date', 'Target', 'Raised', 'Variance'].map((h, i) => (
                <th
                  key={h}
                  className={`py-1.5 text-2xs font-semibold uppercase tracking-[0.07em] text-muted ${i < 2 ? 'text-left' : 'text-right'}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {events.map((e) => (
              <tr key={e.id}>
                <td className="py-1.5">{e.title}</td>
                <td className="py-1.5 whitespace-nowrap text-muted">
                  {fmtDate(e.date, 'MMM d, yyyy')}
                </td>
                <td className="py-1.5 text-right tabular-nums">{money(e.targetAmount)}</td>
                <td className="py-1.5 text-right tabular-nums">{money(e.collectedAmount)}</td>
                <td className="py-1.5 text-right font-medium tabular-nums">
                  {money(e.collectedAmount - e.targetAmount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.09em] text-muted">
          5 · Capital projects
        </h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-line">
              {['Project', 'Status', 'Target', 'Raised', 'Spent', 'Progress'].map((h, i) => (
                <th
                  key={h}
                  className={`py-1.5 text-2xs font-semibold uppercase tracking-[0.07em] text-muted ${i < 2 ? 'text-left' : 'text-right'}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {projects.map((p) => (
              <tr key={p.id}>
                <td className="py-1.5">{p.title}</td>
                <td className="py-1.5 capitalize text-muted">{p.status.replace('-', ' ')}</td>
                <td className="py-1.5 text-right tabular-nums">{money(p.targetAmount)}</td>
                <td className="py-1.5 text-right tabular-nums">{money(p.raisedAmount)}</td>
                <td className="py-1.5 text-right tabular-nums">{money(p.spentAmount)}</td>
                <td className="py-1.5 text-right font-medium tabular-nums">{pct(p.progressPct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="border-t border-line pt-4 text-xs text-muted">
        <p>
          {TAX_REGIME_COPY[TEMPLE.taxRegime].status} — {TEMPLE.name}. This summary is prepared from the
          temple’s operating ledger and is presented to members at the Annual General Meeting.
          Audited statements are available on request from the temple office.
        </p>
        <p className="mt-2 italic">
          Figures are generated sample data, not a real financial record.
        </p>
      </footer>
    </div>
  )
}
