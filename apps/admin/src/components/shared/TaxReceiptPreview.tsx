import { useCurrentTemple } from '@saibaba/core'
import { TAX_REGIME_COPY } from './taxRegime'
import { Logo } from './Logo'
import { cn, fmtDate, money } from '@/lib/utils'

export interface ReceiptLine {
  date: string
  description: string
  amount: number
}

/**
 * A tax-regime-aware acknowledgement (US 501(c)(3), India 80G, UK Gift Aid, Canada CRA). Deliberately plain and printable — this is the
 * document a devotee hands to their accountant.
 */
export function TaxReceiptPreview({
  donorName,
  donorAddress,
  receiptNo,
  issuedOn,
  lines,
  year,
  className,
}: {
  donorName: string
  donorAddress?: string
  receiptNo: string
  issuedOn?: string
  lines: ReceiptLine[]
  year?: number
  className?: string
}) {
  const TEMPLE = useCurrentTemple()
  const copy = TAX_REGIME_COPY[TEMPLE.taxRegime]
  const total = lines.reduce((s, l) => s + l.amount, 0)

  return (
    <div
      className={cn(
        'print-area rounded-[var(--radius-lg)] border border-line bg-card p-6 text-base leading-relaxed text-ink',
        className,
      )}
    >
      <header className="flex items-start justify-between gap-4 border-b border-line pb-4">
        <div className="flex items-start gap-3">
          <Logo size={40} />
          <div>
            <p className="font-bold text-lg leading-tight">{TEMPLE.name}</p>
            <p className="text-sm text-muted">
              {[TEMPLE.address, TEMPLE.city, TEMPLE.state, TEMPLE.zip].filter(Boolean).join(', ')}
            </p>
            <p className="text-sm text-muted">
              {TEMPLE.phone} · {TEMPLE.email}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-[0.09em] text-muted">
            {year ? `${year} Contribution Statement` : 'Donation Receipt'}
          </p>
          <p className="mt-1 font-mono text-sm">{receiptNo}</p>
          <p className="text-sm text-muted">Issued {fmtDate(issuedOn ?? new Date())}</p>
        </div>
      </header>

      <section className="grid gap-4 border-b border-line py-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.09em] text-muted">
            Received from
          </p>
          <p className="mt-1 font-medium">{donorName}</p>
          {donorAddress ? <p className="text-sm text-muted">{donorAddress}</p> : null}
        </div>
        <div className="sm:text-right">
          <p className="text-xs font-semibold uppercase tracking-[0.09em] text-muted">
            {TEMPLE.taxIdLabel}
          </p>
          <p className="mt-1 font-mono">{TEMPLE.taxId}</p>
          <p className="text-sm text-muted">{copy.status}</p>
        </div>
      </section>

      <table className="w-full border-collapse py-4 text-left">
        <thead>
          <tr className="border-b border-line">
            <th className="py-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
              Date
            </th>
            <th className="py-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
              Description
            </th>
            <th className="py-2 text-right text-xs font-semibold uppercase tracking-[0.08em] text-muted">
              Amount
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {lines.map((l, i) => (
            <tr key={i}>
              <td className="py-2 whitespace-nowrap text-muted">{fmtDate(l.date)}</td>
              <td className="py-2">{l.description}</td>
              <td className="py-2 text-right tabular-nums">{money(l.amount, true)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-ink/20">
            <td colSpan={2} className="py-2.5 font-medium">
              {copy.total}
            </td>
            <td className="py-2.5 text-right font-bold text-lg tabular-nums">
              {money(total, true)}
            </td>
          </tr>
        </tfoot>
      </table>

      <footer className="mt-2 space-y-2 border-t border-line pt-4 text-xs text-muted">
        <p>
          {copy.legal(TEMPLE.name)}
        </p>
        <p>
          <strong className="text-ink">No goods or services</strong> were provided by the temple in
          exchange for these contributions, other than intangible religious benefits. Retain this
          statement for your records.
        </p>
        <p className="pt-2 italic">Preview only — not a valid tax document. No PDF is generated.</p>
      </footer>
    </div>
  )
}
