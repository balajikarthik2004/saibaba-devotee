import { useState } from 'react'
import { cn } from '@/lib/utils'

export function imageForDeity(key: string): string | null {
  const k = key.toLowerCase()
  if (/datta.*jayanti|dattatreya.*jayanti/.test(k)) {
    return '/art/festival-datta.jpg'
  }
  if (/hanuman.*jayanti|maruti.*jayanti/.test(k)) {
    return '/art/festival-hanuman.jpg'
  }
  if (/diwali|deepotsav|deepam/.test(k)) {
    return '/art/festival-diwali.jpg'
  }
  if (/chavadi/.test(k)) {
    return '/art/shrine-chavadi.jpg'
  }
  if (/lendi|baug|nandadeep/.test(k)) {
    return '/art/shrine-lendi.jpg'
  }
  if (/ganapati|ganesha|ganesh|vinayak|vighneshwara/.test(k)) {
    return '/art/shrine-ganapati.jpg'
  }
  if (/datta|dattatreya/.test(k)) {
    return '/art/festival-datta.jpg'
  }
  if (/maruti|hanuman|anjaneya|bajrang/.test(k)) {
    return '/art/festival-hanuman.jpg'
  }
  if (/shani|shaneeshwara|shaniswara/.test(k)) {
    return '/art/shrine-shani.jpg'
  }
  if (/annadan|prasad|prasadam|bhandara|feast|food|kitchen|vrat/.test(k)) {
    return '/art/saibaba-annadanam.jpg'
  }
  if (/dhuni|dwarak|udi|fire|havan|homa/.test(k)) {
    return '/art/saibaba-dhuni.jpg'
  }
  if (/kakad|aarti|arati|shej|dhoop|madhyan|morning|puja|archana/.test(k)) {
    return '/art/saibaba-aarti.jpg'
  }
  if (/sai|baba|samadhi|mandir|guru|punyatithi|palki|abhishek|darshan|shirdi|seat/.test(k)) {
    return '/art/saibaba-hero.jpg'
  }
  return '/art/saibaba-hero.jpg'
}

export function DeityArt({
  deity,
  className,
  label,
  overlay = false,
  vignette = false,
  rounded,
}: {
  deity: string
  className?: string
  label?: string
  overlay?: boolean
  vignette?: boolean
  pan?: boolean
  priority?: boolean
  rounded?: string
}) {
  const [imgError, setImgError] = useState(false)
  const photoSrc = !imgError ? imageForDeity(deity) : null

  return (
    <div
      role="img"
      aria-label={label ?? deity}
      className={cn(
        'relative flex items-center justify-center overflow-hidden bg-sai-900',
        rounded,
        className,
      )}
    >
      {photoSrc ? (
        <img
          src={photoSrc}
          alt={label || deity}
          onError={() => setImgError(true)}
          className="block h-full w-full object-cover object-[center_top]"
          loading="lazy"
        />
      ) : (
        <img
          src="/logo.svg"
          alt="Shree Saibaba"
          className="h-3/5 max-h-24 w-auto object-contain opacity-90"
        />
      )}
      {vignette ? (
        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-sai-900/40 to-transparent" />
      ) : null}
      {overlay ? (
        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-sai-900/80 via-sai-900/25 to-transparent" />
      ) : null}
    </div>
  )
}

export function ImageCredit(_props: { deity: string; className?: string }) {
  return null
}
