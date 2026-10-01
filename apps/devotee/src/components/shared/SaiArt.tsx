import { useId } from 'react'

/**
 * Original, generated SVG art for Shree Saibaba. No photography and no faces: the
 * vocabulary is the lamp (diya), sun rays, marigold, lotus (padma), the dhuni flame, om,
 * and an abstract "seat of Baba" — a plain stone slab under a halo with a padma on it.
 * Everything is drawn from colour tokens (Tailwind fill/stroke utilities and CSS variables)
 * so the art follows the palette.
 *
 * Every motif draws in a 400 x 300 box; `DeityArt` scales it with `slice`.
 */

export type ArtTone = 'warm' | 'saffron' | 'indigo'
export type ArtMotif = 'diya' | 'rays' | 'lotus' | 'marigold' | 'dhuni' | 'om' | 'seat' | 'diyas'

export const ART_MOTIFS: ArtMotif[] = [
  'diya',
  'rays',
  'lotus',
  'marigold',
  'dhuni',
  'om',
  'seat',
  'diyas',
]

const TONES: Record<ArtTone, { from: string; to: string }> = {
  warm: { from: 'var(--color-brand-50)', to: 'var(--color-saffron-200)' },
  saffron: { from: 'var(--color-saffron-300)', to: 'var(--color-brand-500)' },
  indigo: { from: 'var(--color-sai-700)', to: 'var(--color-sai-900)' },
}

/** Keyword -> motif, so a puja for "Ganesha" and one for "Hanuman" don't look the same. */
export function motifFor(key: string): ArtMotif {
  const k = key.toLowerCase()
  if ((ART_MOTIFS as string[]).includes(k)) return k as ArtMotif
  if (/sai|baba|padma|samadhi|mandir|seat/.test(k)) return 'seat'
  if (/dhuni|dwarak|udi|fire/.test(k)) return 'dhuni'
  if (/ganesh|ganapati|vighn|om\b/.test(k)) return 'om'
  if (/datta|guru|sun|ray|gopuram/.test(k)) return 'rays'
  if (/lamp|deepam|diya|aarti|arati/.test(k)) return 'diya'
  if (/lotus|lakshmi|chavadi/.test(k)) return 'lotus'
  if (/marigold|flower|garland|lendi/.test(k)) return 'marigold'
  if (/hanuman|maruti|shani/.test(k)) return 'diyas'
  let h = 0
  for (const c of k) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return ART_MOTIFS[h % ART_MOTIFS.length]!
}

export function toneFor(key: string): ArtTone {
  const m = motifFor(key)
  if (m === 'seat' || m === 'dhuni' || m === 'om') return 'indigo'
  if (m === 'rays' || m === 'diyas') return 'saffron'
  return 'warm'
}

/* ------------------------------------------------------------ small pieces */

function Flame({ x, y, s = 1, animate = true }: { x: number; y: number; s?: number; animate?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className={animate ? 'art-flicker' : undefined}>
        <path
          d="M0 -62 C-16 -34 -20 -14 0 0 C20 -14 16 -34 0 -62Z"
          className="fill-saffron-400"
        />
        <path d="M0 -38 C-8 -22 -9 -10 0 -2 C9 -10 8 -22 0 -38Z" className="fill-saffron-100" />
      </g>
    </g>
  )
}

function Diya({ x, y, s = 1, dark, animate = true }: { x: number; y: number; s?: number; dark: boolean; animate?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle cx="0" cy="-30" r="58" className="art-glow fill-saffron-300/30" />
      <Flame x={0} y={-16} animate={animate} />
      <path
        d="M-46 -12 H46 C46 18 22 34 0 34 C-22 34 -46 18 -46 -12Z"
        className={dark ? 'fill-gold-400' : 'fill-brand-500'}
      />
      <path d="M-46 -12 H46" className="stroke-saffron-200" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="0" cy="40" rx="34" ry="4" className="fill-black/10" />
    </g>
  )
}

function Petals({ x, y, rot = 0, s = 1, dark }: { x: number; y: number; rot?: number; s?: number; dark: boolean }) {
  // A lotus: two rows of pointed petals fanning from one base.
  const back = [-64, -32, 0, 32, 64]
  const front = [-48, -16, 16, 48]
  const petal = 'M0 0 C-26 -26 -20 -70 0 -96 C20 -70 26 -26 0 0Z'
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      {back.map((a) => (
        <path
          key={`b${a}`}
          d={petal}
          transform={`rotate(${a})`}
          className={dark ? 'fill-saffron-300/70' : 'fill-brand-200'}
        />
      ))}
      {front.map((a) => (
        <path
          key={`f${a}`}
          d={petal}
          transform={`rotate(${a}) scale(.86)`}
          className={dark ? 'fill-saffron-200' : 'fill-saffron-300'}
        />
      ))}
      <path d={petal} transform="scale(.9)" className={dark ? 'fill-saffron-100' : 'fill-saffron-200'} />
    </g>
  )
}

function Marigold({ x, y, r = 22, dark }: { x: number; y: number; r?: number; dark: boolean }) {
  const n = 12
  return (
    <g transform={`translate(${x} ${y})`}>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2
        return (
          <circle
            key={i}
            cx={Math.cos(a) * r * 0.62}
            cy={Math.sin(a) * r * 0.62}
            r={r * 0.4}
            className={i % 2 ? 'fill-saffron-400' : 'fill-saffron-500'}
          />
        )
      })}
      <circle r={r * 0.42} className={dark ? 'fill-saffron-200' : 'fill-brand-400'} />
    </g>
  )
}

function Sun({ x, y, r, rays = 18, dark, spin = true }: { x: number; y: number; r: number; rays?: number; dark: boolean; spin?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className={spin ? 'art-spin' : undefined}>
        {Array.from({ length: rays }, (_, i) => {
          const a = (i / rays) * Math.PI * 2
          const long = i % 2 === 0
          const r1 = r * 1.25
          const r2 = r * (long ? 2.5 : 1.9)
          const w = 0.085
          const p = (rad: number, da: number) =>
            `${(Math.cos(a + da) * rad).toFixed(1)} ${(Math.sin(a + da) * rad).toFixed(1)}`
          return (
            <path
              key={i}
              d={`M${p(r1, -w)} L${p(r2, 0)} L${p(r1, w)}Z`}
              className={dark ? 'fill-saffron-300/60' : 'fill-saffron-400/70'}
            />
          )
        })}
      </g>
      <circle r={r * 1.12} className="fill-saffron-200/40" />
      <circle r={r} className={dark ? 'fill-saffron-300' : 'fill-saffron-400'} />
    </g>
  )
}

/* ---------------------------------------------------------------- motifs */

function MotifBody({ motif, dark, animate }: { motif: ArtMotif; dark: boolean; animate: boolean }) {
  switch (motif) {
    case 'diya':
      return (
        <>
          <Sun x={200} y={150} r={30} rays={14} dark={dark} spin={animate} />
          <Diya x={200} y={190} s={1.25} dark={dark} animate={animate} />
        </>
      )
    case 'diyas':
      return (
        <>
          <Sun x={200} y={230} r={38} rays={20} dark={dark} spin={animate} />
          <Diya x={96} y={226} s={0.7} dark={dark} animate={animate} />
          <Diya x={200} y={214} s={0.95} dark={dark} animate={animate} />
          <Diya x={304} y={226} s={0.7} dark={dark} animate={animate} />
        </>
      )
    case 'rays':
      return (
        <>
          <Sun x={200} y={170} r={54} rays={24} dark={dark} spin={animate} />
          <path d="M0 222 Q200 196 400 222 V300 H0Z" className={dark ? 'fill-sai-900/70' : 'fill-brand-700/30'} />
        </>
      )
    case 'lotus':
      return (
        <>
          <circle cx="200" cy="150" r="96" className="art-glow fill-saffron-200/40" />
          <Petals x={200} y={222} dark={dark} />
          <path d="M80 236 Q140 226 200 236 T320 236" className="stroke-sai-300/60" strokeWidth="3" fill="none" />
          <path d="M110 252 Q160 244 210 252 T310 252" className="stroke-sai-300/40" strokeWidth="3" fill="none" />
        </>
      )
    case 'marigold':
      return (
        <>
          <path d="M-10 70 Q200 200 410 70" className="stroke-leaf-500" strokeWidth="3" fill="none" />
          {[30, 75, 120, 165, 210, 255, 300, 345].map((x, i) => {
            const t = x / 400
            const y = 70 + 4 * 65 * t * (1 - t) + 2
            return <Marigold key={x} x={x} y={y} r={i % 2 ? 19 : 23} dark={dark} />
          })}
          <Marigold x={200} y={220} r={34} dark={dark} />
          <Marigold x={150} y={236} r={20} dark={dark} />
          <Marigold x={252} y={238} r={22} dark={dark} />
        </>
      )
    case 'dhuni':
      return (
        <>
          <path
            d="M70 300 V150 a130 130 0 0 1 260 0 V300Z"
            className="fill-sai-900/60 stroke-gold-400/60"
            strokeWidth="3"
          />
          <circle cx="200" cy="200" r="80" className="art-glow fill-saffron-400/25" />
          <g className={animate ? 'art-flicker' : undefined}>
            <path d="M200 96 C160 150 164 200 200 226 C236 200 240 150 200 96Z" className="fill-saffron-500" />
            <path d="M200 130 C178 166 180 200 200 218 C220 200 222 166 200 130Z" className="fill-saffron-300" />
            <path d="M200 166 C190 186 192 204 200 214 C208 204 210 186 200 166Z" className="fill-saffron-100" />
          </g>
          <path d="M140 250 L262 226" className="stroke-brand-700" strokeWidth="14" strokeLinecap="round" />
          <path d="M138 228 L260 252" className="stroke-brand-600" strokeWidth="14" strokeLinecap="round" />
          {[[150, 160], [256, 140], [236, 112], [166, 120]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={2.4} className="fill-saffron-200" />
          ))}
        </>
      )
    case 'om':
      return (
        <>
          <circle cx="200" cy="150" r="104" className="fill-none stroke-gold-400/50" strokeWidth="2" />
          <circle cx="200" cy="150" r="84" className="fill-none stroke-saffron-300/40" strokeWidth="1.5" />
          <text
            x="200"
            y="196"
            textAnchor="middle"
            fontSize="128"
            className="fill-saffron-300"
            style={{ fontFamily: "'Noto Sans Devanagari','Nirmala UI','Mangal',sans-serif" }}
            aria-hidden="true"
          >
            {'ॐ'}
          </text>
        </>
      )
    case 'seat':
    default:
      return (
        <>
          <circle cx="200" cy="138" r="92" className="art-glow fill-saffron-300/25" />
          <circle cx="200" cy="138" r="70" className="fill-none stroke-saffron-300/50" strokeWidth="2" />
          <Sun x={200} y={138} r={22} rays={16} dark={dark} spin={animate} />
          <path d="M112 240 a88 88 0 0 1 176 0" className="fill-none stroke-gold-400/50" strokeWidth="3" />
          {/* the stone seat */}
          <rect x="120" y="226" width="160" height="16" rx="3" className="fill-sai-200" />
          <rect x="136" y="242" width="128" height="18" rx="3" className="fill-sai-300" />
          {/* a padma set upon it */}
          <Petals x={200} y={226} s={0.5} dark />
        </>
      )
  }
}

/** The art itself: a backdrop gradient plus one motif, sized by its parent. */
export function SaiArt({
  motif,
  tone,
  animate = true,
  className,
  label,
}: {
  motif: ArtMotif
  tone: ArtTone
  animate?: boolean
  className?: string
  label?: string
}) {
  const uid = useId().replace(/:/g, '')
  const dark = tone !== 'warm'
  const t = TONES[tone]
  return (
    <svg
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <defs>
        <linearGradient id={`bg${uid}`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" style={{ stopColor: t.from }} />
          <stop offset="1" style={{ stopColor: t.to }} />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill={`url(#bg${uid})`} />
      <MotifBody motif={motif} dark={dark} animate={animate} />
    </svg>
  )
}

/** Fixed positions for the drifting petals in the hero (no Math.random at render). */
export const HERO_PETALS = [
  { left: '8%', delay: '0s', dx: '36px', dur: '15s' },
  { left: '22%', delay: '4s', dx: '-28px', dur: '17s' },
  { left: '38%', delay: '9s', dx: '44px', dur: '14s' },
  { left: '61%', delay: '2s', dx: '-40px', dur: '16s' },
  { left: '78%', delay: '7s', dx: '30px', dur: '18s' },
  { left: '91%', delay: '11s', dx: '-24px', dur: '15s' },
]

/** The full-width animated sunrise behind the homepage hero. */
export function HeroScene({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1200 600"
      preserveAspectRatio="xMidYMax slice"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="hero-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--color-sai-800)' }} />
          <stop offset="0.55" style={{ stopColor: 'var(--color-sai-600)' }} />
          <stop offset="0.8" style={{ stopColor: 'var(--color-brand-400)' }} />
          <stop offset="1" style={{ stopColor: 'var(--color-saffron-300)' }} />
        </linearGradient>
        <radialGradient id="hero-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" style={{ stopColor: 'var(--color-saffron-100)', stopOpacity: 0.95 }} />
          <stop offset="1" style={{ stopColor: 'var(--color-saffron-300)', stopOpacity: 0 }} />
        </radialGradient>
      </defs>
      <rect width="1200" height="600" fill="url(#hero-sky)" />
      <circle cx="600" cy="470" r="320" fill="url(#hero-sun)" className="art-glow" />
      <g transform="translate(600 470)">
        <g className="art-spin">
          {Array.from({ length: 28 }, (_, i) => {
            const a = (i / 28) * Math.PI * 2
            const r1 = 90
            const r2 = i % 2 ? 420 : 560
            const w = 0.045
            const p = (rad: number, da: number) =>
              `${(Math.cos(a + da) * rad).toFixed(1)} ${(Math.sin(a + da) * rad).toFixed(1)}`
            return (
              <path
                key={i}
                d={`M${p(r1, -w)} L${p(r2, 0)} L${p(r1, w)}Z`}
                className="fill-saffron-200/20"
              />
            )
          })}
        </g>
        <circle r="86" className="fill-saffron-200" />
      </g>
      {/* far and near hills, like the plain of Shirdi at dawn */}
      <path d="M0 520 Q220 470 420 510 T820 500 T1200 515 V600 H0Z" className="fill-sai-700/80" />
      <path d="M0 560 Q300 520 560 556 T1200 550 V600 H0Z" className="fill-sai-900" />
    </svg>
  )
}
