import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  CalendarDays,
  Coins,
  Download,
  Flame,
  // Heart, // Membership temporarily disabled
  ReceiptText,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useT } from '@saibaba/core'
import { StatTile } from '@/components/shared/StatTile'
import { NextInYourNameTile } from '@/components/devotee/NextInYourNameTile'
import { ParayanProgressTile, VratProgressTile } from '@/features/devotion/widgets'
import { DeityArt } from '@/components/shared/DeityArt'
import { EmptyState, LoadingSkeleton } from '@/components/shared/states'
// Membership temporarily disabled
// import { StatusPill, TierBadge } from '@/components/shared/badges'
import { Avatar } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TBody, TD, TH, THead, TR, TableWrap } from '@/components/ui/table'
import { buttonVariants } from '@/components/ui/button'
import {
  // getMembership, // Membership temporarily disabled
  getMyBookings,
  getUpcomingOccurrences,
  listDonations,
  listEvents,
} from '@/lib/data/api'
import { PUJA_BY_ID } from '@/lib/data/mock'
import { useAuthStore } from '@/lib/store/auth'
import { useAsync } from '@/lib/hooks'
import { cn, fmtDate, titleCase, useMoney } from '@/lib/utils'
import { TEMPLE_BY_ID } from '@/lib/data/mock'

/* ------------------------------------------------------------------ helpers */

/** Small fact chip under the greeting — home temple, member-since (and gothra/nakshatra if shared). */
function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 rounded-full border border-line bg-card px-2.5 py-1 text-[12.5px] leading-none">
      <span className="text-[11px] uppercase tracking-[0.08em] text-muted">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </span>
  )
}

/**
 * Every card on this page opens the same way: an icon, a title, one link out. Doing it
 * in one component is what keeps the four of them reading as a set rather than as four
 * separate ideas that happen to share a page.
 */
function SectionHead({
  Icon,
  title,
  to,
  linkLabel,
}: {
  Icon: LucideIcon
  title: string
  to: string
  linkLabel: string
}) {
  return (
    <CardHeader className="flex-row items-center justify-between gap-3 pb-3.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-tint text-brand-500 ring-1 ring-inset ring-line">
          <Icon className="size-[15px]" />
        </span>
        <CardTitle className="truncate">{title}</CardTitle>
      </div>
      <Link
        to={to}
        className="group inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-brand-500 transition-colors hover:text-brand-600"
      >
        {linkLabel}
        <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-px group-hover:translate-x-px" />
      </Link>
    </CardHeader>
  )
}

/* -------------------------------------------------------------------- page */

export default function Dashboard() {
  const t = useT()
  const money = useMoney()
  const user = useAuthStore((s) => s.user)!

  const { data, loading } = useAsync(
    async () =>
      Promise.all([
        getMyBookings(user.id),
        listDonations(user.id),
        getUpcomingOccurrences(user.id, 30),
        // getMembership(user.id), // Membership temporarily disabled
        listEvents('upcoming'),
      ]),
    [user.id],
  )

  const firstName = user.name.split(' ')[0]

  if (loading || !data) {
    return (
      <>
        <div className="mb-6">
          <h1 className="font-serif text-[28px] leading-tight text-ink">{t('dash.greeting', 'Sai Ram, {name}', { name: firstName ?? '' })}</h1>
          <p className="mt-1 text-[13.5px] text-muted">{t('dash.loading', 'Loading your temple year…')}</p>
        </div>
        <LoadingSkeleton variant="tiles" rows={6} />
      </>
    )
  }

  // Membership temporarily disabled — `membership` removed from the tuple above.
  const [bookings, donations, occurrences, events] = data
  const activeBookings = bookings.filter((b) => b.status === 'active')
  const thisYear = new Date().getFullYear()

  const giftsThisYear = donations.filter((d) => new Date(d.createdAt).getFullYear() === thisYear)
  const ytd = giftsThisYear.reduce((s, d) => s + d.amount, 0)
  const lifetime =
    donations.reduce((s, d) => s + d.amount, 0) +
    bookings.filter((b) => b.status !== 'cancelled').reduce((s, b) => s + b.amount, 0)

  const in30 = Date.now() + 30 * 86400000
  const eventsSoon = events.filter((e) => new Date(e.date).getTime() <= in30)

  const nextOcc = occurrences[0]
  const nextBooking = nextOcc ? bookings.find((b) => b.id === nextOcc.bookingId) : undefined
  const nextPuja = nextBooking ? PUJA_BY_ID.get(nextBooking.pujaCatalogId) : undefined

  const nextByBooking = new Map<string, (typeof occurrences)[number]>()
  for (const o of occurrences)
    if (!nextByBooking.has(o.bookingId)) nextByBooking.set(o.bookingId, o)

  return (
    <>
      {/* Greeting. The avatar and fact chips replace the old run-on subtitle, so nakshatra
          and gothra can be read at a glance instead of picked out of a dotted line. */}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-4">
        <div className="flex min-w-0 items-start gap-3.5">
          <Avatar initials={user.avatarInitials} className="mt-1 size-12 text-[16px]" />
          <div className="min-w-0">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-muted">
              {fmtDate(new Date(), 'EEEE, MMMM d')}
            </p>
            <h1 className="mt-0.5 font-serif text-[28px] leading-tight text-ink">
              {t('dash.greeting', 'Sai Ram, {name}', { name: firstName ?? '' })}
            </h1>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {user.homeTempleId && TEMPLE_BY_ID.get(user.homeTempleId) ? (
                <Chip
                  label={t('dash.homeTemple', 'Home temple')}
                  value={TEMPLE_BY_ID.get(user.homeTempleId)!.city}
                />
              ) : null}
              {user.gothra ? <Chip label={t('sankalpam.gothra', 'Gothra')} value={user.gothra} /> : null}
              {user.nakshatra ? (
                <Chip label={t('sankalpam.nakshatra', 'Nakshatra')} value={user.nakshatra} />
              ) : null}
              <Chip label={t('dash.memberSince', 'Devotee since')} value={fmtDate(user.createdAt, 'yyyy')} />
              {/* Membership temporarily disabled */}
              {/* {membership ? <TierBadge tier={membership.tier} /> : null} */}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link to="/puja" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            <Flame />
            {t('home.sponsorPuja', 'Sponsor a puja')}
          </Link>
          <Link to="/donate" className={buttonVariants({ size: 'sm' })}>
            {t('nav.donate', 'Donate')}
          </Link>
        </div>
      </header>

      {/* What's next comes first — a devotee opens this page to check a date, not a total. */}
      <NextInYourNameTile
        occurrence={nextOcc}
        puja={nextPuja}
        names={nextBooking?.sankalpamNames}
        className="mb-5"
      />

      {/* Four numbers, not six. Lifetime giving and "upcoming events" were noise here —
          the first duplicates the YTD figure, the second belongs on the calendar. */}
      {/* Membership tile is commented out below, so this row runs 3-up (was lg:grid-cols-4). */}
      <div className="mb-5 grid gap-3.5 sm:grid-cols-2">
        <VratProgressTile />
        <ParayanProgressTile />
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile
          label={t('dash.givenIn', 'Given in {year}', { year: thisYear })}
          value={money(ytd)}
          sub={t('dash.lifetime', '{amount} lifetime', { amount: money(lifetime) })}
          Icon={Wallet}
          tone="leaf"
        />
        <StatTile
          label={t('dash.activePujas', 'Active pujas')}
          value={activeBookings.length}
          sub={t('dash.allTime', '{n} sponsored all time', { n: bookings.length })}
          Icon={Flame}
          tone="brand"
        />
        <StatTile
          label={t('dash.festivalsAhead', 'Festivals ahead')}
          value={eventsSoon.length}
          sub={t('dash.next30', 'In the next 30 days')}
          Icon={CalendarDays}
        />
        {/* Membership temporarily disabled */}
        {/* <StatTile
          label="Membership"
          value={membership ? titleCase(membership.tier) : 'None'}
          sub={
            membership ? (
              <span className="inline-flex items-center gap-1.5">
                Renews {fmtDate(membership.endDate, 'MMM yyyy')}
                <StatusPill status={membership.status} />
              </span>
            ) : (
              <Link to="/membership" className="font-medium text-brand-500 hover:underline">
                Join a tier →
              </Link>
            )
          }
          Icon={Heart}
          tone="gold"
        /> */}
      </div>

      {/* Two columns that flow independently. A short pujas table should not leave a well
          of white space above the donations card just because the events list runs long. */}
      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="flex min-w-0 flex-col gap-5">
          <Card className="min-w-0 overflow-hidden">
            <SectionHead
              Icon={Flame}
              title={t('dash.myPujas', 'My yearly pujas')}
              to="/my/pujas"
              linkLabel={t('dash.manageAll', 'Manage all')}
            />
            {activeBookings.length === 0 ? (
              <div className="p-5 pt-0">
                <EmptyState
                  Icon={Flame}
                  title={t('dash.noPujas', 'No active sponsorships')}
                  detail={t('dash.noPujasD', 'Sponsor a yearly puja and your family’s names will be offered at every occurrence.')}
                  action={
                    <Link to="/puja/yearly" className={buttonVariants({ size: 'sm' })}>
                      {t('dash.browse', 'Browse yearly pujas')}
                    </Link>
                  }
                />
              </div>
            ) : (
              <TableWrap className="rounded-none border-0 border-t border-line shadow-none">
                <Table>
                  <THead>
                    <TR>
                      <TH className="pl-5">{t('dash.colPuja', 'Puja')}</TH>
                      <TH>{t('dash.colName', 'In whose name')}</TH>
                      <TH>{t('dash.colHow', 'How often')}</TH>
                      <TH className="pr-5">{t('dash.colNext', 'Next date')}</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {activeBookings.slice(0, 6).map((b) => {
                      const puja = PUJA_BY_ID.get(b.pujaCatalogId)
                      const next = nextByBooking.get(b.id)
                      return (
                        <TR key={b.id} className="hover:bg-tint/50">
                          <TD className="py-3 pl-5">
                            <div className="flex items-center gap-2.5">
                              {puja ? (
                                <DeityArt
                                  deity={puja.deity}
                                  label=""
                                  className="size-9 shrink-0 rounded-full ring-1 ring-line"
                                />
                              ) : null}
                              <div className="min-w-0">
                                <p className="truncate font-medium text-ink">{puja?.deity}</p>
                                <p className="truncate text-[12px] text-muted">{puja?.name}</p>
                              </div>
                            </div>
                          </TD>
                          {/* One name plus a count, not a chopped-off list — "Balaji f…"
                              tells a devotee nothing that the full list would. */}
                          <TD className="py-3 text-muted" title={b.sankalpamNames.join(', ')}>
                            <span className="flex items-center gap-1.5">
                              <span className="max-w-[150px] truncate">{b.sankalpamNames[0]}</span>
                              {b.sankalpamNames.length > 1 ? (
                                <span className="shrink-0 rounded-full bg-tint px-1.5 text-[11px] font-medium text-muted">
                                  +{b.sankalpamNames.length - 1}
                                </span>
                              ) : null}
                            </span>
                          </TD>
                          <TD className="py-3">{titleCase(b.cadence)}</TD>
                          <TD className="whitespace-nowrap py-3 pr-5 font-medium">
                            {next ? fmtDate(next.scheduledAt, 'MMM d') : '—'}
                          </TD>
                        </TR>
                      )
                    })}
                  </TBody>
                </Table>
              </TableWrap>
            )}
          </Card>

          <Card className="min-w-0 overflow-hidden">
            <SectionHead
              Icon={Coins}
              title={t('dash.recentDonations', 'Recent donations')}
              to="/my/donations"
              linkLabel={t('nav.myDonations', 'My Donations')}
            />
            {donations.length === 0 ? (
              <div className="p-5 pt-0">
                <EmptyState
                  Icon={Coins}
                  title={t('dash.noDonations', 'No donations yet')}
                  detail={t('dash.noDonationsD', 'Your giving history will appear here.')}
                />
              </div>
            ) : (
              <>
                <ul className="divide-y divide-line border-t border-line">
                  {donations.slice(0, 5).map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-tint/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-medium text-ink">
                          {titleCase(d.category)}
                        </p>
                        <p className="truncate text-[12px] text-muted">
                          {fmtDate(d.createdAt)} · {titleCase(d.paymentMethod)}
                          {d.isRecurring ? ` · ${t('dash.recurring', 'recurring')} ${d.recurringCadence}` : ''}
                        </p>
                      </div>
                      <span className="shrink-0 font-medium tabular-nums text-ink">
                        {money(d.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
                {/* The running total belongs on the list it totals, not in a fifth stat tile. */}
                <div className="flex items-center justify-between gap-3 border-t border-line bg-tint/40 px-5 py-2.5">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
                    {t('dash.toDate', '{year} to date', { year: thisYear })}
                  </span>
                  <span className="font-medium tabular-nums text-ink">{money(ytd)}</span>
                </div>
              </>
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Card className="min-w-0 overflow-hidden">
            <SectionHead
              Icon={CalendarDays}
              title={t('dash.upcomingEvents', 'Upcoming events')}
              to="/events"
              linkLabel={t('dash.allEvents', 'All events')}
            />
            {events.length === 0 ? (
              <div className="p-5 pt-0">
                <EmptyState
                  Icon={CalendarDays}
                  title={t('dash.noEvents', 'Nothing on the calendar')}
                  detail={t('dash.noEventsD', 'Festival dates are published here as your temple confirms them.')}
                />
              </div>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {events.slice(0, 5).map((e) => (
                  <li key={e.id}>
                    <Link
                      to={`/events/${e.slug}`}
                      className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-tint/50"
                    >
                      <span className="w-11 shrink-0 overflow-hidden rounded-[9px] border border-line bg-card text-center shadow-[var(--shadow-sm)]">
                        <span className="block bg-brand-500/[0.07] py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-500">
                          {fmtDate(e.date, 'MMM')}
                        </span>
                        <span className="block py-1 font-serif text-[16px] leading-none tabular-nums">
                          {fmtDate(e.date, 'd')}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium text-ink">
                          {e.title}
                        </span>
                        <span className="block text-[12px] text-muted">
                          {e.ticketPrice
                            ? `${money(e.ticketPrice)} ${t('events.perSeat', 'per seat')}`
                            : t('events.freeAll', 'Free · all welcome')}
                        </span>
                      </span>
                      <ArrowUpRight className="size-4 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="min-w-0 overflow-hidden">
            <SectionHead
              Icon={ReceiptText}
              title={t('dash.taxReceipts', 'Tax receipts')}
              to="/my/receipts"
              linkLabel={t('dash.allReceipts', 'All receipts')}
            />
            <div className="border-t border-line p-5">
              <div className="rounded-[10px] border border-line bg-tint/50 p-3.5">
                <p className="text-[13.5px] font-medium text-ink">
                  {t('dash.taxSummary', '{year} giving summary — ready after year end', { year: thisYear })}
                </p>
                <p className="mt-0.5 text-[12.5px] leading-snug text-muted">
                  {t('dash.recorded', '{amount} recorded so far this year across {n} gift(s).', {
                    amount: money(ytd),
                    n: giftsThisYear.length,
                  })}
                </p>
              </div>
              <Link
                to="/my/receipts"
                className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'mt-3 w-full')}
              >
                <Download />
                {t('dash.downloadStatement', 'Download {year} statement', { year: thisYear - 1 })}
              </Link>
              {/* Membership temporarily disabled */}
              {/* {membership ? (
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3.5">
                  <span className="text-[12.5px] text-muted">Your membership</span>
                  <TierBadge tier={membership.tier} />
                </div>
              ) : null} */}
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
