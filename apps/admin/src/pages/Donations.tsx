import { useMemo, useState } from 'react'
import { Download, FileCheck2, Landmark, Wand2 } from 'lucide-react'
import {
  currentTemple,
  formatMoney,
  issueReceiptsFor,
  listLedger,
  markPaymentReceived,
  parseBankStatement,
  providerLabel,
  reconcileLines,
  useCurrentTemple,
  useT,
} from '@saibaba/core'
import type { LedgerRow, ReconcileResult } from '@saibaba/core'
import type { User } from '@/lib/data/types'
import { PageShell } from '@/components/layout/PageShell'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { StatTile } from '@/components/shared/StatTile'
import { LoadingSkeleton } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox, Textarea } from '@/components/ui/input'
import { Toolbar, ToolbarDate, ToolbarSelect } from '@/components/admin/Toolbar'
import { Sheet } from '@/components/ui/overlay'
import { useToast } from '@/components/ui/toast'
import { listDevotees } from '@/lib/data/api'
import { DONATION_CATEGORIES, EVENT_BY_ID } from '@/lib/data/mock'
import { useAsync } from '@/lib/hooks'
import { downloadCSV, fmtDate, titleCase } from '@/lib/utils'
import { addTo, formatTotals } from '@/features/giving/money'
import type { Totals } from '@/features/giving/money'

interface Row extends LedgerRow {
  donor?: User
  name: string
}

/** The festival a gift sponsors, and which heads it covers; blank for a plain gift. */
function eventPurpose(d: LedgerRow['donation']) {
  const event = d.eventId ? EVENT_BY_ID.get(d.eventId) : undefined
  if (!event) return ''
  return d.eventItems?.length ? `${event.title} - ${d.eventItems.join(', ')}` : event.title
}

const RECEIPT_BADGE: Record<LedgerRow['receipt'], { label: string; variant: 'leaf' | 'gold' | 'brand' }> = {
  issued: { label: 'Issued', variant: 'leaf' },
  'awaiting-payment': { label: 'Awaiting payment', variant: 'gold' },
  failed: { label: 'Failed', variant: 'brand' },
  'not-issued': { label: 'Not issued', variant: 'gold' },
}

/** A statement built from this ledger, so the demo reconciles against real rows. */
function sampleStatement(rows: Row[], country: string) {
  const dayFirst = country === 'IN' || country === 'GB'
  const d = (iso: string) => {
    const x = new Date(iso)
    const dd = String(x.getDate()).padStart(2, '0')
    const mm = String(x.getMonth() + 1).padStart(2, '0')
    return dayFirst ? `${dd}/${mm}` : `${mm}/${dd}`
  }
  const pick = rows.filter((r) => r.provider && r.provider !== 'cash').slice(0, 3)
  const lines = pick.map(
    (r) =>
      `${d(r.donation.createdAt)}  CREDIT  ${(r.name || 'UNKNOWN').toUpperCase()}  ${r.donation.id}  ${r.donation.amount.toFixed(2)}`,
  )
  lines.push(`${d(new Date().toISOString())}  CREDIT  UNIDENTIFIED SENDER  750.00`)
  return lines.join('\n')
}

export default function Donations() {
  const t = useT()
  const temple = useCurrentTemple()
  const { toast } = useToast()
  const [category, setCategory] = useState('')
  const [provider, setProvider] = useState('')
  const [status, setStatus] = useState('')
  const [receipt, setReceipt] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [reconciling, setReconciling] = useState(false)
  const [statement, setStatement] = useState('')
  const [matches, setMatches] = useState<ReconcileResult[] | null>(null)

  const { data, loading, refresh } = useAsync(
    async () => Promise.all([listLedger(), listDevotees()]),
    [temple.id],
  )

  const allRows = useMemo<Row[]>(() => {
    if (!data) return []
    const [ledger, devotees] = data
    const byId = new Map(devotees.map((d) => [d.id, d]))
    return ledger.map((r) => {
      const donor = r.donation.userId ? byId.get(r.donation.userId) : undefined
      const c = r.donation.donor
      return {
        ...r,
        donor,
        name: donor?.name ?? (c ? `${c.firstName} ${c.lastName}`.trim() : r.payerName),
      }
    })
  }, [data])

  const rows = useMemo(
    () =>
      allRows
        .filter((r) => (category ? r.donation.category === category : true))
        .filter((r) => (provider ? r.provider === provider : true))
        .filter((r) => (status ? r.status === status : true))
        .filter((r) => (receipt ? r.receipt === receipt : true))
        .filter((r) => (from ? r.donation.createdAt >= new Date(from).toISOString() : true))
        .filter((r) => (to ? r.donation.createdAt <= new Date(`${to}T23:59:59`).toISOString() : true)),
    [allRows, category, provider, status, receipt, from, to],
  )

  const providers = useMemo(
    () => [...new Set(allRows.map((r) => r.provider).filter((p): p is NonNullable<typeof p> => Boolean(p)))],
    [allRows],
  )

  // Per-currency figures: amounts in different currencies are never added together.
  const { totals, fees, averages } = useMemo(() => {
    let tt: Totals = {}
    let ff: Totals = {}
    const counts: Partial<Record<string, number>> = {}
    for (const r of rows) {
      if (r.status === 'failed') continue
      tt = addTo(tt, r.currency, r.donation.amount)
      ff = addTo(ff, r.currency, r.fee)
      counts[r.currency] = (counts[r.currency] ?? 0) + 1
    }
    const avg: Totals = {}
    for (const c of Object.keys(tt) as (keyof Totals)[]) avg[c] = Math.round((tt[c] ?? 0) / (counts[c] ?? 1))
    return { totals: tt, fees: ff, averages: avg }
  }, [rows])

  const pendingPayments = rows.filter((r) => r.status === 'pending').length
  const pendingReceipts = rows.filter((r) => r.receipt === 'not-issued').length

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const generateReceipts = async () => {
    const ids =
      selected.size > 0
        ? [...selected]
        : rows.filter((r) => r.receipt === 'not-issued').map((r) => r.donation.id)
    const { issued, skipped } = await issueReceiptsFor(ids)
    toast(t('giving.admin.issued', '{n} receipt(s) issued', { n: issued.length }), {
      detail: skipped
        ? t('giving.admin.skipped', '{n} skipped: payment not yet received.', { n: skipped })
        : t('giving.admin.issuedDetail', 'Each receipt follows the temple’s tax regime.'),
    })
    setSelected(new Set())
    refresh()
  }

  const receive = async (r: Row, reference?: string) => {
    const rc = await markPaymentReceived(r.donation.id, { reference })
    toast(t('giving.admin.received', 'Payment marked received'), {
      detail: rc ? t('giving.admin.receiptNo', 'Receipt {no} issued.', { no: rc.number }) : undefined,
    })
    refresh()
  }

  const runMatch = () => {
    const lines = parseBankStatement(statement, currentTemple().country)
    setMatches(reconcileLines(lines, allRows, { nameOf: (r) => (r as Row).name }))
  }

  const columns: Column<Row>[] = [
    {
      key: 'select',
      header: '',
      cell: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selected.has(r.donation.id)}
            onChange={() => toggle(r.donation.id)}
            aria-label={`Select donation ${r.donation.id}`}
          />
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      sortValue: (r) => r.donation.createdAt,
      cell: (r) => <span className="whitespace-nowrap text-muted">{fmtDate(r.donation.createdAt)}</span>,
    },
    {
      key: 'donor',
      header: 'Donor',
      sortValue: (r) => r.name || 'Anonymous',
      cell: (r) =>
        r.name ? (
          <span className="font-medium text-ink">{r.name}</span>
        ) : (
          <span className="italic text-muted">Anonymous</span>
        ),
    },
    {
      key: 'category',
      header: 'Fund',
      sortValue: (r) => r.donation.category,
      cell: (r) => (
        <div className="min-w-0">
          <span>
            {titleCase(r.donation.category)}
            {r.donation.isRecurring ? (
              <Badge variant="gold" className="ml-2">
                {titleCase(r.donation.recurringCadence ?? 'recurring')}
              </Badge>
            ) : null}
          </span>
          {eventPurpose(r.donation) ? (
            <p className="max-w-[30ch] truncate text-sm text-muted">{eventPurpose(r.donation)}</p>
          ) : null}
          {r.employer ? <p className="text-sm text-muted">Match: {r.employer}</p> : null}
        </div>
      ),
    },
    {
      key: 'provider',
      header: 'Provider',
      sortValue: (r) => r.provider ?? r.donation.paymentMethod,
      cell: (r) => (
        <div>
          <span>{r.provider ? providerLabel(r.provider) : titleCase(r.donation.paymentMethod)}</span>
          {r.status !== 'succeeded' ? (
            <Badge variant={r.status === 'failed' ? 'brand' : 'gold'} className="ml-2">
              {r.status === 'failed' ? 'Failed' : 'Pending'}
            </Badge>
          ) : null}
        </div>
      ),
    },
    {
      key: 'currency',
      header: 'Cur.',
      sortValue: (r) => r.currency,
      cell: (r) => <span className="font-mono text-xs text-muted">{r.currency}</span>,
    },
    {
      key: 'fee',
      header: 'Fee',
      sortValue: (r) => r.fee,
      align: 'right',
      cell: (r) => (
        <span className="tabular-nums text-muted">
          {r.fee > 0 ? formatMoney(r.fee, r.currency, { cents: true }) : '—'}
        </span>
      ),
    },
    {
      key: 'receipt',
      header: 'Receipt',
      sortValue: (r) => r.receipt,
      align: 'center',
      // A missing receipt is work outstanding, which is the whole reason this column is
      // on the page, so the states are named rather than coded.
      cell: (r) => <Badge variant={RECEIPT_BADGE[r.receipt].variant}>{RECEIPT_BADGE[r.receipt].label}</Badge>,
    },
    {
      key: 'amount',
      header: 'Amount',
      sortValue: (r) => r.donation.amount,
      align: 'right',
      cell: (r) => (
        <span className="font-medium tabular-nums">{formatMoney(r.donation.amount, r.currency)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (r) =>
        r.status === 'pending' ? (
          <div onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="ghost" onClick={() => receive(r)}>
              Mark received
            </Button>
          </div>
        ) : null,
    },
  ]

  const exportCSV = () =>
    downloadCSV(
      `donations-${temple.slug}.csv`,
      rows.map((r) => ({
        Id: r.donation.id,
        Date: fmtDate(r.donation.createdAt, 'yyyy-MM-dd'),
        Donor: r.name || 'Anonymous',
        Fund: titleCase(r.donation.category),
        Festival: r.donation.eventId ? (EVENT_BY_ID.get(r.donation.eventId)?.title ?? '') : '',
        Sponsored: r.donation.eventItems?.join('; ') ?? '',
        Currency: r.currency,
        Amount: r.donation.amount,
        Fee: r.fee,
        Provider: r.provider ?? r.donation.paymentMethod,
        Status: r.status,
        Recurring: r.donation.isRecurring ? r.donation.recurringCadence : 'No',
        Receipt: r.receipt,
        Reference: r.reference ?? '',
        Employer: r.employer ?? '',
      })),
    )

  const toolbar = (
    <Toolbar
      activeCount={[category, provider, status, receipt, from, to].filter(Boolean).length}
      onClear={() => {
        setCategory('')
        setProvider('')
        setStatus('')
        setReceipt('')
        setFrom('')
        setTo('')
      }}
    >
      <ToolbarSelect value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by fund">
        <option value="">All funds</option>
        {DONATION_CATEGORIES.map((c) => (
          <option key={c.key} value={c.key}>
            {c.label}
          </option>
        ))}
      </ToolbarSelect>
      <ToolbarSelect value={provider} onChange={(e) => setProvider(e.target.value)} aria-label="Filter by provider">
        <option value="">All providers</option>
        {providers.map((p) => (
          <option key={p} value={p}>
            {providerLabel(p)}
          </option>
        ))}
      </ToolbarSelect>
      <ToolbarSelect value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by payment status">
        <option value="">Any payment status</option>
        <option value="succeeded">Received</option>
        <option value="pending">Pending</option>
        <option value="failed">Failed</option>
      </ToolbarSelect>
      <ToolbarSelect value={receipt} onChange={(e) => setReceipt(e.target.value)} aria-label="Filter by receipt status">
        <option value="">Any receipt status</option>
        <option value="issued">Issued</option>
        <option value="not-issued">Not issued</option>
        <option value="awaiting-payment">Awaiting payment</option>
      </ToolbarSelect>
      <ToolbarDate label="From" value={from} onChange={(e) => setFrom(e.target.value)} />
      <ToolbarDate label="To" value={to} onChange={(e) => setTo(e.target.value)} />
    </Toolbar>
  )

  return (
    <PageShell
      toolbar={toolbar}
      eyebrow="Money"
      title={t('giving.admin.ledger', 'Donation ledger')}
      description={`${temple.name} · ${rows.length} entries · ${formatTotals(totals, formatMoney(0, temple.currency))} recorded`}
      actions={
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatement(sampleStatement(allRows, temple.country))
              setMatches(null)
              setReconciling(true)
            }}
          >
            <Landmark />
            Reconcile bank
          </Button>
          <Button variant="ghost" size="sm" onClick={exportCSV} disabled={rows.length === 0}>
            <Download />
            Export CSV
          </Button>
          <Button size="sm" onClick={generateReceipts} disabled={pendingReceipts === 0 && selected.size === 0}>
            <FileCheck2 />
            Issue receipts
            {selected.size > 0 ? ` (${selected.size})` : ''}
          </Button>
        </>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Total donations"
          value={<span className="text-[0.8em]">{formatTotals(totals, formatMoney(0, temple.currency))}</span>}
          sub={`${rows.length} gifts · per currency`}
          tone="leaf"
        />
        <StatTile
          label="Processing fees"
          value={<span className="text-[0.8em]">{formatTotals(fees, formatMoney(0, temple.currency))}</span>}
          sub="Estimated, in this view"
          tone="gold"
        />
        <StatTile
          label="Awaiting payment"
          value={pendingPayments}
          sub="Manual gifts to match"
          tone={pendingPayments ? 'brand' : 'default'}
        />
        <StatTile
          label="Average gift"
          value={<span className="text-[0.8em]">{formatTotals(averages, formatMoney(0, temple.currency))}</span>}
          sub="Per currency, filtered set"
        />
      </div>

      {loading ? (
        <LoadingSkeleton variant="table" rows={10} />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(r) => r.donation.id}
          initialSort={{ key: 'date', dir: 'desc' }}
          empty={{
            title: 'No donations match',
            detail: 'Clear a filter, or switch temple, to widen the ledger view.',
          }}
        />
      )}

      <Sheet
        open={reconciling}
        onClose={() => setReconciling(false)}
        title="Reconcile bank statement"
        description="Paste lines from the bank export. Lines are matched on amount, reference, payer name and a five-day date window."
        className="max-w-xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setReconciling(false)}>
              Close
            </Button>
            <Button onClick={runMatch}>
              <Wand2 />
              Auto-match
            </Button>
          </>
        }
      >
        <Textarea
          rows={8}
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
          className="font-mono text-sm"
          aria-label="Bank statement lines"
        />

        {matches ? (
          <div className="mt-4">
            <p className="eyebrow mb-2">
              Match results: {matches.filter((m) => m.matched).length} of {matches.length} matched
            </p>
            <ul className="space-y-2">
              {matches.map((m, i) => {
                const row = m.matched as Row | undefined
                return (
                  <li key={i} className="rounded-lg border border-line p-3">
                    <p className="font-mono text-xs text-muted">{m.line.raw}</p>
                    {row ? (
                      <div className="mt-1.5 space-y-1.5">
                        <p className="flex flex-wrap items-center gap-2 text-base">
                          <Badge variant={m.confidence === 'high' ? 'leaf' : m.confidence === 'medium' ? 'gold' : 'brand'}>
                            {m.confidence === 'high' ? 'Matched' : m.confidence === 'medium' ? 'Likely' : 'Possible'}
                          </Badge>
                          <span className="font-medium">{row.name || 'Anonymous'}</span>
                          <span className="text-muted">
                            {titleCase(row.donation.category)} · {fmtDate(row.donation.createdAt)} · {row.donation.id}
                          </span>
                        </p>
                        <p className="text-sm text-muted">Matched on {m.reasons.join(', ')}.</p>
                        {row.status === 'pending' ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              await receive(row, m.line.raw.slice(0, 60))
                              setMatches((cur) =>
                                cur
                                  ? cur.map((x, j) =>
                                      j === i && x.matched ? { ...x, matched: { ...x.matched, status: 'succeeded' } } : x,
                                    )
                                  : cur,
                              )
                            }}
                          >
                            Mark received and issue receipt
                          </Button>
                        ) : (
                          <p className="text-sm text-leaf-600">Already received.</p>
                        )}
                      </div>
                    ) : (
                      <p className="mt-1.5 flex items-center gap-2 text-base">
                        <Badge variant="brand">Unmatched</Badge>
                        <span className="text-muted">
                          No ledger entry for {formatMoney(m.line.amount, temple.currency)}: needs manual entry.
                        </span>
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}
      </Sheet>
    </PageShell>
  )
}
