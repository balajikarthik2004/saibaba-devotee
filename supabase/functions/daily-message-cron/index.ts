// Scheduled digest of the daily teaching message. Invoke every 15 minutes (pg_cron + pg_net, or a
// Supabase scheduled function) with header x-cron-secret: $CRON_SECRET. See docs/BACKEND.md.
//
// For each active temple: today's message in the temple's timezone (temple-specific, else platform-wide;
// recipient language first, English fallback) -> every devotee whose home temple it is, who opted in to the
// 'daily-message' topic, on each enabled channel. Once local time passes DIGEST_LOCAL_HOUR (default 7).
// Idempotent: dedupe key = user:date:channel, so repeated runs never double-send. SMS/WhatsApp consent and
// quiet hours are enforced inside enqueue().
import { HttpError, json, safeEqual, serveJson } from '../_shared/http.ts'
import { env, need } from '../_shared/env.ts'
import { serviceClient } from '../_shared/supabase.ts'
import { drainQueue, enqueue, type Channel } from '../_shared/notify.ts'
import { localMinutes } from '../_shared/quiet.ts'

Deno.serve(
  serveJson(async (req) => {
    if (!safeEqual(req.headers.get('x-cron-secret') ?? '', need('CRON_SECRET'))) throw new HttpError(401, 'Unauthorized.')
    const svc = serviceClient()
    const hour = Number(env('DIGEST_LOCAL_HOUR') ?? 7)
    const now = new Date()
    const stats = { temples: 0, queued: 0, skipped: 0 }

    const { data: temples } = await svc.from('temples').select('id,name,timezone').eq('status', 'active')
    for (const t of temples ?? []) {
      if (localMinutes(now, t.timezone) < hour * 60) continue
      stats.temples++
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: t.timezone }).format(now) // YYYY-MM-DD
      const { data: msgs } = await svc.from('daily_messages').select('temple_id,language,text').eq('date', today).or(`temple_id.eq.${t.id},temple_id.is.null`)
      if (!msgs?.length) continue
      const pick = (lang: string) =>
        msgs.find((m) => m.temple_id === t.id && m.language === lang) ?? msgs.find((m) => !m.temple_id && m.language === lang)

      const { data: people } = await svc
        .from('profiles')
        .select('id,full_name,preferred_language,notification_prefs!inner(channels,topics)')
        .eq('home_temple_id', t.id)
        .is('deleted_at', null)
        .limit(2000)
      for (const p of people ?? []) {
        const prefs = (p.notification_prefs as unknown as { channels: Record<string, boolean>; topics: Record<string, boolean> } | { channels: Record<string, boolean>; topics: Record<string, boolean> }[])
        const pr = Array.isArray(prefs) ? prefs[0] : prefs
        if (!pr?.topics['daily-message']) continue
        const m = pick(p.preferred_language) ?? pick('en')
        if (!m) continue
        const first = (p.full_name || 'friend').split(' ')[0]
        for (const ch of ['email', 'whatsapp', 'sms'] as Channel[]) {
          if (!pr.channels[ch]) continue
          const r = await enqueue(svc, {
            templeId: t.id,
            userId: p.id,
            channel: ch,
            topic: 'daily-message',
            subject: `Today's message from ${t.name}`,
            body: `Om Sai Ram, ${first}.\n\n${m.text}`,
            template: 'daily-message',
            dedupeKey: `${p.id}:${today}:${ch}:daily`,
          })
          if (r.status === 'queued') stats.queued++
          else stats.skipped++
        }
      }
    }
    const sent = await drainQueue(svc, 200)
    return json(req, { ...stats, ...sent })
  }),
)
