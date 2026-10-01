import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { HeartHandshake, Utensils } from 'lucide-react'
import {
  MEAL_PRESETS,
  PROVIDER_LABELS,
  getDrive,
  listDrives,
  listMyPledges,
  paymentOptions,
  pledgeMeals,
  type FulfilmentPledge,
} from '@saibaba/core/features/fulfilment'
import type { AnnadanamDrive, PaymentProviderKey } from '@saibaba/core/types.sai'
import { TEMPLE_BY_ID } from '@saibaba/core/mock'
import { formatMoney } from '@saibaba/core/money'
import { useT } from '@saibaba/core/i18n'
import { useCurrentTemple } from '@saibaba/core/tenant'
import { PageHeader } from '@/components/layout/layouts'
import { EmptyState, LoadingSkeleton } from '@/components/shared/states'
import { Badge, Progress } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Chips } from '@/components/ui/tabs'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { useAsync } from '@/lib/hooks'
import { useAuthStore } from '@/lib/store/auth'
import { fmtDate } from '@/lib/utils'
import { Container, EMAIL_RE, phoneOk } from './shared'

const pctOf = (d: AnnadanamDrive) => (d.mealsTarget ? Math.min(100, (d.mealsFunded / d.mealsTarget) * 100) : 0)

export function DriveProgress({ drive }: { drive: AnnadanamDrive }) {
  const t = useT()
  return (
    <div className="space-y-1">
      <Progress value={pctOf(drive)} tone="leaf" label={t('anna.progress', 'Meals funded for {title}', { title: drive.title })} />
      <p className="text-[12.5px] text-muted">
        {t('anna.funded', '{funded} of {target} meals funded', { funded: drive.mealsFunded, target: drive.mealsTarget })}
      </p>
    </div>
  )
}

/** /annadanam */
export function AnnadanamList() {
  const t = useT()
  const temple = useCurrentTemple()
  const user = useAuthStore((s) => s.user)
  const { data, loading } = useAsync(() => listDrives(temple.id), [temple.id])
  const { data: mine } = useAsync(
    async () => (user ? listMyPledges({ userId: user.id, email: user.email }) : []),
    [user?.id],
  )

  return (
    <Container>
      <PageHeader
        title={t('anna.title', 'Annadanam — offer a meal')}
        subtitle={t('anna.subtitle', 'Baba taught that no one should go hungry at the temple. Feed devotees in His name at {temple}.', { temple: temple.name })}
      />
      {loading ? (
        <LoadingSkeleton variant="card" rows={4} />
      ) : !data || data.length === 0 ? (
        <EmptyState title={t('anna.empty', 'No annadanam drives right now')} Icon={Utensils} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {data.map((d) => (
            <li key={d.id} className="flex flex-col gap-3 rounded-[10px] border border-line bg-card p-4 shadow-[var(--shadow-sm)]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-serif text-[18px] leading-snug">
                    <Link to={`/annadanam/${d.id}`} className="hover:text-brand-600">{d.title}</Link>
                  </h3>
                  <p className="text-[12.5px] text-muted">{fmtDate(d.date, 'EEE, MMM d, yyyy')}</p>
                </div>
                <Badge variant={d.status === 'open' ? 'leaf' : 'neutral'}>
                  {d.status === 'open' ? t('anna.open', 'Open') : d.status === 'served' ? t('anna.served', 'Served') : t('anna.reported', 'Served · report')}
                </Badge>
              </div>
              <DriveProgress drive={d} />
              {d.status === 'open' ? (
                <div>
                  <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.09em] text-muted">
                    {t('anna.feed', 'Feed N people')}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {MEAL_PRESETS.map((n) => (
                      <Link
                        key={n}
                        to={`/annadanam/${d.id}?meals=${n}`}
                        className="rounded-full border border-line px-3 py-1 text-[13px] font-medium text-ink hover:border-brand-400 hover:bg-tint"
                        aria-label={t('anna.feed.aria', 'Feed {n} people for {cost}', { n, cost: formatMoney(n * d.pricePerMeal, d.currency) })}
                      >
                        {n}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <Link to={`/annadanam/${d.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' }) + ' w-fit'}>
                  {d.report ? t('anna.viewreport', 'See the report') : t('anna.details', 'Details')}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}

      {mine && mine.length > 0 ? (
        <section className="mt-8" aria-labelledby="my-pledges">
          <h2 id="my-pledges" className="mb-2 font-serif text-[19px]">{t('anna.mine', 'Your pledges')}</h2>
          <ul className="divide-y divide-line rounded-[10px] border border-line bg-card">
            {mine.map((p: FulfilmentPledge) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2 px-4 py-2.5 text-[14px]">
                <span>
                  {t('anna.pledge.line', '{n} meals', { n: p.meals })}
                  {p.dedicatedTo ? <span className="text-muted"> · {p.dedicatedTo}</span> : null}
                </span>
                <span className="tabular-nums text-muted">{formatMoney(p.amount, p.currency)} · {fmtDate(p.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Container>
  )
}

/** /annadanam/:id */
export function AnnadanamDetail() {
  const t = useT()
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const user = useAuthStore((s) => s.user)
  const { data: drive, loading, refresh } = useAsync(() => getDrive(id), [id])
  const temple = drive ? TEMPLE_BY_ID.get(drive.templeId) : undefined

  const presetFromUrl = Number(params.get('meals'))
  const [meals, setMeals] = useState<number>(MEAL_PRESETS.includes(presetFromUrl) ? presetFromUrl : 11)
  const [custom, setCustom] = useState('')
  const [dedication, setDedication] = useState('')
  const [guest, setGuest] = useState({ name: '', email: '', phone: '' })
  const [provider, setProvider] = useState<PaymentProviderKey | ''>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<FulfilmentPledge | null>(null)

  if (loading) return <Container><LoadingSkeleton variant="card" rows={3} /></Container>
  if (!drive || !temple) {
    return (
      <Container>
        <EmptyState title={t('anna.missing', 'Drive not found')} Icon={Utensils} action={<Link to="/annadanam" className={buttonVariants()}>{t('anna.all', 'All drives')}</Link>} />
      </Container>
    )
  }

  const options = paymentOptions(temple)
  const pay = provider || options[0]!
  const count = custom ? Math.floor(Number(custom)) || 0 : meals
  const cost = count * drive.pricePerMeal
  const open = drive.status === 'open'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!(count >= 1 && count <= 5000)) return setError(t('anna.err.meals', 'Choose between 1 and 5,000 meals.'))
    if (!user) {
      if (!guest.name.trim()) return setError(t('anna.err.name', 'Please enter your name.'))
      if (!EMAIL_RE.test(guest.email)) return setError(t('shop.err.email', 'Enter a valid email'))
      if (!phoneOk(guest.phone)) return setError(t('shop.err.phone', 'Enter a valid phone number'))
    }
    setBusy(true)
    try {
      const pledge = await pledgeMeals({
        driveId: drive.id,
        meals: count,
        userId: user?.id ?? null,
        guest: user ? { name: user.name, email: user.email, phone: user.phone } : guest,
        dedicatedTo: dedication,
        provider: pay,
      })
      setDone(pledge)
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('shop.err.generic', 'Something went wrong.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Container>
      <PageHeader
        title={drive.title}
        subtitle={`${fmtDate(drive.date, 'EEEE, MMM d, yyyy')} · ${temple.name}`}
        backTo="/annadanam"
        backLabel={t('anna.all', 'All drives')}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <section className="space-y-3 rounded-[10px] border border-line bg-card p-4">
            <DriveProgress drive={drive} />
            <p className="text-[14px] leading-relaxed text-ink">{drive.menuNote}</p>
            <p className="text-[12.5px] text-muted">
              {t('anna.price', 'One meal is {price}. Festival dates are confirmed by your temple.', { price: formatMoney(drive.pricePerMeal, drive.currency) })}
            </p>
          </section>

          {drive.report ? (
            <section className="space-y-3 rounded-[10px] border border-line bg-card p-4" aria-labelledby="rep">
              <h2 id="rep" className="font-serif text-[19px]">{t('anna.report', 'Report from the day')}</h2>
              <p className="text-[14px]">
                {t('anna.report.served', '{n} meals served', { n: drive.report.mealsServed })}
                <span className="text-muted"> · {fmtDate(drive.report.postedAt)}</span>
              </p>
              {drive.report.note ? <p className="text-[14px] leading-relaxed text-ink">{drive.report.note}</p> : null}
              {drive.report.photos.length > 0 ? (
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {drive.report.photos.map((src, i) => (
                    <li key={i}>
                      <img src={src} alt={t('anna.photo', 'Annadanam photo {n}', { n: i + 1 })} loading="lazy" className="aspect-[3/2] w-full rounded-md border border-line object-cover" />
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}
        </div>

        <aside>
          {done ? (
            <div role="status" className="space-y-2 rounded-[10px] border border-leaf-500/30 bg-leaf-500/10 p-4">
              <HeartHandshake className="size-6 text-leaf-600" aria-hidden />
              <h2 className="font-serif text-[19px]">{t('anna.thanks', 'Thank you — Om Sai Ram')}</h2>
              <p className="text-[14px]">
                {t('anna.thanks.body', 'Your offering of {n} meals ({cost}) is recorded.', { n: done.meals, cost: formatMoney(done.amount, done.currency) })}
              </p>
              {done.dedicatedTo ? <p className="text-[13.5px] text-muted">{t('anna.dedicated', 'Dedicated to: {who}', { who: done.dedicatedTo })}</p> : null}
              <Button variant="outline" onClick={() => setDone(null)}>{t('anna.again', 'Offer more')}</Button>
            </div>
          ) : !open ? (
            <p className="rounded-[10px] border border-line bg-tint p-4 text-[14px] text-muted">
              {t('anna.closed', 'This drive has been served and is no longer taking pledges.')}
            </p>
          ) : (
            <form onSubmit={submit} noValidate className="space-y-4 rounded-[10px] border border-line bg-card p-4">
              <h2 className="font-serif text-[19px]">{t('anna.offer', 'Offer meals')}</h2>
              <div>
                <p id="meals-label" className="mb-1.5 text-[13px] font-medium">{t('anna.feed', 'Feed N people')}</p>
                <Chips
                  items={MEAL_PRESETS.map((n) => ({ key: String(n), label: String(n) }))}
                  value={custom ? '' : String(meals)}
                  onChange={(k) => {
                    setCustom('')
                    setMeals(Number(k))
                  }}
                />
              </div>
              <Field label={t('anna.custom', 'Or enter a number')} htmlFor="meals-custom">
                <Input id="meals-custom" type="number" min={1} max={5000} inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value)} />
              </Field>
              <p className="rounded-md bg-tint px-3 py-2 text-[15px] font-semibold" aria-live="polite">
                {t('anna.cost', '{n} meals = {cost}', { n: count || 0, cost: formatMoney(cost, drive.currency) })}
              </p>
              <Field label={t('anna.dedicate', 'Dedicate to (optional)')} htmlFor="ded" hint={t('anna.dedicate.hint', 'in memory of, or for someone’s wellbeing')}>
                <Textarea id="ded" rows={2} maxLength={140} value={dedication} onChange={(e) => setDedication(e.target.value)} />
              </Field>
              {!user ? (
                <div className="space-y-3">
                  <Field label={t('shop.name', 'Full name')} htmlFor="g-name">
                    <Input id="g-name" autoComplete="name" value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} />
                  </Field>
                  <Field label={t('shop.email', 'Email')} htmlFor="g-email">
                    <Input id="g-email" type="email" autoComplete="email" value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} />
                  </Field>
                  <Field label={t('shop.phone', 'Phone')} htmlFor="g-phone">
                    <Input id="g-phone" type="tel" autoComplete="tel" value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} />
                  </Field>
                </div>
              ) : null}
              <Field label={t('shop.pay', 'Payment method')} htmlFor="prov">
                <Select id="prov" value={pay} onChange={(e) => setProvider(e.target.value as PaymentProviderKey)}>
                  {options.map((p) => <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>)}
                </Select>
              </Field>
              {error ? <p role="alert" className="text-[13px] text-brand-600">{error}</p> : null}
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? t('anna.submitting', 'Recording…') : t('anna.submit', 'Offer {n} meals · {cost}', { n: count || 0, cost: formatMoney(cost, drive.currency) })}
              </Button>
            </form>
          )}
        </aside>
      </div>
    </Container>
  )
}
