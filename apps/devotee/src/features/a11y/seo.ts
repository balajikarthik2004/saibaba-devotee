import { useEffect } from 'react'
import type { Temple } from '@saibaba/core'

const JSON_LD_ID = 'ld-temple'

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.rel = 'canonical'
    document.head.appendChild(el)
  }
  el.href = href
}

const SITE = 'Shree Saibaba'

/** JSON-LD (schema.org PlaceOfWorship) for a temple. Exported for tests / SSR later. */
export function templeJsonLd(temple: Temple, origin: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'PlaceOfWorship',
    name: temple.name,
    description: temple.about,
    url: `${origin}/t/${temple.slug}`,
    telephone: temple.phone,
    email: temple.email,
    logo: new URL(temple.logoUrl || '/icons/icon-512.png', origin).href,
    address: {
      '@type': 'PostalAddress',
      streetAddress: temple.address,
      addressLocality: temple.city,
      addressRegion: temple.state,
      postalCode: temple.zip,
      addressCountry: temple.country,
    },
    ...(temple.lat != null && temple.lng != null
      ? { geo: { '@type': 'GeoCoordinates', latitude: temple.lat, longitude: temple.lng } }
      : {}),
    openingHours: [temple.timings.morning, temple.timings.evening],
    publicAccess: true,
  }
}

/**
 * Keeps document.title, meta description, Open Graph / Twitter tags, canonical link and the
 * JSON-LD block in step with the current temple. Pass `undefined` to restore site defaults.
 *   useTempleSeo(useCurrentTemple())
 * Optional `page` adds a page-specific title prefix: "Darshan · <temple>".
 */
export function useTempleSeo(temple: Temple | undefined, page?: string) {
  useEffect(() => {
    const origin = window.location.origin
    const title = temple
      ? `${page ? page + ' · ' : ''}${temple.name}`
      : `${page ? page + ' · ' : ''}${SITE}`
    const desc = temple
      ? `${temple.name}, ${temple.city}${temple.state ? ', ' + temple.state : ''} — daily aartis, live darshan, the 9-Thursday vrat, parayan and giving. ${temple.about}`.slice(0, 300)
      : 'Daily aartis, live darshan, the 9-Thursday vrat, parayan, teachings and giving for your Sai Baba temple.'
    const url = temple ? `${origin}/t/${temple.slug}` : origin + window.location.pathname

    document.title = title
    setMeta('name', 'description', desc)
    setMeta('property', 'og:type', 'website')
    setMeta('property', 'og:site_name', SITE)
    setMeta('property', 'og:title', title)
    setMeta('property', 'og:description', desc)
    setMeta('property', 'og:url', url)
    setMeta('property', 'og:image', `${origin}/icons/icon-512.png`)
    setMeta('property', 'og:locale', (temple?.locale ?? 'en-US').replace('-', '_'))
    setMeta('name', 'twitter:card', 'summary')
    setMeta('name', 'twitter:title', title)
    setMeta('name', 'twitter:description', desc)
    setCanonical(url)

    let ld = document.getElementById(JSON_LD_ID)
    if (!ld) {
      ld = document.createElement('script')
      ld.id = JSON_LD_ID
      ld.setAttribute('type', 'application/ld+json')
      document.head.appendChild(ld)
    }
    ld.textContent = JSON.stringify(
      temple
        ? templeJsonLd(temple, origin)
        : { '@context': 'https://schema.org', '@type': 'Organization', name: SITE, url: origin, logo: `${origin}/icons/icon-512.png` },
    )
  }, [temple, page])
}
