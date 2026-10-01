import { Link } from 'react-router-dom'
import { Mail, MapPin, Phone } from 'lucide-react'
import { useCurrentTemple, useT } from '@saibaba/core'
import { LogoWordmark } from '@/components/shared/Logo'
import { FEATURE_NAV } from '@/features/registry'

interface FooterLink {
  to: string
  label: string
  key: string
  order?: number
}

const BASE_LINKS: FooterLink[] = [
  { to: '/puja', label: 'Sponsor a puja', key: 'footer.puja', order: 10 },
  { to: '/donate', label: 'Make a donation', key: 'footer.donate', order: 20 },
  { to: '/facility', label: 'Book the hall', key: 'footer.hall', order: 30 },
  { to: '/events', label: 'Festivals', key: 'footer.festivals', order: 40 },
  { to: '/temples', label: 'Find a temple', key: 'temple.find', order: 50 },
  { to: '/about', label: 'About this temple', key: 'footer.about', order: 90 },
]

const LINKS: FooterLink[] = [
  ...BASE_LINKS,
  ...FEATURE_NAV.filter((n) => n.placement === 'footer').map((n) => ({
    to: n.to,
    label: n.label,
    key: n.labelKey ?? `nav.${n.to}`,
    order: n.order,
  })),
]
  .filter((l, i, all) => all.findIndex((x) => x.to === l.to) === i)
  .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))

export function Footer() {
  const t = useT()
  const temple = useCurrentTemple()

  return (
    <footer className="mt-16 border-t-2 border-saffron-400/60 bg-sai-800 text-sai-50">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 md:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <LogoWordmark tone="light" />
          <p className="mt-4 max-w-sm text-[13.5px] leading-relaxed text-sai-100/80">
            {t(
              'footer.blurb',
              'A welcome for every devotee. Shraddha and Saburi — faith and patience — are all Baba asks. Every lamp lit here is paid for by a family that chose to give.',
            )}
          </p>
        </div>

        <nav aria-label={t('footer.links', 'Worship and give')}>
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-saffron-300">
            {t('footer.links', 'Worship & give')}
          </h3>
          <ul className="space-y-2">
            {LINKS.map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  className="text-[13.5px] text-sai-100/85 transition-colors hover:text-saffron-200"
                >
                  {t(l.key, l.label)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-saffron-300">
            {t('footer.visit', 'Visit')} · {temple.name}
          </h3>
          <address className="space-y-2.5 not-italic text-[13.5px] text-sai-100/85">
            <p className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 size-4 shrink-0 text-saffron-300/80" aria-hidden="true" />
              <span>
                {temple.address}
                <br />
                {temple.city}
                {temple.state ? `, ${temple.state}` : ''} {temple.zip}
              </span>
            </p>
            <p className="flex items-center gap-2.5">
              <Phone className="size-4 shrink-0 text-saffron-300/80" aria-hidden="true" />
              <a href={`tel:${temple.phone}`} className="hover:text-saffron-200">
                {temple.phone}
              </a>
            </p>
            <p className="flex items-center gap-2.5">
              <Mail className="size-4 shrink-0 text-saffron-300/80" aria-hidden="true" />
              <a href={`mailto:${temple.email}`} className="break-all hover:text-saffron-200">
                {temple.email}
              </a>
            </p>
          </address>

          <div className="mt-4 border-t border-sai-100/15 pt-3 text-[12.5px] text-sai-100/80">
            <p className="mb-1 font-medium text-sai-50">{t('footer.hours', 'Mandir hours')}</p>
            <p className="flex justify-between gap-3">
              <span>{t('footer.morning', 'Morning')}</span>
              <span className="text-saffron-200">{temple.timings.morning}</span>
            </p>
            <p className="flex justify-between gap-3">
              <span>{t('footer.evening', 'Evening')}</span>
              <span className="text-saffron-200">{temple.timings.evening}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-sai-100/15">
        <div className="mx-auto flex max-w-6xl flex-col gap-1.5 px-6 py-5 text-[12px] text-sai-100/75 md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} {temple.name} · {temple.taxIdLabel}: {temple.taxId}
          </p>
        </div>
      </div>
    </footer>
  )
}
