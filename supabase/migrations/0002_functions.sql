-- Helpers, triggers, receipt numbering, indexes.
-- All SECURITY DEFINER functions pin search_path and are schema-qualified to avoid hijacking.

-- ============================================================ authorisation helpers

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;

-- True when the caller holds ANY of `roles` at `tid`. Platform admins pass everywhere
-- (global oversight — see docs/BACKEND.md "security notes").
create or replace function public.has_temple_role(tid uuid, roles text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_platform_admin()
      or exists (
        select 1 from public.temple_members m
        where m.temple_id = tid and m.user_id = (select auth.uid()) and m.role = any (roles)
      );
$$;

create or replace function public.is_temple_staff(tid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_temple_role(tid, array['admin','board','priest','finance','committee']);
$$;

-- True when `uid` is a devotee the caller's temples know about (booked, donated, enrolled,
-- follows as home temple) AND the caller holds one of `roles` at that temple.
-- Used to let staff see the minimum devotee PII their job needs, and nothing else.
create or replace function public.staff_sees_user(uid uuid, roles text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_platform_admin()
      or exists (
        select 1 from public.temple_members m
        where m.user_id = (select auth.uid()) and m.role = any (roles)
          and (
            exists (select 1 from public.profiles p where p.id = uid and p.home_temple_id = m.temple_id)
            or exists (select 1 from public.bookings b where b.user_id = uid and b.temple_id = m.temple_id)
            or exists (select 1 from public.donations d where d.user_id = uid and d.temple_id = m.temple_id)
            or exists (select 1 from public.vrat_enrollments v where v.user_id = uid and v.temple_id = m.temple_id)
          )
      );
$$;

-- ============================================================ generic triggers

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare r record;
begin
  for r in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.column_name = 'updated_at'
  loop
    execute format(
      'create trigger trg_%1$s_updated_at before update on public.%1$I
         for each row execute function public.set_updated_at()', r.table_name);
  end loop;
end $$;

-- Every single-column foreign key gets an index (Postgres does not create these itself).
do $$
declare r record;
begin
  for r in
    select c.conrelid::regclass::text as tbl, a.attname as col, c.conrelid as relid, a.attnum
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and cardinality(c.conkey) = 1
      and c.connamespace = 'public'::regnamespace
      and not exists (
        select 1 from pg_index i
        where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1]
      )
  loop
    execute format('create index if not exists %I on %s (%I)',
      'idx_' || replace(replace(r.tbl, 'public.', ''), '"', '') || '_' || r.col, r.tbl, r.col);
  end loop;
end $$;

-- Hot-path composite indexes.
create index idx_bookings_temple_stage   on public.bookings (temple_id, approval_stage, created_at desc);
create index idx_donations_temple_date   on public.donations (temple_id, created_at desc);
create index idx_donations_user_date     on public.donations (user_id, created_at desc);
create index idx_aarti_slots_temple_time on public.aarti_slots (temple_id, time);
create index idx_events_temple_date      on public.events (temple_id, date);
create index idx_notif_due               on public.notification_log (next_attempt_at) where status = 'queued';
create index idx_audit_temple_at         on public.audit_log (temple_id, at desc);
create index idx_payments_reference      on public.payments (reference_type, reference_id);

-- ============================================================ new user bootstrap

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  nm text := coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', ''), '');
begin
  insert into public.profiles (id, full_name, email, phone, avatar_initials)
  values (
    new.id, nm, new.email, new.phone,
    upper(left(coalesce(nullif(nm, ''), new.email, '?'), 1))
  )
  on conflict (id) do nothing;
  insert into public.notification_prefs (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================ maintained counters

create or replace function public.bump_prayer_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.prayer_requests set prayer_count = prayer_count + 1 where id = new.prayer_id;
  else
    update public.prayer_requests set prayer_count = greatest(prayer_count - 1, 0) where id = old.prayer_id;
  end if;
  return null;
end;
$$;
create trigger trg_prayer_counts_bump
  after insert or delete on public.prayer_counts
  for each row execute function public.bump_prayer_count();

create or replace function public.bump_meals_funded()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.annadanam_drives set meals_funded = meals_funded + new.meals where id = new.drive_id;
  elsif tg_op = 'DELETE' then
    update public.annadanam_drives set meals_funded = greatest(meals_funded - old.meals, 0) where id = old.drive_id;
  end if;
  return null;
end;
$$;
create trigger trg_pledges_meals
  after insert or delete on public.annadanam_pledges
  for each row execute function public.bump_meals_funded();

-- A new booking always starts its audit trail.
create or replace function public.booking_submitted_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.approval_events (booking_id, temple_id, actor_id, actor_name, actor_role, action)
  values (new.id, new.temple_id, new.user_id,
          coalesce((select full_name from public.profiles where id = new.user_id), ''),
          'devotee', 'submitted');
  return null;
end;
$$;
create trigger trg_bookings_submitted
  after insert on public.bookings
  for each row execute function public.booking_submitted_event();

-- ============================================================ audit trail

create or replace function public.audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  rec jsonb := to_jsonb(coalesce(new, old));
  tid uuid;
begin
  tid := case when rec ? 'temple_id' then (rec ->> 'temple_id')::uuid else null end;
  insert into public.audit_log (temple_id, actor_id, actor_role, action, entity, entity_id, detail)
  values (
    tid, (select auth.uid()), current_user, lower(tg_op), tg_table_name,
    coalesce(rec ->> 'id', rec ->> 'user_id'),
    case tg_op when 'UPDATE' then jsonb_build_object('before', to_jsonb(old) - 'pan', 'after', to_jsonb(new) - 'pan')
               else to_jsonb(coalesce(new, old)) - 'pan' end
  );
  return null;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['donations','bookings','receipts','payments','temple_members','platform_admins','tax_declarations','temple_payment_accounts']
  loop
    execute format('create trigger trg_%1$s_audit after insert or update or delete on public.%1$I
                      for each row execute function public.audit_row()', t);
  end loop;
end $$;

-- ============================================================ receipts

-- Atomically allocates the next receipt number for (temple, year).
-- `insert ... on conflict do update` takes a row lock, so concurrent callers serialise and
-- never see the same number. Gaps are possible if the caller's transaction rolls back AFTER
-- this returns; issue_receipt_for_donation() does both in one transaction so a rollback
-- also rolls the counter back (no gaps, which some regimes such as India 80G prefer).
create or replace function public.allocate_receipt_number(p_temple uuid, p_year int)
returns table (seq int, number text)
language plpgsql security definer set search_path = '' as $$
declare
  s int;
  pfx text;
begin
  select receipt_prefix into pfx from public.temples where id = p_temple;
  if pfx is null then raise exception 'unknown temple %', p_temple using errcode = 'P0002'; end if;

  insert into public.receipt_counters as rc (temple_id, year, last_seq)
  values (p_temple, p_year, 1)
  on conflict (temple_id, year) do update set last_seq = rc.last_seq + 1
  returning rc.last_seq into s;

  seq := s;
  number := pfx || '-' || p_year::text || '-' || lpad(s::text, 6, '0');
  return next;
end;
$$;

create or replace function public.category_label(c text)
returns text language sql immutable set search_path = '' as $$
  select case c
    when 'general-hundi' then 'General offering (hundi)'
    when 'annadanam'     then 'Annadanam'
    when 'puja'          then 'Puja sponsorship'
    when 'abhishekam'    then 'Abhishekam'
    when 'goshala'       then 'Goshala'
    when 'vedic-school'  then 'Vedic school'
    when 'building'      then 'Building fund'
    when 'event'         then 'Festival / event sponsorship'
    else 'Donation' end;
$$;

-- Issues (or returns the already-issued) receipt for a succeeded donation. Idempotent.
-- Declaration wording below is a STARTING POINT per regime and must be reviewed by the
-- temple's accountant before real receipts are issued (engineering default, not tax advice).
create or replace function public.issue_receipt_for_donation(p_donation uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  d   public.donations;
  t   public.temples;
  pr  public.profiles;
  alloc record;
  yr  int;
  rid uuid;
  decl text[];
  dname text;
begin
  select * into d from public.donations where id = p_donation for update;
  if not found then raise exception 'donation % not found', p_donation using errcode = 'P0002'; end if;
  if d.receipt_id is not null then return d.receipt_id; end if;
  if d.status <> 'succeeded' then
    raise exception 'donation % is % — receipts are issued for succeeded gifts only', p_donation, d.status
      using errcode = 'P0001';
  end if;

  select * into t from public.temples where id = d.temple_id;
  select * into pr from public.profiles where id = d.user_id;

  yr := extract(year from (now() at time zone t.timezone))::int;
  select * into alloc from public.allocate_receipt_number(t.id, yr);

  dname := coalesce(nullif(pr.full_name, ''), nullif(trim(coalesce(d.donor_first_name,'') || ' ' || coalesce(d.donor_last_name,'')), ''), 'Donor');

  decl := case t.tax_regime
    when 'us-501c3'   then array['No goods or services were provided in exchange for this contribution.']
    when 'in-80g'     then array['Receipt for donation eligible under section 80G, subject to the donor quoting a valid PAN and the temple''s 80G approval being current.']
    when 'uk-giftaid' then array[case when exists (select 1 from public.tax_declarations g where g.user_id = d.user_id and g.regime = 'uk-giftaid' and g.gift_aid)
                                      then 'Donor has declared this gift is eligible for Gift Aid.' else 'No Gift Aid declaration held for this gift.' end]
    when 'ca-cra'     then array['Official donation receipt for income tax purposes — confirm receipt-content requirements with the charity''s advisor.']
  end;

  insert into public.receipts (temple_id, user_id, donation_id, regime, year, seq, number, donor_name, donor_email,
                               donor_address, amount, currency, lines, temple_name, tax_id, tax_id_label, declarations)
  values (t.id, d.user_id, d.id, t.tax_regime, yr, alloc.seq, alloc.number, dname, coalesce(pr.email, d.donor_email),
          nullif(concat_ws(', ', pr.address, pr.city, pr.state, pr.zip), ''), d.amount, d.currency,
          jsonb_build_array(jsonb_build_object('description', public.category_label(d.category), 'amount', d.amount)),
          t.name, t.tax_id, t.tax_id_label, decl)
  returning id into rid;

  update public.donations set receipt_id = rid where id = d.id;
  return rid;
end;
$$;

-- Devotee-initiated pause/cancel without opening column-level UPDATE on bookings.
create or replace function public.set_my_booking_status(p_booking uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('paused','cancelled','active') then
    raise exception 'status % not allowed', p_status using errcode = '22023';
  end if;
  update public.bookings
     set status = p_status
   where id = p_booking and user_id = (select auth.uid())
     and status in ('active','paused','pending')
     and (p_status <> 'active' or status = 'paused');
  if not found then raise exception 'booking not found or not changeable' using errcode = 'P0002'; end if;
end;
$$;

-- Service-role-only: these mutate money-adjacent state.
revoke all on function public.allocate_receipt_number(uuid, int) from public, anon, authenticated;
revoke all on function public.issue_receipt_for_donation(uuid)   from public, anon, authenticated;
grant execute on function public.set_my_booking_status(uuid, text) to authenticated;
