import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock } from 'lucide-react'
import type { Leela } from '@saibaba/core'
import { listAssurances, listLeelas } from '@saibaba/core/features/devotion'
import { useT, useLanguageStore } from '@saibaba/core/i18n'
import { PageHeader } from '@/components/layout/layouts'
import { LoadingSkeleton } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Chips } from '@/components/ui/tabs'
import { useAsync } from '@/lib/hooks'
import { DailyMessageCard } from './widgets'
import { THEME_LABEL } from './shared'

const THEMES = Object.keys(THEME_LABEL) as Leela['theme'][]

export default function Teachings() {
  const t = useT()
  const [theme, setTheme] = useState<'all' | Leela['theme']>('all')
  const { data: assurances } = useAsync(listAssurances, [])
  const { data: leelas, loading } = useAsync(() => listLeelas(theme === 'all' ? undefined : theme), [theme])
  const lang = useLanguageStore((s) => s.language)

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      <PageHeader
        title={t('teach.title', 'Baba’s teachings')}
        subtitle={t('teach.subtitle', 'Short reflections, leelas and the eleven assurances. Read slowly, take what helps.')}
        className="mb-0"
      />

      <DailyMessageCard lang={lang} />

      <section aria-labelledby="assur-h">
        <h2 id="assur-h" className="mb-1 font-serif text-[22px] text-ink">
          {t('teach.assurances', 'The eleven assurances')}
        </h2>
        <p className="mb-4 text-[13.5px] text-muted">
          {t(
            'teach.assurancesNote',
            'Promises traditionally attributed to Baba. Wording varies between tellings; these are paraphrased.',
          )}
        </p>
        {!assurances ? (
          <LoadingSkeleton variant="text" rows={4} />
        ) : (
          <ol className="grid gap-2.5 sm:grid-cols-2">
            {assurances.map((a) => (
              <li key={a.n}>
                <Card className="flex h-full gap-3 p-4">
                  <span
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-saffron-100 font-serif text-[15px] text-saffron-600"
                    aria-hidden="true"
                  >
                    {a.n}
                  </span>
                  <p className="text-[14.5px] leading-relaxed text-ink">
                    <span className="sr-only">{t('teach.assuranceN', 'Assurance {n}', { n: a.n })}: </span>
                    {a.text}
                  </p>
                </Card>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="leela-h">
        <h2 id="leela-h" className="mb-3 font-serif text-[22px] text-ink">
          {t('teach.leelas', 'Leelas')}
        </h2>
        <Chips
          className="mb-4"
          value={theme}
          onChange={(k) => setTheme(k as 'all' | Leela['theme'])}
          items={[
            { key: 'all', label: t('teach.all', 'All') },
            ...THEMES.map((k) => ({ key: k, label: t(THEME_LABEL[k][0], THEME_LABEL[k][1]) })),
          ]}
        />
        {loading || !leelas ? (
          <LoadingSkeleton variant="tiles" rows={3} />
        ) : leelas.length === 0 ? (
          <p className="text-[14px] text-muted">{t('teach.noLeelas', 'Nothing here yet.')}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {leelas.map((l) => (
              <li key={l.id}>
                <Link
                  to={`/teachings/${l.id}`}
                  className="block h-full rounded-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                >
                  <Card className="flex h-full flex-col gap-2 p-4 transition-shadow hover:shadow-[var(--shadow-lg)]">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="gold">{t(THEME_LABEL[l.theme][0], THEME_LABEL[l.theme][1])}</Badge>
                      <span className="inline-flex items-center gap-1 text-[12px] text-muted">
                        <Clock className="size-3.5" aria-hidden="true" />
                        {t('teach.minRead', '{n} min read', { n: l.readMinutes })}
                      </span>
                    </div>
                    <h3 className="font-serif text-[18px] leading-snug text-ink">{l.title}</h3>
                    <p className="line-clamp-3 text-[13.5px] leading-relaxed text-muted">{l.summary}</p>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
