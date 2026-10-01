import { useEffect, useRef, useState } from 'react'
import { Loader2, Lock, ShieldCheck, Smartphone } from 'lucide-react'
import { formatMoney, loadStripe, useT } from '@saibaba/core'
import type {
  ConfirmInput,
  CurrencyCode,
  GivingPaymentResult,
  StripeElements,
  StripeJs,
} from '@saibaba/core'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/overlay'
import { Field, Input } from '@/components/ui/input'

/**
 * The second step of a payment, when a provider needs one. Rendered as a dialog so the
 * form behind it (and the donor's choices) stay intact if they back out.
 */
export function PaymentActionDialog({
  result,
  busy,
  error,
  amount,
  currency,
  prefill,
  onComplete,
  onCancel,
}: {
  result: GivingPaymentResult | null
  busy: boolean
  error: string | null
  amount: number
  currency: CurrencyCode
  prefill: { name: string; email: string; contact: string }
  onComplete: (input: ConfirmInput) => void
  onCancel: () => void
}) {
  const t = useT()
  const open = Boolean(result && result.next !== 'manual')
  const total = formatMoney(amount, currency)

  return (
    <Dialog
      open={open}
      onClose={busy ? () => undefined : onCancel}
      title={
        result?.next === 'upi-qr'
          ? t('giving.action.upiTitle', 'Pay with UPI')
          : result?.next === 'mock-3ds'
            ? t('giving.action.threeDsTitle', 'Confirm with your bank')
            : t('giving.action.payTitle', 'Complete your payment')
      }
      description={result?.message}
      className="max-w-md"
    >
      {result?.next === 'mock-3ds' ? (
        <MockChallenge busy={busy} onComplete={onComplete} />
      ) : null}
      {result?.next === 'stripe-element' && result.clientSecret ? (
        <StripePanel
          clientSecret={result.clientSecret}
          busy={busy}
          total={total}
          onComplete={onComplete}
        />
      ) : null}
      {result?.next === 'razorpay-checkout' ? (
        <div className="space-y-3">
          <p className="text-[13.5px] text-muted">
            {t('giving.action.razorpay', 'Razorpay opens a secure window for UPI, cards and netbanking.')}
          </p>
          <Button
            size="lg"
            className="w-full"
            disabled={busy}
            onClick={() => onComplete({ prefill: { name: prefill.name, email: prefill.email, contact: prefill.contact } })}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Lock />}
            {t('giving.action.payAmount', 'Pay {amount}', { amount: total })}
          </Button>
        </div>
      ) : null}
      {result?.next === 'upi-qr' && result.upi ? (
        <UpiPanel upi={result.upi} busy={busy} total={total} onComplete={onComplete} />
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 rounded-[10px] border border-brand-500/30 bg-brand-500/[0.07] p-3 text-[13px] text-brand-700">
          {error}
        </p>
      ) : null}
    </Dialog>
  )
}

function MockChallenge({
  busy,
  onComplete,
}: {
  busy: boolean
  onComplete: (i: ConfirmInput) => void
}) {
  const t = useT()
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-[10px] border border-line bg-tint/50 p-3.5">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-leaf-500" />
        <p className="text-[13px] leading-relaxed text-ink">
          {t(
            'giving.action.threeDsBody',
            '3-D Secure verification challenge. Enter your verification code to continue.',
          )}
        </p>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => onComplete({ mockChallenge: 'abandon' })}
        >
          {t('giving.action.failAuth', 'Fail authentication')}
        </Button>
        <Button disabled={busy} onClick={() => onComplete({ mockChallenge: 'complete' })}>
          {busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
          {t('giving.action.completeAuth', 'Complete authentication')}
        </Button>
      </div>
    </div>
  )
}

function StripePanel({
  clientSecret,
  busy,
  total,
  onComplete,
}: {
  clientSecret: string
  busy: boolean
  total: string
  onComplete: (i: ConfirmInput) => void
}) {
  const t = useT()
  const mountRef = useRef<HTMLDivElement>(null)
  const ctx = useRef<{ stripe: StripeJs; elements: StripeElements } | null>(null)
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let el: { destroy(): void } | null = null
    loadStripe()
      .then((stripe) => {
        if (cancelled || !mountRef.current) return
        const elements = stripe.elements({ clientSecret })
        // The Payment Element shows card plus Apple Pay / Google Pay when available.
        const pe = elements.create('payment', { wallets: { applePay: 'auto', googlePay: 'auto' } })
        pe.mount(mountRef.current)
        el = pe
        ctx.current = { stripe, elements }
        setReady(true)
      })
      .catch((e: Error) => setLoadError(e.message))
    return () => {
      cancelled = true
      el?.destroy()
    }
  }, [clientSecret])

  return (
    <div className="space-y-4">
      <div ref={mountRef} aria-label={t('giving.action.paymentDetails', 'Payment details')} />
      {!ready && !loadError ? (
        <p className="flex items-center gap-2 text-[13px] text-muted">
          <Loader2 className="size-4 animate-spin" />
          {t('giving.action.loading', 'Loading secure payment form')}
        </p>
      ) : null}
      {loadError ? <p role="alert" className="text-[13px] text-brand-700">{loadError}</p> : null}
      <Button
        size="lg"
        className="w-full"
        disabled={!ready || busy}
        onClick={() =>
          ctx.current &&
          onComplete({ stripe: { instance: ctx.current.stripe, elements: ctx.current.elements } })
        }
      >
        {busy ? <Loader2 className="animate-spin" /> : <Lock />}
        {t('giving.action.payAmount', 'Pay {amount}', { amount: total })}
      </Button>
    </div>
  )
}

function UpiPanel({
  upi,
  busy,
  total,
  onComplete,
}: {
  upi: NonNullable<GivingPaymentResult['upi']>
  busy: boolean
  total: string
  onComplete: (i: ConfirmInput) => void
}) {
  const t = useT()
  const [utr, setUtr] = useState('')
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-2">
        <img
          src={upi.qr}
          width={200}
          height={200}
          alt={t('giving.action.qrAlt', 'UPI QR code for {vpa}', { vpa: upi.vpa })}
          className="rounded-[10px] border border-line bg-white p-2"
        />
        <p className="font-mono text-[12.5px] text-muted">{upi.vpa}</p>
        <a
          href={upi.link}
          className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-brand-600 hover:underline sm:hidden"
        >
          <Smartphone className="size-4" />
          {t('giving.action.openUpi', 'Open in my UPI app')}
        </a>
      </div>
      <Field
        label={t('giving.action.utr', 'UPI transaction reference (UTR)')}
        hint={t('giving.action.optional', 'optional')}
        htmlFor="upi-utr"
      >
        <Input
          id="upi-utr"
          inputMode="numeric"
          value={utr}
          onChange={(e) => setUtr(e.target.value)}
          placeholder="412345678901"
        />
      </Field>
      <Button
        size="lg"
        className="w-full"
        disabled={busy}
        onClick={() => onComplete({ reference: utr.trim() || undefined })}
      >
        {busy ? <Loader2 className="animate-spin" /> : null}
        {t('giving.action.paidUpi', 'I have paid {amount}', { amount: total })}
      </Button>
      <p className="text-[12px] leading-relaxed text-muted">
        {t(
          'giving.action.upiNote',
          'The temple office matches your payment to the bank statement, then issues your receipt.',
        )}
      </p>
    </div>
  )
}
