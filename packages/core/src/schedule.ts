import { addDays, addMonths, addQuarters, addWeeks, addYears } from 'date-fns'
import type { Cadence } from './types'

const STEPPERS: Record<Cadence, (d: Date, n: number) => Date> = {
  daily: addDays,
  weekly: addWeeks,
  monthly: addMonths,
  quarterly: addQuarters,
  yearly: addYears,
  'one-time': (d) => d,
}

/** Preview the next `count` occurrence dates for a cadence starting at `start`. */
export function nextOccurrences(start: Date, cadence: Cadence, count = 5): Date[] {
  if (cadence === 'one-time') return [start]
  const step = STEPPERS[cadence]
  return Array.from({ length: count }, (_, i) => step(start, i))
}

/** How many occurrences a 365-day sponsorship buys at this cadence. */
export const occurrencesPerYear: Record<Cadence, number> = {
  daily: 365,
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  yearly: 1,
  'one-time': 1,
}

export const CADENCE_LABEL: Record<Cadence, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
  'one-time': 'One-time',
}
