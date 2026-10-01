import { useMemo, useState } from 'react'
import { HeartHandshake } from 'lucide-react'
import {
  formatMoney,
  listLedger,
  listMatchingGifts,
  setMatchingGiftStatus,
  useCurrentTemple,
} from '@saibaba/core'
import type { MatchingGiftRequest } from '@saibaba/core'
import { PageShell } from '@/components/layout/PageShell'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { LoadingSkeleton } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { Dialog } from '@/components/ui/overlay'
import { useToast } from '@/components/ui/toast'
import { useAsync } from '@/lib/hooks'
import { fmtDate } from '@/lib/utils'

const TONE: Record<MatchingGiftRequest['status'], 'gold' | 'leaf' | 'brand' | 'neutral'> = {
  submitted: 'gold',
  verified: 'neutral',
  matched: 'leaf',
  declined: 'brand',
}

/** Employer matching-gift requests: verify with the employer, then record the match. */
export default function MatchingRequests() {
  const temple = useCurrentTemple()
  const { toast } = useToast()
  const [matching, setMatching] = useState<MatchingGiftRequest | null>(null)
  const [amount, setAmount] = useState('')

  const { data, loading, refresh } = useAsync(
    async () => Promise.all([listMatchingGifts(temple.id), listLedger()]),
    [temple.id],
  )

  const donationAmount = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of data?.[1] ?? []) m.set(r.donation.id, r.donation.amount)
    return m
  }, [data])

  const rows = data?.[0] ?? []

  const set = async (r: MatchingGiftRequest, status: MatchingGiftRequest['status'], matched?: number) => {
    await setMatchingGiftStatus(r.id, status, matched)
    toast(`Request ${status}`, { detail: r.employer })
    refresh()
  }

  const columns: Column<MatchingGiftRequest>[] = [
    { key: 'date', header: 'Submitted', sortValue: (r) => r.createdAt, cell: (r) => <span className="text-muted">{fmtDate(r.createdAt)}</span> },
    { key: 'employer', header: 'Employer', sortValue: (r) => r.employer, cell: (r) => <span className="font-medium text-ink">{r.employer}</span> },
    { key: 'donation', header: 'Donation', sortValue: (r) => r.donationId, cell: (r) => <span className="font-mono text-xs">{r.donationId}</span> },
    {
      key: 'gift',
      header: 'Gift',
      align: 'right',
      sortValue: (r) => donationAmount.get(r.donationId) ?? 0,
      cell: (r) => (
        <span className="tabular-nums">
          {donationAmount.has(r.donationId) ? formatMoney(donationAmount.get(r.donationId)!, temple.currency) : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (r) => r.status,
      cell: (r) => (
        <span>
          <Badge variant={TONE[r.status]}>{r.status[0]!.toUpperCase() + r.status.slice(1)}</Badge>
          {r.matchedAmount ? (
            <span className="ml-2 tabular-nums text-sm text-muted">{formatMoney(r.matchedAmount, temple.currency)}</span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (r) => (
        <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {r.status === 'submitted' ? (
            <Button size="sm" variant="ghost" onClick={() => set(r, 'verified')}>
              Mark verified
            </Button>
          ) : null}
          {r.status === 'submitted' || r.status === 'verified' ? (
            <>
              <Button
                size="sm"
                onClick={() => {
                  setMatching(r)
                  setAmount(String(donationAmount.get(r.donationId) ?? ''))
                }}
              >
                Mark matched
              </Button>
              <Button size="sm" variant="plain" onClick={() => set(r, 'declined')}>
                Decline
              </Button>
            </>
          ) : null}
        </div>
      ),
    },
  ]

  return (
    <PageShell
      eyebrow="Giving"
      title="Matching gifts"
      description={`${temple.name} · ${rows.length} request${rows.length === 1 ? '' : 's'} from employer matching`}
    >
      {loading ? (
        <LoadingSkeleton variant="table" rows={5} />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(r) => r.id}
          initialSort={{ key: 'date', dir: 'desc' }}
          empty={{
            title: 'No matching-gift requests',
            detail: 'Donors who name an employer on the donation page appear here (US temples).',
          }}
        />
      )}

      <Dialog
        open={matching != null}
        onClose={() => setMatching(null)}
        title="Record the match"
        description={matching ? `${matching.employer} · donation ${matching.donationId}` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setMatching(null)}>
              Cancel
            </Button>
            <Button
              disabled={!(Number(amount) > 0)}
              onClick={async () => {
                if (matching) await set(matching, 'matched', Number(amount))
                setMatching(null)
              }}
            >
              <HeartHandshake />
              Mark matched
            </Button>
          </>
        }
      >
        <Field label={`Matched amount (${temple.currency})`} htmlFor="mg-amount">
          <Input
            id="mg-amount"
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="max-w-[200px]"
          />
        </Field>
      </Dialog>
    </PageShell>
  )
}
