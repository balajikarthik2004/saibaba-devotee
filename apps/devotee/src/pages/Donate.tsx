import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarDays, HandCoins, Loader2, UserRound } from 'lucide-react'
import {
  CURRENCY_META,
  GIFT_PRESETS,
  formatMoney,
  providerLabel,
  recordGift,
  regimeConfig,
  saveTaxDeclaration,
  useCurrentTemple,
  useT,
  validateDeclaration,
} from '@saibaba/core'
import type { RecordedGift } from '@saibaba/core'
import type { Cadence, DonationCategory, TempleEvent } from '@/lib/data/types'
import { PageHeader } from '@/components/layout/layouts'
import { GuestDonorForm } from '@/components/shared/GuestDonorForm'
import { AmountPresets } from '@/components/shared/AmountPresets'
import { BreakEvenMeter } from '@/components/shared/BreakEvenMeter'
import { MockSuccessScreen } from '@/components/shared/MockSuccessScreen'
import { TaxReceiptPreview } from '@/components/shared/TaxReceiptPreview'
import { LoadingSkeleton } from '@/components/shared/states'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox, Field, Input, Radio } from '@/components/ui/input'
import { PaymentActionDialog } from '@/features/giving/components/PaymentActionDialog'
import { PaymentStep } from '@/features/giving/components/PaymentStep'
import { InstructionsPanel } from '@/features/giving/components/InstructionsPanel'
import { DownloadPdfButton } from '@/features/giving/components/ReceiptView'
import { hasDeclaration } from '@/features/giving/components/TaxFields'
import { useCheckout } from '@/features/giving/useCheckout'
import { declarationOwner, usePaymentChoice } from '@/features/giving/usePaymentChoice'
import { DONATION_CATEGORIES } from '@/lib/data/mock'
import { listEvents } from '@/lib/data/api'
import type { DonorIdentity } from '@/lib/donor'
import { signUpHrefFor, useDonorIdentity } from '@/lib/donor'
import { useGuestDonorStore } from '@/lib/store/guest'
import { useAuthStore } from '@/lib/store/auth'
import { useAsync } from '@/lib/hooks'
import { cn, fmtDate, titleCase } from '@/lib/utils'

const CADENCES: Extract<Cadence, 'monthly' | 'yearly'>[] = ['monthly', 'yearly']

/**
 * The donation screen is reachable without an account.
 *
 * A visitor who clicks Donate on the public site used to be redirected to sign-in, which
 * asked them to do a second, unrelated thing before the one they came for. Instead the
 * gate takes the four details a receipt actually needs and hands straight over to the
 * form below, at the same URL, so a `?category=event&event=…` link from a festival page
 * survives the detour intact.
 */
export default function Donate() {
  const identity = useDonorIdentity()
  const setContact = useGuestDonorStore((s) => s.setContact)

  if (!identity) return <GuestDonorForm onReady={setContact} />
  return <DonateForm identity={identity} />
}

function DonateForm({ identity }: { identity: DonorIdentity }) {
  const t = useT()
  const temple = useCurrentTemple()
  const currency = temple.currency
  const fmt = (n: number) => formatMoney(n, currency)
  const cfg = regimeConfig(temple.taxRegime)
  const [params] = useSearchParams()
  const clearContact = useGuestDonorStore((s) => s.clearContact)
  const user = useAuthStore((s) => s.user)

  const [category, setCategory] = useState<DonationCategory>(
    (params.get('category') as DonationCategory) ?? 'general-hundi',
  )
  const [amount, setAmount] = useState(Number(params.get('amount')) || GIFT_PRESETS[currency][2]!)
  const [recurring, setRecurring] = useState(false)
  const [cadence, setCadence] = useState<(typeof CADENCES)[number]>('monthly')
  const [dedication, setDedication] = useState(params.get('dedicate') ?? '')
  const [submitted, setSubmitted] = useState(false)
  const [done, setDone] = useState<RecordedGift | null>(null)
  const [recordError, setRecordError] = useState<string | null>(null)

  // A different temple has a different currency, so a half-chosen amount no longer makes sense.
  useEffect(() => {
    setAmount((a) => (GIFT_PRESETS[currency].includes(a) ? a : GIFT_PRESETS[currency][2]!))
  }, [currency])

  /* --------------------------------------------------- event sponsorship state */

  const isEvent = category === 'event'

  // Only fetched once the devotee actually asks for the event fund; the other seven
  // categories have no reason to pay for this list.
  const { data: events, loading: eventsLoading } = useAsync(
    async () => (isEvent ? (await listEvents()).filter((e) => e.status !== 'completed') : []),
    [isEvent],
  )

  const [eventId, setEventId] = useState<string | null>(params.get('event'))
  const [picked, setPicked] = useState<string[]>([])
  const [topUp, setTopUp] = useState(0)

  const selectedEvent: TempleEvent | undefined = useMemo(
    () => events?.find((e) => e.id === eventId),
    [events, eventId],
  )

  // A festival is a fixed date, so a monthly-repeating sponsorship of one is incoherent.
  useEffect(() => {
    if (isEvent) setRecurring(false)
  }, [isEvent])

  // Items belong to the event that offers them; switching festivals clears the ticks
  // rather than carrying "Flowers & garlands" over at the wrong price.
  const chooseEvent = (id: string) => {
    setEventId(id)
    setPicked([])
  }

  const toggleItem = (key: string) =>
    setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]))

  const chosen = selectedEvent?.sponsorships.filter((o) => picked.includes(o.key)) ?? []
  const itemsSubtotal = chosen.reduce((s, o) => s + o.price, 0)

  /** The gift itself: items plus top-up for an event, else the preset. */
  const net = isEvent ? itemsSubtotal + topUp : amount

  /* ------------------------------------------------------------- payment state */

  const flow = usePaymentChoice(temple, net, {
    userId: identity.userId,
    email: identity.contact.email,
    country: user?.country,
  })
  const { choice, provider, charge, fee, blocked } = flow
  const checkout = useCheckout(temple)

  const recurringOk = Boolean(provider?.supportsRecurring) && !isEvent
  useEffect(() => {
    if (!recurringOk) setRecurring(false)
  }, [recurringOk])

  const signUpHref = signUpHrefFor(identity.contact)
  const payerCountry = choice.donorCountry === 'XX' ? temple.country : choice.donorCountry
  const declarationCheck = validateDeclaration(temple.taxRegime, choice.declaration)

  const finalize = async (result: NonNullable<Awaited<ReturnType<typeof checkout.start>>>) => {
    if (!provider) return
    const owner = declarationOwner(identity.userId, identity.contact.email)
    let profile = null
    if (hasDeclaration(choice.declaration)) {
      profile = await saveTaxDeclaration({
        ...choice.declaration,
        userId: owner,
        regime: temple.taxRegime,
        residentStatus: temple.taxRegime === 'in-80g' ? 'resident' : undefined,
      })
    }
    try {
      const recorded = await recordGift({
        temple,
        donor: {
          userId: identity.userId,
          contact: identity.contact,
          name: identity.name,
          address: identity.address,
          country: payerCountry,
        },
        category,
        charge,
        fee,
        feeCovered: choice.coverFee && fee > 0,
        provider: provider.key,
        result,
        recurring: recurring && recurringOk ? cadence : undefined,
        dedicatedTo: dedication.trim() || undefined,
        eventId: isEvent && selectedEvent ? selectedEvent.id : undefined,
        eventItems: isEvent && chosen.length ? chosen.map((o) => o.label) : undefined,
        employer: temple.country === 'US' ? choice.employer : undefined,
        reference: choice.donorReference || undefined,
        receiptDonor: {
          userId: identity.userId,
          name: identity.name,
          email: identity.contact.email,
          address: identity.address,
          profile,
        },
      })
      checkout.reset()
      setDone(recorded)
    } catch (e) {
      setRecordError((e as Error).message)
    }
  }

  const give = async () => {
    setSubmitted(true)
    setRecordError(null)
    if (blocked || !provider || charge < 1 || !declarationCheck.ok) return
    const r = await checkout.start({
      templeId: temple.id,
      amount: charge,
      currency,
      purpose: 'donation',
      reference: `donation-${Date.now().toString(36)}`,
      provider: provider.key,
      payer: {
        name: identity.name,
        email: identity.contact.email,
        phone: identity.contact.phone,
        country: payerCountry,
      },
      recurring: recurring && recurringOk ? cadence : undefined,
      testCard: provider.live() ? undefined : choice.testCard,
      razorpayMethod: choice.razorpayMethod,
      feeCovered: choice.coverFee,
    })
    if (r) await finalize(r)
  }

  const busy = checkout.phase === 'creating' || checkout.phase === 'confirming'

  if (done) {
    const { donation: d, receipt, meta } = done
    const pending = meta.status !== 'succeeded'
    const fundName = titleCase(d.category)
    return (
      <MockSuccessScreen
        title={
          pending
            ? t('giving.success.pledge', 'Your gift is recorded')
            : t('giving.success.thanks', 'Thank you for your offering')
        }
        subtitle={t('giving.success.subtitle', '{amount} to the {fund} fund{repeat}.', {
          amount: fmt(d.amount),
          fund: fundName,
          repeat: d.isRecurring ? `, repeating ${d.recurringCadence}` : '',
        })}
        referenceLabel={t('giving.success.ref', 'Donation')}
        reference={d.id}
        rows={[
          { label: t('giving.success.fund', 'Fund'), value: fundName },
          ...(selectedEvent
            ? [
                { label: t('giving.success.festival', 'Festival'), value: selectedEvent.title },
                {
                  label: t('giving.success.festivalDate', 'Festival date'),
                  value: fmtDate(selectedEvent.date, 'EEEE, MMMM d, yyyy'),
                },
              ]
            : []),
          ...(d.eventItems?.length
            ? [{ label: t('giving.success.sponsoring', 'Sponsoring'), value: d.eventItems.join(', ') }]
            : []),
          ...(topUp > 0 && isEvent
            ? [{ label: t('giving.success.additional', 'Additional gift'), value: fmt(topUp) }]
            : []),
          { label: t('giving.success.amount', 'Amount'), value: fmt(d.amount) },
          ...(meta.fee > 0 && meta.feeCovered
            ? [{ label: t('giving.success.feeCovered', 'Includes processing fee'), value: fmt(meta.fee) }]
            : []),
          {
            label: t('giving.success.frequency', 'Frequency'),
            value: d.isRecurring ? `Recurring · ${titleCase(d.recurringCadence!)}` : 'One-time',
          },
          { label: t('giving.success.method', 'Method'), value: providerLabel(meta.provider) },
          {
            label: t('giving.success.status', 'Status'),
            value: pending
              ? t('giving.success.pending', 'Pending: awaiting your payment')
              : t('giving.success.received', 'Received'),
          },
          ...(d.dedicatedTo ? [{ label: t('giving.success.dedicated', 'Dedicated to'), value: d.dedicatedTo }] : []),
          ...(choice.employer && temple.country === 'US'
            ? [{ label: t('giving.success.match', 'Employer match'), value: t('giving.success.matchReq', 'Requested from {employer}', { employer: choice.employer }) }]
            : []),
        ]}
        emailSubject={`Your ${fmt(d.amount)} donation to ${temple.name}`}
        emailBody={
          <>
            <p>Dear {identity.name},</p>
            <p className="mt-2">
              Thank you for your donation of <strong>{fmt(d.amount)}</strong> to the {fundName} fund.{' '}
              {pending
                ? 'We will send your receipt as soon as your payment reaches the temple.'
                : 'Your receipt is attached below and will also appear in your annual statement.'}
            </p>
            {pending && meta.provider !== 'upi' ? (
              <p className="mt-2">
                Please quote <strong>{d.id}</strong> with your payment.
              </p>
            ) : null}
            {selectedEvent ? (
              <p className="mt-2">
                Your gift sponsors <strong>{selectedEvent.title}</strong> on{' '}
                {fmtDate(selectedEvent.date, 'MMMM d, yyyy')}
                {d.eventItems?.length ? <> — {d.eventItems.join(', ')}</> : null}. Your name will be
                read in the sankalpam on the day.
              </p>
            ) : null}
            {d.dedicatedTo ? (
              <p className="mt-2">
                This donation was dedicated: <em>{d.dedicatedTo}</em>.
              </p>
            ) : null}
          </>
        }
        extra={
          <div className="space-y-5">
            {pending && meta.provider !== 'upi' ? (
              <InstructionsPanel providerKey={meta.provider} temple={temple} reference={d.id} />
            ) : null}
            {pending && meta.provider === 'upi' ? (
              <p className="rounded-[10px] border border-saffron-400/50 bg-saffron-500/[0.07] p-4 text-[13px]">
                {t('giving.success.upiPending', 'The temple office will match your UPI payment to the bank statement, then issue your receipt.')}
              </p>
            ) : null}
            {receipt ? (
              <>
                <TaxReceiptPreview receipt={receipt} />
                <div className="flex justify-center">
                  <DownloadPdfButton receipt={receipt} label={t('giving.pdf.downloadReceipt', 'Download receipt (PDF)')} />
                </div>
              </>
            ) : (
              <p className="text-center text-[12.5px] text-muted">
                {t('giving.success.receiptLater', 'Your {title} is issued once the payment is received.', {
                  title: cfg.receiptTitle.toLowerCase(),
                })}
              </p>
            )}
          </div>
        }
        actions={
          identity.isGuest ? (
            // A guest has no dashboard to go back to. What they are offered instead is
            // the gift they just made, and the one step that turns four typed fields
            // into a real record, pre-filled so it costs them nothing to accept.
            <>
              <Link to="/" className={buttonVariants({ variant: 'ghost' })}>
                {t('giving.success.backSite', 'Back to the temple site')}
              </Link>
              <Link to="/my/donations" className={buttonVariants({ variant: 'outline' })}>
                {t('giving.success.myGiving', 'My giving')}
              </Link>
              <Link to={signUpHref} className={buttonVariants({})}>
                {t('giving.success.createAccount', 'Create my account')}
              </Link>
            </>
          ) : (
            <>
              <Link to="/dashboard" className={buttonVariants({ variant: 'ghost' })}>
                {t('giving.success.backDash', 'Back to dashboard')}
              </Link>
              <Link to="/my/donations" className={buttonVariants({})}>
                {t('giving.success.myDonations', 'My donations')}
              </Link>
            </>
          )
        }
      />
    )
  }

  return (
    <>
      <PageHeader
        title={t('giving.donate.title', 'Make a donation')}
        subtitle={t(
          'giving.donate.subtitle',
          'Choose where your donation goes. Every fund is reported separately in the annual statement.',
        )}
      />

      {/* A guest gave their details at the gate and is not asked again, but they can
          still see whose name the receipt will carry, and correct it. Without this the
          details vanish the moment they are accepted, which is exactly when a typo in
          an email address becomes expensive. */}
      {identity.isGuest ? (
        <Card className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1.5 p-3.5">
          <UserRound className="size-4 shrink-0 text-brand-500" />
          <p className="min-w-0 text-[13px]">
            <span className="text-muted">{t('giving.donate.givingAs', 'Giving as')}</span>{' '}
            <span className="font-medium text-ink">{identity.name}</span>{' '}
            <span className="text-muted">· {identity.contact.email}</span>
          </p>
          <button
            type="button"
            onClick={clearContact}
            className="ml-auto text-[13px] font-medium text-brand-500 hover:underline"
          >
            {t('giving.donate.change', 'Not you? Change details')}
          </button>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="font-serif text-[18px]">
              {t('giving.donate.where', 'Where would you like to give?')}
            </h2>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {DONATION_CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  aria-pressed={category === c.key}
                  onClick={() => setCategory(c.key)}
                  className={cn(
                    'rounded-[10px] border p-3.5 text-left transition-colors active:scale-[.99]',
                    category === c.key
                      ? 'border-brand-500 bg-brand-500/[0.06] ring-2 ring-brand-500/20'
                      : 'border-line bg-card hover:border-brand-300',
                  )}
                >
                  <span className="block text-[14px] font-medium text-ink">{c.label}</span>
                  <span className="block text-[12.5px] text-muted">{c.blurb}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* The event fund is the one category that needs to know *which* event. Everything
              below appears only once "Event Sponsorship" is the chosen fund. */}
          {isEvent ? (
            <Card className="p-5">
              <h2 className="font-serif text-[18px]">{t('giving.donate.whichFestival', 'Which festival?')}</h2>
              <p className="mt-1 text-[13px] text-muted">
                {t('giving.donate.festivalHint', 'Upcoming festivals still raising toward their published target.')}
              </p>

              {eventsLoading ? (
                <LoadingSkeleton variant="tiles" rows={3} className="mt-3" />
              ) : events && events.length > 0 ? (
                // The temple year runs to eighteen festivals. Listing them all above the
                // sponsorship checkboxes buried the actual task under a page of scrolling,
                // so the list caps its height until a choice is made and collapses to the
                // chosen festival after.
                <div
                  className={cn(
                    'mt-3 space-y-2.5',
                    !selectedEvent && 'max-h-[22rem] overflow-y-auto pr-1',
                  )}
                >
                  {(selectedEvent ? [selectedEvent] : events).map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      aria-pressed={eventId === e.id}
                      onClick={() => chooseEvent(e.id)}
                      className={cn(
                        'block w-full rounded-[10px] border p-3.5 text-left transition-colors active:scale-[.99]',
                        eventId === e.id
                          ? 'border-brand-500 bg-brand-500/[0.06] ring-2 ring-brand-500/20'
                          : 'border-line bg-card hover:border-brand-300',
                      )}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <span className="text-[14px] font-medium text-ink">{e.title}</span>
                        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted">
                          <CalendarDays className="size-3.5" />
                          {fmtDate(e.date, 'MMM d, yyyy')}
                        </span>
                      </div>
                      <BreakEvenMeter
                        target={e.targetAmount}
                        collected={e.collectedAmount}
                        label=""
                        compact
                        className="mt-2"
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-[13.5px] text-muted">
                  {t('giving.donate.noFestivals', 'No festivals are open for sponsorship right now. Please pick another fund.')}
                </p>
              )}

              {selectedEvent ? (
                <button
                  type="button"
                  onClick={() => chooseEvent('')}
                  className="mt-2.5 text-[13px] font-medium text-brand-500 hover:underline"
                >
                  {t('giving.donate.otherFestival', 'Choose a different festival')}
                </button>
              ) : null}
            </Card>
          ) : null}

          {isEvent && selectedEvent ? (
            <Card className="p-5">
              <h2 className="font-serif text-[18px]">
                {t('giving.donate.whatSponsor', 'What would you like to sponsor?')}
              </h2>
              <p className="mt-1 text-[13px] text-muted">
                {t('giving.donate.sponsorHint', 'Tick any you wish to cover for {title}. Each is a fixed amount published by the temple office.', { title: selectedEvent.title })}
              </p>

              <ul className="mt-3 divide-y divide-line">
                {selectedEvent.sponsorships.map((o) => {
                  const on = picked.includes(o.key)
                  return (
                    <li key={o.key}>
                      <label className="flex cursor-pointer items-start gap-3 py-3.5">
                        <Checkbox className="mt-0.5" checked={on} onChange={() => toggleItem(o.key)} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-medium text-ink">{o.label}</span>
                          <span className="block text-[12.5px] leading-snug text-muted">{o.blurb}</span>
                        </span>
                        <span className="shrink-0 text-[14px] font-medium tabular-nums text-ink">
                          {fmt(o.price)}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>

              <p className="mt-3 border-t border-line pt-3 text-[12.5px] leading-relaxed text-muted">
                {t('giving.donate.sponsorNote', 'Sponsoring an item does not reserve it exclusively; several families often share one head. Your name is read in the sankalpam on the day either way.')}
              </p>
            </Card>
          ) : null}

          <Card className="space-y-4 p-5">
            <h2 className="font-serif text-[18px]">{t('giving.donate.howMuch', 'How much?')}</h2>

            {/* For an event the figure is the sum of the ticked items, so the presets would
                fight the checkboxes for control of the same number. The devotee still gets a
                free field, as a gift on top rather than a replacement. */}
            {isEvent ? (
              !selectedEvent ? (
                <p className="text-[13.5px] text-muted">
                  {t('giving.donate.pickFestival', 'Pick a festival above to see what you can sponsor.')}
                </p>
              ) : (
                <div className="space-y-3">
                  {chosen.length > 0 ? (
                    <dl className="space-y-2 text-[13.5px]">
                      {chosen.map((o) => (
                        <div key={o.key} className="flex items-baseline justify-between gap-3">
                          <dt className="min-w-0 truncate text-muted">{o.label}</dt>
                          <dd className="font-medium tabular-nums">{fmt(o.price)}</dd>
                        </div>
                      ))}
                      <div className="flex items-baseline justify-between gap-3 border-t border-line pt-2">
                        <dt className="font-medium">{t('giving.donate.subtotal', 'Subtotal')}</dt>
                        <dd className="font-medium tabular-nums">{fmt(itemsSubtotal)}</dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="text-[13.5px] text-muted">
                      {t('giving.donate.nothingTicked', 'Nothing ticked yet. You can still give any amount to {title} using the field below.', { title: selectedEvent.title })}
                    </p>
                  )}

                  <Field
                    label={t('giving.donate.additional', 'Additional gift')}
                    hint={t('giving.donate.optional', 'optional')}
                    htmlFor="dn-topup"
                    className="border-t border-line pt-3"
                  >
                    <div className="relative max-w-[220px]">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[15px] text-muted">
                        {CURRENCY_META[currency].symbol}
                      </span>
                      <Input
                        id="dn-topup"
                        type="number"
                        min={0}
                        step={1}
                        value={topUp || ''}
                        onChange={(e) => setTopUp(Math.max(0, Number(e.target.value) || 0))}
                        className={CURRENCY_META[currency].symbol.length > 1 ? 'pl-11 text-[15px]' : 'pl-7 text-[15px]'}
                        placeholder="0"
                      />
                    </div>
                  </Field>
                </div>
              )
            ) : (
              <AmountPresets value={amount} onChange={setAmount} currency={currency} />
            )}

            {/* A festival falls on one date, so a repeating sponsorship of it is
                incoherent. The choice is simply withheld for this fund. */}
            <div className={cn('border-t border-line pt-4', isEvent && 'hidden')}>
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
                {t('giving.donate.frequency', 'Frequency')}
              </p>
              <div className="flex flex-wrap gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-[13.5px]">
                  <Radio name="freq" checked={!recurring} onChange={() => setRecurring(false)} />
                  {t('giving.donate.oneTime', 'One-time donation')}
                </label>
                <label
                  className={cn(
                    'flex items-center gap-2 text-[13.5px]',
                    recurringOk ? 'cursor-pointer' : 'cursor-not-allowed opacity-50',
                  )}
                >
                  <Radio
                    name="freq"
                    checked={recurring}
                    disabled={!recurringOk}
                    onChange={() => setRecurring(true)}
                  />
                  {t('giving.donate.recurring', 'Recurring donation')}
                </label>
              </div>
              {!recurringOk && !isEvent ? (
                <p className="mt-1.5 text-[12px] text-muted">
                  {t('giving.donate.recurringOnline', 'Recurring gifts are available with card, Razorpay and UPI.')}
                </p>
              ) : null}

              {recurring ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {CADENCES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={cadence === c}
                      onClick={() => setCadence(c)}
                      className={cn(
                        'rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors',
                        cadence === c
                          ? 'border-brand-500 bg-brand-500 text-white'
                          : 'border-line bg-card text-ink hover:border-brand-300',
                      )}
                    >
                      {c === 'monthly' ? t('giving.donate.monthly', 'Monthly') : t('giving.donate.yearly', 'Yearly')}
                    </button>
                  ))}
                  {provider?.key === 'upi' ? (
                    <span className="text-[12px] text-muted">
                      {t('giving.donate.upiMandate', 'Simulated UPI AutoPay mandate')}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            <Field
              label={t('giving.donate.dedicate', 'Dedicate this donation to…')}
              hint={t('giving.donate.optional', 'optional')}
              htmlFor="dn-ded"
              className="border-t border-line pt-4"
            >
              <Input
                id="dn-ded"
                value={dedication}
                onChange={(e) => setDedication(e.target.value)}
                placeholder={t('giving.donate.dedicatePh', 'In memory of my father')}
              />
            </Field>
          </Card>

          <Card className="space-y-3 p-5">
            <h2 className="font-serif text-[18px]">{t('giving.donate.payment', 'Payment')}</h2>
            <PaymentStep temple={temple} flow={flow} net={net} showMatching showErrors={submitted} />
          </Card>
        </div>

        <Card className="p-5 lg:sticky lg:top-6">
          <h3 className="font-serif text-[18px]">{t('giving.donate.yourDonation', 'Your donation')}</h3>
          <dl className="mt-3 space-y-2.5 text-[13.5px]">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted">{t('giving.donate.fund', 'Fund')}</dt>
              <dd className="font-medium">{titleCase(category)}</dd>
            </div>
            {selectedEvent ? (
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">{t('giving.donate.festival', 'Festival')}</dt>
                <dd className="max-w-[55%] text-right font-medium">{selectedEvent.title}</dd>
              </div>
            ) : null}
            {chosen.map((o) => (
              <div key={o.key} className="flex items-baseline justify-between gap-3">
                <dt className="min-w-0 truncate text-muted">{o.label}</dt>
                <dd className="font-medium tabular-nums">{fmt(o.price)}</dd>
              </div>
            ))}
            {isEvent && topUp > 0 ? (
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">{t('giving.donate.additional', 'Additional gift')}</dt>
                <dd className="font-medium tabular-nums">{fmt(topUp)}</dd>
              </div>
            ) : null}
            {!isEvent ? (
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">{t('giving.donate.frequency', 'Frequency')}</dt>
                <dd className="font-medium">
                  {recurring ? `Recurring · ${titleCase(cadence)}` : t('giving.donate.oneTimeShort', 'One-time')}
                </dd>
              </div>
            ) : null}
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted">{t('giving.donate.method', 'Method')}</dt>
              <dd className="font-medium">{provider ? providerLabel(provider.key) : '—'}</dd>
            </div>
            {fee > 0 ? (
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">{t('giving.donate.fee', 'Processing fee')}</dt>
                <dd className="font-medium tabular-nums">{fmt(fee)}</dd>
              </div>
            ) : null}
            {dedication ? (
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">{t('giving.donate.dedication', 'Dedication')}</dt>
                <dd className="max-w-[55%] text-right font-medium">{dedication}</dd>
              </div>
            ) : null}
          </dl>

          <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-line pt-3">
            <span className="text-[13.5px] font-medium">{t('giving.donate.totalToday', 'Total today')}</span>
            <span className="text-[26px] tabular-nums">{fmt(charge)}</span>
          </div>

          <Button
            size="lg"
            className="mt-4 w-full"
            onClick={give}
            disabled={busy || charge < 1 || blocked || !provider}
          >
            {busy ? <Loader2 className="animate-spin" /> : <HandCoins />}
            {busy
              ? t('giving.donate.processing', 'Processing…')
              : t('giving.donate.give', 'Give {amount}', { amount: fmt(charge) })}
          </Button>

          {checkout.phase === 'failed' && checkout.error && !checkout.result ? (
            <p role="alert" className="mt-2 text-[12.5px] text-brand-700">
              {checkout.error}
            </p>
          ) : null}
          {recordError ? (
            <p role="alert" className="mt-2 text-[12.5px] text-brand-700">
              {recordError}
            </p>
          ) : null}
          {submitted && !declarationCheck.ok ? (
            <p role="alert" className="mt-2 text-[12.5px] text-brand-700">
              {t('giving.donate.fixDetails', 'Please check your receipt details above.')}
            </p>
          ) : null}

          {/* Says which of the two things is missing rather than leaving a dead button. */}
          {isEvent && charge < 1 ? (
            <p className="mt-2 text-[12px] text-muted">
              {selectedEvent
                ? t('giving.donate.tickOrAdd', 'Tick a sponsorship above, or enter an additional gift.')
                : t('giving.donate.chooseFestival', 'Choose a festival to continue.')}
            </p>
          ) : null}

          <p className="mt-2.5 text-[11.5px] leading-relaxed text-muted">{cfg.wording[0]}</p>
        </Card>
      </div>

      <PaymentActionDialog
        result={checkout.phase === 'action' || checkout.phase === 'confirming' || (checkout.phase === 'failed' && checkout.result) ? checkout.result : null}
        busy={checkout.phase === 'confirming'}
        error={checkout.phase === 'failed' ? checkout.error : null}
        amount={charge}
        currency={currency}
        prefill={{ name: identity.name, email: identity.contact.email, contact: identity.contact.phone }}
        onCancel={checkout.reset}
        onComplete={async (input) => {
          if (input.reference) flow.patch({ donorReference: input.reference })
          const r = await checkout.complete(input)
          if (r) await finalize(r)
        }}
      />
    </>
  )
}
