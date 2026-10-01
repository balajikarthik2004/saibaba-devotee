import type { SVGProps } from 'react'
import { cn } from '@/lib/utils'

/**
 * Authentic iconographic symbols of Shree Sai Baba:
 * 1. Padukas (Sacred Holy Footwear)
 * 2. Bhiksha Bowl (Annadanam & Charity)
 * 3. Sacred Dhuni Flame & Udi
 * 4. Neem Leaves (Gurusthan & Healing)
 * 5. Satka & Chimta (Staff & Tongs)
 * 6. Sacred Mandala Geometry
 */

export function PadukasIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('inline-block size-6 select-none shrink-0', className)}
      role="img"
      aria-label="Sai Padukas"
      {...props}
    >
      {/* Left Paduka */}
      <g fill="currentColor">
        <path
          d="M17 10C13 10 10 14 10 20C10 25 12 28 12 34C12 38 14 40 17 40C20 40 22 38 22 34C22 28 24 25 24 20C24 14 21 10 17 10Z"
          fillOpacity="0.15"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <circle cx="17" cy="16" r="2.5" fill="currentColor" />
        <circle cx="17" cy="24" r="1.5" fill="currentColor" fillOpacity="0.7" />
        <circle cx="17" cy="30" r="1.5" fill="currentColor" fillOpacity="0.7" />
      </g>

      {/* Right Paduka */}
      <g fill="currentColor">
        <path
          d="M31 10C27 10 24 14 24 20C24 25 26 28 26 34C26 38 28 40 31 40C34 40 36 38 36 34C36 28 38 25 38 20C38 14 35 10 31 10Z"
          fillOpacity="0.15"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <circle cx="31" cy="16" r="2.5" fill="currentColor" />
        <circle cx="31" cy="24" r="1.5" fill="currentColor" fillOpacity="0.7" />
        <circle cx="31" cy="30" r="1.5" fill="currentColor" fillOpacity="0.7" />
      </g>
    </svg>
  )
}

export function BhikshaBowlIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('inline-block size-6 select-none shrink-0', className)}
      role="img"
      aria-label="Bhiksha Bowl"
      {...props}
    >
      {/* Sacred Bowl with Grains of Grace */}
      <path
        d="M8 22H40C40 32 32.8 40 24 40C15.2 40 8 32 8 22Z"
        fill="currentColor"
        fillOpacity="0.18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Rim */}
      <path
        d="M6 22C6 19.8 14 18 24 18C34 18 42 19.8 42 22C42 24.2 34 26 24 26C14 26 6 24.2 6 22Z"
        stroke="currentColor"
        strokeWidth="1.75"
        fill="currentColor"
        fillOpacity="0.3"
      />
      {/* Radiant grain glow */}
      <circle cx="24" cy="12" r="2" fill="currentColor" />
      <path d="M24 7V9M18 10L19.5 11.5M30 10L28.5 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function DhuniFlameIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('inline-block size-6 select-none shrink-0', className)}
      role="img"
      aria-label="Sacred Dhuni Fire"
      {...props}
    >
      {/* Hearth Base */}
      <path d="M10 40H38L35 34H13L10 40Z" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.75" />
      {/* Outer Flame */}
      <path
        d="M24 8C19 16 14 21 16 28C17.5 33 22 34 24 34C26 34 30.5 33 32 28C34 21 29 16 24 8Z"
        fill="currentColor"
        fillOpacity="0.3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Inner Eternal Jyoti */}
      <path
        d="M24 16C21 21 19 24 21 28C22 30 23.5 31 24 31C24.5 31 26 30 27 28C29 24 27 21 24 16Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function NeemLeavesIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('inline-block size-6 select-none shrink-0', className)}
      role="img"
      aria-label="Gurusthan Neem Leaves"
      {...props}
    >
      {/* Central Stem */}
      <path d="M12 36C20 32 28 22 36 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {/* Neem Leaf Pairs */}
      <path d="M36 12C31 13 27 10 28 6C32 7 35 10 36 12Z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" />
      <path d="M28 20C22 20 18 16 20 12C24 13 27 17 28 20Z" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="1.2" />
      <path d="M34 22C35 27 39 30 42 27C41 23 37 21 34 22Z" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="1.2" />
      <path d="M22 28C17 28 13 24 15 20C19 21 21 25 22 28Z" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="1.2" />
      <path d="M26 31C28 35 32 37 35 34C34 31 30 29 26 31Z" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

export function SatkaChimtaIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('inline-block size-6 select-none shrink-0', className)}
      role="img"
      aria-label="Satka and Chimta"
      {...props}
    >
      {/* Satka (Walking Stick) */}
      <line x1="12" y1="38" x2="36" y2="10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="37" cy="9" r="2.5" fill="currentColor" />
      {/* Chimta (Sacred Tongs) */}
      <path d="M14 12L24 24M34 12L24 24M24 24L24 38" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="24" cy="39" r="1.5" fill="currentColor" />
    </svg>
  )
}

/**
 * Minimalist Sacred Geometry Mandala watermark background
 */
export function MandalaPattern({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('pointer-events-none select-none opacity-10', className)}
      aria-hidden="true"
      {...props}
    >
      <circle cx="100" cy="100" r="90" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
      <circle cx="100" cy="100" r="75" stroke="currentColor" strokeWidth="1" />
      <circle cx="100" cy="100" r="60" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="100" cy="100" r="40" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
      <circle cx="100" cy="100" r="20" stroke="currentColor" strokeWidth="1.5" />
      {/* Lotus Petals Geometry */}
      {Array.from({ length: 8 }).map((_, i) => {
        const rot = i * 45
        return (
          <path
            key={i}
            d="M100 25 C115 55 115 75 100 90 C85 75 85 55 100 25 Z"
            transform={`rotate(${rot} 100 100)`}
            stroke="currentColor"
            strokeWidth="1.2"
            fill="currentColor"
            fillOpacity="0.08"
          />
        )
      })}
    </svg>
  )
}
