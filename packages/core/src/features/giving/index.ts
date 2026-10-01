/**
 * Giving slice: payment providers, tax regimes and receipts, PDF rendering, matching
 * gifts, reconciliation and per-temple giving settings.
 *
 * `pdf/receiptPdf` lazy-imports jspdf, so importing this barrel does not pull it in.
 */
export * from './types'
export * from './settings'
export * from './ledger'
export * from './payments'
export * from './tax'
export * from './matching'
export * from './donations'
export * from './reconcile'
export * from './pdf/receiptPdf'
