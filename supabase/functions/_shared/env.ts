import { HttpError } from './http.ts'

/** Read an optional secret. Empty string counts as unset. */
export function env(name: string): string | undefined {
  const v = Deno.env.get(name)
  return v && v.trim() ? v.trim() : undefined
}

/**
 * Read a required secret. The missing NAME is logged server-side but never returned to the
 * client (a 503 must not teach an attacker which integrations are configured).
 */
export function need(name: string): string {
  const v = env(name)
  if (!v) {
    console.error(JSON.stringify({ level: 'error', msg: 'missing secret', name }))
    throw new HttpError(503, 'This feature is not configured on the server yet.')
  }
  return v
}
