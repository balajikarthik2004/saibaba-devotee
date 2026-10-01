// POST {VITE_API_BASE}/admin-invite-staff   { templeId, email, role }
// Caller must be admin of that temple (or a platform admin). Invites the person by email through
// Supabase Auth (creates the auth user if new), then records temple_members. The platform role is
// NOT grantable here: platform_admins is managed in SQL by the platform team only.
import { z } from '../_shared/deps.ts'
import { HttpError, json, parseBody, serveJson } from '../_shared/http.ts'
import { env } from '../_shared/env.ts'
import { requireUser, serviceClient } from '../_shared/supabase.ts'

const body = z.object({
  templeId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email().max(200),
  role: z.enum(['admin', 'board', 'priest', 'finance', 'committee']),
})

Deno.serve(
  serveJson(async (req) => {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed.')
    const { user, db } = await requireUser(req)
    const b = await parseBody(req, body)

    const { data: allowed } = await db.rpc('has_temple_role', { tid: b.templeId, roles: ['admin'] })
    if (!allowed) throw new HttpError(403, 'Only a temple administrator can invite staff.')

    const svc = serviceClient()
    let invitedUserId: string | null = null
    const { data: existing } = await svc.rpc('find_auth_user_by_email', { p_email: b.email })
    if (existing) {
      invitedUserId = existing as string
    } else {
      const redirectTo = env('APP_ADMIN_URL')
      const { data, error } = await svc.auth.admin.inviteUserByEmail(b.email, redirectTo ? { redirectTo } : undefined)
      if (error || !data.user) throw new HttpError(400, 'Could not send the invitation.')
      invitedUserId = data.user.id
    }

    const { error } = await svc.from('temple_members').upsert({ temple_id: b.templeId, user_id: invitedUserId, role: b.role }, { onConflict: 'temple_id,user_id,role', ignoreDuplicates: true })
    if (error) throw new HttpError(500, 'Could not add the staff member.')
    await svc.from('audit_log').insert({
      temple_id: b.templeId,
      actor_id: user.id,
      actor_role: 'admin',
      action: 'invite-staff',
      entity: 'temple_members',
      entity_id: invitedUserId,
      detail: { role: b.role, email_domain: b.email.split('@')[1] },
    })
    return json(req, { invited: true, userId: invitedUserId, role: b.role })
  }),
)
