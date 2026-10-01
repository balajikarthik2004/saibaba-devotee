// Minimal, dependency-free PDF writer: one A4 page, Helvetica, WinAnsi text. Enough for a plain
// receipt. Characters outside Latin-1 are replaced with '?' (use currency CODES, not symbols).

export interface PdfLine {
  text: string
  size?: number
  bold?: boolean
  gap?: number
}

const esc = (s: string) =>
  s.replace(/[\\()]/g, (c) => '\\' + c).replace(/[^\x20-\x7e\xa0-\xff]/g, '?')

export function renderPdf(lines: PdfLine[], title = 'Document'): Uint8Array {
  let y = 800
  const ops: string[] = []
  for (const l of lines) {
    const size = l.size ?? 11
    y -= size + (l.gap ?? 6)
    ops.push(`BT /${l.bold ? 'F2' : 'F1'} ${size} Tf 56 ${y} Td (${esc(l.text)}) Tj ET`)
  }
  const content = ops.join('\n')
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    `<< /Title (${esc(title)}) /Producer (Shree Saibaba platform) >>`,
  ]
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objs.forEach((o, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
  for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info 7 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  // every char is <= 0xff after esc(), so latin1 encoding is byte-exact
  return Uint8Array.from(out, (c) => c.charCodeAt(0) & 0xff)
}

export interface ReceiptForPdf {
  number: string
  issued_at: string
  donor_name: string
  donor_address?: string | null
  amount: number | string
  currency: string
  lines: { description: string; amount: number }[]
  temple_name: string
  tax_id: string
  tax_id_label: string
  declarations: string[]
}

const wrap = (s: string, n = 88) => s.match(new RegExp(`.{1,${n}}(\\s|$)`, 'g'))?.map((x) => x.trim()) ?? [s]

export function renderReceiptPdf(r: ReceiptForPdf): Uint8Array {
  const lines: PdfLine[] = [
    { text: r.temple_name, size: 18, bold: true, gap: 10 },
    { text: `${r.tax_id_label}: ${r.tax_id}`, size: 10, gap: 14 },
    { text: `DONATION RECEIPT ${r.number}`, size: 14, bold: true, gap: 14 },
    { text: `Date: ${r.issued_at.slice(0, 10)}` },
    { text: `Received from: ${r.donor_name}` },
    ...(r.donor_address ? [{ text: r.donor_address }] : []),
    { text: '', gap: 6 },
    ...r.lines.map((l) => ({ text: `${l.description}    ${Number(l.amount).toFixed(2)} ${r.currency}` })),
    { text: `Total: ${Number(r.amount).toFixed(2)} ${r.currency}`, bold: true, gap: 12 },
    ...r.declarations.flatMap((d) => wrap(d).map((t) => ({ text: t, size: 9 }))),
    { text: 'Om Sai Ram.', size: 10, gap: 16 },
  ]
  return renderPdf(lines, `Receipt ${r.number}`)
}
