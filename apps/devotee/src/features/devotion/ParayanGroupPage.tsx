import { useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  getParayanGroup,
  joinParayanGroup,
  leaveParayanGroup,
} from '@saibaba/core/features/devotion'
import { useT } from '@saibaba/core/i18n'
import { PageHeader } from '@/components/layout/layouts'
import { EmptyState, LoadingSkeleton } from '@/components/shared/states'
import { Progress } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/lib/store/auth'
import { useAsync } from '@/lib/hooks'
import { cn, fmtDate } from '@/lib/utils'
import { ProgressRing } from './shared'

/** "1–8" for a contiguous run, otherwise "1, 4, 9". */
export function chapterSummary(ch: number[]): string {
  if (ch.length === 0) return '—'
  const s = [...ch].sort((a, b) => a - b)
  const contiguous = s.every((c, i) => i === 0 || c === s[i - 1]! + 1)
  return contiguous && s.length > 1 ? `${s[0]}–${s[s.length - 1]}` : s.join(', ')
}

export default function ParayanGroupPage() {
  const t = useT()
  const { id = '' } = useParams()
  const user = useAuthStore((s) => s.user)!
  const { toast } = useToast()
  const { data, loading, refresh } = useAsync(() => getParayanGroup(id), [id])
  const [busy, setBusy] = useState(false)

  if (loading) return <LoadingSkeleton variant="card" />
  if (!data)
    return <EmptyState title={t('parayan.groupNotFound', 'We could not find that group')} />

  const { group, members } = data
  const member = members.some((m) => m.userId === user.id)

  async function toggleMembership() {
    setBusy(true)
    try {
      if (member) {
        await leaveParayanGroup(group.id, user.id)
        toast(t('parayan.left', 'You have left the group'))
      } else {
        await joinParayanGroup(group.id, user.id, user.name)
        toast(t('parayan.joined', 'Welcome. Your chapters have been shared out.'), { tone: 'success' })
      }
      refresh()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong', { tone: 'warn' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title={group.name}
        backTo="/parayan"
        backLabel={t('parayan.title', 'Sai Satcharitra parayan')}
        subtitle={t('parayan.groupStarted', 'Started {d} · {n} members', {
          d: fmtDate(group.startDate),
          n: members.length,
        })}
        actions={
          <Button variant={member ? 'outline' : 'default'} size="sm" disabled={busy} onClick={() => void toggleMembership()}>
            {member ? t('parayan.leave', 'Leave group') : t('parayan.join', 'Join group')}
          </Button>
        }
      />

      <Card className="flex flex-wrap items-center gap-5 p-5">
        <ProgressRing
          value={data.pct}
          size={96}
          label={t('parayan.groupRing', '{n} of 51 chapters read by the group', { n: data.readCount })}
        />
        <div className="min-w-0 flex-1">
          {group.description ? <p className="text-[14.5px] leading-relaxed text-ink">{group.description}</p> : null}
          <p className="mt-2 text-[13px] text-muted">
            {t('parayan.groupRing', '{n} of 51 chapters read by the group', { n: data.readCount })}
          </p>
        </div>
      </Card>

      <ul className="space-y-3">
        {members.map((m) => (
          <li key={m.userId}>
            <Card className={cn('space-y-2.5 p-4', m.userId === user.id && 'border-saffron-400')}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-serif text-[17px] text-ink">
                  {m.name}
                  {m.userId === user.id ? (
                    <span className="ml-2 text-[12px] font-sans text-brand-600">{t('parayan.you', 'you')}</span>
                  ) : null}
                </h2>
                <span className="text-[13px] tabular-nums text-muted">
                  {t('parayan.chaptersShare', 'Chapters {c}', { c: chapterSummary(m.chapters) })} ·{' '}
                  {m.read.length}/{m.chapters.length}
                </span>
              </div>
              <Progress
                value={m.pct}
                tone="leaf"
                label={t('parayan.memberProgress', '{name}: {n} of {total} chapters read', {
                  name: m.name,
                  n: m.read.length,
                  total: m.chapters.length,
                })}
              />
              <ul className="flex flex-wrap gap-1" aria-label={t('parayan.memberChapters', 'Assigned chapters')}>
                {m.chapters.map((c) => (
                  <li
                    key={c}
                    className={cn(
                      'grid h-7 min-w-7 place-items-center rounded px-1 text-[12px] tabular-nums',
                      m.read.includes(c) ? 'bg-leaf-500 text-white' : 'bg-tint text-muted',
                    )}
                  >
                    {c}
                    <span className="sr-only">{m.read.includes(c) ? ` ${t('parayan.done', 'done')}` : ''}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}
