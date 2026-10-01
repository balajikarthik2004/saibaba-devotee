import { useEffect, useState } from 'react'
import { Check, Info, Lock, Save } from 'lucide-react'
import { LANGUAGES, useLanguageStore, useT } from '@saibaba/core'
import type { LanguageCode } from '@saibaba/core'
import type { FamilyMember, User } from '@/lib/data/types'
import { PageHeader } from '@/components/layout/layouts'
import { FamilyTreeEditor } from '@/components/shared/FamilyTreeEditor'
import { AvatarWithCompletion, profileCompletion } from '@/components/shared/ProfileCompletion'
import { LoadingSkeleton } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox, Field, Input, Select } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { GOTHRAS, NAKSHATRAS, TEMPLES } from '@/lib/data/mock'
import { getFamilyTree, saveFamilyTree, updateDevotee } from '@/lib/data/api'
import { LOCAL_KEYS, readLocal, writeLocal } from '@/lib/data/local'
import { useAuthStore } from '@/lib/store/auth'
import { useAsync } from '@/lib/hooks'
import { fmtDate } from '@/lib/utils'

export default function Profile() {
  const t = useT()
  const authUser = useAuthStore((s) => s.user)!
  const setLanguage = useLanguageStore((s) => s.setLanguage)
  const { toast } = useToast()

  const PREFERENCES = [
    {
      key: 'weekly',
      label: t('profile.prefWeekly', 'Weekly festival email'),
      detail: t('profile.prefWeeklyD', 'Every Thursday morning'),
    },
    {
      key: 'reminders',
      label: t('profile.prefReminders', 'Puja reminders'),
      detail: t('profile.prefRemindersD', 'An hour before each occurrence in your name'),
    },
    {
      key: 'receipts',
      label: t('profile.prefReceipts', 'Instant tax receipts'),
      detail: t('profile.prefReceiptsD', 'Emailed the moment a gift is recorded'),
    },
    {
      key: 'annual',
      label: t('profile.prefAnnual', 'Annual report'),
      detail: t('profile.prefAnnualD', 'The temple’s full financial statement each year'),
    },
  ]

  const [form, setForm] = useState<User>(authUser)
  const [members, setMembers] = useState<FamilyMember[]>([])
  const DEFAULT_PREFS = { weekly: true, reminders: true, receipts: true, annual: false }
  // Read once on mount rather than on every render — the value only changes here.
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() =>
    readLocal(LOCAL_KEYS.emailPrefs, DEFAULT_PREFS),
  )
  const [saving, setSaving] = useState(false)

  const { data: tree, loading } = useAsync(() => getFamilyTree(authUser.id), [authUser.id])

  useEffect(() => {
    if (tree) setMembers(tree.members)
  }, [tree])

  // Scored from the form rather than the saved record, so the ring answers "am I done
  // yet" while the devotee is still filling the page in.
  const completion = profileCompletion(form, members)

  const set = (k: keyof User) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    setSaving(true)
    await updateDevotee(authUser.id, form)
    await saveFamilyTree({
      id: tree?.id ?? `fam_${authUser.id}`,
      primaryUserId: authUser.id,
      members,
    })
    writeLocal(LOCAL_KEYS.emailPrefs, prefs)
    // A chosen preferred language also becomes the display language on this device.
    if (form.language && form.language !== authUser.language) setLanguage(form.language)
    setSaving(false)
    toast(t('profile.saved', 'Profile saved'), {
      detail: t('profile.savedDetail', 'Your details are updated across the temple records.'),
    })
  }

  return (
    <>
      <PageHeader
        title={t('profile.title', 'Profile & settings')}
        subtitle={t(
          'profile.subtitle',
          'Keep your contact details and family names current so every sankalpam is read in the right names.',
        )}
        actions={
          <Button onClick={save} disabled={saving}>
            <Save />
            {saving ? t('common.saving', 'Saving…') : t('common.saveChanges', 'Save changes')}
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr] lg:items-start">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.personal', 'Personal')}</CardTitle>
            </CardHeader>
            <div className="grid gap-4 p-5 pt-0 sm:grid-cols-2">
              <Field label={t('profile.fullName', 'Full name')} htmlFor="pf-name" className="sm:col-span-2">
                <Input id="pf-name" value={form.name} onChange={set('name')} />
              </Field>
              <Field label={t('profile.dob', 'Date of birth')} hint={t('common.optional', '(optional)')} htmlFor="pf-dob">
                <Input
                  id="pf-dob"
                  type="date"
                  value={form.dob ? form.dob.slice(0, 10) : ''}
                  onChange={(e) => setForm((f) => ({ ...f, dob: e.target.value }))}
                />
              </Field>
              <Field label={t('profile.language', 'Preferred language')} htmlFor="pf-lang">
                <Select
                  id="pf-lang"
                  value={form.language ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      language: (e.target.value || undefined) as LanguageCode | undefined,
                    }))
                  }
                >
                  <option value="">{t('profile.noPref', 'No preference')}</option>
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.native} ({l.english})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label={t('profile.homeTemple', 'Home temple')}
                hint={t('common.optional', '(optional)')}
                htmlFor="pf-home"
                className="sm:col-span-2"
              >
                <Select
                  id="pf-home"
                  value={form.homeTempleId ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, homeTempleId: e.target.value || undefined }))
                  }
                >
                  <option value="">{t('profile.noHome', 'Not chosen yet')}</option>
                  {TEMPLES.map((tp) => (
                    <option key={tp.id} value={tp.id}>
                      {tp.name} — {tp.city}
                    </option>
                  ))}
                </Select>
              </Field>

              {/* Traditional details are never asked up front. */}
              <details className="rounded-md border border-line bg-tint/40 px-3 py-2.5 sm:col-span-2">
                <summary className="cursor-pointer list-none text-[13.5px] font-medium text-ink marker:hidden">
                  {t('sankalpam.optionalTitle', 'For a traditional sankalpam (optional)')}
                  <span className="mt-0.5 block text-[12.5px] font-normal text-muted">
                    {t(
                      'sankalpam.optionalProfileHint',
                      'Share gothra and nakshatra only if they are part of your tradition. A sankalpam is read in your name and your family’s names without them.',
                    )}
                  </span>
                </summary>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <Field label={t('sankalpam.nakshatra', 'Nakshatra')} htmlFor="pf-nak">
                    <Select id="pf-nak" value={form.nakshatra ?? ''} onChange={set('nakshatra')}>
                      <option value="">{t('sankalpam.notSet', 'Not set')}</option>
                      {NAKSHATRAS.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t('sankalpam.gothra', 'Gothra')} htmlFor="pf-got">
                    <Select id="pf-got" value={form.gothra ?? ''} onChange={set('gothra')}>
                      <option value="">{t('sankalpam.notSet', 'Not set')}</option>
                      {GOTHRAS.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </details>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('profile.contact', 'Contact')}</CardTitle>
            </CardHeader>
            <div className="grid gap-4 p-5 pt-0 sm:grid-cols-2">
              <Field label={t('profile.email', 'Email')} htmlFor="pf-email">
                <Input id="pf-email" type="email" value={form.email} onChange={set('email')} />
              </Field>
              <Field
                label={
                  <span className="flex items-center gap-1.5">
                    {t('profile.phone', 'Phone')}
                    <Lock className="size-3 text-muted" aria-hidden="true" />
                  </span>
                }
                htmlFor="pf-phone"
                hint={t('profile.readOnly', 'read-only')}
              >
                <div className="group relative">
                  <Input id="pf-phone" value={form.phone} readOnly disabled />
                  <span className="pointer-events-none absolute -top-1 right-0 hidden -translate-y-full rounded-md bg-ink px-2 py-1 text-[11.5px] text-white group-hover:block">
                    {t('profile.phoneHint', 'Contact the temple office to change')}
                  </span>
                </div>
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('profile.address', 'Address')}</CardTitle>
            </CardHeader>
            <div className="grid gap-4 p-5 pt-0 sm:grid-cols-2">
              <Field label={t('profile.street', 'Street')} htmlFor="pf-addr" className="sm:col-span-2">
                <Input id="pf-addr" value={form.address ?? ''} onChange={set('address')} />
              </Field>
              <Field label={t('profile.city', 'City')} htmlFor="pf-city">
                <Input id="pf-city" value={form.city ?? ''} onChange={set('city')} />
              </Field>
              <Field label={t('profile.state', 'State / region')} htmlFor="pf-state">
                <Input id="pf-state" value={form.state ?? ''} onChange={set('state')} />
              </Field>
              <Field label={t('profile.zip', 'ZIP / postcode')} htmlFor="pf-zip">
                <Input id="pf-zip" value={form.zip ?? ''} onChange={set('zip')} />
              </Field>
              <Field label={t('profile.country', 'Country')} htmlFor="pf-country">
                <Select
                  id="pf-country"
                  value={form.country}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, country: e.target.value as User['country'] }))
                  }
                >
                  <option value="US">United States</option>
                  <option value="IN">India</option>
                  <option value="GB">United Kingdom</option>
                  <option value="CA">Canada</option>
                  <option value="Other">Other</option>
                </Select>
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('profile.family', 'Family names')}</CardTitle>
            </CardHeader>
            <div className="p-5 pt-0">
              {loading ? (
                <LoadingSkeleton variant="text" rows={3} />
              ) : (
                <FamilyTreeEditor members={members} onChange={setMembers} />
              )}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('profile.emailPrefs', 'Email preferences')}</CardTitle>
            </CardHeader>
            <div className="space-y-2 p-5 pt-0">
              {PREFERENCES.map((p) => (
                <label
                  key={p.key}
                  className="flex cursor-pointer items-start gap-3 rounded-[10px] border border-line p-3 transition-colors hover:border-brand-300"
                >
                  <Checkbox
                    checked={prefs[p.key] ?? false}
                    onChange={(e) => setPrefs((s) => ({ ...s, [p.key]: e.target.checked }))}
                  />
                  <span>
                    <span className="block text-[13.5px] font-medium text-ink">{p.label}</span>
                    <span className="block text-[12.5px] text-muted">{p.detail}</span>
                  </span>
                </label>
              ))}
            </div>
          </Card>
        </div>

        <div className="sticky top-6 space-y-5">
          <Card className="p-5">
            <div className="flex items-center gap-3.5">
              <AvatarWithCompletion
                initials={authUser.avatarInitials}
                pct={completion.pct}
                size={56}
              />
              <div className="min-w-0">
                <p className="font-serif text-[18px] leading-tight text-ink">
                  {t('profile.pctShort', '{pct}% complete', { pct: completion.pct })}
                </p>
                <p className="mt-0.5 text-[12.5px] text-muted">
                  {completion.missing.length === 0
                    ? t('profile.allOnFile', 'Everything the temple needs is on file.')
                    : t('profile.itemsLeft', '{n} left', { n: completion.missing.length })}
                </p>
              </div>
            </div>

            <ul className="mt-4 space-y-1.5 border-t border-line pt-3.5">
              {completion.missing.map((label) => (
                <li key={label} className="flex items-center gap-2 text-[13px] text-ink">
                  <span
                    className="size-3.5 shrink-0 rounded-full border-[1.5px] border-brand-300"
                    aria-hidden="true"
                  />
                  {label}
                </li>
              ))}
              {completion.done.map((label) => (
                <li key={label} className="flex items-center gap-2 text-[13px] text-muted">
                  <Check className="size-3.5 shrink-0 text-leaf-500" aria-hidden="true" />
                  {label}
                </li>
              ))}
            </ul>

            {completion.missing.length > 0 ? (
              <p className="mt-3 border-t border-line pt-3 text-[12px] leading-relaxed text-muted">
                {t('profile.saveToUpdate', 'Save the page to update this.')}
              </p>
            ) : null}
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Info className="size-4 text-brand-500" aria-hidden="true" />
              <h3 className="font-serif text-[18px]">{t('profile.why', 'Why we ask')}</h3>
            </div>
            <ul className="mt-3 space-y-3.5 text-[13px] leading-relaxed text-muted">
              <li>
                <strong className="block text-ink">{t('profile.whyFamily', 'Family names')}</strong>
                {t(
                  'profile.whyFamilyD',
                  'Saved names become one-tap options in the booking flow, so you never retype them.',
                )}
              </li>
              <li>
                <strong className="block text-ink">{t('profile.whyAddress', 'Address')}</strong>
                {t(
                  'profile.whyAddressD',
                  'Used for prasad and udi by post, and for your yearly giving statement.',
                )}
              </li>
              <li>
                <strong className="block text-ink">{t('profile.whyHome', 'Home temple')}</strong>
                {t(
                  'profile.whyHomeD',
                  'The temple we open first for you, and where your gifts are recorded by default.',
                )}
              </li>
              <li>
                <strong className="block text-ink">{t('profile.whyPhone', 'Phone is locked')}</strong>
                {t(
                  'profile.whyPhoneD',
                  'Your number is how the temple recognises your household. The office can change it after verifying you.',
                )}
              </li>
            </ul>
            <div className="mt-4 border-t border-line pt-3 text-[12.5px] text-muted">
              <p>
                {t('profile.since', 'Devotee since')}{' '}
                <span className="font-medium text-ink">
                  {fmtDate(authUser.createdAt, 'MMMM yyyy')}
                </span>
              </p>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
