import { Clock, Mail, MapPin, Phone } from 'lucide-react'
import { useCurrentTemple, useT } from '@saibaba/core'
import type { TaxRegime } from '@saibaba/core'
import { PageHeader } from '@/components/layout/layouts'
import { TransparencyStrip } from '@/components/shared/TransparencyStrip'
import { DeityArt } from '@/components/shared/DeityArt'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { STAFF } from '@/lib/data/mock'

const REGIME_LABEL: Record<TaxRegime, string> = {
  'us-501c3': '501(c)(3) non-profit',
  'in-80g': 'Registered trust (80G)',
  'uk-giftaid': 'Registered charity (Gift Aid)',
  'ca-cra': 'Registered charity (CRA)',
}

export default function About() {
  const t = useT()
  const temple = useCurrentTemple()

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader
        title={t('about.title', 'About Shree Saibaba')}
        subtitle={t(
          'about.subtitle',
          'A home for devotees of Sai Baba, of every faith, in every country.',
        )}
      />

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <DeityArt deity="seat" className="h-44 w-full" />
            <div className="space-y-3 p-5 text-[14.5px] leading-relaxed text-muted">
              <p>
                {t(
                  'about.platform',
                  'Shree Saibaba brings Sai temples together on one simple platform: live darshan and aartis, the Thursday vrat, pujas offered in your family’s name, and gifts that are reported openly. Baba asked for two things — Shraddha (faith) and Saburi (patience) — and everyone who shares them is welcome here, whatever their religion or background.',
                )}
              </p>
              <h2 className="pt-2 font-serif text-[20px] text-ink">{temple.name}</h2>
              <p>{temple.about}</p>
              {temple.spaces.length > 0 ? (
                <p>
                  {t('about.spaces', 'Places of worship here:')}{' '}
                  {temple.spaces.map((s) => s.name).join(', ')}.
                </p>
              ) : null}
              <p>
                {t(
                  'about.funding',
                  'Every temple on the platform is run on devotee contributions. Every lamp lit, every plate served and every priest’s honorarium comes from a family that chose to give.',
                )}
              </p>
            </div>
          </Card>

          <TransparencyStrip />

          <Card className="p-5">
            <h2 className="font-serif text-[20px]">{t('about.staff', 'Priests & staff')}</h2>
            <ul className="mt-3 divide-y divide-line">
              {STAFF.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-tint text-[12px] font-semibold text-brand-600">
                    {s.name
                      .split(' ')
                      .map((w) => w[0])
                      .join('')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium text-ink">{s.name}</p>
                    <p className="text-[12.5px] text-muted">{s.title}</p>
                  </div>
                  <a
                    href={`mailto:${s.email}`}
                    className="text-[12.5px] text-brand-600 hover:underline"
                  >
                    {s.email}
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <h3 className="font-serif text-[18px]">{t('about.visit', 'Visit us')}</h3>
            <address className="mt-3 space-y-2.5 not-italic text-[13.5px] text-muted">
              <p className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-brand-500" aria-hidden="true" />
                <span className="text-ink">
                  {temple.address}
                  <br />
                  {temple.city}
                  {temple.state ? `, ${temple.state}` : ''} {temple.zip}
                </span>
              </p>
              <p className="flex items-center gap-2.5">
                <Phone className="size-4 shrink-0 text-brand-500" aria-hidden="true" />
                <a href={`tel:${temple.phone}`} className="text-ink hover:text-brand-500">
                  {temple.phone}
                </a>
              </p>
              <p className="flex items-center gap-2.5">
                <Mail className="size-4 shrink-0 text-brand-500" aria-hidden="true" />
                <a href={`mailto:${temple.email}`} className="break-all text-ink hover:text-brand-500">
                  {temple.email}
                </a>
              </p>
            </address>

            <div className="mt-4 border-t border-line pt-4">
              <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
                <Clock className="size-3.5" aria-hidden="true" />
                {t('about.hours', 'Mandir hours')}
              </p>
              <p className="mt-1.5 text-[13.5px] text-ink">
                {t('footer.morning', 'Morning')} {temple.timings.morning}
              </p>
              <p className="text-[13.5px] text-ink">
                {t('footer.evening', 'Evening')} {temple.timings.evening}
              </p>
              <p className="mt-1 text-[12.5px] text-muted">
                {t('about.hoursNote', 'Timings can change on festival days — check the calendar.')}
              </p>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-serif text-[18px]">{t('about.status', 'Registration & tax status')}</h3>
            <div className="mt-3 space-y-2 text-[13px] text-muted">
              <p className="flex items-center justify-between gap-3">
                <span>{t('about.orgType', 'Organisation type')}</span>
                <Badge variant="leaf">{REGIME_LABEL[temple.taxRegime]}</Badge>
              </p>
              <p className="flex items-center justify-between gap-3">
                <span>{temple.taxIdLabel}</span>
                <span className="font-mono text-ink">{temple.taxId}</span>
              </p>
              <p className="flex items-center justify-between gap-3">
                <span>{t('about.currency', 'Gifts are taken in')}</span>
                <span className="text-ink">{temple.currency}</span>
              </p>
            </div>
            <p className="mt-3 border-t border-line pt-3 text-[12.5px] leading-relaxed text-muted">
              {t(
                'about.taxNote',
                'Receipts follow the tax rules of the temple’s own country. Amounts are always shown in that temple’s currency and never converted.',
              )}
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
