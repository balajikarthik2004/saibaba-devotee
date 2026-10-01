import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import {
  amountInWordsFull,
  downloadBlob,
  formatMoney,
  providerLabel,
  receiptFilename,
  regimeConfig,
  renderAnnualStatementPdf,
  renderReceiptPdf,
  statementFilename,
  useT,
} from '@saibaba/core'
import type { AnnualStatement, GivingReceipt } from '@saibaba/core'
import { Logo } from '@/components/shared/Logo'
import { Button } from '@/components/ui/button'
import { cn, fmtDate } from '@/lib/utils'

const LABEL = 'text-[11px] font-semibold uppercase tracking-[0.09em] text-muted'

function Head({
  name,
  address,
  title,
  number,
  date,
  phone,
  email,
}: {
  name: string
  address: string
  title: string
  number: string
  date: string
  phone?: string
  email?: string
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
      <div className="flex items-start gap-3">
        <Logo size={40} />
        <div>
          <p className="font-serif text-[18px] leading-tight">{name}</p>
          <p className="text-[12px] text-muted">{address}</p>
          {phone || email ? (
            <p className="text-[12px] text-muted">{[phone, email].filter(Boolean).join(' · ')}</p>
          ) : null}
        </div>
      </div>
      <div className="text-right">
        <p className={LABEL}>{title}</p>
        <p className="mt-1 font-mono text-[12px]">{number}</p>
        <p className="text-[12px] text-muted">{date}</p>
      </div>
    </header>
  )
}

/** A receipt in its temple's tax regime, as it appears on screen and in the PDF. */
export function ReceiptView({ receipt: r, className }: { receipt: GivingReceipt; className?: string }) {
  const t = useT()
  const cfg = regimeConfig(r.regime)
  const money = (n: number) => formatMoney(n, r.currency, { cents: !Number.isInteger(n) })
  const facts: [string, string][] = []
  if (r.regime === 'in-80g') {
    facts.push(['80G registration no.', r.regNo ?? r.taxId], ['Donor PAN', r.donorPan ?? 'Not provided'])
    if (r.provider) facts.push(['Mode of payment', providerLabel(r.provider)])
  }
  if (r.regime === 'ca-cra') {
    facts.push(
      ['Place issued', r.placeIssued ?? ''],
      ['Eligible amount of gift', money(r.eligibleAmount ?? r.amount)],
      ['Advantage', money(r.advantage ?? 0)],
    )
  }
  if (r.regime === 'uk-giftaid') {
    facts.push(['Gift Aid', r.giftAidClaimed ? 'Declared' : 'Not declared'])
    if (r.giftAidClaimed && r.giftAidUplift) facts.push(['Estimated Gift Aid claim', money(r.giftAidUplift)])
  }
  if (r.employer) facts.push(['Employer matching', `Requested from ${r.employer}`])

  return (
    <div
      className={cn(
        'print-area rounded-[10px] border border-line bg-card p-5 text-[13px] leading-relaxed text-ink sm:p-6',
        className,
      )}
    >
      <Head
        name={r.templeName}
        address={r.templeAddress}
        phone={r.templePhone}
        email={r.templeEmail}
        title={cfg.receiptTitle}
        number={r.number}
        date={`${t('giving.receipt.date', 'Date')} ${fmtDate(r.issuedAt)}`}
      />

      <section className="grid gap-4 border-b border-line py-4 sm:grid-cols-2">
        <div>
          <p className={LABEL}>{t('giving.receipt.from', 'Received from')}</p>
          <p className="mt-1 font-medium">{r.donorName}</p>
          {r.donorAddress ? <p className="text-[12.5px] text-muted">{r.donorAddress}</p> : null}
        </div>
        <div className="sm:text-right">
          <p className={LABEL}>{r.taxIdLabel}</p>
          <p className="mt-1 font-mono">{r.taxId}</p>
          <p className="text-[12px] text-muted">{cfg.label}</p>
        </div>
      </section>

      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-line">
            <th className={cn(LABEL, 'py-2')}>{t('giving.receipt.description', 'Description')}</th>
            <th className={cn(LABEL, 'py-2 text-right')}>{t('giving.receipt.amount', 'Amount')}</th>
          </tr>
        </thead>
        <tbody>
          {r.lines.map((l, i) => (
            <tr key={i} className="border-b border-line">
              <td className="py-2">{l.description}</td>
              <td className="py-2 text-right tabular-nums">{money(l.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="py-2.5 font-medium">{t('giving.receipt.total', 'Total contribution')}</td>
            <td className="py-2.5 text-right font-serif text-[18px] tabular-nums">{money(r.amount)}</td>
          </tr>
        </tfoot>
      </table>
      {r.regime === 'in-80g' ? (
        <p className="text-[12px] text-muted">{amountInWordsFull(r.amount, r.currency)}</p>
      ) : null}

      {facts.length ? (
        <dl className="mt-3 grid gap-x-4 gap-y-1 border-t border-line pt-3 text-[12.5px] sm:grid-cols-[auto_1fr]">
          {facts.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {r.status === 'pending' ? (
        <p className="mt-3 rounded-md bg-saffron-400/15 p-2.5 text-[12.5px] font-medium text-brand-700">
          {t('giving.receipt.pending', 'Awaiting payment. This receipt becomes valid once the temple receives your payment.')}
        </p>
      ) : null}

      <footer className="mt-3 space-y-2 border-t border-line pt-3 text-[11.5px] text-muted">
        {r.declarations.map((d, i) => (
          <p key={i}>{d}</p>
        ))}
      </footer>
    </div>
  )
}

/** A year-end statement for one temple and currency. */
export function StatementView({ statement: s, className }: { statement: AnnualStatement; className?: string }) {
  const t = useT()
  const cfg = regimeConfig(s.regime)
  const money = (n: number) => formatMoney(n, s.currency, { cents: !Number.isInteger(n) })
  return (
    <div
      className={cn(
        'print-area rounded-[10px] border border-line bg-card p-5 text-[13px] leading-relaxed text-ink sm:p-6',
        className,
      )}
    >
      <Head
        name={s.templeName}
        address={s.templeAddress}
        title={`${s.year} ${cfg.annualTitle}`}
        number={s.number}
        date={fmtDate(new Date())}
      />
      <section className="grid gap-4 border-b border-line py-4 sm:grid-cols-2">
        <div>
          <p className={LABEL}>{t('giving.statement.donor', 'Donor')}</p>
          <p className="mt-1 font-medium">{s.donorName}</p>
          {s.donorAddress ? <p className="text-[12.5px] text-muted">{s.donorAddress}</p> : null}
          {s.regime === 'in-80g' ? (
            <p className="text-[12.5px] text-muted">PAN: {s.donorPan ?? 'not provided'}</p>
          ) : null}
        </div>
        <div className="sm:text-right">
          <p className={LABEL}>{s.taxIdLabel}</p>
          <p className="mt-1 font-mono">{s.taxId}</p>
        </div>
      </section>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              <th className={cn(LABEL, 'py-2')}>{t('giving.receipt.date', 'Date')}</th>
              <th className={cn(LABEL, 'py-2')}>{t('giving.receipt.description', 'Description')}</th>
              <th className={cn(LABEL, 'py-2 text-right')}>{t('giving.receipt.amount', 'Amount')}</th>
            </tr>
          </thead>
          <tbody>
            {s.lines.map((l, i) => (
              <tr key={i} className="border-b border-line align-top">
                <td className="whitespace-nowrap py-2 pr-3 text-muted">{fmtDate(l.date)}</td>
                <td className="py-2 pr-3">
                  {l.description}
                  {l.receiptNo ? <span className="block font-mono text-[11px] text-muted">{l.receiptNo}</span> : null}
                </td>
                <td className="py-2 text-right tabular-nums">{money(l.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} className="py-2.5 font-medium">
                {t('giving.statement.total', 'Total for {year}', { year: s.year })}
              </td>
              <td className="py-2.5 text-right font-serif text-[18px] tabular-nums">{money(s.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <footer className="mt-3 space-y-2 border-t border-line pt-3 text-[11.5px] text-muted">
        {cfg.wording.map((w, i) => (
          <p key={i}>{w}</p>
        ))}
      </footer>
    </div>
  )
}

/** Renders the PDF on demand (jsPDF is lazy-loaded) and downloads it. */
export function DownloadPdfButton({
  receipt,
  statement,
  label,
  variant = 'default',
  size = 'sm',
  className,
}: {
  receipt?: GivingReceipt
  statement?: AnnualStatement
  label?: string
  variant?: 'default' | 'ghost' | 'outline' | 'subtle'
  size?: 'sm' | 'default'
  className?: string
}) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const go = async () => {
    // A server-issued PDF, when there is one, beats rendering our own.
    if (receipt?.pdfUrl) {
      window.open(receipt.pdfUrl, '_blank', 'noopener')
      return
    }
    setBusy(true)
    try {
      if (receipt) downloadBlob(await renderReceiptPdf(receipt), receiptFilename(receipt))
      else if (statement) downloadBlob(await renderAnnualStatementPdf(statement), statementFilename(statement))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button variant={variant} size={size} className={className} onClick={go} disabled={busy || (!receipt && !statement)}>
      {busy ? <Loader2 className="animate-spin" /> : <Download />}
      {label ?? t('giving.pdf.download', 'Download PDF')}
    </Button>
  )
}
