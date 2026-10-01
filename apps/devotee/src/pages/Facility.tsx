import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Loader2, Users } from 'lucide-react'
import { useT } from '@saibaba/core'
import type { FacilityBooking } from '@/lib/data/types'
import { PageHeader } from '@/components/layout/layouts'
import { MockSuccessScreen } from '@/components/shared/MockSuccessScreen'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
// Membership temporarily disabled (only used by the member-discount row)
// import { Badge } from '@/components/ui/badge'
import { Field, Input } from '@/components/ui/input'
import { FACILITIES, FACILITY_ITEMS /*, TIER_BY_KEY */ } from '@/lib/data/mock'
import { createFacilityBooking /*, getMembership */ } from '@/lib/data/api'
import { useAuthStore } from '@/lib/store/auth'
// Membership temporarily disabled (useAsync had no other caller here)
// import { useAsync } from '@/lib/hooks'
import { cn, fmtDate, useMoney } from '@/lib/utils'

type FacilityKey = FacilityBooking['facility']

export default function Facility() {
  const t = useT()
  const money = useMoney()
  const user = useAuthStore((s) => s.user)!
  // Membership temporarily disabled
  // const { data: membership } = useAsync(() => getMembership(user.id), [user.id])

  const [facility, setFacility] = useState<FacilityKey>('main-hall')
  const [date, setDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 21)
    return d.toISOString().slice(0, 10)
  })
  const [qty, setQty] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<FacilityBooking | null>(null)

  const spec = FACILITIES.find((f) => f.key === facility)!
  const lines = FACILITY_ITEMS.filter((it) => (qty[it.label] ?? 0) > 0).map((it) => ({
    label: it.label,
    qty: qty[it.label]!,
    price: it.price,
  }))
  const subtotal = lines.reduce<number>((s, l) => s + l.qty * l.price, spec.baseRate)
  // Membership temporarily disabled — no tier discount, so the total is the subtotal.
  // const discountPct =
  //   membership?.status === 'active'
  //     ? (TIER_BY_KEY.get(membership.tier)?.facilityDiscountPct ?? 0)
  //     : 0
  // const discount = Math.round((subtotal * discountPct) / 100)
  const total = subtotal

  const book = async () => {
    setBusy(true)
    await new Promise((r) => setTimeout(r, 800))
    const fb = await createFacilityBooking({
      userId: user.id,
      facility,
      date: new Date(date).toISOString(),
      items: lines,
      total,
    })
    setBusy(false)
    setDone(fb)
  }

  if (done) {
    return (
      <MockSuccessScreen
        title={t('facility.submitted', 'Hall request submitted')}
        subtitle={t('facility.submittedD', 'The temple office will confirm availability within one business day.')}
        referenceLabel={t('facility.request', 'Request')}
        reference={done.id}
        rows={[
          { label: t('facility.facility', 'Facility'), value: spec.label },
          { label: t('facility.date', 'Date'), value: fmtDate(done.date, 'EEEE, MMMM d, yyyy') },
          {
            label: t('mypujas.addons', 'Add-ons'),
            value: lines.length ? lines.map((l) => `${l.label} ×${l.qty}`).join(', ') : t('common.none', 'None'),
          },
          // Membership temporarily disabled
          // ...(discount
          //   ? [{ label: `Member discount (${discountPct}%)`, value: `−${money(discount)}` }]
          //   : []),
          { label: t('facility.estTotal', 'Estimated total'), value: money(done.total) },
        ]}
        emailSubject={`Your ${spec.label} booking request for ${fmtDate(done.date)}`}
        emailBody={
          <>
            <p>Dear {user.name},</p>
            <p className="mt-2">
              We have received your request for the <strong>{spec.label}</strong> on{' '}
              {fmtDate(done.date, 'EEEE, MMMM d, yyyy')}. The office will confirm the date and send
              a final invoice for {money(done.total)}.
            </p>
            <p className="mt-2 text-muted">
              Setup access begins two hours before your slot. Vegetarian catering only, please.
            </p>
          </>
        }
        actions={
          <>
            <Link to="/dashboard" className={buttonVariants({ variant: 'ghost' })}>
              {t('facility.backDash', 'Back to dashboard')}
            </Link>
            <Link to="/facility" className={buttonVariants({})} onClick={() => setDone(null)}>
              {t('facility.another', 'Book another date')}
            </Link>
          </>
        }
      />
    )
  }

  return (
    <>
      <PageHeader
        title={t('facility.title', 'Book a facility')}
        subtitle={t('facility.subtitle', 'Weddings, naming ceremonies, birthdays and community gatherings.')}
      />

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="font-serif text-[18px]">{t('facility.choose', 'Choose a space')}</h2>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
              {FACILITIES.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={facility === f.key}
                  onClick={() => setFacility(f.key)}
                  className={cn(
                    'rounded-[10px] border p-4 text-left transition-colors active:scale-[.99]',
                    facility === f.key
                      ? 'border-brand-500 bg-brand-500/[0.06] ring-2 ring-brand-500/20'
                      : 'border-line bg-card hover:border-brand-300',
                  )}
                >
                  <Building2
                    className={cn('size-5', facility === f.key ? 'text-brand-500' : 'text-muted')}
                  />
                  <span className="mt-2 block font-serif text-[16px] text-ink">{f.label}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-[12.5px] text-muted">
                    <Users className="size-3.5" />
                    {t('facility.seats', 'Seats {n}', { n: f.capacity })}
                  </span>
                  <span className="mt-1.5 block text-[13px] font-medium text-ink">
                    {money(f.baseRate)} {t('facility.base', 'base')}
                  </span>
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-serif text-[18px]">{t('facility.date', 'Date')}</h2>
            <Field label={t('facility.eventDate', 'Event date')} htmlFor="fb-date" className="mt-3 max-w-[220px]">
              <Input
                id="fb-date"
                type="date"
                value={date}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <p className="mt-2 text-[12.5px] text-muted">
              {t('facility.within14', 'Dates within 14 days are subject to priest and volunteer availability.')}
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="font-serif text-[18px]">{t('facility.rateCard', 'Rate card')}</h2>
            <p className="mt-1 text-[13px] text-muted">
              {t('facility.rateNote', 'Add only what you need — set a quantity to zero to remove it.')}
            </p>
            <ul className="mt-3 divide-y divide-line">
              {FACILITY_ITEMS.map((it) => (
                <li key={it.label} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium text-ink">{it.label}</p>
                    <p className="text-[12px] text-muted">
                      {money(it.price)} {it.unit}
                    </p>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    aria-label={t('facility.qtyOf', 'Quantity of {item}', { item: it.label })}
                    value={qty[it.label] ?? 0}
                    onChange={(e) =>
                      setQty((q) => ({
                        ...q,
                        [it.label]: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="w-[92px]"
                  />
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card className="sticky top-6 p-5">
          <h3 className="font-serif text-[18px]">{t('facility.estimate', 'Estimate')}</h3>
          <dl className="mt-3 space-y-2.5 text-[13.5px]">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted">{spec.label} {t('facility.base', 'base')}</dt>
              <dd className="font-medium tabular-nums">{money(spec.baseRate)}</dd>
            </div>
            {lines.map((l) => (
              <div key={l.label} className="flex items-baseline justify-between gap-3">
                <dt className="min-w-0 truncate text-muted">
                  {l.label} × {l.qty}
                </dt>
                <dd className="font-medium tabular-nums">{money(l.qty * l.price)}</dd>
              </div>
            ))}
            {/* Membership temporarily disabled */}
            {/* {discount > 0 ? (
              <div className="flex items-baseline justify-between gap-3 text-leaf-600">
                <dt className="flex items-center gap-1.5">
                  Member discount
                  <Badge variant="leaf">{discountPct}%</Badge>
                </dt>
                <dd className="font-medium tabular-nums">−{money(discount)}</dd>
              </div>
            ) : null} */}
          </dl>

          <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-line pt-3">
            <span className="text-[13.5px] font-medium">{t('facility.estTotal', 'Estimated total')}</span>
            <span className="text-[26px] tabular-nums">{money(total)}</span>
          </div>
          <p className="mt-1 text-[12px] text-muted">{fmtDate(date, 'EEEE, MMMM d, yyyy')}</p>

          <Button size="lg" className="mt-4 w-full" onClick={book} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Building2 />}
            {busy ? t('facility.submitting', 'Submitting…') : t('facility.requestDate', 'Request this date')}
          </Button>

          {/* Membership temporarily disabled */}
          {/* {discountPct === 0 ? (
            <p className="mt-2.5 text-[12px] leading-relaxed text-muted">
              <Link to="/membership" className="font-medium text-brand-500 hover:underline">
                Members save 5–15%
              </Link>{' '}
              on every facility booking.
            </p>
          ) : null} */}
        </Card>
      </div>
    </>
  )
}
