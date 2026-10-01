import { lazy } from 'react'
import type { FeatureNav, FeatureRoute } from '../registry'

const Shop = lazy(() => import('./Shop'))
const Cart = lazy(() => import('./Cart'))
const OrderConfirmation = lazy(() => import('./Orders').then((m) => ({ default: m.OrderConfirmation })))
const MyOrders = lazy(() => import('./Orders').then((m) => ({ default: m.MyOrders })))
const AnnadanamList = lazy(() => import('./Annadanam').then((m) => ({ default: m.AnnadanamList })))
const AnnadanamDetail = lazy(() => import('./Annadanam').then((m) => ({ default: m.AnnadanamDetail })))

export const routes: FeatureRoute[] = [
  { path: '/shop', Component: Shop, layout: 'public' },
  { path: '/shop/cart', Component: Cart, layout: 'public' },
  { path: '/shop/order/:id', Component: OrderConfirmation, layout: 'donor' },
  { path: '/my/orders', Component: MyOrders, layout: 'app' },
  { path: '/annadanam', Component: AnnadanamList, layout: 'public' },
  { path: '/annadanam/:id', Component: AnnadanamDetail, layout: 'public' },
]

export const nav: FeatureNav[] = [
  { to: '/annadanam', label: 'Annadanam', labelKey: 'anna.nav', placement: 'header', order: 45 },
  { to: '/shop', label: 'Shop', labelKey: 'shop.nav', placement: 'header', order: 50 },
]
