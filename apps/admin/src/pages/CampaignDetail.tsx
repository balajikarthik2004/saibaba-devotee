import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Ban,
  Check,
  CheckCheck,
  Clock,
  Info,
  Loader2,
  Mail,
  MailQuestion,
  Megaphone,
  MessageSquare,
  Pencil,
  Plus,
  Send,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  UserPlus,
  Users,
  UserX,
} from 'lucide-react'
import type {
  StaffingRow,
  TempleEvent,
  Volunteer,
  VolunteerAssignment,
  VolunteerAudience,
  VolunteerCampaign,
  VolunteerChannel,
  VolunteerInvite,
  VolunteerMessage,
  VolunteerSkill,
} from '@/lib/data/types'
import { PageShell } from '@/components/layout/PageShell'
import { Tabs } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/input'
import { Avatar, Badge, Progress, Separator } from '@/components/ui/badge'
import { Dialog, Sheet } from '@/components/ui/overlay'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { StatTile } from '@/components/shared/StatTile'
import { StatusPill } from '@/components/shared/badges'
import { StaffingMeter } from '@/components/shared/StaffingMeter'
import { EmptyState, LoadingSkeleton } from '@/components/shared/states'
import { useToast } from '@/components/ui/toast'
import {
  addAssignment,
  confirmAllPending,
  createVolunteer,
  getCampaignById,
  getCampaignStaffing,
  getEventById,
  listCampaignAssignments,
  listCampaignInvites,
  listCampaignMessages,
  listVolunteers,
  previewAudience,
  recordInviteResponse,
  removeAssignment,
  sendCampaignMessage,
  setCampaignStatus,
  updateAssignment,
} from '@/lib/data/api'
import { CITIES, STAFF, VOLUNTEER_ROLES, VOLUNTEER_SHIFTS, roleLabel } from '@/lib/data/mock'
import { useAsync } from '@/lib/hooks'
import { fmtDate, fmtDateTime, fmtRelative, titleCase } from '@/lib/utils'

/**
 * One campaign, in the order the work actually happens: what was asked, who was asked,
 * and who is on the sheet.
 *
 * The three tabs are the three stages, and they are tabs rather than one long page
 * because a coordinator is only ever doing one of them at a time — composing a broadcast
 * on a Monday, working the phone on a Wednesday, printing the roster on the Friday.
 *
 * Nothing here sends real email or SMS. There is no gateway wired to this app, and the
 * compose panel says so where the send button is, not in a footnote: the message is
 * addressed, previewed and recorded exactly as it would go out, and then goes nowhere.
 * A screen that implied otherwise would be the one bug in this feature nobody could see.
 */

const MERGE_TAGS = [
  { tag: '{{name}}', detail: "the volunteer's own name" },
  { tag: '{{festival}}', detail: 'the festival this campaign staffs' },
  { tag: '{{role}}', detail: 'the roles still short, as a list' },
]

/** The SMS carrier limit. A longer body is not rejected, it is silently split and billed twice. */
const SMS_LIMIT = 160

const DEFAULT_EMAIL =
  'Vanakkam {{name}},\n\n' +
  'The temple is preparing for {{festival}}, and we are looking for volunteers to help the ' +
  'day run smoothly. If you can spare a few hours we would be grateful for your seva — the ' +
  'areas we most need help with are {{role}}.\n\n' +
  'Reply to this note and the coordinator will place you on a shift and send the briefing ' +
  'details. There is no obligation, and a "not this time" is always welcome.\n\n' +
  'With Baba’s blessings,\nShree Saibaba temple office'

const DEFAULT_SMS =
  'Shree Saibaba: Volunteers needed for {{festival}}. Can you help with {{role}}? Reply YES to join.'

function fillTags(body: string, vars: { name: string; festival: string; role: string }) {
  return body
    .replaceAll('{{name}}', vars.name)
    .replaceAll('{{festival}}', vars.festival)
    .replaceAll('{{role}}', vars.role)
}

export default function CampaignDetail() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [tab, setTab] = useState('overview')

  const { data, loading, refresh } = useAsync(async () => {
    const campaign = await getCampaignById(id)
    if (!campaign) return null
    const [event, staffing, messages, invites, assignments, pool] = await Promise.all([
      getEventById(campaign.eventId),
      getCampaignStaffing(campaign.id),
      listCampaignMessages(campaign.id),
      listCampaignInvites(campaign.id),
      listCampaignAssignments(campaign.id),
      listVolunteers(),
    ])
    return { campaign, event, staffing, messages, invites, assignments, pool }
  }, [id])

  if (loading) {
    return (
      <PageShell title="Campaign" description="Loading…">
        <LoadingSkeleton variant="tiles" rows={4} />
      </PageShell>
    )
  }

  if (!data) {
    return (
      <PageShell title="Campaign not found">
        <Link to="/volunteers/campaigns" className={buttonVariants({ size: 'sm' })}>
          Back to campaigns
        </Link>
      </PageShell>
    )
  }

  const { campaign, event, staffing, messages, invites, assignments, pool } = data
  const byId = new Map(pool.map((v) => [v.id, v]))
  const coordinator = STAFF.find((s) => s.id === campaign.coordinatorId)

  const needed = campaign.needs.reduce((s, n) => s + n.needed, 0)
  const confirmed = assignments.filter(
    (a) => a.status === 'confirmed' || a.status === 'checked-in',
  ).length
  const pending = assignments.filter((a) => a.status === 'pending').length
  const awaiting = invites.filter((i) => i.status === 'sent').length

  return (
    <PageShell
      eyebrow="People"
      title={campaign.title}
      description={
        event
          ? `${event.title} · briefing ${fmtDateTime(campaign.briefingAt)}`
          : `Briefing ${fmtDateTime(campaign.briefingAt)}`
      }
      back={{ to: '/volunteers/campaigns', label: 'All campaigns' }}
      actions={
        <>
          <StatusPill status={campaign.status} />
          <Link
            to={`/volunteers/campaigns/${campaign.id}/edit`}
            className={buttonVariants({ variant: 'outline' })}
          >
            <Pencil /> Edit the ask
          </Link>
        </>
      }
      tabs={
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { key: 'overview', label: 'Overview' },
            { key: 'outreach', label: 'Outreach', count: invites.length },
            { key: 'roster', label: 'Roster', count: assignments.length },
          ]}
        />
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Asked for"
          value={needed}
          sub={`${campaign.needs.length} roles`}
          Icon={Users}
        />
        <StatTile
          label="Confirmed"
          value={confirmed}
          sub={pending > 0 ? `${pending} accepted, not confirmed` : 'All places confirmed'}
          Icon={CheckCheck}
          tone={confirmed >= needed ? 'leaf' : 'brand'}
        />
        <StatTile
          label="Invited"
          value={invites.length}
          sub={awaiting > 0 ? `${awaiting} still to reply` : 'Everyone has replied'}
          Icon={Send}
          tone="gold"
        />
        <StatTile
          label="Coordinator"
          value={coordinator?.name.split(' ')[0] ?? '—'}
          sub={coordinator?.title}
        />
      </div>

      <div className="mt-5">
        {tab === 'overview' ? (
          <OverviewTab
            campaign={campaign}
            event={event}
            staffing={staffing}
            invites={invites}
            assignments={assignments}
            onStatus={async (status) => {
              await setCampaignStatus(campaign.id, status)
              toast('Campaign status updated', { detail: titleCase(status), tone: 'success' })
              refresh()
            }}
          />
        ) : null}

        {tab === 'outreach' ? (
          <OutreachTab
            campaign={campaign}
            event={event}
            staffing={staffing}
            messages={messages}
            invites={invites}
            byId={byId}
            onChanged={refresh}
          />
        ) : null}

        {tab === 'roster' ? (
          <RosterTab
            campaign={campaign}
            assignments={assignments}
            pool={pool}
            byId={byId}
            onChanged={refresh}
            onGoto={() => navigate('/volunteers')}
          />
        ) : null}
      </div>
    </PageShell>
  )
}

/* ------------------------------------------------------------------ overview */

function OverviewTab({
  campaign,
  event,
  staffing,
  invites,
  assignments,
  onStatus,
}: {
  campaign: VolunteerCampaign
  event: TempleEvent | null
  staffing: StaffingRow[]
  invites: VolunteerInvite[]
  assignments: VolunteerAssignment[]
  onStatus: (status: VolunteerCampaign['status']) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)

  const funnel = [
    { label: 'Invited', value: invites.length, Icon: Send },
    { label: 'Accepted', value: invites.filter((i) => i.status === 'accepted').length, Icon: ThumbsUp },
    { label: 'Declined', value: invites.filter((i) => i.status === 'declined').length, Icon: ThumbsDown },
    {
      label: 'No answer',
      value: invites.filter((i) => i.status === 'no-response').length,
      Icon: MailQuestion,
    },
    { label: 'Awaiting', value: invites.filter((i) => i.status === 'sent').length, Icon: Clock },
  ]

  const direct = assignments.filter((a) => a.source === 'direct').length
  const checkedIn = assignments.filter((a) => a.status === 'checked-in').length
  const noShow = assignments.filter((a) => a.status === 'no-show').length

  return (
    <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr] xl:items-start">
      <div className="space-y-5">
        <Card className="p-5">
          <h2 className="font-serif text-lg text-ink">Staffing by role</h2>
          <p className="mt-1 text-sm text-muted">
            Confirmed against what was asked for. Accepted-but-unconfirmed places are listed
            separately — an acceptance is not a body at the gate.
          </p>

          {staffing.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No roles on this campaign yet.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {staffing.map((row) => (
                <li key={row.roleKey}>
                  <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-ink">{row.label}</span>
                    <span className="text-sm tabular-nums text-muted">
                      <span className="font-semibold text-ink">{row.confirmed}</span> / {row.needed}
                      {row.pending > 0 ? ` · ${row.pending} pending` : ''}
                    </span>
                  </div>
                  <Progress
                    value={row.needed ? (row.confirmed / row.needed) * 100 : 100}
                    tone={row.confirmed >= row.needed ? 'leaf' : 'brand'}
                    label={`${row.label} — ${row.confirmed} of ${row.needed} confirmed`}
                  />
                  {row.short > 0 ? (
                    <p className="mt-1 text-2xs font-medium text-brand-600">
                      {row.short} still to find
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-serif text-lg text-ink">What the outreach produced</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {funnel.map((f) => (
              <div
                key={f.label}
                className="rounded-[var(--radius)] border border-line bg-faint/40 px-3 py-2.5"
              >
                <f.Icon className="size-3.5 text-faint" />
                <p className="mt-1.5 font-serif text-xl tabular-nums text-ink">{f.value}</p>
                <p className="text-2xs text-muted">{f.label}</p>
              </div>
            ))}
          </div>

          <Separator className="my-4" />

          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="eyebrow">Added directly</dt>
              <dd className="mt-0.5 tabular-nums text-ink">
                {direct}
                <span className="ml-1 text-xs text-muted">never invited</span>
              </dd>
            </div>
            <div>
              <dt className="eyebrow">Checked in</dt>
              <dd className="mt-0.5 tabular-nums text-ink">{checkedIn}</dd>
            </div>
            <div>
              <dt className="eyebrow">No-shows</dt>
              <dd className="mt-0.5 tabular-nums text-ink">{noShow}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <div className="space-y-5">
        <Card className="p-5">
          <h2 className="font-serif text-lg text-ink">The ask</h2>
          {campaign.description ? (
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{campaign.description}</p>
          ) : null}

          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="eyebrow">Festival</dt>
              <dd className="mt-0.5 text-ink">
                {event ? (
                  <Link to="/events" className="font-medium text-brand-600 hover:underline">
                    {event.title}
                  </Link>
                ) : (
                  'No longer listed'
                )}
                {event ? (
                  <span className="ml-1.5 text-muted">{fmtDate(event.date)}</span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="eyebrow">Briefing</dt>
              <dd className="mt-0.5 text-ink">
                {fmtDateTime(campaign.briefingAt)}
                <span className="ml-1.5 text-muted">{fmtRelative(campaign.briefingAt)}</span>
              </dd>
            </div>
            <div>
              <dt className="eyebrow">Created</dt>
              <dd className="mt-0.5 text-muted">{fmtDate(campaign.createdAt)}</dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {campaign.needs.map((n) => (
              <Badge key={n.roleKey} variant="outline" title={n.blurb}>
                {n.label} · {n.needed}
              </Badge>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-serif text-lg text-ink">Move this along</h2>
          <p className="mt-1 text-sm text-muted">
            Recruiting to staffed is the coordinator's own call, not a computed one — a role
            one short can still be fine, and only they know that.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(
              [
                ['recruiting', 'Reopen recruiting', Megaphone],
                ['staffed', 'Mark staffed', CheckCheck],
                ['completed', 'Close out', Check],
                ['cancelled', 'Cancel', Ban],
              ] as const
            ).map(([status, label, Icon]) => (
              <Button
                key={status}
                variant={status === 'cancelled' ? 'outline' : 'ghost'}
                size="sm"
                disabled={busy || campaign.status === status}
                onClick={async () => {
                  setBusy(true)
                  try {
                    await onStatus(status)
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                {busy ? <Loader2 className="animate-spin" /> : <Icon />} {label}
              </Button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ outreach */

function OutreachTab({
  campaign,
  event,
  staffing,
  messages,
  invites,
  byId,
  onChanged,
}: {
  campaign: VolunteerCampaign
  event: TempleEvent | null
  staffing: StaffingRow[]
  messages: VolunteerMessage[]
  invites: VolunteerInvite[]
  byId: Map<string, Volunteer>
  onChanged: () => void
}) {
  const { toast } = useToast()
  const [channel, setChannel] = useState<VolunteerChannel>('both')
  // The festival, not the campaign title — a campaign is usually named "<festival> —
  // volunteer drive", which made the default subject read "Volunteers needed — Chithirai
  // Festival — volunteer drive".
  const [subject, setSubject] = useState(
    `Volunteers needed — ${event?.title ?? campaign.title}`,
  )
  const [body, setBody] = useState(DEFAULT_EMAIL)
  const [smsBody, setSmsBody] = useState(DEFAULT_SMS)
  const [skills, setSkills] = useState<VolunteerSkill[]>([])
  const [city, setCity] = useState('')
  const [excludeInvited, setExcludeInvited] = useState(invites.length > 0)
  const [excludeRostered, setExcludeRostered] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [reviewing, setReviewing] = useState<VolunteerInvite | null>(null)

  const audience: VolunteerAudience = useMemo(
    () => ({
      skills,
      city: city || undefined,
      excludeInvited,
      excludeRostered,
    }),
    [skills, city, excludeInvited, excludeRostered],
  )

  /* The recipient list is resolved by the same function the send uses, so the count above
     the button is the number of invites the button creates — never a separate estimate. */
  const [recipients, setRecipients] = useState<Volunteer[]>([])
  const [counting, setCounting] = useState(true)

  const recount = useCallback(async () => {
    setCounting(true)
    try {
      setRecipients(await previewAudience(campaign.id, audience))
    } finally {
      setCounting(false)
    }
  }, [campaign.id, audience])

  useEffect(() => {
    let live = true
    setCounting(true)
    previewAudience(campaign.id, audience)
      .then((r) => live && setRecipients(r))
      .finally(() => live && setCounting(false))
    return () => {
      live = false
    }
  }, [campaign.id, audience])

  const shortRoles = staffing.filter((s) => s.short > 0)
  const roleList = (shortRoles.length ? shortRoles : staffing).map((s) => s.label).join(', ')
  const festivalName = event?.title ?? campaign.title
  const sample = recipients[0]

  const emailPreview = fillTags(body, {
    name: sample?.name.split(' ')[0] ?? 'Lakshmi',
    festival: festivalName,
    role: roleList || 'whatever is needed',
  })
  const smsPreview = fillTags(smsBody, {
    name: sample?.name.split(' ')[0] ?? 'Lakshmi',
    festival: festivalName,
    role: roleList || 'whatever is needed',
  })

  const sendsEmail = channel === 'email' || channel === 'both'
  const sendsSms = channel === 'sms' || channel === 'both'

  const toggleSkill = (key: VolunteerSkill) =>
    setSkills((s) => (s.includes(key) ? s.filter((x) => x !== key) : [...s, key]))

  async function send() {
    if (recipients.length === 0) return setError('That audience matches nobody. Widen the filter.')
    if (sendsEmail && !subject.trim()) return setError('An email needs a subject line.')
    if (sendsEmail && !body.trim()) return setError('The email body is empty.')
    if (sendsSms && !smsBody.trim()) return setError('The SMS body is empty.')

    setSending(true)
    setError('')
    try {
      const { invites: minted } = await sendCampaignMessage(campaign.id, {
        channel,
        subject: subject.trim(),
        // Both bodies are kept in one record: `both` sends the same ask down two pipes,
        // and storing only one would make the history a half-truth.
        body: sendsEmail ? body : smsBody,
        audience,
        sentByName: STAFF.find((s) => s.id === campaign.coordinatorId)?.name ?? 'Temple office',
      })
      toast(`Recorded a simulated send to ${recipients.length}`, {
        detail:
          minted.length === recipients.length
            ? `${minted.length} invitations created. No mail actually left the building.`
            : `${minted.length} new invitations; the rest were reminders to people already asked.`,
        tone: 'success',
      })
      setExcludeInvited(true)
      onChanged()
      recount()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  const inviteColumns: Column<VolunteerInvite>[] = [
    {
      key: 'who',
      header: 'Volunteer',
      sortValue: (i) => byId.get(i.volunteerId)?.name ?? '',
      cell: (i) => {
        const v = byId.get(i.volunteerId)
        return (
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar initials={v?.avatarInitials ?? '??'} className="size-7 text-2xs" />
            <div className="min-w-0">
              <p className="truncate font-medium text-ink">{v?.name ?? 'Removed volunteer'}</p>
              <p className="truncate text-2xs text-muted">
                {i.channel === 'sms' ? v?.phone : v?.email}
              </p>
            </div>
          </div>
        )
      },
    },
    {
      key: 'channel',
      header: 'Sent by',
      cell: (i) => (
        <Badge variant="outline">
          {i.channel === 'sms' ? (
            <MessageSquare className="size-3" />
          ) : (
            <Mail className="size-3" />
          )}
          {i.channel === 'both' ? 'Email + SMS' : titleCase(i.channel)}
        </Badge>
      ),
    },
    {
      key: 'sent',
      header: 'Sent',
      sortValue: (i) => i.sentAt,
      cell: (i) => <span className="whitespace-nowrap text-muted">{fmtRelative(i.sentAt)}</span>,
    },
    {
      key: 'status',
      header: 'Reply',
      sortValue: (i) => i.status,
      cell: (i) => (
        <div className="min-w-0">
          <StatusPill status={i.status} />
          {i.note ? <p className="mt-1 truncate text-2xs text-muted">{i.note}</p> : null}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (i) =>
        i.status === 'sent' ? (
          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" onClick={() => respond(i, 'accepted')}>
              <ThumbsUp /> Accepted
            </Button>
            <Button variant="outline" size="sm" onClick={() => setReviewing(i)}>
              <ThumbsDown /> Declined
            </Button>
          </div>
        ) : (
          <span className="text-2xs text-faint">
            {i.respondedAt ? fmtDate(i.respondedAt) : '—'}
          </span>
        ),
    },
  ]

  async function respond(
    invite: VolunteerInvite,
    response: 'accepted' | 'declined' | 'no-response',
    note?: string,
  ) {
    const v = byId.get(invite.volunteerId)
    const { assignment } = await recordInviteResponse(invite.id, response, note)
    toast(
      response === 'accepted'
        ? `${v?.name ?? 'Volunteer'} accepted`
        : response === 'declined'
          ? 'Decline recorded'
          : 'Marked as no answer',
      {
        detail: assignment
          ? 'Added to the roster as pending — set their shift on the Roster tab.'
          : response === 'accepted'
            ? 'Already on the roster.'
            : undefined,
        tone: response === 'accepted' ? 'success' : 'info',
      },
    )
    setReviewing(null)
    onChanged()
    recount()
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1.15fr] xl:items-start">
      <Card className="p-5">
        <h2 className="font-serif text-lg text-ink">Ask the pool</h2>
        <p className="mt-1 text-sm text-muted">
          One message, one invitation per person reached. Somebody already asked gets their
          invitation re-dated rather than a second one, so the reply tallies stay a count of
          people.
        </p>

        <div className="mt-4 space-y-4">
          <Field label="Channel">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['email', 'Email', Mail],
                  ['sms', 'SMS', MessageSquare],
                  ['both', 'Email + SMS', Send],
                ] as const
              ).map(([key, label, Icon]) => (
                <Button
                  key={key}
                  variant={channel === key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChannel(key)}
                >
                  <Icon /> {label}
                </Button>
              ))}
            </div>
          </Field>

          <Field label="Who hears about it" hint="leave skills blank to ask everybody">
            <div className="space-y-2.5 rounded-[var(--radius)] border border-line bg-faint/40 p-3">
              <div className="flex flex-wrap gap-1.5">
                {VOLUNTEER_ROLES.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    aria-pressed={skills.includes(r.key)}
                    onClick={() => toggleSkill(r.key)}
                    title={r.blurb}
                    className={
                      'rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors ' +
                      (skills.includes(r.key)
                        ? 'border-brand-500 bg-brand-500 text-white'
                        : 'border-line bg-card text-muted hover:border-muted hover:text-ink')
                    }
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Select value={city} onChange={(e) => setCity(e.target.value)}>
                  <option value="">Any city</option>
                  {CITIES.map((c) => (
                    <option key={c.city} value={c.city}>
                      {c.city}
                    </option>
                  ))}
                </Select>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
                <Checkbox
                  checked={excludeInvited}
                  onChange={(e) => setExcludeInvited(e.target.checked)}
                />
                Skip anybody already invited to this campaign
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
                <Checkbox
                  checked={excludeRostered}
                  onChange={(e) => setExcludeRostered(e.target.checked)}
                />
                Skip anybody already on the roster
              </label>

              <p className="text-2xs text-faint">
                Paused volunteers are always left out, whatever the filter says.
              </p>
            </div>
          </Field>

          {sendsEmail ? (
            <>
              <Field label="Subject" htmlFor="out-subject">
                <Input
                  id="out-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </Field>
              <Field label="Email body" htmlFor="out-body">
                <Textarea
                  id="out-body"
                  rows={9}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </Field>
            </>
          ) : null}

          {sendsSms ? (
            <Field
              label="SMS body"
              hint={`${smsPreview.length} / ${SMS_LIMIT} characters once filled in`}
              htmlFor="out-sms"
              error={
                smsPreview.length > SMS_LIMIT
                  ? 'Over one message — this will be split and billed twice.'
                  : undefined
              }
            >
              <Textarea
                id="out-sms"
                rows={3}
                value={smsBody}
                onChange={(e) => setSmsBody(e.target.value)}
              />
            </Field>
          ) : null}

          <div className="rounded-[var(--radius)] border border-line bg-faint/40 p-3">
            <p className="eyebrow mb-1.5">Merge tags</p>
            <ul className="space-y-1 text-xs text-muted">
              {MERGE_TAGS.map((t) => (
                <li key={t.tag}>
                  <code className="rounded bg-ink/[0.06] px-1 py-px font-mono text-2xs text-ink-soft">
                    {t.tag}
                  </code>{' '}
                  — {t.detail}
                </li>
              ))}
            </ul>
          </div>

          {error ? (
            <p className="text-sm font-medium text-brand-600" role="alert">
              {error}
            </p>
          ) : null}

          <div className="rounded-[var(--radius)] border border-saffron-500/30 bg-saffron-500/[0.08] p-3">
            <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-soft">
              <Info className="mt-px size-3.5 shrink-0 text-saffron-600" />
              <span>
                <span className="font-semibold">Simulated send.</span> No email or SMS gateway
                is connected to this console. The message is addressed and recorded exactly
                as it would go out, invitations are created, and nothing is transmitted.
              </span>
            </p>
          </div>

          <Button className="w-full" onClick={send} disabled={sending || counting || recipients.length === 0}>
            {sending ? <Loader2 className="animate-spin" /> : <Send />}
            {counting
              ? 'Working out the audience…'
              : recipients.length === 0
                ? 'Nobody matches this filter'
                : `Record a simulated send to ${recipients.length}`}
          </Button>
        </div>
      </Card>

      <div className="space-y-5">
        <Card className="p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-serif text-lg text-ink">Preview</h2>
            <span className="text-xs text-muted">
              as {sample ? sample.name : 'a sample volunteer'} would receive it
            </span>
          </div>

          {sendsEmail ? (
            <div className="mt-3 overflow-hidden rounded-[var(--radius)] border border-line">
              <div className="border-b border-line bg-faint/60 px-3 py-2">
                <p className="text-2xs text-muted">To</p>
                <p className="truncate text-sm text-ink">
                  {sample ? `${sample.name} <${sample.email}>` : '—'}
                </p>
                <p className="mt-1.5 text-2xs text-muted">Subject</p>
                <p className="truncate text-sm font-medium text-ink">{subject}</p>
              </div>
              <pre className="max-h-[280px] overflow-auto whitespace-pre-wrap px-3 py-3 font-sans text-sm leading-relaxed text-ink-soft">
                {emailPreview}
              </pre>
            </div>
          ) : null}

          {sendsSms ? (
            <div className="mt-3">
              <p className="eyebrow mb-1.5">SMS to {sample?.phone ?? '—'}</p>
              <div className="rounded-[14px] rounded-bl-[4px] bg-brand-500/[0.08] px-3 py-2.5">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
                  {smsPreview}
                </p>
              </div>
              <p
                className={
                  'mt-1 text-2xs tabular-nums ' +
                  (smsPreview.length > SMS_LIMIT ? 'font-semibold text-brand-600' : 'text-faint')
                }
              >
                {smsPreview.length} / {SMS_LIMIT} characters
              </p>
            </div>
          ) : null}
        </Card>

        <Card className="p-5">
          <h2 className="font-serif text-lg text-ink">Sends so far</h2>
          {messages.length === 0 ? (
            <p className="mt-2 text-sm text-muted">
              Nothing has gone out. This campaign is still a draft until the first send.
            </p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {messages.map((m) => (
                <li
                  key={m.id}
                  className="rounded-[var(--radius)] border border-line bg-card px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-medium text-ink">{m.subject}</p>
                    <Badge variant="outline">
                      {m.channel === 'both' ? 'Email + SMS' : titleCase(m.channel)}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-2xs text-muted">
                    {m.recipientIds.length} recipients · {fmtDateTime(m.sentAt)} · {m.sentByName}
                  </p>
                  {m.audience.skills.length > 0 ? (
                    <p className="mt-1 text-2xs text-faint">
                      Filtered to {m.audience.skills.map(roleLabel).join(', ')}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="xl:col-span-2">
        <Card className="p-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-serif text-lg text-ink">Who was asked, and what came back</h2>
            <p className="text-sm text-muted">
              Replies arrive by phone and in person too — record them here.
            </p>
          </div>
          {invites.length === 0 ? (
            <EmptyState
              title="Nobody asked yet"
              detail="Send the first message and every recipient appears here with their reply."
              Icon={MailQuestion}
            />
          ) : (
            <DataTable
              rows={invites}
              columns={inviteColumns}
              rowKey={(i) => i.id}
              initialSort={{ key: 'status', dir: 'asc' }}
              empty={{ title: 'No invitations' }}
            />
          )}
        </Card>
      </div>

      <DeclineDialog
        invite={reviewing}
        name={reviewing ? byId.get(reviewing.volunteerId)?.name : undefined}
        onClose={() => setReviewing(null)}
        onSubmit={respond}
      />
    </div>
  )
}

/**
 * A decline is worth a sentence. "Travelling that week" versus "never asked again" is the
 * difference between chasing somebody next year and quietly dropping them, and this note
 * is the only place that survives.
 */
function DeclineDialog({
  invite,
  name,
  onClose,
  onSubmit,
}: {
  invite: VolunteerInvite | null
  name?: string
  onClose: () => void
  onSubmit: (
    invite: VolunteerInvite,
    response: 'declined' | 'no-response',
    note?: string,
  ) => Promise<void>
}) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (invite) setNote('')
  }, [invite])

  const run = async (response: 'declined' | 'no-response') => {
    if (!invite) return
    setBusy(true)
    try {
      await onSubmit(invite, response, note)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={invite !== null}
      onClose={onClose}
      title={name ? `${name} cannot make it` : 'Record a reply'}
      description="A reason here is what tells next year's coordinator whether to ask again."
      footer={
        <>
          <Button variant="subtle" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="outline" onClick={() => run('no-response')} disabled={busy}>
            <MailQuestion /> No answer
          </Button>
          <Button variant="destructive" onClick={() => run('declined')} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <ThumbsDown />} Record decline
          </Button>
        </>
      }
    >
      <Field label="What did they say?" hint="optional">
        <Textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Travelling that week — happy to help at Deepavali."
        />
      </Field>
    </Dialog>
  )
}

/* -------------------------------------------------------------------- roster */

function RosterTab({
  campaign,
  assignments,
  pool,
  byId,
  onChanged,
  onGoto,
}: {
  campaign: VolunteerCampaign
  assignments: VolunteerAssignment[]
  pool: Volunteer[]
  byId: Map<string, Volunteer>
  onChanged: () => void
  onGoto: () => void
}) {
  const { toast } = useToast()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<VolunteerAssignment | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState<VolunteerAssignment | null>(null)

  const needKeys = campaign.needs.map((n) => n.roleKey)
  const onRoster = new Set(assignments.map((a) => a.volunteerId))
  const available = pool.filter((v) => v.status === 'active' && !onRoster.has(v.id))
  const pendingCount = assignments.filter((a) => a.status === 'pending').length

  async function act(a: VolunteerAssignment, status: VolunteerAssignment['status'], label: string) {
    setBusy(true)
    try {
      await updateAssignment(a.id, { status })
      toast(label, { detail: byId.get(a.volunteerId)?.name, tone: 'success' })
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  const columns: Column<VolunteerAssignment>[] = [
    {
      key: 'who',
      header: 'Volunteer',
      sortValue: (a) => byId.get(a.volunteerId)?.name ?? '',
      cell: (a) => {
        const v = byId.get(a.volunteerId)
        return (
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar initials={v?.avatarInitials ?? '??'} className="size-7 text-2xs" />
            <div className="min-w-0">
              <p className="truncate font-medium text-ink">{v?.name ?? 'Removed volunteer'}</p>
              <p className="truncate text-2xs text-muted">{v?.phone}</p>
            </div>
          </div>
        )
      },
    },
    {
      key: 'role',
      header: 'Role',
      sortValue: (a) => roleLabel(a.roleKey),
      cell: (a) => <span className="text-ink-soft">{roleLabel(a.roleKey)}</span>,
    },
    {
      key: 'shift',
      header: 'Shift',
      sortValue: (a) => a.shift,
      cell: (a) =>
        a.shift === 'Not yet set' ? (
          <span className="text-sm text-faint">Not yet set</span>
        ) : (
          <span className="whitespace-nowrap text-sm text-ink-soft">{a.shift}</span>
        ),
    },
    {
      key: 'source',
      header: 'How',
      sortValue: (a) => a.source,
      cell: (a) => (
        <Badge variant={a.source === 'direct' ? 'gold' : 'outline'}>
          {a.source === 'direct' ? 'Added directly' : 'Accepted an invite'}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (a) => a.status,
      cell: (a) => <StatusPill status={a.status} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (a) => (
        <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          {a.status === 'pending' ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => act(a, 'confirmed', 'Shift confirmed')}
            >
              <Check /> Confirm
            </Button>
          ) : null}
          {a.status === 'confirmed' ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => act(a, 'checked-in', 'Checked in')}
            >
              <CheckCheck /> Check in
            </Button>
          ) : null}
          {a.status === 'confirmed' || a.status === 'pending' ? (
            <Button
              variant="plain"
              size="icon-sm"
              disabled={busy}
              onClick={() => act(a, 'no-show', 'Marked as a no-show')}
              aria-label="Mark as no-show"
              title="Did not turn up"
            >
              <UserX />
            </Button>
          ) : null}
          <Button
            variant="plain"
            size="icon-sm"
            onClick={() => setEditing(a)}
            aria-label="Edit this place"
          >
            <Pencil />
          </Button>
          <Button
            variant="plain"
            size="icon-sm"
            onClick={() => setConfirmRemove(a)}
            aria-label="Remove from roster"
          >
            <Trash2 />
          </Button>
        </div>
      ),
    },
  ]

  const needed = campaign.needs.reduce((s, n) => s + n.needed, 0)
  const confirmed = assignments.filter(
    (a) => a.status === 'confirmed' || a.status === 'checked-in',
  ).length

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-[220px] flex-1">
            <h2 className="font-serif text-lg text-ink">The sheet</h2>
            <p className="mt-1 text-sm text-muted">
              Who is standing where, on the day. Anybody can be added straight here — the
              cousin who walks in on the morning never saw an invitation.
            </p>
          </div>
          <StaffingMeter
            needed={needed}
            confirmed={confirmed}
            pending={pendingCount}
            className="min-w-[200px]"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => setAdding(true)}>
            <UserPlus /> Add a volunteer directly
          </Button>
          {pendingCount > 0 ? (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  const n = await confirmAllPending(campaign.id)
                  toast(`Confirmed ${n} ${n === 1 ? 'place' : 'places'}`, {
                    detail: 'Every acceptance now has a confirmed shift.',
                    tone: 'success',
                  })
                  onChanged()
                } finally {
                  setBusy(false)
                }
              }}
            >
              {busy ? <Loader2 className="animate-spin" /> : <CheckCheck />} Confirm all{' '}
              {pendingCount} pending
            </Button>
          ) : null}
          <Button variant="outline" onClick={onGoto}>
            <Users /> Manage the pool
          </Button>
        </div>
      </Card>

      {assignments.length === 0 ? (
        <EmptyState
          title="Nobody on the sheet yet"
          detail="Log an acceptance on the Outreach tab, or add somebody directly."
          Icon={UserPlus}
          action={
            <Button onClick={() => setAdding(true)}>
              <Plus /> Add a volunteer
            </Button>
          }
        />
      ) : (
        <DataTable
          rows={assignments}
          columns={columns}
          rowKey={(a) => a.id}
          onRowClick={setEditing}
          initialSort={{ key: 'role', dir: 'asc' }}
          empty={{ title: 'Nobody on the roster' }}
        />
      )}

      <AddDirectSheet
        open={adding}
        onClose={() => setAdding(false)}
        available={available}
        needKeys={needKeys}
        onAdd={async (input) => {
          await addAssignment(campaign.id, input)
          toast('Added to the roster', { tone: 'success' })
          setAdding(false)
          onChanged()
        }}
      />

      <EditAssignmentSheet
        assignment={editing}
        name={editing ? byId.get(editing.volunteerId)?.name : undefined}
        needKeys={needKeys}
        onClose={() => setEditing(null)}
        onSave={async (patch) => {
          if (!editing) return
          await updateAssignment(editing.id, patch)
          toast('Roster place updated', { tone: 'success' })
          setEditing(null)
          onChanged()
        }}
      />

      <Dialog
        open={confirmRemove !== null}
        onClose={() => setConfirmRemove(null)}
        title="Take them off the sheet?"
        description="They stay in the volunteer pool and keep their invitation history."
        footer={
          <>
            <Button variant="subtle" onClick={() => setConfirmRemove(null)} disabled={busy}>
              Keep
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                if (!confirmRemove) return
                setBusy(true)
                try {
                  await removeAssignment(confirmRemove.id)
                  toast('Removed from the roster', { tone: 'info' })
                  setConfirmRemove(null)
                  onChanged()
                } finally {
                  setBusy(false)
                }
              }}
            >
              {busy ? <Loader2 className="animate-spin" /> : <Trash2 />} Remove
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">
          If they pulled out rather than were never needed, editing their place to
          &ldquo;withdrawn&rdquo; leaves a visible gap where a body used to be — which is what
          the staffing meter should be showing.
        </p>
      </Dialog>
    </div>
  )
}

/**
 * The direct-add path: pick somebody from the pool, or enter a person who is not in it yet.
 *
 * The inline create matters more than it looks. The realistic moment for a direct add is
 * somebody standing in front of the coordinator on the morning of the festival, and
 * sending them off to the directory first and back here second is exactly when the name
 * ends up on a paper list instead.
 */
function AddDirectSheet({
  open,
  onClose,
  available,
  needKeys,
  onAdd,
}: {
  open: boolean
  onClose: () => void
  available: Volunteer[]
  needKeys: VolunteerSkill[]
  onAdd: (input: {
    volunteerId: string
    roleKey: VolunteerSkill
    shift: string
    note?: string
  }) => Promise<void>
}) {
  const [source, setSource] = useState<'pool' | 'new'>('pool')
  const [volunteerId, setVolunteerId] = useState('')
  const [search, setSearch] = useState('')
  const [roleKey, setRoleKey] = useState<VolunteerSkill>(needKeys[0] ?? 'kitchen')
  const [shift, setShift] = useState<string>(VOLUNTEER_SHIFTS[0])
  const [note, setNote] = useState('')
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newCity, setNewCity] = useState(CITIES[0]!.city)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setSource('pool')
    setVolunteerId('')
    setSearch('')
    setRoleKey(needKeys[0] ?? 'kitchen')
    setShift(VOLUNTEER_SHIFTS[0])
    setNote('')
    setNewName('')
    setNewPhone('')
    setNewEmail('')
    setError('')
    // needKeys is a fresh array each render; keying off `open` is what makes this run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    return available
      .filter((v) => (q ? [v.name, v.phone, v.city].some((f) => f.toLowerCase().includes(q)) : true))
      .slice(0, 40)
  }, [available, search])

  async function submit() {
    setError('')
    try {
      setBusy(true)
      let id = volunteerId
      if (source === 'new') {
        if (!newName.trim()) return setError('A name is needed.')
        if (!newEmail.trim() && !newPhone.trim())
          return setError('An email or a phone number is needed.')
        const created = await createVolunteer({
          name: newName.trim(),
          email: newEmail.trim(),
          phone: newPhone.trim(),
          city: newCity,
          // They are helping with this, so that is what we know they can do. The
          // directory is where a fuller picture gets filled in later.
          skills: [roleKey],
          status: 'active',
        })
        id = created.id
      }
      if (!id) return setError('Pick somebody from the pool.')
      await onAdd({ volunteerId: id, roleKey, shift, note: note.trim() || undefined })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const roleOptions = needKeys.length ? needKeys : VOLUNTEER_ROLES.map((r) => r.key)

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add a volunteer directly"
      description="Straight onto the sheet, without an invitation. Marked as a direct add so the outreach figures stay honest."
      footer={
        <>
          <Button variant="subtle" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <UserPlus />} Add to roster
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-1.5">
          <Button
            variant={source === 'pool' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSource('pool')}
          >
            <Users /> From the pool
          </Button>
          <Button
            variant={source === 'new' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSource('new')}
          >
            <UserPlus /> Somebody new
          </Button>
        </div>

        {source === 'pool' ? (
          <>
            <Field label="Find them" hint={`${available.length} available`}>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, phone or city"
              />
            </Field>
            <div className="max-h-[240px] overflow-y-auto rounded-[var(--radius)] border border-line">
              {matches.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted">
                  Nobody left in the pool matches. Everyone else is already on this roster.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {matches.map((v) => (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => setVolunteerId(v.id)}
                        aria-pressed={volunteerId === v.id}
                        className={
                          'flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ' +
                          (volunteerId === v.id ? 'bg-brand-500/[0.08]' : 'hover:bg-tint')
                        }
                      >
                        <Avatar initials={v.avatarInitials} className="size-7 text-2xs" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">
                            {v.name}
                          </span>
                          <span className="block truncate text-2xs text-muted">
                            {v.city} · {v.skills.map(roleLabel).join(', ')}
                          </span>
                        </span>
                        {volunteerId === v.id ? (
                          <Check className="size-4 shrink-0 text-brand-600" />
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name" className="sm:col-span-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Muthu Kumaran"
              />
            </Field>
            <Field label="Phone">
              <Input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="(281) 555-0134"
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="name@gmail.com"
              />
            </Field>
            <Field label="City" className="sm:col-span-2">
              <Select value={newCity} onChange={(e) => setNewCity(e.target.value)}>
                {CITIES.map((c) => (
                  <option key={c.city} value={c.city}>
                    {c.city}
                  </option>
                ))}
              </Select>
            </Field>
            <p className="text-2xs text-muted sm:col-span-2">
              They join the volunteer pool as well, so the next campaign can write to them.
            </p>
          </div>
        )}

        <Separator />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Role">
            <Select value={roleKey} onChange={(e) => setRoleKey(e.target.value as VolunteerSkill)}>
              {roleOptions.map((key) => (
                <option key={key} value={key}>
                  {roleLabel(key)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Shift">
            <Select value={shift} onChange={(e) => setShift(e.target.value)}>
              {VOLUNTEER_SHIFTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Note" hint="optional">
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Walked in and offered — put straight on the sheet."
          />
        </Field>

        {error ? (
          <p className="text-sm font-medium text-brand-600" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Sheet>
  )
}

function EditAssignmentSheet({
  assignment,
  name,
  needKeys,
  onClose,
  onSave,
}: {
  assignment: VolunteerAssignment | null
  name?: string
  needKeys: VolunteerSkill[]
  onClose: () => void
  onSave: (
    patch: Partial<Pick<VolunteerAssignment, 'roleKey' | 'shift' | 'status' | 'note'>>,
  ) => Promise<void>
}) {
  const [roleKey, setRoleKey] = useState<VolunteerSkill>('kitchen')
  const [shift, setShift] = useState('')
  const [status, setStatus] = useState<VolunteerAssignment['status']>('pending')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!assignment) return
    setRoleKey(assignment.roleKey)
    setShift(assignment.shift)
    setStatus(assignment.status)
    setNote(assignment.note ?? '')
  }, [assignment])

  const roleOptions = needKeys.length ? needKeys : VOLUNTEER_ROLES.map((r) => r.key)
  const shiftOptions = VOLUNTEER_SHIFTS.includes(shift as (typeof VOLUNTEER_SHIFTS)[number])
    ? VOLUNTEER_SHIFTS
    : [shift, ...VOLUNTEER_SHIFTS]

  return (
    <Sheet
      open={assignment !== null}
      onClose={onClose}
      title={name ? `${name} on this campaign` : 'Roster place'}
      description={
        assignment?.source === 'invited'
          ? 'Came from an accepted invitation.'
          : 'Added directly by the coordinator.'
      }
      footer={
        <>
          <Button variant="subtle" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              setBusy(true)
              try {
                await onSave({ roleKey, shift, status, note: note.trim() || undefined })
              } finally {
                setBusy(false)
              }
            }}
            disabled={busy}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Check />} Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Role">
          <Select value={roleKey} onChange={(e) => setRoleKey(e.target.value as VolunteerSkill)}>
            {roleOptions.map((key) => (
              <option key={key} value={key}>
                {roleLabel(key)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Shift">
          <Select value={shift} onChange={(e) => setShift(e.target.value)}>
            {shiftOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Status"
          hint="withdrawn leaves the gap visible; removing them hides it"
        >
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as VolunteerAssignment['status'])}
          >
            <option value="pending">Pending — said yes, shift not agreed</option>
            <option value="confirmed">Confirmed — shift agreed</option>
            <option value="checked-in">Checked in — turned up on the day</option>
            <option value="no-show">No-show — did not turn up</option>
            <option value="withdrawn">Withdrawn — pulled out beforehand</option>
          </Select>
        </Field>

        <Field label="Note" hint="optional">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>

        {assignment ? (
          <p className="text-2xs text-faint">Added {fmtDateTime(assignment.addedAt)}</p>
        ) : null}
      </div>
    </Sheet>
  )
}
