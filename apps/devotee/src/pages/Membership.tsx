import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Loader2, Minus, Users } from 'lucide-react'
import type { Donation, Membership, MembershipTier } from '@/lib/data/types'
import { PageHeader } from '@/components/layout/layouts'
import { TierBadge } from '@/components/shared/badges'
import { PaymentMethodPicker } from '@/components/shared/PaymentMethodPicker'
import { MockSuccessScreen } from '@/components/shared/MockSuccessScreen'
import { LoadingSkeleton } from '@/components/shared/states'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/input'
import { Table, TBody, TD, TH, THead, TR, TableWrap } from '@/components/ui/table'
import { TIERS } from '@/lib/data/mock'
import { createMembership, getMembership } from '@/lib/data/api'
import { useAuthStore } from '@/lib/store/auth'
import { useAsync } from '@/lib/hooks'
import { cn, fmtDate, money, titleCase } from '@/lib/utils'

const FEATURES: {
  label: string
  silver: string | boolean
  gold: string | boolean
  platinum: string | boolean
}[] = [
  { label: 'Facility booking discount', silver: '5%', gold: '10%', platinum: '15%' },
  { label: 'Free Archana per year', silver: '1', gold: '1', platinum: '1' },
  { label: 'Monthly newsletter', silver: true, gold: true, platinum: true },
  { label: 'Named in the annual report', silver: true, gold: true, platinum: true },
  { label: 'Prasadam by post, monthly', silver: false, gold: true, platinum: true },
  { label: 'Reserved festival seating', silver: false, gold: true, platinum: true },
  { label: 'Kalyanam sponsorship option', silver: false, gold: false, platinum: true },
  { label: 'Priority puja & hall booking', silver: false, gold: false, platinum: true },
  { label: 'Patron board recognition', silver: false, gold: false, platinum: true },
]

export default function MembershipPage() {
  const user = useAuthStore((s) => s.user)!
  const { data: current, loading, refresh } = useAsync(() => getMembership(user.id), [user.id])

  const [selected, setSelected] = useState<MembershipTier | null>(null)
  const [familyPlan, setFamilyPlan] = useState(false)
  const [autoRenew, setAutoRenew] = useState(true)
  const [method, setMethod] = useState<Donation['paymentMethod']>('card')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<Membership | null>(null)

  const tierSpec = selected ? TIERS.find((t) => t.tier === selected)! : null
  const price = tierSpec ? tierSpec.price + (familyPlan ? 100 : 0) : 0

  const enrol = async () => {
    if (!selected) return
    setBusy(true)
    await new Promise((r) => setTimeout(r, 800))
    const start = new Date()
    const end = new Date(start)
    end.setFullYear(end.getFullYear() + 1)
    const m = await createMembership({
      userId: user.id,
      tier: selected,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      autoRenew,
      familyPlan,
    })
    setBusy(false)
    setDone(m)
    refresh()
  }

  if (done) {
    return (
      <MockSuccessScreen
        title={`Welcome to ${titleCase(done.tier)} membership`}
        subtitle="Your benefits are active immediately and run for one year."
        referenceLabel="Membership"
        reference={done.id}
        rows={[
          { label: 'Tier', value: titleCase(done.tier) },
          { label: 'Valid', value: `${fmtDate(done.startDate)} – ${fmtDate(done.endDate)}` },
          { label: 'Family plan', value: done.familyPlan ? 'Yes' : 'No' },
          { label: 'Auto-renew', value: done.autoRenew ? 'On' : 'Off' },
          { label: 'Amount paid', value: money(price) },
        ]}
        emailSubject={`Your ${titleCase(done.tier)} membership is active`}
        emailBody={
          <>
            <p>Dear {user.name},</p>
            <p className="mt-2">
              Your <strong>{titleCase(done.tier)}</strong> membership is active through{' '}
              {fmtDate(done.endDate, 'MMMM d, yyyy')}
              {done.familyPlan ? ', covering your spouse and minor children' : ''}. Present your
              name at the office desk for member pricing on facility bookings.
            </p>
          </>
        }
        actions={
          <>
            <Link to="/dashboard" className={buttonVariants({ variant: 'ghost' })}>
              Back to dashboard
            </Link>
            <Link to="/puja" className={buttonVariants({})}>
              Use your free archana
            </Link>
          </>
        }
      />
    )
  }

  return (
    <>
      <PageHeader
        title="Membership"
        subtitle="Annual membership keeps the lamps lit, the kitchen running and the priests supported."
      />

      {loading ? (
        <LoadingSkeleton variant="tiles" rows={3} />
      ) : (
        <>
          {current ? (
            <Card className="mb-5 flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="min-w-0">
                <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Your current membership
                </p>
                <p className="mt-1.5 flex flex-wrap items-center gap-2 font-serif text-[20px]">
                  {titleCase(current.tier)}
                  <TierBadge tier={current.tier} />
                  <Badge variant={current.status === 'active' ? 'leaf' : 'brand'}>
                    {titleCase(current.status)}
                  </Badge>
                </p>
                <p className="mt-1 text-[13px] text-muted">
                  {current.status === 'active' ? 'Renews' : 'Expired'}{' '}
                  {fmtDate(current.endDate, 'MMMM yyyy')} ·{' '}
                  {current.autoRenew ? 'Auto-renew on' : 'Auto-renew off'} ·{' '}
                  {current.familyPlan ? 'Family plan' : 'Individual'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelected(current.tier)}>
                  Renew
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    setSelected(
                      current.tier === 'platinum'
                        ? 'platinum'
                        : current.tier === 'gold'
                          ? 'platinum'
                          : 'gold',
                    )
                  }
                >
                  Upgrade
                </Button>
                <Link to="/profile" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  Manage
                </Link>
              </div>
            </Card>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-3">
            {TIERS.map((t) => {
              const isCurrent = current?.tier === t.tier && current.status === 'active'
              const isSelected = selected === t.tier
              return (
                <Card
                  key={t.tier}
                  className={cn(
                    'flex flex-col p-5 transition-shadow',
                    t.tier === 'gold' && 'border-gold-500/40',
                    isSelected && 'ring-2 ring-brand-500/30',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-serif text-[22px]">{titleCase(t.tier)}</h2>
                    {t.tier === 'gold' ? <Badge variant="gold">Most chosen</Badge> : null}
                    {isCurrent ? <Badge variant="leaf">Current</Badge> : null}
                  </div>
                  <p className="mt-1 text-[13px] text-muted">{t.tagline}</p>
                  <p className="mt-3 text-[32px] leading-none tabular-nums">
                    {money(t.price)}
                    <span className="ml-1 font-sans text-[13px] text-muted">/ year</span>
                  </p>

                  <ul className="mt-4 space-y-2">
                    {t.perks.map((p) => (
                      <li key={p} className="flex items-start gap-2 text-[13px] leading-relaxed">
                        <Check className="mt-0.5 size-3.5 shrink-0 text-leaf-500" />
                        {p}
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="mt-5 w-full"
                    variant={t.tier === 'gold' ? 'default' : 'ghost'}
                    onClick={() => setSelected(t.tier)}
                  >
                    {isCurrent ? 'Renew this tier' : `Choose ${titleCase(t.tier)}`}
                  </Button>
                </Card>
              )
            })}
          </div>

          <section className="mt-8">
            <h2 className="mb-3 font-serif text-[20px]">Compare the tiers</h2>
            <TableWrap>
              <Table>
                <THead>
                  <TR>
                    <TH>Benefit</TH>
                    <TH className="text-center">Silver</TH>
                    <TH className="text-center">Gold</TH>
                    <TH className="text-center">Platinum</TH>
                  </TR>
                </THead>
                <TBody>
                  {FEATURES.map((f) => (
                    <TR key={f.label} className="hover:bg-tint/40">
                      <TD className="font-medium">{f.label}</TD>
                      {(['silver', 'gold', 'platinum'] as const).map((k) => (
                        <TD key={k} className="text-center">
                          <Cell v={f[k]} />
                        </TD>
                      ))}
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          </section>

          {selected ? (
            <Card className="mt-8 space-y-4 p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-serif text-[20px]">
                  Checkout — {titleCase(selected)} membership
                </h2>
                <span className="text-[24px] tabular-nums">{money(price)}</span>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-[10px] border border-line p-3.5 transition-colors hover:border-brand-300">
                <Checkbox checked={familyPlan} onChange={(e) => setFamilyPlan(e.target.checked)} />
                <span>
                  <span className="flex items-center gap-1.5 text-[13.5px] font-medium text-ink">
                    <Users className="size-3.5" />
                    Family plan (+{money(100)})
                  </span>
                  <span className="block text-[12.5px] text-muted">
                    Add spouse & minor children under one family tree. Adult children need their own
                    membership.
                  </span>
                </span>
              </label>

              <label className="flex cursor-pointer items-center gap-3 text-[13.5px]">
                <Checkbox checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} />
                Auto-renew next year — we’ll email you two weeks before
              </label>

              <div className="border-t border-line pt-4">
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Payment method
                </p>
                <PaymentMethodPicker value={method} onChange={setMethod} />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Cancel
                </Button>
                <Button size="lg" onClick={enrol} disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" /> : null}
                  {busy ? 'Processing…' : `Join · ${money(price)}`}
                </Button>
              </div>
            </Card>
          ) : null}
        </>
      )}
    </>
  )
}

function Cell({ v }: { v: string | boolean }) {
  if (v === true) return <Check className="mx-auto size-4 text-leaf-500" aria-label="Included" />
  if (v === false) return <Minus className="mx-auto size-4 text-line" aria-label="Not included" />
  return <span className="font-medium">{v}</span>
}
