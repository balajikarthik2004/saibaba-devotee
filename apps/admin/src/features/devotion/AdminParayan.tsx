import { useMemo, useState } from 'react'
import { BookOpen, Plus, Users } from 'lucide-react'
import {
  createParayanGroup,
  devotionDates,
  getParayanGroup,
  listParayanEnrollments,
  listParayanGroups,
  parayanStats,
} from '@saibaba/core/features/devotion'
import type { ParayanEnrollmentRow, ParayanGroupView } from '@saibaba/core/features/devotion'
import { useT } from '@saibaba/core/i18n'
import { USERS } from '@saibaba/core/mock'
import { PageShell } from '@/components/layout/PageShell'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { StatTile } from '@/components/shared/StatTile'
import { LoadingSkeleton } from '@/components/shared/states'
import { Badge, Progress } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/overlay'
import { Checkbox, Field, Input, Textarea } from '@/components/ui/input'
import { Tabs } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/toast'
import { useAsync } from '@/lib/hooks'
import { fmtDate } from '@/lib/utils'

const { todayISO } = devotionDates
const DEVOTEES = USERS.filter((u) => u.role === 'devotee')

export default function AdminParayan() {
  const t = useT()
  const [tab, setTab] = useState('enrollments')
  const [creating, setCreating] = useState(false)
  const { data: stats, refresh: refreshStats } = useAsync(() => parayanStats(), [])
  const { data: rows, loading } = useAsync(() => listParayanEnrollments(), [])
  const { data: groups, refresh: refreshGroups } = useAsync(async () => {
    const list = await listParayanGroups()
    const views = await Promise.all(list.map((g) => getParayanGroup(g.id)))
    return views.filter((v): v is ParayanGroupView => v !== null)
  }, [])

  const enrolCols: Column<ParayanEnrollmentRow>[] = [
    { key: 'who', header: t('parayan.admin.devotee', 'Devotee'), sortValue: (r) => r.userName, cell: (r) => <span className="font-medium text-ink">{r.userName}</span> },
    { key: 'plan', header: t('parayan.admin.plan', 'Plan'), sortValue: (r) => r.plan.name, cell: (r) => r.groupName ? `${r.groupName}` : r.plan.name },
    { key: 'start', header: t('parayan.admin.started', 'Started'), sortValue: (r) => r.enrollment.startDate, cell: (r) => fmtDate(r.enrollment.startDate) },
    {
      key: 'progress',
      header: t('parayan.admin.progress', 'Progress'),
      sortValue: (r) => r.progress.pct,
      cell: (r) => (
        <div className="flex min-w-[150px] items-center gap-2">
          <Progress value={r.progress.pct} tone="leaf" label={`${r.userName}: ${r.progress.read} of ${r.progress.total} chapters`} />
          <span className="whitespace-nowrap text-xs tabular-nums text-muted">{r.progress.read}/{r.progress.total}</span>
        </div>
      ),
    },
    {
      key: 'behind',
      header: t('parayan.admin.behind', 'Behind plan'),
      align: 'right',
      sortValue: (r) => r.progress.overdue.length,
      cell: (r) => (r.progress.overdue.length ? <span className="font-semibold text-brand-600">{r.progress.overdue.length}</span> : '—'),
    },
    {
      key: 'status',
      header: t('parayan.admin.status', 'Status'),
      sortValue: (r) => r.enrollment.status,
      cell: (r) => <Badge variant={r.enrollment.status === 'completed' ? 'brand' : r.enrollment.status === 'active' ? 'leaf' : 'gold'}>{r.enrollment.status}</Badge>,
    },
  ]

  const groupCols: Column<ParayanGroupView>[] = [
    { key: 'name', header: t('parayan.admin.group', 'Group'), sortValue: (g) => g.group.name, cell: (g) => (
      <div className="min-w-0"><p className="font-medium text-ink">{g.group.name}</p><p className="max-w-[320px] truncate text-xs text-muted">{g.group.description}</p></div>
    ) },
    { key: 'members', header: t('parayan.admin.members', 'Members'), align: 'right', sortValue: (g) => g.members.length, cell: (g) => g.members.length },
    { key: 'start', header: t('parayan.admin.started', 'Started'), sortValue: (g) => g.group.startDate, cell: (g) => fmtDate(g.group.startDate) },
    { key: 'progress', header: t('parayan.admin.progress', 'Progress'), sortValue: (g) => g.pct, cell: (g) => (
      <div className="flex min-w-[150px] items-center gap-2">
        <Progress value={g.pct} tone="leaf" label={`${g.group.name}: ${g.readCount} of 51 chapters`} />
        <span className="whitespace-nowrap text-xs tabular-nums text-muted">{g.readCount}/51</span>
      </div>
    ) },
  ]

  return (
    <PageShell
      eyebrow={t('devotion.group', 'Devotion')}
      title={t('parayan.admin.title', 'Sai Satcharitra parayan')}
      description={t('parayan.admin.desc', 'Individual readings and group parayans.')}
      actions={
        <Button onClick={() => setCreating(true)}>
          <Plus />
          {t('parayan.admin.newGroup', 'New group')}
        </Button>
      }
      tabs={
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { key: 'enrollments', label: t('parayan.admin.enrolments', 'Enrolments'), count: rows?.length },
            { key: 'groups', label: t('parayan.admin.groups', 'Groups'), count: groups?.length },
          ]}
        />
      }
    >
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={t('parayan.admin.readers', 'Readers')} value={stats?.total ?? '…'} Icon={BookOpen} sub={`${stats?.active ?? 0} active`} tone="brand" />
        <StatTile label={t('parayan.admin.completedN', 'Completed')} value={stats?.completed ?? '…'} tone="leaf" />
        <StatTile label={t('parayan.admin.groupsN', 'Groups')} value={stats?.groups ?? '…'} Icon={Users} tone="gold" />
        <StatTile label={t('parayan.admin.chapters', 'Chapters read')} value={stats?.chaptersRead ?? '…'} />
      </div>

      {tab === 'enrollments' ? (
        loading || !rows ? (
          <LoadingSkeleton variant="table" rows={5} />
        ) : (
          <DataTable rows={rows} columns={enrolCols} rowKey={(r) => r.enrollment.id} initialSort={{ key: 'start', dir: 'desc' }} empty={{ title: t('parayan.admin.none', 'No enrolments yet') }} />
        )
      ) : !groups ? (
        <LoadingSkeleton variant="table" rows={3} />
      ) : (
        <DataTable rows={groups} columns={groupCols} rowKey={(g) => g.group.id} initialSort={{ key: 'start', dir: 'desc' }} empty={{ title: t('parayan.admin.noGroups', 'No groups yet') }} />
      )}

      <CreateGroupDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false)
          setTab('groups')
          refreshGroups()
          refreshStats()
        }}
      />
    </PageShell>
  )
}

function CreateGroupDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const t = useT()
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [start, setStart] = useState(todayISO())
  const [desc, setDesc] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [filter, setFilter] = useState('')
  const [busy, setBusy] = useState(false)

  const shown = useMemo(
    () => DEVOTEES.filter((u) => u.name.toLowerCase().includes(filter.trim().toLowerCase())).slice(0, 40),
    [filter],
  )
  const share = picked.length ? Math.ceil(51 / picked.length) : 0

  async function submit() {
    if (!name.trim() || picked.length === 0) return
    setBusy(true)
    try {
      await createParayanGroup({ name, startDate: start, description: desc, memberUserIds: picked })
      toast(t('parayan.admin.created', 'Group created and chapters shared out'), { tone: 'success' })
      setName('')
      setDesc('')
      setPicked([])
      onCreated()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong', { tone: 'warn' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('parayan.admin.newGroup', 'New group')}
      description={t('parayan.admin.newGroupD', 'The 51 chapters are divided fairly among the members you choose.')}
      footer={
        <>
          <Button variant="plain" onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
          <Button disabled={busy || !name.trim() || picked.length === 0} onClick={() => void submit()}>
            {t('parayan.admin.create', 'Create group')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label={t('parayan.admin.groupName', 'Group name')} htmlFor="pg-name">
          <Input id="pg-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t('parayan.admin.startDate', 'Start date')} htmlFor="pg-start">
          <Input id="pg-start" type="date" min={todayISO()} value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label={t('parayan.admin.description', 'Description')} htmlFor="pg-desc">
          <Textarea id="pg-desc" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} />
        </Field>
        <Field
          label={t('parayan.admin.pickMembers', 'Members')}
          hint={picked.length ? t('parayan.admin.shareHint', '{n} selected, about {s} chapters each', { n: picked.length, s: share }) : undefined}
        >
          <Input
            aria-label={t('parayan.admin.filterMembers', 'Filter devotees')}
            placeholder={t('parayan.admin.filterMembers', 'Filter devotees')}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="mb-2"
          />
          <ul className="max-h-48 divide-y divide-line overflow-y-auto rounded-[var(--radius)] border border-line">
            {shown.map((u) => (
              <li key={u.id}>
                <label className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-tint">
                  <Checkbox
                    checked={picked.includes(u.id)}
                    onChange={() => setPicked((cur) => (cur.includes(u.id) ? cur.filter((x) => x !== u.id) : [...cur, u.id]))}
                  />
                  {u.name}
                </label>
              </li>
            ))}
          </ul>
        </Field>
      </div>
    </Dialog>
  )
}
