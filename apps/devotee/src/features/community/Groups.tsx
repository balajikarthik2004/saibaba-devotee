import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Users } from 'lucide-react'
import { GROUP_KIND_LABEL, listGroups, useCurrentTemple, useT } from '@saibaba/core'
import type { GroupKind } from '@saibaba/core'
import { PageHeader } from '@/components/layout/layouts'
import { EmptyState, LoadingSkeleton } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/input'
import { useAsync } from '@/lib/hooks'

export default function Groups() {
  const t = useT()
  const temple = useCurrentTemple()
  const [kind, setKind] = useState<GroupKind | ''>('')
  const { data, loading } = useAsync(() => listGroups(temple.id, kind || undefined), [temple.id, kind])

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <PageHeader
        title={t('community.groups', 'Groups and satsangs')}
        subtitle={t('community.groupsSub', 'Find a circle to sing, study or serve with.')}
        backTo="/community"
        backLabel={t('community.title', 'Community')}
        actions={
          <div className="w-52">
            <Select
              aria-label={t('community.filterKind', 'Filter by kind')}
              value={kind}
              onChange={(e) => setKind(e.target.value as GroupKind | '')}
            >
              <option value="">{t('community.allKinds', 'All kinds')}</option>
              {(Object.keys(GROUP_KIND_LABEL) as GroupKind[]).map((k) => (
                <option key={k} value={k}>
                  {GROUP_KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          </div>
        }
      />
      {loading ? (
        <LoadingSkeleton variant="tiles" rows={5} />
      ) : (data ?? []).length === 0 ? (
        <EmptyState Icon={Users} title={t('community.noGroups', 'No groups of this kind yet')} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data!.map((g) => (
            <li key={g.id}>
              <Link
                to={`/groups/${g.id}`}
                className="block h-full rounded-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
              >
                <Card className="h-full p-4 transition-colors hover:bg-tint/50">
                  <Badge variant="gold">{GROUP_KIND_LABEL[g.kind]}</Badge>
                  <p className="mt-2 font-serif text-[18px] text-ink">{g.name}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted">
                    <Clock className="size-3.5" aria-hidden="true" />
                    {g.schedule}
                  </p>
                  <p className="mt-2 line-clamp-3 text-[13.5px] text-muted">{g.description}</p>
                  <p className="mt-3 text-[12px] text-muted">
                    {g.memberIds.length} {t('community.members', 'members')}
                    {g.capacity ? ` / ${g.capacity}` : ''}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
