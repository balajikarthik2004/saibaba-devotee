import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Coins, Download, FileText, Loader2, UserRound } from 'lucide-react'
import {
  buildAnnualStatements,
  donationCurrency,
  donationTempleId,
  downloadBlob,
  findIssuedReceipt,
  formatMoney,
  getPaymentMeta,
  issueReceipt,
  providerLabel,
  receiptFilename,
  receiptStateFor,
  renderReceiptPdf,
  useT,
} from '@saibaba/core'
import type { Donation } from '@/lib/data/types'
import { PageHeader } from '@/components/layout/layouts'
import { EmptyState, LoadingSkeleton } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/input'
import { Dialog } from '@/components/ui/overlay'
import { Table, TBody, TD, TH, THead, TR, TableWrap } from '@/components/ui/table'
import { StatTile } from '@/components/shared/StatTile'
import { DownloadPdfButton, StatementView } from '@/features/giving/components/ReceiptView'
import { addTo, formatTotals } from '@/features/giving/money'
import type { Totals } from '@/features/giving/money'
import { donorForReceipts } from '@/features/giving/useMyDonor'
import { EVENT_BY_ID, TEMPLE_BY_ID } from '@/lib/data/mock'
import { listDonationsFor } from '@/lib/data/api'
import { signUpHrefFor, useDonorIdentity } from '@/lib/donor'
import { useAsync } from '@/lib/hooks'
import { downloadCSV, fmtDate, titleCase } from '@/lib/utils'

/**
 * What a gift was for, in one line. An event sponsorship names the festival and the
 * heads covered; everything else falls back to the fund and any dedication. The table,
 * the CSV export and the printed statement all read from here so a devotee never sees
 * a gift described three different ways.
 */
function purposeOf(d: Donation) {
  const event = d.eventId ? EVENT_BY_ID.get(d.eventId) : undefined
  if (event) {
    return d.eventItems?.length
      ? `${event.title} - ${d.eventItems.join(', ')}`
      : `${event.title} sponsorship`
  }
  return d.dedicatedTo ?? ''
}

/**
 * Giving history for whoever is asking, a signed-in devotee or a guest donor.
 *
 * `RequireDonor` guarantees an identity by the time this renders, so the assertion is
 * safe. Fetching through `listDonationsFor` rather than by user id is what lets a guest
 * see the gift they made ten minutes ago, and what pulls a devotee's pre-account guest
 * gifts into the same statement once they register.
 *
 * Gifts to temples in different countries are in different currencies, so every total is
 * shown per currency and never summed across them.
 */
export default function MyDonations() {
  const t = useT()
  const identity = useDonorIdentity()!
  const { data, loading } = useAsync(
    () => listDonationsFor(identity),
    [identity.userId, identity.contact.email, identity.contact.phone],
  )
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [showStatement, setShowStatement] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [, bump] = useState(0)

  const donations = useMemo(() => data ?? [], [data])

  const years = useMemo(() => {
    const set = new Set(donations.map((d) => new Date(d.createdAt).getFullYear()))
    set.add(new Date().getFullYear())
    return [...set].sort((a, b) => b - a)
  }, [donations])

  const signUpHref = signUpHrefFor(identity.contact)

  const inYear = donations.filter((d) => new Date(d.createdAt).getFullYear() === year)
  const settled = (d: Donation) => (getPaymentMeta(d.id)?.status ?? 'succeeded') === 'succeeded'

  const { yearTotals, lifetimeTotals } = useMemo(() => {
    let yt: Totals = {}
    let lt: Totals = {}
    for (const d of donations) {
      if (!settled(d)) continue
      lt = addTo(lt, donationCurrency(d), d.amount)
      if (new Date(d.createdAt).getFullYear() === year) yt = addTo(yt, donationCurrency(d), d.amount)
    }
    return { yearTotals: yt, lifetimeTotals: lt }
  }, [donations, year])

  const statements = useMemo(
    () => buildAnnualStatements({ year, donations, donor: donorForReceipts(identity) }),
    // The declaration may have been edited since; recompute when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [year, donations, identity.userId, identity.contact.email, showStatement],
  )

  const exportCSV = () =>
    downloadCSV(
      `donations-${year}.csv`,
      inYear.map((d) => ({
        Date: fmtDate(d.createdAt, 'yyyy-MM-dd'),
        Temple: TEMPLE_BY_ID.get(donationTempleId(d))?.name ?? '',
        Category: titleCase(d.category),
        Currency: donationCurrency(d),
        Amount: d.amount,
        Method: getPaymentMeta(d.id)
          ? providerLabel(getPaymentMeta(d.id)!.provider)
          : titleCase(d.paymentMethod),
        Status: getPaymentMeta(d.id)?.status ?? 'succeeded',
        Recurring: d.isRecurring ? d.recurringCadence : 'No',
        Purpose: purposeOf(d),
        Receipt: findIssuedReceipt(d.id)?.number ?? d.taxReceiptId ?? 'pending',
      })),
    )

  /** Issue on demand (idempotent) and download the PDF for one gift. */
  const receiptPdf = async (d: Donation) => {
    const temple = TEMPLE_BY_ID.get(donationTempleId(d))
    if (!temple) return
    setBusyId(d.id)
    try {
      const r = issueReceipt({ kind: 'donation', donation: d }, temple, donorForReceipts(identity, temple))
      if (!r) return
      downloadBlob(await renderReceiptPdf(r), receiptFilename(r))
      bump((n) => n + 1)
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader title={t('giving.my.title', 'My donations')} subtitle={t('giving.my.loading', 'Loading your giving history…')} />
        <LoadingSkeleton variant="table" rows={5} />
      </>
    )
  }

  const recurringCount = donations.filter((d) => d.isRecurring).length

  return (
    <>
      <PageHeader
        title={t('giving.my.title', 'My donations')}
        subtitle={t('giving.my.subtitle', 'Every gift, with its fund and its receipt reference.')}
        actions={
          <>
            <Select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              aria-label={t('giving.my.filterYear', 'Filter by year')}
              className="w-[110px]"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
            <Button variant="ghost" size="sm" onClick={exportCSV} disabled={inYear.length === 0}>
              <Download />
              {t('giving.my.exportCsv', 'Export CSV')}
            </Button>
            <Button size="sm" onClick={() => setShowStatement(true)} disabled={inYear.length === 0}>
              <FileText />
              {t('giving.my.statement', 'Download {year} statement', { year })}
            </Button>
            <Link to="/my/tax" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              {t('giving.my.taxDetails', 'Tax details')}
            </Link>
          </>
        }
      />

      {/* A guest's history lives on this browser and on the contact details they gave.
          Saying so plainly is fairer than letting them assume the temple is holding it
          for them, and the offer next to it is how they make that assumption true. */}
      {identity.isGuest ? (
        <Card className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-saffron-400/35 bg-saffron-400/[0.07] p-4">
          <UserRound className="size-4 shrink-0 text-brand-600" />
          <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-ink">
            {t('giving.my.guestNote', 'Showing gifts matched to {email} and {phone}. Create an account and these move onto your permanent devotee record, reachable from any device.', {
              email: identity.contact.email,
              phone: identity.contact.phone,
            })}
          </p>
          <Link to={signUpHref} className={buttonVariants({ size: 'sm' })}>
            {t('giving.success.createAccount', 'Create my account')}
          </Link>
        </Card>
      ) : null}

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatTile
          label={t('giving.my.yearTotal', '{year} total', { year })}
          value={<span className="text-[0.85em]">{formatTotals(yearTotals, formatMoney(0, 'USD'))}</span>}
          sub={t('giving.my.giftsCount', '{n} gifts', { n: inYear.length })}
          Icon={Coins}
          tone="leaf"
        />
        <StatTile
          label={t('giving.my.lifetime', 'Lifetime giving')}
          value={<span className="text-[0.85em]">{formatTotals(lifetimeTotals, formatMoney(0, 'USD'))}</span>}
          sub={t('giving.my.onRecord', '{n} gifts on record', { n: donations.length })}
        />
        <StatTile
          label={t('giving.my.recurring', 'Recurring gifts')}
          value={recurringCount}
          sub={t('giving.my.standing', 'Active standing orders')}
          tone="gold"
        />
      </div>

      {inYear.length === 0 ? (
        <EmptyState
          Icon={Coins}
          title={t('giving.my.none', 'No donations recorded in {year}', { year })}
          detail={t('giving.my.noneHint', 'Pick another year, or make your first gift of the year.')}
        />
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <TR>
                <TH>{t('giving.my.date', 'Date')}</TH>
                <TH>{t('giving.my.fund', 'Fund')}</TH>
                <TH>{t('giving.my.purpose', 'Purpose')}</TH>
                <TH>{t('giving.my.method', 'Method')}</TH>
                <TH>{t('giving.my.receipt', 'Receipt')}</TH>
                <TH className="text-right">{t('giving.my.amount', 'Amount')}</TH>
              </TR>
            </THead>
            <TBody>
              {inYear.map((d) => {
                const meta = getPaymentMeta(d.id)
                const state = receiptStateFor(d)
                const issued = findIssuedReceipt(d.id)
                const temple = TEMPLE_BY_ID.get(donationTempleId(d))
                return (
                  <TR key={d.id} className="hover:bg-tint/40">
                    <TD className="whitespace-nowrap text-muted">{fmtDate(d.createdAt)}</TD>
                    <TD>
                      <span className="font-medium">{titleCase(d.category)}</span>
                      {d.isRecurring ? (
                        <Badge variant="gold" className="ml-2">
                          {titleCase(d.recurringCadence ?? 'recurring')}
                        </Badge>
                      ) : null}
                      {temple ? <span className="block text-[12px] text-muted">{temple.name}</span> : null}
                    </TD>
                    <TD className="max-w-[220px] truncate text-muted">{purposeOf(d) || '—'}</TD>
                    <TD>
                      {meta ? providerLabel(meta.provider) : titleCase(d.paymentMethod)}
                      {meta && meta.status !== 'succeeded' ? (
                        <Badge variant={meta.status === 'failed' ? 'brand' : 'gold'} className="ml-2">
                          {meta.status === 'failed'
                            ? t('giving.my.failed', 'Failed')
                            : t('giving.my.pending', 'Pending')}
                        </Badge>
                      ) : null}
                    </TD>
                    <TD>
                      {state === 'issued' || issued ? (
                        <button
                          type="button"
                          onClick={() => receiptPdf(d)}
                          disabled={busyId === d.id}
                          className="inline-flex items-center gap-1.5 font-mono text-[12px] text-brand-600 hover:underline disabled:opacity-50"
                          aria-label={t('giving.my.downloadReceipt', 'Download receipt for {id}', { id: d.id })}
                        >
                          {busyId === d.id ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
                          {issued?.number ?? d.taxReceiptId ?? t('giving.my.download', 'Download')}
                        </button>
                      ) : (
                        <span className="text-[12px] text-muted">
                          {state === 'awaiting-payment'
                            ? t('giving.my.awaiting', 'After payment')
                            : t('giving.my.pending', 'Pending')}
                        </span>
                      )}
                    </TD>
                    <TD className="text-right font-medium tabular-nums">
                      {formatMoney(d.amount, donationCurrency(d))}
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        </TableWrap>
      )}

      <Card className="mt-5 p-4 text-[12.5px] leading-relaxed text-muted">
        {t('giving.my.footnote', 'Receipts follow each temple’s own tax rules: 501(c)(3) in the US, 80G in India, Gift Aid in the UK and CRA official receipts in Canada. Totals are shown per currency and are never converted.')}
      </Card>

      <Dialog
        open={showStatement}
        onClose={() => setShowStatement(false)}
        title={t('giving.my.statementTitle', '{year} contribution statement', { year })}
        description={t('giving.my.statementDesc', 'One statement per temple and currency. Download the PDF, or print this view.')}
        className="max-w-3xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowStatement(false)}>
              {t('giving.close', 'Close')}
            </Button>
            <Button onClick={() => window.print()}>
              <Download />
              {t('giving.print', 'Print')}
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          {statements.length === 0 ? (
            <p className="text-[13px] text-muted">
              {t('giving.my.noStatement', 'No received gifts in {year} yet. Pending gifts appear once the payment arrives.', { year })}
            </p>
          ) : null}
          {statements.map((s) => (
            <div key={`${s.templeId}-${s.currency}`} className="space-y-2">
              <div className="no-print flex justify-end">
                <DownloadPdfButton statement={s} label={t('giving.pdf.downloadStatement', 'Download {temple} PDF', { temple: s.templeName })} variant="outline" />
              </div>
              <StatementView statement={s} />
            </div>
          ))}
        </div>
      </Dialog>
    </>
  )
}
