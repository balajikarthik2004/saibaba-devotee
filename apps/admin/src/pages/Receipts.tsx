import { useMemo, useState } from 'react'
import { Download, FileCheck2, FileText, Loader2, Mail, Printer } from 'lucide-react'
import {
  buildAnnualStatements,
  downloadBlob,
  emailReceipt,
  findIssuedReceipt,
  formatMoney,
  guestDonorKey,
  issueReceipt,
  listLedger,
  receiptDonorFor,
  receiptFilename,
  regimeConfig,
  renderAnnualStatementPdf,
  renderReceiptPdf,
  statementFilename,
  useCurrentTemple,
  useT,
} from '@saibaba/core'
import type { AnnualStatement, GivingReceipt, LedgerRow } from '@saibaba/core'
import type { User } from '@/lib/data/types'
import { PageShell } from '@/components/layout/PageShell'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { StatTile } from '@/components/shared/StatTile'
import { EmptyState, LoadingSkeleton } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/input'
import { Tabs } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/toast'
import { listDevotees } from '@/lib/data/api'
import { useAsync } from '@/lib/hooks'
import { downloadCSV, fmtDate, titleCase } from '@/lib/utils'
import { ReceiptView, StatementView } from '@/features/giving/components/ReceiptView'

interface GiftRow extends LedgerRow {
  name: string
  email: string
  donor?: User
}

interface StatementRow {
  key: string
  name: string
  email: string
  statement: AnnualStatement
}

type Preview =
  | { kind: 'receipt'; receipt: GivingReceipt; email: string }
  | { kind: 'statement'; statement: AnnualStatement; email: string }

/**
 * Issues receipts in the current temple's tax regime: one per gift, and one annual
 * statement per donor. PDFs are rendered in the browser (jsPDF, lazy-loaded); "send by
 * email" is a mock notification that records the message and sends nothing.
 */
export default function Receipts() {
  const t = useT()
  const temple = useCurrentTemple()
  const cfg = regimeConfig(temple.taxRegime)
  const { toast } = useToast()
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  const [tab, setTab] = useState<'gifts' | 'statements'>('gifts')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [tick, bump] = useState(0)

  const { data, loading, refresh } = useAsync(
    async () => Promise.all([listLedger(), listDevotees()]),
    [temple.id],
  )

  const gifts = useMemo<GiftRow[]>(() => {
    if (!data) return []
    const [ledger, devotees] = data
    const byId = new Map(devotees.map((d) => [d.id, d]))
    return ledger
      .filter((r) => r.status === 'succeeded' && new Date(r.donation.createdAt).getFullYear() === year)
      .map((r) => {
        const donor = r.donation.userId ? byId.get(r.donation.userId) : undefined
        const c = r.donation.donor
        return {
          ...r,
          donor,
          name: donor?.name ?? (c ? `${c.firstName} ${c.lastName}`.trim() : r.payerName || 'Anonymous'),
          email: donor?.email ?? c?.email ?? '',
        }
      })
  }, [data, year])

  const statements = useMemo<StatementRow[]>(() => {
    const groups = new Map<string, GiftRow[]>()
    for (const g of gifts) {
      const k = g.donation.userId ?? guestDonorKey(g.email || g.name)
      groups.set(k, [...(groups.get(k) ?? []), g])
    }
    const out: StatementRow[] = []
    for (const [key, list] of groups) {
      const first = list[0]!
      const built = buildAnnualStatements({
        year,
        templeId: temple.id,
        donations: list.map((g) => g.donation),
        donor: {
          userId: first.donation.userId,
          name: first.name,
          email: first.email,
          address: first.donor?.address
            ? `${first.donor.address}, ${first.donor.city ?? ''} ${first.donor.zip ?? ''}`.trim()
            : undefined,
        },
      })
      for (const s of built) out.push({ key: `${key}|${s.currency}`, name: first.name, email: first.email, statement: s })
    }
    return out.sort((a, b) => b.statement.total - a.statement.total)
    // `tick` re-runs this after receipts are issued (numbers appear on the lines).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gifts, year, temple.id, tick])

  const years = Array.from({ length: 5 }, (_, i) => thisYear - i)
  const issuedCount = gifts.filter((g) => findIssuedReceipt(g.donation.id)).length
  const toIssue = gifts.filter((g) => !findIssuedReceipt(g.donation.id))

  // Per-currency total of the year's received gifts.
  const total = gifts.reduce((s, g) => s + g.donation.amount, 0)

  const issue = async (g: GiftRow, open = true) => {
    const r = issueReceipt(
      { kind: 'donation', donation: g.donation },
      temple,
      await receiptDonorFor(g.donation, temple),
    )
    bump((n) => n + 1)
    if (r && open) setPreview({ kind: 'receipt', receipt: r, email: g.email })
    return r
  }

  const issueAll = async () => {
    setBusy('issue')
    let n = 0
    for (const g of toIssue) if (await issue(g, false)) n++
    setBusy(null)
    toast(`${n} receipt${n === 1 ? '' : 's'} issued`, { detail: `In ${cfg.label} format.` })
    refresh()
  }

  const downloadAllReceipts = async () => {
    setBusy('dl')
    try {
      // Sequential on purpose: browsers block a burst of simultaneous downloads.
      for (const g of gifts) {
        const r = findIssuedReceipt(g.donation.id)
        if (!r) continue
        downloadBlob(await renderReceiptPdf(r), receiptFilename(r))
        await new Promise((res) => setTimeout(res, 400))
      }
    } finally {
      setBusy(null)
    }
  }

  const downloadPdf = async (p: Preview) => {
    setBusy('pdf')
    try {
      if (p.kind === 'receipt') downloadBlob(await renderReceiptPdf(p.receipt), receiptFilename(p.receipt))
      else downloadBlob(await renderAnnualStatementPdf(p.statement), statementFilename(p.statement))
    } finally {
      setBusy(null)
    }
  }

  const sendEmail = async (p: Preview) => {
    if (!p.email) {
      toast('No email address on file', { tone: 'warn', detail: 'This donor gave no email.' })
      return
    }
    setBusy('mail')
    const number = p.kind === 'receipt' ? p.receipt.number : p.statement.number
    const receipt =
      p.kind === 'receipt'
        ? p.receipt
        : ({ number, templeName: p.statement.templeName } as GivingReceipt)
    await emailReceipt(receipt, p.email)
    setBusy(null)
    toast('Email queued', { detail: `${number} sent to ${p.email}.` })
  }

  const giftColumns: Column<GiftRow>[] = [
    {
      key: 'date',
      header: 'Date',
      sortValue: (r) => r.donation.createdAt,
      cell: (r) => <span className="whitespace-nowrap text-muted">{fmtDate(r.donation.createdAt)}</span>,
    },
    {
      key: 'name',
      header: 'Donor',
      sortValue: (r) => r.name,
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{r.name}</p>
          <p className="truncate text-sm text-muted">{r.email || 'No email'}</p>
        </div>
      ),
    },
    {
      key: 'fund',
      header: 'Fund',
      sortValue: (r) => r.donation.category,
      cell: (r) => titleCase(r.donation.category),
    },
    {
      key: 'amount',
      header: 'Amount',
      sortValue: (r) => r.donation.amount,
      align: 'right',
      cell: (r) => <span className="font-medium tabular-nums">{formatMoney(r.donation.amount, r.currency)}</span>,
    },
    {
      key: 'receipt',
      header: 'Receipt',
      sortValue: (r) => findIssuedReceipt(r.donation.id)?.number ?? '',
      cell: (r) => {
        const rc = findIssuedReceipt(r.donation.id)
        return rc ? (
          <span className="font-mono text-xs">{rc.number}</span>
        ) : (
          <Badge variant="gold">Not issued</Badge>
        )
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (r) => {
        const rc = findIssuedReceipt(r.donation.id)
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                rc ? setPreview({ kind: 'receipt', receipt: rc, email: r.email }) : void issue(r)
              }
            >
              <FileText />
              {rc ? 'Preview' : 'Issue'}
            </Button>
          </div>
        )
      },
    },
  ]

  const statementColumns: Column<StatementRow>[] = [
    {
      key: 'name',
      header: 'Donor',
      sortValue: (r) => r.name,
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{r.name}</p>
          <p className="truncate text-sm text-muted">{r.email || 'No email'}</p>
        </div>
      ),
    },
    {
      key: 'gifts',
      header: 'Gifts',
      sortValue: (r) => r.statement.lines.length,
      align: 'right',
      cell: (r) => <span className="tabular-nums text-muted">{r.statement.lines.length}</span>,
    },
    {
      key: 'total',
      header: `Total (${temple.currency})`,
      sortValue: (r) => r.statement.total,
      align: 'right',
      cell: (r) => (
        <span className="font-medium tabular-nums">{formatMoney(r.statement.total, r.statement.currency)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPreview({ kind: 'statement', statement: r.statement, email: r.email })}
          >
            <FileText />
            Preview
          </Button>
        </div>
      ),
    },
  ]

  const rowCount = tab === 'gifts' ? gifts.length : statements.length

  return (
    <PageShell
      eyebrow="Money"
      title={t('giving.admin.receiptsTitle', 'Tax receipts')}
      description={`${temple.name} · ${cfg.label} · ${rowCount} ${tab === 'gifts' ? 'gifts' : 'statements'} in ${year}`}
      tabs={
        <Tabs
          items={[
            { key: 'gifts', label: 'Receipts', count: gifts.length },
            { key: 'statements', label: 'Annual statements', count: statements.length },
          ]}
          value={tab}
          onChange={(k) => {
            setTab(k as 'gifts' | 'statements')
            setPreview(null)
          }}
        />
      }
      actions={
        <>
          <Select
            value={year}
            onChange={(e) => {
              setYear(Number(e.target.value))
              setPreview(null)
            }}
            aria-label="Year"
            className="w-27.5"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
          {tab === 'gifts' ? (
            <>
              <Button variant="ghost" size="sm" onClick={downloadAllReceipts} disabled={issuedCount === 0 || busy !== null}>
                {busy === 'dl' ? <Loader2 className="animate-spin" /> : <Download />}
                Download all
              </Button>
              <Button size="sm" onClick={issueAll} disabled={toIssue.length === 0 || busy !== null}>
                {busy === 'issue' ? <Loader2 className="animate-spin" /> : <FileCheck2 />}
                Issue {toIssue.length} pending
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled={statements.length === 0}
              onClick={() =>
                downloadCSV(
                  `statements-${temple.slug}-${year}.csv`,
                  statements.map((r) => ({
                    Donor: r.name,
                    Email: r.email,
                    Currency: r.statement.currency,
                    Gifts: r.statement.lines.length,
                    Total: r.statement.total,
                  })),
                )
              }
            >
              <Download />
              Export CSV
            </Button>
          )}
        </>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatTile
          label={`${year} received`}
          value={formatMoney(total, temple.currency)}
          sub={`${gifts.length} gifts in ${temple.currency}`}
          tone="leaf"
        />
        <StatTile label="Receipts issued" value={issuedCount} sub={`of ${gifts.length}`} tone="brand" />
        <StatTile label="Still to issue" value={toIssue.length} sub="Payment received, no receipt yet" tone="gold" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr] xl:items-start">
        <div className="min-w-0">
          {loading ? (
            <LoadingSkeleton variant="table" rows={8} />
          ) : tab === 'gifts' ? (
            <DataTable
              rows={gifts}
              columns={giftColumns}
              rowKey={(r) => r.donation.id}
              onRowClick={(r) => {
                const rc = findIssuedReceipt(r.donation.id)
                if (rc) setPreview({ kind: 'receipt', receipt: rc, email: r.email })
              }}
              initialSort={{ key: 'date', dir: 'desc' }}
              empty={{
                title: `No received gifts in ${year}`,
                detail: 'Gifts appear here once their payment has been received.',
              }}
            />
          ) : (
            <DataTable
              rows={statements}
              columns={statementColumns}
              rowKey={(r) => r.key}
              onRowClick={(r) => setPreview({ kind: 'statement', statement: r.statement, email: r.email })}
              initialSort={{ key: 'total', dir: 'desc' }}
              empty={{ title: `No contributions in ${year}`, detail: 'Pick another year.' }}
            />
          )}
        </div>

        <Card className="xl:sticky xl:top-[calc(var(--page-chrome-h,0px)+1.25rem)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-4">
            <h2 className="font-serif text-lg text-ink">Preview</h2>
            {preview ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <Button variant="ghost" size="sm" onClick={() => downloadPdf(preview)} disabled={busy !== null}>
                  {busy === 'pdf' ? <Loader2 className="animate-spin" /> : <Download />}
                  PDF
                </Button>
                <Button variant="ghost" size="sm" onClick={() => sendEmail(preview)} disabled={busy !== null}>
                  {busy === 'mail' ? <Loader2 className="animate-spin" /> : <Mail />}
                  Send by email
                </Button>
                <Button variant="ghost" size="sm" onClick={() => window.print()}>
                  <Printer />
                  Print
                </Button>
              </div>
            ) : null}
          </div>
          <div className="p-4">
            {preview?.kind === 'receipt' ? (
              <ReceiptView receipt={preview.receipt} className="border-0 p-0 shadow-none" />
            ) : preview?.kind === 'statement' ? (
              <StatementView statement={preview.statement} className="border-0 p-0 shadow-none" />
            ) : (
              <EmptyState
                Icon={FileText}
                title="Select a row"
                detail={`Pick a gift or donor to render their ${cfg.label} document here.`}
              />
            )}
          </div>
        </Card>
      </div>
    </PageShell>
  )
}
