import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Minus, Plus, ShoppingBag, Trash2, TriangleAlert } from 'lucide-react'
import {
  PROVIDER_LABELS,
  paymentOptions,
  placeOrder,
  quoteShipping,
  listShopItems,
  useCartStore,
} from '@saibaba/core/features/fulfilment'
import { formatMoney } from '@saibaba/core/money'
import { useT } from '@saibaba/core/i18n'
import { useCurrentTemple } from '@saibaba/core/tenant'
import type { Address, CountryCode, PaymentProviderKey } from '@saibaba/core/types.sai'
import { PageHeader } from '@/components/layout/layouts'
import { EmptyState } from '@/components/shared/states'
import { Button, buttonVariants } from '@/components/ui/button'
import { Field, Input, Radio, Select } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { useAsync } from '@/lib/hooks'
import { useAuthStore } from '@/lib/store/auth'
import { COUNTRY_RULES, Container, EMAIL_RE, countryName, phoneOk, useShipTo } from './shared'

type Errors = Partial<Record<'name' | 'email' | 'phone' | 'line1' | 'city' | 'region' | 'postcode', string>>

export default function Cart() {
  const t = useT()
  const nav = useNavigate()
  const { toast } = useToast()
  const temple = useCurrentTemple()
  const user = useAuthStore((s) => s.user)
  const lines = useCartStore((s) => s.carts[temple.id]) ?? []
  const { setQty, remove, clear } = useCartStore.getState()
  const setShipTo = useShipTo((s) => s.setCountry)
  const chosen = useShipTo((s) => s.country)

  const { data: catalogue } = useAsync(() => listShopItems(temple.id, { all: true }), [temple.id])
  const byId = useMemo(() => new Map((catalogue ?? []).map((i) => [i.id, i])), [catalogue])

  const initialCountry: CountryCode =
    chosen && temple.shipsTo.includes(chosen) ? chosen : (temple.shipsTo[0] ?? temple.country)
  const [country, setCountry] = useState<CountryCode>(initialCountry)
  const [f, setF] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    line1: '',
    line2: '',
    city: '',
    region: '',
    postcode: '',
  })
  const options = paymentOptions(temple)
  const [provider, setProvider] = useState<PaymentProviderKey>(options[0]!)
  const [errors, setErrors] = useState<Errors>({})
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')

  const rule = COUNTRY_RULES[country]
  const quote = quoteShipping(temple.id, country, lines)
  const subtotal = lines.reduce((a, l) => a + (byId.get(l.itemId)?.price ?? 0) * l.qty, 0)
  const currency = quote.currency
  const total = subtotal + (quote.ok ? quote.fee : 0)

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }))

  const validate = (): Errors => {
    const e: Errors = {}
    const req = t('shop.req', 'Required')
    if (!f.name.trim()) e.name = req
    if (!EMAIL_RE.test(f.email)) e.email = t('shop.err.email', 'Enter a valid email')
    if (!phoneOk(f.phone)) e.phone = t('shop.err.phone', 'Enter a valid phone number')
    if (!f.line1.trim()) e.line1 = req
    if (!f.city.trim()) e.city = req
    if (rule.regionOptions && !f.region) e.region = req
    if (!rule.postcode.test(f.postcode.trim())) e.postcode = t('shop.err.postcode', 'Use the format: {hint}', { hint: rule.postcodeHint })
    return e
  }

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setFormError('')
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length || !quote.ok) return
    const address: Address = {
      name: f.name.trim(),
      line1: f.line1.trim(),
      line2: f.line2.trim() || undefined,
      city: f.city.trim(),
      region: f.region.trim(),
      postcode: rule.normalise(f.postcode),
      country,
      phone: f.phone.trim(),
    }
    setBusy(true)
    try {
      const order = await placeOrder({
        templeId: temple.id,
        items: lines.map((l) => ({ itemId: l.itemId, qty: l.qty })),
        address,
        email: f.email.trim(),
        userId: user?.id ?? null,
        provider,
      })
      clear(temple.id)
      toast(t('shop.placed', 'Order placed'), { detail: order.id })
      nav(`/shop/order/${order.id}`)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('shop.err.generic', 'Something went wrong.'))
    } finally {
      setBusy(false)
    }
  }

  if (lines.length === 0) {
    return (
      <Container>
        <PageHeader title={t('shop.cart.title', 'Your cart')} />
        <EmptyState
          title={t('shop.cart.empty', 'Your cart is empty')}
          Icon={ShoppingBag}
          action={
            <Link to="/shop" className={buttonVariants()}>
              {t('shop.cart.browse', 'Browse the shop')}
            </Link>
          }
        />
      </Container>
    )
  }

  return (
    <Container>
      <PageHeader title={t('shop.cart.title', 'Your cart')} backTo="/shop" backLabel={t('shop.back', 'Back to shop')} />
      <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section aria-labelledby="cart-items" className="rounded-[10px] border border-line bg-card p-4">
            <h2 id="cart-items" className="mb-3 font-serif text-[19px]">
              {t('shop.cart.items', 'Items')}
            </h2>
            <ul className="divide-y divide-line">
              {lines.map((l) => {
                const item = byId.get(l.itemId)
                return (
                  <li key={l.itemId} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14.5px] font-medium text-ink">{item?.name ?? l.itemId}</p>
                      <p className="text-[12.5px] text-muted">{item ? formatMoney(item.price, item.currency) : ''}</p>
                    </div>
                    <div className="flex items-center gap-1" role="group" aria-label={t('shop.qty', 'Quantity')}>
                      <Button type="button" variant="outline" size="icon" aria-label={t('shop.qty.less', 'Fewer')} onClick={() => setQty(temple.id, l.itemId, l.qty - 1)}>
                        <Minus />
                      </Button>
                      <span className="w-8 text-center tabular-nums" aria-live="polite">
                        {l.qty}
                      </span>
                      <Button type="button" variant="outline" size="icon" aria-label={t('shop.qty.more', 'More')} onClick={() => setQty(temple.id, l.itemId, l.qty + 1)}>
                        <Plus />
                      </Button>
                    </div>
                    <span className="w-20 text-right tabular-nums text-[14px]">
                      {item ? formatMoney(item.price * l.qty, item.currency) : ''}
                    </span>
                    <Button type="button" variant="plain" size="icon" aria-label={t('shop.remove', 'Remove')} onClick={() => remove(temple.id, l.itemId)}>
                      <Trash2 />
                    </Button>
                  </li>
                )
              })}
            </ul>
          </section>

          <section aria-labelledby="cart-addr" className="rounded-[10px] border border-line bg-card p-4">
            <h2 id="cart-addr" className="mb-3 font-serif text-[19px]">
              {t('shop.addr', 'Delivery address')}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('shop.country', 'Country')} htmlFor="a-country">
                <Select
                  id="a-country"
                  value={country}
                  onChange={(e) => {
                    const c = e.target.value as CountryCode
                    setCountry(c)
                    setShipTo(c)
                    setF((p) => ({ ...p, region: '', postcode: '' }))
                  }}
                >
                  {temple.shipsTo.map((c) => (
                    <option key={c} value={c}>
                      {countryName(c)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('shop.name', 'Full name')} htmlFor="a-name" error={errors.name}>
                <Input id="a-name" autoComplete="name" value={f.name} onChange={set('name')} aria-invalid={!!errors.name} />
              </Field>
              <Field label={t('shop.email', 'Email (for tracking)')} htmlFor="a-email" error={errors.email}>
                <Input id="a-email" type="email" autoComplete="email" value={f.email} onChange={set('email')} aria-invalid={!!errors.email} />
              </Field>
              <Field label={t('shop.phone', 'Phone')} htmlFor="a-phone" error={errors.phone}>
                <Input id="a-phone" type="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} aria-invalid={!!errors.phone} />
              </Field>
              <Field label={t('shop.line1', 'Address line 1')} htmlFor="a-l1" error={errors.line1} className="sm:col-span-2">
                <Input id="a-l1" autoComplete="address-line1" value={f.line1} onChange={set('line1')} aria-invalid={!!errors.line1} />
              </Field>
              <Field label={t('shop.line2', 'Address line 2 (optional)')} htmlFor="a-l2" className="sm:col-span-2">
                <Input id="a-l2" autoComplete="address-line2" value={f.line2} onChange={set('line2')} />
              </Field>
              <Field label={t('shop.city', 'City')} htmlFor="a-city" error={errors.city}>
                <Input id="a-city" autoComplete="address-level2" value={f.city} onChange={set('city')} aria-invalid={!!errors.city} />
              </Field>
              <Field label={t('shop.region.' + country, rule.regionLabel)} htmlFor="a-region" error={errors.region}>
                {rule.regionOptions ? (
                  <Select id="a-region" value={f.region} onChange={set('region')} aria-invalid={!!errors.region}>
                    <option value="">{t('shop.choose', 'Choose…')}</option>
                    {rule.regionOptions.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.name}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input id="a-region" value={f.region} onChange={set('region')} />
                )}
              </Field>
              <Field label={t('shop.postcode.' + country, rule.postcodeLabel)} hint={rule.postcodeHint} htmlFor="a-post" error={errors.postcode}>
                <Input
                  id="a-post"
                  autoComplete="postal-code"
                  inputMode={country === 'GB' || country === 'CA' ? 'text' : 'numeric'}
                  value={f.postcode}
                  onChange={set('postcode')}
                  aria-invalid={!!errors.postcode}
                />
              </Field>
            </div>
          </section>

          <fieldset className="rounded-[10px] border border-line bg-card p-4">
            <legend className="px-1 font-serif text-[19px]">{t('shop.pay', 'Payment method')}</legend>
            <div className="mt-2 space-y-2">
              {options.map((p) => (
                <label key={p} className="flex cursor-pointer items-center gap-2 text-[14px]">
                  <Radio name="provider" checked={provider === p} onChange={() => setProvider(p)} />
                  {PROVIDER_LABELS[p]}
                </label>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-muted">
              {t('shop.pay.note', 'Card and UPI payments confirm immediately. Zelle, cheque and transfers are marked paid once the temple receives them.')}
            </p>
          </fieldset>
        </div>

        <aside className="h-fit space-y-3 rounded-[10px] border border-line bg-card p-4 lg:sticky lg:top-20" aria-label={t('shop.summary', 'Order summary')}>
          <h2 className="font-serif text-[19px]">{t('shop.summary', 'Order summary')}</h2>
          <dl className="space-y-1.5 text-[14px]">
            <div className="flex justify-between">
              <dt className="text-muted">{t('shop.subtotal', 'Subtotal')}</dt>
              <dd className="tabular-nums">{formatMoney(subtotal, currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">{t('shop.shipping', 'Shipping')}</dt>
              <dd className="tabular-nums">
                {quote.ok ? (quote.fee === 0 ? t('shop.free', 'Free') : formatMoney(quote.fee, currency)) : '—'}
              </dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-[16px] font-semibold">
              <dt>{t('shop.total', 'Total')}</dt>
              <dd className="tabular-nums">{formatMoney(total, currency)}</dd>
            </div>
          </dl>

          {quote.ok ? (
            <p className="text-[12.5px] text-muted">
              {t('shop.eta', 'Estimated delivery {min}–{max} days (estimate only).', { min: quote.days.min, max: quote.days.max })}
            </p>
          ) : (
            <div role="alert" className="flex gap-2 rounded-md border border-brand-500/30 bg-brand-500/5 p-2.5 text-[13px] text-brand-700">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <div>
                <p>{quote.reason}</p>
                {quote.blocked.map((b) => (
                  <p key={b.itemId}>
                    {byId.get(b.itemId)?.name ?? b.name}: {b.reason}
                  </p>
                ))}
              </div>
            </div>
          )}
          {quote.restrictions.length > 0 ? (
            <ul className="list-disc space-y-1 pl-4 text-[12.5px] text-muted" aria-label={t('shop.notes', 'Shipping notes')}>
              {quote.restrictions.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : null}

          {formError ? (
            <p role="alert" className="text-[13px] text-brand-600">
              {formError}
            </p>
          ) : null}
          <Button type="submit" size="lg" className="w-full" disabled={busy || !quote.ok}>
            {busy ? t('shop.placing', 'Placing order…') : t('shop.place', 'Place order · {amount}', { amount: formatMoney(total, currency) })}
          </Button>
        </aside>
      </form>
    </Container>
  )
}
