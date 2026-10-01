import { useMemo, useState } from 'react'
import { Ban, CalendarCheck, Check, Clock, Loader2, UserCheck } from 'lucide-react'
import type { Booking, PujaOccurrence, Staff, User } from '@/lib/data/types'
import { PageShell } from '@/components/layout/PageShell'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { ApprovalTimeline } from '@/components/admin/ApprovalTimeline'
import { StatTile } from '@/components/shared/StatTile'
import { LoadingSkeleton } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Select, Textarea } from '@/components/ui/input'
import { Sheet } from '@/components/ui/overlay'
import { Chips } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/toast'
import {
  assignPriest,
  declineBooking,
  getOccurrencesForBooking,
  listBookingsByStage,
  listDevotees,
  setOccurrenceOfficiant,
} from '@/lib/data/api'
import { PUJA_BY_ID, STAFF } from '@/lib/data/mock'
import { useAuthStore } from '@/lib/store/auth'
import { useAsync } from '@/lib/hooks'
import { fmtDate, fmtDateTime, money, titleCase } from '@/lib/utils'

/**
 * The puja committee's desk.
 *
 * Accounts has confirmed the money; what is still missing is a priest. Assigning one is
 * the step that makes a sponsorship real — it generates the days on the roster and flips
 * the booking live. The committee picks one priest for the whole booking, then moves
 * individual days if someone is travelling or two shrines clash.
 */

interface Row {
  booking: Booking
  devotee?: User
}

const PRIESTS: Staff[] = STAFF.filter((s) => s.role === 'priest')

export default function CommitteeApprovals() {
  const { toast } = useToast()
  const actor = useAuthStore((s) => s.user)!
  const [filter, setFilter] = useState<'committee-review' | 'scheduled'>('committee-review')
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

  const waiting = all.filter((b) => b.approval?.stage === 'committee-review')
  const assigned = all.filter((b) => b.approval?.stage === 'scheduled')

  const rows = useMemo<Row[]>(
    () =>
      all
        .filter((b) => b.approval?.stage === filter)
        .map((booking) => ({ booking, devotee: byId.get(booking.userId) })),
    [all, filter, byId],
  )

  /* ------------------------------------------------------------- the sheet */

  const open = all.find((b) => b.id === openId) ?? null
  const openDevotee = open ? byId.get(open.userId) : undefined

  const [priestId, setPriestId] = useState<string>(PRIESTS[0]?.id ?? '')
  const [note, setNote] = useState('')
  const [declining, setDeclining] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  // The day list only exists once a priest has been assigned, so it is loaded per
  // booking rather than up front — an unassigned booking has no days to show.
  const {
    data: days,
    loading: daysLoading,
    refresh: refreshDays,
  } = useAsync(
    async () => (openId && open?.approval?.stage === 'scheduled' ? getOccurrencesForBooking(openId) : []),
    [openId, open?.approval?.stage],
  )

  const openSheet = (b: Booking) => {
    setOpenId(b.id)
    setPriestId(b.assignedPriestId ?? PRIESTS[0]?.id ?? '')
    setNote('')
    setReason('')
    setDeclining(false)
  }

  const closeSheet = () => setOpenId(null)

  const columns: Column<Row>[] = [
    {
      key: 'devotee',
      header: 'Devotee',
      sortValue: (r) => r.devotee?.name ?? '',
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{r.devotee?.name ?? 'Unknown'}</p>
          <p className="truncate text-sm text-muted">{r.booking.sankalpamNames.join(', ')}</p>
        </div>
      ),
    },
    {
      key: 'puja',
      header: 'Puja',
      sortValue: (r) => PUJA_BY_ID.get(r.booking.pujaCatalogId)?.name ?? '',
      cell: (r) => {
        const p = PUJA_BY_ID.get(r.booking.pujaCatalogId)
        return (
          <div className="min-w-0">
            <p className="truncate">{p?.name}</p>
            <p className="truncate text-sm text-muted">{p?.deity}</p>
          </div>
        )
      },
    },
    {
      key: 'cadence',
      header: 'Rhythm',
      sortValue: (r) => r.booking.cadence,
      cell: (r) => titleCase(r.booking.cadence),
    },
    {
      key: 'start',
      header: 'First puja',
      sortValue: (r) => r.booking.startDate,
      cell: (r) => (
        <span className="whitespace-nowrap text-muted">{fmtDate(r.booking.startDate)}</span>
      ),
    },
    {
      key: 'priest',
      header: 'Priest',
      sortValue: (r) => r.booking.assignedPriestId ?? '',
      cell: (r) => {
        const priest = PRIESTS.find((p) => p.id === r.booking.assignedPriestId)
        return priest ? (
          <Badge variant="leaf">{priest.name}</Badge>
        ) : (
          <Badge variant="gold">Unassigned</Badge>
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
  ]

  const isWaiting = open?.approval?.stage === 'committee-review'

  return (
    <PageShell
      eyebrow="Operations"
      title="Priest assignment"
      description={`${waiting.length} cleared sponsorship${
        waiting.length === 1 ? '' : 's'
      } waiting for a priest`}
      toolbar={
        <Chips
          items={[
            { key: 'committee-review', label: 'Awaiting a priest' },
            { key: 'scheduled', label: 'Assigned' },
          ]}
          value={filter}
          onChange={(k) => setFilter(k as 'committee-review' | 'scheduled')}
        />
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Awaiting a priest"
          value={waiting.length}
          sub="Payment already verified"
          Icon={Clock}
          tone="gold"
        />
        <StatTile
          label="Assigned this session"
          value={assigned.length}
          sub="Live on the roster"
          Icon={CalendarCheck}
          tone="leaf"
        />
        <StatTile
          label="Priests available"
          value={PRIESTS.length}
          sub="From the temple staff roll"
          Icon={UserCheck}
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
          initialSort={{ key: 'start', dir: 'asc' }}
          empty={{
            title:
              filter === 'committee-review'
                ? 'No sponsorships waiting'
                : 'Nothing assigned yet',
            detail:
              filter === 'committee-review'
                ? 'Accounts has not cleared anything new.'
                : 'Assign a priest to a cleared sponsorship to see it here.',
          }}
        />
      )}

      <Sheet
        open={Boolean(open)}
        onClose={closeSheet}
        title={openDevotee?.name ?? 'Booking'}
        description={
          open
            ? `${PUJA_BY_ID.get(open.pujaCatalogId)?.name} · ${titleCase(open.cadence)} · from ${fmtDate(
                open.startDate,
              )}`
            : undefined
        }
        className="max-w-lg"
        footer={
          open && isWaiting ? (
            <>
              <Button variant="plain" size="sm" onClick={() => setDeclining(true)} disabled={busy}>
                <Ban />
                Decline
              </Button>
              <Button
                size="sm"
                disabled={busy || !priestId}
                onClick={async () => {
                  setBusy(true)
                  await assignPriest(open.id, actor, priestId, note)
                  setBusy(false)
                  closeSheet()
                  toast('Priest assigned · sponsorship is now live')
                  refresh()
                }}
              >
                {busy ? <Loader2 className="animate-spin" /> : <Check />}
                Assign &amp; approve
              </Button>
            </>
          ) : null
        }
      >
        {open ? (
          <div className="space-y-5">
            <Card className="space-y-2 p-4 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-muted">Sankalpam</span>
                <span className="max-w-[60%] text-right">{open.sankalpamNames.join(', ')}</span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-muted">Payment</span>
                <span>
                  {titleCase(open.payment?.method ?? '—')} ·{' '}
                  <span className="font-mono text-xs">{open.payment?.reference}</span>
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-muted">Verified</span>
                <span className="text-leaf-600">
                  {open.payment?.verifiedAt ? fmtDate(open.payment.verifiedAt) : '—'}
                </span>
              </div>
            </Card>

            {isWaiting ? (
              <Card className="space-y-3 p-4">
                <h3 className="text-sm font-medium text-ink">Who will officiate?</h3>
                <p className="text-xs leading-relaxed text-muted">
                  This priest is put on every day the sponsorship generates. Individual days can
                  be moved afterwards.
                </p>
                <Field label="Priest" htmlFor="ca-priest">
                  <Select
                    id="ca-priest"
                    value={priestId}
                    onChange={(e) => setPriestId(e.target.value)}
                  >
                    {PRIESTS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.title}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Note" hint="optional" htmlFor="ca-note">
                  <Textarea
                    id="ca-note"
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Devotee asked for the Samadhi Mandir aarti."
                  />
                </Field>
              </Card>
            ) : null}

            {/* Per-day reassignment. Only meaningful once days exist, which is only
                after the booking has been approved. */}
            {open.approval?.stage === 'scheduled' ? (
              <Card className="p-4">
                <h3 className="text-sm font-medium text-ink">Days on the roster</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Change any single day without disturbing the rest of the series.
                </p>
                {daysLoading ? (
                  <LoadingSkeleton variant="text" rows={3} className="mt-3" />
                ) : days && days.length > 0 ? (
                  <ul className="mt-3 divide-y divide-line">
                    {days.map((o: PujaOccurrence) => (
                      <li key={o.id} className="flex items-center gap-3 py-2.5">
                        <span className="min-w-0 flex-1 text-sm">
                          {fmtDateTime(o.scheduledAt)}
                        </span>
                        <Select
                          aria-label={`Priest for ${fmtDate(o.scheduledAt)}`}
                          className="h-8 w-[170px] text-sm"
                          value={o.officiantId ?? ''}
                          onChange={async (e) => {
                            await setOccurrenceOfficiant(o.id, e.target.value)
                            toast('Day reassigned')
                            refreshDays()
                          }}
                        >
                          {PRIESTS.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </Select>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-muted">
                    No days fall inside the next thirty days.
                  </p>
                )}
              </Card>
            ) : null}

            {declining ? (
              <Card className="space-y-3 border-brand-500/30 bg-brand-500/[0.04] p-4">
                <h3 className="text-sm font-medium text-ink">Decline this sponsorship</h3>
                <Field label="Reason" hint="required" htmlFor="ca-reason">
                  <Textarea
                    id="ca-reason"
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="No priest available for this rhythm — devotee to be offered an alternative."
                  />
                </Field>
                <div className="flex justify-end gap-2">
                  <Button variant="plain" size="sm" onClick={() => setDeclining(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={busy || !reason.trim()}
                    onClick={async () => {
                      setBusy(true)
                      await declineBooking(open.id, actor, reason)
                      setBusy(false)
                      closeSheet()
                      toast('Sponsorship declined', { tone: 'warn' })
                      refresh()
                    }}
                  >
                    Decline
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
