import { Link } from 'react-router-dom'
import { HeartHandshake, Users } from 'lucide-react'
import { GROUP_KIND_LABEL, listGroups, useCurrentTemple, useT } from '@saibaba/core'
import { PageHeader } from '@/components/layout/layouts'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingSkeleton } from '@/components/shared/states'
import { useAsync } from '@/lib/hooks'
import { PrayerWallTeaser } from './widgets'

export default function CommunityHub() {
  const t = useT()
  const temple = useCurrentTemple()
  const { data: groups, loading } = useAsync(() => listGroups(temple.id), [temple.id])

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <PageHeader
        title={t('community.title', 'Community')}
        subtitle={t('community.subtitle', 'Sai devotion is simple: gather, sing, serve. Find your circle at {temple}.', { temple: temple.name })}
      />

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <section aria-labelledby="grp-h">
          <h2 id="grp-h" className="mb-3 font-serif text-[20px] text-ink">
            {t('community.groups', 'Groups and satsangs')}
          </h2>
          {loading ? (
            <LoadingSkeleton variant="tiles" rows={4} />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {(groups ?? []).map((g) => (
                <li key={g.id}>
                  <Link
                    to={`/groups/${g.id}`}
                    className="block h-full rounded-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                  >
                    <Card className="h-full p-4 transition-colors hover:bg-tint/50">
                      <Badge variant="gold">{GROUP_KIND_LABEL[g.kind]}</Badge>
                      <p className="mt-2 font-serif text-[17px] text-ink">{g.name}</p>
                      <p className="mt-1 text-[13px] text-muted">{g.schedule}</p>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link to="/groups" className="mt-3 inline-block text-[13.5px] font-medium text-brand-600 hover:text-brand-700">
            {t('community.allGroups', 'See all groups')}
          </Link>
        </section>

        <div className="space-y-5">
          <PrayerWallTeaser />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HeartHandshake className="size-5 text-leaf-500" aria-hidden="true" />
                {t('community.volunteer.title', 'Offer your seva')}
              </CardTitle>
              <p className="text-[13.5px] leading-relaxed text-muted">
                {t(
                  'community.volunteer.body',
                  'Every festival and annadanam runs on volunteers. Tell the temple office what you can help with and the volunteer coordinator will get in touch.',
                )}
              </p>
            </CardHeader>
            <p className="flex items-center gap-2 px-5 pb-5 text-[12.5px] text-muted">
              <Users className="size-4" aria-hidden="true" />
              {t('community.volunteer.note', 'Volunteer sign-up is handled by your temple office.')}
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
