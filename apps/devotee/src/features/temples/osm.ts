import type { Temple } from '@saibaba/core'

/** An OpenStreetMap link centred on the temple's coordinates. */
export const osmLink = (t: Pick<Temple, 'lat' | 'lng'>) =>
  `https://www.openstreetmap.org/?mlat=${t.lat}&mlon=${t.lng}#map=15/${t.lat}/${t.lng}`
