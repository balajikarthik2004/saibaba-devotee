import { useSyncExternalStore } from 'react'
import { applyUpdate, dismissUpdate, getPwaState, subscribePwa } from './register'

/** `{ updateAvailable, applyUpdate, dismiss }` — drives <PwaUpdatePrompt />. */
export function usePwaUpdate() {
  const s = useSyncExternalStore(subscribePwa, getPwaState, getPwaState)
  return { updateAvailable: s.updateAvailable, applyUpdate, dismiss: dismissUpdate }
}
