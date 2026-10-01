import type { UseFormReturn } from 'react-hook-form'
import { LANGUAGES, useT } from '@saibaba/core'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/input'
import {
  COUNTRIES,
  CURRENCY_OPTIONS,
  PAYMENT_OPTIONS,
  TAX_REGIME_OPTIONS,
  TIMEZONES,
} from '@/components/shared/templeOptions'
import { SPACE_PRESETS, type TempleForm } from './schema'

type F = UseFormReturn<TempleForm>

const err = (f: F, k: keyof TempleForm) => {
  const e = f.formState.errors[k] as { message?: string } | undefined
  return e?.message
}

/** Toggle one value in an array field. */
function CheckGroup({
  form,
  name,
  options,
  disabledValues,
}: {
  form: F
  name: 'languages' | 'payments' | 'shipsTo' | 'spaces'
  options: { value: string; label: string; hint?: string }[]
  disabledValues?: string[]
}) {
  const value = form.watch(name) as string[]
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((o) => {
        const checked = value.includes(o.value)
        return (
          <label
            key={o.value}
            className="flex cursor-pointer items-start gap-2 rounded-[var(--radius)] border border-line bg-card p-2.5 text-sm"
          >
            <Checkbox
              className="mt-0.5"
              checked={checked}
              disabled={disabledValues?.includes(o.value)}
              onChange={() =>
                form.setValue(
                  name,
                  (checked ? value.filter((v) => v !== o.value) : [...value, o.value]) as never,
                  { shouldValidate: true, shouldDirty: true },
                )
              }
            />
            <span>
              <span className="block font-medium text-ink">{o.label}</span>
              {o.hint ? <span className="block text-xs text-muted">{o.hint}</span> : null}
            </span>
          </label>
        )
      })}
    </div>
  )
}

export function IdentityFields({ form }: { form: F }) {
  const t = useT()
  const r = form.register
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        label={t('temples.f.name', 'Temple name')}
        htmlFor="t-name"
        error={err(form, 'name')}
        className="sm:col-span-2"
      >
        <Input id="t-name" {...r('name')} aria-invalid={!!err(form, 'name')} />
      </Field>
      <Field
        label={t('temples.f.slug', 'Web address')}
        htmlFor="t-slug"
        hint="optional, made from the name"
        error={err(form, 'slug')}
      >
        <Input id="t-slug" {...r('slug')} placeholder="sai-mandir-city" />
      </Field>
      <Field label={t('temples.f.email', 'Office email')} htmlFor="t-email" error={err(form, 'email')}>
        <Input id="t-email" type="email" {...r('email')} aria-invalid={!!err(form, 'email')} />
      </Field>
      <Field label={t('temples.f.phone', 'Phone')} htmlFor="t-phone" error={err(form, 'phone')}>
        <Input id="t-phone" {...r('phone')} aria-invalid={!!err(form, 'phone')} />
      </Field>
      <Field label={t('temples.f.morning', 'Morning hours')} htmlFor="t-am" error={err(form, 'morning')}>
        <Input id="t-am" {...r('morning')} />
      </Field>
      <Field label={t('temples.f.evening', 'Evening hours')} htmlFor="t-pm" error={err(form, 'evening')}>
        <Input id="t-pm" {...r('evening')} />
      </Field>
      <Field
        label={t('temples.f.about', 'About the temple')}
        htmlFor="t-about"
        error={err(form, 'about')}
        className="sm:col-span-2"
      >
        <Textarea id="t-about" rows={3} {...r('about')} aria-invalid={!!err(form, 'about')} />
      </Field>
    </div>
  )
}

export function LocationFields({ form }: { form: F }) {
  const t = useT()
  const r = form.register
  const tz = form.watch('timezone')
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        label={t('temples.f.address', 'Street address')}
        htmlFor="t-addr"
        error={err(form, 'address')}
        className="sm:col-span-2"
      >
        <Input id="t-addr" {...r('address')} aria-invalid={!!err(form, 'address')} />
      </Field>
      <Field label={t('temples.f.city', 'City')} htmlFor="t-city" error={err(form, 'city')}>
        <Input id="t-city" {...r('city')} aria-invalid={!!err(form, 'city')} />
      </Field>
      <Field label={t('temples.f.state', 'State / region')} htmlFor="t-state" error={err(form, 'state')}>
        <Input id="t-state" {...r('state')} aria-invalid={!!err(form, 'state')} />
      </Field>
      <Field label={t('temples.f.zip', 'Postcode')} htmlFor="t-zip" error={err(form, 'zip')}>
        <Input id="t-zip" {...r('zip')} aria-invalid={!!err(form, 'zip')} />
      </Field>
      <Field label={t('temples.f.country', 'Country')} htmlFor="t-country">
        <Select id="t-country" {...r('country')}>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('temples.f.tz', 'Timezone')} htmlFor="t-tz" error={err(form, 'timezone')}>
        <Select id="t-tz" {...r('timezone')}>
          {(TIMEZONES.includes(tz) ? TIMEZONES : [tz, ...TIMEZONES]).map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('temples.f.lat', 'Latitude')} htmlFor="t-lat" error={err(form, 'lat')}>
        <Input id="t-lat" inputMode="decimal" {...r('lat')} />
      </Field>
      <Field label={t('temples.f.lng', 'Longitude')} htmlFor="t-lng" error={err(form, 'lng')}>
        <Input id="t-lng" inputMode="decimal" {...r('lng')} />
      </Field>
    </div>
  )
}

export function FinanceFields({ form, lock }: { form: F; lock?: boolean }) {
  const t = useT()
  const r = form.register
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        label={t('temples.f.currency', 'Currency')}
        htmlFor="t-cur"
        hint={lock ? 'locked once live' : 'never converted'}
      >
        <Select id="t-cur" {...r('currency')} disabled={lock}>
          {CURRENCY_OPTIONS.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('temples.f.regime', 'Tax regime')} htmlFor="t-regime" hint={lock ? 'locked once live' : undefined}>
        <Select
          id="t-regime"
          {...r('taxRegime', {
            onChange: (e) => {
              // Picking a regime fills the matching country defaults. Everything stays editable.
              const preset = TAX_REGIME_OPTIONS.find((o) => o.code === e.target.value)
              if (!preset || lock) return
              form.setValue('taxIdLabel', preset.idLabel)
              form.setValue('currency', preset.currency)
              form.setValue('country', preset.country)
              form.setValue('timezone', preset.timezone)
            },
          })}
          disabled={lock}
        >
          {TAX_REGIME_OPTIONS.map((o) => (
            <option key={o.code} value={o.code}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('temples.f.taxLabel', 'Tax id label')} htmlFor="t-tlabel" error={err(form, 'taxIdLabel')}>
        <Input id="t-tlabel" {...r('taxIdLabel')} />
      </Field>
      <Field label={t('temples.f.taxId', 'Tax id value')} htmlFor="t-tid" error={err(form, 'taxId')}>
        <Input id="t-tid" {...r('taxId')} aria-invalid={!!err(form, 'taxId')} />
      </Field>
    </div>
  )
}

export function ReachFields({ form }: { form: F }) {
  const t = useT()
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-ink">{t('temples.f.languages', 'Languages')}</legend>
        <CheckGroup
          form={form}
          name="languages"
          options={LANGUAGES.map((l) => ({ value: l.code, label: `${l.english} (${l.native})` }))}
        />
        {err(form, 'languages') ? (
          <p className="mt-1 text-xs font-medium text-brand-600" role="alert">
            {err(form, 'languages')}
          </p>
        ) : null}
      </fieldset>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-ink">{t('temples.f.payments', 'Payment providers')}</legend>
        <CheckGroup
          form={form}
          name="payments"
          options={PAYMENT_OPTIONS.map((p) => ({ value: p.key, label: p.label }))}
        />
        {err(form, 'payments') ? (
          <p className="mt-1 text-xs font-medium text-brand-600" role="alert">
            {err(form, 'payments')}
          </p>
        ) : null}
      </fieldset>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-ink">
          {t('temples.f.shipsTo', 'Ships prasad and udi to')}
        </legend>
        <CheckGroup
          form={form}
          name="shipsTo"
          options={COUNTRIES.map((c) => ({ value: c.code, label: c.label }))}
        />
      </fieldset>
    </div>
  )
}

export function SpacesFields({ form }: { form: F }) {
  const t = useT()
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-ink">
        {t('temples.f.spaces', 'Places of worship at this temple')}
      </legend>
      <CheckGroup
        form={form}
        name="spaces"
        options={SPACE_PRESETS.map((s) => ({ value: s.key, label: s.name, hint: s.blurb }))}
      />
    </fieldset>
  )
}
