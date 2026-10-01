import { useState } from 'react'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { OTP_LENGTH, useT, type useOtpFlow } from '@saibaba/core'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/input'
import { OtpInput } from './OtpInput'

export type OtpFlow = ReturnType<typeof useOtpFlow>

/** The "enter the 6-digit code" step shared by sign-in and sign-up. */
export function OtpCodeStep({ flow }: { flow: OtpFlow }) {
  const t = useT()
  const [code, setCode] = useState('')
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => {
          setCode('')
          flow.back()
        }}
        className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" />
        {t('auth.change', 'Use a different email or number')}
      </button>
      <div>
        <p className="text-[14px] text-ink">
          {t('auth.sentTo', 'We sent a 6-digit code to')} <span className="font-medium">{flow.target}</span>
        </p>
        {flow.isMock ? (
          <p role="note" className="mt-2 rounded-md border border-saffron-300 bg-saffron-50 px-3 py-2 text-[13px] text-brand-800">
            {t('auth.demoHint', 'Verification code:')} <strong>{flow.mockCode}</strong>
          </p>
        ) : null}
      </div>
      <Field label={t('auth.code', 'Verification code')} error={flow.error ?? undefined}>
        <OtpInput
          value={code}
          onChange={setCode}
          onComplete={(c) => void flow.verify(c)}
          disabled={flow.busy}
          invalid={Boolean(flow.error)}
          label={t('auth.code', 'Verification code')}
        />
      </Field>
      <Button size="lg" className="w-full" disabled={flow.busy || code.length !== OTP_LENGTH} onClick={() => void flow.verify(code)}>
        {flow.busy ? <Loader2 className="animate-spin" /> : null}
        {flow.busy ? t('auth.verifying', 'Verifying…') : t('auth.verify', 'Verify and continue')}
      </Button>
      <p className="text-[13px] text-muted" aria-live="polite">
        {flow.resendIn > 0 ? (
          t('auth.resendIn', 'You can request a new code in {s}s', { s: flow.resendIn })
        ) : (
          <button
            type="button"
            disabled={flow.busy}
            onClick={() => {
              setCode('')
              void flow.send()
            }}
            className="font-medium text-brand-500 hover:underline disabled:opacity-50"
          >
            {t('auth.resend', 'Send a new code')}
          </button>
        )}
      </p>
    </div>
  )
}
