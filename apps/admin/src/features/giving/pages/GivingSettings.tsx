import { useEffect, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import {
  configurableProviders,
  getGivingSettingsSync,
  regimeConfig,
  saveGivingSettings,
  useCurrentTemple,
  useT,
} from '@saibaba/core'
import type { GivingSettings as Settings, PaymentProviderKey } from '@saibaba/core'
import { PageShell } from '@/components/layout/PageShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox, Field, Input, Textarea } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'

const VPA_RE = /^[\w.-]{2,}@[a-zA-Z][a-zA-Z0-9]{1,}$/

/**
 * Per-temple giving configuration: which payment providers are offered, the instruction
 * text for manual methods, the UPI address, regime wording and the receipt number prefix.
 * Saved settings are read straight away by the donor-facing payment layer.
 */
export default function GivingSettings() {
  const t = useT()
  const temple = useCurrentTemple()
  const { toast } = useToast()
  const cfg = regimeConfig(temple.taxRegime)
  const available = configurableProviders(temple)

  const [s, setS] = useState<Settings>(() => getGivingSettingsSync(temple.id))
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<'upiVpa' | 'receiptPrefix' | 'providers', string>>>({})

  // Re-load when the staff member switches temple.
  useEffect(() => {
    setS(getGivingSettingsSync(temple.id))
    setErrors({})
  }, [temple.id])

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((cur) => ({ ...cur, [k]: v }))
  const enabled = (k: PaymentProviderKey) => s.enabledProviders.includes(k)
  const toggle = (k: PaymentProviderKey) =>
    set('enabledProviders', enabled(k) ? s.enabledProviders.filter((x) => x !== k) : [...s.enabledProviders, k])

  const save = async () => {
    const e: typeof errors = {}
    if (s.upiVpa.trim() && !VPA_RE.test(s.upiVpa.trim())) e.upiVpa = 'A UPI address looks like name@bank.'
    if (enabled('upi') && !s.upiVpa.trim()) e.upiVpa = 'Add a UPI address, or UPI will not be offered.'
    if (!/^[A-Za-z0-9]{2,8}$/.test(s.receiptPrefix.trim())) e.receiptPrefix = 'Use 2 to 8 letters or digits.'
    if (s.enabledProviders.length === 0) e.providers = 'Enable at least one payment method.'
    setErrors(e)
    // A missing VPA is a warning (UPI is hidden), not a blocker.
    const blocking = Object.entries(e).filter(([k]) => k !== 'upiVpa' || s.upiVpa.trim())
    if (blocking.length) return
    setSaving(true)
    await saveGivingSettings({ ...s, receiptPrefix: s.receiptPrefix.trim(), upiVpa: s.upiVpa.trim() }, temple.id)
    setSaving(false)
    toast(t('giving.settings.saved', 'Giving settings saved'), {
      detail: t('giving.settings.savedDetail', 'Donors see the change immediately.'),
    })
  }

  const year = new Date().getFullYear()
  const wordingKey = (
    { 'uk-giftaid': 'giftAidEnabled', 'in-80g': 'eightyGEnabled', 'ca-cra': 'craWordingEnabled' } as const
  )[temple.taxRegime as 'uk-giftaid' | 'in-80g' | 'ca-cra']

  return (
    <PageShell
      eyebrow="Giving"
      title={t('giving.settings.title', 'Giving settings')}
      description={`${temple.name} · ${temple.currency} · ${cfg.label}`}
      actions={
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />}
          Save settings
        </Button>
      }
    >
      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <Card className="space-y-4 p-5">
          <div>
            <h2 className="font-serif text-lg text-ink">Payment methods</h2>
            <p className="text-sm text-muted">
              Only methods valid for {temple.currency} are listed. Donors see them in the order that suits{' '}
              {temple.country}.
            </p>
          </div>
          <ul className="divide-y divide-line">
            {available.map((p) => (
              <li key={p.key}>
                <label className="flex cursor-pointer items-start gap-3 py-3">
                  <Checkbox className="mt-0.5" checked={enabled(p.key)} onChange={() => toggle(p.key)} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-medium text-ink">{p.label}</span>
                    <span className="block text-sm text-muted">{p.detail}</span>
                  </span>
                  {p.kind === 'manual' ? (
                    <Badge variant="neutral">Manual</Badge>
                  ) : p.live() ? (
                    <Badge variant="leaf">Live</Badge>
                  ) : (
                    <Badge variant="neutral">Active</Badge>
                  )}
                </label>
              </li>
            ))}
          </ul>
          {errors.providers ? (
            <p role="alert" className="text-sm font-medium text-brand-600">
              {errors.providers}
            </p>
          ) : null}
          <p className="text-xs text-muted">
            Card, Razorpay and UPI activate when the payment keys are configured.
          </p>
        </Card>

        <div className="space-y-5">
          {available.some((p) => p.key === 'upi') ? (
            <Card className="space-y-3 p-5">
              <h2 className="font-serif text-lg text-ink">UPI</h2>
              <Field label="UPI address (VPA)" htmlFor="gs-vpa" error={errors.upiVpa}>
                <Input
                  id="gs-vpa"
                  value={s.upiVpa}
                  onChange={(e) => set('upiVpa', e.target.value)}
                  placeholder="temple@bank"
                  className="font-mono"
                  aria-invalid={Boolean(errors.upiVpa)}
                />
              </Field>
              <Field label="Payee name shown in the UPI app" htmlFor="gs-payee">
                <Input id="gs-payee" value={s.upiPayeeName} onChange={(e) => set('upiPayeeName', e.target.value)} />
              </Field>
            </Card>
          ) : null}

          <Card className="space-y-3 p-5">
            <h2 className="font-serif text-lg text-ink">Instructions for manual payments</h2>
            <p className="text-sm text-muted">Shown to donors after they choose the method, with their reference.</p>
            {available.some((p) => p.key === 'zelle') ? (
              <Field label="Zelle email or phone" htmlFor="gs-zelle">
                <Input id="gs-zelle" value={s.zelleEmail} onChange={(e) => set('zelleEmail', e.target.value)} />
              </Field>
            ) : null}
            {available.some((p) => p.key === 'ach') ? (
              <Field label="ACH instructions" htmlFor="gs-ach">
                <Textarea id="gs-ach" rows={3} value={s.achInstructions} onChange={(e) => set('achInstructions', e.target.value)} />
              </Field>
            ) : null}
            {available.some((p) => p.key === 'bank-transfer') ? (
              <Field label="Bank transfer instructions" htmlFor="gs-bank" hint="account details, sort code / IFSC / transit no.">
                <Textarea id="gs-bank" rows={3} value={s.bankTransferInstructions} onChange={(e) => set('bankTransferInstructions', e.target.value)} />
              </Field>
            ) : null}
            <Field label="Cheque payable to" htmlFor="gs-payable">
              <Input id="gs-payable" value={s.chequePayableTo} onChange={(e) => set('chequePayableTo', e.target.value)} />
            </Field>
            <Field label="Cheque instructions" htmlFor="gs-cheque">
              <Textarea id="gs-cheque" rows={2} value={s.chequeInstructions} onChange={(e) => set('chequeInstructions', e.target.value)} />
            </Field>
            <Field label="Cash instructions" htmlFor="gs-cash">
              <Textarea id="gs-cash" rows={2} value={s.cashInstructions} onChange={(e) => set('cashInstructions', e.target.value)} />
            </Field>
          </Card>

          <Card className="space-y-3 p-5">
            <h2 className="font-serif text-lg text-ink">Receipts</h2>
            {wordingKey ? (
              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox
                  className="mt-0.5"
                  checked={s[wordingKey]}
                  onChange={(e) => set(wordingKey, e.target.checked)}
                />
                <span className="text-sm">
                  <span className="block font-medium text-ink">
                    {temple.taxRegime === 'uk-giftaid'
                      ? 'Offer Gift Aid declarations'
                      : temple.taxRegime === 'in-80g'
                        ? 'Use 80G receipt wording'
                        : 'Use CRA official receipt wording'}
                  </span>
                  <span className="block text-muted">{cfg.declarationIntro}</span>
                </span>
              </label>
            ) : (
              <p className="text-sm text-muted">
                US receipts carry the 501(c)(3) and “no goods or services” wording; there is nothing to toggle.
              </p>
            )}
            <Field
              label="Receipt number prefix"
              htmlFor="gs-prefix"
              error={errors.receiptPrefix}
              hint={`e.g. ${s.receiptPrefix || 'SAI'}-${temple.slug}-${year}-000123`}
            >
              <Input
                id="gs-prefix"
                value={s.receiptPrefix}
                onChange={(e) => set('receiptPrefix', e.target.value.toUpperCase())}
                maxLength={8}
                className="max-w-[160px] font-mono"
                aria-invalid={Boolean(errors.receiptPrefix)}
              />
            </Field>
            <label className="flex cursor-pointer items-start gap-3">
              <Checkbox
                className="mt-0.5"
                checked={s.offerFeeCover}
                onChange={(e) => set('offerFeeCover', e.target.checked)}
              />
              <span className="text-sm">
                <span className="block font-medium text-ink">Offer “cover the processing fee”</span>
                <span className="block text-muted">Shown to donors paying by card, Razorpay or other fee-bearing methods.</span>
              </span>
            </label>
          </Card>
        </div>
      </div>
    </PageShell>
  )
}
