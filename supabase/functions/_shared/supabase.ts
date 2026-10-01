import { createClient, type SupabaseClient, type User } from './deps.ts'
import { HttpError } from './http.ts'
import { need } from './env.ts'

/** Bypasses RLS. Only used after the caller or event has been authenticated and input validated. */
export function serviceClient(): SupabaseClient {
  return createClient(need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Acts AS the caller: RLS applies. */
export function userClient(req: Request): SupabaseClient {
  return createClient(need('SUPABASE_URL'), need('SUPABASE_ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
}

/** Require a valid signed-in user. Returns the user and an RLS-scoped client. */
export async function requireUser(req: Request): Promise<{ user: User; db: SupabaseClient }> {
  const header = req.headers.get('Authorization') ?? ''
  if (!/^Bearer\s+\S+/i.test(header)) throw new HttpError(401, 'Please sign in.')
  const db = userClient(req)
  const { data, error } = await db.auth.getUser()
  if (error || !data.user) throw new HttpError(401, 'Your session has expired. Please sign in again.')
  return { user: data.user, db }
}

/** Like requireUser but returns null for anonymous callers (guest giving). */
export async function optionalUser(req: Request): Promise<User | null> {
  if (!/^Bearer\s+\S+/i.test(req.headers.get('Authorization') ?? '')) return null
  try {
    return (await requireUser(req)).user
  } catch {
    return null
  }
}
