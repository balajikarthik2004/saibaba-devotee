import { getLanguage, translate } from '../../../i18n'
import type { CountryCode, TaxRegime } from '../../../types'
import type { DonorTaxProfile } from '../types'

/** Translate with the current language; the English text is the fallback. */
export const gt = (key: string, fallback: string, vars?: Record<string, string | number>) =>
  translate(getLanguage(), key, fallback, vars)

export type DeclarationField = 'giftAid' | 'pan' | 'homeAddress' | 'postcode' | 'residentStatus'

export interface RegimeConfig {
  regime: TaxRegime
  /** The country whose tax authority this regime belongs to. */
  country: CountryCode
  label: string
  /** Title printed on a single receipt. */
  receiptTitle: string
  /** Title printed on a year-end statement. */
  annualTitle: string
  /** Label for the temple's registration number on the receipt. */
  taxIdLabel: string
  /** Statutory wording, printed on every receipt. */
  wording: string[]
  /** Declarations the donor is asked for in this regime. */
  fields: DeclarationField[]
  /** Fields without which no valid receipt can be claimed. */
  mandatory: DeclarationField[]
  /** Does the receipt carry the donor's postal address? */
  requiresDonorAddress: boolean
  /** Short explanation shown beside the declaration fields. */
  declarationIntro: string
  /** Gift Aid estimated uplift (0.25 = 25%). */
  giftAidUplift?: number
  giftAidText?: string
  /** India only: what happens to money from overseas donors. */
  fcraNotice?: string
  /** India 80G: cash above this amount is not eligible. */
  cashLimit?: number
  /** Extra receipt fields that are present for this regime. */
  receiptFields: string[]
}

export const FCRA_NOTICE_FALLBACK =
  'Contributions from outside India to an Indian trust fall under the Foreign Contribution (Regulation) Act (FCRA) and need a registered FCRA account. This demo does not process foreign contributions.'

export function regimeConfig(regime: TaxRegime): RegimeConfig {
  switch (regime) {
    case 'us-501c3':
      return {
        regime,
        country: 'US',
        label: gt('giving.regime.us.label', 'US 501(c)(3)'),
        receiptTitle: gt('giving.regime.us.receipt', 'Donation receipt'),
        annualTitle: gt('giving.regime.us.annual', 'Annual contribution statement'),
        taxIdLabel: gt('giving.regime.us.taxId', 'Federal EIN'),
        wording: [
          gt(
            'giving.regime.us.w1',
            'This temple is a tax-exempt organization under section 501(c)(3) of the Internal Revenue Code. Contributions are deductible to the extent allowed by law.',
          ),
          gt(
            'giving.regime.us.w2',
            'No goods or services were provided by the temple in exchange for this contribution, other than intangible religious benefits. Please keep this receipt for your records.',
          ),
        ],
        fields: ['homeAddress'],
        mandatory: [],
        requiresDonorAddress: false,
        declarationIntro: gt(
          'giving.regime.us.intro',
          'Your mailing address is optional, and appears on your receipt if you add it.',
        ),
        receiptFields: ['EIN', 'No goods or services statement'],
      }
    case 'in-80g':
      return {
        regime,
        country: 'IN',
        label: gt('giving.regime.in.label', 'India 80G'),
        receiptTitle: gt('giving.regime.in.receipt', 'Donation receipt (Section 80G)'),
        annualTitle: gt('giving.regime.in.annual', 'Annual donation statement (80G)'),
        taxIdLabel: gt('giving.regime.in.taxId', 'PAN / 80G reg. no.'),
        wording: [
          gt(
            'giving.regime.in.w1',
            'Donation receipt under Section 80G of the Income-tax Act, 1961. Eligibility and the deductible percentage depend on the trust approval and on your own tax position; please consult your tax adviser.',
          ),
          gt(
            'giving.regime.in.w2',
            'The donor PAN must be quoted to claim a deduction. Cash donations above Rs 2,000 are not eligible for deduction.',
          ),
        ],
        fields: ['pan', 'homeAddress', 'residentStatus'],
        mandatory: ['pan'],
        requiresDonorAddress: true,
        declarationIntro: gt(
          'giving.regime.in.intro',
          'Your PAN is needed on the receipt if you want to claim the 80G deduction. You can still give without it, but the receipt will not be claimable.',
        ),
        fcraNotice: gt('giving.regime.in.fcra', FCRA_NOTICE_FALLBACK),
        cashLimit: 2000,
        receiptFields: ['Trust PAN', '80G registration no.', 'Donor PAN', 'Mode of payment', 'Amount in words'],
      }
    case 'uk-giftaid':
      return {
        regime,
        country: 'GB',
        label: gt('giving.regime.uk.label', 'UK Gift Aid'),
        receiptTitle: gt('giving.regime.uk.receipt', 'Donation receipt'),
        annualTitle: gt('giving.regime.uk.annual', 'Annual giving statement'),
        taxIdLabel: gt('giving.regime.uk.taxId', 'Registered charity no.'),
        wording: [
          gt(
            'giving.regime.uk.w1',
            'Thank you for your donation. Where you have made a Gift Aid declaration, the charity can reclaim 25p for every 1 pound you give from HM Revenue and Customs at no cost to you.',
          ),
        ],
        fields: ['giftAid', 'homeAddress', 'postcode'],
        mandatory: [],
        requiresDonorAddress: true,
        declarationIntro: gt(
          'giving.regime.uk.intro',
          'If you are a UK taxpayer, Gift Aid lets the temple claim an extra 25% from HMRC. Your home address and postcode are required for the declaration.',
        ),
        giftAidUplift: 0.25,
        giftAidText: gt(
          'giving.regime.uk.giftAidText',
          'I want to Gift Aid my donation, and any donations I make in the future or have made in the past 4 years, to this charity. I am a UK taxpayer and understand that if I pay less Income Tax and/or Capital Gains Tax than the amount of Gift Aid claimed on all my donations in that tax year it is my responsibility to pay any difference.',
        ),
        receiptFields: ['Charity number', 'Gift Aid declaration'],
      }
    case 'ca-cra':
      return {
        regime,
        country: 'CA',
        label: gt('giving.regime.ca.label', 'Canada CRA'),
        receiptTitle: gt('giving.regime.ca.receipt', 'Official donation receipt for income tax purposes'),
        annualTitle: gt('giving.regime.ca.annual', 'Annual donation summary'),
        taxIdLabel: gt('giving.regime.ca.taxId', 'CRA charity BN'),
        wording: [
          gt(
            'giving.regime.ca.w1',
            'Official donation receipt for income tax purposes. Canada Revenue Agency: canada.ca/charities-giving.',
          ),
          gt(
            'giving.regime.ca.w2',
            'Eligible amount is the gift minus the value of any advantage received. No advantage was received unless stated.',
          ),
        ],
        fields: ['homeAddress', 'postcode'],
        mandatory: ['homeAddress'],
        requiresDonorAddress: true,
        declarationIntro: gt(
          'giving.regime.ca.intro',
          'An official receipt carries your name and address. Add your postal address so the receipt can be used on your return.',
        ),
        receiptFields: [
          'Receipt number',
          'Place issued',
          'Eligible amount',
          'Advantage',
          'Charity BN',
        ],
      }
  }
}

/**
 * Whether a donor in `donorCountry` giving to a temple under `regime` hits the FCRA wall.
 * 'XX' stands for any country outside the four launch countries.
 */
export function fcraBlocked(regime: TaxRegime, donorCountry: CountryCode | 'XX'): boolean {
  return regime === 'in-80g' && donorCountry !== 'IN'
}

/* --------------------------------------------------------------- validation */

export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/
export const UK_POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i
export const CA_POSTAL_RE = /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d$/i

export interface DeclarationCheck {
  ok: boolean
  errors: Partial<Record<DeclarationField, string>>
  /** Not blocking, but the receipt will be weaker (e.g. India without PAN). */
  warnings: string[]
}

/**
 * Validate a donor's declaration for a regime. `forReceipt` also enforces the regime's
 * mandatory fields (address for Canada); at checkout it stays lenient so a gift is
 * never lost to a missing optional detail.
 */
export function validateDeclaration(
  regime: TaxRegime,
  decl: Partial<DonorTaxProfile>,
  opts: { forReceipt?: boolean } = {},
): DeclarationCheck {
  const errors: DeclarationCheck['errors'] = {}
  const warnings: string[] = []
  const pan = (decl.pan ?? '').trim().toUpperCase()
  const postcode = (decl.postcode ?? '').trim()
  const address = (decl.homeAddress ?? '').trim()

  if (regime === 'in-80g') {
    if (pan && !PAN_RE.test(pan)) {
      errors.pan = gt('giving.tax.panInvalid', 'PAN looks like ABCDE1234F: five letters, four digits, one letter.')
    }
    if (!pan) {
      warnings.push(
        gt('giving.tax.panMissing', 'Without a PAN this receipt cannot be used to claim an 80G deduction.'),
      )
    }
    if (decl.residentStatus === 'non-resident') {
      errors.residentStatus = gt(
        'giving.tax.nonResident',
        'Non-resident and foreign contributions are not handled here (FCRA).',
      )
    }
  }

  if (regime === 'uk-giftaid' && decl.giftAid) {
    if (!address) {
      errors.homeAddress = gt('giving.tax.addressNeeded', 'A home address is needed for Gift Aid.')
    }
    if (!postcode) {
      errors.postcode = gt('giving.tax.postcodeNeeded', 'A postcode is needed for Gift Aid.')
    } else if (!UK_POSTCODE_RE.test(postcode)) {
      errors.postcode = gt('giving.tax.postcodeInvalid', 'That does not look like a UK postcode, e.g. HA1 1AA.')
    }
  }

  if (regime === 'ca-cra') {
    if (postcode && !CA_POSTAL_RE.test(postcode)) {
      errors.postcode = gt('giving.tax.postalInvalid', 'That does not look like a Canadian postal code, e.g. L5B 1A1.')
    }
    if (opts.forReceipt && !address) {
      errors.homeAddress = gt('giving.tax.addressForCra', 'The official receipt needs your postal address.')
    }
  }

  if (opts.forReceipt && regime === 'in-80g' && !pan) {
    errors.pan = gt('giving.tax.panForReceipt', 'A PAN is needed for a claimable 80G receipt.')
  }

  return { ok: Object.keys(errors).length === 0, errors, warnings }
}

/** "Gift Aid adds 25%": the estimated uplift on an amount, in whole minor-rounded units. */
export function giftAidUplift(amount: number): number {
  return Math.round(amount * 0.25 * 100) / 100
}
