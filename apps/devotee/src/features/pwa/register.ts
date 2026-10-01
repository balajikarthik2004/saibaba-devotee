/**
 * Service-worker registration + update state. `registerServiceWorker()` is called from
 * main.tsx in production only. Update flow: a new worker installs and waits; `usePwaUpdate`
 * exposes `updateAvailable`, and `applyUpdate()` tells it to SKIP_WAITING, then reloads once
 * the new worker takes control.
 */
interface State {
  updateAvailable: boolean
  registration: ServiceWorkerRegistration | null
}
let state: State = { updateAvailable: false, registration: null }
const listeners = new Set<() => void>()
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export const subscribePwa = (l: () => void) => {
  listeners.add(l)
  return () => void listeners.delete(l)
}
export const getPwaState = () => state

export const swSupported = () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator

export function registerServiceWorker(): void {
  if (!swSupported()) return
  const go = async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      set({ registration: reg })
      const watch = (worker: ServiceWorker | null) => {
        worker?.addEventListener('statechange', () => {
          // "installed" while a controller exists == an update, not the first install.
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            set({ updateAvailable: true })
          }
        })
      }
      if (reg.waiting && navigator.serviceWorker.controller) set({ updateAvailable: true })
      reg.addEventListener('updatefound', () => watch(reg.installing))
      // Check for a new deploy when the tab returns and hourly.
      const check = () => void reg.update().catch(() => undefined)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
      window.setInterval(check, 60 * 60 * 1000)
    } catch {
      /* registration failed (private mode, http): app works without it */
    }
  }
  if (document.readyState === 'complete') void go()
  else window.addEventListener('load', () => void go(), { once: true })

  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !state.updateAvailable) return
    reloading = true
    window.location.reload()
  })
}

/** Activate the waiting worker; the page reloads on controllerchange. */
export function applyUpdate(): void {
  const waiting = state.registration?.waiting
  if (waiting) waiting.postMessage({ type: 'SKIP_WAITING' })
  else window.location.reload()
}

export function dismissUpdate(): void {
  set({ updateAvailable: false })
}
