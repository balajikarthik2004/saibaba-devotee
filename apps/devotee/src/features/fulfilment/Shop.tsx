import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Package, ShoppingBag } from 'lucide-react'
import {
  cartCount,
  listShopItems,
  useCartStore,
} from '@saibaba/core/features/fulfilment'
import { TEMPLES } from '@saibaba/core/mock'
import { formatMoney } from '@saibaba/core/money'
import { useT } from '@saibaba/core/i18n'
import { useCurrentTemple, useTempleStore } from '@saibaba/core/tenant'
import type { CountryCode } from '@saibaba/core/types.sai'
import { PageHeader } from '@/components/layout/layouts'
import { EmptyState, LoadingSkeleton } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Field, Select } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { useAsync } from '@/lib/hooks'
import { Container, countryName, useShipTo } from './shared'

export default function Shop() {
  const t = useT()
  const { toast } = useToast()
  const temple = useCurrentTemple()
  const setTempleId = useTempleStore((s) => s.setTempleId)
  const chosen = useShipTo((s) => s.country)
  const setCountry = useShipTo((s) => s.setCountry)
  const country: CountryCode = chosen && temple.shipsTo.includes(chosen) ? chosen : (temple.shipsTo[0] ?? temple.country)

  const { data, loading } = useAsync(() => listShopItems(temple.id), [temple.id])
  const lines = useCartStore((s) => s.carts[temple.id]) ?? []
  const add = useCartStore((s) => s.add)
  const count = useMemo(() => cartCount(lines), [lines])

  return (
    <Container>
      <PageHeader
        title={t('shop.title', 'Temple shop')}
        subtitle={t('shop.subtitle', 'Udi, prasad and Baba’s books, sent from {temple}.', { temple: temple.name })}
        actions={
          <Link to="/shop/cart" className={buttonVariants({ variant: 'outline' })}>
            <ShoppingBag aria-hidden />
            {t('shop.cart', 'Cart')} {count > 0 ? `(${count})` : ''}
          </Link>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <Field label={t('shop.temple', 'Temple')} htmlFor="shop-temple">
          <Select id="shop-temple" value={temple.id} onChange={(e) => setTempleId(e.target.value)}>
            {TEMPLES.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </Select>
        </Field>
        {temple.shipsTo.length > 0 ? (
          <Field label={t('shop.shipto', 'Ship to')} htmlFor="shop-country">
            <Select id="shop-country" value={country} onChange={(e) => setCountry(e.target.value as CountryCode)}>
              {temple.shipsTo.map((c) => (
                <option key={c} value={c}>
                  {countryName(c)}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
      </div>

      {temple.shipsTo.length === 0 ? (
        <p className="mb-4 rounded-md border border-line bg-tint px-3 py-2 text-[13px] text-muted" role="note">
          {t('shop.noship', 'This temple does not ship parcels.')}
        </p>
      ) : (
        <p className="mb-4 text-[12.5px] text-muted">
          {t(
            'shop.customs',
            'Cross-border parcels may be inspected, delayed or held by customs. Rules change, and the temple cannot guarantee clearance.',
          )}
        </p>
      )}

      {loading ? (
        <LoadingSkeleton variant="card" rows={6} />
      ) : !data || data.length === 0 ? (
        <EmptyState title={t('shop.empty', 'Nothing in the shop yet')} Icon={Package} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((item) => {
            const ships = item.shipsTo.includes(country) && temple.shipsTo.includes(country)
            const out = item.stock !== null && item.stock <= 0
            return (
              <li
                key={item.id}
                className="flex flex-col gap-2 rounded-[10px] border border-line bg-card p-4 shadow-[var(--shadow-sm)]"
              >
                <div className="grid aspect-[16/9] place-items-center rounded-md bg-tint text-brand-400" aria-hidden>
                  <Package className="size-8" />
                </div>
                <h3 className="font-serif text-[18px] leading-snug text-ink">{item.name}</h3>
                <p className="text-[13.5px] leading-relaxed text-muted">{item.description}</p>
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[16px] font-semibold text-ink">{formatMoney(item.price, item.currency)}</span>
                  <Badge variant={ships ? 'leaf' : 'brand'}>
                    {ships
                      ? t('shop.ships', 'Ships to {country}', { country: countryName(country) })
                      : t('shop.noships', 'Not shipped to {country}', { country: countryName(country) })}
                  </Badge>
                  {item.stock !== null && item.stock > 0 && item.stock <= 5 ? (
                    <Badge variant="gold">{t('shop.low', 'Only {n} left', { n: item.stock })}</Badge>
                  ) : null}
                </div>
                <Button
                  disabled={!ships || out}
                  onClick={() => {
                    const ok = add(temple.id, item, 1)
                    if (ok) toast(t('shop.added', 'Added to cart'), { detail: item.name })
                    else toast(t('shop.currency', 'One currency per cart'), { tone: 'warn' })
                  }}
                >
                  {out ? t('shop.soldout', 'Sold out') : t('shop.add', 'Add to cart')}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </Container>
  )
}
