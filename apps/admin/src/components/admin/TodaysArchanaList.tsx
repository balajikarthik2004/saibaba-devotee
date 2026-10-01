import { useState } from 'react'
import { Check, Printer, SkipForward } from 'lucide-react'
import type { Booking, PujaOccurrence, User } from '@/lib/data/types'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/overlay'
import { EmptyState } from '@/components/shared/states'
import { StatusPill } from '@/components/shared/badges'
import { useCurrentTemple, useT } from '@saibaba/core'
import { PUJA_BY_ID } from '@/lib/data/mock'
import { cn, fmtDate, fmtTime } from '@/lib/utils'

export interface ArchanaRow {
  occurrence: PujaOccurrence
  booking?: Booking
  devotee?: User
  /** Optional family-tree names to read out with the sankalpam. */
  family?: string[]
}

/**
 * The priest's worklist. Batch completion comes first, because on a busy morning the
 * realistic interaction is "tick eight of these at once", not one at a time.
 */
export function TodaysArchanaList({
  rows,
  onComplete,
  onSkip,
  date = new Date(),
}: {
  rows: ArchanaRow[]
  onComplete: (ids: string[]) => void
  onSkip?: (ids: string[]) => void
  date?: Date
}) {
  const TEMPLE = useCurrentTemple()
  const t = useT()
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [printing, setPrinting] = useState(false)

  const pending = rows.filter((r) => r.occurrence.status === 'scheduled')
  const allPendingChecked = pending.length > 0 && pending.every((r) => checked.has(r.occurrence.id))

  const toggle = (id: string) =>
    setChecked((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleAll = () =>
    setChecked(allPendingChecked ? new Set() : new Set(pending.map((r) => r.occurrence.id)))

  const run = (fn: (ids: string[]) => void) => {
    fn([...checked])
    setChecked(new Set())
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No pujas scheduled"
        detail={`Nothing is on the roster for ${fmtDate(date, 'EEEE, MMMM d')}. Regular daily worship continues as usual.`}
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-line bg-card px-3 py-2 text-base">
          <Checkbox
            checked={allPendingChecked}
            onChange={toggleAll}
            disabled={pending.length === 0}
          />
          Select all pending ({pending.length})
        </label>
        <Button size="sm" onClick={() => run(onComplete)} disabled={checked.size === 0}>
          <Check />
          Mark completed ({checked.size})
        </Button>
        {onSkip ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => run(onSkip)}
            disabled={checked.size === 0}
          >
            <SkipForward />
            Mark skipped
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setPrinting(true)}>
          <Printer />
          Print Archana list
        </Button>
      </div>

      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-lg)] border border-line bg-card">
        {rows.map(({ occurrence, booking, devotee, family }) => {
          const puja = booking ? PUJA_BY_ID.get(booking.pujaCatalogId) : undefined
          const done = occurrence.status !== 'scheduled'
          return (
            <li
              key={occurrence.id}
              className={cn('flex flex-wrap items-center gap-3 p-3.5', done && 'bg-tint/30')}
            >
              <Checkbox
                checked={checked.has(occurrence.id)}
                onChange={() => toggle(occurrence.id)}
                disabled={done}
                aria-label={`Select ${puja?.name ?? 'puja'} for ${devotee?.name ?? 'devotee'}`}
              />
              <span className="w-[68px] shrink-0 font-mono text-sm text-brand-600">
                {fmtTime(occurrence.scheduledAt)}
              </span>
              <div className="min-w-[180px] flex-1">
                <p className={cn('text-base font-medium', done ? 'text-muted' : 'text-ink')}>
                  {puja?.name ?? 'Puja'}
                  <span className="ml-2 font-normal text-muted">{puja?.deity}</span>
                </p>
                <p className="text-sm text-muted">
                  {booking?.sankalpamNames.join(', ') || '—'}
                  {devotee?.nakshatra ? ` · ${devotee.nakshatra}` : ''}
                  {devotee?.gothra ? ` · ${devotee.gothra} ${t('archana.gothra', 'gothra')}` : ''}
                </p>
                {family?.length ? (
                  <p className="text-xs text-muted">
                    {t('archana.family', 'Family')}: {family.join(', ')}
                  </p>
                ) : null}
              </div>
              {occurrence.officiant ? (
                <Badge variant="neutral">{occurrence.officiant}</Badge>
              ) : null}
              <StatusPill status={occurrence.status} />
            </li>
          )
        })}
      </ul>

      <Dialog
        open={printing}
        onClose={() => setPrinting(false)}
        title={`Archana list — ${fmtDate(date, 'EEEE, MMMM d, yyyy')}`}
        description="Print-styled sheet for the temple office desk."
        className="max-w-2xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setPrinting(false)}>
              Close
            </Button>
            <Button onClick={() => window.print()}>
              <Printer />
              Print
            </Button>
          </>
        }
      >
        <div className="print-area text-base">
          <header className="mb-4 border-b border-line pb-3">
            <p className="font-bold text-lg">{TEMPLE.name}</p>
            <p className="text-sm text-muted">
              {[TEMPLE.address, TEMPLE.city, TEMPLE.state].filter(Boolean).join(', ')}
            </p>
            <p className="text-sm text-muted">
              Archana roster · {fmtDate(date, 'EEEE, MMMM d, yyyy')} · {rows.length} entries
            </p>
          </header>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                {[t('archana.time', 'Time'), t('archana.puja', 'Puja'), t('archana.names', 'Names'), t('archana.done', 'Done')].map((h) => (
                  <th key={h} className="eyebrow py-1.5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(({ occurrence, booking, devotee, family }) => {
                const puja = booking ? PUJA_BY_ID.get(booking.pujaCatalogId) : undefined
                return (
                  <tr key={occurrence.id}>
                    <td className="py-1.5 align-top font-mono text-sm whitespace-nowrap">
                      {fmtTime(occurrence.scheduledAt)}
                    </td>
                    <td className="py-1.5 align-top">{puja?.name}</td>
                    <td className="py-1.5 align-top">
                      {booking?.sankalpamNames.join(', ')}
                      {family?.length ? (
                        <span className="block text-xs">
                          {t('archana.family', 'Family')}: {family.join(', ')}
                        </span>
                      ) : null}
                      {devotee?.nakshatra || devotee?.gothra ? (
                        <span className="block text-xs text-muted">
                          {[devotee.nakshatra, devotee.gothra && `${devotee.gothra} gothra`]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-1.5 align-top">
                      <span className="inline-block size-3.5 border border-ink/40" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Dialog>
    </div>
  )
}
