import { useCurrentTemple, regimeConfig, formatMoney, useT } from '@saibaba/core'
import type { AnnualStatement, GivingReceipt } from '@saibaba/core'
import { ReceiptView, StatementView } from '@/features/giving/components/ReceiptView'
import { Logo } from './Logo'
import { cn, fmtDate } from '@/lib/utils'

export interface ReceiptLine {
  date: string
  description: string
  amount: number
}

/**
 * A tax-shaped acknowledgement, in the current temple's regime. Deliberately plain and
 * printable: this is the document a devotee hands to their accountant.
 *
 * Pass a built `receipt` or `statement` (from the giving slice) for the regime-exact
 * document; the loose `lines` form stays for callers that only have line items, and is
 * rendered in the current temple's regime and currency.
 */
export function TaxReceiptPreview({
  receipt,
  statement,
  donorName = '',
  donorAddress,
  receiptNo = '',
  issuedOn,
  lines = [],
  year,
  className,
}: {
  receipt?: GivingReceipt
  statement?: AnnualStatement
  donorName?: string
  donorAddress?: string
  receiptNo?: string
  issuedOn?: string
  lines?: ReceiptLine[]
  year?: number
  className?: string
}) {
  const t = useT()
  const temple = useCurrentTemple()
  if (receipt) return <ReceiptView receipt={receipt} className={className} />
  if (statement) return <StatementView statement={statement} className={className} />

  const cfg = regimeConfig(temple.taxRegime)
  const money = (n: number) => formatMoney(n, temple.currency, { cents: !Number.isInteger(n) })
  const total = lines.reduce((s, l) => s + l.amount, 0)

  return (
    <div
      className={cn(
        'print-area rounded-[10px] border border-line bg-card p-6 text-[13px] leading-relaxed text-ink',
        className,
      )}
    >
      <header className="flex items-start justify-between gap-4 border-b border-line pb-4">
        <div className="flex items-start gap-3">
          <Logo size={40} />
          <div>
            <p className="font-serif text-[18px] leading-tight">{temple.name}</p>
            <p className="text-[12px] text-muted">
              {temple.address}, {temple.city}, {temple.state} {temple.zip}
            </p>
            <p className="text-[12px] text-muted">
              {temple.phone} · {temple.email}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted">
            {year ? `${year} ${cfg.annualTitle}` : cfg.receiptTitle}
          </p>
          <p className="mt-1 font-mono text-[12px]">{receiptNo}</p>
          <p className="text-[12px] text-muted">
            {t('giving.receipt.issued', 'Issued')} {fmtDate(issuedOn ?? new Date())}
          </p>
        </div>
      </header>

      <section className="grid gap-4 border-b border-line py-4 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted">
            {t('giving.receipt.from', 'Received from')}
          </p>
          <p className="mt-1 font-medium">{donorName}</p>
          {donorAddress ? <p className="text-[12.5px] text-muted">{donorAddress}</p> : null}
        </div>
        <div className="sm:text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted">
            {temple.taxIdLabel}
          </p>
          <p className="mt-1 font-mono">{temple.taxId}</p>
          <p className="text-[12px] text-muted">{cfg.label}</p>
        </div>
      </section>

      <table className="w-full border-collapse py-4 text-left">
        <thead>
          <tr className="border-b border-line">
            <th className="py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              {t('giving.receipt.date', 'Date')}
            </th>
            <th className="py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              {t('giving.receipt.description', 'Description')}
            </th>
            <th className="py-2 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              {t('giving.receipt.amount', 'Amount')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {lines.map((l, i) => (
            <tr key={i}>
              <td className="py-2 whitespace-nowrap text-muted">{fmtDate(l.date)}</td>
              <td className="py-2">{l.description}</td>
              <td className="py-2 text-right tabular-nums">{money(l.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-ink/20">
            <td colSpan={2} className="py-2.5 font-medium">
              {t('giving.receipt.total', 'Total contribution')}
            </td>
            <td className="py-2.5 text-right font-serif text-[18px] tabular-nums">{money(total)}</td>
          </tr>
        </tfoot>
      </table>

      <footer className="mt-2 space-y-2 border-t border-line pt-4 text-[11.5px] text-muted">
        {cfg.wording.map((w, i) => (
          <p key={i}>{w}</p>
        ))}
      </footer>
    </div>
  )
}
