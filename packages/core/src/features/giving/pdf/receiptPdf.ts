import type { jsPDF } from 'jspdf'
import type { CurrencyCode } from '../../../types'
import { amountInWordsFull, providerLabel } from '../tax/receipts'
import { regimeConfig } from '../tax/regimes'
import type { AnnualStatement, GivingReceipt } from '../types'

/**
 * PDF receipts, rendered in the browser with jsPDF. The library is imported lazily so it
 * never enters the initial bundle; the first receipt a user opens pulls it in.
 *
 * The built-in PDF fonts have no rupee glyph, so INR is written "Rs." in PDFs.
 */

const SYMBOL: Record<CurrencyCode, string> = { USD: '$', INR: 'Rs. ', GBP: '£', CAD: 'CA$' }

export function pdfMoney(amount: number, currency: CurrencyCode): string {
  const n = amount.toLocaleString(currency === 'INR' ? 'en-IN' : 'en-US', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  })
  return `${SYMBOL[currency]}${n}`
}

const fmt = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const ACCENT: [number, number, number] = [194, 65, 12]
const INK: [number, number, number] = [31, 26, 23]
const MUTED: [number, number, number] = [107, 98, 90]
const RULE: [number, number, number] = [222, 214, 204]

const M = 18 // page margin, mm
const PAGE_W = 210
const PAGE_H = 297
const W = PAGE_W - M * 2

async function newDoc(): Promise<jsPDF> {
  const { jsPDF: Ctor } = await import('jspdf')
  return new Ctor({ unit: 'mm', format: 'a4', compress: true })
}

function setInk(doc: jsPDF, c: [number, number, number]) {
  doc.setTextColor(c[0], c[1], c[2])
}

function rule(doc: jsPDF, y: number, c = RULE) {
  doc.setDrawColor(c[0], c[1], c[2])
  doc.setLineWidth(0.25)
  doc.line(M, y, PAGE_W - M, y)
}

function footer(doc: jsPDF, isDemo: boolean, tag: string) {
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    setInk(doc, MUTED)
    doc.setFont('helvetica', 'normal')
    if (isDemo) {
      doc.setFont('helvetica', 'bold')
      setInk(doc, ACCENT)
      doc.text('Demo receipt - not a valid tax document', PAGE_W / 2, PAGE_H - 16, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      setInk(doc, MUTED)
    }
    doc.text(`${tag}  -  Page ${i} of ${pages}`, PAGE_W / 2, PAGE_H - 11, { align: 'center' })
  }
}

/** Temple block (left) + title block (right). Returns the y below the header. */
function header(
  doc: jsPDF,
  o: { templeName: string; address: string; phone?: string; email?: string; title: string; number: string; date: string },
): number {
  let y = M + 4
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  setInk(doc, INK)
  const name = doc.splitTextToSize(o.templeName, 110) as string[]
  doc.text(name, M, y)
  y += name.length * 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  setInk(doc, MUTED)
  const addr = doc.splitTextToSize(o.address, 105) as string[]
  doc.text(addr, M, y)
  y += addr.length * 4.2
  const contact = [o.phone, o.email].filter(Boolean).join('  -  ')
  if (contact) {
    doc.text(contact, M, y)
    y += 4.2
  }

  // Title block
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  setInk(doc, ACCENT)
  const title = doc.splitTextToSize(o.title.toUpperCase(), 66) as string[]
  doc.text(title, PAGE_W - M, M + 4, { align: 'right' })
  let ty = M + 4 + title.length * 4.6
  doc.setFont('courier', 'bold')
  doc.setFontSize(10)
  setInk(doc, INK)
  doc.text(o.number, PAGE_W - M, ty, { align: 'right' })
  ty += 4.6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  setInk(doc, MUTED)
  doc.text(`Date: ${o.date}`, PAGE_W - M, ty, { align: 'right' })

  y = Math.max(y, ty) + 4
  doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2])
  doc.setLineWidth(0.6)
  doc.line(M, y, PAGE_W - M, y)
  return y + 7
}

function label(doc: jsPDF, text: string, x: number, y: number, align: 'left' | 'right' = 'left') {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  setInk(doc, MUTED)
  doc.text(text.toUpperCase(), x, y, { align })
}

function value(doc: jsPDF, text: string | string[], x: number, y: number, align: 'left' | 'right' = 'left', size = 10) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(size)
  setInk(doc, INK)
  doc.text(text, x, y, { align })
}

function paragraph(doc: jsPDF, text: string, y: number, size = 8.5, width = W): number {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(size)
  setInk(doc, MUTED)
  const lines = doc.splitTextToSize(text, width) as string[]
  doc.text(lines, M, y)
  return y + lines.length * (size * 0.43) + 2
}

/** Two-column label/value rows; returns y after. */
function facts(doc: jsPDF, rows: [string, string][], y: number): number {
  for (const [k, v] of rows) {
    if (!v) continue
    label(doc, k, M, y)
    const lines = doc.splitTextToSize(v, W - 55) as string[]
    value(doc, lines, M + 55, y, 'left', 9.5)
    y += Math.max(1, lines.length) * 4.6 + 1.2
  }
  return y
}

/* ------------------------------------------------------------------- receipt */

export async function renderReceiptPdf(r: GivingReceipt): Promise<Blob> {
  const doc = await newDoc()
  const cfg = regimeConfig(r.regime)
  const pending = r.status === 'pending'

  let y = header(doc, {
    templeName: r.templeName,
    address: r.templeAddress,
    phone: r.templePhone,
    email: r.templeEmail,
    title: cfg.receiptTitle,
    number: r.number,
    date: fmt(r.issuedAt),
  })

  // Donor / registration block
  label(doc, 'Received from', M, y)
  label(doc, r.taxIdLabel, PAGE_W - M, y, 'right')
  y += 5
  const donorLines = [r.donorName, ...(r.donorAddress ? (doc.splitTextToSize(r.donorAddress, 85) as string[]) : [])]
  value(doc, donorLines, M, y, 'left', 10.5)
  value(doc, r.taxId, PAGE_W - M, y, 'right', 10)
  y += Math.max(donorLines.length * 5, 6) + 4
  rule(doc, y)
  y += 7

  // Line items
  label(doc, 'Description', M, y)
  label(doc, 'Amount', PAGE_W - M, y, 'right')
  y += 3
  rule(doc, y)
  y += 6
  for (const l of r.lines) {
    const lines = doc.splitTextToSize(l.description, W - 40) as string[]
    value(doc, lines, M, y, 'left', 10)
    value(doc, pdfMoney(l.amount, r.currency), PAGE_W - M, y, 'right', 10)
    y += lines.length * 5 + 2
  }
  rule(doc, y, INK)
  y += 7
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  setInk(doc, INK)
  doc.text(r.regime === 'ca-cra' ? 'Amount received' : 'Total contribution', M, y)
  doc.setFontSize(14)
  doc.text(pdfMoney(r.amount, r.currency), PAGE_W - M, y, { align: 'right' })
  y += 8

  if (r.regime === 'in-80g') {
    y = paragraph(doc, `Amount in words: ${amountInWordsFull(r.amount, r.currency)}`, y, 9)
  }

  // Regime-specific fields
  y += 2
  const extra: [string, string][] = []
  if (r.regime === 'in-80g') {
    extra.push(['80G registration no.', r.regNo ?? r.taxId])
    extra.push(['Donor PAN', r.donorPan ?? 'Not provided'])
    if (r.provider) extra.push(['Mode of payment', providerLabel(r.provider)])
  }
  if (r.regime === 'ca-cra') {
    extra.push(['Receipt number', r.number])
    extra.push(['Place issued', r.placeIssued ?? ''])
    extra.push(['Eligible amount of gift', pdfMoney(r.eligibleAmount ?? r.amount, r.currency)])
    extra.push(['Advantage (value of goods/services)', pdfMoney(r.advantage ?? 0, r.currency)])
    extra.push(['Charity BN', r.taxId])
  }
  if (r.regime === 'uk-giftaid') {
    extra.push(['Gift Aid', r.giftAidClaimed ? 'Declared' : 'Not declared'])
    if (r.giftAidClaimed && r.giftAidUplift) {
      extra.push(['Estimated Gift Aid claim', pdfMoney(r.giftAidUplift, r.currency)])
    }
    extra.push(['Charity number', r.taxId])
  }
  if (r.regime === 'us-501c3') extra.push(['Federal EIN', r.taxId])
  if (r.employer) extra.push(['Employer matching', `Match requested from ${r.employer}`])
  if (pending) extra.push(['Status', 'Awaiting payment. Not valid until the payment is received.'])
  y = facts(doc, extra, y)

  y += 2
  rule(doc, y)
  y += 6
  for (const d of r.declarations) y = paragraph(doc, d, y)

  if (r.regime === 'ca-cra') {
    y += 10
    doc.setDrawColor(INK[0], INK[1], INK[2])
    doc.line(M, y, M + 60, y)
    y += 4
    paragraph(doc, 'Signature of authorised person', y, 8)
  }

  footer(doc, r.isDemo, `${r.templeName}  -  ${r.number}`)
  return doc.output('blob')
}

/* ----------------------------------------------------------------- statement */

export async function renderAnnualStatementPdf(s: AnnualStatement): Promise<Blob> {
  const doc = await newDoc()
  const cfg = regimeConfig(s.regime)

  let y = header(doc, {
    templeName: s.templeName,
    address: s.templeAddress,
    title: `${s.year} ${cfg.annualTitle}`,
    number: s.number,
    date: fmt(new Date().toISOString()),
  })

  label(doc, 'Donor', M, y)
  label(doc, s.taxIdLabel, PAGE_W - M, y, 'right')
  y += 5
  const donor = [s.donorName, ...(s.donorAddress ? (doc.splitTextToSize(s.donorAddress, 85) as string[]) : [])]
  value(doc, donor, M, y, 'left', 10.5)
  value(doc, s.taxId, PAGE_W - M, y, 'right', 10)
  y += Math.max(donor.length * 5, 6) + 2
  if (s.regime === 'in-80g') y = facts(doc, [['Donor PAN', s.donorPan ?? 'Not provided']], y)
  if (s.regime === 'uk-giftaid') {
    y = facts(doc, [['Gift Aid', s.giftAidClaimed ? 'Declared' : 'Not declared']], y)
  }
  y += 2
  rule(doc, y)
  y += 7

  const head = () => {
    label(doc, 'Date', M, y)
    label(doc, 'Description', M + 28, y)
    label(doc, `Amount (${s.currency})`, PAGE_W - M, y, 'right')
    y += 3
    rule(doc, y)
    y += 6
  }
  head()

  for (const l of s.lines) {
    const desc = doc.splitTextToSize(l.description, W - 75) as string[]
    if (y + desc.length * 5 > PAGE_H - 50) {
      doc.addPage()
      y = M + 4
      head()
    }
    value(doc, fmt(l.date), M, y, 'left', 9.5)
    value(doc, desc, M + 28, y, 'left', 9.5)
    if (l.receiptNo) {
      doc.setFont('courier', 'normal')
      doc.setFontSize(7.5)
      setInk(doc, MUTED)
      doc.text(l.receiptNo, M + 28, y + desc.length * 4.6 + 0.5)
    }
    value(doc, pdfMoney(l.amount, s.currency), PAGE_W - M, y, 'right', 9.5)
    y += desc.length * 4.6 + (l.receiptNo ? 6 : 2.5)
  }

  if (y > PAGE_H - 60) {
    doc.addPage()
    y = M + 4
  }
  rule(doc, y, INK)
  y += 7
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  setInk(doc, INK)
  doc.text(`Total for ${s.year}`, M, y)
  doc.setFontSize(14)
  doc.text(pdfMoney(s.total, s.currency), PAGE_W - M, y, { align: 'right' })
  y += 10
  rule(doc, y)
  y += 6
  for (const d of cfg.wording) y = paragraph(doc, d, y)

  footer(doc, s.isDemo, `${s.templeName}  -  ${s.number}`)
  return doc.output('blob')
}

/** Trigger a browser download for a blob. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export const receiptFilename = (r: GivingReceipt) => `receipt-${r.number}.pdf`
export const statementFilename = (s: AnnualStatement) => `statement-${s.templeId}-${s.year}.pdf`
