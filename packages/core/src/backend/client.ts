import type { SupabaseClient } from '@supabase/supabase-js'
import { readEnv } from './mode'

/**
 * Lazily creates the browser Supabase client. `@supabase/supabase-js` is imported dynamically so it
 * is NOT in the initial bundle of apps running in mock mode (the default).
 *
 * The client is untyped on purpose: row shapes live in `mappers.ts`, and generated `Database`
 * types (`supabase gen types typescript`) can be threaded in later without touching callers.
 * UNTESTED AGAINST A LIVE PROJECT.
 */
let client: Promise<SupabaseClient> | null = null

export function getSupabase(): Promise<SupabaseClient> {
  client ??= (async () => {
    const url = readEnv('VITE_SUPABASE_URL')
    const key = readEnv('VITE_SUPABASE_ANON_KEY')
    if (!url || !key) throw new Error('Supabase is not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).')
    const { createClient } = await import('@supabase/supabase-js')
    return createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    })
  })()
  return client
}

/** Unwraps a PostgREST result, turning `{ error }` into a thrown Error with a readable message. */
export function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}
