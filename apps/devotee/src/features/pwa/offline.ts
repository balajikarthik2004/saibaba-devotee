/**
 * Offline reading. The aarti slice (or anyone) calls `warmOfflineCache(urls)` with the
 * same-origin URLs to keep readable offline (aarti text JSON, /aarti/kakad pages, today's
 * schedule endpoint, audio). The service worker stores them in `sb-offline-read-v1`, serves
 * them stale-while-revalidate, and keeps them across deploys.
 *
 *   warmOfflineCache(['/aarti/kakad', '/api/schedule/today'])
 *
 * Resolves with how many URLs were cached (0 when no service worker is active — dev, http,
 * unsupported browsers — which is a safe no-op).
 */
export async function warmOfflineCache(urls: string[], timeoutMs = 15000): Promise<number> {
  if (!urls.length || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return 0
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const worker = navigator.serviceWorker.controller ?? reg?.active
    if (!worker) return 0
    return await new Promise<number>((resolve) => {
      const done = (e: MessageEvent) => {
        if (e.data?.type === 'cache-aarti:done') {
          cleanup()
          resolve(Number(e.data.cached) || 0)
        }
      }
      const cleanup = () => {
        navigator.serviceWorker.removeEventListener('message', done)
        window.clearTimeout(timer)
      }
      const timer = window.setTimeout(() => {
        cleanup()
        resolve(0)
      }, timeoutMs)
      navigator.serviceWorker.addEventListener('message', done)
      worker.postMessage({ type: 'cache-aarti', urls })
    })
  } catch {
    return 0
  }
}

/** Drop everything saved for offline reading (e.g. on sign-out). */
export async function clearOfflineCache(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    reg?.active?.postMessage({ type: 'clear-offline-read' })
  } catch {
    /* ignore */
  }
}
