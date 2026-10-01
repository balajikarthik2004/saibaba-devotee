import { Check, Mail } from 'lucide-react'
import { useCurrentTemple, useT } from '@saibaba/core'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface SummaryRow {
  label: string
  value: React.ReactNode
}

/**
 * Terminal screen for every fake checkout. The email preview panel replaces the real
 * transactional email the app deliberately does not send.
 */
export function MockSuccessScreen({
  title,
  subtitle,
  referenceLabel = 'Reference',
  reference,
  rows,
  emailSubject,
  emailBody,
  actions,
  extra,
  className,
  fromName,
  fromEmail,
}: {
  title: string
  subtitle?: string
  referenceLabel?: string
  reference: string
  rows?: SummaryRow[]
  emailSubject: string
  emailBody: React.ReactNode
  actions?: React.ReactNode
  extra?: React.ReactNode
  className?: string
  /** Sender shown on the email preview; defaults to the current temple. */
  fromName?: string
  fromEmail?: string
}) {
  const t = useT()
  const temple = useCurrentTemple()
  return (
    <div className={cn('mx-auto max-w-2xl space-y-5', className)}>
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="animate-fade-in grid size-16 place-items-center rounded-full bg-leaf-500/12 text-leaf-500 ring-8 ring-leaf-500/6">
          <Check className="size-8" strokeWidth={2.5} />
        </span>
        <h1 className="font-serif text-[28px] leading-tight">{title}</h1>
        {subtitle ? <p className="max-w-md text-[14px] text-muted">{subtitle}</p> : null}
        <p className="rounded-full border border-line bg-tint px-3 py-1 font-mono text-[12.5px] text-brand-700">
          {referenceLabel}: {reference}
        </p>
      </div>

      {rows?.length ? (
        <Card className="p-5">
          <dl className="divide-y divide-line">
            {rows.map((r) => (
              <div
                key={r.label}
                className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
              >
                <dt className="text-[13px] text-muted">{r.label}</dt>
                <dd className="text-right text-[13.5px] font-medium text-ink">{r.value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      ) : null}

      {extra}

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line bg-tint/60 px-4 py-2.5">
          <Mail className="size-4 text-brand-500" />
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
            {t('giving.success.emailPreview', 'Confirmation email preview')}
          </p>
          <span className="ml-auto text-[11.5px] text-muted">{t('giving.success.notSent', 'Not actually sent')}</span>
        </div>
        <div className="space-y-3 p-5">
          <div className="space-y-0.5 text-[12.5px] text-muted">
            <p>
              <span className="font-medium text-ink">{t('giving.success.from', 'From:')}</span>{' '}
              {fromName ?? temple.name} &lt;{fromEmail ?? temple.email}&gt;
            </p>
            <p>
              <span className="font-medium text-ink">{t('giving.success.subject', 'Subject:')}</span> {emailSubject}
            </p>
          </div>
          <div className="rounded-[10px] border border-line bg-bg/60 p-4 text-[13.5px] leading-relaxed text-ink">
            {emailBody}
          </div>
        </div>
      </Card>

      {actions ? <div className="flex flex-wrap justify-center gap-2.5">{actions}</div> : null}
    </div>
  )
}
