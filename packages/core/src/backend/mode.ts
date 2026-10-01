/**
 * Data mode switch. `VITE_DATA_MODE=mock` (default) keeps the whole app on the in-memory mock API;
 * `supabase` routes the migrated slices (see docs/BACKEND.md) through the repository layer.
 */
export type DataMode = 'mock' | 'supabase'

type EnvBag = Record<string, string | undefined>

/** `import.meta.env` without requiring vite/client types in this package. */
export function readEnv(name: string): string | undefined {
  const e = (import.meta as unknown as { env?: EnvBag }).env
  const v = e?.[name]
  return v && v.trim() ? v.trim() : undefined
}

export function dataMode(): DataMode {
  return readEnv('VITE_DATA_MODE') === 'supabase' ? 'supabase' : 'mock'
}

/** True only when supabase mode is selected AND the project URL + anon key are present. */
export function supabaseConfigured(): boolean {
  return Boolean(readEnv('VITE_SUPABASE_URL') && readEnv('VITE_SUPABASE_ANON_KEY'))
}

/** Supabase mode requested but not configured falls back to mock (and says so once). */
let warned = false
export function isSupabaseMode(): boolean {
  if (dataMode() !== 'supabase') return false
  if (!supabaseConfigured()) {
    if (!warned) {
      warned = true
      console.warn('[backend] VITE_DATA_MODE=supabase but VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing: using mock data.')
    }
    return false
  }
  return true
}
