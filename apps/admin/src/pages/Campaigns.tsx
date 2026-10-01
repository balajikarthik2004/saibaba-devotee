import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  Send,
  Trash2,
  TriangleAlert,
  Users,
} from 'lucide-react'
import type { TempleEvent, VolunteerCampaign } from '@/lib/data/types'
import { PageShell } from '@/components/layout/PageShell'
import { Chips } from '@/components/ui/tabs'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { StatTile } from '@/components/shared/StatTile'
import { StatusPill } from '@/components/shared/badges'
import { StaffingMeter, countConfirmed } from '@/components/shared/StaffingMeter'
import { LoadingSkeleton } from '@/components/shared/states'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog } from '@/components/ui/overlay'
import { useToast } from '@/components/ui/toast'
import {
  deleteCampaign,
  listCampaignAssignments,
  listCampaignInvites,
  listCampaigns,
  listEvents,
} from '@/lib/data/api'
import { useAsync } from '@/lib/hooks'
import { fmtDate, fmtRelative } from '@/lib/utils'

/**
 * Every volunteer campaign, at whatever stage it has reached.
 *
 * The one number this page exists to show is the staffing gap: needed against confirmed.
 * A coordinator opening this on the Tuesday before a festival is asking one question —
 * which of these is short — and everything else on the row is context for that.
 *
 * Pending places are drawn into the meter but not counted as filled. Eight people who
 * said yes and have not confirmed a shift is not eight people at the parking gate, and a
 * meter that reads full on unconfirmed acceptances is a meter that gets somebody stood up.
 */

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'recruiting', label: 'Recruiting' },
  { key: 'staffed', label: 'Staffed' },
  { key: 'completed', label: 'Completed' },
]

interface Row {
  campaign: VolunteerCampaign
  event?: TempleEvent
  needed: number
  confirmed: number
  pending: number
  invited: number
  accepted: number
  awaiting: number
}

export default function Campaigns() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')
  const [confirmDelete, setConfirmDelete] = useState<VolunteerCampaign | null>(null)
  const [busy, setBusy] = useState(false)

  /* One load builds the whole table: campaigns, the festivals behind them, and the
     invites and rosters each one has drawn. Loading the counts per row instead meant
     a table that finished rendering before it finished being true. */
  const { data, loading, refresh } = useAsync(async () => {
    const [campaigns, events] = await Promise.all([listCampaigns(), listEvents()])
    const detail = await Promise.all(
      campaigns.map(async (c) => ({
        campaign: c,
        invites: await listCampaignInvites(c.id),
        assignments: await listCampaignAssignments(c.id),
      })),
    )
    return { events, detail }
  }, [])

  const rows: Row[] = useMemo(() => {
    if (!data) return []
    return data.detail.map(({ campaign, invites, assignments }) => ({
      campaign,
      event: data.events.find((e) => e.id === campaign.eventId),
      needed: campaign.needs.reduce((s, n) => s + n.needed, 0),
      confirmed: countConfirmed(assignments),
      pending: assignments.filter((a) => a.status === 'pending').length,
      invited: invites.length,
      accepted: invites.filter((i) => i.status === 'accepted').length,
      awaiting: invites.filter((i) => i.status === 'sent').length,
    }))
  }, [data])

  const shown = rows.filter((r) => (filter === 'all' ? true : r.campaign.status === filter))

  async function remove() {
    if (!confirmDelete) return
    setBusy(true)
    try {
      await deleteCampaign(confirmDelete.id)
      toast('Campaign deleted', {
        detail: 'Its outreach history and roster went with it.',
        tone: 'info',
      })
      setConfirmDelete(null)
      refresh()
    } finally {
      setBusy(false)
    }
  }

  const columns: Column<Row>[] = [
    {
      key: 'title',
      header: 'Campaign',
      sortValue: (r) => r.campaign.title,
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{r.campaign.title}</p>
          <p className="truncate text-2xs text-muted">
            {r.event ? r.event.title : 'Festival no longer listed'}
            {r.event ? ` · ${fmtDate(r.event.date)}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'briefing',
      header: 'Briefing',
      sortValue: (r) => r.campaign.briefingAt,
      cell: (r) => (
        <div className="whitespace-nowrap">
          <p className="tabular-nums text-ink-soft">{fmtDate(r.campaign.briefingAt)}</p>
          <p className="text-2xs text-muted">{fmtRelative(r.campaign.briefingAt)}</p>
        </div>
      ),
    },
    {
      key: 'staffing',
      header: 'Staffing',
      sortValue: (r) => (r.needed ? r.confirmed / r.needed : 0),
      className: 'min-w-[190px]',
      cell: (r) => <StaffingMeter needed={r.needed} confirmed={r.confirmed} pending={r.pending} />,
    },
    {
      key: 'outreach',
      header: 'Outreach',
      sortValue: (r) => r.invited,
      cell: (r) =>
        r.invited === 0 ? (
          <span className="text-sm text-faint">Not sent yet</span>
        ) : (
          <div className="whitespace-nowrap text-sm">
            <p className="text-ink-soft">
              <span className="font-semibold tabular-nums text-ink">{r.accepted}</span> of{' '}
              <span className="tabular-nums">{r.invited}</span> accepted
            </p>
            {r.awaiting > 0 ? (
              <p className="text-2xs text-muted">{r.awaiting} still to reply</p>
            ) : (
              <p className="text-2xs text-faint">All replied</p>
            )}
          </div>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (r) => r.campaign.status,
      cell: (r) => <StatusPill status={r.campaign.status} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (r) => (
        <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="plain"
            size="icon-sm"
            onClick={() => navigate(`/volunteers/campaigns/${r.campaign.id}/edit`)}
            aria-label={`Edit ${r.campaign.title}`}
          >
            <Pencil />
          </Button>
          <Button
            variant="plain"
            size="icon-sm"
            onClick={() => setConfirmDelete(r.campaign)}
            aria-label={`Delete ${r.campaign.title}`}
          >
            <Trash2 />
          </Button>
        </div>
      ),
    },
  ]

  const live = rows.filter((r) => r.campaign.status === 'recruiting')
  const stats = {
    live: live.length,
    short: rows.filter(
      (r) => r.campaign.status !== 'completed' && r.campaign.status !== 'cancelled' && r.confirmed < r.needed,
    ).length,
    awaiting: rows.reduce((s, r) => s + r.awaiting, 0),
    confirmed: rows
      .filter((r) => r.campaign.status !== 'completed')
      .reduce((s, r) => s + r.confirmed, 0),
  }

  return (
    <PageShell
      eyebrow="People"
      title="Volunteer campaigns"
      description={`${shown.length} of ${rows.length} campaigns`}
      actions={
        <>
          <Link to="/volunteers" className={buttonVariants({ variant: 'outline' })}>
            <Users /> Volunteer pool
          </Link>
          <Link to="/volunteers/campaigns/new" className={buttonVariants({})}>
            <Plus /> New campaign
          </Link>
        </>
      }
      toolbar={<Chips items={FILTERS} value={filter} onChange={setFilter} />}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Recruiting now" value={stats.live} Icon={Megaphone} tone="brand" />
        <StatTile
          label="Short of target"
          value={stats.short}
          sub="Confirmed below what was asked"
          Icon={TriangleAlert}
          tone={stats.short > 0 ? 'gold' : 'leaf'}
        />
        <StatTile
          label="Awaiting a reply"
          value={stats.awaiting}
          sub="Invites sent, nothing back"
          Icon={Send}
        />
        <StatTile
          label="Volunteers confirmed"
          value={stats.confirmed}
          sub="Across live campaigns"
          Icon={Users}
          tone="leaf"
        />
      </div>

      <div className="mt-5">
        {loading ? (
          <LoadingSkeleton variant="table" rows={6} />
        ) : (
          <DataTable
            rows={shown}
            columns={columns}
            rowKey={(r) => r.campaign.id}
            onRowClick={(r) => navigate(`/volunteers/campaigns/${r.campaign.id}`)}
            initialSort={{ key: 'briefing', dir: 'asc' }}
            empty={{
              title: 'No campaigns here',
              detail:
                filter === 'all'
                  ? 'Start one against a festival and the volunteer ask follows from it.'
                  : 'Nothing at this stage. Try another filter.',
            }}
          />
        )}
      </div>

      <Dialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title={`Delete ${confirmDelete?.title ?? ''}?`}
        description="The volunteers stay in the pool; this campaign's outreach and roster do not."
        footer={
          <>
            <Button variant="subtle" onClick={() => setConfirmDelete(null)} disabled={busy}>
              Keep
            </Button>
            <Button variant="destructive" onClick={remove} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">
          Every invitation sent for this campaign, and every roster place built from those
          replies, is deleted with it. Cancelling the campaign instead keeps the record of
          who was asked.
        </p>
      </Dialog>
    </PageShell>
  )
}
