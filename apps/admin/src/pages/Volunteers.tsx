import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Download,
  HeartHandshake,
  Loader2,
  Megaphone,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Trash2,
  UserRound,
} from 'lucide-react'
import type { Volunteer, VolunteerSkill } from '@/lib/data/types'
import { PageShell } from '@/components/layout/PageShell'
import { Toolbar, ToolbarSelect } from '@/components/admin/Toolbar'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { StatTile } from '@/components/shared/StatTile'
import { StatusPill } from '@/components/shared/badges'
import { LoadingSkeleton } from '@/components/shared/states'
import { Avatar, Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog } from '@/components/ui/overlay'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import {
  createVolunteer,
  deleteVolunteer,
  listVolunteers,
  updateVolunteer,
} from '@/lib/data/api'
import { CITIES, VOLUNTEER_ROLES, roleLabel } from '@/lib/data/mock'
import { useAsync, useDebounced } from '@/lib/hooks'
import { downloadCSV, fmtDate } from '@/lib/utils'

/**
 * The volunteer pool — everybody who has ever offered, whether or not they are on a
 * roster right now.
 *
 * This is deliberately the pool and not "volunteers at the Deepavali campaign": the
 * outreach step needs somebody to write to before any campaign exists, so the pool has
 * to be able to stand on its own. Campaign membership lives one screen along.
 *
 * Editing happens in a dialog rather than on a detail page. A volunteer record is eight
 * fields, and a page-to-page trip to change a phone number is the sort of friction that
 * ends with the coordinator keeping the real list in a spreadsheet.
 */

const blankDraft = () => ({
  name: '',
  email: '',
  phone: '',
  city: CITIES[0]!.city,
  skills: [] as VolunteerSkill[],
  notes: '',
  status: 'active' as Volunteer['status'],
})

type Draft = ReturnType<typeof blankDraft>

export default function Volunteers() {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [skill, setSkill] = useState('')
  const [city, setCity] = useState('')
  const [status, setStatus] = useState('')
  const debounced = useDebounced(search)

  const { data, loading, refresh } = useAsync(() => listVolunteers(), [])
  const all = useMemo(() => data ?? [], [data])

  /* Filtering client-side rather than round-tripping: the whole pool is a few dozen
     rows, and every keystroke hitting the fake-async API made the table flicker. */
  const rows = useMemo(() => {
    const q = debounced.trim().toLowerCase()
    return all
      .filter((v) =>
        q ? [v.name, v.email, v.phone, v.city].some((f) => f.toLowerCase().includes(q)) : true,
      )
      .filter((v) => (skill ? v.skills.includes(skill as VolunteerSkill) : true))
      .filter((v) => (city ? v.city === city : true))
      .filter((v) => (status ? v.status === status : true))
  }, [all, debounced, skill, city, status])

  const activeCount = [skill, city, status].filter(Boolean).length

  const [editing, setEditing] = useState<Volunteer | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Draft>(blankDraft())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<Volunteer | null>(null)

  const openCreate = () => {
    setDraft(blankDraft())
    setError('')
    setCreating(true)
  }

  const openEdit = (v: Volunteer) => {
    setDraft({
      name: v.name,
      email: v.email,
      phone: v.phone,
      city: v.city,
      skills: [...v.skills],
      notes: v.notes ?? '',
      status: v.status,
    })
    setError('')
    setEditing(v)
  }

  const closeForm = () => {
    setCreating(false)
    setEditing(null)
  }

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }))

  const toggleSkill = (key: VolunteerSkill) =>
    setDraft((d) => ({
      ...d,
      skills: d.skills.includes(key) ? d.skills.filter((s) => s !== key) : [...d.skills, key],
    }))

  async function save() {
    // Name and one contact route are the floor: a volunteer nobody can reach is a row
    // that will sit in the pool forever getting counted and never getting asked.
    if (!draft.name.trim()) return setError('A name is needed.')
    if (!draft.email.trim() && !draft.phone.trim())
      return setError('An email or a phone number is needed — outreach has to reach somebody.')
    if (draft.skills.length === 0) return setError('Pick at least one thing they can help with.')

    setBusy(true)
    setError('')
    try {
      if (editing) {
        await updateVolunteer(editing.id, {
          name: draft.name.trim(),
          email: draft.email.trim(),
          phone: draft.phone.trim(),
          city: draft.city,
          skills: draft.skills,
          notes: draft.notes.trim() || undefined,
          status: draft.status,
        })
        toast('Volunteer updated', { detail: draft.name.trim(), tone: 'success' })
      } else {
        await createVolunteer({
          name: draft.name.trim(),
          email: draft.email.trim(),
          phone: draft.phone.trim(),
          city: draft.city,
          skills: draft.skills,
          notes: draft.notes.trim() || undefined,
          status: draft.status,
        })
        toast('Volunteer added to the pool', { detail: draft.name.trim(), tone: 'success' })
      }
      closeForm()
      refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function toggleStatus(v: Volunteer) {
    const next = v.status === 'active' ? 'paused' : 'active'
    await updateVolunteer(v.id, { status: next })
    toast(next === 'paused' ? 'Volunteer paused' : 'Volunteer reactivated', {
      detail:
        next === 'paused'
          ? `${v.name} will be left out of every outreach audience.`
          : `${v.name} is back in the outreach pool.`,
      tone: 'info',
    })
    refresh()
  }

  async function remove() {
    if (!confirmDelete) return
    setBusy(true)
    try {
      await deleteVolunteer(confirmDelete.id)
      toast('Volunteer removed', {
        detail: 'Their invitations and roster places went with them.',
        tone: 'info',
      })
      setConfirmDelete(null)
      refresh()
    } finally {
      setBusy(false)
    }
  }

  const columns: Column<Volunteer>[] = [
    {
      key: 'name',
      header: 'Volunteer',
      sortValue: (v) => v.name,
      cell: (v) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar initials={v.avatarInitials} className="size-7 text-2xs" />
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{v.name}</p>
            <p className="truncate text-2xs text-muted">{v.email || v.phone}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'skills',
      header: 'Can help with',
      cell: (v) => (
        <div className="flex flex-wrap gap-1">
          {v.skills.map((s) => (
            <Badge key={s} variant="outline">
              {roleLabel(s)}
            </Badge>
          ))}
        </div>
      ),
    },
    { key: 'city', header: 'City', sortValue: (v) => v.city, cell: (v) => v.city },
    {
      key: 'devotee',
      header: 'Record',
      cell: (v) =>
        v.userId ? (
          // The link is the point of storing `userId` at all: a coordinator ringing round
          // often wants the household behind the name.
          <Link
            to={`/devotees/${v.userId}`}
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-medium text-brand-600 hover:underline"
          >
            Devotee
          </Link>
        ) : (
          <span className="text-sm text-faint">Volunteer only</span>
        ),
    },
    {
      key: 'joined',
      header: 'Joined',
      sortValue: (v) => v.joinedAt,
      cell: (v) => <span className="tabular-nums">{fmtDate(v.joinedAt)}</span>,
    },
    { key: 'status', header: 'Status', cell: (v) => <StatusPill status={v.status} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (v) => (
        <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="plain"
            size="icon-sm"
            onClick={() => toggleStatus(v)}
            aria-label={v.status === 'active' ? `Pause ${v.name}` : `Reactivate ${v.name}`}
            title={v.status === 'active' ? 'Pause — drop out of outreach' : 'Reactivate'}
          >
            {v.status === 'active' ? <PauseCircle /> : <PlayCircle />}
          </Button>
          <Button
            variant="plain"
            size="icon-sm"
            onClick={() => openEdit(v)}
            aria-label={`Edit ${v.name}`}
          >
            <Pencil />
          </Button>
          <Button
            variant="plain"
            size="icon-sm"
            onClick={() => setConfirmDelete(v)}
            aria-label={`Remove ${v.name}`}
          >
            <Trash2 />
          </Button>
        </div>
      ),
    },
  ]

  const stats = {
    total: all.length,
    active: all.filter((v) => v.status === 'active').length,
    devotees: all.filter((v) => v.userId).length,
    cities: new Set(all.map((v) => v.city)).size,
  }

  const formOpen = creating || editing !== null

  return (
    <PageShell
      eyebrow="People"
      title="Volunteers"
      description={`${rows.length} of ${all.length} in the pool`}
      actions={
        <>
          <Button
            variant="outline"
            onClick={() =>
              downloadCSV(
                'saibaba-volunteers.csv',
                rows.map((v) => ({
                  Name: v.name,
                  Email: v.email,
                  Phone: v.phone,
                  City: v.city,
                  'Can help with': v.skills.map(roleLabel).join('; '),
                  Status: v.status,
                  Joined: fmtDate(v.joinedAt),
                  Notes: v.notes ?? '',
                })),
              )
            }
          >
            <Download /> Export
          </Button>
          <Link to="/volunteers/campaigns" className={buttonVariants({ variant: 'ghost' })}>
            <Megaphone /> Campaigns
          </Link>
          <Button onClick={openCreate}>
            <Plus /> Add volunteer
          </Button>
        </>
      }
      toolbar={
        <Toolbar
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search name, email, phone or city"
          activeCount={activeCount}
          onClear={
            activeCount
              ? () => {
                  setSkill('')
                  setCity('')
                  setStatus('')
                }
              : undefined
          }
        >
          <ToolbarSelect value={skill} onChange={(e) => setSkill(e.target.value)}>
            <option value="">Any skill</option>
            {VOLUNTEER_ROLES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </ToolbarSelect>
          <ToolbarSelect value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="">Any city</option>
            {CITIES.map((c) => (
              <option key={c.city} value={c.city}>
                {c.city}
              </option>
            ))}
          </ToolbarSelect>
          <ToolbarSelect value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Active and paused</option>
            <option value="active">Active only</option>
            <option value="paused">Paused only</option>
          </ToolbarSelect>
        </Toolbar>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="In the pool" value={stats.total} Icon={HeartHandshake} tone="brand" />
        <StatTile
          label="Active"
          value={stats.active}
          sub="Reachable by outreach"
          Icon={PlayCircle}
          tone="leaf"
        />
        <StatTile
          label="Also devotees"
          value={stats.devotees}
          sub="Linked to a temple record"
          Icon={UserRound}
        />
        <StatTile label="Cities" value={stats.cities} tone="gold" />
      </div>

      <div className="mt-5">
        {loading ? (
          <LoadingSkeleton variant="table" rows={8} />
        ) : (
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(v) => v.id}
            onRowClick={openEdit}
            initialSort={{ key: 'name', dir: 'asc' }}
            empty={{
              title: 'No volunteers match',
              detail: 'Clear the filters, or add somebody to the pool.',
            }}
          />
        )}
      </div>

      <Dialog
        open={formOpen}
        onClose={closeForm}
        title={editing ? `Edit ${editing.name}` : 'Add a volunteer'}
        description={
          editing
            ? 'Changes apply everywhere this person appears, including live rosters.'
            : 'They go into the pool straight away and can be written to by the next campaign.'
        }
        footer={
          <>
            <Button variant="subtle" onClick={closeForm} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              {editing ? 'Save changes' : 'Add to pool'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name" htmlFor="vol-name">
              <Input
                id="vol-name"
                value={draft.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Lakshmi Raghavan"
              />
            </Field>
            <Field label="City" htmlFor="vol-city">
              <Select
                id="vol-city"
                value={draft.city}
                onChange={(e) => set('city', e.target.value)}
              >
                {CITIES.map((c) => (
                  <option key={c.city} value={c.city}>
                    {c.city}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Email" hint="for email outreach" htmlFor="vol-email">
              <Input
                id="vol-email"
                type="email"
                value={draft.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="name@gmail.com"
              />
            </Field>
            <Field label="Phone" hint="for SMS outreach" htmlFor="vol-phone">
              <Input
                id="vol-phone"
                value={draft.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="(281) 555-0134"
              />
            </Field>
          </div>

          <Field
            label="Can help with"
            hint="drives which campaigns they hear about"
            className="pt-1"
          >
            <div className="grid gap-1.5 rounded-[var(--radius)] border border-line bg-faint/40 p-3 sm:grid-cols-2">
              {VOLUNTEER_ROLES.map((r) => (
                <label
                  key={r.key}
                  className="flex cursor-pointer items-start gap-2 text-sm text-ink-soft"
                >
                  <Checkbox
                    className="mt-0.5"
                    checked={draft.skills.includes(r.key)}
                    onChange={() => toggleSkill(r.key)}
                  />
                  <span className="min-w-0">{r.label}</span>
                </label>
              ))}
            </div>
          </Field>

          <Field label="Notes" hint="read by the coordinator, never filtered on">
            <Textarea
              rows={2}
              value={draft.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Leaves by 8pm. Cannot lift heavy vessels."
            />
          </Field>

          <Field label="Status">
            <Select
              value={draft.status}
              onChange={(e) => set('status', e.target.value as Volunteer['status'])}
            >
              <option value="active">Active — include in outreach</option>
              <option value="paused">Paused — keep the record, skip the asking</option>
            </Select>
          </Field>

          {error ? (
            <p className="text-sm font-medium text-brand-600" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </Dialog>

      <Dialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title={`Remove ${confirmDelete?.name ?? ''}?`}
        description="Their invitation history and any roster places go too. Pausing keeps the record instead."
        footer={
          <>
            <Button variant="subtle" onClick={() => setConfirmDelete(null)} disabled={busy}>
              Keep
            </Button>
            <Button variant="destructive" onClick={remove} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Trash2 />} Remove
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">
          If they have simply stopped helping for now, pause them instead — a paused
          volunteer drops out of every outreach audience but keeps the history of what they
          did.
        </p>
      </Dialog>
    </PageShell>
  )
}
