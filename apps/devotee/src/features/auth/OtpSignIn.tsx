import { useState } from 'react'
import { Loader2, Mail, Smartphone } from 'lucide-react'
import { COUNTRY_CODES, oauthAvailable, useOtpFlow, useT, type AuthSession } from '@saibaba/core'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/input'
import { Chips } from '@/components/ui/tabs'
import { OtpCodeStep } from './OtpCodeStep'

/**
 * Email / phone one-time-code sign-in. Works in mock mode (any contact, code 123456, clearly
 * hinted) and against Supabase Auth. Buttons disable while a request is in flight and the resend
 * link is throttled by a 60s timer, which mirrors the server-side limit.
 */
export function OtpSignIn({
  onVerified,
  createUser = true,
  metadata,
}: {
  onVerified: (s: AuthSession) => void | Promise<void>
  createUser?: boolean
  metadata?: Record<string, string | boolean | undefined>
}) {
  const t = useT()
  const flow = useOtpFlow({ onVerified, createUser, metadata })
  const [socialBusy, setSocialBusy] = useState<'google' | 'apple' | null>(null)

  const social = async (p: 'google' | 'apple') => {
    setSocialBusy(p)
    flow.setError(null)
    try {
      await flow.provider.signInWithOAuth(p)
    } catch (e) {
      flow.setError(e instanceof Error ? e.message : 'Could not start sign-in.')
      setSocialBusy(null)
    }
  }

  if (flow.step === 'code') return <OtpCodeStep flow={flow} />

  return (
    <div className="space-y-4">
      {flow.isMock ? (
        <p role="note" className="rounded-md border border-saffron-300 bg-saffron-50 px-3 py-2 text-[13px] text-brand-800">
          {t('auth.demoBanner', 'Enter any email or phone number. Verification code:')} <strong>{flow.mockCode}</strong>.
        </p>
      ) : null}

      {oauthAvailable() ? (
        <div className="grid gap-2">
          <Button variant="outline" size="lg" disabled={socialBusy !== null} onClick={() => void social('google')}>
            {socialBusy === 'google' ? <Loader2 className="animate-spin" /> : null}
            {t('auth.google', 'Continue with Google')}
          </Button>
          <Button variant="outline" size="lg" disabled={socialBusy !== null} onClick={() => void social('apple')}>
            {socialBusy === 'apple' ? <Loader2 className="animate-spin" /> : null}
            {t('auth.apple', 'Continue with Apple')}
          </Button>
          <p className="my-1 text-center text-[12px] text-muted">{t('auth.or', 'or use a one-time code')}</p>
        </div>
      ) : null}

      <Chips
        value={flow.method}
        onChange={(k) => flow.setMethod(k as 'email' | 'phone')}
        items={[
          { key: 'email', label: t('auth.email', 'Email') },
          { key: 'phone', label: t('auth.phone', 'Phone') },
        ]}
      />

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void flow.send()
        }}
        noValidate
      >
        {flow.method === 'email' ? (
          <Field label={t('auth.emailLabel', 'Email address')} htmlFor="si-email" error={flow.error ?? undefined}>
            <Input
              id="si-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={flow.email}
              onChange={(e) => flow.setEmail(e.target.value)}
              placeholder="you@gmail.com"
              aria-invalid={Boolean(flow.error) || undefined}
              disabled={flow.busy}
            />
          </Field>
        ) : (
          <Field label={t('auth.phoneLabel', 'Mobile number')} htmlFor="si-phone" error={flow.error ?? undefined}>
            <div className="flex gap-2">
              <Select
                value={flow.cc}
                onChange={(e) => flow.setCc(e.target.value)}
                aria-label={t('auth.cc', 'Country code')}
                className="w-[128px] shrink-0"
                disabled={flow.busy}
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </Select>
              <Input
                id="si-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                required
                value={flow.phone}
                onChange={(e) => flow.setPhone(e.target.value)}
                placeholder="281 555 0148"
                aria-invalid={Boolean(flow.error) || undefined}
                disabled={flow.busy}
              />
            </div>
          </Field>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={flow.busy}>
          {flow.busy ? <Loader2 className="animate-spin" /> : flow.method === 'email' ? <Mail /> : <Smartphone />}
          {flow.busy ? t('auth.sending', 'Sending code…') : t('auth.sendCode', 'Send me a code')}
        </Button>
      </form>
    </div>
  )
}
