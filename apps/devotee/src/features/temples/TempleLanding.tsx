import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CalendarDays, Clock, ExternalLink, Flame, Globe, HandCoins, Mail, MapPin, Phone, Truck, Video } from 'lucide-react'
import { LANGUAGES, useT, useTempleStore } from '@saibaba/core'
import type { PaymentProviderKey } from '@saibaba/core'
import { getTempleBySlug } from '@saibaba/core/features/tenancy'
import { updateDevotee } from '@/lib/data/api'
import { useAuthStore } from '@/lib/store/auth'
import { useAsync } from '@/lib/hooks'
import { DeityArt } from '@/components/shared/DeityArt'
import { EmptyState, LoadingSkeleton } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { osmLink } from './osm'

const PAYMENT_LABELS: Record<PaymentProviderKey, string> = {
  stripe: 'Card',
  razorpay: 'Card / netbanking (Razorpay)',
  upi: 'UPI',
  zelle: 'Zelle',
  ach: 'Bank debit (ACH)',
  cheque: 'Cheque',
  'bank-transfer': 'Bank transfer',
  cash: 'Cash at the temple',
}

const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States',
  IN: 'India',
  GB: 'United Kingdom',
  CA: 'Canada',
}

export default function TempleLanding() {
  const t = useT()
  const { slug = '' } = useParams<{ slug: string }>()
  const { toast } = useToast()
  const setTempleId = useTempleStore((s) => s.setTempleId)
  const user = useAuthStore((s) => s.user)
  const { data: temple, loading } = useAsync(() => getTempleBySlug(slug), [slug])

  // Visiting a temple's page makes it the temple you are looking at.
  useEffect(() => {
    if (temple) setTempleId(temple.id)
  }, [temple, setTempleId])

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8">
        <LoadingSkeleton variant="table" rows={5} />
      </div>
    )
  }

  if (!temple) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-16">
        <EmptyState
          title={t('temples.notFound', 'We could not find that temple')}
          detail={t('temples.notFoundD', 'The link may be old, or the temple may not be on Shree Saibaba yet.')}
          action={
            <Link to="/temples" className={buttonVariants({ size: 'sm' })}>
              {t('temple.find', 'Find a temple')}
            </Link>
          }
        />
      </div>
    )
  }

  const isHome = user?.homeTempleId === temple.id
  const makeHome = async () => {
    if (!user) return
    await updateDevotee(user.id, { homeTempleId: temple.id })
    toast(t('temples.homeSet', 'Saved as your home temple'), { detail: temple.name })
  }

  const langs = temple.languages
    .map((c) => LANGUAGES.find((l) => l.code === c))
    .filter((l): l is (typeof LANGUAGES)[number] => Boolean(l))

  const actions = [
    { to: '/donate', label: t('temples.donate', 'Make a donation'), Icon: HandCoins },
    { to: '/puja', label: t('home.sponsorPuja', 'Sponsor a puja'), Icon: Flame },
    { to: '/darshan', label: t('home.liveDarshan', 'Live darshan'), Icon: Video },
    { to: '/events', label: t('nav.festivals', 'Festivals'), Icon: CalendarDays },
  ]

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <section className="relative overflow-hidden rounded-[14px] border border-line shadow-[var(--shadow-lg)]">
        <DeityArt deity="seat" className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-r from-sai-900/85 via-sai-900/55 to-transparent" />
        <div className="relative flex min-h-[220px] flex-col justify-end gap-2 p-6 sm:p-9">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/15 px-3 py-1 text-[12px] font-medium text-white backdrop-blur">
              {COUNTRY_NAMES[temple.country] ?? temple.country} · {temple.currency}
            </span>
          </div>
          <h1 className="max-w-2xl font-serif text-[30px] leading-[1.12] text-white sm:text-[38px]">
            {temple.name}
          </h1>
          <p className="text-[14px] text-white/85">
            {temple.city}
            {temple.state ? `, ${temple.state}` : ''}
          </p>
        </div>
      </section>

      <div className="mt-5 flex flex-wrap gap-2.5">
        {actions.map(({ to, label, Icon }, i) => (
          <Link
            key={to}
            to={to}
            className={buttonVariants({ variant: i === 0 ? 'default' : 'ghost', size: 'sm' })}
          >
            <Icon />
            {label}
          </Link>
        ))}
        {user ? (
          <Button
            variant={isHome ? 'subtle' : 'outline'}
            size="sm"
            onClick={makeHome}
            disabled={isHome}
          >
            {isHome
              ? t('temples.isHome', 'Your home temple')
              : t('temples.makeHome', 'Make this my temple')}
          </Button>
        ) : (
          <Link to="/signin" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            {t('temples.signInHome', 'Sign in to make this your temple')}
          </Link>
        )}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="font-serif text-[20px]">{t('temples.about', 'About this temple')}</h2>
            <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{temple.about}</p>
          </Card>

          {temple.spaces.length > 0 ? (
            <Card className="p-5">
              <h2 className="font-serif text-[20px]">{t('temples.spaces', 'Places of worship')}</h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {temple.spaces.map((s) => (
                  <li key={s.key} className="rounded-[10px] border border-line bg-tint/40 p-3.5">
                    <p className="font-serif text-[16px] text-ink">{s.name}</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{s.blurb}</p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <h3 className="font-serif text-[18px]">{t('temples.visit', 'Visit')}</h3>
            <address className="mt-3 space-y-2.5 not-italic text-[13.5px]">
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
            <a
              href={osmLink(temple)}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'mt-3')}
            >
              {t('temples.openMap', 'Open in OpenStreetMap')}
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>

            <div className="mt-4 border-t border-line pt-4">
              <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
                <Clock className="size-3.5" aria-hidden="true" />
                {t('temples.hours', 'Mandir hours')}
              </p>
              <p className="mt-1.5 text-[13.5px] text-ink">
                {t('footer.morning', 'Morning')} {temple.timings.morning}
              </p>
              <p className="text-[13.5px] text-ink">
                {t('footer.evening', 'Evening')} {temple.timings.evening}
              </p>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-serif text-[18px]">{t('temples.good', 'Good to know')}</h3>
            <dl className="mt-3 space-y-3 text-[13.5px]">
              <div>
                <dt className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                  <Globe className="size-3.5" aria-hidden="true" />
                  {t('temples.languages', 'Languages')}
                </dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {langs.map((l) => (
                    <Badge key={l.code} variant="outline">
                      {l.native}
                    </Badge>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                  <HandCoins className="size-3.5" aria-hidden="true" />
                  {t('temples.payments', 'Ways to give')}
                </dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {temple.payments.map((p) => (
                    <Badge key={p} variant="outline">
                      {PAYMENT_LABELS[p] ?? p}
                    </Badge>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                  <Truck className="size-3.5" aria-hidden="true" />
                  {t('temples.ships', 'Posts prasad & udi to')}
                </dt>
                <dd className="mt-1">
                  {temple.shipsTo.length > 0
                    ? temple.shipsTo.map((c) => COUNTRY_NAMES[c] ?? c).join(', ')
                    : t('temples.noShip', 'This temple does not post parcels.')}
                </dd>
              </div>
              <div>
                <dt className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                  {temple.taxIdLabel}
                </dt>
                <dd className="mt-1 font-mono text-[12.5px] text-ink">{temple.taxId}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  )
}
