// POST {VITE_API_BASE}/notify          body = NotifyMessage (packages/core features/community), reply {status}
// POST {VITE_API_BASE}/notify/worker   header x-cron-secret: drains the outbox (call every minute)
//
// verify_jwt is OFF (config.toml); this function authenticates itself:
//   /notify         needs a signed-in user. Staff of the temple may message anyone with consent;
//                   anyone else may only message themselves (rate limited) and cannot choose the address.
//   /notify/worker  needs CRON_SECRET.
// NOTE: the current client transport (httpTransport) sends no Authorization header. Attach the
// Supabase access token there before enabling this in production (see docs/BACKEND.md).
import { z } from '../_shared/deps.ts'
import { HttpError, json, parseBody, safeEqual, serveJson } from '../_shared/http.ts'
import { need } from '../_shared/env.ts'
import { requireUser, serviceClient } from '../_shared/supabase.ts'
import { drainQueue, enqueue } from '../_shared/notify.ts'

const body = z.object({
  templeId: z.string().min(1).max(80),
  userId: z.string().uuid().optional(),
  to: z.string().trim().max(200).optional(),
  channel: z.enum(['email', 'sms', 'whatsapp', 'push']),
  topic: z.enum(['aarti', 'vrat', 'festival', 'daily-message', 'giving', 'shipping', 'volunteer']),
  subject: z.string().max(200).default(''),
  body: z.string().min(1).max(2000),
  broadcastId: z.string().max(80).optional(),
})

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(
  serveJson(async (req) => {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed.')
    const path = new URL(req.url).pathname.replace(/^.*\/notify/, '').replace(/\/$/, '')

    if (path === '/worker') {
      const given = req.headers.get('x-cron-secret') ?? ''
      if (!safeEqual(given, need('CRON_SECRET'))) throw new HttpError(401, 'Unauthorized.')
      return json(req, await drainQueue(serviceClient(), 100))
    }
    if (path !== '') throw new HttpError(404, 'Unknown notify route.')

    const { user, db: asUser } = await requireUser(req)
    const b = await parseBody(req, body)
    const svc = serviceClient()

    const col = UUID.test(b.templeId) ? 'id' : b.templeId.startsWith('tmp_') ? 'legacy_id' : 'slug'
    const { data: temple } = await svc.from('temples').select('id').eq(col, b.templeId).maybeSingle()
    if (!temple) throw new HttpError(404, 'Temple not found.')

    const { data: isStaff } = await asUser.rpc('has_temple_role', { tid: temple.id, roles: ['admin', 'committee'] })
    const target = b.userId ?? user.id
    if (!isStaff) {
      if (target !== user.id) throw new HttpError(403, 'You can only send messages to yourself.')
      const since = new Date(Date.now() - 3_600_000).toISOString()
      const { count } = await svc.from('notification_log').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', since)
      if ((count ?? 0) >= 5) throw new HttpError(429, 'Too many messages. Please try again later.')
    }

    const r = await enqueue(svc, {
      templeId: temple.id,
      userId: target,
      to: isStaff ? b.to : undefined,
      channel: b.channel,
      topic: b.topic,
      subject: b.subject,
      body: b.body,
      transactional: false,
    })
    // Opportunistic drain so a single send does not wait for the cron tick. Errors never fail the request.
    if (r.status === 'queued') await drainQueue(svc, 10).catch(() => undefined)
    return json(req, { status: r.status === 'queued' ? 'queued' : 'failed', note: r.reason })
  }),
)
