-- Shree Saibaba platform — schema (Postgres 15, Supabase).
-- STATUS: applied and exercised against an in-memory Postgres (PGlite) with a shim of
-- Supabase's auth schema / roles (see supabase/tests/). UNTESTED AGAINST A LIVE SUPABASE PROJECT.
--
-- Conventions: uuid PKs (gen_random_uuid), timestamptz, money numeric(12,2) + currency char(3),
-- enums as CHECK constraints (cheaper to evolve than pg enums), every temple-scoped table has
-- temple_id. `legacy_id` keeps the mock-mode string id (e.g. tmp_sugarland) so seed data and
-- fixtures can be cross-referenced; the app never uses it as a key in supabase mode.

-- ============================================================ tenancy & identity

create table public.temples (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       text unique,
  slug            text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name            text not null,
  address         text not null default '',
  city            text not null default '',
  state           text not null default '',
  zip             text not null default '',
  country         char(2) not null check (country in ('US','IN','GB','CA')),
  phone           text not null default '',
  email           text not null default '',
  timezone        text not null default 'UTC',
  timings         jsonb not null default '{}'::jsonb,
  logo_url        text not null default '',
  deities         text[] not null default '{}',
  -- TempleTenantProfile
  currency        char(3) not null check (currency in ('USD','INR','GBP','CAD')),
  locale          text not null default 'en',
  languages       text[] not null default '{en}',
  tax_regime      text not null check (tax_regime in ('us-501c3','in-80g','uk-giftaid','ca-cra')),
  tax_id          text not null default '',
  tax_id_label    text not null default '',
  lat             double precision,
  lng             double precision,
  about           text not null default '',
  spaces          jsonb not null default '[]'::jsonb,
  payments        text[] not null default '{}',
  ships_to        text[] not null default '{}',
  status          text not null default 'onboarding' check (status in ('active','onboarding','suspended')),
  is_demo         boolean not null default false,
  brand_hex       text check (brand_hex is null or brand_hex ~ '^#[0-9a-fA-F]{6}$'),
  receipt_prefix  text not null default 'SAI' check (receipt_prefix ~ '^[A-Z0-9]{2,8}$'),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Connected payment account identifiers. Never publicly readable.
create table public.temple_payment_accounts (
  temple_id            uuid primary key references public.temples(id) on delete cascade,
  stripe_account_id    text,          -- Stripe Connect account (acct_...) if the temple has one
  stripe_mode          text not null default 'platform' check (stripe_mode in ('platform','connect')),
  razorpay_account_id  text,          -- Razorpay Route linked account (acc_...)
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- One row per authenticated human. id = auth.users.id (created by trigger in 0002).
create table public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  legacy_id            text unique,
  full_name            text not null default '',
  email                text,
  phone                text,
  country              text not null default 'US',
  city                 text,
  state                text,
  zip                  text,
  address              text,
  preferred_language   text not null default 'en',
  home_temple_id       uuid references public.temples(id) on delete set null,
  nakshatra            text,
  gothra               text,
  dob                  date,
  avatar_initials      text not null default '',
  -- consent record (engineering support for DPDP / UK GDPR; not legal advice)
  consent_privacy_at       timestamptz,
  consent_text_version     text,
  consent_email            boolean not null default false,
  consent_sms              boolean not null default false,
  consent_whatsapp         boolean not null default false,
  consent_recorded_at      timestamptz,
  deleted_at           timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table public.platform_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table public.temple_members (
  id          uuid primary key default gen_random_uuid(),
  temple_id   uuid not null references public.temples(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('admin','board','priest','finance','committee')),
  created_at  timestamptz not null default now(),
  unique (temple_id, user_id, role)
);

create table public.family_members (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  name             text not null,
  relation         text not null check (relation in ('spouse','son','daughter','parent','other')),
  nakshatra        text,
  gothra           text,
  is_adult_branch  boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.memberships (
  id          uuid primary key default gen_random_uuid(),
  temple_id   uuid not null references public.temples(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  tier        text not null check (tier in ('silver','gold','platinum')),
  start_date  date not null,
  end_date    date not null,
  auto_renew  boolean not null default false,
  family_plan boolean not null default false,
  status      text not null default 'active' check (status in ('active','expired','cancelled')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================ pujas, bookings, payments

create table public.puja_catalog (
  id               uuid primary key default gen_random_uuid(),
  temple_id        uuid not null references public.temples(id) on delete cascade,
  name             text not null,
  deity            text not null default '',
  type             text not null check (type in ('yearly','monthly','one-time','abhishekam','alangaram')),
  base_price       numeric(12,2) not null check (base_price >= 0),
  currency         char(3) not null check (currency in ('USD','INR','GBP','CAD')),
  duration_min     int not null default 30 check (duration_min > 0),
  default_cadence  text not null default 'one-time' check (default_cadence in ('daily','weekly','monthly','quarterly','yearly','one-time')),
  recurring_rule   text,
  description      text not null default '',
  image_url        text,
  add_ons          jsonb not null default '[]'::jsonb,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.bookings (
  id                   uuid primary key default gen_random_uuid(),
  temple_id            uuid not null references public.temples(id) on delete cascade,
  user_id              uuid not null references public.profiles(id) on delete restrict,
  puja_catalog_id      uuid not null references public.puja_catalog(id) on delete restrict,
  cadence              text not null check (cadence in ('daily','weekly','monthly','quarterly','yearly','one-time')),
  start_date           date not null,
  end_date             date not null,
  sankalpam_names      text[] not null default '{}',
  add_ons              text[] not null default '{}',
  amount               numeric(12,2) not null check (amount >= 0),
  currency             char(3) not null check (currency in ('USD','INR','GBP','CAD')),
  status               text not null default 'pending' check (status in ('pending','active','paused','completed','cancelled')),
  approval_stage       text not null default 'finance-review'
                         check (approval_stage in ('finance-review','payment-pending','committee-review','scheduled','declined')),
  payment_method       text check (payment_method in ('card','ach','zelle','check','cash')),
  payment_reference    text,
  payment_received_at  timestamptz,
  payment_verified_by  uuid references public.profiles(id),
  payment_verified_at  timestamptz,
  assigned_priest_id   uuid references public.profiles(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (end_date >= start_date)
);

create table public.approval_events (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings(id) on delete cascade,
  temple_id   uuid not null references public.temples(id) on delete cascade,
  at          timestamptz not null default now(),
  actor_id    uuid references public.profiles(id),
  actor_name  text not null default '',
  actor_role  text not null check (actor_role in ('devotee','admin','board','priest','finance','committee','platform')),
  action      text not null check (action in ('submitted','payment-verified','sent-back','resubmitted','declined','priest-assigned','priest-reassigned')),
  note        text
);

create table public.puja_occurrences (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null references public.bookings(id) on delete cascade,
  temple_id     uuid not null references public.temples(id) on delete cascade,
  scheduled_at  timestamptz not null,
  fulfilled_at  timestamptz,
  officiant     text,
  officiant_id  uuid references public.profiles(id),
  notes         text,
  status        text not null default 'scheduled' check (status in ('scheduled','completed','skipped')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Provider-side payments. Rows are created/updated ONLY by edge functions (service role).
create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  temple_id       uuid not null references public.temples(id) on delete cascade,
  user_id         uuid references public.profiles(id) on delete set null,
  purpose         text not null check (purpose in ('donation','sponsorship','shop','annadanam')),
  reference_type  text not null check (reference_type in ('booking','donation','order','annadanam_pledge')),
  reference_id    uuid not null,
  provider        text not null check (provider in ('stripe','razorpay','upi','zelle','ach','cheque','bank-transfer','cash')),
  provider_ref    text,                    -- PaymentIntent / order / subscription id
  amount          numeric(12,2) not null check (amount > 0),
  currency        char(3) not null check (currency in ('USD','INR','GBP','CAD')),
  fee             numeric(12,2) not null default 0 check (fee >= 0),
  status          text not null default 'pending' check (status in ('pending','requires-action','succeeded','failed','refunded')),
  recurring       text check (recurring in ('monthly','yearly')),
  payer_email     text,
  last_event_id   text,                    -- last webhook event applied
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (provider, provider_ref)
);

-- Every webhook event id ever processed, so redelivery is a no-op.
create table public.webhook_events (
  provider     text not null check (provider in ('stripe','razorpay')),
  event_id     text not null,
  received_at  timestamptz not null default now(),
  primary key (provider, event_id)
);

-- ============================================================ giving

create table public.receipt_counters (
  temple_id  uuid not null references public.temples(id) on delete cascade,
  year       int not null,
  last_seq   int not null default 0,
  primary key (temple_id, year)
);

create table public.receipts (
  id             uuid primary key default gen_random_uuid(),
  temple_id      uuid not null references public.temples(id) on delete cascade,
  user_id        uuid references public.profiles(id) on delete set null,
  donation_id    uuid,                     -- FK added after donations exists
  booking_id     uuid references public.bookings(id) on delete set null,
  regime         text not null check (regime in ('us-501c3','in-80g','uk-giftaid','ca-cra')),
  year           int not null,
  seq            int not null,
  number         text not null,
  issued_at      timestamptz not null default now(),
  donor_name     text not null,
  donor_email    text,
  donor_address  text,
  amount         numeric(12,2) not null check (amount >= 0),
  currency       char(3) not null check (currency in ('USD','INR','GBP','CAD')),
  lines          jsonb not null default '[]'::jsonb,
  temple_name    text not null,
  tax_id         text not null default '',
  tax_id_label   text not null default '',
  declarations   text[] not null default '{}',
  pdf_path       text,                     -- storage object path, if a PDF was rendered
  created_at     timestamptz not null default now(),
  unique (temple_id, year, seq),
  unique (temple_id, number)
);

create table public.donations (
  id                 uuid primary key default gen_random_uuid(),
  temple_id          uuid not null references public.temples(id) on delete cascade,
  user_id            uuid references public.profiles(id) on delete set null,
  donor_first_name   text,                 -- guest gifts only
  donor_last_name    text,
  donor_email        text,
  donor_phone        text,
  category           text not null check (category in ('general-hundi','annadanam','puja','abhishekam','goshala','vedic-school','building','event','other')),
  amount             numeric(12,2) not null check (amount > 0),
  currency           char(3) not null check (currency in ('USD','INR','GBP','CAD')),
  fee                numeric(12,2) not null default 0 check (fee >= 0),
  provider           text not null default 'stripe' check (provider in ('stripe','razorpay','upi','zelle','ach','cheque','bank-transfer','cash')),
  payment_method     text not null default 'card' check (payment_method in ('card','ach','zelle','check','cash')),
  payment_id         uuid references public.payments(id) on delete set null,
  status             text not null default 'pending' check (status in ('pending','succeeded','failed','refunded')),
  is_recurring       boolean not null default false,
  recurring_cadence  text check (recurring_cadence in ('daily','weekly','monthly','quarterly','yearly','one-time')),
  dedicated_to       text,
  event_id           uuid,                 -- FK added after events exists
  event_items        text[] not null default '{}',
  receipt_id         uuid references public.receipts(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (user_id is not null or donor_email is not null or donor_phone is not null)
);
alter table public.receipts add constraint receipts_donation_fk
  foreign key (donation_id) references public.donations(id) on delete set null;

create table public.tax_declarations (
  user_id               uuid not null references public.profiles(id) on delete cascade,
  regime                text not null check (regime in ('us-501c3','in-80g','uk-giftaid','ca-cra')),
  gift_aid              boolean,
  gift_aid_declared_at  timestamptz,
  pan                   text check (pan is null or pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),  -- India 80G; sensitive
  resident_status       text check (resident_status in ('resident','non-resident')),
  updated_at            timestamptz not null default now(),
  primary key (user_id, regime)
);

create table public.matching_gift_requests (
  id              uuid primary key default gen_random_uuid(),
  donation_id     uuid not null references public.donations(id) on delete cascade,
  temple_id       uuid not null references public.temples(id) on delete cascade,
  user_id         uuid references public.profiles(id) on delete set null,
  employer        text not null,
  status          text not null default 'submitted' check (status in ('submitted','verified','matched','declined')),
  matched_amount  numeric(12,2) check (matched_amount is null or matched_amount >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================ events, projects

create table public.events (
  id                uuid primary key default gen_random_uuid(),
  temple_id         uuid not null references public.temples(id) on delete cascade,
  slug              text not null,
  title             text not null,
  date              date not null,
  end_date          date,
  flyer_url         text,
  description       text not null default '',
  target_amount     numeric(12,2) not null default 0 check (target_amount >= 0),
  collected_amount  numeric(12,2) not null default 0 check (collected_amount >= 0),
  currency          char(3) not null check (currency in ('USD','INR','GBP','CAD')),
  sponsorships      jsonb not null default '[]'::jsonb,
  ticket_price      numeric(12,2) check (ticket_price is null or ticket_price >= 0),
  rsvp_count        int not null default 0 check (rsvp_count >= 0),
  status            text not null default 'upcoming' check (status in ('upcoming','ongoing','completed')),
  published         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (temple_id, slug)
);
alter table public.donations add constraint donations_event_fk
  foreign key (event_id) references public.events(id) on delete set null;

create table public.event_costs (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  temple_id  uuid not null references public.temples(id) on delete cascade,
  label      text not null,
  amount     numeric(12,2) not null check (amount >= 0)
);

create table public.projects (
  id             uuid primary key default gen_random_uuid(),
  temple_id      uuid not null references public.temples(id) on delete cascade,
  title          text not null,
  target_amount  numeric(12,2) not null default 0 check (target_amount >= 0),
  raised_amount  numeric(12,2) not null default 0 check (raised_amount >= 0),
  spent_amount   numeric(12,2) not null default 0 check (spent_amount >= 0),
  currency       char(3) not null check (currency in ('USD','INR','GBP','CAD')),
  status         text not null default 'planned' check (status in ('planned','in-progress','completed')),
  notes          text[] not null default '{}',
  is_public      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ============================================================ inventory

create table public.stock_items (
  id             uuid primary key default gen_random_uuid(),
  temple_id      uuid not null references public.temples(id) on delete cascade,
  name           text not null,
  category       text not null check (category in ('flowers','fruits','dairy','grains','dravyam','cloth','lamp','other')),
  unit           text not null check (unit in ('pc','kg','g','l','ml','bunch','packet','metre')),
  on_hand        numeric(12,3) not null default 0,
  reorder_level  numeric(12,3) not null default 0,
  unit_cost      numeric(12,2) not null default 0 check (unit_cost >= 0),
  currency       char(3) not null check (currency in ('USD','INR','GBP','CAD')),
  storage        text,
  perishable     boolean not null default false,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.stock_movements (
  id               uuid primary key default gen_random_uuid(),
  temple_id        uuid not null references public.temples(id) on delete cascade,
  item_id          uuid not null references public.stock_items(id) on delete cascade,
  kind             text not null check (kind in ('received','issued','adjusted','wastage')),
  qty              numeric(12,3) not null,
  balance          numeric(12,3) not null,
  puja_catalog_id  uuid references public.puja_catalog(id) on delete set null,
  occurrence_id    uuid references public.puja_occurrences(id) on delete set null,
  note             text,
  actor_id         uuid references public.profiles(id),
  actor_name       text not null default '',
  at               timestamptz not null default now()
);

create table public.requirement_sheets (
  id                uuid primary key default gen_random_uuid(),
  temple_id         uuid not null references public.temples(id) on delete cascade,
  puja_catalog_id   uuid not null references public.puja_catalog(id) on delete cascade,
  version           int not null default 1,
  estimated_cost    numeric(12,2) not null default 0,
  allocated_amount  numeric(12,2),
  allocation_note   text,
  stage             text not null default 'draft' check (stage in ('draft','finance-review','admin-review','approved','rejected','superseded')),
  prepared_by       uuid references public.profiles(id),
  prepared_by_name  text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (puja_catalog_id, version)
);

create table public.requirement_lines (
  id         uuid primary key default gen_random_uuid(),
  sheet_id   uuid not null references public.requirement_sheets(id) on delete cascade,
  temple_id  uuid not null references public.temples(id) on delete cascade,
  item_id    uuid not null references public.stock_items(id) on delete restrict,
  label      text not null,
  unit       text not null check (unit in ('pc','kg','g','l','ml','bunch','packet','metre')),
  qty        numeric(12,3) not null check (qty > 0),
  unit_cost  numeric(12,2) not null default 0,
  optional   boolean not null default false,
  note       text
);

create table public.requirement_events (
  id          uuid primary key default gen_random_uuid(),
  sheet_id    uuid not null references public.requirement_sheets(id) on delete cascade,
  temple_id   uuid not null references public.temples(id) on delete cascade,
  at          timestamptz not null default now(),
  actor_id    uuid references public.profiles(id),
  actor_name  text not null default '',
  actor_role  text not null,
  action      text not null check (action in ('drafted','submitted','allocated','sent-back','resubmitted','approved','rejected','superseded')),
  note        text
);

-- ============================================================ volunteers

create table public.volunteers (
  id          uuid primary key default gen_random_uuid(),
  temple_id   uuid not null references public.temples(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete set null,
  name        text not null,
  email       text,
  phone       text,
  city        text,
  skills      text[] not null default '{}',
  notes       text,
  status      text not null default 'active' check (status in ('active','paused')),
  joined_at   timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.volunteer_campaigns (
  id              uuid primary key default gen_random_uuid(),
  temple_id       uuid not null references public.temples(id) on delete cascade,
  event_id        uuid not null references public.events(id) on delete cascade,
  title           text not null,
  description     text not null default '',
  briefing_at     timestamptz,
  coordinator_id  uuid references public.profiles(id),
  needs           jsonb not null default '[]'::jsonb,
  status          text not null default 'draft' check (status in ('draft','recruiting','staffed','completed','cancelled')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.volunteer_messages (
  id             uuid primary key default gen_random_uuid(),
  temple_id      uuid not null references public.temples(id) on delete cascade,
  campaign_id    uuid not null references public.volunteer_campaigns(id) on delete cascade,
  channel        text not null check (channel in ('email','sms','both')),
  subject        text not null,
  body           text not null,
  recipient_ids  uuid[] not null default '{}',
  sent_at        timestamptz not null default now(),
  sent_by_name   text not null default '',
  audience       jsonb not null default '{}'::jsonb
);

create table public.volunteer_invites (
  id            uuid primary key default gen_random_uuid(),
  temple_id     uuid not null references public.temples(id) on delete cascade,
  campaign_id   uuid not null references public.volunteer_campaigns(id) on delete cascade,
  volunteer_id  uuid not null references public.volunteers(id) on delete cascade,
  message_id    uuid references public.volunteer_messages(id) on delete set null,
  channel       text not null check (channel in ('email','sms','both')),
  status        text not null default 'sent' check (status in ('sent','accepted','declined','no-response')),
  sent_at       timestamptz not null default now(),
  responded_at  timestamptz,
  note          text
);

create table public.volunteer_assignments (
  id            uuid primary key default gen_random_uuid(),
  temple_id     uuid not null references public.temples(id) on delete cascade,
  campaign_id   uuid not null references public.volunteer_campaigns(id) on delete cascade,
  volunteer_id  uuid not null references public.volunteers(id) on delete cascade,
  role_key      text not null,
  shift         text not null default '',
  status        text not null default 'pending' check (status in ('pending','confirmed','checked-in','no-show','withdrawn')),
  source        text not null check (source in ('invited','direct')),
  invite_id     uuid references public.volunteer_invites(id) on delete set null,
  note          text,
  added_at      timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================ aarti, darshan, festivals

create table public.aarti_slots (
  id               uuid primary key default gen_random_uuid(),
  temple_id        uuid not null references public.temples(id) on delete cascade,
  key              text not null check (key in ('kakad','madhyan','dhoop','shej','special')),
  name             text not null,
  time             time not null,                       -- temple-local wall clock
  days             smallint[] not null default '{0,1,2,3,4,5,6}',
  duration_min     int not null default 30 check (duration_min > 0),
  description      text not null default '',
  active           boolean not null default true,
  sponsorable      boolean not null default false,
  sponsor_puja_id  uuid references public.puja_catalog(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (days <@ array[0,1,2,3,4,5,6]::smallint[])
);

create table public.aarti_texts (
  id          uuid primary key default gen_random_uuid(),
  temple_id   uuid references public.temples(id) on delete cascade,   -- null = platform default
  key         text not null,
  title       text not null,
  language    text not null check (language in ('en','hi','mr','te','gu','ta','es')),
  script      text not null check (script in ('devanagari','latin','gujarati','telugu','tamil')),
  lines       text[] not null default '{}',
  source      text,
  audio_url   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.live_streams (
  temple_id            uuid primary key references public.temples(id) on delete cascade,
  provider             text not null default 'none' check (provider in ('youtube','vimeo','hls','facebook','none')),
  embed_url            text not null default '',
  is_live              boolean not null default false,
  started_at           timestamptz,
  replay_playlist_url  text,
  updated_at           timestamptz not null default now()
);

create table public.aarti_recordings (
  id            uuid primary key default gen_random_uuid(),
  temple_id     uuid not null references public.temples(id) on delete cascade,
  slot_key      text not null check (slot_key in ('kakad','madhyan','dhoop','shej','special')),
  date          date not null,
  title         text not null,
  url           text not null,
  duration_sec  int not null default 0 check (duration_sec >= 0),
  created_at    timestamptz not null default now()
);

create table public.festival_dates (
  id          uuid primary key default gen_random_uuid(),
  temple_id   uuid references public.temples(id) on delete cascade,  -- null = every temple
  key         text not null check (key in ('ram-navami','guru-purnima','vijayadashami','datta-jayanti','sai-jayanti','other')),
  name        text not null,
  date        date not null,
  end_date    date,
  note        text,
  verified    boolean not null default false,
  event_id    uuid references public.events(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================ vrat, parayan, teachings

create table public.vrat_programs (
  id                uuid primary key default gen_random_uuid(),
  key               text not null unique check (key in ('nine-thursday','eleven-thursday','custom')),
  name              text not null,
  weeks             int not null check (weeks > 0),
  weekday           smallint not null check (weekday between 0 and 6),
  summary           text not null default '',
  steps             jsonb not null default '[]'::jsonb,
  katha_summary     text not null default '',
  udyapan_guidance  text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.vrat_enrollments (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles(id) on delete cascade,
  temple_id          uuid not null references public.temples(id) on delete cascade,
  program_id         uuid not null references public.vrat_programs(id) on delete restrict,
  start_date         date not null,
  intention          text,
  observed_on        date[] not null default '{}',
  status             text not null default 'active' check (status in ('active','completed','paused','abandoned')),
  completed_at       timestamptz,
  reminder_channels  text[] not null default '{}',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table public.parayan_plans (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique check (key in ('saptah','chapter-a-day','custom')),
  name        text not null,
  chapters    int not null check (chapters > 0),
  days        int not null check (days > 0),
  summary     text not null default '',
  schedule    jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.parayan_groups (
  id                  uuid primary key default gen_random_uuid(),
  temple_id           uuid not null references public.temples(id) on delete cascade,
  name                text not null,
  description         text not null default '',
  start_date          date not null,
  created_by_user_id  uuid not null references public.profiles(id) on delete cascade,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.parayan_group_assignments (
  id        uuid primary key default gen_random_uuid(),
  group_id  uuid not null references public.parayan_groups(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  name      text not null,
  chapters  int[] not null default '{}',
  unique (group_id, user_id)
);

create table public.parayan_enrollments (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  plan_id        uuid not null references public.parayan_plans(id) on delete restrict,
  temple_id      uuid references public.temples(id) on delete set null,
  start_date     date not null,
  chapters_read  int[] not null default '{}',
  group_id       uuid references public.parayan_groups(id) on delete set null,
  status         text not null default 'active' check (status in ('active','completed','paused')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.leelas (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  summary       text not null,
  theme         text not null check (theme in ('faith-and-patience','compassion','unity','surrender','guru-grace','service')),
  language      text not null default 'en' check (language in ('en','hi','mr','te','gu','ta','es')),
  read_minutes  int not null default 3 check (read_minutes > 0),
  featured      boolean not null default false,
  published_at  timestamptz not null default now(),
  source        text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.daily_messages (
  id          uuid primary key default gen_random_uuid(),
  temple_id   uuid references public.temples(id) on delete cascade,   -- null = platform-wide
  date        date not null,
  text        text not null,
  language    text not null default 'en' check (language in ('en','hi','mr','te','gu','ta','es')),
  created_at  timestamptz not null default now(),
  unique nulls not distinct (temple_id, date, language)
);

-- ============================================================ shop & fulfilment

create table public.shop_items (
  id            uuid primary key default gen_random_uuid(),
  temple_id     uuid not null references public.temples(id) on delete cascade,
  key           text not null check (key in ('udi','prasad-box','book','photo','ring','other')),
  name          text not null,
  description   text not null default '',
  price         numeric(12,2) not null check (price >= 0),
  currency      char(3) not null check (currency in ('USD','INR','GBP','CAD')),
  weight_grams  int not null default 0 check (weight_grams >= 0),
  ships_to      text[] not null default '{}',
  active        boolean not null default true,
  stock         int check (stock is null or stock >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.shop_orders (
  id             uuid primary key default gen_random_uuid(),
  temple_id      uuid not null references public.temples(id) on delete cascade,
  user_id        uuid references public.profiles(id) on delete set null,
  -- Shipping address: PII. Staff of the temple and the buyer only.
  ship_name      text not null,
  ship_line1     text not null,
  ship_line2     text,
  ship_city      text not null,
  ship_region    text not null default '',
  ship_postcode  text not null,
  ship_country   char(2) not null check (ship_country in ('US','IN','GB','CA')),
  ship_phone     text not null default '',
  subtotal       numeric(12,2) not null check (subtotal >= 0),
  shipping_fee   numeric(12,2) not null default 0 check (shipping_fee >= 0),
  total          numeric(12,2) not null check (total >= 0),
  currency       char(3) not null check (currency in ('USD','INR','GBP','CAD')),
  status         text not null default 'placed' check (status in ('placed','paid','packed','shipped','delivered','held-customs','cancelled')),
  carrier        text,
  tracking       text,
  payment_id     uuid references public.payments(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (total = subtotal + shipping_fee)
);

create table public.shop_order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.shop_orders(id) on delete cascade,
  temple_id   uuid not null references public.temples(id) on delete cascade,
  item_id     uuid references public.shop_items(id) on delete set null,
  name        text not null,
  qty         int not null check (qty > 0),
  unit_price  numeric(12,2) not null check (unit_price >= 0)
);

create table public.shop_order_events (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.shop_orders(id) on delete cascade,
  temple_id  uuid not null references public.temples(id) on delete cascade,
  at         timestamptz not null default now(),
  status     text not null check (status in ('placed','paid','packed','shipped','delivered','held-customs','cancelled')),
  note       text
);

create table public.annadanam_drives (
  id              uuid primary key default gen_random_uuid(),
  temple_id       uuid not null references public.temples(id) on delete cascade,
  title           text not null,
  date            date not null,
  meals_target    int not null check (meals_target > 0),
  price_per_meal  numeric(12,2) not null check (price_per_meal > 0),
  currency        char(3) not null check (currency in ('USD','INR','GBP','CAD')),
  meals_funded    int not null default 0 check (meals_funded >= 0),   -- maintained by trigger
  menu_note       text not null default '',
  status          text not null default 'open' check (status in ('open','served','reported')),
  report          jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.annadanam_pledges (
  id            uuid primary key default gen_random_uuid(),
  drive_id      uuid not null references public.annadanam_drives(id) on delete cascade,
  temple_id     uuid not null references public.temples(id) on delete cascade,
  user_id       uuid references public.profiles(id) on delete set null,
  donor_name    text not null,
  meals         int not null check (meals > 0),
  amount        numeric(12,2) not null check (amount > 0),
  currency      char(3) not null check (currency in ('USD','INR','GBP','CAD')),
  dedicated_to  text,
  donation_id   uuid references public.donations(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- ============================================================ community

create table public.prayer_requests (
  id            uuid primary key default gen_random_uuid(),
  temple_id     uuid not null references public.temples(id) on delete cascade,
  user_id       uuid references public.profiles(id) on delete set null,
  display_name  text not null,
  category      text not null check (category in ('health','family','peace','gratitude','guidance','other')),
  body          text not null check (char_length(body) between 1 and 1000),
  visibility    text not null default 'temple' check (visibility in ('public','temple','private')),
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  prayer_count  int not null default 0 check (prayer_count >= 0),   -- maintained by trigger
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.prayer_counts (
  prayer_id   uuid not null references public.prayer_requests(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (prayer_id, user_id)
);

create table public.satsang_groups (
  id             uuid primary key default gen_random_uuid(),
  temple_id      uuid not null references public.temples(id) on delete cascade,
  name           text not null,
  kind           text not null check (kind in ('satsang','youth','bal-vikas','seniors','bhajan')),
  schedule       text not null default '',
  contact_name   text not null default '',
  contact_email  text not null default '',
  description    text not null default '',
  capacity       int check (capacity is null or capacity > 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.satsang_memberships (
  group_id    uuid not null references public.satsang_groups(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  temple_id   uuid not null references public.temples(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- ============================================================ notifications & audit

create table public.notification_prefs (
  user_id      uuid primary key references public.profiles(id) on delete cascade,
  channels     jsonb not null default '{"email":true,"sms":false,"whatsapp":false,"push":false}'::jsonb,
  topics       jsonb not null default '{"aarti":true,"vrat":true,"festival":true,"daily-message":false,"giving":true,"shipping":true,"volunteer":true}'::jsonb,
  quiet_from   time,
  quiet_to     time,
  timezone     text not null default 'UTC',
  updated_at   timestamptz not null default now()
);

-- Outbox + log. The `notify` edge function inserts 'queued' rows; a worker (same function,
-- invoked on a schedule) claims due rows, sends, and records the outcome.
create table public.notification_log (
  id               uuid primary key default gen_random_uuid(),
  temple_id        uuid references public.temples(id) on delete cascade,
  user_id          uuid references public.profiles(id) on delete set null,
  channel          text not null check (channel in ('email','sms','whatsapp','push')),
  topic            text not null check (topic in ('aarti','vrat','festival','daily-message','giving','shipping','volunteer')),
  to_address       text,              -- email / E.164; PII, staff & service only
  subject          text not null default '',
  body             text not null default '',
  template         text,
  status           text not null default 'queued' check (status in ('queued','sending','sent','failed','skipped')),
  skip_reason      text,              -- 'no-consent' | 'pref-off' | 'quiet-hours' ...
  attempts         int not null default 0,
  next_attempt_at  timestamptz not null default now(),
  last_error       text,
  provider_ref     text,
  dedupe_key       text unique,
  created_at       timestamptz not null default now(),
  sent_at          timestamptz
);

create table public.audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  temple_id   uuid references public.temples(id) on delete set null,
  actor_id    uuid,
  actor_role  text,
  action      text not null,
  entity      text not null,
  entity_id   text,
  detail      jsonb not null default '{}'::jsonb
);
