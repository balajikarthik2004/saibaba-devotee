# Sri Meenakshi Temple — Admin Console (Prototype)

Operations console for Sri Meenakshi Temple Society, Pearland TX.

## Local dev

```bash
npm install && npm run dev
```

## Build

```bash
npm run build
```

## Stack

Vite · React · TypeScript · Tailwind v4 · shadcn/ui · react-router · zustand · recharts

## Data

All local mock, identical seed to the devotee app. See `src/lib/data/mock/`. Swap
`src/lib/data/api.ts` to go real.

## Sign in

`/signin` offers three roles — Admin (Meera Sundaram), Priest (Ramesh Iyer) and Board
(Perumal Annamalai). No password is checked. `/board` is gated to the board role and
redirects everyone else to `/transparency`.

## Routes worth seeing

| Route | What it shows |
|---|---|
| `/dashboard` | Metric tiles, 12-month donations area chart, bookings bar chart, today's roster |
| `/bookings/today` | The priest's archana worklist with batch completion and a print sheet |
| `/transparency` | Puja P&L, festival break-even meters, capital projects |
| `/board` | The same figures, read-only, with the AGM print report |

## Charts

Chart colours live in `src/components/admin/chart-theme.ts`, separate from the UI
tokens. The three categorical hues were validated for lightness, chroma, colour-blind
separation and contrast against a white chart surface.

## Design

The palette and imagery are taken from the temple's own identity at meenakshi.org —
marigold saffron, kumkum maroon, brass lamp gold — but rebuilt as a restrained,
photographic layout rather than a dense one.

- **Display face**: Marcellus, self-hosted (14 KB, one weight), so there is no
  third-party font request and no layout shift on first paint.
- **Deity photography**: `public/deities/` — public-domain and CC works from Wikimedia
  Commons, resized to WebP. Full attribution in `public/deities/CREDITS.md`. **Replace
  these with the Temple Society's own photography before production.**
- The homepage hero ships at three widths via `srcset` and is preloaded, because it is
  the LCP element on every first visit.

## Deploy

Vercel — framework preset "Vite", auto from `main`. `vercel.json` adds the SPA rewrite
react-router needs.
