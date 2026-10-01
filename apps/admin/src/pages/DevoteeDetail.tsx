import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Mail, MapPin, Phone, Save, SquarePen, Unlock } from 'lucide-react'
import type { FamilyMember, User } from '@/lib/data/types'
import { PageShell } from '@/components/layout/PageShell'
import { FamilyTreeEditor } from '@/components/shared/FamilyTreeEditor'
import { RoleBadge, StatusPill /*, TierBadge */ } from '@/components/shared/badges'
import { EmptyState, LoadingSkeleton } from '@/components/shared/states'
import { StatTile } from '@/components/shared/StatTile'
import { Avatar, Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { Sheet } from '@/components/ui/overlay'
import { Tabs } from '@/components/ui/tabs'
import { Table, TBody, TD, TH, THead, TR, TableWrap } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import {
  getDevoteeById,
  getFamilyTree,
  // getMembership, // Membership temporarily disabled
  getMyBookings,
  isRealisedBooking,
  listDonations,
  saveFamilyTree,
  updateDevotee,
} from '@/lib/data/api'
import { GOTHRAS, NAKSHATRAS, PUJA_BY_ID } from '@/lib/data/mock'
import { useAsync } from '@/lib/hooks'
import { fmtDate, money, titleCase } from '@/lib/utils'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'donations', label: 'Donations' },
  // Membership temporarily disabled
  // { key: 'membership', label: 'Membership' },
  { key: 'family', label: 'Family' },
  { key: 'notes', label: 'Notes' },
]

export default function DevoteeDetail() {
  const { id } = useParams<{ id: string }>()
  const { toast } = useToast()
  const [tab, setTab] = useState('overview')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<User | null>(null)
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [notes, setNotes] = useState(
    'Prefers a call over email. Family attends most Friday evening Lakshmi pujas.',
  )

  const { data, loading, refresh } = useAsync(
    async () =>
      Promise.all([
        getDevoteeById(id!),
        getMyBookings(id!),
        listDonations(id!),
        // getMembership(id!), // Membership temporarily disabled
        getFamilyTree(id!),
      ]),
    [id],
  )

  useEffect(() => {
    if (data?.[0]) setForm(data[0])
    // Family tree moved from index 4 to 3 when membership left the tuple above.
    if (data?.[3]) setMembers(data[3]!.members)
  }, [data])

  if (loading || !data) {
    return (
      <PageShell title="Devotee" description="Loading record…">
        <LoadingSkeleton variant="table" rows={5} />
      </PageShell>
    )
  }

  // Membership temporarily disabled — `membership` removed from the tuple above.
  const [user, bookings, donations, tree] = data

  if (!user) {
    return (
      <EmptyState
        title="No such devotee"
        detail="This record may have been merged or removed."
        action={
          <Link to="/devotees" className={buttonVariants({ size: 'sm' })}>
            Back to devotees
          </Link>
        }
      />
    )
  }

  const lifetime =
    donations.reduce((s, d) => s + d.amount, 0) +
    bookings.filter(isRealisedBooking).reduce((s, b) => s + b.amount, 0)
  const activeBookings = bookings.filter((b) => b.status === 'active')

  const save = async () => {
    if (!form) return
    await updateDevotee(user.id, form)
    await saveFamilyTree({
      id: tree?.id ?? `fam_${user.id}`,
      primaryUserId: user.id,
      members,
    })
    setEditing(false)
    toast('Devotee record updated', { detail: `${form.name}'s details were saved.` })
    refresh()
  }

  const set = (k: keyof User) => (e: { target: { value: string } }) =>
    setForm((f) => (f ? { ...f, [k]: e.target.value } : f))

  return (
    <PageShell
      back={{ to: '/devotees', label: 'All devotees' }}
      // The name, the badges and the avatar were in a hero card of their own, directly
      // under a page that had no title — so the record announced itself twice, once in
      // the browser tab and once in a box. It is the page title; it belongs in the
      // header, and the header is what stays put while the tabs below it scroll.
      title={
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <Avatar initials={user.avatarInitials} className="size-8 text-sm" />
          <span className="truncate">{user.name}</span>
          <RoleBadge role={user.role} />
          {/* Membership temporarily disabled */}
          {/* {membership ? <TierBadge tier={membership.tier} /> : null} */}
        </span>
      }
      description={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span className="inline-flex items-center gap-1.5">
            <Phone className="size-3.5" />
            {user.phone}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Mail className="size-3.5" />
            {user.email}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-3.5" />
            {user.city}, {user.state}
          </span>
        </span>
      }
      actions={
        <Button size="sm" onClick={() => setEditing(true)}>
          <SquarePen />
          Edit record
        </Button>
      }
      tabs={<Tabs items={TABS} value={tab} onChange={setTab} />}
    >
      {/* Membership tile is commented out below, so this row runs 3-up (was lg:grid-cols-4). */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile
          label="Lifetime contributions"
          value={money(lifetime)}
          sub="Donations + sponsorships"
          tone="leaf"
        />
        <StatTile
          label="Active pujas"
          value={activeBookings.length}
          sub={`${bookings.length} all time`}
          tone="brand"
        />
        <StatTile
          label="Donations"
          value={donations.length}
          sub={money(donations.reduce((s, d) => s + d.amount, 0))}
        />
        {/* Membership temporarily disabled */}
        {/* <StatTile
          label="Membership"
          value={membership ? titleCase(membership.tier) : 'None'}
          sub={membership ? `Expires ${fmtDate(membership.endDate, 'MMM yyyy')}` : 'Not enrolled'}
          tone="gold"
        /> */}
      </div>

      {tab === 'overview' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="font-serif text-lg text-ink">Identity</h2>
            <dl className="mt-3 divide-y divide-line text-base">
              {[
                ['Full name', user.name],
                ['Phone', user.phone],
                ['Email', user.email],
                ['Date of birth', user.dob ? fmtDate(user.dob) : '—'],
                // Nakshatra and gothra are optional: a row appears only when recorded.
                user.nakshatra ? ['Nakshatra', user.nakshatra] : null,
                user.gothra ? ['Gothra', user.gothra] : null,
                ['Country', user.country],
              ]
                .filter((row): row is string[] => row !== null)
                .map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card className="p-5">
            <h2 className="font-serif text-lg text-ink">Address</h2>
            <address className="mt-3 not-italic text-base leading-relaxed">
              {user.address}
              <br />
              {user.city}, {user.state} {user.zip}
              <br />
              {user.country}
            </address>
            <h2 className="mt-5 font-bold text-lg">Recent activity</h2>
            <ul className="mt-2 space-y-2 text-base">
              {[...bookings.slice(0, 3), ...[]].map((b) => (
                <li key={b.id} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-muted">
                    Sponsored {PUJA_BY_ID.get(b.pujaCatalogId)?.name}
                  </span>
                  <span className="shrink-0 text-sm text-muted">{fmtDate(b.createdAt)}</span>
                </li>
              ))}
              {donations.slice(0, 3).map((d) => (
                <li key={d.id} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-muted">
                    {money(d.amount)} to {titleCase(d.category)}
                  </span>
                  <span className="shrink-0 text-sm text-muted">{fmtDate(d.createdAt)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}

      {tab === 'bookings' ? (
        bookings.length === 0 ? (
          <EmptyState title="No bookings" detail="This devotee has not sponsored a puja yet." />
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <TR>
                  <TH>Puja</TH>
                  <TH>Cadence</TH>
                  <TH>Sankalpam</TH>
                  <TH>Period</TH>
                  <TH className="text-right">Amount</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {bookings.map((b) => (
                  <TR key={b.id} className="hover:bg-tint/40">
                    <TD className="font-medium">{PUJA_BY_ID.get(b.pujaCatalogId)?.name}</TD>
                    <TD>{titleCase(b.cadence)}</TD>
                    <TD className="max-w-[200px] truncate text-muted">
                      {b.sankalpamNames.join(', ')}
                    </TD>
                    <TD className="whitespace-nowrap text-muted">
                      {fmtDate(b.startDate, 'MMM yyyy')} – {fmtDate(b.endDate, 'MMM yyyy')}
                    </TD>
                    <TD className="text-right tabular-nums">{money(b.amount)}</TD>
                    <TD>
                      <StatusPill status={b.status} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        )
      ) : null}

      {tab === 'donations' ? (
        donations.length === 0 ? (
          <EmptyState title="No donations" detail="Nothing recorded against this devotee." />
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <TR>
                  <TH>Date</TH>
                  <TH>Fund</TH>
                  <TH>Method</TH>
                  <TH>Dedication</TH>
                  <TH>Receipt</TH>
                  <TH className="text-right">Amount</TH>
                </TR>
              </THead>
              <TBody>
                {donations.map((d) => (
                  <TR key={d.id} className="hover:bg-tint/40">
                    <TD className="whitespace-nowrap text-muted">{fmtDate(d.createdAt)}</TD>
                    <TD className="font-medium">{titleCase(d.category)}</TD>
                    <TD>{titleCase(d.paymentMethod)}</TD>
                    <TD className="max-w-[200px] truncate text-muted">{d.dedicatedTo ?? '—'}</TD>
                    <TD>
                      {d.taxReceiptId ? (
                        <Badge variant="leaf">Sent</Badge>
                      ) : (
                        <Badge variant="gold">Pending</Badge>
                      )}
                    </TD>
                    <TD className="text-right font-medium tabular-nums">{money(d.amount)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        )
      ) : null}

      {/* Membership temporarily disabled */}
      {/* {tab === 'membership' ? (
        <Card className="p-5">
          {membership ? (
            <dl className="divide-y divide-line text-base">
              {[
                ['Tier', titleCase(membership.tier)],
                ['Status', titleCase(membership.status)],
                ['Started', fmtDate(membership.startDate)],
                ['Renews / expires', fmtDate(membership.endDate)],
                ['Auto-renew', membership.autoRenew ? 'On' : 'Off'],
                ['Family plan', membership.familyPlan ? 'Yes' : 'No'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="text-muted">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <EmptyState
              title="Not a member"
              detail="This devotee has never enrolled in a membership tier."
              action={
                <Link to="/memberships" className={buttonVariants({ size: 'sm' })}>
                  Gift a membership
                </Link>
              }
            />
          )}
        </Card>
      ) : null} */}

      {tab === 'family' ? (
        <Card className="p-5">
          <h2 className="mb-3 font-bold text-lg">Family tree</h2>
          <FamilyTreeEditor members={members} onChange={setMembers} />
          <Button className="mt-4" onClick={save}>
            <Save />
            Save family tree
          </Button>
        </Card>
      ) : null}

      {tab === 'notes' ? (
        <Card className="p-5">
          <h2 className="font-serif text-lg text-ink">Office notes</h2>
          <p className="mt-1 text-sm text-muted">Internal only — never shown to the devotee.</p>
          <Textarea
            className="mt-3"
            rows={6}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <Button className="mt-3" onClick={() => toast('Note saved to the devotee record')}>
            <Save />
            Save note
          </Button>
        </Card>
      ) : null}

      <Sheet
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit devotee"
        description="Admins can change every field, including the phone number."
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button onClick={save}>
              <Save />
              Save changes
            </Button>
          </>
        }
      >
        {form ? (
          <div className="grid gap-4">
            <Field label="Full name" htmlFor="ad-name">
              <Input id="ad-name" value={form.name} onChange={set('name')} />
            </Field>
            <Field
              label={
                <span className="flex items-center gap-1.5">
                  Phone
                  <Unlock className="size-3 text-leaf-500" />
                </span>
              }
              htmlFor="ad-phone"
              hint="admin override"
            >
              <Input id="ad-phone" value={form.phone} onChange={set('phone')} />
            </Field>
            <Field label="Email" htmlFor="ad-email">
              <Input id="ad-email" type="email" value={form.email} onChange={set('email')} />
            </Field>
            <Field label="Street address" htmlFor="ad-addr">
              <Input id="ad-addr" value={form.address ?? ''} onChange={set('address')} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="City" htmlFor="ad-city">
                <Input id="ad-city" value={form.city ?? ''} onChange={set('city')} />
              </Field>
              <Field label="State" htmlFor="ad-state">
                <Input id="ad-state" value={form.state ?? ''} onChange={set('state')} />
              </Field>
              <Field label="ZIP" htmlFor="ad-zip">
                <Input id="ad-zip" value={form.zip ?? ''} onChange={set('zip')} />
              </Field>
            </div>
            <Field label="Nakshatra (optional)" htmlFor="ad-nak">
              <Select id="ad-nak" value={form.nakshatra ?? ''} onChange={set('nakshatra')}>
                <option value="">Not set</option>
                {NAKSHATRAS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Gothra (optional)" htmlFor="ad-got">
              <Select id="ad-got" value={form.gothra ?? ''} onChange={set('gothra')}>
                <option value="">Not set</option>
                {GOTHRAS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : null}
      </Sheet>
    </PageShell>
  )
}
