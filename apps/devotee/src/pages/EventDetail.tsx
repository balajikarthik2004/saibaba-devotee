import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarPlus,
  Check,
  ExternalLink,
  HandCoins,
  Minus,
  Plus,
  Users,
} from 'lucide-react'
import { formatMoney, useCurrentTemple, useT } from '@saibaba/core'
import { DeityArt } from '@/components/shared/DeityArt'
import { eventImageKey } from '@/components/shared/EventCard'
import { BreakEvenMeter } from '@/components/shared/BreakEvenMeter'
import { EmptyState, LoadingSkeleton } from '@/components/shared/states'
import { StatusPill } from '@/components/shared/badges'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { getEventBySlug, rsvpToEvent } from '@/lib/data/api'
import { useAuthStore } from '@/lib/store/auth'
import { useAsync } from '@/lib/hooks'
import { cn, fmtDate, googleCalendarUrl } from '@/lib/utils'

export default function EventDetail() {
  const t = useT()
  const TEMPLE = useCurrentTemple()
  const { slug } = useParams<{ slug: string }>()
  const user = useAuthStore((s) => s.user)
  const { toast } = useToast()

  const { data: event, loading, refresh } = useAsync(() => getEventBySlug(slug!), [slug])

  // Amounts are in the festival's own currency (its temple's), never converted.
  const money = (n: number) => formatMoney(n, event?.currency ?? TEMPLE.currency)

  const [seats, setSeats] = useState(2)
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [rsvped, setRsvped] = useState(false)

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8">
        <LoadingSkeleton variant="table" rows={5} />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-16">
        <EmptyState
          title={t('events.notFound', 'Festival not found')}
          detail={t('events.notFoundD', 'It may have been renamed or removed from the calendar.')}
          action={
            <Link to="/events" className={buttonVariants({ size: 'sm' })}>
              {t('events.all', 'All festivals')}
            </Link>
          }
        />
      </div>
    )
  }

  const totalCost = event.costs.reduce((s, c) => s + c.amount, 0)
  const startDate = new Date(event.date)

  const submitRsvp = async (e: React.FormEvent) => {
    e.preventDefault()
    await rsvpToEvent(event.id, seats)
    setRsvped(true)
    refresh()
    toast(t('events.rsvpDone', 'RSVP recorded'), {
      detail: t('events.rsvpDetail', '{n} seat(s) for {title}.', { n: seats, title: event.title }),
    })
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Link
        to="/events"
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" />
        {t('events.all', 'All festivals')}
      </Link>

      <section className="relative overflow-hidden rounded-[14px] border border-line shadow-[var(--shadow-lg)]">
        <DeityArt
          deity={eventImageKey(event.title)}
          className="absolute inset-0 h-full w-full"
          label={`${event.title} flyer`}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-sai-900/85 via-sai-900/55 to-transparent" />
        <div className="relative flex min-h-[240px] flex-col justify-end gap-2 p-6 sm:p-9">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={event.status} />
            {event.ticketPrice ? (
              <span className="rounded-full bg-white/15 px-3 py-1 text-[12px] font-medium text-white backdrop-blur">
                {money(event.ticketPrice)} {t('events.perSeat', 'per seat')}
              </span>
            ) : (
              <span className="rounded-full bg-white/15 px-3 py-1 text-[12px] font-medium text-white backdrop-blur">
                {t('events.freeAll', 'Free · all welcome')}
              </span>
            )}
          </div>
          <h1 className="max-w-2xl font-serif text-[32px] leading-[1.12] text-white sm:text-[38px]">
            {event.title}
          </h1>
          <p className="text-[14px] text-white/85">
            {fmtDate(event.date, 'EEEE, MMMM d, yyyy')}
            {event.endDate ? ` – ${fmtDate(event.endDate, 'MMMM d')}` : ''} · {TEMPLE.name}
          </p>
        </div>
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="font-serif text-[20px]">{t('events.about', 'About this festival')}</h2>
            <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{event.description}</p>

            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
              <a
                href={googleCalendarUrl({
                  title: `${event.title} — ${TEMPLE.name}`,
                  start: startDate,
                  durationMin: 180,
                  details: event.description,
                  location: `${TEMPLE.address}, ${TEMPLE.city}, ${TEMPLE.state} ${TEMPLE.zip}`,
                })}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: 'ghost', size: 'sm' })}
              >
                <CalendarPlus />
                {t('next.addCal', 'Add to calendar')}
                <ExternalLink className="size-3" />
              </a>
              <Link
                to={`/donate?category=event&event=${event.id}`}
                className={buttonVariants({ size: 'sm' })}
              >
                <HandCoins />
                {t('events.sponsor', 'Sponsor this festival')}
              </Link>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-serif text-[20px]">{t('events.costs', 'What it costs')}</h2>
              <span className="text-[13px] text-muted">
                {t('events.published', 'Published budget · {amount} total', { amount: money(totalCost) })}
              </span>
            </div>
            <ul className="mt-3 divide-y divide-line">
              {event.costs.map((c) => (
                <li key={c.label} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-[13.5px] text-ink">{c.label}</span>
                  <span className="text-[13.5px] font-medium tabular-nums">{money(c.amount)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
              {t('events.costsNote', 'These are direct costs only. Any surplus above the target goes to the temple’s general operating fund and is reported in the annual statement.')}
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="font-serif text-[20px]">{t('events.rsvp', 'RSVP')}</h2>
            {rsvped ? (
              <div className="mt-3 flex items-start gap-3 rounded-[10px] border border-leaf-500/30 bg-leaf-500/[0.07] p-4">
                <Check className="mt-0.5 size-5 shrink-0 text-leaf-500" />
                <div>
                  <p className="text-[14px] font-medium text-ink">
                    {t('events.onList', 'You’re on the list — {n} seat(s)', { n: seats })}
                  </p>
                  <p className="mt-0.5 text-[13px] text-muted">
                    {t('events.reminder', 'A reminder will go to {email} the day before. No ticket needed — just give your name at the desk.', { email: email || t('events.yourEmail', 'your email') })}
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={submitRsvp} className="mt-3 grid gap-4 sm:grid-cols-2">
                <Field label={t('events.yourName', 'Your name')} htmlFor="rsvp-name">
                  <Input
                    id="rsvp-name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('events.namePh', 'Full name')}
                  />
                </Field>
                <Field label={t('profile.email', 'Email')} htmlFor="rsvp-email">
                  <Input
                    id="rsvp-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@gmail.com"
                  />
                </Field>
                <Field
                  label={event.ticketPrice ? t('events.seats', 'Seats') : t('events.howMany', 'How many attending?')}
                  className="sm:col-span-2"
                >
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={t('events.fewer', 'Fewer seats')}
                      onClick={() => setSeats((s) => Math.max(1, s - 1))}
                    >
                      <Minus />
                    </Button>
                    <span className="w-12 text-center text-[20px] tabular-nums">{seats}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={t('events.more', 'More seats')}
                      onClick={() => setSeats((s) => Math.min(20, s + 1))}
                    >
                      <Plus />
                    </Button>
                    {event.ticketPrice ? (
                      <span className="ml-3 text-[13.5px] text-muted">
                        {money(event.ticketPrice * seats)} {t('events.total', 'total')}
                      </span>
                    ) : null}
                  </div>
                </Field>
                <Button type="submit" className="sm:col-span-2">
                  {event.ticketPrice
                    ? t('events.reserve', 'Reserve {n} seat(s)', { n: seats })
                    : t('events.countMeIn', 'Count me in')}
                </Button>
              </form>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <h3 className="font-serif text-[18px]">{t('events.budget', 'Festival budget')}</h3>
            <BreakEvenMeter
              className="mt-3"
              target={event.targetAmount}
              collected={event.collectedAmount}
              label={t('events.raisedSoFar', 'Raised so far')}
            />
            <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
              {t('events.live', 'Published live. Updated nightly · full transparency.')}
            </p>
            <Link
              to={`/donate?category=event&event=${event.id}`}
              className={cn(buttonVariants({}), 'mt-4 w-full')}
            >
              {t('events.closeGap', 'Help close the gap')}
            </Link>
          </Card>

          <Card className="p-5">
            <h3 className="font-serif text-[18px]">{t('events.details', 'Details')}</h3>
            <dl className="mt-3 space-y-3 text-[13.5px]">
              <div>
                <dt className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                  {t('events.when', 'When')}
                </dt>
                <dd className="mt-0.5">{fmtDate(event.date, 'EEEE, MMMM d, yyyy')}</dd>
              </div>
              <div>
                <dt className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                  {t('events.where', 'Where')}
                </dt>
                <dd className="mt-0.5">
                  {TEMPLE.name}
                  <br />
                  {TEMPLE.address}, {TEMPLE.city}, {TEMPLE.state} {TEMPLE.zip}
                </dd>
              </div>
              <div>
                <dt className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                  {t('events.attending', 'Attending')}
                </dt>
                <dd className="mt-0.5 flex items-center gap-1.5">
                  <Users className="size-3.5 text-muted" />
                  {event.rsvpCount} {t('events.devotees', 'devotees')}
                </dd>
              </div>
              <div>
                <dt className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                  {t('events.entry', 'Entry')}
                </dt>
                <dd className="mt-0.5">
                  {event.ticketPrice
                    ? `${money(event.ticketPrice)} ${t('events.perSeat', 'per seat')}`
                    : t('events.freeAll', 'Free · all welcome')}
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  )
}
