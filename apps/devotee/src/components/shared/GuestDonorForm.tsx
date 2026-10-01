import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, HeartHandshake, Loader2, LogIn, ShieldCheck } from 'lucide-react'
import { useT } from '@saibaba/core'
import type { DonorContact } from '@/lib/data/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/input'
import { findDonorByContact, getGivingSummaryForContact } from '@/lib/data/api'
import { normPhone } from '@/lib/donor'
import { useDebounced } from '@/lib/hooks'
import { fmtDate } from '@/lib/utils'

/**
 * The gate a visitor passes through instead of being redirected to sign-in.
 *
 * Four fields, no password, no account: enough to issue a valid 501(c)(3) receipt and
 * enough to recognise the same person on a later visit. Everything about it is tuned to
 * get out of the way — it is not the thing they came to do, and the moment it is
 * satisfied the donation form appears beneath it on the same URL.
 */

type Form = { firstName: string; lastName: string; email: string; phone: string }
type Errors = Partial<Record<keyof Form, string>>

const EMPTY: Form = { firstName: '', lastName: '', email: '', phone: '' }

// Deliberately permissive. This is a donation form, not an identity check — a rejected
// address the devotee knows is theirs costs the temple the gift.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function validate(form: Form, t: ReturnType<typeof useT>): Errors {
  const e: Errors = {}
  if (!form.firstName.trim()) e.firstName = t('giving.guest.firstNameErr', 'Please enter your first name.')
  if (!form.lastName.trim()) e.lastName = t('giving.guest.lastNameErr', 'Please enter your last name.')

  if (!form.email.trim()) e.email = t('giving.guest.emailErr', 'Please enter your email: your receipt goes here.')
  else if (!EMAIL_RE.test(form.email.trim())) e.email = t('giving.guest.emailBad', 'That does not look like an email address.')

  if (!form.phone.trim()) e.phone = t('giving.guest.phoneErr', 'Please enter a mobile number.')
  else if (normPhone(form.phone).length < 10) e.phone = t('giving.guest.phoneBad', 'Please enter all ten digits.')

  return e
}

export function GuestDonorForm({ onReady }: { onReady: (contact: DonorContact) => void }) {
  const t = useT()
  const [form, setForm] = useState<Form>(EMPTY)
  const [errors, setErrors] = useState<Errors>({})
  const [busy, setBusy] = useState(false)

  const set = (k: keyof Form) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    // Clear this field's complaint as soon as they act on it; re-checked on submit.
    setErrors((x) => (x[k] ? { ...x, [k]: undefined } : x))
  }

  /* ----------------------------------------------------------- recognition */

  // Looked up while they type rather than after they submit, so "we already know you"
  // arrives in time to change what they do next.
  const email = useDebounced(form.email.trim(), 500)
  const phone = useDebounced(form.phone.trim(), 500)
  const [known, setKnown] = useState<{
    name: string | null
    count: number
    total: number
    lastGiftAt: string | null
  } | null>(null)

  useEffect(() => {
    const usable = EMAIL_RE.test(email) || normPhone(phone).length >= 10
    if (!usable) {
      setKnown(null)
      return
    }
    let live = true
    void (async () => {
      const [account, summary] = await Promise.all([
        findDonorByContact({ email, phone }),
        getGivingSummaryForContact({ firstName: '', lastName: '', email, phone }),
      ])
      if (!live) return
      setKnown(
        account || summary.count > 0
          ? { name: account?.name ?? null, ...summary }
          : null,
      )
    })()
    return () => {
      live = false
    }
  }, [email, phone])

  /* ---------------------------------------------------------------- submit */

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const found = validate(form, t)
    setErrors(found)
    if (Object.values(found).some(Boolean)) return

    setBusy(true)
    await new Promise((r) => setTimeout(r, 400))
    onReady({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
    })
    setBusy(false)
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-5 text-center">
        <span className="mb-3 inline-grid size-14 place-items-center rounded-full bg-saffron-400/15 text-brand-600 ring-8 ring-saffron-400/[0.07]">
          <HeartHandshake className="size-7" />
        </span>
        <h1 className="font-serif text-[26px] leading-tight text-ink">
          {t('giving.guest.title', 'Who should we thank for this gift?')}
        </h1>
        <p className="mx-auto mt-1.5 max-w-md text-[13.5px] leading-relaxed text-muted">
          {t(
            'giving.guest.intro',
            'No account and no password needed: just four details, so your tax receipt reaches you and your name is read in the sankalpam.',
          )}
        </p>
      </div>

      <Card className="p-5">
        <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
          <Field label={t('giving.guest.firstName', 'First name')} htmlFor="gd-first" error={errors.firstName}>
            <Input
              id="gd-first"
              autoComplete="given-name"
              value={form.firstName}
              onChange={set('firstName')}
              placeholder="Santhosh"
            />
          </Field>
          <Field label={t('giving.guest.lastName', 'Last name')} htmlFor="gd-last" error={errors.lastName}>
            <Input
              id="gd-last"
              autoComplete="family-name"
              value={form.lastName}
              onChange={set('lastName')}
              placeholder="Kumar"
            />
          </Field>
          <Field
            label={t('giving.guest.email', 'Email')}
            hint={t('giving.guest.emailHint', 'receipt goes here')}
            htmlFor="gd-email"
            error={errors.email}
            className="sm:col-span-2"
          >
            <Input
              id="gd-email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={set('email')}
              placeholder="you@gmail.com"
            />
          </Field>
          <Field
            label={t('giving.guest.mobile', 'Mobile')}
            hint={t('giving.guest.mobileHint', 'so we can find your gift later')}
            htmlFor="gd-phone"
            error={errors.phone}
            className="sm:col-span-2"
          >
            <Input
              id="gd-phone"
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={set('phone')}
              placeholder="(281) 555-0148"
            />
          </Field>

          {/* Recognition. A returning donor is told what the temple already has for them
              *before* they give again — and if they have a real account, offered it,
              because a receipt on their own record is worth more than a guest one. */}
          {known ? (
            <div className="rounded-[10px] border border-leaf-500/25 bg-leaf-500/6 p-3.5 sm:col-span-2">
              <p className="text-[13.5px] font-medium text-ink">
                {known.name
                  ? t('giving.guest.welcomeName', 'Welcome back, {name}.', { name: known.name.split(' ')[0]! })
                  : t('giving.guest.welcome', 'Welcome back.')}
              </p>
              {known.count > 0 ? (
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
                  {t(
                    known.count === 1 ? 'giving.guest.onRecordOne' : 'giving.guest.onRecordMany',
                    known.count === 1
                      ? 'We have 1 gift on record for these details'
                      : 'We have {n} gifts on record for these details',
                    { n: known.count },
                  )}
                  {known.lastGiftAt
                    ? t('giving.guest.lastGift', ', most recently {date}', { date: fmtDate(known.lastGiftAt) })
                    : null}
                  .
                </p>
              ) : null}
              {known.name ? (
                <Link
                  to="/signin"
                  className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-600 hover:underline"
                >
                  <LogIn className="size-3.5" />
                  {t('giving.guest.signIn', 'Sign in instead to keep everything on one record')}
                </Link>
              ) : null}
            </div>
          ) : null}

          <Button type="submit" size="lg" className="sm:col-span-2" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <ArrowRight />}
            {busy ? t('giving.guest.busy', 'One moment…') : t('giving.guest.continue', 'Continue to donation')}
          </Button>
        </form>

        <p className="mt-4 flex items-start gap-2 border-t border-line pt-4 text-[11.5px] leading-relaxed text-muted">
          <ShieldCheck className="mt-px size-4 shrink-0 text-leaf-500" />
          <span>
            Used only for your receipt and to show you your own giving history. The temple never
            sells or shares devotee contact details.
          </span>
        </p>
      </Card>

      <p className="mt-4 text-center text-[13px] text-muted">
        Already a registered devotee?{' '}
        <Link to="/signin" className="font-medium text-brand-500 hover:underline">
          Sign in →
        </Link>
      </p>
    </div>
  )
}
