import { env } from './env.ts'

/** Thrown anywhere in a handler; `serveJson` turns it into `{ "error": message }`. */
export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
]

/** ALLOWED_ORIGINS (comma separated) + APP_DEVOTEE_URL + APP_ADMIN_URL; localhost only when none set. */
export function allowedOrigins(): string[] {
  const list = [...(env('ALLOWED_ORIGINS')?.split(',') ?? []), env('APP_DEVOTEE_URL'), env('APP_ADMIN_URL')]
    .map((s) => s?.trim().replace(/\/$/, ''))
    .filter((s): s is string => !!s)
  return list.length ? list : DEFAULT_ORIGINS
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  const ok = allowedOrigins().includes(origin)
  return {
    // Webhooks carry no Origin header and need no CORS at all.
    ...(ok ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '600',
  }
}

export function json(req: Request, body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...corsHeaders(req), ...extra },
  })
}

export function log(level: 'info' | 'warn' | 'error', msg: string, extra: Record<string, unknown> = {}) {
  console[level === 'info' ? 'log' : level](JSON.stringify({ level, msg, ...extra }))
}

/**
 * Wraps a handler with CORS preflight, structured errors and a request-size cap.
 * Errors: `{ "error": "human readable message" }` + non-2xx, as the client contract requires.
 */
export function serveJson(handler: (req: Request) => Promise<Response>): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) })
    try {
      const len = Number(req.headers.get('content-length') ?? 0)
      if (len > 256_000) throw new HttpError(413, 'Request too large.')
      return await handler(req)
    } catch (e) {
      if (e instanceof HttpError) return json(req, { error: e.message }, e.status)
      log('error', 'unhandled', { message: e instanceof Error ? e.message : String(e) })
      return json(req, { error: 'Something went wrong on our side. Please try again.' }, 500)
    }
  }
}

type Parsed<T> =
  | { success: true; data: T }
  | { success: false; error: { issues: { path: (string | number)[]; message: string }[] } }

/** Parse + validate a JSON body with a zod schema (the first issue becomes the 400 message). */
export async function parseBody<T>(req: Request, schema: { safeParse: (v: unknown) => Parsed<T> }): Promise<T> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    throw new HttpError(400, 'Request body must be JSON.')
  }
  const r = schema.safeParse(raw)
  if (!r.success) {
    const i = r.error.issues[0]
    throw new HttpError(400, `Invalid request: ${i?.path.join('.') || 'body'} ${i?.message ?? ''}`.trim())
  }
  return r.data
}

/** Constant-time string compare (for secrets / signatures). */
export function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a)
  const eb = new TextEncoder().encode(b)
  let diff = ea.length ^ eb.length
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0)
  return diff === 0
}
