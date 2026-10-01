import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Loader2, UserPlus } from 'lucide-react'
import {
  COUNTRY_CODES,
  LANGUAGES,
  completeSignup,
  getRepositories,
  useCurrentTemple,
  useOtpFlow,
  useT,
  type CountryCode,
  type LanguageCode,
  type Temple,
} from '@saibaba/core'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox, Field, Input, Select } from '@/components/ui/input'
import { Chips } from '@/components/ui/tabs'
import { Logo } from '@/components/shared/Logo'
import { DeityArt } from '@/components/shared/DeityArt'
import { GOTHRAS, NAKSHATRAS } from '@/lib/data/mock'
import { useGuestDonorStore } from '@/lib/store/guest'
import { OtpCodeStep } from '@/features/auth/OtpCodeStep'

const COUNTRIES: { code: CountryCode; label: string; cc: string }[] = [
  { code: 'US', label: 'United States', cc: '+1' },
  { code: 'CA', label: 'Canada', cc: '+1' },
  { code: 'IN', label: 'India', cc: '+91' },
  { code: 'GB', label: 'United Kingdom', cc: '+44' },
]

export default function SignUp() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const t = useT()
  const temple = useCurrentTemple()
  const clearContact = useGuestDonorStore((s) => s.clearContact)
  const [temples, setTemples] = useState<Temple[]>([])
  const [formError, setFormError] = useState<string | null>(null)

  /* A donor arriving from the giving flow has already typed these; do not ask twice. */
  const fromDonation = params.has('email') || params.has('phone')
  const [form, setForm] = useState({
    firstName: params.get('first') ?? '',
    lastName: params.get('last') ?? '',
    country: 'US' as CountryCode,
    city: '',
    language: 'en' as LanguageCode,
    homeTempleId: '',
    nakshatra: '',
    gothra: '',
  })
  const [consent, setConsent] = useState({ privacy: false, email: false, sms: false, whatsapp: false })

  const flowRef = useRef<ReturnType<typeof useOtpFlow> | null>(null)
  const flow = useOtpFlow({
    metadata: { full_name: `${form.firstName} ${form.lastName}`.trim() },
    onVerified: async (session) => {
      const f = flowRef.current!
      const phoneFull = f.phone ? `${f.cc}${f.phone.replace(/\D/g, '').replace(/^0+/, '')}` : ''
      await completeSignup(session.user.id, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: f.email.trim(),
        phone: phoneFull,
        country: form.country,
        city: form.city.trim(),
        language: form.language,
        homeTempleId: form.homeTempleId || undefined,
        nakshatra: form.nakshatra || undefined,
        gothra: form.gothra || undefined,
        consent,
      })
      clearContact() // the guest record it stood in for now exists as an account
      navigate('/dashboard', { replace: true })
    },
  })

  flowRef.current = flow

  // Prefill contact handed over from the giving flow (once).
  useEffect(() => {
    const e = params.get('email')
    const p = params.get('phone')
    if (e) flow.setEmail(e)
    if (p) flow.setPhone(p)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void getRepositories().temples.list().then(setTemples).catch(() => setTemples([]))
  }, [])

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const setCountry = (code: CountryCode) => {
    setForm((f) => ({ ...f, country: code }))
    const cc = COUNTRIES.find((c) => c.code === code)?.cc
    if (cc && COUNTRY_CODES.some((c) => c.code === cc)) flow.setCc(cc)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!form.firstName.trim()) return setFormError(t('auth.needName', 'Please enter your name.'))
    if (!consent.privacy) return setFormError(t('auth.needPrivacy', 'Please confirm you have read the privacy notice.'))
    if (flow.method === 'email' && !flow.email.trim()) return setFormError(t('auth.needEmail', 'Enter your email address.'))
    if (flow.method === 'phone' && !flow.phone.trim()) return setFormError(t('auth.needPhone', 'Enter your mobile number.'))
    await flow.send()
  }

  const isGB = form.country === 'GB'
  const isIN = form.country === 'IN'

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden lg:block">
        <DeityArt deity="Ganesha" className="absolute inset-0 h-full w-full" label="Temple welcome" />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-900/80 via-brand-900/55 to-brand-900/90" />
        <div className="relative flex h-full flex-col justify-between p-10 text-white">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo size={38} />
            <span className="font-serif text-[17px] text-saffron-100">{temple.name}</span>
          </Link>
          <div className="max-w-md space-y-3">
            <h2 className="font-serif text-[36px] leading-[1.12] text-saffron-100">{t('auth.joinTitle', 'Join the temple family.')}</h2>
            <p className="text-[15px] leading-relaxed text-white/80">
              {t('auth.joinBody', 'One account keeps your family’s details ready, so sponsoring a puja takes under a minute every time.')}
            </p>
          </div>
          <p className="text-[12.5px] text-white/60">{temple.city}, {temple.state}</p>
        </div>
      </aside>

      <main className="flex flex-col justify-center px-6 py-10 sm:px-12">
        <div className="mx-auto w-full max-w-md">
          <Link to="/" className="mb-8 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink">
            <ArrowLeft className="size-3.5" />
            {t('auth.backToSite', 'Back to the temple site')}
          </Link>

          <h1 className="font-serif text-[28px] leading-tight">{t('auth.createTitle', 'Create a devotee account')}</h1>

          {flow.step === 'code' ? (
            <div className="mt-6">
              <OtpCodeStep flow={flow} />
            </div>
          ) : (
            <>
              <p className="mt-1 text-[13.5px] text-muted">
                {t('auth.createSub', 'We will confirm your email or number with a one-time code.')}
              </p>
              {flow.isMock ? (
                <p role="note" className="mt-3 rounded-md border border-saffron-300 bg-saffron-50 px-3 py-2 text-[13px] text-brand-800">
                  {t('auth.demoBanner', 'Enter any email or phone number. Verification code:')} <strong>{flow.mockCode}</strong>.
                </p>
              ) : null}
              {fromDonation ? (
                <Card className="mt-5 border-leaf-500/25 bg-leaf-500/[0.06] p-3.5 text-[13px] leading-relaxed text-ink">
                  {t('auth.fromDonation', 'We carried over the details from your donation. Finish here and gifts made with this email or mobile move onto your record.')}
                </Card>
              ) : null}

              <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2" noValidate>
                <Field label={t('auth.firstName', 'First name')} htmlFor="su-first">
                  <Input id="su-first" autoComplete="given-name" required value={form.firstName} onChange={set('firstName')} disabled={flow.busy} />
                </Field>
                <Field label={t('auth.lastName', 'Last name')} htmlFor="su-last">
                  <Input id="su-last" autoComplete="family-name" value={form.lastName} onChange={set('lastName')} disabled={flow.busy} />
                </Field>

                <Field label={t('auth.country', 'Country')} htmlFor="su-country">
                  <Select id="su-country" value={form.country} onChange={(e) => setCountry(e.target.value as CountryCode)} disabled={flow.busy}>
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </Select>
                </Field>
                <Field label={t('auth.city', 'City')} htmlFor="su-city">
                  <Input id="su-city" autoComplete="address-level2" value={form.city} onChange={set('city')} disabled={flow.busy} />
                </Field>

                <Field label={t('auth.email', 'Email')} htmlFor="su-email" className="sm:col-span-2">
                  <Input id="su-email" type="email" autoComplete="email" value={flow.email} onChange={(e) => flow.setEmail(e.target.value)} placeholder="you@gmail.com" disabled={flow.busy} />
                </Field>
                <Field label={t('auth.phoneLabel', 'Mobile number')} htmlFor="su-phone" className="sm:col-span-2">
                  <div className="flex gap-2">
                    <Select value={flow.cc} onChange={(e) => flow.setCc(e.target.value)} aria-label={t('auth.cc', 'Country code')} className="w-[128px] shrink-0" disabled={flow.busy}>
                      {COUNTRY_CODES.map((c) => (
                        <option key={c.code} value={c.code}>{c.label}</option>
                      ))}
                    </Select>
                    <Input id="su-phone" type="tel" inputMode="tel" autoComplete="tel-national" value={flow.phone} onChange={(e) => flow.setPhone(e.target.value)} placeholder="281 555 0148" disabled={flow.busy} />
                  </div>
                </Field>

                <div className="sm:col-span-2">
                  <p className="mb-1.5 text-[13px] font-medium text-ink">{t('auth.verifyWith', 'Send my verification code to')}</p>
                  <Chips
                    value={flow.method}
                    onChange={(k) => flow.setMethod(k as 'email' | 'phone')}
                    items={[
                      { key: 'email', label: t('auth.email', 'Email') },
                      { key: 'phone', label: t('auth.phone', 'Phone') },
                    ]}
                  />
                </div>

                <Field label={t('auth.language', 'Preferred language')} htmlFor="su-lang">
                  <Select id="su-lang" value={form.language} onChange={set('language')} disabled={flow.busy}>
                    {LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>{l.native} ({l.english})</option>
                    ))}
                  </Select>
                </Field>
                <Field label={t('auth.homeTemple', 'Home temple')} hint={t('auth.optional', '(optional)')} htmlFor="su-temple">
                  <Select id="su-temple" value={form.homeTempleId} onChange={set('homeTempleId')} disabled={flow.busy}>
                    <option value="">{t('auth.noHomeTemple', 'Not sure yet')}</option>
                    {temples.map((x) => (
                      <option key={x.id} value={x.id}>{x.name}</option>
                    ))}
                  </Select>
                </Field>

                <fieldset className="grid gap-4 rounded-[10px] border border-line p-3.5 sm:col-span-2 sm:grid-cols-2">
                  <legend className="px-1 text-[13px] font-medium text-ink">
                    {t('auth.sankalpam', 'For a traditional sankalpam')} <span className="font-normal text-muted">{t('auth.optional', '(optional)')}</span>
                  </legend>
                  <Field label={t('auth.nakshatra', 'Nakshatra')} htmlFor="su-nak">
                    <Select id="su-nak" value={form.nakshatra} onChange={set('nakshatra')} disabled={flow.busy}>
                      <option value="">{t('auth.notSure', 'Not sure yet')}</option>
                      {NAKSHATRAS.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t('auth.gothra', 'Gothra')} htmlFor="su-got">
                    <Select id="su-got" value={form.gothra} onChange={set('gothra')} disabled={flow.busy}>
                      <option value="">{t('auth.notSure', 'Not sure yet')}</option>
                      {GOTHRAS.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </Select>
                  </Field>
                </fieldset>

                <fieldset className="space-y-3 sm:col-span-2">
                  <legend className="mb-1 text-[13px] font-medium text-ink">{t('auth.consentTitle', 'Privacy and messages')}</legend>
                  <label className="flex items-start gap-2.5 text-[13px] leading-relaxed text-ink">
                    <Checkbox checked={consent.privacy} onChange={(e) => setConsent((c) => ({ ...c, privacy: e.target.checked }))} className="mt-0.5" required />
                    <span>
                      {isGB
                        ? t('auth.privacyGB', 'I have read the privacy notice and understand how the temple uses my personal data to run my account, under UK GDPR. I can ask to see, correct or delete it at any time.')
                        : isIN
                          ? t('auth.privacyIN', 'I have read the privacy notice and consent to the temple processing my personal data to run my account, as described there (DPDP Act, 2023). I can withdraw consent at any time.')
                          : t('auth.privacy', 'I have read the privacy notice and understand how the temple uses my details to run my account.')}{' '}
                      <span className="text-muted">({t('auth.required', 'required')})</span>
                    </span>
                  </label>
                  <p className="text-[12px] text-muted">
                    {t('auth.consentNote', 'Optional messages are off unless you tick them. Each is a separate choice you can change later in notification settings.')}
                  </p>
                  <label className="flex items-start gap-2.5 text-[13px] leading-relaxed text-ink">
                    <Checkbox checked={consent.email} onChange={(e) => setConsent((c) => ({ ...c, email: e.target.checked }))} className="mt-0.5" />
                    <span>{t('auth.optEmail', 'Email me about aartis, festivals and my receipts.')}</span>
                  </label>
                  <label className="flex items-start gap-2.5 text-[13px] leading-relaxed text-ink">
                    <Checkbox checked={consent.whatsapp} onChange={(e) => setConsent((c) => ({ ...c, whatsapp: e.target.checked }))} className="mt-0.5" />
                    <span>
                      {isGB
                        ? t('auth.optWhatsappGB', 'Yes, I agree to receive WhatsApp messages from the temple. I understand I can opt out at any time by replying STOP or in settings.')
                        : t('auth.optWhatsapp', 'Yes, send me WhatsApp messages from the temple. I can opt out at any time.')}
                    </span>
                  </label>
                  <label className="flex items-start gap-2.5 text-[13px] leading-relaxed text-ink">
                    <Checkbox checked={consent.sms} onChange={(e) => setConsent((c) => ({ ...c, sms: e.target.checked }))} className="mt-0.5" />
                    <span>
                      {isGB
                        ? t('auth.optSmsGB', 'Yes, I agree to receive text messages (SMS) from the temple. I can opt out at any time.')
                        : t('auth.optSms', 'Yes, send me text messages (SMS). Message and data rates may apply; I can opt out at any time.')}
                    </span>
                  </label>
                </fieldset>

                {formError || flow.error ? (
                  <p role="alert" className="text-[13px] text-brand-600 sm:col-span-2">{formError ?? flow.error}</p>
                ) : null}

                <Button type="submit" size="lg" className="sm:col-span-2" disabled={flow.busy}>
                  {flow.busy ? <Loader2 className="animate-spin" /> : <UserPlus />}
                  {flow.busy ? t('auth.sending', 'Sending code…') : t('auth.continue', 'Continue')}
                </Button>
              </form>
            </>
          )}

          <p className="mt-6 text-[13px] text-muted">
            {t('auth.haveAccount', 'Already have an account?')}{' '}
            <Link to="/signin" className="font-medium text-brand-500 hover:underline">
              {t('auth.signIn', 'Sign in')} →
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
