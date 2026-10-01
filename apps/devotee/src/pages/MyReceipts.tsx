import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, FileText, Loader2, ReceiptText } from 'lucide-react'
import {
  buildAnnualStatements,
  downloadBlob,
  formatMoney,
  regimeConfig,
  renderAnnualStatementPdf,
  statementFilename,
  useT,
} from '@saibaba/core'
import type { AnnualStatement } from '@saibaba/core'
import { PageHeader } from '@/components/layout/layouts'
import { EmptyState, LoadingSkeleton } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/overlay'
import { DownloadPdfButton, StatementView } from '@/features/giving/components/ReceiptView'
import { getMyBookings, listDonations } from '@/lib/data/api'
import { identityFromUser } from '@/lib/donor'
import { useAuthStore } from '@/lib/store/auth'
import { useAsync } from '@/lib/hooks'
import { donorForReceipts } from '@/features/giving/useMyDonor'
import { fmtDate } from '@/lib/utils'

/**
 * One statement per year, per temple, in that temple's currency and tax regime. A
 * devotee who gives to a US and an Indian temple gets two statements for the same
 * year, never one blended figure.
 */
export default function MyReceipts() {
  const t = useT()
  const user = useAuthStore((s) => s.user)!
  const { data, loading } = useAsync(
    async () => Promise.all([listDonations(user.id), getMyBookings(user.id)]),
    [user.id],
  )
  const [open, setOpen] = useState<AnnualStatement | null>(null)
  const [busyAll, setBusyAll] = useState(false)

  const statements = useMemo(() => {
    if (!data) return []
    const [donations, bookings] = data
    const years = new Set<number>()
    for (const d of donations) years.add(new Date(d.createdAt).getFullYear())
    for (const b of bookings) years.add(new Date(b.createdAt).getFullYear())
    const donor = donorForReceipts(identityFromUser(user))
    return [...years]
      .sort((a, b) => b - a)
      .flatMap((year) => buildAnnualStatements({ year, donations, bookings, donor }))
  }, [data, user])

  const downloadAll = async () => {
    setBusyAll(true)
    try {
      // Sequential on purpose: browsers block a burst of simultaneous downloads.
      for (const s of statements) {
        downloadBlob(await renderAnnualStatementPdf(s), statementFilename(s))
        await new Promise((r) => setTimeout(r, 400))
      }
    } finally {
      setBusyAll(false)
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader title={t('giving.receipts.title', 'Receipt archive')} subtitle={t('giving.receipts.loading', 'Loading your statements…')} />
        <LoadingSkeleton variant="table" rows={4} />
      </>
    )
  }

  const thisYear = new Date().getFullYear()

  return (
    <>
      <PageHeader
        title={t('giving.receipts.title', 'Receipt archive')}
        subtitle={t('giving.receipts.subtitle', 'One statement per year and temple, covering donations and puja sponsorships in that temple’s currency.')}
        actions={
          <>
            <Link to="/my/tax" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              {t('giving.my.taxDetails', 'Tax details')}
            </Link>
            <Button size="sm" variant="ghost" onClick={downloadAll} disabled={busyAll || statements.length === 0}>
              {busyAll ? <Loader2 className="animate-spin" /> : <Download />}
              {t('giving.receipts.downloadAll', 'Download all')}
            </Button>
          </>
        }
      />

      {statements.length === 0 ? (
        <EmptyState
          Icon={ReceiptText}
          title={t('giving.receipts.none', 'No receipts yet')}
          detail={t('giving.receipts.noneHint', 'Your first received gift or sponsorship will generate a statement here.')}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {statements.map((s) => (
            <Card key={`${s.year}-${s.templeId}-${s.currency}`} className="flex flex-col p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[22px] tabular-nums">{s.year}</h2>
                <span className="grid size-9 place-items-center rounded-[10px] bg-tint text-brand-500">
                  <FileText className="size-4" />
                </span>
              </div>
              <p className="mt-1 text-[13px] font-medium text-ink">{s.templeName}</p>
              <p className="mt-2 text-[26px] leading-none tabular-nums">
                {formatMoney(s.total, s.currency)}
              </p>
              <p className="mt-1.5 text-[12.5px] text-muted">
                {t('giving.receipts.lines', '{n} line items', { n: s.lines.length })} ·{' '}
                {s.year === thisYear
                  ? t('giving.receipts.provisional', 'provisional, final Jan {y}', { y: s.year + 1 })
                  : t('giving.receipts.issued', 'issued {date}', {
                      date: fmtDate(new Date(s.year + 1, 0, 15), 'MMM d, yyyy'),
                    })}
              </p>
              <Badge variant="neutral" className="mt-2 w-fit">
                {regimeConfig(s.regime).label}
              </Badge>
              <div className="mt-4 flex gap-2">
                <Button variant="ghost" size="sm" className="flex-1" onClick={() => setOpen(s)}>
                  <FileText />
                  {t('giving.receipts.view', 'View')}
                </Button>
                <DownloadPdfButton statement={s} label="PDF" variant="outline" className="flex-1" />
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={open != null}
        onClose={() => setOpen(null)}
        title={open ? `${open.year} ${regimeConfig(open.regime).annualTitle}` : ''}
        description={open?.templeName}
        className="max-w-3xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(null)}>
              {t('giving.close', 'Close')}
            </Button>
            {open ? <DownloadPdfButton statement={open} size="default" /> : null}
            <Button variant="ghost" onClick={() => window.print()}>
              {t('giving.print', 'Print')}
            </Button>
          </>
        }
      >
        {open ? <StatementView statement={open} /> : null}
      </Dialog>
    </>
  )
}
