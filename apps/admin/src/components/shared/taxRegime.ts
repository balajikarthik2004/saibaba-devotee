import type { Temple } from '@saibaba/core/types'

/**
 * Receipt wording per tax regime. The temple's own tax id and its label come from the
 * tenant profile; only the legal sentence and the "deductible" heading vary here.
 */
export const TAX_REGIME_COPY: Record<
  Temple['taxRegime'],
  { status: string; legal: (temple: string) => string; total: string }
> = {
  'us-501c3': {
    status: '501(c)(3) non-profit organization',
    legal: (t) =>
      `${t} is a tax-exempt organization under section 501(c)(3) of the Internal Revenue Code. Contributions are deductible to the extent allowed by law.`,
    total: 'Total deductible contribution',
  },
  'in-80g': {
    status: 'Donations eligible for deduction under section 80G',
    legal: (t) =>
      `${t} is a registered charitable trust. Donations are eligible for deduction under section 80G of the Income-tax Act, 1961, subject to the limits in force.`,
    total: 'Total donation',
  },
  'uk-giftaid': {
    status: 'Registered charity (Gift Aid eligible)',
    legal: (t) =>
      `${t} is a registered charity. Where a Gift Aid declaration is on file, the charity may reclaim tax on eligible gifts.`,
    total: 'Total gifts',
  },
  'ca-cra': {
    status: 'Registered charity (CRA)',
    legal: (t) =>
      `${t} is a registered charity with the Canada Revenue Agency. Official donation receipts are issued for eligible gifts.`,
    total: 'Total eligible gifts',
  },
}
