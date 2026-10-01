-- Server-side procedures the edge functions call (service_role only).
-- Doing these in SQL keeps each webhook delivery ATOMIC: event-id dedupe + payment state +
-- domain row + receipt number all commit together, or none do (so Stripe/Razorpay retries are safe).

alter table public.payments add column meta jsonb not null default '{}'::jsonb;
alter table public.payments drop constraint payments_reference_type_check;
alter table public.payments add constraint payments_reference_type_check
  check (reference_type in ('booking','donation','order','annadanam_pledge','annadanam_drive'));

-- ---------------------------------------------------------------------------------------
-- apply_payment_event: the single entry point for provider webhooks.
--   p_status   'succeeded' | 'failed' | 'refunded'
--   p_amount   amount the PROVIDER says it moved (whole currency units); must equal payments.amount
--   p_renewal  true for a recurring charge after the first (Stripe invoice.paid, billing_reason
--              subscription_cycle): clones the donation and issues a fresh receipt.
-- Returns jsonb {result, ...ids} where result is one of:
--   applied | duplicate | ignored | unknown-payment | amount-mismatch
-- ---------------------------------------------------------------------------------------
create or replace function public.apply_payment_event(
  p_provider text, p_event_id text, p_provider_ref text, p_status text,
  p_fee numeric default 0, p_amount numeric default null, p_renewal boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  n int;
  pay public.payments;
  don_id uuid;
  rec_id uuid;
  pl jsonb;
begin
  if p_status not in ('succeeded','failed','refunded') then
    raise exception 'bad status %', p_status using errcode = '22023';
  end if;

  insert into public.webhook_events (provider, event_id) values (p_provider, p_event_id)
  on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('result', 'duplicate'); end if;

  select * into pay from public.payments
   where provider = p_provider and provider_ref = p_provider_ref for update;
  if not found then
    delete from public.webhook_events where provider = p_provider and event_id = p_event_id;
    return jsonb_build_object('result', 'unknown-payment');
  end if;

  -- never trust the provider callback alone: the amount must match what we asked for
  if p_status = 'succeeded' and p_amount is not null and p_amount <> pay.amount then
    insert into public.audit_log (temple_id, action, entity, entity_id, detail)
    values (pay.temple_id, 'amount-mismatch', 'payments', pay.id::text,
            jsonb_build_object('expected', pay.amount, 'provider_said', p_amount, 'event', p_event_id));
    return jsonb_build_object('result', 'amount-mismatch', 'payment_id', pay.id);
  end if;

  -- recurring charge after the first: new donation + receipt
  if p_renewal and p_status = 'succeeded' and pay.status = 'succeeded' and pay.reference_type = 'donation' then
    insert into public.donations (temple_id, user_id, donor_first_name, donor_last_name, donor_email, donor_phone,
                                  category, amount, currency, fee, provider, payment_method, payment_id, status,
                                  is_recurring, recurring_cadence, dedicated_to)
    select temple_id, user_id, donor_first_name, donor_last_name, donor_email, donor_phone,
           category, amount, currency, p_fee, provider, payment_method, pay.id, 'succeeded',
           true, recurring_cadence, dedicated_to
      from public.donations where id = pay.reference_id
    returning id into don_id;
    rec_id := public.issue_receipt_for_donation(don_id);
    return jsonb_build_object('result', 'applied', 'renewal', true, 'temple_id', pay.temple_id,
                              'user_id', pay.user_id, 'donation_id', don_id, 'receipt_id', rec_id);
  end if;

  -- state machine: pending/requires-action -> succeeded|failed ; succeeded -> refunded
  if not ((pay.status in ('pending','requires-action') and p_status in ('succeeded','failed'))
       or (pay.status = 'succeeded' and p_status = 'refunded')) then
    update public.payments set last_event_id = p_event_id where id = pay.id;
    return jsonb_build_object('result', 'ignored', 'payment_id', pay.id, 'status', pay.status);
  end if;

  update public.payments set status = p_status, fee = coalesce(p_fee, 0), last_event_id = p_event_id
   where id = pay.id;

  if p_status = 'succeeded' then
    if pay.reference_type = 'donation' then
      update public.donations set status = 'succeeded', payment_id = pay.id, fee = coalesce(p_fee, 0)
       where id = pay.reference_id returning id into don_id;
      if don_id is not null then rec_id := public.issue_receipt_for_donation(don_id); end if;
    elsif pay.reference_type = 'booking' then
      -- money arrived; the accounts desk still verifies it (approval chain is unchanged)
      update public.bookings
         set payment_method = 'card', payment_reference = p_provider_ref, payment_received_at = now()
       where id = pay.reference_id;
    elsif pay.reference_type = 'order' then
      update public.shop_orders set status = 'paid', payment_id = pay.id
       where id = pay.reference_id and status = 'placed';
      insert into public.shop_order_events (order_id, temple_id, status, note)
      values (pay.reference_id, pay.temple_id, 'paid', 'Payment confirmed by ' || p_provider);
    elsif pay.reference_type = 'annadanam_drive' then
      pl := pay.meta;
      insert into public.annadanam_pledges (drive_id, temple_id, user_id, donor_name, meals, amount, currency, dedicated_to)
      values (pay.reference_id, pay.temple_id, pay.user_id, coalesce(pl ->> 'donorName', 'Devotee'),
              greatest((pl ->> 'meals')::int, 1), pay.amount, pay.currency, pl ->> 'dedicatedTo');
    end if;
  elsif p_status = 'failed' then
    if pay.reference_type = 'donation' then
      update public.donations set status = 'failed' where id = pay.reference_id and status = 'pending';
    end if;
  elsif p_status = 'refunded' then
    if pay.reference_type = 'donation' then
      update public.donations set status = 'refunded' where id = pay.reference_id;
    elsif pay.reference_type = 'order' then
      update public.shop_orders set status = 'cancelled' where id = pay.reference_id;
    end if;
  end if;

  return jsonb_build_object('result', 'applied', 'payment_id', pay.id, 'temple_id', pay.temple_id,
                            'user_id', pay.user_id, 'status', p_status,
                            'donation_id', don_id, 'receipt_id', rec_id);
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Notification outbox worker: claim due rows without two workers taking the same one.
-- ---------------------------------------------------------------------------------------
create or replace function public.claim_notifications(p_limit int default 50)
returns setof public.notification_log language sql security definer set search_path = '' as $$
  update public.notification_log n
     set status = 'sending', attempts = n.attempts + 1
   where n.id in (
     select id from public.notification_log
      where status = 'queued' and next_attempt_at <= now()
      order by next_attempt_at
      limit greatest(least(p_limit, 200), 1)
      for update skip locked)
  returning n.*;
$$;

-- Resolve an existing auth user by email (for admin-invite-staff); service role only.
create or replace function public.find_auth_user_by_email(p_email text)
returns uuid language sql stable security definer set search_path = '' as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

revoke all on function public.apply_payment_event(text, text, text, text, numeric, numeric, boolean) from public, anon, authenticated;
revoke all on function public.claim_notifications(int)           from public, anon, authenticated;
revoke all on function public.find_auth_user_by_email(text)      from public, anon, authenticated;
grant execute on function public.apply_payment_event(text, text, text, text, numeric, numeric, boolean) to service_role;
grant execute on function public.claim_notifications(int)      to service_role;
grant execute on function public.find_auth_user_by_email(text) to service_role;
grant execute on function public.issue_receipt_for_donation(uuid) to service_role;
grant execute on function public.allocate_receipt_number(uuid, int) to service_role;
