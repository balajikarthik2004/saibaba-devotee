# Shree Saibaba Platform — architecture & build rules

Multi-temple, multi-country (US · India · UK · Canada) platform for Shree Sai Baba temples.
Derived from the Meenakshi prototype (Vite · React 19 · TypeScript · Tailwind v4 · react-router 7 ·
zustand · react-hook-form · zod). **All data is mock/in-memory today** and sits behind one seam
(`packages/core/src/api.ts`), so a real backend can replace it.

## Layout

```
apps/devotee    public + devotee site        (@saibaba/devotee)
apps/admin      operations console           (@saibaba/admin)
packages/core   shared types, mock data, API (@saibaba/core)  — consumed as TS source
supabase/       SQL migrations + edge functions (backend slice)
docs/           this file, ADRs
```

Run: `npm install` (root) · `npm run dev:devotee` · `npm run dev:admin` · `npm run build` ·
typecheck a workspace with `cd apps/<x> && npx tsc -b` or `npx tsc -p packages/core`.

## Contract already in place (do not redesign — extend)

- `packages/core/src/types.sai.ts` — the domain contract for every slice (Temple tenant profile,
  aarti, vrat, parayan, shop, annadanam, prayers, notifications, payments, tax, receipts).
  Add fields when you must, but never rename/remove; if you need a new type, put it in your
  slice folder.
- `packages/core/src/mock/temple.ts` — `TEMPLES` (6 fictional demo temples: ids `tmp_sugarland`,
  `tmp_fremont`, `tmp_pune`, `tmp_hyderabad`, `tmp_harrow`, `tmp_mississauga`), `TEMPLE` (flagship),
  `TEMPLE_BY_ID`, `TEMPLE_BY_SLUG`.
- `packages/core/src/tenant.ts` — `useTempleStore`, `currentTempleId()`, `currentTemple()`,
  `useCurrentTemple()`. **Every temple-scoped read/write uses `currentTempleId()`; never take the
  flagship for granted.**
- `packages/core/src/money.ts` — `formatMoney(amount, currency)`, `GIFT_PRESETS`. Money is whole
  units of the record's own currency and is never converted.
- `packages/core/src/i18n.ts` — `useT()` / `t(key, englishFallback, vars?)`, `registerDictionary`,
  `LANGUAGES`. **English fallback is mandatory in every call**; user-visible strings in new code
  must go through `t()` with a namespaced key (`aarti.`, `vrat.`, `shop.` …).
- Feature registries — new screens plug in without editing shared files:
  - devotee: `apps/devotee/src/features/<slice>/index.tsx` exports `routes: FeatureRoute[]` and
    `nav?: FeatureNav[]` (see `features/registry.ts`).
  - admin: `apps/admin/src/features/<slice>/index.tsx` exports `routes` and `nav`
    (see `features/registry.ts`); role-gated; a new `group` title creates a sidebar group.
  - core: `packages/core/src/features/<slice>/index.ts` (API + mock data) and one
    `export * from './<slice>'` line in `packages/core/src/features/index.ts`.
- Apps import core through thin shims (`@/lib/data/api`, `@/lib/data/types`, `@/lib/data/mock`,
  `@/lib/store/auth`) **or** directly from `@saibaba/core` / `@saibaba/core/features/<slice>`.
  New code should import from `@saibaba/core...` directly.

## Conventions

- **Latency + persistence pattern** for mock API functions: `await simulateLatency()` (exported
  from `api.ts`), mutate an in-memory array, mirror user-authored records to localStorage via
  `readLocal/writeLocal` (`local.ts`) with keys of the form `saibaba:<slice>:<thing>`, and hydrate
  on module load — exactly as the existing donations/volunteers code does. Every storage access is
  already try/catch-wrapped.
- Seed data must be **deterministic** (no `Math.random()` at import time; see `mock/seed.ts` for the
  seeded PRNG) and clearly fictional. Never invent real people, real registrations, real bank
  details. Sai Baba teaching/leela text must be **your own paraphrase**; do not paste long passages
  of copyrighted books. Traditional aarti *lyrics*: include at most the opening line as a
  recognisable title/excerpt and mark `source: 'Temple to supply verified text'` — the admin CMS
  lets each temple paste its own copy.
- Ritual/festival facts: keep to widely-attested practice (Thursday as Baba's day, four daily
  aartis: Kakad/Madhyan/Dhoop/Shej, the 9-Thursday vrat, Sai Satcharitra parayan in 7 days or by
  chapter, Guru Purnima, Ram Navami, Vijayadashami/Punyatithi, Datta Jayanti). Festival dates are
  seed data with `verified:false` — the UI must say "dates confirmed by your temple".
- UI: use each app's own primitives in `src/components/ui/*` (Button, Card, Input, Tabs, Badge,
  Overlay, Table, Toast) and colour **tokens** from `src/index.css` — no hard-coded hex in
  components. Mobile-first, keyboard accessible, `aria-*` on interactive widgets, visible focus.
  Calm, uncluttered, saffron-and-ivory feel; Baba's message is simplicity — no gaudy ornament.
- TypeScript is strict with `noUnusedLocals/Parameters` and `erasableSyntaxOnly` (no enums, no
  parameter properties). `verbatimModuleSyntax` → use `import type`.
- Keep diffs inside your owned paths (below). If you need a change in a file you don't own, add
  the smallest possible shim in your own slice and mention it in your final report instead.
- Other agents are editing this repo **at the same moment**. `npx tsc -b` may show errors in files
  you don't own and that are mid-edit — ignore those; make sure **your own files** are clean, and
  re-run at the end. Never run `git` commands that change state (no checkout/reset/stash/clean).
  Do not run `npm install` unless you add a dependency: then add it to the right workspace
  `package.json` and run `npm install` once from the repo root.
- Final report (≤ 200 words): what shipped, routes added, API functions added, anything stubbed /
  untested / needing credentials, files outside your ownership you had to touch.

## Route namespaces (avoid collisions)

Devotee: `/temples`, `/t/:slug` (tenancy) · `/darshan`, `/aarti/:key`, `/recordings` (aarti) ·
`/vrat*`, `/parayan*`, `/teachings*` (devotion) · `/donate`, `/puja/book/:id`, `/my/donations`,
`/my/receipts`, `/my/tax`, `/matching` (giving) · `/shop*`, `/my/orders*`, `/annadanam*`
(fulfilment) · `/community`, `/prayers`, `/groups*`, `/settings/notifications` (community) ·
`/signin`, `/signup` (backend).
Admin: `/temples*` (tenancy, platform role) · `/aarti*` (aarti) · `/devotion/*` ·
`/donations`, `/donations/receipts`, `/giving/*` (giving) · `/shipping*`, `/annadanam*`
(fulfilment) · `/community/*`, `/notifications` (community) · `/signin` (backend).

## Phase map

1. **Phase 1 — Sai product**: tenancy & rebrand, aarti + live darshan, 9-Thursday vrat, parayan,
   teachings, optional nakshatra/gothra, multi-language & multi-currency.
2. **Phase 2 — real backend**: Supabase schema + RLS, OTP auth, Stripe/Razorpay, PDF receipts in
   four tax regimes, notifications (email/SMS/WhatsApp). Needs credentials to go live; ships as
   code + config with mock as the default (`VITE_DATA_MODE=mock|supabase`).
3. **Phase 3 — growth**: prasad/udi shipping, annadanam, community, notification prefs, PWA.
