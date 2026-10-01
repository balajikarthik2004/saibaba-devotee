-- Row-level security. Default is DENY: RLS is enabled on every table first, then policies
-- open exactly what each audience needs. The service_role key (edge functions only) bypasses RLS.
--
-- Audiences:  anon (not signed in) · authenticated devotee (auth.uid()) · temple staff
--             (temple_members.role: admin/board/priest/finance/committee) · platform admin.
-- Role groups used below:
--   any staff ............ admin, board, priest, finance, committee
--   money ................ admin, finance                (write)    + board (read)
--   bookings/inventory ... admin, priest, committee     (priest: occurrences + stock)
--   community ............ admin, committee             (volunteers, annadanam, prayers, groups)

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ------------------------------------------------------------------ privilege baseline
-- RLS is the gate, but keep table privileges tight too (defence in depth).
revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
-- tables only the backend may write / read:
revoke all on public.webhook_events, public.receipt_counters from authenticated;
revoke insert, update, delete on public.payments, public.receipts, public.audit_log,
                                  public.notification_log from authenticated;
revoke insert, update, delete on public.temple_payment_accounts from authenticated;

-- public (anon) read surface: published / active content only, never PII columns.
grant select on public.temples, public.puja_catalog, public.events, public.event_costs,
                public.projects, public.aarti_slots, public.aarti_texts, public.live_streams,
                public.aarti_recordings, public.festival_dates, public.vrat_programs,
                public.parayan_plans, public.leelas, public.daily_messages, public.shop_items,
                public.annadanam_drives to anon;

-- ------------------------------------------------------------------ tenancy & identity

create policy temples_read on public.temples for select to anon, authenticated
  using (status = 'active' or public.is_temple_staff(id));
create policy temples_insert on public.temples for insert to authenticated
  with check (public.is_platform_admin());
create policy temples_update on public.temples for update to authenticated
  using (public.has_temple_role(id, array['admin'])) with check (public.has_temple_role(id, array['admin']));
create policy temples_delete on public.temples for delete to authenticated
  using (public.is_platform_admin());

-- Only platform staff may move a temple between onboarding / active / suspended.
create or replace function public.temples_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not public.is_platform_admin() then
    if new.status is distinct from old.status or new.is_demo is distinct from old.is_demo
       or new.receipt_prefix is distinct from old.receipt_prefix then
      raise exception 'only platform staff can change status, demo flag or receipt prefix' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_temples_guard before update on public.temples
  for each row execute function public.temples_guard();

create policy tpa_read on public.temple_payment_accounts for select to authenticated
  using (public.has_temple_role(temple_id, array['admin','finance']));
-- writes: service role / platform tooling only (no policy)

create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid())
         or public.staff_sees_user(id, array['admin','board','priest','finance','committee']));
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- no delete policy: erasure goes through an audited server-side routine (docs/BACKEND.md)

create policy platform_admins_read on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()) or public.is_platform_admin());
create policy platform_admins_write on public.platform_admins for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy members_read on public.temple_members for select to authenticated
  using (user_id = (select auth.uid()) or public.has_temple_role(temple_id, array['admin']));
create policy members_write on public.temple_members for all to authenticated
  using (public.has_temple_role(temple_id, array['admin']))
  with check (public.has_temple_role(temple_id, array['admin']));

create policy family_own on public.family_members for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy family_staff_read on public.family_members for select to authenticated
  using (public.staff_sees_user(user_id, array['admin','priest','committee']));

create policy memberships_read on public.memberships for select to authenticated
  using (user_id = (select auth.uid()) or public.has_temple_role(temple_id, array['admin','board','finance']));
create policy memberships_write on public.memberships for all to authenticated
  using (public.has_temple_role(temple_id, array['admin','finance']))
  with check (public.has_temple_role(temple_id, array['admin','finance']));

-- ------------------------------------------------------------------ pujas & bookings

create policy catalog_read on public.puja_catalog for select to anon, authenticated
  using ((active and exists (select 1 from public.temples t where t.id = temple_id and t.status = 'active'))
         or public.is_temple_staff(temple_id));
create policy catalog_write on public.puja_catalog for all to authenticated
  using (public.has_temple_role(temple_id, array['admin','committee']))
  with check (public.has_temple_role(temple_id, array['admin','committee']));

create policy bookings_read on public.bookings for select to authenticated
  using (user_id = (select auth.uid()) or public.is_temple_staff(temple_id));
-- A devotee can only open a booking in its initial state, for a puja of the same temple.
create policy bookings_insert on public.bookings for insert to authenticated
  with check (
    (user_id = (select auth.uid())
       and status = 'pending' and approval_stage = 'finance-review'
       and payment_verified_by is null and payment_verified_at is null and assigned_priest_id is null
       and exists (select 1 from public.puja_catalog c
                   where c.id = puja_catalog_id and c.temple_id = bookings.temple_id and c.active))
    or public.has_temple_role(temple_id, array['admin','finance'])
  );
create policy bookings_update on public.bookings for update to authenticated
  using (public.has_temple_role(temple_id, array['admin','finance','committee']))
  with check (public.has_temple_role(temple_id, array['admin','finance','committee']));
create policy bookings_delete on public.bookings for delete to authenticated
  using (public.has_temple_role(temple_id, array['admin']));

create policy approval_read on public.approval_events for select to authenticated
  using (public.is_temple_staff(temple_id)
         or exists (select 1 from public.bookings b where b.id = booking_id and b.user_id = (select auth.uid())));
-- append-only: no update/delete policies
create policy approval_insert on public.approval_events for insert to authenticated
  with check (
    (actor_id = (select auth.uid()) and public.has_temple_role(temple_id, array['admin','finance','committee']))
    or (actor_id = (select auth.uid()) and action = 'resubmitted' and actor_role = 'devotee'
        and exists (select 1 from public.bookings b where b.id = booking_id and b.user_id = (select auth.uid())))
  );

create policy occurrences_read on public.puja_occurrences for select to authenticated
  using (public.is_temple_staff(temple_id)
         or exists (select 1 from public.bookings b where b.id = booking_id and b.user_id = (select auth.uid())));
create policy occurrences_write on public.puja_occurrences for all to authenticated
  using (public.has_temple_role(temple_id, array['admin','committee','priest']))
  with check (public.has_temple_role(temple_id, array['admin','committee','priest']));

-- ------------------------------------------------------------------ money

create policy payments_read on public.payments for select to authenticated
  using (user_id = (select auth.uid()) or public.has_temple_role(temple_id, array['admin','finance','board']));

create policy receipts_read on public.receipts for select to authenticated
  using (user_id = (select auth.uid()) or public.has_temple_role(temple_id, array['admin','finance','board']));

create policy donations_read on public.donations for select to authenticated
  using (user_id = (select auth.uid()) or public.has_temple_role(temple_id, array['admin','finance','board']));
-- A devotee can only record a *pending* gift for themselves; success is set by the webhook.
create policy donations_insert on public.donations for insert to authenticated
  with check (
    (user_id = (select auth.uid()) and status = 'pending' and receipt_id is null
       and payment_id is null and fee = 0
       and exists (select 1 from public.temples t where t.id = temple_id and t.status = 'active'))
    or public.has_temple_role(temple_id, array['admin','finance'])   -- cash / cheque / hundi entry
  );
create policy donations_update on public.donations for update to authenticated
  using (public.has_temple_role(temple_id, array['admin','finance']))
  with check (public.has_temple_role(temple_id, array['admin','finance']));
-- no delete policy: financial records are immutable; refund = status change

create policy taxdecl_own on public.tax_declarations for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy taxdecl_staff_read on public.tax_declarations for select to authenticated
  using (public.staff_sees_user(user_id, array['admin','finance']));

create policy matching_read on public.matching_gift_requests for select to authenticated
  using (user_id = (select auth.uid()) or public.has_temple_role(temple_id, array['admin','finance','board']));
create policy matching_insert on public.matching_gift_requests for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'submitted'
              and exists (select 1 from public.donations d where d.id = donation_id and d.user_id = (select auth.uid())));
create policy matching_update on public.matching_gift_requests for update to authenticated
  using (public.has_temple_role(temple_id, array['admin','finance']))
  with check (public.has_temple_role(temple_id, array['admin','finance']));

-- ------------------------------------------------------------------ events & projects

create policy events_read on public.events for select to anon, authenticated
  using ((published and exists (select 1 from public.temples t where t.id = temple_id and t.status = 'active'))
         or public.is_temple_staff(temple_id));
create policy events_write on public.events for all to authenticated
  using (public.has_temple_role(temple_id, array['admin','committee']))
  with check (public.has_temple_role(temple_id, array['admin','committee']));

create policy event_costs_read on public.event_costs for select to anon, authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.published) or public.is_temple_staff(temple_id));
create policy event_costs_write on public.event_costs for all to authenticated
  using (public.has_temple_role(temple_id, array['admin','finance','committee']))
  with check (public.has_temple_role(temple_id, array['admin','finance','committee']));

create policy projects_read on public.projects for select to anon, authenticated
  using ((is_public and exists (select 1 from public.temples t where t.id = temple_id and t.status = 'active'))
         or public.has_temple_role(temple_id, array['admin','board','finance']));
create policy projects_write on public.projects for all to authenticated
  using (public.has_temple_role(temple_id, array['admin','finance']))
  with check (public.has_temple_role(temple_id, array['admin','finance']));

-- ------------------------------------------------------------------ inventory

create policy stock_items_read on public.stock_items for select to authenticated
  using (public.is_temple_staff(temple_id));
create policy stock_items_write on public.stock_items for all to authenticated
  using (public.has_temple_role(temple_id, array['admin','priest']))
  with check (public.has_temple_role(temple_id, array['admin','priest']));

create policy stock_mov_read on public.stock_movements for select to authenticated
  using (public.is_temple_staff(temple_id));
create policy stock_mov_insert on public.stock_movements for insert to authenticated
  with check (public.has_temple_role(temple_id, array['admin','priest']));   -- ledger: append-only

create policy reqsheets_read on public.requirement_sheets for select to authenticated
  using (public.is_temple_staff(temple_id));
create policy reqsheets_write on public.requirement_sheets for all to authenticated
  using (public.has_temple_role(temple_id, array['admin','priest','finance']))
  with check (public.has_temple_role(temple_id, array['admin','priest','finance']));

create policy reqlines_read on public.requirement_lines for select to authenticated
  using (public.is_temple_staff(temple_id));
create policy reqlines_write on public.requirement_lines for all to authenticated
  using (public.has_temple_role(temple_id, array['admin','priest']))
  with check (public.has_temple_role(temple_id, array['admin','priest']));

create policy reqevents_read on public.requirement_events for select to authenticated
  using (public.is_temple_staff(temple_id));
create policy reqevents_insert on public.requirement_events for insert to authenticated
  with check (actor_id = (select auth.uid()) and public.has_temple_role(temple_id, array['admin','priest','finance']));

-- ------------------------------------------------------------------ volunteers

create policy volunteers_read on public.volunteers for select to authenticated
  using (user_id = (select auth.uid()) or public.has_temple_role(temple_id, array['admin','committee','board']));
create policy volunteers_self_insert on public.volunteers for insert to authenticated
  with check ((user_id = (select auth.uid()) and status = 'active')
              or public.has_temple_role(temple_id, array['admin','committee']));
create policy volunteers_update on public.volunteers for update to authenticated
  using (public.has_temple_role(temple_id, array['admin','committee']))
  with check (public.has_temple_role(temple_id, array['admin','committee']));
create policy volunteers_delete on public.volunteers for delete to authenticated
  using (public.has_temple_role(temple_id, array['admin','committee']));

create policy vcampaigns_read on public.volunteer_campaigns for select to authenticated
  using (status in ('recruiting','staffed') or public.has_temple_role(temple_id, array['admin','committee','board']));
create policy vcampaigns_write on public.volunteer_campaigns for all to authenticated
  using (public.has_temple_role(temple_id, array['admin','committee']))
  with check (public.has_temple_role(temple_id, array['admin','committee']));

create policy vmessages_read on public.volunteer_messages for select to authenticated
  using (public.has_temple_role(temple_id, array['admin','committee','board']));
create policy vmessages_write on public.volunteer_messages for insert to authenticated
  with check (public.has_temple_role(temple_id, array['admin','committee']));

create policy vinvites_read on public.volunteer_invites for select to authenticated
  using (public.has_temple_role(temple_id, array['admin','committee','board'])
         or exists (select 1 from public.volunteers v where v.id = volunteer_id and v.user_id = (select auth.uid())));
create policy vinvites_staff_write on public.volunteer_invites for all to authenticated
  using (public.has_temple_role(temple_id, array['admin','committee']))
  with check (public.has_temple_role(temple_id, array['admin','committee']));
-- a volunteer answers their own invite (accept / decline only)
create policy vinvites_respond on public.volunteer_invites for update to authenticated
  using (exists (select 1 from public.volunteers v where v.id = volunteer_id and v.user_id = (select auth.uid())))
  with check (status in ('accepted','declined')
              and exists (select 1 from public.volunteers v where v.id = volunteer_id and v.user_id = (select auth.uid())));

create policy vassign_read on public.volunteer_assignments for select to authenticated
  using (public.has_temple_role(temple_id, array['admin','committee','board'])
         or exists (select 1 from public.volunteers v where v.id = volunteer_id and v.user_id = (select auth.uid())));
create policy vassign_write on public.volunteer_assignments for all to authenticated
  using (public.has_temple_role(temple_id, array['admin','committee']))
  with check (public.has_temple_role(temple_id, array['admin','committee']));

-- ------------------------------------------------------------------ aarti, darshan, festivals (public)

create policy aarti_slots_read on public.aarti_slots for select to anon, authenticated
  using ((active and exists (select 1 from public.temples t where t.id = temple_id and t.status = 'active'))
         or public.is_temple_staff(temple_id));
create policy aarti_slots_write on public.aarti_slots for all to authenticated
  using (public.has_temple_role(temple_id, array['admin','priest','committee']))
  with check (public.has_temple_role(temple_id, array['admin','priest','committee']));

-- temple_id null = platform default text: readable by all, writable by platform admins only
-- (has_temple_role(null, ...) reduces to is_platform_admin()).
create policy aarti_texts_read on public.aarti_texts for select to anon, authenticated using (true);
create policy aarti_texts_write on public.aarti_texts for all to authenticated
  using (public.has_temple_role(temple_id, array['admin','priest']))
  with check (public.has_temple_role(temple_id, array['admin','priest']));

create policy streams_read on public.live_streams for select to anon, authenticated
  using (exists (select 1 from public.temples t where t.id = temple_id and t.status = 'active') or public.is_temple_staff(temple_id));
create policy streams_write on public.live_streams for all to authenticated
  using (public.has_temple_role(temple_id, array['admin','priest','committee']))
  with check (public.has_temple_role(temple_id, array['admin','priest','committee']));

create policy recordings_read on public.aarti_recordings for select to anon, authenticated
  using (exists (select 1 from public.temples t where t.id = temple_id and t.status = 'active') or public.is_temple_staff(temple_id));
create policy recordings_write on public.aarti_recordings for all to authenticated
  using (public.has_temple_role(temple_id, array['admin','priest','committee']))
  with check (public.has_temple_role(temple_id, array['admin','priest','committee']));

create policy festivals_read on public.festival_dates for select to anon, authenticated using (true);
create policy festivals_write on public.festival_dates for all to authenticated
  using (public.has_temple_role(temple_id, array['admin','committee']))
  with check (public.has_temple_role(temple_id, array['admin','committee']));

-- ------------------------------------------------------------------ vrat, parayan, teachings

create policy vrat_programs_read on public.vrat_programs for select to anon, authenticated using (true);
create policy vrat_programs_write on public.vrat_programs for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy parayan_plans_read on public.parayan_plans for select to anon, authenticated using (true);
create policy parayan_plans_write on public.parayan_plans for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy leelas_read on public.leelas for select to anon, authenticated using (true);
create policy leelas_write on public.leelas for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy daily_read on public.daily_messages for select to anon, authenticated using (true);
create policy daily_write on public.daily_messages for all to authenticated
  using (public.has_temple_role(temple_id, array['admin','committee']))
  with check (public.has_temple_role(temple_id, array['admin','committee']));

create policy vrat_enr_own on public.vrat_enrollments for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy vrat_enr_staff on public.vrat_enrollments for select to authenticated
  using (public.has_temple_role(temple_id, array['admin','priest','committee']));

create policy par_enr_own on public.parayan_enrollments for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy par_enr_staff on public.parayan_enrollments for select to authenticated
  using (temple_id is not null and public.has_temple_role(temple_id, array['admin','priest','committee']));

create policy par_groups_read on public.parayan_groups for select to authenticated
  using (exists (select 1 from public.temples t where t.id = temple_id and t.status = 'active') or public.is_temple_staff(temple_id));
create policy par_groups_insert on public.parayan_groups for insert to authenticated
  with check (created_by_user_id = (select auth.uid()));
create policy par_groups_update on public.parayan_groups for update to authenticated
  using (created_by_user_id = (select auth.uid()) or public.has_temple_role(temple_id, array['admin','committee']))
  with check (created_by_user_id = (select auth.uid()) or public.has_temple_role(temple_id, array['admin','committee']));
create policy par_groups_delete on public.parayan_groups for delete to authenticated
  using (created_by_user_id = (select auth.uid()) or public.has_temple_role(temple_id, array['admin','committee']));

create policy par_assign_read on public.parayan_group_assignments for select to authenticated
  using (user_id = (select auth.uid())
         or exists (select 1 from public.parayan_groups g
                    where g.id = group_id
                      and (g.created_by_user_id = (select auth.uid())
                           or public.has_temple_role(g.temple_id, array['admin','committee']))));
create policy par_assign_write on public.parayan_group_assignments for all to authenticated
  using (exists (select 1 from public.parayan_groups g where g.id = group_id and g.created_by_user_id = (select auth.uid())))
  with check (exists (select 1 from public.parayan_groups g where g.id = group_id and g.created_by_user_id = (select auth.uid())));

-- ------------------------------------------------------------------ shop & fulfilment

create policy shop_items_read on public.shop_items for select to anon, authenticated
  using ((active and exists (select 1 from public.temples t where t.id = temple_id and t.status = 'active'))
         or public.is_temple_staff(temple_id));
create policy shop_items_write on public.shop_items for all to authenticated
  using (public.has_temple_role(temple_id, array['admin','committee']))
  with check (public.has_temple_role(temple_id, array['admin','committee']));

create policy orders_read on public.shop_orders for select to authenticated
  using (user_id = (select auth.uid()) or public.has_temple_role(temple_id, array['admin','finance','committee']));
create policy orders_insert on public.shop_orders for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'placed' and payment_id is null
              and carrier is null and tracking is null);
create policy orders_update on public.shop_orders for update to authenticated
  using (public.has_temple_role(temple_id, array['admin','finance','committee']))
  with check (public.has_temple_role(temple_id, array['admin','finance','committee']));

create policy order_items_read on public.shop_order_items for select to authenticated
  using (public.has_temple_role(temple_id, array['admin','finance','committee'])
         or exists (select 1 from public.shop_orders o where o.id = order_id and o.user_id = (select auth.uid())));
create policy order_items_insert on public.shop_order_items for insert to authenticated
  with check (exists (select 1 from public.shop_orders o
                      where o.id = order_id and o.user_id = (select auth.uid()) and o.status = 'placed'
                        and o.temple_id = shop_order_items.temple_id));

create policy order_events_read on public.shop_order_events for select to authenticated
  using (public.has_temple_role(temple_id, array['admin','finance','committee'])
         or exists (select 1 from public.shop_orders o where o.id = order_id and o.user_id = (select auth.uid())));
create policy order_events_insert on public.shop_order_events for insert to authenticated
  with check (public.has_temple_role(temple_id, array['admin','committee']));

create policy drives_read on public.annadanam_drives for select to anon, authenticated
  using (exists (select 1 from public.temples t where t.id = temple_id and t.status = 'active') or public.is_temple_staff(temple_id));
create policy drives_write on public.annadanam_drives for all to authenticated
  using (public.has_temple_role(temple_id, array['admin','committee']))
  with check (public.has_temple_role(temple_id, array['admin','committee']));

-- Pledges bump meals_funded via trigger, so a devotee cannot insert their own: the payment
-- function records the pledge after money clears.
create policy pledges_read on public.annadanam_pledges for select to authenticated
  using (user_id = (select auth.uid()) or public.has_temple_role(temple_id, array['admin','committee','finance']));
create policy pledges_write on public.annadanam_pledges for all to authenticated
  using (public.has_temple_role(temple_id, array['admin','committee','finance']))
  with check (public.has_temple_role(temple_id, array['admin','committee','finance']));

-- ------------------------------------------------------------------ community

create policy prayers_read on public.prayer_requests for select to authenticated
  using (user_id = (select auth.uid())
         or public.has_temple_role(temple_id, array['admin','committee'])
         or (status = 'approved' and visibility = 'public')
         or (status = 'approved' and visibility = 'temple'
             and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.home_temple_id = temple_id)));
create policy prayers_insert on public.prayer_requests for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending' and prayer_count = 0);
create policy prayers_moderate on public.prayer_requests for update to authenticated
  using (public.has_temple_role(temple_id, array['admin','committee']))
  with check (public.has_temple_role(temple_id, array['admin','committee']));
create policy prayers_delete on public.prayer_requests for delete to authenticated
  using (user_id = (select auth.uid()) or public.has_temple_role(temple_id, array['admin','committee']));

-- Public feed without user ids: anon reads this view, never the table. The view runs with its
-- owner's rights on purpose; its WHERE clause is the whole access rule.
create view public.public_prayers as
  select id, temple_id, display_name, category, body, prayer_count, created_at
  from public.prayer_requests
  where status = 'approved' and visibility = 'public';
grant select on public.public_prayers to anon, authenticated;

create policy prayer_counts_own on public.prayer_counts for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.prayer_requests r where r.id = prayer_id));

create policy satsang_read on public.satsang_groups for select to authenticated
  using (exists (select 1 from public.temples t where t.id = temple_id and t.status = 'active') or public.is_temple_staff(temple_id));
create policy satsang_write on public.satsang_groups for all to authenticated
  using (public.has_temple_role(temple_id, array['admin','committee']))
  with check (public.has_temple_role(temple_id, array['admin','committee']));

create policy satsang_mem_own on public.satsang_memberships for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy satsang_mem_staff on public.satsang_memberships for select to authenticated
  using (public.has_temple_role(temple_id, array['admin','committee']));

-- ------------------------------------------------------------------ notifications & audit

create policy prefs_own on public.notification_prefs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy notiflog_read on public.notification_log for select to authenticated
  using (user_id = (select auth.uid()) or public.has_temple_role(temple_id, array['admin','committee']));

create policy audit_read on public.audit_log for select to authenticated
  using (public.is_platform_admin() or (temple_id is not null and public.has_temple_role(temple_id, array['admin','board'])));
