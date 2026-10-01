import { readLocal, writeLocal } from '../../local'
import { currentTempleId } from '../../tenant'
import { TEMPLE_BY_ID, TEMPLES } from '../../mock/temple'
import type { Temple, UUID } from '../../types'
import type { GivingSettings } from './types'

/**
 * Per-temple giving configuration. Persisted to localStorage (one record per temple) and
 * read synchronously by the payment provider layer, so `getProviders(temple)` always sees
 * what the admin last saved.
 */

const KEY = 'saibaba:giving:settings'

const sleep = (ms = 120) => new Promise((r) => setTimeout(r, ms))

/** Clearly fictional default VPA for demo Indian temples. */
const DEMO_VPA: Record<string, string> = {
  tmp_pune: 'saidemo.pune@demobank',
  tmp_hyderabad: 'saidemo.hyd@demobank',
}

export function defaultSettings(temple: Temple): GivingSettings {
  return {
    templeId: temple.id,
    enabledProviders: [...temple.payments],
    upiVpa: DEMO_VPA[temple.id] ?? '',
    upiPayeeName: temple.name,
    zelleEmail: temple.country === 'US' ? temple.email : '',
    achInstructions:
      temple.country === 'US'
        ? 'Use your bank bill-pay to send an ACH credit. The office will confirm the routing details by email. Quote your donation reference.'
        : '',
    bankTransferInstructions:
      temple.country === 'GB'
        ? 'Faster Payments / BACS to the temple account. Sort code and account number are shown on the donation confirmation; quote your reference.'
        : temple.country === 'CA'
          ? 'Interac e-Transfer to the temple email, or a bank transfer using the account details the office emails you. Quote your reference.'
          : 'NEFT / IMPS / RTGS to the trust account. The office shares the account details on request; quote your reference.',
    chequePayableTo: temple.name,
    chequeInstructions: 'Write the donation reference on the memo line.',
    cashInstructions: 'Hand the cash to the temple office and ask for a written acknowledgement.',
    giftAidEnabled: temple.taxRegime === 'uk-giftaid',
    eightyGEnabled: temple.taxRegime === 'in-80g',
    craWordingEnabled: temple.taxRegime === 'ca-cra',
    receiptPrefix: 'SAI',
    offerFeeCover: true,
    updatedAt: '',
  }
}

type Store = Record<UUID, Partial<GivingSettings>>
let store: Store = readLocal<Store>(KEY, {})

export function getGivingSettingsSync(templeId: UUID = currentTempleId()): GivingSettings {
  const temple = TEMPLE_BY_ID.get(templeId) ?? TEMPLES[0]!
  return { ...defaultSettings(temple), ...(store[temple.id] ?? {}) }
}

export async function getGivingSettings(templeId: UUID = currentTempleId()): Promise<GivingSettings> {
  await sleep()
  return getGivingSettingsSync(templeId)
}

export async function saveGivingSettings(
  patch: Partial<GivingSettings>,
  templeId: UUID = currentTempleId(),
): Promise<GivingSettings> {
  await sleep(250)
  const next = {
    ...getGivingSettingsSync(templeId),
    ...patch,
    templeId,
    updatedAt: new Date().toISOString(),
  }
  store = { ...store, [templeId]: next }
  writeLocal(KEY, store)
  return next
}
