import type { CountryCode } from '../../types'
import type { LedgerRow } from './donations'
import type { BankLine } from './types'

/**
 * Bank reconciliation. A line matches a ledger entry when the amount is equal and, in
 * order of weight, the reference (donation id, provider ref, donor-quoted ref) appears in
 * the text, the payer's name appears, and the date falls within a window of the gift.
 */

const DAY = 86_400_000

function parseDate(raw: string, country: CountryCode, year: number): string | undefined {
  const iso = raw.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const m = raw.match(/\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/)
  if (!m) return undefined
  const dayFirst = country === 'IN' || country === 'GB'
  const a = Number(m[1])
  const b = Number(m[2])
  const day = dayFirst ? a : b
  const month = dayFirst ? b : a
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined
  const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : year
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** One line per row; the trailing number is the amount. */
export function parseBankStatement(
  text: string,
  country: CountryCode,
  year = new Date().getFullYear(),
): BankLine[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((raw) => {
      const m = raw.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:CR|DR)?\s*$/i)
      const amount = m ? Number(m[1]!.replace(/,/g, '')) : 0
      return { raw, date: parseDate(raw, country, year), amount, text: raw.toLowerCase() }
    })
}

export interface ReconcileResult {
  line: BankLine
  matched?: LedgerRow
  confidence?: 'high' | 'medium' | 'low'
  reasons: string[]
}

const tokens = (name: string) =>
  name
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((t) => t.length > 2)

export function reconcileLines(
  lines: BankLine[],
  rows: LedgerRow[],
  opts: { windowDays?: number; nameOf?: (r: LedgerRow) => string } = {},
): ReconcileResult[] {
  const windowMs = (opts.windowDays ?? 5) * DAY
  const used = new Set<string>()
  // Cash never crosses the bank statement; failed payments never arrived.
  const pool = rows.filter((r) => r.provider !== 'cash' && r.status !== 'failed')

  return lines.map((line) => {
    let best: { row: LedgerRow; score: number; reasons: string[] } | null = null
    for (const row of pool) {
      if (used.has(row.donation.id) || row.donation.amount !== line.amount) continue
      const reasons = ['amount']
      let score = 50
      const refs = [row.donation.id, row.reference]
        .filter((x): x is string => typeof x === 'string' && x.length >= 3)
        .map((x) => x.toLowerCase())
      if (refs.some((r) => line.text.includes(r))) {
        score += 40
        reasons.push('reference')
      }
      const name = opts.nameOf?.(row) ?? row.payerName
      const hits = tokens(name).filter((t) => line.text.includes(t))
      if (hits.length) {
        score += 20
        reasons.push('payer name')
      }
      if (line.date) {
        const delta = Math.abs(new Date(`${line.date}T12:00:00`).getTime() - new Date(row.donation.createdAt).getTime())
        if (delta <= windowMs) {
          score += 15
          reasons.push('date')
        }
      }
      // A still-pending gift is the likelier counterpart of an incoming credit.
      if (row.status === 'pending') score += 5
      if (!best || score > best.score) best = { row, score, reasons }
    }
    if (!best) return { line, reasons: [] }
    used.add(best.row.donation.id)
    const confidence = best.reasons.includes('reference') || (best.reasons.includes('payer name') && best.reasons.includes('date'))
      ? 'high'
      : best.reasons.length >= 2
        ? 'medium'
        : 'low'
    return { line, matched: best.row, confidence, reasons: best.reasons }
  })
}
