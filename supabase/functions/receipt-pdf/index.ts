// GET|POST {VITE_API_BASE}/receipt-pdf   { receiptId }   (or ?receiptId=...)
// Signed-in caller only. Reads the receipt THROUGH RLS (as the caller), so a devotee gets only their
// own and temple finance staff get their temple's. Replies JSON { receipt } by default, or the PDF
// bytes with `Accept: application/pdf` / `?format=pdf`. No storage bucket needed.
import { z } from '../_shared/deps.ts'
import { HttpError, corsHeaders, json, serveJson } from '../_shared/http.ts'
import { requireUser } from '../_shared/supabase.ts'
import { renderReceiptPdf, type ReceiptForPdf } from '../_shared/pdf.ts'

const id = z.string().uuid()

Deno.serve(
  serveJson(async (req) => {
    if (req.method !== 'GET' && req.method !== 'POST') throw new HttpError(405, 'Method not allowed.')
    const url = new URL(req.url)
    let rid = url.searchParams.get('receiptId')
    if (!rid && req.method === 'POST') rid = ((await req.json().catch(() => ({}))) as { receiptId?: string }).receiptId ?? null
    const parsed = id.safeParse(rid)
    if (!parsed.success) throw new HttpError(400, 'receiptId must be a uuid.')

    const { db } = await requireUser(req)
    const { data, error } = await db.from('receipts').select('*').eq('id', parsed.data).maybeSingle()
    if (error) throw new HttpError(500, 'Could not load the receipt.')
    if (!data) throw new HttpError(404, 'Receipt not found.') // RLS hides other people's receipts

    const wantsPdf = url.searchParams.get('format') === 'pdf' || (req.headers.get('accept') ?? '').includes('application/pdf')
    if (!wantsPdf) return json(req, { receipt: data })
    const bytes = renderReceiptPdf(data as ReceiptForPdf)
    return new Response(bytes.buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="receipt-${data.number}.pdf"`,
        'Cache-Control': 'private, no-store',
        ...corsHeaders(req),
      },
    })
  }),
)
