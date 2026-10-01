import { useState } from 'react'
import { Flame, Wallet } from 'lucide-react'
import { useT } from '@saibaba/core'
import { DeityArt } from '@/components/shared/DeityArt'
import { ART_MOTIFS } from '@/components/shared/SaiArt'
import { NextAartiSlot } from '@/components/shared/NextAartiSlot'
import { useMoney } from '@/lib/utils'
import { PageHeader } from '@/components/layout/layouts'
import { StatTile } from '@/components/shared/StatTile'
import { PujaCard } from '@/components/shared/PujaCard'
import { EventCard } from '@/components/shared/EventCard'
import { BreakEvenMeter } from '@/components/shared/BreakEvenMeter'
import { TransparencyStrip } from '@/components/shared/TransparencyStrip'
import { AmountPresets } from '@/components/shared/AmountPresets'
import { PaymentMethodPicker } from '@/components/shared/PaymentMethodPicker'
import { SankalpamFieldRepeater } from '@/components/shared/SankalpamFieldRepeater'
import { TaxReceiptPreview } from '@/components/shared/TaxReceiptPreview'
import { FamilyTreeEditor } from '@/components/shared/FamilyTreeEditor'
import { MockSuccessScreen } from '@/components/shared/MockSuccessScreen'
import { EmptyState, LoadingSkeleton } from '@/components/shared/states'
import { RoleBadge, StatusPill /*, TierBadge */ } from '@/components/shared/badges'
import { MyPujaTimeline } from '@/components/devotee/MyPujaTimeline'
import { NextInYourNameTile } from '@/components/devotee/NextInYourNameTile'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge, Progress, Separator, Skeleton } from '@/components/ui/badge'
import { Checkbox, Field, Input, Radio, Select, Textarea } from '@/components/ui/input'
import { Dialog, Sheet } from '@/components/ui/overlay'
import { Chips, Tabs } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/toast'
import type { FamilyMember } from '@/lib/data/types'
import { EVENTS, OCCURRENCES, PUJA_CATALOG } from '@/lib/data/mock'

/**
 * Storybook-style gallery for Section 12's component inventory. Not linked from the
 * navigation — open /dev directly. Kept in the build so a designer can eyeball every
 * primitive on one page after any token change.
 */
export default function DevGallery() {
  const t = useT()
  const money = useMoney()
  const { toast } = useToast()
  const [amount, setAmount] = useState(108)
  const [method, setMethod] = useState<'card' | 'ach' | 'zelle' | 'check' | 'cash'>('card')
  const [names, setNames] = useState(['Anita Sharma'])
  const [members, setMembers] = useState<FamilyMember[]>([
    { name: 'Rohan Sharma', relation: 'spouse' },
  ])
  const [tab, setTab] = useState('buttons')
  const [chip, setChip] = useState('all')
  const [dialog, setDialog] = useState(false)
  const [sheet, setSheet] = useState(false)

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-6 py-8">
      <PageHeader
        title={t('dev.title', 'Component gallery')}
        subtitle={t('dev.subtitle', 'Every shared primitive rendered against the live design tokens. Route: /dev')}
      />

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: 'buttons', label: 'Controls' },
          { key: 'data', label: 'Data display' },
          { key: 'flows', label: 'Flow screens' },
        ]}
      />

      {tab === 'buttons' ? (
        <div className="space-y-8">
          <Section title="Buttons">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  'default',
                  'ghost',
                  'subtle',
                  'outline',
                  'gold',
                  'leaf',
                  'destructive',
                  'link',
                  'plain',
                ] as const
              ).map((v) => (
                <Button key={v} variant={v}>
                  {v}
                </Button>
              ))}
              <Button disabled>disabled</Button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
              <Button size="icon" aria-label="Icon">
                <Flame />
              </Button>
              <Button
                onClick={() =>
                  toast('Toast fired', { detail: 'Bottom-right, auto-dismiss in 4s.' })
                }
              >
                Fire a toast
              </Button>
            </div>
          </Section>

          <Section title="Form fields">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Text input" htmlFor="g-1" hint="with hint">
                <Input id="g-1" placeholder="Placeholder text" />
              </Field>
              <Field label="Select" htmlFor="g-2">
                <Select id="g-2">
                  <option>Option one</option>
                  <option>Option two</option>
                </Select>
              </Field>
              <Field label="Textarea" htmlFor="g-3" className="sm:col-span-2">
                <Textarea id="g-3" placeholder="Longer description…" />
              </Field>
              <Field label="With error" htmlFor="g-4" error="This field is required">
                <Input id="g-4" />
              </Field>
              <div className="flex items-end gap-5">
                <label className="flex items-center gap-2 text-[13.5px]">
                  <Checkbox defaultChecked /> Checkbox
                </label>
                <label className="flex items-center gap-2 text-[13.5px]">
                  <Radio name="g-radio" defaultChecked /> Radio
                </label>
              </div>
            </div>
          </Section>

          <Section title="Chips & tabs">
            <Chips
              value={chip}
              onChange={setChip}
              items={[
                { key: 'all', label: 'All' },
                { key: 'yearly', label: 'Yearly' },
                { key: 'monthly', label: 'Monthly' },
              ]}
            />
          </Section>

          <Section title="Overlays">
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setDialog(true)}>Open dialog</Button>
              <Button variant="ghost" onClick={() => setSheet(true)}>
                Open sheet
              </Button>
            </div>
          </Section>

          <Section title="Illustrated art (original SVG)">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {ART_MOTIFS.map((m) => (
                <div key={m}>
                  <DeityArt deity={m} className="aspect-[4/3] w-full rounded-[10px]" label={m} />
                  <p className="mt-1 text-[12px] text-muted">{m}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Next aarti slot (placeholder)">
            <div className="rounded-[14px] bg-sai-800 p-5">
              <NextAartiSlot />
            </div>
          </Section>

          <Section title="Amount presets">
            <AmountPresets value={amount} onChange={setAmount} />
          </Section>

          <Section title="Payment method picker">
            <PaymentMethodPicker value={method} onChange={setMethod} />
          </Section>

          <Section title="Sankalpam repeater">
            <SankalpamFieldRepeater
              names={names}
              onChange={setNames}
              ownerName="Anita Sharma"
              ownerDetail=""
              family={[
                { name: 'Rohan Sharma', relation: 'spouse' },
                { name: 'Aarav Sharma', relation: 'son' },
              ]}
            />
          </Section>

          <Section title="Family tree editor">
            <FamilyTreeEditor members={members} onChange={setMembers} />
          </Section>
        </div>
      ) : null}

      {tab === 'data' ? (
        <div className="space-y-8">
          <Section title="Stat tiles">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile label="Default" value={money(723000)} sub="YTD collected" Icon={Wallet} />
              <StatTile label="Brand" value="42" sub="Active bookings" tone="brand" Icon={Flame} />
              <StatTile label="Gold" value="Gold" sub="Expires Feb 2027" tone="gold" />
              <StatTile
                label="Leaf"
                value="80%"
                sub="of target"
                tone="leaf"
                trend={{ value: '12%', direction: 'up' }}
              />
            </div>
          </Section>

          <Section title="Badges & pills">
            <div className="flex flex-wrap items-center gap-2">
              {(['default', 'neutral', 'brand', 'gold', 'leaf', 'outline', 'solid'] as const).map(
                (v) => (
                  <Badge key={v} variant={v}>
                    {v}
                  </Badge>
                ),
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {(['devotee', 'admin', 'board', 'priest'] as const).map((r) => (
                <RoleBadge key={r} role={r} />
              ))}
              {/* Membership temporarily disabled */}
              {/* {(['silver', 'gold', 'platinum'] as const).map((t) => (
                <TierBadge key={t} tier={t} />
              ))} */}
              {[
                'active',
                'paused',
                'cancelled',
                'completed',
                'scheduled',
                'expired',
                'pending',
              ].map((s) => (
                <StatusPill key={s} status={s} />
              ))}
            </div>
          </Section>

          <Section title="Progress & meters">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-3">
                <Progress value={35} />
                <Progress value={80} tone="leaf" />
                <Progress value={60} tone="gold" />
                <Separator />
                <Skeleton className="h-8 w-full" />
              </div>
              <div className="space-y-4">
                <BreakEvenMeter
                  target={900000}
                  collected={723000}
                  label="Annual operating"
                  compact
                />
                <BreakEvenMeter target={18000} collected={19500} label="Guru Purnima" />
              </div>
            </div>
          </Section>

          <Section title="Transparency strip">
            <TransparencyStrip />
          </Section>

          <Section title="Cards">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <PujaCard puja={PUJA_CATALOG[0]!} />
              <EventCard event={EVENTS[0]!} showMeter />
              <Card className="p-5">
                <NextInYourNameTile
                  occurrence={OCCURRENCES[0]}
                  puja={PUJA_CATALOG[0]}
                  names={['Anita Sharma']}
                />
                <div className="mt-4">
                  <MyPujaTimeline occurrences={OCCURRENCES.slice(0, 3)} />
                </div>
              </Card>
            </div>
          </Section>

          <Section title="Empty & loading states">
            <div className="space-y-4">
              <EmptyState title="Nothing here yet" detail="This is the standard empty state." />
              <LoadingSkeleton variant="tiles" rows={3} />
              <LoadingSkeleton variant="table" rows={3} />
            </div>
          </Section>
        </div>
      ) : null}

      {tab === 'flows' ? (
        <div className="space-y-8">
          <Section title="Tax receipt preview">
            <TaxReceiptPreview
              donorName="Anita Sharma"
              donorAddress="12 Sample Street, Sugar Land, TX 77479"
              receiptNo="STMT-2025-USR_0001"
              year={2025}
              lines={[
                { date: '2025-03-14T00:00:00Z', description: 'Annadanam donation', amount: 501 },
                {
                  date: '2025-07-02T00:00:00Z',
                  description: 'Puja sponsorship (monthly)',
                  amount: 410,
                },
                {
                  date: '2025-11-19T00:00:00Z',
                  description: 'Building fund donation',
                  amount: 1001,
                },
              ]}
            />
          </Section>

          <Section title="Mock success screen">
            <MockSuccessScreen
              title="Your sponsorship is confirmed"
              subtitle="The puja will be offered monthly in your family's name."
              referenceLabel="Booking"
              reference="bkg_0081"
              rows={[
                { label: 'Puja', value: 'Murugar Puja' },
                { label: 'How often', value: 'Monthly' },
                { label: 'Amount paid', value: money(410) },
              ]}
              emailSubject="Your Murugar Puja sponsorship is confirmed"
              emailBody={<p>Sai Ram Anita Sharma, your sponsorship is confirmed.</p>}
              actions={<Button variant="ghost">Back to dashboard</Button>}
            />
          </Section>
        </div>
      ) : null}

      <Dialog
        open={dialog}
        onClose={() => setDialog(false)}
        title="Dialog title"
        description="Centred modal, escape or overlay click to dismiss."
        footer={
          <>
            <Button variant="outline" onClick={() => setDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setDialog(false)}>Confirm</Button>
          </>
        }
      >
        <p className="text-[13.5px] text-muted">
          Body content goes here. Scrolls independently when it exceeds the viewport.
        </p>
      </Dialog>

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Sheet title"
        description="Right-hand slide-over, used for admin edit forms."
        footer={<Button onClick={() => setSheet(false)}>Done</Button>}
      >
        <p className="text-[13.5px] text-muted">Form fields live here in the admin app.</p>
      </Sheet>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.09em] text-muted">
        {title}
      </h2>
      {children}
    </section>
  )
}
