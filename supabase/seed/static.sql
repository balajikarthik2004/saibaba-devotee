
-- ---------------------------------------------------------------- platform content
-- Teaching text below is original paraphrase. Festival dates are deliberately NOT seeded:
-- each temple enters its own panchang-confirmed dates (festival_dates.verified = false until then).

insert into public.vrat_programs (key, name, weeks, weekday, summary, steps, katha_summary, udyapan_guidance) values
  ('nine-thursday', 'Nine-Thursday Sai Vrat', 9, 4,
   'A nine-week observance kept on Thursdays with simple worship, a light fast if health allows, and service to others.',
   '[{"title":"Begin on a Thursday","body":"Make a quiet resolve (sankalpa) and offer flowers and a lamp before Baba."},
     {"title":"Observe each week","body":"Read or hear a short Sai story, offer aarti, and share food with someone in need."},
     {"title":"Keep it unbroken","body":"If a week is missed, your temple can advise how to continue."}]'::jsonb,
   'A short reflection on faith and patience, read each week.',
   'On the ninth Thursday, conclude with aarti and feed or help others; ask your temple for its udyapan custom.')
on conflict (key) do nothing;

insert into public.parayan_plans (key, name, chapters, days, summary, schedule) values
  ('saptah', 'Sai Satcharitra in seven days', 51, 7,
   'Read the 51 chapters across a week (saptah).',
   '[{"day":1,"chapters":[1,2,3,4,5,6,7]},{"day":2,"chapters":[8,9,10,11,12,13,14]},{"day":3,"chapters":[15,16,17,18,19,20,21]},
     {"day":4,"chapters":[22,23,24,25,26,27,28]},{"day":5,"chapters":[29,30,31,32,33,34,35]},
     {"day":6,"chapters":[36,37,38,39,40,41,42]},{"day":7,"chapters":[43,44,45,46,47,48,49,50,51]}]'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------- per-temple defaults
-- The four daily aartis (times are demo defaults; each temple edits its own).
insert into public.aarti_slots (temple_id, key, name, time, description, sponsorable)
select t.id, s.key, s.name, s.time::time, s.descr, true
from public.temples t
cross join (values
  ('kakad',   'Kakad Aarti',   '05:30', 'Morning awakening of Baba'),
  ('madhyan', 'Madhyan Aarti', '12:00', 'Noon offering'),
  ('dhoop',   'Dhoop Aarti',   '18:00', 'Sunset lamp offering'),
  ('shej',    'Shej Aarti',    '20:00', 'Night aarti as Baba retires')
) as s(key, name, time, descr)
where t.is_demo
  and not exists (select 1 from public.aarti_slots a where a.temple_id = t.id and a.key = s.key);

insert into public.live_streams (temple_id)
select id from public.temples where is_demo on conflict do nothing;

insert into public.puja_catalog (temple_id, name, deity, type, base_price, currency, duration_min, default_cadence, description)
select t.id, 'Sai Abhishekam', 'Sai Baba', 'abhishekam',
       case t.currency when 'INR' then 1100 else 51 end, t.currency, 45, 'one-time',
       'Ritual bathing of Baba''s murti with your family''s sankalpam. Demo data.'
from public.temples t
where t.is_demo
  and not exists (select 1 from public.puja_catalog c where c.temple_id = t.id and c.name = 'Sai Abhishekam');

insert into public.daily_messages (temple_id, date, text, language) values
  (null, date '2026-01-01', 'Faith and patience: keep both, and keep walking.', 'en')
on conflict do nothing;

-- ---------------------------------------------------------------- how to create the first platform admin
-- After the person has signed in once (so auth.users has their row):
--   insert into public.platform_admins (user_id) select id from auth.users where email = 'you@example.org';
-- and a temple admin:
--   insert into public.temple_members (temple_id, user_id, role)
--   select t.id, u.id, 'admin' from public.temples t, auth.users u where t.slug = 'sugar-land' and u.email = 'you@example.org';
