/**
 * Web push — DOCUMENTED STUB. Sending push needs the backend (VAPID key pair + a function that
 * stores subscriptions and fires notifications). Nothing calls this automatically; wire it to
 * an explicit "Turn on reminders" button in settings/notifications.
 *
 * Backend contract: POST the returned JSON (endpoint + keys) to the notification service keyed
 * by user + temple; send payloads shaped `{ title, body, url }` (sw.js displays them and opens
 * `url` on click). Set `VITE_VAPID_PUBLIC_KEY` to the public VAPID key.
 */
export type PushResult =
  | { ok: true; subscription: PushSubscriptionJSON }
  | { ok: false; reason: 'unsupported' | 'denied' | 'no-vapid-key' | 'no-service-worker' | 'error' }

function urlBase64ToUint8Array(b64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export async function subscribeToPush(): Promise<PushResult> {
  if (typeof window === 'undefined' || !('PushManager' in window) || !('Notification' in window)) {
    return { ok: false, reason: 'unsupported' }
  }
  const key = (import.meta.env as Record<string, string | undefined>).VITE_VAPID_PUBLIC_KEY
  if (!key) return { ok: false, reason: 'no-vapid-key' }
  try {
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return { ok: false, reason: 'denied' }
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg) return { ok: false, reason: 'no-service-worker' }
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      }))
    return { ok: true, subscription: sub.toJSON() }
  } catch {
    return { ok: false, reason: 'error' }
  }
}
