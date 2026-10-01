import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ALargeSmall, Clock } from 'lucide-react'
import { getLeela } from '@saibaba/core/features/devotion'
import { useT } from '@saibaba/core/i18n'
import { readLocal, writeLocal } from '@saibaba/core/local'
import { PageHeader } from '@/components/layout/layouts'
import { EmptyState, LoadingSkeleton } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { useAsync } from '@/lib/hooks'
import { cn } from '@/lib/utils'
import { ShareButton, THEME_LABEL } from './shared'

const KEY = 'saibaba:devotion:large-text'

export default function LeelaReader() {
  const t = useT()
  const { id = '' } = useParams()
  const { data: leela, loading } = useAsync(() => getLeela(id), [id])
  const [large, setLarge] = useState(() => readLocal<boolean>(KEY, false))

  if (loading)
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <LoadingSkeleton variant="card" />
      </div>
    )
  if (!leela)
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <EmptyState
          title={t('teach.notFound', 'We could not find that leela')}
          action={
            <Link to="/teachings" className={buttonVariants({ size: 'sm' })}>
              {t('teach.title', 'Baba’s teachings')}
            </Link>
          }
        />
      </div>
    )

  return (
    <article className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <PageHeader
        title={leela.title}
        backTo="/teachings"
        backLabel={t('teach.title', 'Baba’s teachings')}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge variant="gold">{t(THEME_LABEL[leela.theme][0], THEME_LABEL[leela.theme][1])}</Badge>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden="true" />
              {t('teach.minRead', '{n} min read', { n: leela.readMinutes })}
            </span>
          </span>
        }
        actions={
          <>
            <Button
              size="sm"
              variant={large ? 'default' : 'outline'}
              aria-pressed={large}
              onClick={() => {
                setLarge(!large)
                writeLocal(KEY, !large)
              }}
            >
              <ALargeSmall />
              {t('teach.largeText', 'Large text')}
            </Button>
            <ShareButton title={leela.title} text={`${leela.title}\n\n${leela.summary}`} />
          </>
        }
      />
      <div className={cn('space-y-4 font-serif leading-[1.85] text-ink', large ? 'text-[23px]' : 'text-[17px]')}>
        {leela.summary.split(/\n{2,}/).map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>
      {leela.source ? <p className="mt-8 text-[12px] text-muted">{leela.source}</p> : null}
    </article>
  )
}
