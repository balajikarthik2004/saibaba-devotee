import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Ban, CheckCircle2, LogIn, Save } from 'lucide-react'
import { formatMoney, useT, useTempleStore } from '@saibaba/core'
import {
  getPlatformStats,
  getTempleById,
  setTempleStatus,
  updateTemple,
} from '@saibaba/core/features/tenancy'
import type { CurrencyCode, Temple } from '@saibaba/core/types'
import { PageShell } from '@/components/layout/PageShell'
import { StatTile } from '@/components/shared/StatTile'
import { EmptyState, LoadingSkeleton } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { useAsync } from '@/lib/hooks'
import {
  FinanceFields,
  IdentityFields,
  LocationFields,
  ReachFields,
  SpacesFields,
} from './TempleFields'
import { StatusChip } from './TemplesList'
import { SPACE_PRESETS, formFromTemple, templeFromForm, templeSchema, type TempleForm } from './schema'
import { zodResolver } from './zodResolver'

function Editor({ temple, onSaved }: { temple: Temple; onSaved: () => void }) {
  const t = useT()
  const { toast } = useToast()
  const live = temple.status === 'active'

  const form = useForm<TempleForm>({
    resolver: zodResolver<TempleForm>(templeSchema),
    mode: 'onTouched',
    defaultValues: formFromTemple(temple),
  })

  useEffect(() => form.reset(formFromTemple(temple)), [temple, form])

  const save = form.handleSubmit(async (values) => {
    const next = templeFromForm(values)
    // Keep spaces the preset list does not know about; apply the ticks to the rest.
    const custom = temple.spaces.filter((s) => !SPACE_PRESETS.some((p) => p.key === s.key))
    await updateTemple(temple.id, {
      ...next,
      slug: values.slug || temple.slug,
      spaces: [...next.spaces, ...custom],
      // Deities and logo are edited in the temple's own Settings, not here.
      deities: temple.deities,
      logoUrl: temple.logoUrl,
      // Currency and tax regime are frozen once the temple is live.
      ...(live ? { currency: temple.currency, taxRegime: temple.taxRegime } : {}),
    })
    toast(t('temples.saved', 'Temple saved'))
    onSaved()
  })

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate className="space-y-4">
      {[
        ['Identity', <IdentityFields key="i" form={form} />],
        ['Location', <LocationFields key="l" form={form} />],
        ['Currency & tax', <FinanceFields key="f" form={form} lock={live} />],
        ['Reach', <ReachFields key="r" form={form} />],
        ['Spaces', <SpacesFields key="s" form={form} />],
      ].map(([title, body]) => (
        <Card key={title as string} className="max-w-3xl">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
          <CardContent>{body}</CardContent>
        </Card>
      ))}
      <Card className="max-w-3xl">
        <CardFooter className="justify-end">
          <Button type="button" onClick={save} disabled={form.formState.isSubmitting}>
            <Save />
            {t('temples.save', 'Save changes')}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}

export default function TempleDetail() {
  const t = useT()
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const setTempleId = useTempleStore((s) => s.setTempleId)
  const { data: temple, loading, refresh } = useAsync(() => getTempleById(id), [id])
  const { data: stats } = useAsync(() => getPlatformStats(), [])

  if (loading) {
    return (
      <PageShell title={t('temples.title', 'Temples')} back={{ to: '/temples', label: 'All temples' }}>
        <LoadingSkeleton variant="card" rows={4} />
      </PageShell>
    )
  }
  if (!temple) {
    return (
      <PageShell title={t('temples.title', 'Temples')} back={{ to: '/temples', label: 'All temples' }}>
        <EmptyState title="Temple not found" detail="It may have been removed, or the link is wrong." />
      </PageShell>
    )
  }

  const change = async (status: Temple['status']) => {
    await setTempleStatus(temple.id, status)
    toast(
      t('temples.statusChanged', '{name} is now {status}', { name: temple.name, status }),
      { tone: status === 'suspended' ? 'warn' : undefined },
    )
    refresh()
  }

  const gifts = Object.entries(stats?.giftsByCurrency ?? {}) as [CurrencyCode, number][]

  return (
    <PageShell
      eyebrow={t('nav.group.Platform', 'Platform')}
      title={temple.name}
      description={`${temple.city}, ${temple.country} · ${temple.currency} · /${temple.slug}`}
      back={{ to: '/temples', label: t('temples.back', 'All temples') }}
      actions={
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setTempleId(temple.id)
              navigate('/dashboard')
            }}
          >
            <LogIn />
            {t('temples.open', 'Open console')}
          </Button>
          {temple.status !== 'active' ? (
            <Button size="sm" onClick={() => change('active')}>
              <CheckCircle2 />
              {temple.status === 'suspended' ? 'Reactivate' : 'Go live'}
            </Button>
          ) : (
            <Button variant="destructive" size="sm" onClick={() => change('suspended')}>
              <Ban />
              Suspend
            </Button>
          )}
        </>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatTile label="Status" value={<StatusChip status={temple.status} />} tone="brand" />
        <StatTile
          label="Platform devotees"
          value={stats?.devotees ?? '—'}
          sub="Accounts are global across temples"
          tone="leaf"
        />
        <StatTile
          label="Gifts on the platform"
          value={
            gifts.length ? gifts.map(([c, n]) => formatMoney(n, c, { compact: true })).join(' · ') : '—'
          }
          sub="Per currency, never converted"
          tone="gold"
        />
      </div>
      {temple.status === 'onboarding' ? (
        <Card className="mb-4 max-w-3xl border-saffron-400/40 bg-saffron-100/40 p-3">
          <CardDescription>
            This temple is onboarding. It is hidden from devotees until you choose Go live.
          </CardDescription>
        </Card>
      ) : null}
      {temple.status === 'suspended' ? (
        <Card className="mb-4 max-w-3xl p-3">
          <CardDescription>
            This temple is suspended and hidden from the devotee directory. Its data is kept.
          </CardDescription>
        </Card>
      ) : null}
      <Editor temple={temple} onSaved={refresh} />
    </PageShell>
  )
}
