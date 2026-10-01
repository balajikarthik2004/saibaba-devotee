// Server-side resolution of "what is this payment for, and how much should it be?".
// The client's amount is NEVER trusted: it must equal what the database says.
import type { SupabaseClient } from '../_shared/deps.ts'
import { z } from '../_shared/deps.ts'
import { HttpError } from '../_shared/http.ts'
import { CURRENCIES, checkAmountBounds, type Currency } from '../_shared/money.ts'

export const paymentBody = z.object({
  templeId: z.string().min(1).max(80),
  amount: z.number().positive().finite(),
  currency: z.enum(CURRENCIES),
  purpose: z.enum(['donation', 'sponsorship', 'shop', 'annadanam']),
  reference: z.string().min(1).max(100),
  payer: z.object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(200),
    phone: z.string().trim().max(40).optional().default(''),
    country: z.enum(['US', 'IN', 'GB', 'CA']).optional(),
  }),
  recurring: z.enum(['monthly', 'yearly']).nullable().optional(),
  /** Annadanam / donation extras the client may pass; validated but only used as labels. */
  dedicatedTo: z.string().trim().max(200).optional(),
})
export type PaymentBody = z.infer<typeof paymentBody>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (s: string) => UUID.test(s)

export interface TempleRow {
  id: string
  name: string
  currency: Currency
  status: string
  payments: string[]
  country: string
}

export async function resolveTemple(db: SupabaseClient, key: string): Promise<TempleRow> {
  const col = isUuid(key) ? 'id' : key.startsWith('tmp_') ? 'legacy_id' : 'slug'
  const { data, error } = await db.from('temples').select('id,name,currency,status,payments,country').eq(col, key).maybeSingle()
  if (error) throw new HttpError(500, 'Could not look up the temple.')
  if (!data) throw new HttpError(404, 'Temple not found.')
  if (data.status !== 'active') throw new HttpError(409, 'This temple is not accepting online payments right now.')
  return data as TempleRow
}

export interface Target {
  referenceType: 'booking' | 'donation' | 'order' | 'annadanam_drive'
  referenceId: string
  userId: string | null
  meta: Record<string, unknown>
  description: string
}

/** Validates the payment request against the DB and returns the canonical target. */
export async function resolveTarget(
  db: SupabaseClient,
  temple: TempleRow,
  body: PaymentBody,
  callerUserId: string | null,
): Promise<Target> {
  if (body.currency !== temple.currency) throw new HttpError(400, `This temple accepts ${temple.currency} only.`)
  const bounds = checkAmountBounds(body.amount, body.currency)
  if (bounds) throw new HttpError(400, bounds)
  if (body.recurring && body.purpose !== 'donation') throw new HttpError(400, 'Only donations can repeat.')

  const mustMatch = (expected: number) => {
    if (Math.abs(expected - body.amount) > 0.001) throw new HttpError(400, 'The amount does not match what is owed. Please refresh and try again.')
  }
  const own = (ownerId: string | null) => {
    // A signed-in caller may only pay for their own records; guest payers may not pay someone
    // else's booking/order because those ids are unguessable uuids AND require a matching amount.
    if (ownerId && callerUserId && ownerId !== callerUserId) throw new HttpError(403, 'That record belongs to another account.')
  }

  switch (body.purpose) {
    case 'donation': {
      if (isUuid(body.reference)) {
        const { data } = await db.from('donations').select('id,user_id,amount,currency,status,temple_id,category').eq('id', body.reference).maybeSingle()
        if (!data || data.temple_id !== temple.id) throw new HttpError(404, 'Donation not found.')
        if (data.status !== 'pending') throw new HttpError(409, 'This donation has already been processed.')
        if (data.currency !== body.currency) throw new HttpError(400, 'Currency does not match the donation.')
        own(data.user_id)
        mustMatch(Number(data.amount))
        return { referenceType: 'donation', referenceId: data.id, userId: data.user_id ?? callerUserId, meta: {}, description: `Donation to ${temple.name}` }
      }
      // Guest flow: no record yet, so create the pending donation server-side.
      const [first, ...rest] = body.payer.name.split(/\s+/)
      const { data, error } = await db
        .from('donations')
        .insert({
          temple_id: temple.id,
          user_id: callerUserId,
          donor_first_name: callerUserId ? null : first,
          donor_last_name: callerUserId ? null : rest.join(' ') || null,
          donor_email: body.payer.email,
          donor_phone: body.payer.phone || null,
          category: 'general-hundi',
          amount: body.amount,
          currency: body.currency,
          provider: 'stripe',
          payment_method: 'card',
          is_recurring: Boolean(body.recurring),
          recurring_cadence: body.recurring ?? null,
          dedicated_to: body.dedicatedTo ?? null,
        })
        .select('id')
        .single()
      if (error || !data) throw new HttpError(500, 'Could not record the donation.')
      return { referenceType: 'donation', referenceId: data.id, userId: callerUserId, meta: {}, description: `Donation to ${temple.name}` }
    }
    case 'sponsorship': {
      if (!isUuid(body.reference)) throw new HttpError(400, 'Invalid booking reference.')
      const { data } = await db.from('bookings').select('id,user_id,amount,currency,status,temple_id,payment_reference').eq('id', body.reference).maybeSingle()
      if (!data || data.temple_id !== temple.id) throw new HttpError(404, 'Booking not found.')
      if (data.status !== 'pending' || data.payment_reference) throw new HttpError(409, 'This booking is already paid or no longer pending.')
      if (data.currency !== body.currency) throw new HttpError(400, 'Currency does not match the booking.')
      own(data.user_id)
      mustMatch(Number(data.amount))
      return { referenceType: 'booking', referenceId: data.id, userId: data.user_id, meta: {}, description: `Puja sponsorship, ${temple.name}` }
    }
    case 'shop': {
      if (!isUuid(body.reference)) throw new HttpError(400, 'Invalid order reference.')
      const { data } = await db.from('shop_orders').select('id,user_id,total,currency,status,temple_id').eq('id', body.reference).maybeSingle()
      if (!data || data.temple_id !== temple.id) throw new HttpError(404, 'Order not found.')
      if (data.status !== 'placed') throw new HttpError(409, 'This order is not awaiting payment.')
      if (data.currency !== body.currency) throw new HttpError(400, 'Currency does not match the order.')
      own(data.user_id)
      mustMatch(Number(data.total))
      return { referenceType: 'order', referenceId: data.id, userId: data.user_id, meta: {}, description: `Shop order, ${temple.name}` }
    }
    case 'annadanam': {
      if (!isUuid(body.reference)) throw new HttpError(400, 'Invalid annadanam drive reference.')
      const { data } = await db.from('annadanam_drives').select('id,price_per_meal,currency,status,temple_id,meals_target,meals_funded').eq('id', body.reference).maybeSingle()
      if (!data || data.temple_id !== temple.id) throw new HttpError(404, 'Annadanam drive not found.')
      if (data.status !== 'open') throw new HttpError(409, 'This annadanam drive is closed.')
      if (data.currency !== body.currency) throw new HttpError(400, 'Currency does not match the drive.')
      const price = Number(data.price_per_meal)
      const meals = Math.round(body.amount / price)
      if (meals < 1 || Math.abs(meals * price - body.amount) > 0.001) throw new HttpError(400, `Amount must be a whole number of meals at ${price} each.`)
      return {
        referenceType: 'annadanam_drive',
        referenceId: data.id,
        userId: callerUserId,
        meta: { meals, donorName: body.payer.name, dedicatedTo: body.dedicatedTo ?? null },
        description: `Annadanam: ${meals} meals, ${temple.name}`,
      }
    }
  }
}

/** Temple-level payment account (Stripe Connect / Razorpay Route). Service client only. */
export async function paymentAccount(db: SupabaseClient, templeId: string) {
  const { data } = await db.from('temple_payment_accounts').select('stripe_account_id,stripe_mode,razorpay_account_id').eq('temple_id', templeId).maybeSingle()
  return {
    stripeAccount: data?.stripe_mode === 'connect' && data.stripe_account_id ? (data.stripe_account_id as string) : undefined,
    razorpayAccount: (data?.razorpay_account_id as string | null) ?? undefined,
  }
}
