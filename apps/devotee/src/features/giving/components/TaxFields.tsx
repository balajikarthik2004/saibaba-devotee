import { Info } from 'lucide-react'
import { formatMoney, giftAidUplift, regimeConfig, useT, validateDeclaration } from '@saibaba/core'
import type { DonorTaxProfile, Temple } from '@saibaba/core'
import { Checkbox, Field, Input } from '@/components/ui/input'

/**
 * The regime's declaration fields: Gift Aid for the UK, PAN for India, a postal address
 * for Canada and (optionally) the US. Controlled; the parent owns the value and saves it.
 */
export function TaxFields({
  temple,
  value,
  onChange,
  amount,
  idPrefix = 'tx',
  showErrors = false,
}: {
  temple: Temple
  value: Partial<DonorTaxProfile>
  onChange: (next: Partial<DonorTaxProfile>) => void
  amount?: number
  idPrefix?: string
  showErrors?: boolean
}) {
  const t = useT()
  const cfg = regimeConfig(temple.taxRegime)
  const check = validateDeclaration(temple.taxRegime, value)
  const err = showErrors ? check.errors : {}
  const set = (patch: Partial<DonorTaxProfile>) => onChange({ ...value, ...patch })

  const addressFields = (required: boolean) => (
    <>
      <Field
        label={t('giving.tax.address', 'Postal address')}
        hint={required ? undefined : t('giving.tax.optional', 'optional')}
        htmlFor={`${idPrefix}-addr`}
        error={err.homeAddress}
        className="sm:col-span-2"
      >
        <Input
          id={`${idPrefix}-addr`}
          autoComplete="street-address"
          value={value.homeAddress ?? ''}
          onChange={(e) => set({ homeAddress: e.target.value })}
          aria-invalid={Boolean(err.homeAddress)}
        />
      </Field>
      <Field
        label={t('giving.tax.city', 'Town / city')}
        htmlFor={`${idPrefix}-city`}
      >
        <Input
          id={`${idPrefix}-city`}
          autoComplete="address-level2"
          value={value.city ?? ''}
          onChange={(e) => set({ city: e.target.value })}
        />
      </Field>
      <Field
        label={temple.country === 'CA' ? t('giving.tax.postalCode', 'Postal code') : t('giving.tax.postcode', 'Postcode')}
        htmlFor={`${idPrefix}-post`}
        error={err.postcode}
      >
        <Input
          id={`${idPrefix}-post`}
          autoComplete="postal-code"
          value={value.postcode ?? ''}
          onChange={(e) => set({ postcode: e.target.value.toUpperCase() })}
          aria-invalid={Boolean(err.postcode)}
        />
      </Field>
    </>
  )

  return (
    <div className="space-y-3">
      <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-muted">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        {cfg.declarationIntro}
      </p>

      {temple.taxRegime === 'uk-giftaid' ? (
        <div className="space-y-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-[10px] border border-line bg-card p-3.5">
            <Checkbox
              className="mt-0.5"
              checked={Boolean(value.giftAid)}
              onChange={(e) => set({ giftAid: e.target.checked })}
            />
            <span className="min-w-0 text-[13px] leading-relaxed">
              <span className="block font-medium text-ink">
                {t('giving.tax.giftAidLabel', 'Yes, I am a UK taxpayer and want to Gift Aid my donation')}
              </span>
              <span className="mt-1 block text-[12px] text-muted">{cfg.giftAidText}</span>
              {amount && amount > 0 ? (
                <span className="mt-1.5 block text-[12.5px] font-medium text-leaf-600">
                  {t('giving.tax.giftAidAdds', 'Gift Aid adds 25%: about {amount} extra at no cost to you.', {
                    amount: formatMoney(giftAidUplift(amount), temple.currency, { cents: true }),
                  })}
                </span>
              ) : null}
            </span>
          </label>
          {value.giftAid ? <div className="grid gap-3 sm:grid-cols-2">{addressFields(true)}</div> : null}
        </div>
      ) : null}

      {temple.taxRegime === 'in-80g' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label={t('giving.tax.pan', 'Your PAN')}
            hint={t('giving.tax.panHint', 'needed to claim 80G')}
            htmlFor={`${idPrefix}-pan`}
            error={err.pan}
          >
            <Input
              id={`${idPrefix}-pan`}
              autoCapitalize="characters"
              maxLength={10}
              value={value.pan ?? ''}
              onChange={(e) => set({ pan: e.target.value.toUpperCase() })}
              placeholder="ABCDE1234F"
              className="font-mono uppercase"
              aria-invalid={Boolean(err.pan)}
            />
          </Field>
          {addressFields(false)}
          {!value.pan && check.warnings.length > 0 ? (
            <p className="text-[12px] text-gold-600 sm:col-span-2">{check.warnings[0]}</p>
          ) : null}
        </div>
      ) : null}

      {temple.taxRegime === 'ca-cra' ? (
        <div className="grid gap-3 sm:grid-cols-2">{addressFields(false)}</div>
      ) : null}

      {temple.taxRegime === 'us-501c3' ? (
        <div className="grid gap-3 sm:grid-cols-2">{addressFields(false)}</div>
      ) : null}
    </div>
  )
}

/** Whether the declaration has anything worth saving. */
export const hasDeclaration = (v: Partial<DonorTaxProfile>) =>
  Boolean(v.giftAid || v.pan || v.homeAddress || v.postcode || v.city)
