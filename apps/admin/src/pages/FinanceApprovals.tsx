import { useMemo, useState } from 'react'
import { Ban, Check, CircleAlert, Clock, Loader2, Undo2, Wallet } from 'lucide-react'
import type { ApprovalStage, Booking, User } from '@/lib/data/types'
import { PageShell } from '@/components/layout/PageShell'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { ApprovalTimeline } from '@/components/admin/ApprovalTimeline'
import { StatTile } from '@/components/shared/StatTile'
import { LoadingSkeleton } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { Sheet } from '@/components/ui/overlay'
import { Chips } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/toast'
import {
  declineBooking,
  listBookingsByStage,
  listDevotees,
  resubmitForReview,
  sendBackForPayment,
  verifyPayment,
} from '@/lib/data/api'
import { PUJA_BY_ID } from '@/lib/data/mock'
import { useAuthStore } from '@/lib/store/auth'
import { useAsync } from '@/lib/hooks'
import { fmtDate, money, titleCase } from '@/lib/utils'

/**
 * The accounts desk.
 *
 * A sponsorship is taken on trust at the point of booking — the devotee says they paid
 * by Zelle, and the temple has no way to know whether that money landed. This screen is
 * where somebody checks. Verifying records *which* transaction was matched, because
 * "who approved this?" and "what did they look at?" are different questions and only
 * the second one survives an audit.
 */

interface Row {
  booking: Booking
  devotee?: User
}

const FILTERS: { key: ApprovalStage | 'all'; label: string }[] = [
  { key: 'finance-review', label: 'Awaiting verification' },
  { key: 'payment-pending', label: 'Sent back' },
  { key: 'all', label: 'Everything in the chain' },
]

const METHODS: NonNullable<Booking['payment']>['method'][] = [
  'card',
  'ach',
  'zelle',
  'check',
  'cash',
]

/** Days a booking has been waiting — the number that makes a queue feel urgent. */
const ageInDays = (iso: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000))

export default function FinanceApprovals() {
  const { toast } = useToast()
  const actor = useAuthStore((s) => s.user)!
  const [filter, setFilter] = useState<ApprovalStage | 'all'>('finance-review')
  const [openId, setOpenId] = useState<string | null>(null)

  const { data, loading, refresh } = useAsync(
    async () => Promise.all([listBookingsByStage('all'), listDevotees()]),
    [],
  )

  const [all, byId] = useMemo(() => {
    if (!data) return [[] as Booking[], new Map<string, User>()] as const
    const [bookings, devotees] = data
    return [bookings, new Map(devotees.map((d) => [d.id, d]))] as const
  }, [data])

  const rows = useMemo<Row[]>(
    () =>
      all
        .filter((b) => (filter === 'all' ? true : b.approval?.stage === filter))
        .map((booking) => ({ booking, devotee: byId.get(booking.userId) })),
    [all, filter, byId],
  )

  const awaiting = all.filter((b) => b.approval?.stage === 'finance-review')
  const sentBack = all.filter((b) => b.approval?.stage === 'payment-pending')

  /* ------------------------------------------------------------- the sheet */

  const open = all.find((b) => b.id === openId) ?? null
  const openDevotee = open ? byId.get(open.userId) : undefined

  const [reference, setReference] = useState('')
  const [method, setMethod] = useState<NonNullable<Booking['payment']>['method']>('card')
  const [reason, setReason] = useState('')
  const [mode, setMode] = useState<'verify' | 'send-back' | 'decline'>('verify')
  const [busy, setBusy] = useState(false)

  // Opening a row loads that booking's own payment details into the form rather than
  // leaving whatever the last row had in it — a reference typed against the wrong
  // sponsorship is exactly the error this screen exists to prevent.
  const openSheet = (b: Booking) => {
    setOpenId(b.id)
    setReference(b.payment?.reference ?? '')
    setMethod(b.payment?.method ?? 'card')
    setReason('')
    setMode('verify')
  }

  const closeSheet = () => setOpenId(null)

  const run = async (fn: () => Promise<unknown>, message: string, tone?: 'warn') => {
    setBusy(true)
    await fn()
    setBusy(false)
    closeSheet()
    toast(message, tone ? { tone } : undefined)
    refresh()
  }

  const columns: Column<Row>[] = [
    {
      key: 'devotee',
      header: 'Devotee',
      sortValue: (r) => r.devotee?.name ?? '',
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{r.devotee?.name ?? 'Unknown'}</p>
          <p className="truncate text-sm text-muted">{r.devotee?.phone}</p>
        </div>
      ),
    },
    {
      key: 'puja',
      header: 'Puja',
      sortValue: (r) => PUJA_BY_ID.get(r.booking.pujaCatalogId)?.name ?? '',
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate">{PUJA_BY_ID.get(r.booking.pujaCatalogId)?.name}</p>
          <p className="truncate text-sm text-muted">{titleCase(r.booking.cadence)}</p>
        </div>
      ),
    },
    {
      key: 'method',
      header: 'Paid by',
      sortValue: (r) => r.booking.payment?.method ?? '',
      cell: (r) => (
        <div className="min-w-0">
          <p>{titleCase(r.booking.payment?.method ?? '—')}</p>
          <p className="truncate font-mono text-2xs text-muted">
            {r.booking.payment?.reference ?? 'no reference'}
          </p>
        </div>
      ),
    },
    {
      key: 'age',
      header: 'Waiting',
      sortValue: (r) => r.booking.createdAt,
      cell: (r) => {
        const days = ageInDays(r.booking.createdAt)
        return (
          <span className="whitespace-nowrap text-muted">
            {days === 0 ? 'Today' : `${days} day${days === 1 ? '' : 's'}`}
          </span>
        )
      },
    },
    {
      key: 'amount',
      header: 'Amount',
      sortValue: (r) => r.booking.amount,
      align: 'right',
      cell: (r) => <span className="tabular-nums">{money(r.booking.amount)}</span>,
    },
    {
      key: 'stage',
      header: 'Stage',
      sortValue: (r) => r.booking.approval?.stage ?? '',
      cell: (r) =>
        r.booking.approval?.stage === 'payment-pending' ? (
          <Badge variant="brand">Sent back</Badge>
        ) : r.booking.approval?.stage === 'finance-review' ? (
          <Badge variant="gold">Awaiting</Badge>
        ) : (
          <Badge variant="neutral">{titleCase(r.booking.approval?.stage ?? '')}</Badge>
        ),
    },
  ]

  const stage = open?.approval?.stage

  return (
    <PageShell
      eyebrow="Operations"
      title="Payment approvals"
      description={`${awaiting.length} awaiting verification · ${money(
        awaiting.reduce((s, b) => s + b.amount, 0),
      )} unverified in the queue`}
      toolbar={
        <Chips
          items={FILTERS.map((f) => ({ key: f.key, label: f.label }))}
          value={filter}
          onChange={(k) => setFilter(k as ApprovalStage | 'all')}
        />
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Awaiting verification"
          value={awaiting.length}
          sub="Needs an accounts decision"
          Icon={Clock}
          tone="gold"
        />
        <StatTile
          label="Sent back"
          value={sentBack.length}
          sub="Payment not traced yet"
          Icon={CircleAlert}
          tone="brand"
        />
        <StatTile
          label="Value in the queue"
          value={money(awaiting.reduce((s, b) => s + b.amount, 0))}
          sub="Not counted as revenue"
          Icon={Wallet}
        />
      </div>

      {loading ? (
        <LoadingSkeleton variant="table" rows={6} />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(r) => r.booking.id}
          onRowClick={(r) => openSheet(r.booking)}
          initialSort={{ key: 'age', dir: 'asc' }}
          empty={{
            title: 'Nothing waiting on accounts',
            detail: 'Every sponsorship in this queue has been dealt with.',
          }}
        />
      )}

      <Sheet
        open={Boolean(open)}
        onClose={closeSheet}
        title={openDevotee?.name ?? 'Booking'}
        description={
          open
            ? `${PUJA_BY_ID.get(open.pujaCatalogId)?.name} · ${money(open.amount)} · booked ${fmtDate(
                open.createdAt,
              )}`
            : undefined
        }
        className="max-w-lg"
        footer={
          open ? (
            <>
              <Button
                variant="plain"
                size="sm"
                onClick={() => setMode('decline')}
                disabled={busy}
              >
                <Ban />
                Decline
              </Button>
              {stage === 'payment-pending' ? (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => resubmitForReview(open.id, actor, 'Devotee reports the payment settled.'),
                      'Back in the verification queue',
                    )
                  }
                >
                  {busy ? <Loader2 className="animate-spin" /> : <Undo2 />}
                  Return to queue
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMode('send-back')}
                    disabled={busy}
                  >
                    <Undo2 />
                    Send back
                  </Button>
                  <Button
                    size="sm"
                    disabled={busy || !reference.trim()}
                    onClick={() =>
                      run(
                        () => verifyPayment(open.id, actor, { method, reference }),
                        'Payment verified · sent to the puja committee',
                      )
                    }
                  >
                    {busy ? <Loader2 className="animate-spin" /> : <Check />}
                    Verify &amp; approve
                  </Button>
                </>
              )}
            </>
          ) : null
        }
      >
        {open ? (
          <div className="space-y-5">
            <Card className="space-y-3 p-4">
              <h3 className="text-sm font-medium text-ink">What the devotee owes</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted">Sponsorship</dt>
                  <dd className="font-medium tabular-nums">{money(open.amount)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted">Sankalpam</dt>
                  <dd className="max-w-[60%] text-right">{open.sankalpamNames.join(', ')}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted">First puja</dt>
                  <dd>{fmtDate(open.startDate)}</dd>
                </div>
              </dl>
            </Card>

            {/* The verification form. Kept above the timeline because it is the thing
                the desk came here to do; the history is context for it, not the point. */}
            {mode === 'verify' && stage !== 'payment-pending' ? (
              <Card className="space-y-3 p-4">
                <h3 className="text-sm font-medium text-ink">Match the transaction</h3>
                <Field label="How it was actually paid" htmlFor="fa-method">
                  <Select
                    id="fa-method"
                    value={method}
                    onChange={(e) =>
                      setMethod(e.target.value as NonNullable<Booking['payment']>['method'])
                    }
                  >
                    {METHODS.map((m) => (
                      <option key={m} value={m}>
                        {titleCase(m)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="Transaction reference"
                  hint="required"
                  htmlFor="fa-ref"
                  error={reference.trim() ? undefined : 'Record what you matched it against.'}
                >
                  <Input
                    id="fa-ref"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="CHQ 4417 · ZL884120 · ch_1234567890"
                  />
                </Field>
              </Card>
            ) : null}

            {mode !== 'verify' ? (
              <Card className="space-y-3 border-brand-500/30 bg-brand-500/[0.04] p-4">
                <h3 className="text-sm font-medium text-ink">
                  {mode === 'decline' ? 'Decline this sponsorship' : 'Send back to the devotee'}
                </h3>
                <p className="text-xs leading-relaxed text-muted">
                  {mode === 'decline'
                    ? 'The sponsorship is cancelled and drops out of every revenue figure. The reason is kept on the record.'
                    : 'The devotee can still settle it. The booking waits here until the payment is traced.'}
                </p>
                <Field label="Reason" hint="required" htmlFor="fa-reason">
                  <Textarea
                    id="fa-reason"
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="No matching credit on the 12 Aug statement."
                  />
                </Field>
                <div className="flex justify-end gap-2">
                  <Button variant="plain" size="sm" onClick={() => setMode('verify')}>
                    Cancel
                  </Button>
                  <Button
                    variant={mode === 'decline' ? 'destructive' : 'default'}
                    size="sm"
                    disabled={busy || !reason.trim()}
                    onClick={() =>
                      run(
                        () =>
                          mode === 'decline'
                            ? declineBooking(open.id, actor, reason)
                            : sendBackForPayment(open.id, actor, reason),
                        mode === 'decline' ? 'Sponsorship declined' : 'Sent back to the devotee',
                        'warn',
                      )
                    }
                  >
                    {busy ? <Loader2 className="animate-spin" /> : null}
                    {mode === 'decline' ? 'Decline' : 'Send back'}
                  </Button>
                </div>
              </Card>
            ) : null}

            <div>
              <h3 className="mb-3 text-sm font-medium text-ink">History</h3>
              <ApprovalTimeline history={open.approval?.history ?? []} />
            </div>
          </div>
        ) : null}
      </Sheet>
    </PageShell>
  )
}
