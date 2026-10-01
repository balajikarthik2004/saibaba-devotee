import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useCurrentTemple, useT } from '@saibaba/core'
import { getTransparencySnapshot } from '@/lib/data/api'
import type { TransparencySnapshot } from '@/lib/data/types'
import { Progress, Skeleton } from '@/components/ui/badge'
import { cn, useMoney } from '@/lib/utils'

/**
 * The temple's promise, in three numbers. Set on the deep indigo ground so it reads as a
 * statement rather than one more card in the stack.
 */
export function TransparencyStrip({ className }: { className?: string }) {
  const t = useT()
  const money = useMoney()
  const temple = useCurrentTemple()
  const [snap, setSnap] = useState<TransparencySnapshot | null>(null)

  useEffect(() => {
    let live = true
    getTransparencySnapshot().then((s) => live && setSnap(s))
    return () => {
      live = false
    }
  }, [temple.id])

  const tiles = [
    { key: 'ytdCollected', label: t('transparency.raised', 'Raised this year') },
    { key: 'annualTarget', label: t('transparency.target', 'Annual target') },
    { key: 'balanceToBreakeven', label: t('transparency.toRaise', 'Still to raise') },
  ] as const

  return (
    <section className={cn('bg-sai-800 text-sai-50', className)}>
      <div className="mx-auto max-w-5xl px-6 py-14 text-center">
        <p className="text-[11px] uppercase tracking-[0.28em] text-saffron-300">
          {t('transparency.kicker', 'Updated nightly · full transparency')}
        </p>
        <h2 className="mt-3 font-serif text-[30px] leading-tight text-white">
          {t('transparency.title', 'Where your offering goes')}
        </h2>

        <dl className="mt-9 grid gap-8 sm:grid-cols-3">
          {tiles.map(({ key, label }) => (
            <div key={key}>
              <dt className="text-[11.5px] uppercase tracking-[0.14em] text-sai-100/75">{label}</dt>
              <dd className="mt-2">
                {snap ? (
                  <span
                    className={cn(
                      'font-serif text-[38px] leading-none',
                      key === 'balanceToBreakeven' ? 'text-saffron-300' : 'text-white',
                    )}
                  >
                    {money(snap[key])}
                  </span>
                ) : (
                  <Skeleton className="mx-auto h-9 w-32 bg-white/15" />
                )}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mx-auto mt-9 max-w-xl">
          <Progress
            value={snap?.achievedPct ?? 0}
            tone="gold"
            label={t('transparency.progressAria', '{pct}% of the annual operating target raised', {
              pct: snap?.achievedPct ?? 0,
            })}
            className="bg-white/15"
          />
          <p className="mt-3 text-[13.5px] leading-relaxed text-sai-100/80">
            {snap
              ? t('transparency.pctLine', '{pct}% of this year’s operating target.', {
                  pct: snap.achievedPct,
                })
              : t('common.loading', 'Loading…')}{' '}
            {t(
              'transparency.promise',
              'Every gift is reported to the trustees monthly and published in the annual report.',
            )}
          </p>
        </div>

        <Link
          to="/about"
          className="group mt-6 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-saffron-200 hover:text-saffron-100"
        >
          {t('transparency.how', 'How the temple is funded')}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </section>
  )
}
