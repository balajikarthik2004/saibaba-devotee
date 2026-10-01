import { Link, useParams } from 'react-router-dom'
import { PackageOpen } from 'lucide-react'
import { getOrder, listMyOrders, type FulfilmentOrder } from '@saibaba/core/features/fulfilment'
import { formatMoney } from '@saibaba/core/money'
import { useT } from '@saibaba/core/i18n'
import { PageHeader } from '@/components/layout/layouts'
import { EmptyState, LoadingSkeleton } from '@/components/shared/states'
import { buttonVariants } from '@/components/ui/button'
import { useAsync } from '@/lib/hooks'
import { useAuthStore } from '@/lib/store/auth'
import { fmtDate } from '@/lib/utils'
import { Container, OrderTimeline, StatusBadge, TrackingLink, countryName } from './shared'

function OrderLines({ order }: { order: FulfilmentOrder }) {
  const t = useT()
  return (
    <dl className="space-y-1.5 text-[14px]">
      {order.items.map((i) => (
        <div key={i.itemId} className="flex justify-between gap-3">
          <dt className="text-ink">
            {i.name} <span className="text-muted">× {i.qty}</span>
          </dt>
          <dd className="tabular-nums">{formatMoney(i.unitPrice * i.qty, order.currency)}</dd>
        </div>
      ))}
      <div className="flex justify-between text-muted">
        <dt>{t('shop.shipping', 'Shipping')}</dt>
        <dd className="tabular-nums">{order.shippingFee ? formatMoney(order.shippingFee, order.currency) : t('shop.free', 'Free')}</dd>
      </div>
      <div className="flex justify-between border-t border-line pt-2 font-semibold">
        <dt>{t('shop.total', 'Total')}</dt>
        <dd className="tabular-nums">{formatMoney(order.total, order.currency)}</dd>
      </div>
    </dl>
  )
}

function AddressBlock({ order }: { order: FulfilmentOrder }) {
  const a = order.address
  return (
    <address className="text-[14px] not-italic leading-relaxed text-ink">
      {a.name}
      <br />
      {a.line1}
      {a.line2 ? <>, {a.line2}</> : null}
      <br />
      {a.city}, {a.region} {a.postcode}
      <br />
      {countryName(a.country)}
    </address>
  )
}

/** /shop/order/:id — confirmation and tracking. */
export function OrderConfirmation() {
  const t = useT()
  const { id = '' } = useParams()
  const { data: order, loading } = useAsync(() => getOrder(id), [id])

  if (loading) return <Container><LoadingSkeleton variant="card" rows={3} /></Container>
  if (!order) {
    return (
      <Container>
        <EmptyState title={t('shop.order.missing', 'Order not found')} Icon={PackageOpen} action={<Link to="/shop" className={buttonVariants()}>{t('shop.cart.browse', 'Browse the shop')}</Link>} />
      </Container>
    )
  }
  const awaiting = order.status === 'placed'
  return (
    <Container>
      <PageHeader
        title={awaiting ? t('shop.order.received', 'Order received') : t('shop.order.thanks', 'Thank you — Om Sai Ram')}
        subtitle={t('shop.order.ref', 'Order {id} · {date}', { id: order.id, date: fmtDate(order.createdAt) })}
        actions={<StatusBadge status={order.status} />}
      />
      {awaiting ? (
        <p role="status" className="mb-4 rounded-md border border-gold-500/35 bg-gold-500/10 px-3 py-2 text-[13.5px]">
          {t('shop.order.await', 'We are waiting for your payment. The temple will mark the order paid once it arrives, then pack it.')}
        </p>
      ) : null}
      {order.status === 'held-customs' && order.holdNote ? (
        <p role="alert" className="mb-4 rounded-md border border-brand-500/30 bg-brand-500/5 px-3 py-2 text-[13.5px]">
          {order.holdNote}
        </p>
      ) : null}
      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-3 rounded-[10px] border border-line bg-card p-4" aria-labelledby="o-sum">
          <h2 id="o-sum" className="font-serif text-[19px]">{t('shop.summary', 'Order summary')}</h2>
          <OrderLines order={order} />
          <h3 className="pt-2 text-[12px] font-semibold uppercase tracking-[0.09em] text-muted">{t('shop.addr', 'Delivery address')}</h3>
          <AddressBlock order={order} />
        </section>
        <section className="space-y-3 rounded-[10px] border border-line bg-card p-4" aria-labelledby="o-track">
          <h2 id="o-track" className="font-serif text-[19px]">{t('shop.tracking', 'Progress')}</h2>
          <TrackingLink order={order} />
          <OrderTimeline order={order} />
        </section>
      </div>
      <p className="mt-6 text-[13px]">
        <Link to="/my/orders" className="font-medium text-brand-600 hover:text-brand-700">{t('shop.myorders', 'My orders')}</Link>
        {' · '}
        <Link to="/shop" className="font-medium text-brand-600 hover:text-brand-700">{t('shop.cart.browse', 'Browse the shop')}</Link>
      </p>
    </Container>
  )
}

/** /my/orders — signed-in devotee's orders with tracking. */
export function MyOrders() {
  const t = useT()
  const user = useAuthStore((s) => s.user)
  const { data, loading } = useAsync(
    () => listMyOrders({ userId: user?.id, email: user?.email, phone: user?.phone }),
    [user?.id],
  )
  return (
    <>
      <PageHeader title={t('shop.myorders', 'My orders')} subtitle={t('shop.myorders.sub', 'Parcels from the temple shop and where they are.')} />
      {loading ? (
        <LoadingSkeleton variant="card" rows={3} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          title={t('shop.myorders.empty', 'No orders yet')}
          Icon={PackageOpen}
          action={<Link to="/shop" className={buttonVariants()}>{t('shop.cart.browse', 'Browse the shop')}</Link>}
        />
      ) : (
        <ul className="space-y-4">
          {data.map((o) => (
            <li key={o.id} className="rounded-[10px] border border-line bg-card p-4 shadow-[var(--shadow-sm)]">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-serif text-[17px]">
                    <Link to={`/shop/order/${o.id}`} className="hover:text-brand-600">{o.id}</Link>
                  </p>
                  <p className="text-[12.5px] text-muted">{fmtDate(o.createdAt)} · {formatMoney(o.total, o.currency)}</p>
                </div>
                <StatusBadge status={o.status} />
              </div>
              <p className="mb-2 text-[13.5px] text-muted">{o.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}</p>
              <TrackingLink order={o} />
              <details className="mt-2">
                <summary className="cursor-pointer text-[13px] font-medium text-brand-600">{t('shop.tracking', 'Progress')}</summary>
                <div className="pt-3"><OrderTimeline order={o} /></div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
