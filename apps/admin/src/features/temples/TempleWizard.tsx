import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { useT } from '@saibaba/core'
import { createTemple } from '@saibaba/core/features/tenancy'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import {
  FinanceFields,
  IdentityFields,
  LocationFields,
  ReachFields,
  SpacesFields,
} from './TempleFields'
import { templeFromForm, templeSchema, type TempleForm } from './schema'
import { zodResolver } from './zodResolver'

const STEPS: {
  key: string
  title: string
  blurb: string
  fields: (keyof TempleForm)[]
}[] = [
  {
    key: 'identity',
    title: 'Identity',
    blurb: 'Name, contact and daily hours.',
    fields: ['name', 'slug', 'email', 'phone', 'morning', 'evening', 'about'],
  },
  {
    key: 'location',
    title: 'Location',
    blurb: 'Where the temple is and its timezone.',
    fields: ['address', 'city', 'state', 'zip', 'country', 'timezone', 'lat', 'lng'],
  },
  {
    key: 'finance',
    title: 'Currency & tax',
    blurb: 'Gifts stay in this currency and are never converted.',
    fields: ['currency', 'taxRegime', 'taxIdLabel', 'taxId'],
  },
  {
    key: 'reach',
    title: 'Reach',
    blurb: 'Languages, payment providers and shipping countries.',
    fields: ['languages', 'payments', 'shipsTo'],
  },
  {
    key: 'spaces',
    title: 'Spaces',
    blurb: 'Places of worship devotees can be taken to.',
    fields: ['spaces'],
  },
]

export default function TempleWizard() {
  const t = useT()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)

  const form = useForm<TempleForm>({
    resolver: zodResolver<TempleForm>(templeSchema),
    mode: 'onTouched',
    defaultValues: {
      name: '',
      slug: '',
      about: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      country: 'US',
      timezone: 'America/Chicago',
      lat: 0,
      lng: 0,
      currency: 'USD',
      taxRegime: 'us-501c3',
      taxIdLabel: 'EIN',
      taxId: '',
      morning: '5:30 AM – 12:30 PM',
      evening: '4:30 PM – 8:30 PM',
      languages: ['en'],
      payments: ['stripe'],
      shipsTo: [],
      spaces: ['samadhi', 'dwarakamai'],
    },
  })

  const last = step === STEPS.length - 1
  const current = STEPS[step]!

  const next = async () => {
    const ok = await form.trigger(current.fields)
    if (ok) setStep((s) => s + 1)
  }

  const submit = form.handleSubmit(async (values) => {
    setBusy(true)
    try {
      const temple = await createTemple(templeFromForm(values))
      toast(t('temples.created', '{name} created', { name: temple.name }), {
        detail: t('temples.createdHint', 'Status is Onboarding until you make it active.'),
      })
      navigate(`/temples/${temple.id}`)
    } finally {
      setBusy(false)
    }
  })

  return (
    <PageShell
      eyebrow={t('nav.group.Platform', 'Platform')}
      title={t('temples.new', 'Onboard a temple')}
      description={`Step ${step + 1} of ${STEPS.length} · ${current.title}`}
      back={{ to: '/temples', label: t('temples.back', 'All temples') }}
    >
      <ol className="mb-4 flex flex-wrap gap-2" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li
            key={s.key}
            aria-current={i === step ? 'step' : undefined}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold',
              i === step
                ? 'border-brand-500 bg-brand-500 text-white'
                : i < step
                  ? 'border-leaf-500/30 bg-leaf-500/10 text-leaf-600'
                  : 'border-line bg-card text-muted',
            )}
          >
            {i < step ? <Check className="size-3" /> : <span>{i + 1}</span>}
            {s.title}
          </li>
        ))}
      </ol>

      <form onSubmit={(e) => e.preventDefault()} noValidate>
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>{current.title}</CardTitle>
            <CardDescription>{current.blurb}</CardDescription>
          </CardHeader>
          <CardContent>
            {step === 0 ? <IdentityFields form={form} /> : null}
            {step === 1 ? <LocationFields form={form} /> : null}
            {step === 2 ? <FinanceFields form={form} /> : null}
            {step === 3 ? <ReachFields form={form} /> : null}
            {step === 4 ? <SpacesFields form={form} /> : null}
          </CardContent>
          <CardFooter className="justify-between">
            <Button
              type="button"
              variant="outline"
              disabled={step === 0 || busy}
              onClick={() => setStep((s) => s - 1)}
            >
              <ChevronLeft />
              {t('common.back', 'Back')}
            </Button>
            {last ? (
              <Button type="button" onClick={submit} disabled={busy}>
                <Check />
                {t('temples.create', 'Create temple')}
              </Button>
            ) : (
              <Button type="button" onClick={next}>
                {t('common.next', 'Next')}
                <ChevronRight />
              </Button>
            )}
          </CardFooter>
        </Card>
      </form>
    </PageShell>
  )
}
