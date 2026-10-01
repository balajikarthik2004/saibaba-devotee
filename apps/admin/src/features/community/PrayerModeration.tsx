import { useMemo, useState } from 'react'
import { Check, TriangleAlert, X } from 'lucide-react'
import { FLAG_LABEL, listPrayers, moderatePrayers, currentTempleId, useT } from '@saibaba/core'
import type { Prayer } from '@saibaba/core'
import { PageShell } from '@/components/layout/PageShell'
import { Toolbar, ToolbarSelect } from '@/components/admin/Toolbar'
import { EmptyState, LoadingSkeleton } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/overlay'
import { Checkbox, Field, Textarea } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { useAsync } from '@/lib/hooks'

type Filter = 'pending' | 'approved' | 'rejected' | 'all'

export default function PrayerModeration() {
  const t = useT()
  const { toast } = useToast()
  const [status, setStatus] = useState<Filter>('pending')
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [rejecting, setRejecting] = useState<string[] | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const tid = currentTempleId()
  const { data, loading, refresh } = useAsync(() => listPrayers({ templeId: tid, status }), [tid, status])
  const rows = useMemo(
    () => (data ?? []).filter((p) => (flaggedOnly ? p.flags.length > 0 : true)),
    [data, flaggedOnly],
  )

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  async function decide(ids: string[], decision: 'approved' | 'rejected', why?: string) {
    setBusy(true)
    try {
      await moderatePrayers(ids, decision, why)
      toast(decision === 'approved' ? t('prayer.admin.approved', 'Approved') : t('prayer.admin.rejected', 'Rejected'), {
        detail: `${ids.length}`,
        tone: 'success',
      })
      setSelected(new Set())
      setRejecting(null)
      setReason('')
      refresh()
    } finally {
      setBusy(false)
    }
  }

  const onKey = (e: React.KeyboardEvent, p: Prayer) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'a') void decide([p.id], 'approved')
    else if (e.key === 'r') setRejecting([p.id])
    else if (e.key === ' ') {
      e.preventDefault()
      toggle(p.id)
    }
  }

  const ids = [...selected]

  return (
    <PageShell
      eyebrow="Community"
      title={t('prayer.admin.title', 'Prayer moderation')}
      description={t('prayer.admin.desc', '{n} shown. Focus a row, then A approve, R reject, Space select.', { n: rows.length })}
      actions={
        <>
          <Button variant="outline" disabled={!ids.length || busy} onClick={() => void decide(ids, 'approved')}>
            <Check />
            {t('prayer.admin.approveSel', 'Approve selected')} ({ids.length})
          </Button>
          <Button variant="outline" disabled={!ids.length || busy} onClick={() => setRejecting(ids)}>
            <X />
            {t('prayer.admin.rejectSel', 'Reject selected')}
          </Button>
        </>
      }
      toolbar={
        <Toolbar>
          <ToolbarSelect aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as Filter)}>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </ToolbarSelect>
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <Checkbox checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} />
            {t('prayer.admin.flagged', 'Flagged only')}
          </label>
        </Toolbar>
      }
    >
      {loading ? (
        <LoadingSkeleton variant="table" />
      ) : rows.length === 0 ? (
        <EmptyState title={t('prayer.admin.empty', 'Nothing waiting')} detail="The queue is clear for now." />
      ) : (
        <ul className="space-y-2" aria-label="Prayer requests">
          {rows.map((p) => (
            <li
              key={p.id}
              tabIndex={0}
              onKeyDown={(e) => onKey(e, p)}
              aria-label={`${p.displayName}: ${p.body.slice(0, 60)}`}
              className="rounded-[var(--radius)] border border-line bg-card p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  className="mt-1"
                  aria-label={`Select prayer from ${p.displayName}`}
                  checked={selected.has(p.id)}
                  onChange={() => toggle(p.id)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span className="font-medium text-ink">{p.displayName}</span>
                    <Badge variant="gold">{p.category}</Badge>
                    <Badge variant="neutral">{p.visibility}</Badge>
                    <Badge variant={p.status === 'approved' ? 'leaf' : p.status === 'rejected' ? 'brand' : 'default'}>
                      {p.status}
                    </Badge>
                    <span>{new Date(p.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink">{p.body}</p>
                  {p.flags.length ? (
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {p.flags.map((f) => (
                        <li key={f}>
                          <Badge variant="brand">
                            <TriangleAlert className="size-3" aria-hidden="true" />
                            {FLAG_LABEL[f]}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {p.moderationReason ? (
                    <p className="mt-1.5 text-xs text-muted">Reason: {p.moderationReason}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button size="sm" variant="leaf" disabled={busy} onClick={() => void decide([p.id], 'approved')}>
                    <Check />
                    <span className="sr-only sm:not-sr-only">Approve</span>
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => setRejecting([p.id])}>
                    <X />
                    <span className="sr-only sm:not-sr-only">Reject</span>
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
        title={t('prayer.admin.rejectTitle', 'Reject with a reason')}
        description="The reason is kept for other moderators; it is not sent to the devotee."
        footer={
          <>
            <Button variant="plain" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button disabled={busy || !reason.trim()} onClick={() => void decide(rejecting ?? [], 'rejected', reason)}>
              Reject {rejecting?.length ?? 0}
            </Button>
          </>
        }
      >
        <Field label="Reason" htmlFor="rej-reason">
          <Textarea id="rej-reason" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Dialog>
    </PageShell>
  )
}
