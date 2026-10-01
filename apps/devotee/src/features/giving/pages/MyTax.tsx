import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, FileText, Loader2 } from 'lucide-react'
import {
  buildAnnualStatements,
  formatMoney,
  getTaxDeclarationSync,
  regimeConfig,
  saveTaxDeclaration,
  useCurrentTemple,
  useT,
  validateDeclaration,
} from '@saibaba/core'
import type { DonorTaxProfile, Temple } from '@saibaba/core'
import { PageHeader } from '@/components/layout/layouts'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/input'
import { TEMPLES } from '@/lib/data/mock'
import { getMyBookings, listDonations } from '@/lib/data/api'
import { identityFromUser } from '@/lib/donor'
import { useAuthStore } from '@/lib/store/auth'
import { useAsync } from '@/lib/hooks'
import { DownloadPdfButton } from '../components/ReceiptView'
import { TaxFields, hasDeclaration } from '../components/TaxFields'
import { declarationOwner } from '../usePaymentChoice'
import { donorForReceipts } from '../useMyDonor'

/** One representative temple per regime, the current temple's regime first. */
function regimeTemples(current: Temple): Temple[] {
  const seen = new Map<string, Temple>()
  for (const t of [current, ...TEMPLES]) if (!seen.has(t.taxRegime)) seen.set(t.taxRegime, t)
  return [...seen.values()]
}

function RegimeCard({ temple, userId, email }: { temple: Temple; userId: string; email: string }) {
  const t = useT()
  const cfg = regimeConfig(temple.taxRegime)
  const owner = declarationOwner(userId, email)
  const [value, setValue] = useState<Partial<DonorTaxProfile>>(
    () => getTaxDeclarationSync(owner, temple.taxRegime) ?? {},
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const check = validateDeclaration(temple.taxRegime, value)

  const save = async () => {
    setShowErrors(true)
    if (!check.ok) return
    setSaving(true)
    await saveTaxDeclaration({
      ...value,
      userId: owner,
      regime: temple.taxRegime,
      residentStatus: temple.taxRegime === 'in-80g' ? 'resident' : undefined,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-serif text-[18px]">{cfg.label}</h2>
          <p className="text-[12.5px] text-muted">
            {t('giving.tax.appliesTo', 'Applies to gifts in {currency}, e.g. {temple}', {
              currency: temple.currency,
              temple: temple.name,
            })}
          </p>
        </div>
        {hasDeclaration(value) ? <Badge variant="leaf">{t('giving.tax.onFile', 'On file')}</Badge> : null}
      </div>
      <TaxFields
        temple={temple}
        value={value}
        onChange={(v) => {
          setValue(v)
          setSaved(false)
        }}
        idPrefix={`mt-${temple.taxRegime}`}
        amount={100}
        showErrors={showErrors}
      />
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : saved ? <Check /> : null}
          {saved ? t('giving.tax.saved', 'Saved') : t('giving.tax.save', 'Save details')}
        </Button>
        {showErrors && !check.ok ? (
          <span role="alert" className="text-[12.5px] text-brand-700">
            {t('giving.tax.fix', 'Please fix the highlighted fields.')}
          </span>
        ) : null}
      </div>
    </Card>
  )
}

/** /my/tax: edit tax declarations per regime and download annual statements. */
export default function MyTax() {
  const t = useT()
  const user = useAuthStore((s) => s.user)!
  const current = useCurrentTemple()
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear - 1)
  const { data } = useAsync(
    async () => Promise.all([listDonations(user.id), getMyBookings(user.id)]),
    [user.id],
  )

  const statements = useMemo(() => {
    if (!data) return []
    const [donations, bookings] = data
    return buildAnnualStatements({
      year,
      donations,
      bookings,
      donor: donorForReceipts(identityFromUser(user)),
    })
    // Declarations are read at build time; recompute on year change and on data arrival.
  }, [data, year, user])

  return (
    <>
      <PageHeader
        title={t('giving.tax.title', 'Tax details & statements')}
        subtitle={t('giving.tax.subtitle', 'What each temple needs to issue a valid receipt in your tax regime, and your year-end statements.')}
        actions={
          <Link to="/my/receipts" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            {t('giving.tax.allReceipts', 'Receipt archive')}
          </Link>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div className="space-y-5">
          {regimeTemples(current).map((temple) => (
            <RegimeCard key={temple.taxRegime} temple={temple} userId={user.id} email={user.email} />
          ))}
        </div>

        <Card className="p-5 lg:sticky lg:top-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-serif text-[18px]">{t('giving.tax.annual', 'Annual statement')}</h2>
            <Select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              aria-label={t('giving.my.filterYear', 'Filter by year')}
              className="w-[110px]"
            >
              {Array.from({ length: 5 }, (_, i) => thisYear - i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
          {statements.length === 0 ? (
            <p className="mt-3 text-[13px] text-muted">
              {t('giving.tax.noneYear', 'No received gifts in {year}.', { year })}
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {statements.map((s) => (
                <li key={`${s.templeId}-${s.currency}`} className="flex items-center justify-between gap-3 py-3">
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-[13.5px] font-medium">
                      <FileText className="size-3.5 text-brand-500" />
                      <span className="truncate">{s.templeName}</span>
                    </span>
                    <span className="block text-[12.5px] text-muted tabular-nums">
                      {formatMoney(s.total, s.currency)} · {s.lines.length}
                    </span>
                  </span>
                  <DownloadPdfButton statement={s} label="PDF" variant="outline" />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[12px] leading-relaxed text-muted">
            {t('giving.tax.perCurrency', 'Each statement is in its temple’s currency. Amounts are never converted or added together.')}
          </p>
        </Card>
      </div>
    </>
  )
}
