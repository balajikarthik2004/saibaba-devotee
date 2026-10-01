import type { TargetAllocation } from '@/lib/data/types'
import { Badge } from '@/components/ui/badge'
import { Table, TBody, TD, TH, THead, TR, TableWrap } from '@/components/ui/table'
import { cn, money, pct } from '@/lib/utils'

/**
 * Funding bands. A head at 92% in September is fine; one at 39% is the thing the
 * board needs to look at. Bands are wide on purpose — this is a flag, not a score.
 */
function band(fundedPct: number) {
  if (fundedPct >= 90) return { tone: 'leaf' as const, word: 'on track' }
  if (fundedPct >= 70) return { tone: 'gold' as const, word: 'behind' }
  return { tone: 'brand' as const, word: 'at risk' }
}

/**
 * Where the annual target goes, head by head.
 *
 * The form is a ranked horizontal bar, one head per row, rather than a pie or a
 * stacked composition bar: six slices need six identity colours, and six steps of
 * the temple's warm ramp sit at ΔE 8.9 for a normal-vision reader — below the 15
 * floor, so adjacent slices would be guesswork. Rows carry identity in text and
 * magnitude in bar length, which needs no palette at all. Colour appears only on
 * the funding badge, where it is a reserved status cue and always paired with a
 * word and a number.
 *
 * Bars scale to the largest head, not to the whole target — the ratios between
 * heads are what the eye is comparing, and scaling to 100% would leave every bar
 * stubby against three-quarters of empty track. The exact share is printed beside
 * each bar, so nothing is length-only.
 */
export function TargetBreakdown({
  allocations,
  annualTarget,
  ytdCollected,
  className,
}: {
  allocations: TargetAllocation[]
  annualTarget: number
  ytdCollected: number
  className?: string
}) {
  const rows = [...allocations].sort((a, b) => b.targetAmount - a.targetAmount)

  const totals = rows.reduce(
    (a, r) => ({
      target: a.target + r.targetAmount,
      collected: a.collected + r.collectedAmount,
      spent: a.spent + r.spentAmount,
    }),
    { target: 0, collected: 0, spent: 0 },
  )

  const widest = Math.max(...rows.map((r) => r.targetAmount), 1)

  // The heads are meant to reconcile to the headline tiles exactly. If someone edits
  // one without rebalancing its siblings, say so here rather than letting the table
  // and the tiles disagree in silence.
  const targetVariance = totals.target - annualTarget
  const collectedVariance = totals.collected - ytdCollected
  const reconciles = targetVariance === 0 && collectedVariance === 0

  const overallPct = totals.target > 0 ? (totals.collected / totals.target) * 100 : 0
  const overall = band(overallPct)

  return (
    <div className={className}>
      <TableWrap>
        <Table>
          <THead>
            <TR>
              <TH>Allocation</TH>
              <TH>Share of target</TH>
              <TH className="text-right">Target</TH>
              <TH className="text-right">Raised</TH>
              <TH className="text-right">Spent</TH>
              <TH>Funded</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => {
              const share = totals.target > 0 ? (r.targetAmount / totals.target) * 100 : 0
              const funded = r.targetAmount > 0 ? (r.collectedAmount / r.targetAmount) * 100 : 0
              const b = band(funded)
              return (
                <TR key={r.key} className="hover:bg-tint/40">
                  <TD>
                    <p className="font-medium text-ink">{r.label}</p>
                    <p className="max-w-[42ch] text-sm leading-snug text-muted">{r.detail}</p>
                  </TD>
                  <TD>
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-line/70"
                      >
                        <span
                          className="block h-full rounded-full bg-brand-400"
                          style={{ width: `${(r.targetAmount / widest) * 100}%` }}
                        />
                      </span>
                      <span className="tabular-nums text-sm text-muted">{share.toFixed(1)}%</span>
                    </div>
                  </TD>
                  <TD className="text-right font-medium tabular-nums">{money(r.targetAmount)}</TD>
                  <TD className="text-right tabular-nums">{money(r.collectedAmount)}</TD>
                  <TD className="text-right tabular-nums text-muted">{money(r.spentAmount)}</TD>
                  <TD>
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-line/70"
                      >
                        <span
                          className={cn(
                            'block h-full rounded-full',
                            b.tone === 'leaf'
                              ? 'bg-leaf-500'
                              : b.tone === 'gold'
                                ? 'bg-saffron-500'
                                : 'bg-brand-500',
                          )}
                          style={{ width: `${Math.min(100, funded)}%` }}
                        />
                      </span>
                      <Badge variant={b.tone}>
                        {Math.round(funded)}% {b.word}
                      </Badge>
                    </div>
                  </TD>
                </TR>
              )
            })}
          </TBody>
          <tfoot className="border-t-2 border-line bg-tint/50">
            <TR>
              <TD className="font-medium">All heads</TD>
              <TD className="tabular-nums text-muted">100.0%</TD>
              <TD className="text-right font-medium tabular-nums">{money(totals.target)}</TD>
              <TD className="text-right font-medium tabular-nums">{money(totals.collected)}</TD>
              <TD className="text-right font-medium tabular-nums">{money(totals.spent)}</TD>
              <TD>
                <Badge variant={overall.tone}>{Math.round(overallPct)}% overall</Badge>
              </TD>
            </TR>
          </tfoot>
        </Table>
      </TableWrap>

      <p className="mt-2.5 text-sm leading-relaxed text-muted">
        {reconciles ? (
          <>
            Heads reconcile to the headline figures — {money(totals.target)} approved,{' '}
            {money(totals.collected)} raised, {pct(Math.round(overallPct))} of target.{' '}
            <span className="text-ink-soft">
              Construction repeats the capital projects below; it is the same money counted a second
              way, not a second ask.
            </span>
          </>
        ) : (
          <span className="font-medium text-brand-600">
            Heads do not reconcile to the headline figures — target off by {money(targetVariance)},
            raised off by {money(collectedVariance)}. Rebalance the allocation table before
            publishing.
          </span>
        )}
      </p>
    </div>
  )
}
