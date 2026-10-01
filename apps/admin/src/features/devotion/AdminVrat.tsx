import { useState } from 'react'
import { CheckCheck, Flame, PauseCircle, Users } from 'lucide-react'
import { listVratEnrollments, listVratPrograms, vratStats } from '@saibaba/core/features/devotion'
import type { VratEnrollmentRow } from '@saibaba/core/features/devotion'
import { useT } from '@saibaba/core/i18n'
import { PageShell } from '@/components/layout/PageShell'
import { Toolbar, ToolbarSelect } from '@/components/admin/Toolbar'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { StatTile } from '@/components/shared/StatTile'
import { LoadingSkeleton } from '@/components/shared/states'
import { Badge, Progress } from '@/components/ui/badge'
import { useAsync, useDebounced } from '@/lib/hooks'
import { fmtDate } from '@/lib/utils'

const STATUS = {
  active: 'leaf',
  paused: 'gold',
  completed: 'brand',
  abandoned: 'neutral',
} as const

export default function AdminVrat() {
  const t = useT()
  const [q, setQ] = useState('')
  const [programId, setProgramId] = useState('')
  const [status, setStatus] = useState('')
  const dq = useDebounced(q)

  const { data: programs } = useAsync(listVratPrograms, [])
  const { data: stats } = useAsync(() => vratStats(), [])
  const { data: rows, loading } = useAsync(
    () =>
      listVratEnrollments({
        q: dq,
        programId: programId || undefined,
        status: (status || undefined) as VratEnrollmentRow['enrollment']['status'] | undefined,
      }),
    [dq, programId, status],
  )

  const columns: Column<VratEnrollmentRow>[] = [
    {
      key: 'who',
      header: t('vrat.admin.devotee', 'Devotee'),
      sortValue: (r) => r.userName,
      cell: (r) => (
        <div className="min-w-0">
          <p className="font-medium text-ink">{r.userName}</p>
          {r.enrollment.intention ? (
            <p className="max-w-[260px] truncate text-xs text-muted">{r.enrollment.intention}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'program',
      header: t('vrat.admin.programme', 'Programme'),
      sortValue: (r) => r.program.weeks,
      cell: (r) => r.program.name,
    },
    {
      key: 'start',
      header: t('vrat.admin.started', 'Started'),
      sortValue: (r) => r.enrollment.startDate,
      cell: (r) => fmtDate(r.enrollment.startDate),
    },
    {
      key: 'progress',
      header: t('vrat.admin.progress', 'Progress'),
      sortValue: (r) => r.progress.observed / r.progress.total,
      cell: (r) => (
        <div className="flex min-w-[140px] items-center gap-2">
          <Progress
            value={(Math.min(r.progress.observed, r.progress.total) / r.progress.total) * 100}
            tone="gold"
            label={`${r.userName}: ${r.progress.observed} of ${r.progress.total}`}
          />
          <span className="whitespace-nowrap text-xs tabular-nums text-muted">
            {r.progress.observed}/{r.progress.total}
          </span>
        </div>
      ),
    },
    {
      key: 'missed',
      header: t('vrat.admin.missed', 'Missed'),
      align: 'right',
      sortValue: (r) => r.progress.missed,
      cell: (r) => (
        <span className={r.progress.missed >= 2 && r.enrollment.status === 'active' ? 'font-semibold text-brand-600' : ''}>
          {r.progress.missed}
        </span>
      ),
    },
    {
      key: 'next',
      header: t('vrat.admin.next', 'Next Thursday'),
      sortValue: (r) => r.progress.nextDate ?? '9999',
      cell: (r) => (r.progress.nextDate && r.enrollment.status === 'active' ? fmtDate(r.progress.nextDate) : '—'),
    },
    {
      key: 'status',
      header: t('vrat.admin.status', 'Status'),
      sortValue: (r) => r.enrollment.status,
      cell: (r) => <Badge variant={STATUS[r.enrollment.status]}>{r.enrollment.status}</Badge>,
    },
  ]

  const active = [q, programId, status].filter(Boolean).length

  return (
    <PageShell
      eyebrow={t('devotion.group', 'Devotion')}
      title={t('vrat.admin.title', 'Thursday vrat')}
      description={t('vrat.admin.desc', 'Who is observing, how far along, and who may need a gentle nudge.')}
      toolbar={
        <Toolbar
          search={q}
          onSearch={setQ}
          searchPlaceholder={t('vrat.admin.search', 'Search devotees')}
          activeCount={active}
          onClear={() => {
            setQ('')
            setProgramId('')
            setStatus('')
          }}
        >
          <ToolbarSelect
            aria-label={t('vrat.admin.programme', 'Programme')}
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
          >
            <option value="">{t('vrat.admin.allProgrammes', 'All programmes')}</option>
            {programs?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </ToolbarSelect>
          <ToolbarSelect
            aria-label={t('vrat.admin.status', 'Status')}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">{t('vrat.admin.allStatus', 'Any status')}</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
            <option value="abandoned">Stopped</option>
          </ToolbarSelect>
        </Toolbar>
      }
    >
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={t('vrat.admin.enrolled', 'Enrolled')} value={stats?.total ?? '…'} Icon={Users} sub={`${stats?.active ?? 0} active`} tone="brand" />
        <StatTile
          label={t('vrat.admin.thisWeek', 'Observed this week')}
          value={stats?.observedThisWeek ?? '…'}
          Icon={Flame}
          sub={`${stats?.avgProgressPct ?? 0}% average progress`}
          tone="gold"
        />
        <StatTile
          label={t('vrat.admin.completed', 'Completed')}
          value={stats?.completed ?? '…'}
          Icon={CheckCheck}
          sub={`${stats?.completionRate ?? 0}% completion rate`}
          tone="leaf"
        />
        <StatTile
          label={t('vrat.admin.nudge', 'Need a nudge')}
          value={stats?.needingNudge ?? '…'}
          Icon={PauseCircle}
          sub={t('vrat.admin.nudgeSub', 'Two or more missed Thursdays')}
        />
      </div>

      {loading || !rows ? (
        <LoadingSkeleton variant="table" rows={6} />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(r) => r.enrollment.id}
          initialSort={{ key: 'start', dir: 'desc' }}
          empty={{ title: t('vrat.admin.empty', 'No enrolments match'), detail: t('vrat.admin.emptyD', 'Try clearing the filters.') }}
        />
      )}
    </PageShell>
  )
}
