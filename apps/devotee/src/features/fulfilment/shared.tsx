import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Check, CircleDot, ExternalLink } from 'lucide-react'
import {
  COUNTRY_NAMES,
  trackingUrl,
  type FulfilmentOrder,
} from '@saibaba/core/features/fulfilment'
import type { CountryCode, ShipmentStatus } from '@saibaba/core/types.sai'
import { useT } from '@saibaba/core/i18n'
import { Badge } from '@/components/ui/badge'
import { fmtDateTime } from '@/lib/utils'

export const Container = ({ children }: { children: React.ReactNode }) => (
  <div className="mx-auto max-w-[1080px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
)

/** The destination country the visitor is browsing for. */
interface ShipToState {
  country: CountryCode | null
  setCountry: (c: CountryCode) => void
}
export const useShipTo = create<ShipToState>()(
  persist((set) => ({ country: null, setCountry: (country) => set({ country }) }), {
    name: 'saibaba:fulfilment:shipto',
  }),
)

export const countryName = (c: CountryCode) => COUNTRY_NAMES[c]

const STATUS_TONE: Record<ShipmentStatus, 'neutral' | 'gold' | 'leaf' | 'brand' | 'default'> = {
  placed: 'neutral',
  paid: 'gold',
  packed: 'gold',
  shipped: 'leaf',
  delivered: 'leaf',
  'held-customs': 'brand',
  cancelled: 'neutral',
}

export function useStatusLabel() {
  const t = useT()
  const L: Record<ShipmentStatus, string> = {
    placed: t('shop.status.placed', 'Order placed'),
    paid: t('shop.status.paid', 'Paid'),
    packed: t('shop.status.packed', 'Packed'),
    shipped: t('shop.status.shipped', 'Shipped'),
    delivered: t('shop.status.delivered', 'Delivered'),
    'held-customs': t('shop.status.held', 'Held at customs'),
    cancelled: t('shop.status.cancelled', 'Cancelled'),
  }
  return L
}

export function StatusBadge({ status }: { status: ShipmentStatus }) {
  const L = useStatusLabel()
  return <Badge variant={STATUS_TONE[status]}>{L[status]}</Badge>
}

export function TrackingLink({ order }: { order: FulfilmentOrder }) {
  const t = useT()
  if (!order.tracking) return null
  const url = trackingUrl(order.carrier, order.tracking)
  return (
    <p className="text-[13.5px] text-ink">
      {order.carrier ? `${order.carrier} · ` : ''}
      <span className="font-mono">{order.tracking}</span>{' '}
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700"
        >
          {t('shop.track', 'Track parcel')} <ExternalLink className="size-3.5" aria-hidden />
        </a>
      ) : null}
    </p>
  )
}

export function OrderTimeline({ order }: { order: FulfilmentOrder }) {
  const L = useStatusLabel()
  return (
    <ol className="space-y-3" aria-label="Order progress">
      {order.events.map((e, i) => {
        const last = i === order.events.length - 1
        return (
          <li key={i} className="flex gap-3">
            <span
              className={
                'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ' +
                (last ? 'bg-brand-500 text-white' : 'bg-leaf-500/15 text-leaf-600')
              }
              aria-hidden
            >
              {last ? <CircleDot className="size-3.5" /> : <Check className="size-3.5" />}
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-medium text-ink">{L[e.status]}</p>
              <p className="text-[12px] text-muted">{fmtDateTime(e.at)}</p>
              {e.note ? <p className="text-[13px] text-muted">{e.note}</p> : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/* -------------------------------------------------------- address validation */

export interface RegionOption {
  code: string
  name: string
}

const R = (s: string): RegionOption[] =>
  s.split('|').map((p) => {
    const [code, name] = p.split(':')
    return { code: code!, name: name ?? code! }
  })

export const US_STATES = R(
  'AL:Alabama|AK:Alaska|AZ:Arizona|AR:Arkansas|CA:California|CO:Colorado|CT:Connecticut|DE:Delaware|DC:District of Columbia|FL:Florida|GA:Georgia|HI:Hawaii|ID:Idaho|IL:Illinois|IN:Indiana|IA:Iowa|KS:Kansas|KY:Kentucky|LA:Louisiana|ME:Maine|MD:Maryland|MA:Massachusetts|MI:Michigan|MN:Minnesota|MS:Mississippi|MO:Missouri|MT:Montana|NE:Nebraska|NV:Nevada|NH:New Hampshire|NJ:New Jersey|NM:New Mexico|NY:New York|NC:North Carolina|ND:North Dakota|OH:Ohio|OK:Oklahoma|OR:Oregon|PA:Pennsylvania|RI:Rhode Island|SC:South Carolina|SD:South Dakota|TN:Tennessee|TX:Texas|UT:Utah|VT:Vermont|VA:Virginia|WA:Washington|WV:West Virginia|WI:Wisconsin|WY:Wyoming',
)
export const CA_PROVINCES = R(
  'AB:Alberta|BC:British Columbia|MB:Manitoba|NB:New Brunswick|NL:Newfoundland and Labrador|NS:Nova Scotia|NT:Northwest Territories|NU:Nunavut|ON:Ontario|PE:Prince Edward Island|QC:Quebec|SK:Saskatchewan|YT:Yukon',
)
export const IN_STATES = R(
  'Andhra Pradesh|Arunachal Pradesh|Assam|Bihar|Chhattisgarh|Goa|Gujarat|Haryana|Himachal Pradesh|Jharkhand|Karnataka|Kerala|Madhya Pradesh|Maharashtra|Manipur|Meghalaya|Mizoram|Nagaland|Odisha|Punjab|Rajasthan|Sikkim|Tamil Nadu|Telangana|Tripura|Uttar Pradesh|Uttarakhand|West Bengal|Delhi|Jammu and Kashmir|Ladakh|Puducherry|Chandigarh',
)

export interface CountryRule {
  regionLabel: string
  regionOptions: RegionOption[] | null
  postcodeLabel: string
  postcodeHint: string
  postcode: RegExp
  normalise: (s: string) => string
}

export const COUNTRY_RULES: Record<CountryCode, CountryRule> = {
  US: {
    regionLabel: 'State',
    regionOptions: US_STATES,
    postcodeLabel: 'ZIP code',
    postcodeHint: '5 digits, e.g. 77479',
    postcode: /^\d{5}(-\d{4})?$/,
    normalise: (s) => s.trim(),
  },
  IN: {
    regionLabel: 'State',
    regionOptions: IN_STATES.map((r) => ({ code: r.code, name: r.code })),
    postcodeLabel: 'PIN code',
    postcodeHint: '6 digits, e.g. 411001',
    postcode: /^[1-9]\d{5}$/,
    normalise: (s) => s.replace(/\s/g, ''),
  },
  GB: {
    regionLabel: 'County (optional)',
    regionOptions: null,
    postcodeLabel: 'Postcode',
    postcodeHint: 'e.g. HA1 1AA',
    postcode: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i,
    normalise: (s) => s.trim().toUpperCase().replace(/\s+/g, ' '),
  },
  CA: {
    regionLabel: 'Province',
    regionOptions: CA_PROVINCES,
    postcodeLabel: 'Postal code',
    postcodeHint: 'e.g. L5B 1A1',
    postcode: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/,
    normalise: (s) => s.trim().toUpperCase().replace(/^(.{3})[ -]?(.{3})$/, '$1 $2'),
  },
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const phoneOk = (s: string) => s.replace(/\D/g, '').length >= 7
