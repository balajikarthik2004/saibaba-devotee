import { useState } from 'react'
import { Pencil, Plus, Trash2, Users } from 'lucide-react'
import {
  GROUP_KIND_LABEL,
  createGroup,
  currentTempleId,
  deleteGroup,
  leaveGroup,
  listGroups,
  updateGroup,
  useT,
} from '@saibaba/core'
import type { GroupKind, SatsangGroup } from '@saibaba/core'
import { DEVOTEES } from '@saibaba/core/mock'
import { PageShell } from '@/components/layout/PageShell'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { LoadingSkeleton } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/overlay'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { useAsync } from '@/lib/hooks'

const blank = () => ({
  name: '',
  kind: 'satsang' as GroupKind,
  schedule: '',
  contactName: '',
  contactEmail: '',
  description: '',
  capacity: '',
})
type Draft = ReturnType<typeof blank>

export default function GroupsAdmin() {
  const t = useT()
  const { toast } = useToast()
  const tid = currentTempleId()
  const { data, loading, refresh } = useAsync(() => listGroups(tid), [tid])
  const [editing, setEditing] = useState<SatsangGroup | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(blank())
  const [error, setError] = useState('')
  const [members, setMembers] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<SatsangGroup | null>(null)
  const [busy, setBusy] = useState(false)

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }))

  function open(g: SatsangGroup | 'new') {
    setError('')
    setDraft(
      g === 'new'
        ? blank()
        : { ...g, capacity: g.capacity ? String(g.capacity) : '' },
    )
    setEditing(g)
  }

  async function save() {
    if (!draft.name.trim() || !draft.schedule.trim()) return setError('A name and a schedule are needed.')
    setBusy(true)
    const payload = {
      name: draft.name.trim(),
      kind: draft.kind,
      schedule: draft.schedule.trim(),
      contactName: draft.contactName.trim(),
      contactEmail: draft.contactEmail.trim(),
      description: draft.description.trim(),
      capacity: draft.capacity ? Number(draft.capacity) : undefined,
    }
    try {
      if (editing === 'new') await createGroup(payload)
      else if (editing) await updateGroup(editing.id, payload)
      toast('Group saved', { tone: 'success' })
      setEditing(null)
      refresh()
    } finally {
      setBusy(false)
    }
  }

  const memberGroup = (data ?? []).find((g) => g.id === members)

  const columns: Column<SatsangGroup>[] = [
    {
      key: 'name',
      header: 'Group',
      sortValue: (g) => g.name,
      cell: (g) => (
        <div>
          <p className="font-medium text-ink">{g.name}</p>
          <p className="text-xs text-muted">{g.schedule}</p>
        </div>
      ),
    },
    { key: 'kind', header: 'Kind', sortValue: (g) => g.kind, cell: (g) => <Badge variant="gold">{GROUP_KIND_LABEL[g.kind]}</Badge> },
    {
      key: 'members',
      header: 'Members',
      sortValue: (g) => g.memberIds.length,
      cell: (g) => (
        <Button size="sm" variant="plain" onClick={() => setMembers(g.id)}>
          <Users />
          {g.memberIds.length}
          {g.capacity ? ` / ${g.capacity}` : ''}
        </Button>
      ),
    },
    {
      key: 'act',
      header: '',
      align: 'right',
      cell: (g) => (
        <div className="flex justify-end gap-1">
          <Button size="icon" variant="plain" aria-label={`Edit ${g.name}`} onClick={() => open(g)}>
            <Pencil />
          </Button>
          <Button size="icon" variant="plain" aria-label={`Delete ${g.name}`} onClick={() => setConfirm(g)}>
            <Trash2 />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <PageShell
      eyebrow="Community"
      title={t('community.admin.groups', 'Groups')}
      description={`${data?.length ?? 0} groups`}
      actions={
        <Button onClick={() => open('new')}>
          <Plus />
          New group
        </Button>
      }
    >
      {loading ? (
        <LoadingSkeleton variant="table" />
      ) : (
        <DataTable rows={data ?? []} columns={columns} rowKey={(g) => g.id} empty={{ title: 'No groups yet' }} />
      )}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New group' : 'Edit group'}
        footer={
          <>
            <Button variant="plain" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => void save()}>
              Save
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" htmlFor="g-name" className="sm:col-span-2">
            <Input id="g-name" value={draft.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="Kind" htmlFor="g-kind">
            <Select id="g-kind" value={draft.kind} onChange={(e) => set('kind', e.target.value as GroupKind)}>
              {(Object.keys(GROUP_KIND_LABEL) as GroupKind[]).map((k) => (
                <option key={k} value={k}>
                  {GROUP_KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Capacity" hint="(optional)" htmlFor="g-cap">
            <Input id="g-cap" type="number" min={1} value={draft.capacity} onChange={(e) => set('capacity', e.target.value)} />
          </Field>
          <Field label="Schedule" htmlFor="g-sch" className="sm:col-span-2">
            <Input id="g-sch" value={draft.schedule} onChange={(e) => set('schedule', e.target.value)} />
          </Field>
          <Field label="Contact name" htmlFor="g-cn">
            <Input id="g-cn" value={draft.contactName} onChange={(e) => set('contactName', e.target.value)} />
          </Field>
          <Field label="Contact email" htmlFor="g-ce">
            <Input id="g-ce" type="email" value={draft.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} />
          </Field>
          <Field label="Description" htmlFor="g-desc" className="sm:col-span-2">
            <Textarea id="g-desc" value={draft.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
          {draft.kind === 'bal-vikas' ? (
            <p className="text-xs text-muted sm:col-span-2">
              Children’s programme: contact details are shown to signed-in members only. Keep the safeguarding policy current.
            </p>
          ) : null}
          {error ? <p className="text-sm text-brand-600 sm:col-span-2">{error}</p> : null}
        </div>
      </Dialog>

      <Dialog
        open={Boolean(memberGroup)}
        onClose={() => setMembers(null)}
        title={memberGroup ? `${memberGroup.name}: members` : ''}
      >
        {memberGroup && memberGroup.memberIds.length === 0 ? (
          <p className="text-sm text-muted">Nobody has joined yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {memberGroup?.memberIds.map((uid) => (
              <li key={uid} className="flex items-center justify-between py-2 text-sm">
                <span>{DEVOTEES.find((u) => u.id === uid)?.name ?? uid}</span>
                <Button
                  size="sm"
                  variant="plain"
                  onClick={async () => {
                    await leaveGroup(memberGroup.id, uid)
                    refresh()
                  }}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Dialog>

      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title="Delete this group?"
        description={confirm ? `${confirm.name} and its member list will be removed.` : ''}
        footer={
          <>
            <Button variant="plain" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (confirm) await deleteGroup(confirm.id)
                setConfirm(null)
                refresh()
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <span />
      </Dialog>
    </PageShell>
  )
}
