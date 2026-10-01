// Applies supabase/migrations/*.sql + seed.sql to an in-memory Postgres (PGlite) behind a shim of
// Supabase's auth schema, then asserts RLS behaviour with `set role`.
//   cd supabase/tests && npm i --no-save @electric-sql/pglite && node run-pglite.mjs
//   (or PGLITE_DIR=<dir containing node_modules/@electric-sql/pglite> node run-pglite.mjs)
// This proves the SQL is valid and the policies behave as written. It is NOT a live Supabase project.
import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const req = createRequire(
  process.env.PGLITE_DIR ? resolve(process.env.PGLITE_DIR, 'x.js') : resolve(here, 'x.js'),
)
const { PGlite } = await import(pathToFileURL(req.resolve('@electric-sql/pglite')).href)

const db = new PGlite()
const read = (p) => readFileSync(resolve(here, p), 'utf8')
await db.exec(read('supabase-shim.sql'))
for (const f of readdirSync(resolve(here, '../migrations')).filter((f) => f.endsWith('.sql')).sort()) {
  await db.exec(read('../migrations/' + f))
  console.log('applied', f)
}
await db.exec(read('../seed.sql'))
await db.exec(read('../seed.sql')) // must be idempotent
console.log('applied seed.sql (twice)')

let pass = 0
const failures = []
const check = (name, ok, extra = '') => {
  if (ok) pass++
  else failures.push(name + (extra ? ` -- ${extra}` : ''))
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : extra ? ' -- ' + extra : ''}`)
}

/** Run `sql` as role/user. Returns {rows} or {error}. */
async function as(role, uid, sql, params) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`)
  try {
    const r = await db.query(sql, params)
    return { rows: r.rows }
  } catch (e) {
    return { error: String(e.message) }
  } finally {
    await db.exec('reset role')
  }
}
const denied = (r) =>
  !!r.error && /row-level security|permission denied|only platform|not found or not changeable|42501/i.test(r.error)
const su = async (sql, p) => (await db.query(sql, p)).rows

// ---- fixtures
const T = Object.fromEntries((await su('select slug, id from temples')).map((r) => [r.slug, r.id]))
const mk = async (email) =>
  (
    await su('insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id', [
      email,
      JSON.stringify({ full_name: email.split('@')[0] }),
    ])
  )[0].id
const alice = await mk('alice@x.test')
const bob = await mk('bob@x.test')
const carol = await mk('carol@x.test')
const dave = await mk('dave@x.test')
const erin = await mk('erin@x.test')
const frank = await mk('frank@x.test')
const plat = await mk('plat@x.test')
const tadmin = await mk('tadmin@x.test')
await su(
  `insert into temple_members (temple_id, user_id, role) values
  ($1,$2,'finance'), ($1,$3,'priest'), ($4,$5,'finance'), ($1,$6,'committee'), ($1,$7,'admin')`,
  [T['sugar-land'], carol, dave, T['fremont'], erin, frank, tadmin],
)
await su('insert into platform_admins (user_id) values ($1)', [plat])

// ---- structure
const noRls = await su(`select tablename from pg_tables where schemaname='public' and not rowsecurity`)
check('RLS enabled on every public table', noRls.length === 0, noRls.map((r) => r.tablename).join(','))
const nTables = (await su(`select count(*)::int n from pg_tables where schemaname='public'`))[0].n
check(`schema has expected breadth (${nTables} tables)`, nTables >= 55)
check('seed: 6 demo temples', (await su('select count(*)::int n from temples'))[0].n === 6)
check('seed: 24 aarti slots', (await su('select count(*)::int n from aarti_slots'))[0].n === 24)
check(
  'new auth user gets profile + notification_prefs',
  (await su('select count(*)::int n from profiles p join notification_prefs n on n.user_id=p.id where p.id=$1', [alice]))[0].n === 1,
)
check('updated_at triggers installed', (await su(`select count(*)::int n from pg_trigger where tgname like 'trg_%_updated_at'`))[0].n > 30)
check('FK indexes created', (await su(`select count(*)::int n from pg_indexes where schemaname='public' and indexname like 'idx_%'`))[0].n > 60)

// ---- anon
check('anon reads active temples', (await as('anon', null, 'select id from temples')).rows?.length === 6)
check('anon reads aarti slots', (await as('anon', null, 'select id from aarti_slots')).rows?.length === 24)
check('anon cannot read profiles', denied(await as('anon', null, 'select id from profiles')))
check('anon cannot read donations', denied(await as('anon', null, 'select id from donations')))
check('anon cannot read prayer_requests table', denied(await as('anon', null, 'select id from prayer_requests')))
check('anon cannot read temple_payment_accounts', denied(await as('anon', null, 'select * from temple_payment_accounts')))
await su(`update temples set status='suspended' where slug='harrow'`)
check('anon does not see suspended temple', (await as('anon', null, 'select id from temples')).rows?.length === 5)
await su(`update temples set status='active' where slug='harrow'`)

// ---- bookings
const puja = (await su('select id from puja_catalog where temple_id=$1', [T['sugar-land']]))[0].id
const bIns = `insert into bookings (temple_id,user_id,puja_catalog_id,cadence,start_date,end_date,amount,currency) values ($1,$2,$3,'one-time','2026-10-01','2026-10-01',51,'USD') returning id`
const b1 = await as('authenticated', alice, bIns, [T['sugar-land'], alice, puja])
check('devotee creates own booking', !!b1.rows?.[0]?.id, b1.error)
check(
  'booking insert starts audit trail (submitted event)',
  (await su(`select count(*)::int n from approval_events where booking_id=$1 and action='submitted'`, [b1.rows[0].id]))[0].n === 1,
)
check('devotee cannot create a booking as someone else', denied(await as('authenticated', alice, bIns, [T['sugar-land'], bob, puja])))
check(
  'devotee cannot self-approve a booking',
  denied(
    await as(
      'authenticated',
      alice,
      `insert into bookings (temple_id,user_id,puja_catalog_id,cadence,start_date,end_date,amount,currency,status,approval_stage) values ($1,$2,$3,'one-time','2026-10-01','2026-10-01',51,'USD','active','scheduled')`,
      [T['sugar-land'], alice, puja],
    ),
  ),
)
check('other devotee cannot see the booking', (await as('authenticated', bob, 'select id from bookings')).rows?.length === 0)
check('owner sees booking', (await as('authenticated', alice, 'select id from bookings')).rows?.length === 1)
check('finance of same temple sees booking', (await as('authenticated', carol, 'select id from bookings')).rows?.length === 1)
check('priest of same temple sees booking', (await as('authenticated', dave, 'select id from bookings')).rows?.length === 1)
check('finance of ANOTHER temple cannot see booking', (await as('authenticated', erin, 'select id from bookings')).rows?.length === 0)
const up = (uid) =>
  as('authenticated', uid, `update bookings set approval_stage='committee-review' where id=$1 returning id`, [b1.rows[0].id])
check('finance can advance approval', (await up(carol)).rows?.length === 1)
check('priest cannot change approval stage', (await up(dave)).rows?.length === 0)
check('other-temple finance cannot change approval', (await up(erin)).rows?.length === 0)
check('devotee cannot update booking directly', (await up(alice)).rows?.length === 0)
check(
  'owner can cancel via set_my_booking_status',
  !(await as('authenticated', alice, `select set_my_booking_status($1,'cancelled')`, [b1.rows[0].id])).error,
)
check(
  'non-owner cannot change booking via set_my_booking_status',
  denied(await as('authenticated', bob, `select set_my_booking_status($1,'paused')`, [b1.rows[0].id])),
)

// ---- donations, receipts
const dIns = `insert into donations (temple_id,user_id,category,amount,currency) values ($1,$2,'general-hundi',108,'USD') returning id`
const d1 = await as('authenticated', alice, dIns, [T['sugar-land'], alice])
check('devotee records pending donation', !!d1.rows?.[0]?.id, d1.error)
check(
  'devotee cannot insert already-succeeded donation',
  denied(await as('authenticated', alice, `insert into donations (temple_id,user_id,category,amount,currency,status) values ($1,$2,'other',5,'USD','succeeded')`, [T['sugar-land'], alice])),
)
check(
  'devotee cannot set own fee',
  denied(await as('authenticated', alice, `insert into donations (temple_id,user_id,category,amount,currency,fee) values ($1,$2,'other',5,'USD',1)`, [T['sugar-land'], alice])),
)
check(
  'devotee cannot mark donation succeeded',
  (await as('authenticated', alice, `update donations set status='succeeded' where id=$1 returning id`, [d1.rows[0].id])).rows?.length === 0,
)
check('other devotee cannot read donation', (await as('authenticated', bob, 'select id from donations')).rows?.length === 0)
check('finance reads donation', (await as('authenticated', carol, 'select id from donations')).rows?.length === 1)
check('priest cannot read donations', (await as('authenticated', dave, 'select id from donations')).rows?.length === 0)
check('other-temple finance cannot read donation', (await as('authenticated', erin, 'select id from donations')).rows?.length === 0)
check(
  'devotee cannot insert payments',
  denied(await as('authenticated', alice, `insert into payments (temple_id,purpose,reference_type,reference_id,provider,amount,currency) values ($1,'donation','donation',$2,'stripe',1,'USD')`, [T['sugar-land'], d1.rows[0].id])),
)
check('devotee cannot call issue_receipt_for_donation', denied(await as('authenticated', alice, 'select issue_receipt_for_donation($1)', [d1.rows[0].id])))
check(
  'issue_receipt refuses non-succeeded donation',
  /receipts are issued for succeeded/.test((await as('service_role', null, 'select issue_receipt_for_donation($1)', [d1.rows[0].id])).error ?? ''),
)
await su(`update donations set status='succeeded' where id=$1`, [d1.rows[0].id])
const r1 = await as('service_role', null, 'select issue_receipt_for_donation($1) id', [d1.rows[0].id])
const r1b = await as('service_role', null, 'select issue_receipt_for_donation($1) id', [d1.rows[0].id])
check('service role issues receipt', !!r1.rows?.[0]?.id, r1.error)
check('receipt issuance is idempotent', r1.rows?.[0]?.id === r1b.rows?.[0]?.id)
const ins = async (t, u) =>
  (await su(`insert into donations (temple_id,user_id,category,amount,currency,status) values ($1,$2,'annadanam',25,'USD','succeeded') returning id`, [t, u]))[0].id
const d2 = await ins(T['sugar-land'], bob)
const d3 = await ins(T['fremont'], bob)
await as('service_role', null, 'select issue_receipt_for_donation($1)', [d2])
await as('service_role', null, 'select issue_receipt_for_donation($1)', [d3])
const nums = await su('select t.slug, r.number from receipts r join temples t on t.id=r.temple_id order by t.slug, r.seq')
const yr = new Date().getFullYear()
check(
  'receipt numbers sequential per temple/year',
  JSON.stringify(nums.map((n) => n.number)) === JSON.stringify([`SAI-${yr}-000001`, `SAI-${yr}-000001`, `SAI-${yr}-000002`]),
  JSON.stringify(nums),
)
check('receipt carries regime/amount/currency', (await su(`select count(*)::int n from receipts where regime='us-501c3' and amount=108 and currency='USD'`))[0].n === 1)
check('donor reads own receipt only', (await as('authenticated', alice, 'select id from receipts')).rows?.length === 1)
check('finance reads temple receipts', (await as('authenticated', carol, 'select id from receipts')).rows?.length === 2)
check('other-temple finance sees only own temple receipts', (await as('authenticated', erin, 'select id from receipts')).rows?.length === 1)
check('receipts not writable by devotee', denied(await as('authenticated', alice, `update receipts set amount=1`)))
check('audit_log captured donation/receipt writes', (await su(`select count(*)::int n from audit_log where entity in ('donations','receipts')`))[0].n >= 4)
check('devotee cannot read audit_log', (await as('authenticated', alice, 'select id from audit_log')).rows?.length === 0)
check('temple admin reads own-temple audit_log', (await as('authenticated', tadmin, 'select id from audit_log')).rows?.length > 0)

// ---- profiles & PII
check('devotee reads only own profile', (await as('authenticated', bob, 'select id from profiles')).rows?.map((r) => r.id).join() === bob)
check('finance sees profile of own-temple donor', (await as('authenticated', carol, 'select id from profiles where id=$1', [alice])).rows?.length === 1)
check('other-temple finance cannot see that donor profile', (await as('authenticated', erin, 'select id from profiles where id=$1', [alice])).rows?.length === 0)
check('devotee cannot update another profile', (await as('authenticated', bob, `update profiles set full_name='x' where id=$1 returning id`, [alice])).rows?.length === 0)
await as('authenticated', alice, `insert into tax_declarations (user_id, regime, gift_aid) values ($1,'uk-giftaid',true)`, [alice])
check('tax declaration visible to owner', (await as('authenticated', alice, 'select 1 from tax_declarations')).rows?.length === 1)
check('tax declaration hidden from other devotee', (await as('authenticated', bob, 'select 1 from tax_declarations')).rows?.length === 0)
check('PAN format enforced', !!(await as('authenticated', alice, `insert into tax_declarations (user_id, regime, pan) values ($1,'in-80g','nope')`, [alice])).error)
await as('authenticated', alice, `insert into family_members (user_id,name,relation) values ($1,'Kid','son')`, [alice])
check('family members isolated', (await as('authenticated', bob, 'select 1 from family_members')).rows?.length === 0)

// ---- privilege escalation
check('devotee cannot grant themselves staff role', denied(await as('authenticated', alice, `insert into temple_members (temple_id,user_id,role) values ($1,$2,'admin')`, [T['sugar-land'], alice])))
check('devotee cannot become platform admin', denied(await as('authenticated', alice, `insert into platform_admins (user_id) values ($1)`, [alice])))
check('temple admin can add staff to own temple', !(await as('authenticated', tadmin, `insert into temple_members (temple_id,user_id,role) values ($1,$2,'priest')`, [T['sugar-land'], bob])).error)
check('temple admin cannot add staff to another temple', denied(await as('authenticated', tadmin, `insert into temple_members (temple_id,user_id,role) values ($1,$2,'priest')`, [T['fremont'], bob])))
check('temple admin cannot suspend temple', denied(await as('authenticated', tadmin, `update temples set status='suspended' where slug='sugar-land'`)))
check('temple admin can edit own temple profile', (await as('authenticated', tadmin, `update temples set about='hello' where slug='sugar-land' returning id`)).rows?.length === 1)
check('temple admin cannot edit another temple', (await as('authenticated', tadmin, `update temples set about='hello' where slug='fremont' returning id`)).rows?.length === 0)
check('platform admin can change temple status', (await as('authenticated', plat, `update temples set status='active' where slug='pune' returning id`)).rows?.length === 1)
check('platform admin sees all bookings', (await as('authenticated', plat, 'select id from bookings')).rows?.length === 1)
check('temple_payment_accounts hidden from priest', (await as('authenticated', dave, 'select * from temple_payment_accounts')).rows?.length === 0)

// ---- community
const pr = await as('authenticated', alice, `insert into prayer_requests (temple_id,user_id,display_name,category,body,visibility) values ($1,$2,'A.','health','Please pray','public') returning id`, [T['sugar-land'], alice])
check('devotee posts pending prayer', !!pr.rows?.[0]?.id, pr.error)
check('pending prayer not on public feed', (await as('anon', null, 'select * from public_prayers')).rows?.length === 0)
check('committee approves prayer', (await as('authenticated', frank, `update prayer_requests set status='approved' where id=$1 returning id`, [pr.rows[0].id])).rows?.length === 1)
const feed = await as('anon', null, 'select * from public_prayers')
check('approved public prayer on anon feed', feed.rows?.length === 1)
check('public feed exposes no user_id', !!feed.rows?.[0] && !('user_id' in feed.rows[0]))
check('devotee cannot approve own prayer', (await as('authenticated', alice, `update prayer_requests set status='approved' where id=$1 returning id`, [pr.rows[0].id])).rows?.length === 0)
await as('authenticated', bob, `insert into prayer_counts (prayer_id,user_id) values ($1,$2)`, [pr.rows[0].id, bob])
check('prayer_count trigger increments', (await su('select prayer_count from prayer_requests where id=$1', [pr.rows[0].id]))[0].prayer_count === 1)
check('notification_prefs own only', (await as('authenticated', bob, 'select user_id from notification_prefs')).rows?.map((r) => r.user_id).join() === bob)
check('notification_log not writable by devotee', denied(await as('authenticated', alice, `insert into notification_log (channel,topic) values ('email','giving')`)))

// ---- webhook procedure (apply_payment_event)
const mkPay = async (refType, refId, amount, ref, extra = {}) =>
  (await su(
    `insert into payments (temple_id,user_id,purpose,reference_type,reference_id,provider,provider_ref,amount,currency,meta)
     values ($1,$2,'donation',$3,$4,'stripe',$5,$6,'USD',$7) returning id`,
    [T['sugar-land'], alice, refType, refId, ref, amount, JSON.stringify(extra)],
  ))[0].id
const d4 = (await su(`insert into donations (temple_id,user_id,category,amount,currency,is_recurring,recurring_cadence) values ($1,$2,'goshala',40,'USD',true,'monthly') returning id`, [T['sugar-land'], alice]))[0].id
await mkPay('donation', d4, 40, 'pi_test_1')
const ev = (id, ref, status, fee = 0, amount = null, renewal = false) =>
  as('service_role', null, 'select apply_payment_event($1,$2,$3,$4,$5,$6,$7) r', ['stripe', id, ref, status, fee, amount, renewal])
check('authenticated cannot call apply_payment_event', denied(await as('authenticated', alice, `select apply_payment_event('stripe','e0','pi_test_1','succeeded',0,40,false)`)))
check('unknown payment is reported (and event not recorded)', (await ev('evt_x', 'pi_nope', 'succeeded')).rows?.[0]?.r?.result === 'unknown-payment'
  && (await su(`select count(*)::int n from webhook_events where event_id='evt_x'`))[0].n === 0)
check('amount mismatch is refused', (await ev('evt_m', 'pi_test_1', 'succeeded', 0, 4)).rows?.[0]?.r?.result === 'amount-mismatch'
  && (await su('select status from donations where id=$1', [d4]))[0].status === 'pending')
const a1 = await ev('evt_1', 'pi_test_1', 'succeeded', 1.46, 40)
check('webhook marks donation succeeded + issues receipt', a1.rows?.[0]?.r?.result === 'applied' && !!a1.rows[0].r.receipt_id, a1.error)
check('fee recorded on payment + donation', (await su(`select d.fee::float f, p.fee::float pf from donations d join payments p on p.id=d.payment_id where d.id=$1`, [d4]))[0].f === 1.46)
check('redelivered webhook is a no-op (duplicate)', (await ev('evt_1', 'pi_test_1', 'succeeded', 1.46, 40)).rows?.[0]?.r?.result === 'duplicate'
  && (await su('select count(*)::int n from receipts where donation_id=$1', [d4]))[0].n === 1)
const a2 = await ev('evt_2', 'pi_test_1', 'succeeded', 1.46, 40, true)
check('recurring renewal clones donation + new receipt',
  a2.rows?.[0]?.r?.renewal === true && (await su(`select count(*)::int n from donations where category='goshala' and status='succeeded'`))[0].n === 2
  && (await su(`select count(distinct number)::int n from receipts where amount=40`))[0].n === 2)
check('refund event flips donation to refunded', ((await ev('evt_3', 'pi_test_1', 'refunded')).rows?.[0]?.r?.result === 'applied')
  && (await su('select status from donations where id=$1', [d4]))[0].status === 'refunded')
const ord = (await su(`insert into shop_orders (temple_id,user_id,ship_name,ship_line1,ship_city,ship_postcode,ship_country,subtotal,shipping_fee,total,currency)
  values ($1,$2,'A','1 St','Sugar Land','77479','US',20,5,25,'USD') returning id`, [T['sugar-land'], alice]))[0].id
await mkPay('order', ord, 25, 'pi_order_1')
check('order payment marks order paid + event', (await ev('evt_4', 'pi_order_1', 'succeeded', 0, 25)).rows?.[0]?.r?.result === 'applied'
  && (await su(`select status from shop_orders where id=$1`, [ord]))[0].status === 'paid'
  && (await su(`select count(*)::int n from shop_order_events where order_id=$1`, [ord]))[0].n === 1)
const drive = (await su(`insert into annadanam_drives (temple_id,title,date,meals_target,price_per_meal,currency) values ($1,'Thursday annadanam','2026-11-05',100,3,'USD') returning id`, [T['sugar-land']]))[0].id
await mkPay('annadanam_drive', drive, 30, 'pi_ann_1', { meals: 10, donorName: 'Alice' })
await ev('evt_5', 'pi_ann_1', 'succeeded', 0, 30)
check('annadanam payment records pledge and bumps meals_funded', (await su('select meals_funded from annadanam_drives where id=$1', [drive]))[0].meals_funded === 10)

// ---- notification outbox
await su(`insert into notification_log (channel,topic,to_address,subject,next_attempt_at) values ('email','giving','a@x.test','due', now() - interval '1 minute'), ('email','giving','b@x.test','later', now() + interval '1 hour')`)
const claimed = await as('service_role', null, 'select * from claim_notifications(10)')
check('claim_notifications takes only due rows and marks them sending', claimed.rows?.length === 1 && claimed.rows[0].status === 'sending' && claimed.rows[0].attempts === 1, claimed.error)
check('claim_notifications is not re-claimable', (await as('service_role', null, 'select * from claim_notifications(10)')).rows?.length === 0)

console.log(`\n${pass} passed, ${failures.length} failed`)
if (failures.length) {
  console.log('FAILURES:\n - ' + failures.join('\n - '))
  process.exit(1)
}
