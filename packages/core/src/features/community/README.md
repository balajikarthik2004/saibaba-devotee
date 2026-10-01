# Community slice (prayers, groups, notifications)

Mock, persisted under `saibaba:community:*` localStorage keys. Public API is re-exported from
`@saibaba/core` (`export * from './community'` in `features/index.ts`).

## Consent rules

- WhatsApp and SMS are off by default and only deliverable when `prefs.consent.<channel>`
  holds an explicit opt-in record (set by the tick-box in `/settings/notifications`).
  `savePrefs` strips the channel if no consent record exists; `composeBroadcast` re-checks.
- Quiet hours hold push/SMS/WhatsApp (logged `queued`, note "Held for quiet hours"); email is
  not held.

## Transport

`NotificationService.send(msg)`. Default is `mockTransport` (appends to the persisted log, never
touches the network). `httpTransport(baseUrl)` POSTs `NotifyMessage` JSON to
`${VITE_API_BASE}/notify` (the backend edge function). `getNotificationService()` picks http only
when `VITE_DATA_MODE=supabase` and `VITE_API_BASE` is set; `setNotificationService()` overrides.

## scheduleDailyMessageDigest (server cron, NOT implemented in the client)

The daily teaching message is a server job; the browser must never schedule it.

1. Cron (Supabase `pg_cron` or a scheduled edge function) runs every 15 minutes.
2. For each temple, pick today's `DailyMessage` (temple-specific first, else global) in the
   temple's timezone.
3. Select users with `topics['daily-message']` on and at least one deliverable channel.
   sms/whatsapp only with a consent record.
4. For each recipient compute local time; if inside `quietHours`, skip now and let the next run
   after the window ends pick it up (idempotency key: `userId + date + channel`).
5. Render merge tags `{first_name}` / `{temple}`, send through the provider, write a
   `notification_log` row (`queued` → `sent`/`failed`).
6. Every message carries an unsubscribe link that flips the topic/channel pref.

## Safeguarding

Bal Vikas (children's programme) group contact details are shown to signed-in members only.
Prayer text is moderated (links, phone numbers, emails, unkind language, very long text and
medical detail are flagged); a human approves before anything reaches the public wall.
