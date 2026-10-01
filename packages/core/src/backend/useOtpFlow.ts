import { useCallback, useEffect, useRef, useState } from 'react'
import { getAuthProvider, MOCK_OTP_CODE, type AuthSession, type OtpContact, type OtpOptions } from './auth'

export const COUNTRY_CODES = [
  { code: '+1', label: 'US / Canada +1' },
  { code: '+91', label: 'India +91' },
  { code: '+44', label: 'UK +44' },
] as const

export const OTP_LENGTH = 6
export const RESEND_SECONDS = 60

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** '+44' + '07911 123456' -> '+447911123456' (drops the national trunk 0). null when implausible. */
export function toE164(code: string, national: string): string | null {
  const digits = national.replace(/\D/g, '').replace(/^0+/, '')
  if (digits.length < 7 || digits.length > 12) return null
  return `${code}${digits}`
}

export interface OtpFlowOptions extends OtpOptions {
  onVerified: (session: AuthSession) => void | Promise<void>
}

export function useOtpFlow(opts: OtpFlowOptions) {
  const provider = getAuthProvider()
  const [method, setMethod] = useState<'email' | 'phone'>('email')
  const [email, setEmail] = useState('')
  const [cc, setCc] = useState<string>('+1')
  const [phone, setPhone] = useState('')
  const [step, setStep] = useState<'contact' | 'code'>('contact')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendIn, setResendIn] = useState(0)
  const optsRef = useRef(opts)
  optsRef.current = opts

  useEffect(() => {
    if (resendIn <= 0) return
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [resendIn])

  const contact = useCallback((): OtpContact | null => {
    if (method === 'email') {
      const e = email.trim().toLowerCase()
      return EMAIL_RE.test(e) ? { email: e } : null
    }
    const p = toE164(cc, phone)
    return p ? { phone: p } : null
  }, [method, email, cc, phone])

  const send = useCallback(async () => {
    if (busy) return false
    const c = contact()
    if (!c) {
      setError(method === 'email' ? 'Enter a valid email address.' : 'Enter a valid mobile number.')
      return false
    }
    setBusy(true)
    setError(null)
    try {
      await provider.signInWithOtp(c, { createUser: optsRef.current.createUser, metadata: optsRef.current.metadata })
      setStep('code')
      setResendIn(RESEND_SECONDS)
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the code.')
      return false
    } finally {
      setBusy(false)
    }
  }, [busy, contact, method, provider])

  const verify = useCallback(
    async (code: string) => {
      if (busy) return
      const c = contact()
      if (!c || code.length !== OTP_LENGTH) return
      setBusy(true)
      setError(null)
      try {
        const session = await provider.verifyOtp(c, code)
        await optsRef.current.onVerified(session)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Verification failed.')
      } finally {
        setBusy(false)
      }
    },
    [busy, contact, provider],
  )

  const back = useCallback(() => {
    setStep('contact')
    setError(null)
  }, [])

  return {
    provider,
    isMock: provider.kind === 'mock',
    mockCode: MOCK_OTP_CODE,
    method,
    setMethod: (m: 'email' | 'phone') => {
      setMethod(m)
      setError(null)
    },
    email,
    setEmail,
    cc,
    setCc,
    phone,
    setPhone,
    step,
    busy,
    error,
    setError,
    resendIn,
    send,
    verify,
    back,
    /** Display string for "we sent a code to ...". */
    target: method === 'email' ? email.trim() : (toE164(cc, phone) ?? `${cc}${phone}`),
  }
}
