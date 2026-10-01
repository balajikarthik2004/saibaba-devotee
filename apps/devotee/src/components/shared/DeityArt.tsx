import { useState } from 'react'
import { cn } from '@/lib/utils'
import { SaiArt, motifFor, toneFor } from './SaiArt'

/**
 * Devotional illustration and authentic Sai Baba imagery.
 */
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
  if (/dhuni|dwarak|udi|fire|havan|homa|sacred flame/.test(k)) {
    return '/art/saibaba-dhuni.jpg'
  }
  if (/kakad|aarti|arati|shej|dhoop|madhyan|morning|puja|archana|worship/.test(k)) {
    return '/art/saibaba-aarti.jpg'
  }
  if (/sai|baba|samadhi|mandir|guru|punyatithi|palki|abhishek|darshan|shirdi|seat/.test(k)) {
    return '/art/saibaba-hero.jpg'
  }
  return '/art/saibaba-hero.jpg'
}

export const resolveImage = (key: string) => ({ motif: motifFor(key), tone: toneFor(key) })

export function DeityArt({
  deity,
  className,
  label,
  overlay = false,
  vignette = false,
  pan = false,
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
  const { motif, tone } = resolveImage(deity)

  return (
    <div className={cn('relative overflow-hidden bg-sai-900 select-none group', rounded, className)}>
      {photoSrc ? (
        <img
          src={photoSrc}
          alt={label || deity}
          onError={() => setImgError(true)}
          className={cn(
            'block h-full w-full object-cover object-[center_top] transition-transform duration-500 ease-out group-hover:scale-105',
            pan && 'animate-slow-pan',
          )}
          loading="lazy"
        />
      ) : (
        <SaiArt
          motif={motif}
          tone={tone}
          label={label}
          className={cn('h-full w-full', pan && 'animate-slow-pan')}
        />
      )}

      {vignette ? (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 80% at 50% 30%, transparent 40%, color-mix(in srgb, var(--color-sai-900) 60%, transparent) 100%)',
          }}
        />
      ) : null}

      {overlay ? (
        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-sai-900/90 via-sai-900/35 to-transparent" />
      ) : null}
    </div>
  )
}
