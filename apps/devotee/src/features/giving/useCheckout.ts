import { useCallback, useRef, useState } from 'react'
import { providerByKey } from '@saibaba/core'
import type {
  ConfirmInput,
  GivingPaymentRequest,
  GivingPaymentResult,
  PaymentProvider,
  Temple,
} from '@saibaba/core'

export type CheckoutPhase = 'idle' | 'creating' | 'action' | 'confirming' | 'failed'

/**
 * Drives one payment through a provider: create, then (only if the provider asks for it)
 * a second step such as 3-D Secure, the Stripe Payment Element, Razorpay Checkout or a
 * UPI QR. `start` resolves with the final result when no second step is needed, else
 * with null and `phase === 'action'`; `complete` finishes the second step.
 */
export function useCheckout(temple: Temple) {
  const [phase, setPhase] = useState<CheckoutPhase>('idle')
  const [result, setResult] = useState<GivingPaymentResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const providerRef = useRef<PaymentProvider | null>(null)

  const start = useCallback(
    async (req: GivingPaymentRequest): Promise<GivingPaymentResult | null> => {
      const provider = providerByKey(req.provider)
      providerRef.current = provider
      setError(null)
      setPhase('creating')
      try {
        const r = await provider.createPayment(req, temple)
        if (r.status === 'failed') {
          setPhase('failed')
          setError(r.message ?? 'The payment did not go through.')
          return null
        }
        if (r.status === 'requires-action' || r.next === 'upi-qr') {
          setResult(r)
          setPhase('action')
          return null
        }
        setResult(r)
        setPhase('idle')
        return r
      } catch (e) {
        setPhase('failed')
        setError((e as Error).message)
        return null
      }
    },
    [temple],
  )

  const complete = useCallback(
    async (input: ConfirmInput): Promise<GivingPaymentResult | null> => {
      const provider = providerRef.current
      if (!provider?.confirm || !result) return null
      setPhase('confirming')
      try {
        const r = await provider.confirm(result, input)
        if (r.status === 'failed') {
          setError(r.message ?? 'The payment did not go through.')
          setPhase('failed')
          return null
        }
        if (r.status === 'requires-action') {
          setResult(r)
          setPhase('action')
          return null
        }
        setResult(r)
        setPhase('idle')
        return r
      } catch (e) {
        setError((e as Error).message)
        setPhase('failed')
        return null
      }
    },
    [result],
  )

  const reset = useCallback(() => {
    setPhase('idle')
    setResult(null)
    setError(null)
  }, [])

  return { phase, result, error, start, complete, reset, provider: providerRef.current }
}
