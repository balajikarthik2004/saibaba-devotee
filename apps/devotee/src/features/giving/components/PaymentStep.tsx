import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, ChevronDown, CreditCard, Globe2, HeartHandshake, TriangleAlert } from 'lucide-react'
import {
  MOCK_TEST_CARDS,
  formatMoney,
  manualInstructions,
  regimeConfig,
  useT,
} from '@saibaba/core'
import type { Temple } from '@saibaba/core'
import { PaymentMethodPicker } from '@/components/shared/PaymentMethodPicker'
import { Checkbox, Field, Input, Select } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { DonorCountry, PaymentChoice, usePaymentChoice } from '../usePaymentChoice'
import { TaxFields } from './TaxFields'

type Flow = ReturnType<typeof usePaymentChoice>

const COUNTRY_NAME: Record<string, string> = {
  US: 'United States',
  IN: 'India',
  GB: 'United Kingdom',
  CA: 'Canada',
  XX: 'Another country',
}

/**
 * The shared payment section for donations and puja sponsorships: where you are giving
 * from (FCRA), how you pay, the fee toggle, tax-receipt details and, for US temples,
 * employer matching and donor-advised funds. All state lives in `usePaymentChoice`.
 */
export function PaymentStep({
  temple,
  flow,
  net,
  showMatching = false,
  showErrors = false,
}: {
  temple: Temple
  flow: Flow
  /** The gift before any fee the donor covers. */
  net: number
  showMatching?: boolean
  showErrors?: boolean
}) {
  const t = useT()
  const { choice, patch, providers, provider, offerFeeCover, fee, blocked } = flow
  const cfg = regimeConfig(temple.taxRegime)
  const isIndia = temple.taxRegime === 'in-80g'
  const live = provider?.live() ?? false
  const showMockCard =
    provider?.kind === 'online' && !live && (provider.key === 'stripe' || choice.razorpayMethod === 'card')

  return (
    <div className="space-y-5">
      {/* FCRA: only ever raised for an Indian temple. */}
      {isIndia ? (
        <div>
          <Field
            label={t('giving.fcra.from', 'Where are you giving from?')}
            htmlFor="pay-country"
          >
            <Select
              id="pay-country"
              value={choice.donorCountry}
              onChange={(e) => patch({ donorCountry: e.target.value as DonorCountry })}
              className="max-w-[260px]"
            >
              {Object.entries(COUNTRY_NAME).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          {blocked ? <FcraNotice notice={cfg.fcraNotice ?? ''} /> : null}
        </div>
      ) : null}

      {providers.length === 0 ? (
        <p className="rounded-[10px] border border-line bg-tint/50 p-3 text-[13px] text-muted">
          {t('giving.payment.none', 'This temple has not enabled any payment method yet. Please contact the temple office.')}
        </p>
      ) : (
        <PaymentMethodPicker
          providers={providers}
          providerValue={choice.providerKey ?? undefined}
          onProviderChange={(k) => patch({ providerKey: k })}
        />
      )}

      {/* Mock gateway inputs — only when no real processor is configured. */}
      {provider?.key === 'razorpay' && !live ? (
        <Field label={t('giving.payment.rzMethod', 'Pay using')} htmlFor="pay-rz">
          <Select
            id="pay-rz"
            value={choice.razorpayMethod}
            onChange={(e) => patch({ razorpayMethod: e.target.value as PaymentChoice['razorpayMethod'] })}
            className="max-w-[260px]"
          >
            <option value="upi">UPI</option>
            <option value="card">{t('giving.payment.card', 'Card')}</option>
            <option value="netbanking">{t('giving.payment.netbanking', 'Netbanking')}</option>
          </Select>
        </Field>
      ) : null}

      {showMockCard ? (
        <div className="space-y-2.5 rounded-[10px] border border-line bg-tint/40 p-3.5">
          <Field
            label={t('giving.payment.cardNumber', 'Card number')}
            hint={t('giving.payment.testCard', '4242 ...')}
            htmlFor="pay-card"
          >
            <div className="relative max-w-[300px]">
              <CreditCard className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input
                id="pay-card"
                inputMode="numeric"
                autoComplete="off"
                value={choice.testCard}
                onChange={(e) => patch({ testCard: e.target.value })}
                className="pl-9 font-mono"
              />
            </div>
          </Field>
          <ul className="flex flex-wrap gap-1.5" aria-label={t('giving.payment.testCards', 'Test cards')}>
            {MOCK_TEST_CARDS.map((c) => (
              <li key={c.number}>
                <button
                  type="button"
                  onClick={() => patch({ testCard: c.number })}
                  className="rounded-full border border-line bg-card px-2.5 py-1 text-[11.5px] text-ink-soft hover:border-brand-300"
                  title={c.outcome}
                >
                  <span className="font-mono">{c.number.slice(-9)}</span>
                  <span className="ml-1.5 text-muted">{c.outcome}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {provider?.kind === 'manual' ? <ManualPreview temple={temple} keyName={provider.key} /> : null}
      {provider?.kind === 'upi' ? (
        <p className="text-[12.5px] leading-relaxed text-muted">
          {t('giving.payment.upiNext', 'You will see a QR code and a link for your UPI app on the next step.')}
        </p>
      ) : null}

      {/* Cover the fee */}
      {offerFeeCover ? (
        <label className="flex cursor-pointer items-start gap-3 rounded-[10px] border border-line bg-card p-3.5">
          <Checkbox
            className="mt-0.5"
            checked={choice.coverFee}
            onChange={(e) => patch({ coverFee: e.target.checked })}
          />
          <span className="min-w-0 text-[13px] leading-relaxed">
            <span className="block font-medium text-ink">
              {t('giving.fee.cover', 'Cover the processing fee')}
            </span>
            <span className="block text-[12px] text-muted">
              {choice.coverFee && fee > 0
                ? t('giving.fee.covering', 'Adds about {fee} so the temple receives your full {net}.', {
                    fee: formatMoney(fee, temple.currency),
                    net: formatMoney(net, temple.currency),
                  })
                : t('giving.fee.explain', 'Card processors keep a small fee. Add it to your gift so the temple receives the full amount.')}
            </span>
          </span>
        </label>
      ) : null}

      {/* Tax receipt details */}
      <div className="space-y-2 border-t border-line pt-4">
        <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
          {cfg.label} {t('giving.tax.heading', 'receipt details')}
        </h3>
        <TaxFields
          temple={temple}
          value={choice.declaration}
          onChange={(declaration) => patch({ declaration })}
          amount={net}
          showErrors={showErrors}
        />
      </div>

      {/* Employer matching and DAF (US only). */}
      {showMatching && temple.country === 'US' ? (
        <MatchingAndDaf temple={temple} employer={choice.employer} onEmployer={(employer) => patch({ employer })} />
      ) : null}
    </div>
  )
}

export function FcraNotice({ notice }: { notice: string }) {
  const t = useT()
  return (
    <div
      role="alert"
      className="mt-3 rounded-[10px] border border-brand-500/30 bg-brand-500/[0.07] p-4 text-[13px] leading-relaxed text-ink"
    >
      <p className="flex items-center gap-2 font-medium text-brand-700">
        <TriangleAlert className="size-4 shrink-0" />
        {t('giving.fcra.title', 'We cannot take this gift here')}
      </p>
      <p className="mt-1.5">{notice}</p>
      <p className="mt-1.5 text-muted">
        {t(
          'giving.fcra.suggest',
          'You are welcome to give to one of our temples in the United States, United Kingdom or Canada instead; they can issue a receipt in your country.',
        )}
      </p>
      <Link
        to="/temples"
        className="mt-2 inline-flex items-center gap-1.5 font-medium text-brand-600 hover:underline"
      >
        <Globe2 className="size-4" />
        {t('giving.fcra.choose', 'Choose another temple')}
      </Link>
    </div>
  )
}

function ManualPreview({ temple, keyName }: { temple: Temple; keyName: Parameters<typeof manualInstructions>[0] }) {
  const ins = manualInstructions(keyName, temple)
  return (
    <div className="rounded-[10px] border border-saffron-400/50 bg-saffron-500/[0.07] p-3.5 text-[13px] leading-relaxed text-ink">
      <p className="flex items-center gap-2 font-medium">
        <Building2 className="size-4 text-saffron-600" />
        {ins.title}
      </p>
      <ul className="mt-1.5 space-y-1 text-[12.5px] text-muted">
        {ins.payableTo ? <li>Payable to: {ins.payableTo}</li> : null}
        {ins.postal ? <li>{ins.postal.join(', ')}</li> : null}
        {ins.lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  )
}

/** Employer matching field + the donor-advised fund info panel. */
function MatchingAndDaf({
  temple,
  employer,
  onEmployer,
}: {
  temple: Temple
  employer: string
  onEmployer: (v: string) => void
}) {
  const t = useT()
  const [dafOpen, setDafOpen] = useState(false)
  return (
    <div className="space-y-3 border-t border-line pt-4">
      <Field
        label={t('giving.match.employer', 'Employer matching')}
        hint={t('giving.match.optional', 'optional')}
        htmlFor="pay-employer"
      >
        <Input
          id="pay-employer"
          value={employer}
          onChange={(e) => onEmployer(e.target.value)}
          placeholder={t('giving.match.placeholder', 'Your employer, if it matches gifts')}
        />
      </Field>
      <p className="text-[12px] leading-relaxed text-muted">
        <HeartHandshake className="mr-1 inline size-3.5" />
        {t(
          'giving.match.explain',
          'Many employers match charitable gifts. Name yours and the temple will submit the match request after your gift.',
        )}{' '}
        <Link to="/matching" className="font-medium text-brand-600 hover:underline">
          {t('giving.match.learn', 'How matching works')}
        </Link>
      </p>

      <div className="rounded-[10px] border border-line bg-card">
        <button
          type="button"
          aria-expanded={dafOpen}
          onClick={() => setDafOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-3 p-3.5 text-left text-[13.5px] font-medium text-ink"
        >
          {t('giving.daf.title', 'Give via a donor-advised fund')}
          <ChevronDown className={cn('size-4 text-muted transition-transform', dafOpen && 'rotate-180')} />
        </button>
        {dafOpen ? <DafInfo temple={temple} className="border-t border-line p-3.5" /> : null}
      </div>
    </div>
  )
}

/** Grant instructions for a donor-advised fund. US temples only. */
export function DafInfo({ temple, className }: { temple: Temple; className?: string }) {
  const t = useT()
  return (
    <div className={cn('space-y-2 text-[13px] leading-relaxed text-ink', className)}>
      <p>
        {t(
          'giving.daf.body',
          'Recommend a grant from your fund (Fidelity Charitable, Schwab Charitable, Vanguard Charitable and others) to the temple using these details.',
        )}
      </p>
      <dl className="grid gap-x-4 gap-y-1 text-[12.5px] sm:grid-cols-[auto_1fr]">
        <dt className="text-muted">{t('giving.daf.legalName', 'Legal name')}</dt>
        <dd className="font-medium">{temple.name}</dd>
        <dt className="text-muted">{temple.taxIdLabel}</dt>
        <dd className="font-mono font-medium">{temple.taxId}</dd>
        <dt className="text-muted">{t('giving.daf.address', 'Address')}</dt>
        <dd>
          {temple.address}, {temple.city}, {temple.state} {temple.zip}
        </dd>
        <dt className="text-muted">{t('giving.daf.purpose', 'Grant purpose')}</dt>
        <dd>{t('giving.daf.purposeText', 'General support (or name a fund in the notes)')}</dd>
      </dl>
      <p className="text-[12px] text-muted">
        {t(
          'giving.daf.note',
          'Tell the temple office about the grant so we can thank you; the fund sponsor issues your tax receipt, not the temple.',
        )}
      </p>
    </div>
  )
}
