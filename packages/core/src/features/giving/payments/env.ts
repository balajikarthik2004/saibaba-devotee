/**
 * Build-time configuration. Only publishable identifiers ever live here — secret keys
 * belong to the server (see README.md in this folder).
 */
export function env(name: string): string | undefined {
  const e = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
  const v = e?.[name]
  return v && v.trim() ? v.trim() : undefined
}

/** Backend base URL, without a trailing slash. Absent = demo (mock) mode. */
export const apiBase = () => env('VITE_API_BASE')?.replace(/\/+$/, '')

export const stripePublishableKey = () => env('VITE_STRIPE_PUBLISHABLE_KEY')
export const razorpayKeyId = () => env('VITE_RAZORPAY_KEY_ID')

export const stripeLive = () => Boolean(stripePublishableKey() && apiBase())
export const razorpayLive = () => Boolean(apiBase())

/** POST JSON to the backend and parse the JSON reply; throws with the server's message. */
export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const base = apiBase()
  if (!base) throw new Error('No backend configured (VITE_API_BASE).')
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) {
    const msg = (json as { error?: string } | null)?.error ?? `Payment service error (${res.status})`
    throw new Error(msg)
  }
  return json as T
}

/** Loads a script once and resolves when it is ready. */
const loading = new Map<string, Promise<void>>()
export function loadScript(src: string): Promise<void> {
  const hit = loading.get(src)
  if (hit) return hit
  const p = new Promise<void>((resolve, reject) => {
    if (typeof document === 'undefined') return reject(new Error('No document'))
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => {
      loading.delete(src)
      reject(new Error(`Could not load ${src}`))
    }
    document.head.appendChild(s)
  })
  loading.set(src, p)
  return p
}
