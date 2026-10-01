import type { PujaPnLRow } from '@/lib/data/types'
import { Badge } from '@/components/ui/badge'
import { Table, TBody, TD, TH, THead, TR, TableWrap } from '@/components/ui/table'
import { cn, money, titleCase } from '@/lib/utils'

/**
 * The temple's table. Margin is shown as a labelled badge rather than a colour-only
 * cue, so the "which pujas actually pay for themselves" question survives print,
 * greyscale and colour-blind readers.
 */
export function PnLTable({ rows, className }: { rows: PujaPnLRow[]; className?: string }) {
  const totals = rows.reduce(
    (acc, r) => ({
      sponsors: acc.sponsors + r.sponsors,
      collected: acc.collected + r.collected,
      cost: acc.cost + r.cost,
      net: acc.net + r.net,
    }),
    { sponsors: 0, collected: 0, cost: 0, net: 0 },
  )

  return (
    <TableWrap className={className}>
      <Table>
        <THead>
          <TR>
            <TH>Puja</TH>
            <TH className="text-right">Sponsors</TH>
            <TH className="text-right">Collected</TH>
            <TH className="text-right">Expenses</TH>
            <TH className="text-right">Net</TH>
            <TH>Margin</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((r) => {
            // A 40% margin on a puja is a good result for a temple, not a warning. Bands:
            // healthy at 20%+, thin below that, under water only when it actually loses money.
            const healthy = r.progressPct >= 20
            const thin = r.net >= 0 && r.progressPct < 20
            return (
              <TR key={r.puja.id} className="hover:bg-tint/40">
                <TD>
                  <p className="font-medium text-ink">{r.puja.name}</p>
                  <p className="text-sm text-muted">
                    {r.puja.deity} · {titleCase(r.puja.type)}
                  </p>
                </TD>
                <TD className="text-right tabular-nums">{r.sponsors}</TD>
                <TD className="text-right tabular-nums">{money(r.collected)}</TD>
                <TD className="text-right tabular-nums text-muted">{money(r.cost)}</TD>
                <TD
                  className={cn(
                    'text-right font-medium tabular-nums',
                    r.net < 0 ? 'text-brand-600' : 'text-ink',
                  )}
                >
                  {money(r.net)}
                </TD>
                <TD>
                  {/* A bar as well as a badge: margin is a magnitude, and twelve badges
                      in a column give no sense of which puja is carrying the others. */}
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-line/70">
                      <span
                        className={cn(
                          'block h-full rounded-full',
                          healthy ? 'bg-leaf-500' : thin ? 'bg-saffron-500' : 'bg-brand-500',
                        )}
                        style={{ width: `${Math.min(100, Math.abs(r.progressPct))}%` }}
                      />
                    </span>
                    <Badge variant={healthy ? 'leaf' : thin ? 'gold' : 'brand'}>
                      {r.progressPct}% {healthy ? 'healthy' : thin ? 'thin' : 'under water'}
                    </Badge>
                  </div>
                </TD>
              </TR>
            )
          })}
        </TBody>
        <tfoot className="border-t-2 border-line bg-tint/50">
          <TR>
            <TD className="font-medium">All pujas</TD>
            <TD className="text-right font-medium tabular-nums">{totals.sponsors}</TD>
            <TD className="text-right font-medium tabular-nums">{money(totals.collected)}</TD>
            <TD className="text-right font-medium tabular-nums">{money(totals.cost)}</TD>
            <TD className="text-right font-medium tabular-nums">{money(totals.net)}</TD>
            <TD>
              <Badge variant={totals.net >= 0 ? 'leaf' : 'brand'}>
                {totals.collected ? Math.round((totals.net / totals.collected) * 100) : 0}% overall
              </Badge>
            </TD>
          </TR>
        </tfoot>
      </Table>
    </TableWrap>
  )
}
