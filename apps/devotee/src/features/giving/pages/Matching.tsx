import { Link } from 'react-router-dom'
import { Building2, HeartHandshake, ListChecks } from 'lucide-react'
import { useT } from '@saibaba/core'
import { TEMPLES } from '@/lib/data/mock'
import { PageHeader } from '@/components/layout/layouts'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DafInfo } from '../components/PaymentStep'

/**
 * /matching: public information on employer matching and donor-advised funds. Both are
 * US mechanisms, so the DAF details are shown for the US temples.
 */
export default function Matching() {
  const t = useT()
  const us = TEMPLES.filter((x) => x.country === 'US')

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <PageHeader
        title={t('giving.matching.title', 'Double your gift: matching and donor-advised funds')}
        subtitle={t('giving.matching.subtitle', 'Two ways to give more without spending more. Both apply to gifts to US temples.')}
      />

      <div className="space-y-5">
        <Card className="space-y-3 p-5">
          <h2 className="flex items-center gap-2 font-serif text-[20px]">
            <HeartHandshake className="size-5 text-brand-500" />
            {t('giving.matching.employer', 'Employer matching gifts')}
          </h2>
          <p className="text-[14px] leading-relaxed text-ink">
            {t('giving.matching.employerBody', 'Many employers will match a gift their employees make to a registered charity, often dollar for dollar. The match is paid by your employer, directly to the temple, in addition to your own gift.')}
          </p>
          <ol className="space-y-2 text-[13.5px] leading-relaxed text-muted">
            <li className="flex gap-2.5">
              <ListChecks className="mt-0.5 size-4 shrink-0 text-leaf-500" />
              {t('giving.matching.step1', 'Check your employer’s giving portal or ask HR whether they match gifts and whether a temple qualifies.')}
            </li>
            <li className="flex gap-2.5">
              <ListChecks className="mt-0.5 size-4 shrink-0 text-leaf-500" />
              {t('giving.matching.step2', 'Make your gift and type your employer’s name in the “Employer matching” field on the donation page.')}
            </li>
            <li className="flex gap-2.5">
              <ListChecks className="mt-0.5 size-4 shrink-0 text-leaf-500" />
              {t('giving.matching.step3', 'The temple office submits the match request, verifies it with your employer and records the matched amount.')}
            </li>
          </ol>
          <p className="text-[12.5px] text-muted">
            {t('giving.matching.note', 'Whether a match is paid is up to your employer’s programme. The temple cannot guarantee it.')}
          </p>
          <Link to="/donate" className={buttonVariants({ size: 'sm' })}>
            {t('giving.matching.give', 'Make a gift')}
          </Link>
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="flex items-center gap-2 font-serif text-[20px]">
            <Building2 className="size-5 text-brand-500" />
            {t('giving.daf.title', 'Give via a donor-advised fund')}
          </h2>
          <p className="text-[14px] leading-relaxed text-ink">
            {t('giving.matching.dafBody', 'If you have a donor-advised fund (DAF) with a sponsor such as Fidelity Charitable, Schwab Charitable or a community foundation, you can recommend a grant to the temple from your fund account.')}
          </p>
          <div className="space-y-4">
            {us.map((temple) => (
              <div key={temple.id} className="rounded-[10px] border border-line bg-card p-4">
                <p className="mb-2 font-medium">{temple.name}</p>
                <DafInfo temple={temple} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
