import { CalendarPlus, Download } from 'lucide-react'
import { useT } from '@saibaba/core/i18n'
import {
  buildIcs,
  googleCalendarUrl,
  slotIcsEvents,
  type NextAarti,
} from '@saibaba/core/features/aarti'
import type { Temple } from '@saibaba/core/types'
import type { AartiSlot } from '@saibaba/core/types.sai'
import { Button } from '@/components/ui/button'
import { downloadTextFile } from './hooks'

/** One occurrence: ICS download + Google Calendar link. */
export function AddOccurrenceToCalendar({ occ, temple }: { occ: NextAarti; temple: Temple }) {
  const t = useT()
  const end = new Date(occ.instant.getTime() + occ.slot.durationMin * 60000)
  const title = `${occ.slot.name} — ${temple.name}`
  const google = googleCalendarUrl({ title, start: occ.instant, end, location: temple.name })
  const ics = () =>
    downloadTextFile(
      `${occ.slot.key}-${occ.date}.ics`,
      buildIcs(
        [
          {
            uid: `${occ.slot.id}-${occ.date}@saibaba.platform`,
            title,
            start: occ.instant,
            end,
            location: temple.name,
          },
        ],
        temple.name,
      ),
    )
  return (
    <div className="flex flex-wrap gap-1.5">
      <Button size="sm" variant="outline" onClick={ics} aria-label={`${t('aarti.downloadIcs', 'Download .ics')}: ${occ.slot.name}`}>
        <Download /> {t('aarti.ics', '.ics')}
      </Button>
      <Button size="sm" variant="outline" onClick={() => window.open(google, '_blank', 'noopener')}>
        <CalendarPlus /> {t('aarti.google', 'Google')}
      </Button>
    </div>
  )
}

/** The weekly rhythm (all active slots, next 12 weeks) as one .ics, or the Thursday one only. */
export function AddWeeklyToCalendar({
  slots,
  temple,
  thursdayOnly = false,
}: {
  slots: AartiSlot[]
  temple: Temple
  thursdayOnly?: boolean
}) {
  const t = useT()
  // "Thursday rhythm" = the slots that run on Thursday only (the palki procession).
  const chosen = thursdayOnly ? slots.filter((s) => s.days.length < 7 && s.days.includes(4)) : slots
  const events = () => slotIcsEvents(chosen, temple, { weeks: 12 })
  const first = events()[0]
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={!first}
        onClick={() =>
          downloadTextFile(
            thursdayOnly ? 'thursday-aartis.ics' : 'weekly-aartis.ics',
            buildIcs(events(), `${temple.name} — ${thursdayOnly ? 'Thursdays' : 'daily aartis'}`),
          )
        }
      >
        <Download />
        {thursdayOnly
          ? t('aarti.thursdayIcs', 'Thursday rhythm (.ics, 12 weeks)')
          : t('aarti.weeklyIcs', 'Weekly schedule (.ics, 12 weeks)')}
      </Button>
      {first && thursdayOnly ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            window.open(
              googleCalendarUrl({
                title: first.title,
                start: first.start,
                end: first.end,
                location: temple.name,
                recur: 'FREQ=WEEKLY;BYDAY=TH',
              }),
              '_blank',
              'noopener',
            )
          }
        >
          <CalendarPlus /> {t('aarti.googleRepeat', 'Google (repeating)')}
        </Button>
      ) : null}
    </div>
  )
}
