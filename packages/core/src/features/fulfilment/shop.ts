import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { simulateLatency } from '../../api'
import { readLocal, writeLocal } from '../../local'
import { TEMPLE_BY_ID } from '../../mock/temple'
import { currentTempleId } from '../../tenant'
import type { Address, PaymentRequest, ShipmentStatus, ShopItem } from '../../types.sai'
import type { CurrencyCode } from '../../types.sai'
import { createPayment } from './payments'
import { buildOrders, buildShopItems } from './seed'
import { businessDaysBetween, computeQuote, OVERDUE_BUSINESS_DAYS } from './shipping'
import type {
  CartLine,
  FulfilmentOrder,
  OrderFilters,
  PlaceOrderInput,
  QuoteLine,
  ShippingQuote,
} from './types'

const K_ITEMS = 'saibaba:fulfilment:items'
const K_ORDERS = 'saibaba:fulfilment:orders'

const SEED_ITEMS = buildShopItems()
export const SHOP_ITEMS: ShopItem[] = readLocal<ShopItem[] | null>(K_ITEMS, null) ?? SEED_ITEMS
export const ORDERS: FulfilmentOrder[] =
  readLocal<FulfilmentOrder[] | null>(K_ORDERS, null) ?? buildOrders(SHOP_ITEMS)

const saveItems = () => writeLocal(K_ITEMS, SHOP_ITEMS)
const saveOrders = () => writeLocal(K_ORDERS, ORDERS)

const itemCatalogue = { get: (id: string) => SHOP_ITEMS.find((i) => i.id === id) }

/* ------------------------------------------------------------------ items */

export async function listShopItems(
  templeId: string = currentTempleId(),
  opts: { all?: boolean } = {},
): Promise<ShopItem[]> {
  await simulateLatency()
  return SHOP_ITEMS.filter((i) => i.templeId === templeId && (opts.all || i.active)).map((i) => ({ ...i }))
}

export async function upsertShopItem(
  input: Partial<ShopItem> & Pick<ShopItem, 'name'>,
): Promise<ShopItem> {
  await simulateLatency()
  const templeId = input.templeId ?? currentTempleId()
  const temple = TEMPLE_BY_ID.get(templeId)
  const existing = input.id ? SHOP_ITEMS.find((i) => i.id === input.id) : undefined
  if (existing) {
    Object.assign(existing, input)
    saveItems()
    return { ...existing }
  }
  const item: ShopItem = {
    id: `shp_${templeId.replace('tmp_', '')}_${Date.now().toString(36)}`,
    templeId,
    key: 'other',
    description: '',
    price: 0,
    currency: temple?.currency ?? 'USD',
    weightGrams: 100,
    shipsTo: temple?.shipsTo ?? [],
    active: true,
    stock: null,
    ...input,
  }
  SHOP_ITEMS.push(item)
  saveItems()
  return { ...item }
}

export async function setStock(itemId: string, stock: number | null): Promise<ShopItem> {
  await simulateLatency()
  const item = SHOP_ITEMS.find((i) => i.id === itemId)
  if (!item) throw new Error('Item not found')
  item.stock = stock === null ? null : Math.max(0, Math.floor(stock))
  saveItems()
  return { ...item }
}

/* ---------------------------------------------------------------- shipping */

/** Synchronous so the cart can quote live as the address changes. */
export function quoteShipping(
  templeId: string,
  country: Address['country'],
  items: QuoteLine[],
): ShippingQuote {
  const temple = TEMPLE_BY_ID.get(templeId)
  if (!temple) {
    return {
      ok: false,
      fee: 0,
      currency: 'USD',
      days: { min: 0, max: 0 },
      domestic: true,
      totalGrams: 0,
      restrictions: [],
      blocked: [],
      reason: 'Unknown temple.',
    }
  }
  return computeQuote(temple, country, items, itemCatalogue)
}

/* -------------------------------------------------------------------- cart */

interface CartState {
  carts: Record<string, CartLine[]>
  /** Returns false if the line's currency differs from what is already in this cart. */
  add: (templeId: string, item: ShopItem, qty?: number) => boolean
  setQty: (templeId: string, itemId: string, qty: number) => void
  remove: (templeId: string, itemId: string) => void
  clear: (templeId: string) => void
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      carts: {},
      add: (templeId, item, qty = 1) => {
        const lines = get().carts[templeId] ?? []
        if (lines.some((l) => l.currency !== item.currency)) return false
        const cur = lines.find((l) => l.itemId === item.id)
        const next = cur
          ? lines.map((l) => (l.itemId === item.id ? { ...l, qty: l.qty + qty } : l))
          : [...lines, { itemId: item.id, qty, currency: item.currency }]
        set({ carts: { ...get().carts, [templeId]: next } })
        return true
      },
      setQty: (templeId, itemId, qty) => {
        const lines = get().carts[templeId] ?? []
        const next =
          qty <= 0
            ? lines.filter((l) => l.itemId !== itemId)
            : lines.map((l) => (l.itemId === itemId ? { ...l, qty: Math.min(qty, 99) } : l))
        set({ carts: { ...get().carts, [templeId]: next } })
      },
      remove: (templeId, itemId) =>
        set({
          carts: {
            ...get().carts,
            [templeId]: (get().carts[templeId] ?? []).filter((l) => l.itemId !== itemId),
          },
        }),
      clear: (templeId) => set({ carts: { ...get().carts, [templeId]: [] } }),
    }),
    { name: 'saibaba:fulfilment:cart' },
  ),
)

export const cartCount = (lines: CartLine[]) => lines.reduce((a, l) => a + l.qty, 0)

export function cartSubtotal(lines: CartLine[]): { amount: number; currency: CurrencyCode | null } {
  let amount = 0
  let currency: CurrencyCode | null = null
  for (const l of lines) {
    const item = itemCatalogue.get(l.itemId)
    if (!item) continue
    amount += item.price * l.qty
    currency = item.currency
  }
  return { amount, currency }
}

/* ------------------------------------------------------------------ orders */

const nextOrderId = () => `ord_${String(ORDERS.length + 1).padStart(4, '0')}`

function pushEvent(o: FulfilmentOrder, status: ShipmentStatus, note?: string) {
  o.status = status
  o.events.push({ at: new Date().toISOString(), status, note })
}

export async function placeOrder(input: PlaceOrderInput): Promise<FulfilmentOrder> {
  await simulateLatency()
  const templeId = input.templeId ?? currentTempleId()
  const temple = TEMPLE_BY_ID.get(templeId)
  if (!temple) throw new Error('Unknown temple')
  const quote = quoteShipping(templeId, input.address.country, input.items)
  if (!quote.ok) throw new Error(quote.reason ?? 'These items cannot be shipped to that address.')

  const lines = input.items.map((l) => {
    const item = SHOP_ITEMS.find((i) => i.id === l.itemId)
    if (!item || item.templeId !== templeId || !item.active) throw new Error('An item is no longer available.')
    if (item.stock !== null && item.stock < l.qty) throw new Error(`Only ${item.stock} of “${item.name}” left.`)
    return { item, qty: l.qty }
  })
  const subtotal = lines.reduce((a, l) => a + l.item.price * l.qty, 0)
  const fee = quote.fee
  const order: FulfilmentOrder = {
    id: nextOrderId(),
    templeId,
    userId: input.userId ?? null,
    items: lines.map((l) => ({ itemId: l.item.id, name: l.item.name, qty: l.qty, unitPrice: l.item.price })),
    address: input.address,
    subtotal,
    shippingFee: fee,
    total: subtotal + fee,
    currency: quote.currency,
    status: 'placed',
    createdAt: new Date().toISOString(),
    events: [{ at: new Date().toISOString(), status: 'placed' }],
    contactEmail: input.email,
    provider: input.provider,
  }
  // Reserve stock up front; released again if payment fails.
  for (const l of lines) if (l.item.stock !== null) l.item.stock -= l.qty
  ORDERS.unshift(order)

  const req: PaymentRequest = {
    templeId,
    amount: order.total,
    currency: order.currency,
    purpose: 'shop',
    reference: order.id,
    provider: input.provider,
    payer: {
      name: input.address.name,
      email: input.email ?? '',
      phone: input.address.phone,
      country: input.address.country,
    },
  }
  const res = await createPayment(temple, req)
  order.paymentRef = res.providerRef || undefined
  if (res.status === 'succeeded') {
    pushEvent(order, 'paid', 'Payment received')
  } else if (res.status === 'failed') {
    for (const l of lines) if (l.item.stock !== null) l.item.stock += l.qty
    pushEvent(order, 'cancelled', res.message ?? 'Payment failed')
    saveOrders()
    saveItems()
    throw new Error(res.message ?? 'Payment failed. You have not been charged.')
  } else {
    order.events[0]!.note = res.message ?? 'Awaiting payment'
  }
  saveOrders()
  saveItems()
  return { ...order }
}

const digits = (s: string) => s.replace(/\D/g, '')

export async function listMyOrders(who: {
  userId?: string | null
  email?: string
  phone?: string
}): Promise<FulfilmentOrder[]> {
  await simulateLatency()
  const email = who.email?.trim().toLowerCase()
  const phone = who.phone ? digits(who.phone).slice(-7) : ''
  return ORDERS.filter(
    (o) =>
      (who.userId && o.userId === who.userId) ||
      (email && o.contactEmail?.toLowerCase() === email) ||
      (phone.length >= 7 && digits(o.address.phone).endsWith(phone)),
  )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((o) => ({ ...o }))
}

export async function getOrder(id: string): Promise<FulfilmentOrder | null> {
  await simulateLatency()
  const o = ORDERS.find((x) => x.id === id)
  return o ? { ...o, events: [...o.events] } : null
}

/** Orders in 'paid' for more than 3 business days without being shipped. */
export function isOverdue(o: FulfilmentOrder, now = new Date()): boolean {
  if (o.status !== 'paid' && o.status !== 'packed') return false
  const paidAt = o.events.find((e) => e.status === 'paid')?.at ?? o.createdAt
  return businessDaysBetween(new Date(paidAt), now) > OVERDUE_BUSINESS_DAYS
}

export async function overdueShipments(templeId: string | 'all' = currentTempleId()): Promise<FulfilmentOrder[]> {
  await simulateLatency()
  return ORDERS.filter((o) => (templeId === 'all' || o.templeId === templeId) && isOverdue(o)).map((o) => ({ ...o }))
}

export async function listOrders(filters: OrderFilters = {}): Promise<FulfilmentOrder[]> {
  await simulateLatency()
  const tid = filters.templeId ?? currentTempleId()
  const q = filters.q?.trim().toLowerCase()
  return ORDERS.filter((o) => {
    if (tid !== 'all' && o.templeId !== tid) return false
    if (filters.status && filters.status !== 'all' && o.status !== filters.status) return false
    if (filters.country && filters.country !== 'all' && o.address.country !== filters.country) return false
    if (filters.overdueOnly && !isOverdue(o)) return false
    if (q) {
      const hay = `${o.id} ${o.address.name} ${o.contactEmail ?? ''} ${o.address.city} ${o.tracking ?? ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((o) => ({ ...o }))
}

export async function advanceOrder(
  id: string,
  status: ShipmentStatus,
  meta: { carrier?: string; tracking?: string; note?: string } = {},
): Promise<FulfilmentOrder> {
  await simulateLatency()
  const o = ORDERS.find((x) => x.id === id)
  if (!o) throw new Error('Order not found')
  if (o.status === 'cancelled') throw new Error('A cancelled order cannot be changed.')
  if (o.status === 'delivered' && status !== 'delivered') throw new Error('A delivered order cannot be changed.')
  if (status === 'shipped' && !(meta.tracking ?? o.tracking)) {
    throw new Error('Enter a tracking number before marking as shipped.')
  }
  if (meta.carrier) o.carrier = meta.carrier
  if (meta.tracking) o.tracking = meta.tracking
  if (status === 'held-customs') o.holdNote = meta.note
  pushEvent(o, status, meta.note ?? (status === 'shipped' ? `${o.carrier ?? ''} ${o.tracking ?? ''}`.trim() : undefined))
  saveOrders()
  return { ...o }
}

export async function cancelOrder(id: string, note = 'Cancelled'): Promise<FulfilmentOrder> {
  await simulateLatency()
  const o = ORDERS.find((x) => x.id === id)
  if (!o) throw new Error('Order not found')
  if (o.status === 'shipped' || o.status === 'delivered' || o.status === 'held-customs') {
    throw new Error('A shipped order cannot be cancelled here — arrange a return instead.')
  }
  if (o.status !== 'cancelled') {
    for (const l of o.items) {
      const item = SHOP_ITEMS.find((i) => i.id === l.itemId)
      if (item && item.stock !== null) item.stock += l.qty
    }
    pushEvent(o, 'cancelled', note)
    saveOrders()
    saveItems()
  }
  return { ...o }
}
