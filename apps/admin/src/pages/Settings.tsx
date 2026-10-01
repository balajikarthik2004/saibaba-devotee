import { useState } from 'react'
import { CreditCard, Mail, Plus, Save, Trash2 } from 'lucide-react'
import { LANGUAGES, useCurrentTemple, useT } from '@saibaba/core'
import { updateTemple } from '@saibaba/core/features/tenancy'
import type { LanguageCode } from '@saibaba/core/types'
import type { Role, Staff } from '@/lib/data/types'
import { PageShell } from '@/components/layout/PageShell'
import { RoleBadge } from '@/components/shared/badges'
import { PAYMENT_OPTIONS, TIMEZONES } from '@/components/shared/templeOptions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/input'
import { Tabs } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/toast'
import { EMAIL_TEMPLATES, STAFF } from '@/lib/data/mock'
import { useAuthStore } from '@/lib/store/auth'

const TABS = [
  { key: 'temple', label: 'Temple profile' },
  { key: 'staff', label: 'Priests & staff' },
  { key: 'roles', label: 'Roles & permissions' },
  { key: 'payments', label: 'Payment methods' },
  { key: 'email', label: 'Email templates' },
]

const MATRIX_ROLES = ['admin', 'priest', 'finance', 'committee', 'board', 'platform'] as const

interface Permission {
  key: string
  label: string
  /** Areas delivered by the feature modules: listed now so the matrix is complete. */
  module?: boolean
  roles: Role[]
}

const PERMISSIONS: Permission[] = [
  { key: 'devotees', label: 'View & edit devotee records', roles: ['admin', 'board', 'platform'] },
  { key: 'bookings', label: 'Manage bookings and fulfilment', roles: ['admin', 'priest', 'committee', 'platform'] },
  { key: 'verify-payments', label: 'Verify sponsorship payments', roles: ['admin', 'finance', 'platform'] },
  { key: 'assign-priests', label: 'Assign priests to pujas', roles: ['admin', 'committee', 'platform'] },
  { key: 'catalog', label: 'Edit the puja catalogue', roles: ['admin', 'priest', 'committee', 'platform'] },
  { key: 'ledger', label: 'View the donation ledger', roles: ['admin', 'finance', 'board', 'platform'] },
  { key: 'receipts', label: 'Issue tax receipts', roles: ['admin', 'finance', 'platform'] },
  { key: 'events', label: 'Publish events and the calendar', roles: ['admin', 'committee', 'platform'] },
  { key: 'volunteers', label: 'Run volunteer campaigns and rosters', roles: ['admin', 'committee', 'platform'] },
  { key: 'inventory', label: 'Manage the temple store', roles: ['admin', 'priest', 'platform'] },
  { key: 'requirements', label: 'Write puja requirement sheets', roles: ['admin', 'priest', 'platform'] },
  { key: 'allocate-budgets', label: 'Allocate requirement budgets', roles: ['admin', 'finance', 'platform'] },
  { key: 'approve-requirements', label: 'Approve requirement sheets', roles: ['admin', 'platform'] },
  { key: 'readiness', label: 'Sign off pre-puja readiness', roles: ['admin', 'priest', 'platform'] },
  { key: 'transparency', label: 'View financial dashboards', roles: ['admin', 'finance', 'board', 'platform'] },
  { key: 'settings', label: 'Change temple settings', roles: ['admin', 'platform'] },
  { key: 'onboard-temples', label: 'Onboard and suspend temples', roles: ['platform'] },
  // Feature modules. Screens arrive with each module; the access model is fixed here.
  { key: 'm-aarti', label: 'Aarti & darshan (schedule, live stream): admin manages, priest edits', module: true, roles: ['admin', 'priest', 'platform'] },
  { key: 'm-devotion', label: 'Devotion (vrat, parayan, teachings): admin manages, priest edits', module: true, roles: ['admin', 'priest', 'platform'] },
  { key: 'm-shipping', label: 'Shipping (prasad & udi orders): finance reads payments', module: true, roles: ['admin', 'finance', 'platform'] },
  { key: 'm-annadanam', label: 'Annadanam (meal seva)', module: true, roles: ['admin', 'committee', 'platform'] },
  { key: 'm-community', label: 'Community (prayers, groups, notifications)', module: true, roles: ['admin', 'committee', 'platform'] },
  { key: 'm-giving', label: 'Giving settings (funds, matching, gift aid): finance reads', module: true, roles: ['admin', 'finance', 'platform'] },
  { key: 'm-summaries', label: 'Read-only summaries for the board', module: true, roles: ['admin', 'board', 'platform'] },
]

const DEFAULT_MATRIX: Record<string, Record<string, boolean>> = Object.fromEntries(
  PERMISSIONS.map((p) => [
    p.key,
    Object.fromEntries(MATRIX_ROLES.map((r) => [r, p.roles.includes(r)])),
  ]),
)

export default function Settings() {
  const { toast } = useToast()
  const t = useT()
  const role = useAuthStore((s) => s.user?.role)
  const current = useCurrentTemple()
  const [tab, setTab] = useState('temple')
  const [draft, setDraft] = useState(() => ({
    name: current.name,
    address: current.address,
    city: current.city,
    state: current.state,
    zip: current.zip,
    timezone: current.timezone,
    phone: current.phone,
    email: current.email,
    morning: current.timings.morning,
    evening: current.timings.evening,
    taxId: current.taxId,
    deities: current.deities.join(', '),
    languages: current.languages as LanguageCode[],
  }))
  const [saving, setSaving] = useState(false)
  const [staff, setStaff] = useState<Staff[]>(STAFF)
  const [matrix, setMatrix] = useState(DEFAULT_MATRIX)
  const [templates, setTemplates] = useState(EMAIL_TEMPLATES)
  const [activeTemplate, setActiveTemplate] = useState(EMAIL_TEMPLATES[0]!.id)

  const set = (k: keyof typeof draft) => (e: { target: { value: string } }) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }))

  const saved = (what: string) => toast(`${what} saved`, { detail: 'Stored in local state only.' })

  const saveProfile = async () => {
    setSaving(true)
    try {
      await updateTemple(current.id, {
        name: draft.name,
        address: draft.address,
        city: draft.city,
        state: draft.state,
        zip: draft.zip,
        timezone: draft.timezone,
        phone: draft.phone,
        email: draft.email,
        timings: { morning: draft.morning, evening: draft.evening },
        taxId: draft.taxId,
        languages: draft.languages.length ? draft.languages : ['en'],
        deities: draft.deities
          .split(',')
          .map((d) => d.trim())
          .filter(Boolean),
      })
      toast(t('settings.saved', 'Temple profile saved'))
    } finally {
      setSaving(false)
    }
  }

  const toggleLang = (code: LanguageCode) =>
    setDraft((d) => ({
      ...d,
      languages: d.languages.includes(code)
        ? d.languages.filter((l) => l !== code)
        : [...d.languages, code],
    }))

  const template = templates.find((x) => x.id === activeTemplate)!

  const tabs = <Tabs items={TABS} value={tab} onChange={setTab} />
  const live = current.status === 'active'

  return (
    <PageShell
      tabs={tabs}
      eyebrow="Programme"
      title={t('settings.title', 'Settings')}
      description={`${current.name} · ${current.currency}`}
    >
      {tab === 'temple' ? (
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>{t('settings.profile', 'Temple profile')}</CardTitle>
            <CardDescription>
              {t(
                'settings.profileHint',
                'The address, hours and tax id printed on every receipt and shown on the devotee site.',
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="tp-name" className="sm:col-span-2">
              <Input id="tp-name" value={draft.name} onChange={set('name')} />
            </Field>
            <Field label="Street address" htmlFor="tp-addr" className="sm:col-span-2">
              <Input id="tp-addr" value={draft.address} onChange={set('address')} />
            </Field>
            <Field label="City" htmlFor="tp-city">
              <Input id="tp-city" value={draft.city} onChange={set('city')} />
            </Field>
            <Field label="State / region" htmlFor="tp-state">
              <Input id="tp-state" value={draft.state} onChange={set('state')} />
            </Field>
            <Field label="Postcode" htmlFor="tp-zip">
              <Input id="tp-zip" value={draft.zip} onChange={set('zip')} />
            </Field>
            <Field label="Timezone" htmlFor="tp-tz">
              <Select id="tp-tz" value={draft.timezone} onChange={set('timezone')}>
                {(TIMEZONES.includes(draft.timezone) ? TIMEZONES : [draft.timezone, ...TIMEZONES]).map(
                  (z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ),
                )}
              </Select>
            </Field>
            <Field label="Phone" htmlFor="tp-phone">
              <Input id="tp-phone" value={draft.phone} onChange={set('phone')} />
            </Field>
            <Field label="Email" htmlFor="tp-email">
              <Input id="tp-email" type="email" value={draft.email} onChange={set('email')} />
            </Field>
            <Field label="Morning hours" htmlFor="tp-am">
              <Input id="tp-am" value={draft.morning} onChange={set('morning')} />
            </Field>
            <Field label="Evening hours" htmlFor="tp-pm">
              <Input id="tp-pm" value={draft.evening} onChange={set('evening')} />
            </Field>
            <Field label={current.taxIdLabel} htmlFor="tp-tax" hint="printed on every receipt">
              <Input id="tp-tax" value={draft.taxId} onChange={set('taxId')} />
            </Field>
            <Field
              label="Currency"
              htmlFor="tp-cur"
              hint={live ? 'locked once the temple is live' : 'set at onboarding'}
            >
              <Input
                id="tp-cur"
                value={`${current.currency} · ${current.taxRegime}`}
                disabled
                readOnly
              />
            </Field>
            <Field label="Deities & shrines" htmlFor="tp-deities" className="sm:col-span-2">
              <Textarea id="tp-deities" rows={2} value={draft.deities} onChange={set('deities')} />
            </Field>
            <fieldset className="sm:col-span-2">
              <legend className="mb-1.5 text-sm font-medium text-ink">
                {t('settings.languages', 'Languages offered')}
              </legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {LANGUAGES.map((l) => (
                  <label key={l.code} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={draft.languages.includes(l.code)}
                      onChange={() => toggleLang(l.code)}
                    />
                    {l.english}
                  </label>
                ))}
              </div>
            </fieldset>
          </CardContent>
          <CardFooter className="justify-end">
            <Button
              onClick={saveProfile}
              disabled={saving || (role !== 'admin' && role !== 'platform')}
            >
              <Save />
              {t('settings.save', 'Save profile')}
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      {tab === 'staff' ? (
        <Card className="max-w-3xl">
          <div className="flex items-center justify-between gap-3 border-b border-line p-5">
            <div>
              <h2 className="font-serif text-lg text-ink">Priests &amp; staff</h2>
              <p className="mt-0.5 text-sm text-muted">
                Officiant names appear on every fulfilled occurrence and the archana roster.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() =>
                setStaff((s) => [
                  ...s,
                  {
                    id: `stf_${Date.now()}`,
                    name: '',
                    role: 'priest',
                    title: 'Priest',
                    phone: '',
                    email: '',
                  },
                ])
              }
            >
              <Plus />
              Add
            </Button>
          </div>
          <ul className="divide-y divide-line">
            {staff.map((s, i) => (
              <li key={s.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto]">
                <Field label={i === 0 ? 'Name' : undefined} htmlFor={`st-name-${s.id}`}>
                  <Input
                    id={`st-name-${s.id}`}
                    value={s.name}
                    placeholder="Full name"
                    onChange={(e) =>
                      setStaff((all) =>
                        all.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)),
                      )
                    }
                  />
                </Field>
                <Field label={i === 0 ? 'Title' : undefined} htmlFor={`st-title-${s.id}`}>
                  <Input
                    id={`st-title-${s.id}`}
                    value={s.title}
                    placeholder="Role at the temple"
                    onChange={(e) =>
                      setStaff((all) =>
                        all.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)),
                      )
                    }
                  />
                </Field>
                <div
                  className={i === 0 ? 'flex items-end gap-2 pb-0.5' : 'flex items-center gap-2'}
                >
                  <RoleBadge role={s.role} />
                  <Button
                    variant="plain"
                    size="icon"
                    aria-label={`Remove ${s.name || 'staff member'}`}
                    onClick={() => setStaff((all) => all.filter((x) => x.id !== s.id))}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-line p-4">
            <Button onClick={() => saved('Staff list')}>
              <Save />
              Save staff
            </Button>
          </div>
        </Card>
      ) : null}

      {tab === 'roles' ? (
        <Card className="max-w-4xl">
          <CardHeader>
            <CardTitle>Roles &amp; permissions</CardTitle>
            <CardDescription>
              The console enforces access from the navigation table today; this matrix is the
              shape permissions will follow. Rows marked “feature module” arrive with their
              module: Aarti &amp; darshan, Devotion, Shipping, Annadanam, Community and Giving
              settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-base">
              <thead>
                <tr className="border-b border-line">
                  <th className="eyebrow py-2 text-left">Capability</th>
                  {MATRIX_ROLES.map((r) => (
                    <th key={r} className="eyebrow py-2 text-center">
                      {r}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {PERMISSIONS.map((p) => (
                  <tr key={p.key}>
                    <td className="py-2.5 pr-3">
                      {p.label}
                      {p.module ? (
                        <Badge variant="neutral" className="ml-2">
                          feature module
                        </Badge>
                      ) : null}
                    </td>
                    {MATRIX_ROLES.map((r) => (
                      <td key={r} className="py-2.5 text-center">
                        <Checkbox
                          checked={matrix[p.key]![r]}
                          aria-label={`${p.label} for ${r}`}
                          onChange={(e) =>
                            setMatrix((m) => ({
                              ...m,
                              [p.key]: { ...m[p.key]!, [r]: e.target.checked },
                            }))
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
          <CardFooter className="justify-end">
            <Button onClick={() => saved('Permission matrix')}>
              <Save />
              Save permissions
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      {tab === 'payments' ? (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Payment methods</CardTitle>
            <CardDescription>
              Enabled for {current.name} ({current.currency}). No payment processor is contacted
              from the mock console.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {PAYMENT_OPTIONS.filter((o) => current.payments.includes(o.key)).map((m) => (
                <li
                  key={m.key}
                  className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-line p-3.5"
                >
                  <CreditCard className="size-5 shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-medium">{m.label}</p>
                  </div>
                  <Badge variant="neutral">
                    {['stripe', 'razorpay'].includes(m.key) ? 'Needs credentials' : 'Manual'}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {tab === 'email' ? (
        <div className="grid max-w-4xl gap-4 lg:grid-cols-[220px_1fr] lg:items-start">
          <Card className="p-2">
            <ul className="space-y-0.5">
              {templates.map((tpl) => (
                <li key={tpl.id}>
                  <button
                    type="button"
                    onClick={() => setActiveTemplate(tpl.id)}
                    className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-base transition-colors ${
                      tpl.id === activeTemplate
                        ? 'bg-brand-500/[0.09] font-medium text-brand-600'
                        : 'text-muted hover:bg-tint hover:text-ink'
                    }`}
                  >
                    <Mail className="size-3.5 shrink-0" />
                    {tpl.name}
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5">
            <h2 className="font-serif text-lg text-ink">{template.name}</h2>
            <div className="mt-4 grid gap-4">
              <Field label="Subject line" htmlFor="et-subject">
                <Input
                  id="et-subject"
                  value={template.subject}
                  onChange={(e) =>
                    setTemplates((all) =>
                      all.map((t) =>
                        t.id === template.id ? { ...t, subject: e.target.value } : t,
                      ),
                    )
                  }
                />
              </Field>
              <Field
                label="Body"
                htmlFor="et-body"
                hint="{{placeholders}} are substituted at send time"
              >
                <Textarea
                  id="et-body"
                  rows={10}
                  value={template.body}
                  className="font-mono text-sm"
                  onChange={(e) =>
                    setTemplates((all) =>
                      all.map((t) => (t.id === template.id ? { ...t, body: e.target.value } : t)),
                    )
                  }
                />
              </Field>
            </div>
            <Button className="mt-4" onClick={() => saved(template.name)}>
              <Save />
              Save template
            </Button>
          </Card>
        </div>
      ) : null}
    </PageShell>
  )
}
