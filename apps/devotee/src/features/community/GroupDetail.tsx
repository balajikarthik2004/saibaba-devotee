import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Clock, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { GROUP_KIND_LABEL, SAFEGUARDING_NOTE, getGroup, joinGroup, leaveGroup, useT } from '@saibaba/core'
import { PageHeader } from '@/components/layout/layouts'
import { EmptyState, LoadingSkeleton } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/lib/store/auth'
import { useAsync } from '@/lib/hooks'

export default function GroupDetail() {
  const t = useT()
  const { id = '' } = useParams()
  const user = useAuthStore((s) => s.user)
  const { toast } = useToast()
  const { data: g, loading, refresh } = useAsync(() => getGroup(id), [id])
  const [busy, setBusy] = useState(false)

  if (loading) return <div className="mx-auto max-w-3xl px-4 py-8"><LoadingSkeleton variant="card" /></div>
  if (!g)
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <EmptyState title={t('community.notFound', 'We could not find that group')} />
      </div>
    )

  const member = Boolean(user && g.memberIds.includes(user.id))
  const full = Boolean(g.capacity && g.memberIds.length >= g.capacity)
  // Safeguarding: contact details of the children's programme are for signed-in members only.
  const showContact = g.kind !== 'bal-vikas' || member

  async function toggle() {
    if (!user || !g) return
    setBusy(true)
    try {
      if (member) {
        await leaveGroup(g.id, user.id)
        toast(t('community.left', 'You have left the group'))
      } else {
        await joinGroup(g.id, user.id)
        toast(t('community.joined', 'Welcome to the group'), { tone: 'success' })
      }
      refresh()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong', { tone: 'warn' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <PageHeader title={g.name} backTo="/groups" backLabel={t('community.groups', 'Groups and satsangs')} />
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="gold">{GROUP_KIND_LABEL[g.kind]}</Badge>
          <span className="text-[12.5px] text-muted">
            {g.memberIds.length} {t('community.members', 'members')}
            {g.capacity ? ` / ${g.capacity}` : ''}
          </span>
        </div>
        <p className="flex items-center gap-2 text-[14px] text-ink">
          <Clock className="size-4 text-muted" aria-hidden="true" />
          {g.schedule}
        </p>
        <p className="text-[14.5px] leading-relaxed text-ink">{g.description}</p>

        {showContact ? (
          <div className="rounded-md bg-tint p-3 text-[13.5px] text-ink">
            <p className="flex items-center gap-2">
              <UserRound className="size-4 text-muted" aria-hidden="true" />
              {g.contactName}
            </p>
            <p className="mt-1 flex items-center gap-2">
              <Mail className="size-4 text-muted" aria-hidden="true" />
              <a className="text-brand-600 underline-offset-2 hover:underline" href={`mailto:${g.contactEmail}`}>
                {g.contactEmail}
              </a>
            </p>
          </div>
        ) : (
          <p className="rounded-md bg-tint p-3 text-[13px] text-muted">
            {t('community.contactHidden', 'Contact details for children’s programmes are shown to signed-in members only.')}
          </p>
        )}

        {g.kind === 'bal-vikas' ? (
          <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-muted">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-leaf-500" aria-hidden="true" />
            {t('community.safeguarding', SAFEGUARDING_NOTE)}
          </p>
        ) : null}

        {user ? (
          <Button onClick={toggle} disabled={busy || (!member && full)} variant={member ? 'outline' : 'default'}>
            {member
              ? t('community.leave', 'Leave group')
              : full
                ? t('community.full', 'Group is full')
                : t('community.join', 'Join this group')}
          </Button>
        ) : (
          <p className="text-[13.5px] text-muted">
            <Link to="/signin" className="font-medium text-brand-600 hover:underline">
              {t('community.signInToJoin', 'Sign in')}
            </Link>{' '}
            {t('community.signInToJoin2', 'to join this group.')}
          </p>
        )}
      </Card>
    </div>
  )
}
