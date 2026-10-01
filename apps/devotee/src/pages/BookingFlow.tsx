import { useEffect, useReducer, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Clock, Flame, Loader2, Repeat } from 'lucide-react'
import {
  currentTemple,
  formatMoney,
  issueReceipt,
  legacyMethod,
  providerLabel,
  recordBookingPayment,
  regimeConfig,
  saveTaxDeclaration,
  useCurrentTemple,
  useT,
  validateDeclaration,
} from '@saibaba/core'
import type { GivingPaymentResult, GivingReceipt, PaymentProviderKey } from '@saibaba/core'
import type { Booking, Cadence, FamilyMember, PujaCatalogItem, Temple } from '@/lib/data/types'
import { PageHeader } from '@/components/layout/layouts'
import { DeityArt } from '@/components/shared/DeityArt'
import {
  MAX_SANKALPAM_NAMES,
  SankalpamFieldRepeater,
} from '@/components/shared/SankalpamFieldRepeater'
import { TaxReceiptPreview } from '@/components/shared/TaxReceiptPreview'
import { PaymentActionDialog } from '@/features/giving/components/PaymentActionDialog'
import { PaymentStep } from '@/features/giving/components/PaymentStep'
import { InstructionsPanel } from '@/features/giving/components/InstructionsPanel'
import { DownloadPdfButton } from '@/features/giving/components/ReceiptView'
import { hasDeclaration } from '@/features/giving/components/TaxFields'
import { useCheckout } from '@/features/giving/useCheckout'
import { declarationOwner, usePaymentChoice } from '@/features/giving/usePaymentChoice'
import { MockSuccessScreen } from '@/components/shared/MockSuccessScreen'
import { EmptyState, LoadingSkeleton } from '@/components/shared/states'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox, Field, Input } from '@/components/ui/input'
import { createBooking, getFamilyTree, getPujaById } from '@/lib/data/api'
import { STANDARD_ADDONS, priceForCadence } from '@/lib/data/mock'
import { CADENCE_LABEL, nextOccurrences, occurrencesPerYear } from '@/lib/schedule'
import { useAuthStore } from '@/lib/store/auth'
import { useAsync } from '@/lib/hooks'
import { cn, fmtDate, titleCase } from '@/lib/utils'

/** Amounts on this screen are in the current temple's own currency, never converted. */
const money = (n: number) => formatMoney(n, currentTemple().currency)

interface Booked {
  booking: Booking
  receipt: GivingReceipt | null
  pending: boolean
  providerKey: PaymentProviderKey
}

/* ------------------------------------------------------------------ reducer */

interface WizardState {
  step: 1 | 2 | 3 | 4
  cadence: Cadence
  startDate: string // yyyy-MM-dd
  names: string[]
  addOns: string[]
}

type Action =
  | { type: 'step'; step: WizardState['step'] }
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'cadence'; cadence: Cadence }
  | { type: 'startDate'; value: string }
  | { type: 'names'; names: string[] }
  | { type: 'toggleAddOn'; id: string }
  | { type: 'hydrate'; patch: Partial<WizardState> }

function reducer(s: WizardState, a: Action): WizardState {
  switch (a.type) {
    case 'step':
      return { ...s, step: a.step }
    case 'next':
      return { ...s, step: Math.min(4, s.step + 1) as WizardState['step'] }
    case 'back':
      return { ...s, step: Math.max(1, s.step - 1) as WizardState['step'] }
    case 'cadence':
      return { ...s, cadence: a.cadence }
    case 'startDate':
      return { ...s, startDate: a.value }
    case 'names':
      return { ...s, names: a.names }
    case 'toggleAddOn':
      return {
        ...s,
        addOns: s.addOns.includes(a.id) ? s.addOns.filter((x) => x !== a.id) : [...s.addOns, a.id],
      }
    case 'hydrate':
      return { ...s, ...a.patch }
  }
}

const CADENCES: Cadence[] = ['yearly', 'monthly', 'weekly', 'quarterly', 'daily']

const STEPS = ['Confirm puja', 'How often', 'Names', 'Review & pay']

/* -------------------------------------------------------------------- page */

export default function BookingFlow() {
  const { pujaId } = useParams<{ pujaId: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)!

  const { data: puja, loading } = useAsync(() => getPujaById(pujaId!), [pujaId])
  const { data: family } = useAsync(() => getFamilyTree(user.id), [user.id])

  const [state, dispatch] = useReducer(reducer, {
    step: 1,
    cadence: 'monthly',
    startDate: new Date().toISOString().slice(0, 10),
    names: [user.name],
    addOns: [],
  })
  const t = useT()
  const temple = useCurrentTemple()
  const cfg = regimeConfig(temple.taxRegime)
  const [booked, setBooked] = useState<Booked | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [recordError, setRecordError] = useState<string | null>(null)

  // Priced before the early returns below so the payment hooks run on every render.
  const addOnTotal = state.addOns.reduce(
    (s, id) => s + (STANDARD_ADDONS.find((a) => a.id === id)?.price ?? 0),
    0,
  )
  // The base price buys a year at the puja's usual rhythm; asking for it more often
  // costs proportionally more, and the summary re-prices live as the cadence changes.
  const cadencePrice = puja ? priceForCadence(puja, state.cadence) : 0
  const total = cadencePrice + addOnTotal

  const flow = usePaymentChoice(temple, total, {
    userId: user.id,
    email: user.email,
    country: user.country,
  })
  const { choice, provider, charge, fee, blocked } = flow
  const checkout = useCheckout(temple)
  const processing = checkout.phase === 'creating' || checkout.phase === 'confirming'

  // The family saved on the profile fills the sankalpam in automatically. Guarded on
  // the tree id so it runs once per load and never fights a devotee who has just
  // removed someone — a re-run would put them straight back.
  const filled = useRef<string | null>(null)
  useEffect(() => {
    if (!family || filled.current === family.id) return
    filled.current = family.id
    const extra = family.members.map((m) => m.name).filter((n) => n && !state.names.includes(n))
    if (extra.length) {
      dispatch({
        type: 'names',
        names: [...state.names, ...extra].slice(0, MAX_SANKALPAM_NAMES),
      })
    }
    // `state.names` is read, not tracked — this must fire on the family arriving only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family])

  // Default the cadence to yearly as requested.
  useEffect(() => {
    if (puja) dispatch({ type: 'hydrate', patch: { cadence: 'yearly' } })
  }, [puja])

  if (loading) return <LoadingSkeleton variant="card" rows={1} className="sm:grid-cols-1" />
  if (!puja)
    return (
      <EmptyState
        title="That puja is no longer listed"
        detail="It may have been retired from the catalogue."
        action={
          <Link to="/puja" className={buttonVariants({ size: 'sm' })}>
            Back to the catalogue
          </Link>
        }
      />
    )

  const validNames = state.names.map((n) => n.trim()).filter(Boolean)
  const payerCountry = choice.donorCountry === 'XX' ? temple.country : choice.donorCountry
  const declarationCheck = validateDeclaration(temple.taxRegime, choice.declaration)

  const finalize = async (result: GivingPaymentResult) => {
    if (!provider) return
    const settled = result.status === 'succeeded'
    let profile = null
    if (hasDeclaration(choice.declaration)) {
      profile = await saveTaxDeclaration({
        ...choice.declaration,
        userId: declarationOwner(user.id, user.email),
        regime: temple.taxRegime,
        residentStatus: temple.taxRegime === 'in-80g' ? 'resident' : undefined,
      })
    }
    try {
      const b = await createBooking({
        userId: user.id,
        pujaCatalogId: puja.id,
        cadence: state.cadence,
        startDate: new Date(state.startDate).toISOString(),
        sankalpamNames: validNames,
        addOns: state.addOns,
        amount: total,
        payment: {
          method: legacyMethod(provider.key),
          reference: result.providerRef,
          receivedAt: settled ? new Date().toISOString() : undefined,
        },
      })
      const meta = recordBookingPayment({
        booking: b,
        temple,
        provider: provider.key,
        result,
        fee,
        feeCovered: choice.coverFee && fee > 0,
        payerName: user.name,
        payerEmail: user.email,
        payerCountry,
        reference: choice.donorReference || undefined,
      })
      const receipt = issueReceipt(
        { kind: 'booking', booking: b, description: `${puja.name} sponsorship (${state.cadence})` },
        temple,
        {
          userId: user.id,
          name: user.name,
          email: user.email,
          address: user.address ? `${user.address}, ${user.city ?? ''} ${user.zip ?? ''}`.trim() : undefined,
          profile,
        },
      )
      checkout.reset()
      setBooked({ booking: b, receipt, pending: meta.status !== 'succeeded', providerKey: provider.key })
    } catch (e) {
      setRecordError((e as Error).message)
    }
  }

  const pay = async () => {
    setSubmitted(true)
    setRecordError(null)
    if (blocked || !provider || !declarationCheck.ok) return
    const r = await checkout.start({
      templeId: temple.id,
      amount: charge,
      currency: temple.currency,
      purpose: 'sponsorship',
      reference: `booking-${Date.now().toString(36)}`,
      provider: provider.key,
      payer: { name: user.name, email: user.email, phone: user.phone, country: payerCountry },
      testCard: provider.live() ? undefined : choice.testCard,
      razorpayMethod: choice.razorpayMethod,
      feeCovered: choice.coverFee,
    })
    if (r) await finalize(r)
  }

  if (booked) {
    const { booking: bk, receipt, pending, providerKey } = booked
    return (
      <MockSuccessScreen
        title={
          pending
            ? t('giving.booking.recorded', 'Your sponsorship is recorded')
            : t('giving.booking.confirmed', 'Your sponsorship is confirmed')
        }
        subtitle={`${puja.name} will be offered ${CADENCE_LABEL[state.cadence].toLowerCase()} in your family's name.`}
        referenceLabel="Booking"
        reference={bk.id}
        rows={[
          { label: 'Puja', value: puja.name },
          { label: 'Deity', value: puja.deity },
          { label: 'How often', value: CADENCE_LABEL[state.cadence] },
          { label: 'First occurrence', value: fmtDate(state.startDate) },
          { label: 'Names read aloud', value: validNames.join(', ') },
          {
            label: 'Add-ons',
            value: state.addOns.length
              ? state.addOns.map((a) => STANDARD_ADDONS.find((x) => x.id === a)?.label).join(', ')
              : 'None',
          },
          { label: t('giving.booking.amountPaid', 'Amount paid'), value: money(charge) },
          { label: t('giving.success.method', 'Method'), value: providerLabel(providerKey) },
          {
            label: t('giving.success.status', 'Status'),
            value: pending
              ? t('giving.success.pending', 'Pending: awaiting your payment')
              : t('giving.success.received', 'Received'),
          },
        ]}
        extra={
          <div className="space-y-5">
            {pending && providerKey !== 'upi' ? (
              <InstructionsPanel providerKey={providerKey} temple={temple} reference={bk.id} />
            ) : null}
            {receipt ? (
              <>
                <TaxReceiptPreview receipt={receipt} />
                <div className="flex justify-center">
                  <DownloadPdfButton
                    receipt={receipt}
                    label={t('giving.pdf.downloadReceipt', 'Download receipt (PDF)')}
                  />
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
        emailSubject={`Your ${puja.name} sponsorship is confirmed`}
        emailBody={
          <>
            <p>Om Namah Shivaya {user.name},</p>
            <p className="mt-2">
              Your sponsorship of <strong>{puja.name}</strong> at the {puja.deity} sannidhi is
              recorded under booking <strong>{bk.id}</strong>. The sankalpam will be offered
              for {validNames.join(', ')} — {user.nakshatra} nakshatra, {user.gothra} gothra.
            </p>
            <p className="mt-2">
              The first occurrence is on {fmtDate(state.startDate, 'EEEE, MMMM d, yyyy')}, and will
              repeat {CADENCE_LABEL[state.cadence].toLowerCase()} for one year.
            </p>
            <p className="mt-2 text-muted">
              {temple.name} · {temple.city}, {temple.state}
            </p>
          </>
        }
        actions={
          <>
            <Link to="/dashboard" className={buttonVariants({ variant: 'ghost' })}>
              Back to dashboard
            </Link>
            <Link to="/my/pujas" className={buttonVariants({})}>
              View my pujas
            </Link>
          </>
        }
      />
    )
  }

  return (
    <>
      <PageHeader
        title={`Sponsor ${puja.name}`}
        subtitle={`Step ${state.step} of 4 · ${STEPS[state.step - 1]}`}
        actions={
          <Button variant="plain" size="sm" onClick={() => navigate('/puja')}>
            <ArrowLeft />
            Catalogue
          </Button>
        }
      />

      <Stepper step={state.step} onJump={(s) => dispatch({ type: 'step', step: s })} />

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        <div>
          {state.step === 1 ? <StepConfirm puja={puja} /> : null}
          {state.step === 2 ? (
            <StepCadence
              puja={puja}
              cadence={state.cadence}
              startDate={state.startDate}
              onCadence={(c) => dispatch({ type: 'cadence', cadence: c })}
              onStartDate={(v) => dispatch({ type: 'startDate', value: v })}
            />
          ) : null}
          {state.step === 3 ? (
            <StepSankalpam
              names={state.names}
              addOns={state.addOns}
              family={family?.members ?? []}
              onNames={(n) => dispatch({ type: 'names', names: n })}
              onToggleAddOn={(id) => dispatch({ type: 'toggleAddOn', id })}
            />
          ) : null}
          {state.step === 4 ? (
            <StepReview temple={temple} flow={flow} net={total} submitted={submitted} />
          ) : null}

          <div className="mt-5 flex items-center justify-between gap-3">
            <Button
              variant="outline"
              onClick={() => dispatch({ type: 'back' })}
              disabled={state.step === 1 || processing}
            >
              <ArrowLeft />
              Back
            </Button>

            {state.step < 4 ? (
              <Button
                onClick={() => dispatch({ type: 'next' })}
                disabled={state.step === 3 && validNames.length === 0}
              >
                Continue
                <ArrowRight />
              </Button>
            ) : (
              <Button size="lg" onClick={pay} disabled={processing || blocked || !provider}>
                {processing ? <Loader2 className="animate-spin" /> : <Flame />}
                {processing ? 'Processing…' : `Sponsor · ${money(charge)}`}
              </Button>
            )}
          </div>
          {state.step === 4 &&
          (recordError || (checkout.phase === 'failed' && !checkout.result && checkout.error)) ? (
            <p role="alert" className="mt-2 text-right text-[12.5px] text-brand-700">
              {recordError ?? checkout.error}
            </p>
          ) : null}
        </div>

        <OrderSummary
          puja={puja}
          cadence={state.cadence}
          startDate={state.startDate}
          names={validNames}
          addOns={state.addOns}
          cadencePrice={cadencePrice}
          total={charge}
          fee={fee}
        />
      </div>

      <PaymentActionDialog
        result={
          checkout.phase === 'action' ||
          checkout.phase === 'confirming' ||
          (checkout.phase === 'failed' && checkout.result)
            ? checkout.result
            : null
        }
        busy={checkout.phase === 'confirming'}
        error={checkout.phase === 'failed' ? checkout.error : null}
        amount={charge}
        currency={temple.currency}
        prefill={{ name: user.name, email: user.email, contact: user.phone }}
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

/* --------------------------------------------------------------- subviews */

function Stepper({ step, onJump }: { step: number; onJump: (s: 1 | 2 | 3 | 4) => void }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
      {STEPS.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3 | 4
        const done = n < step
        const current = n === step
        return (
          <li key={label} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => (done ? onJump(n) : undefined)}
              disabled={!done}
              className={cn(
                'flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors',
                current && 'border-brand-500 bg-brand-500 text-white',
                done && 'border-leaf-500/40 bg-leaf-500/10 text-leaf-600 hover:bg-leaf-500/20',
                !current && !done && 'border-line bg-card text-muted',
              )}
            >
              <span
                className={cn(
                  'grid size-5 place-items-center rounded-full text-[11px]',
                  current ? 'bg-white/25' : done ? 'bg-leaf-500/20' : 'bg-tint',
                )}
              >
                {done ? <Check className="size-3" /> : n}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </button>
            {i < STEPS.length - 1 ? (
              <span className="hidden h-px w-5 bg-line sm:block" aria-hidden="true" />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

function StepConfirm({ puja }: { puja: PujaCatalogItem }) {
  return (
    <Card className="overflow-hidden">
      <DeityArt deity={puja.deity} className="h-40 w-full" />
      <div className="space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-serif text-[24px] leading-tight">{puja.name}</h2>
          <Badge variant="gold">{titleCase(puja.type)}</Badge>
        </div>
        <p className="text-[14px] leading-relaxed text-muted">{puja.description}</p>
        <dl className="grid gap-3 border-t border-line pt-4 sm:grid-cols-3">
          {[
            { k: 'Sponsorship', v: money(puja.basePrice) },
            { k: 'Duration', v: `${puja.durationMin} minutes` },
            { k: 'Usual rhythm', v: puja.recurringRule ?? CADENCE_LABEL[puja.defaultCadence] },
          ].map(({ k, v }) => (
            <div key={k}>
              <dt className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                {k}
              </dt>
              <dd className="mt-1 text-[14.5px] font-medium text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Card>
  )
}

function StepCadence({
  puja,
  cadence,
  startDate,
  onCadence,
  onStartDate,
}: {
  puja: PujaCatalogItem
  cadence: Cadence
  startDate: string
  onCadence: (c: Cadence) => void
  onStartDate: (v: string) => void
}) {
  const preview = nextOccurrences(new Date(`${startDate}T09:00:00`), cadence, 5)

  return (
    <Card className="space-y-5 p-5">
      <div>
        <h2 className="font-serif text-[20px]">How often should it be offered?</h2>
        <p className="mt-1 text-[13px] text-muted">
          The temple recommends {CADENCE_LABEL['yearly'].toLowerCase()} for {puja.name}. Sponsorship
          covers one year from your start date.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {CADENCES.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={cadence === c}
            onClick={() => onCadence(c)}
            className={cn(
              'rounded-full border px-4 py-2 text-[13.5px] font-medium transition-colors active:scale-[.97]',
              cadence === c
                ? 'border-brand-500 bg-brand-500 text-white'
                : 'border-line bg-card text-ink hover:border-brand-300',
            )}
          >
            {CADENCE_LABEL[c]}
            {c === 'yearly' ? (
              <span
                className={cn('ml-1.5 text-[11px]', cadence === c ? 'text-white/75' : 'text-muted')}
              >
                recommended
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="rounded-[10px] border border-line bg-tint/50 p-4">
        <p className="flex items-center gap-2 text-[13px] font-medium text-ink">
          <Repeat className="size-4 text-brand-500" />
          {puja.recurringRule ?? CADENCE_LABEL[cadence]} · {occurrencesPerYear[cadence]} occurrence
          {occurrencesPerYear[cadence] === 1 ? '' : 's'} in the year
        </p>
        <p className="mt-1 flex items-center gap-2 text-[12.5px] text-muted">
          <Clock className="size-3.5" />
          Roughly {puja.durationMin} minutes each, at the {puja.deity} sannidhi
        </p>
        <p className="mt-2 border-t border-line pt-2 text-[13px] text-ink">
          <span className="font-medium">{money(priceForCadence(puja, cadence))}</span>
          <span className="text-muted"> for the year at this frequency</span>
          {cadence !== puja.defaultCadence ? (
            <span className="text-muted">
              {' '}
              · {money(puja.basePrice)} at the usual{' '}
              {CADENCE_LABEL[puja.defaultCadence].toLowerCase()} schedule
            </span>
          ) : null}
        </p>
      </div>

      <Field label="Start date" htmlFor="bk-start" className="max-w-[220px]">
        <Input
          id="bk-start"
          type="date"
          value={startDate}
          onChange={(e) => onStartDate(e.target.value)}
        />
      </Field>

      <div>
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
          Next five occurrences
        </p>
        <ol className="grid gap-2 sm:grid-cols-5">
          {preview.map((d, i) => (
            <li
              key={i}
              className="rounded-[10px] border border-line bg-card px-3 py-2.5 text-center"
            >
              <span className="block text-[10.5px] font-semibold uppercase tracking-[0.08em] text-brand-500">
                {fmtDate(d, 'MMM')}
              </span>
              <span className="block text-[19px] leading-tight tabular-nums">
                {fmtDate(d, 'd')}
              </span>
              <span className="block text-[11.5px] text-muted">{fmtDate(d, 'EEE')}</span>
            </li>
          ))}
        </ol>
      </div>
    </Card>
  )
}

function StepSankalpam({
  names,
  addOns,
  family,
  onNames,
  onToggleAddOn,
}: {
  names: string[]
  addOns: string[]
  family: FamilyMember[]
  onNames: (n: string[]) => void
  onToggleAddOn: (id: string) => void
}) {
  const user = useAuthStore((s) => s.user)!

  return (
    <Card className="space-y-5 p-5">
      <div>
        <h2 className="font-serif text-[20px]">Whose names should be read?</h2>
        <p className="mt-1 text-[13px] text-muted">
          The priest reads the sankalpam with your nakshatra ({user.nakshatra ?? 'not set'}) and
          gothra ({user.gothra ?? 'not set'}), followed by each name below.
        </p>
      </div>

      <SankalpamFieldRepeater
        names={names}
        onChange={onNames}
        ownerName={user.name}
        ownerDetail={[user.nakshatra, user.gothra].filter(Boolean).join(' · ') || undefined}
        family={family}
      />

      <div className="border-t border-line pt-4">
        <p className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
          Add-ons
        </p>
        <div className="space-y-2">
          {STANDARD_ADDONS.map((a) => (
            <label
              key={a.id}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-[10px] border p-3 transition-colors',
                addOns.includes(a.id)
                  ? 'border-brand-500 bg-brand-500/[0.06]'
                  : 'border-line bg-card hover:border-brand-300',
              )}
            >
              <Checkbox checked={addOns.includes(a.id)} onChange={() => onToggleAddOn(a.id)} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium text-ink">{a.label}</span>
                <span className="block text-[12px] text-muted">{a.blurb}</span>
              </span>
              <span className="shrink-0 text-[13.5px] font-medium">
                {a.price === 0 ? 'Free' : `+${money(a.price)}`}
              </span>
            </label>
          ))}
        </div>
      </div>
    </Card>
  )
}

function StepReview({
  temple,
  flow,
  net,
  submitted,
}: {
  temple: Temple
  flow: ReturnType<typeof usePaymentChoice>
  net: number
  submitted: boolean
}) {
  const t = useT()
  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="font-serif text-[20px]">
          {t('giving.booking.howPay', 'How would you like to pay?')}
        </h2>
        <p className="mt-1 text-[13px] text-muted">
          {t('giving.booking.checkSummary', 'Check the summary, then complete your sponsorship.')}
        </p>
      </div>
      <PaymentStep temple={temple} flow={flow} net={net} showErrors={submitted} />
    </Card>
  )
}

function OrderSummary({
  puja,
  cadence,
  startDate,
  names,
  addOns,
  cadencePrice,
  total,
  fee,
}: {
  puja: PujaCatalogItem
  cadence: Cadence
  startDate: string
  names: string[]
  addOns: string[]
  cadencePrice: number
  total: number
  fee: number
}) {
  return (
    <Card className="sticky top-6 p-5">
      <h3 className="font-serif text-[18px]">Order summary</h3>

      <dl className="mt-3 space-y-2.5 text-[13.5px]">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted">{puja.name}</dt>
          <dd className="font-medium tabular-nums">{money(cadencePrice)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted">How often</dt>
          <dd className="font-medium">{CADENCE_LABEL[cadence]}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted">Starts</dt>
          <dd className="font-medium">{fmtDate(startDate)}</dd>
        </div>

        {addOns.map((id) => {
          const a = STANDARD_ADDONS.find((x) => x.id === id)!
          return (
            <div key={id} className="flex items-baseline justify-between gap-3">
              <dt className="text-muted">{a.label}</dt>
              <dd className="font-medium tabular-nums">
                {a.price === 0 ? 'Free' : money(a.price)}
              </dd>
            </div>
          )
        })}
        {fee > 0 ? (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted">Processing fee</dt>
            <dd className="font-medium tabular-nums">{money(fee)}</dd>
          </div>
        ) : null}
      </dl>

      {names.length > 0 ? (
        <div className="mt-4 border-t border-line pt-3">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">
            Names read aloud
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink">{names.join(' · ')}</p>
        </div>
      ) : null}

      <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-line pt-3">
        <span className="text-[13.5px] font-medium">Total</span>
        <span className="text-[24px] tabular-nums">{money(total)}</span>
      </div>

      <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
        {regimeConfig(useCurrentTemple().taxRegime).wording[0]}
      </p>
    </Card>
  )
}
