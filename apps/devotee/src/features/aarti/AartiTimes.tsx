import { useT } from '@saibaba/core/i18n'
import {
  formatInViewerTz,
  viewerTimeZone,
  zonesDiffer,
} from '@saibaba/core/features/aarti'

/**
 * '6:00 PM Sugar Land · 4:30 AM your time' — the viewer's clock is shown only when it
 * differs from the temple's at that instant.
 */
export function AartiTimes({
  instant,
  templeTimeZone,
  city,
  withDate = false,
  className,
}: {
  instant: Date
  templeTimeZone: string
  city: string
  withDate?: boolean
  className?: string
}) {
  const t = useT()
  const vtz = viewerTimeZone()
  const local = formatInViewerTz(instant, { timeZone: templeTimeZone, withDate })
  const differs = zonesDiffer(instant, templeTimeZone, vtz)
  return (
    <span className={className}>
      <span className="font-medium text-ink">{local}</span>{' '}
      <span className="text-muted">{city}</span>
      {differs ? (
        <>
          <span className="text-muted"> · </span>
          <span className="text-ink">{formatInViewerTz(instant, { timeZone: vtz, withDate })}</span>{' '}
          <span className="text-muted">{t('aarti.yourTime', 'your time')}</span>
        </>
      ) : null}
    </span>
  )
}
