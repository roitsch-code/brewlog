# Session Handover — May 2026

> Snapshot at the end of the Light migration arc. Read this once when picking up a new Claude session; persistent rules + tokens live in `CLAUDE.md`. This file is **state**, not policy.

---

## The headline: Light migration is done

Every visited route now lives in `(light)/` and renders with the BTTS Light theme (Cream + Fraunces/Chivo + anthracite + generative Field). The single Dark route left is `cafes/map/page.tsx` — intentional, because Leaflet's CartoCDN dark tiles fit the full-screen map.

### What shipped this arc (PR #113 → #137)

**Routes migrated**
- `/brew/[id]` Session Detail (PR #122) — Brew-method as headline, Field carries from `/coffees/[id]` via `lib/field/cache.ts`, sections styled like the coffee detail
- `/cafes` + `/cafes/place/[slug]` + `/cafes/coffee/[id]` (PR #134) — Cafés tab uses text-only Light cards (no photo in `CafeSummary`); Coffees tab uses the same full-bleed photo-strip card as Coffee Library; inline edit panel restyled
- `/login` + `/onboarding` (PR #135) — Light tokens throughout, Onboarding selectors use the `Chip` primitive
- `/taste` (PR #136) — Light Header + burger, FlavorWheel radar now renders on cream, bar charts use anthracite fills on `foreground/10` tracks
- `/loading` global state (PR #137) — Light CoffeeBeanGlow on inline cream bg so route transitions don't flash dark before LightShell mounts

**Architectural fixes**
- `/coffees/[id]` adopts its own Field via `useFieldConfig` (PR #123) — was only handing zones to flowStore for the brew flow, the detail page itself never painted in the cup's colours
- `lib/field/cache.ts` (PR #125) — sessionStorage cache keyed by session id. `/coffees/[id]` pre-warms for all its sessions on load; `/brew/[id]` reads synchronously on mount. Removes the ~300 ms flash through default while the coffee fetch resolved
- SessionCard rewrite (PR #120) — Brew-method as headline, recipe meta line (date · dose · water · time), Light flavor chips, swipe-to-delete fades in with swipe progress (PR #124) instead of bleeding through the translucent card at rest
- Coffee Library card architecture (PRs #127, #132, #133) — full-bleed 96 px photo strip on the left (was a 56 px circular thumb with an unreadable 8 px count badge), brew count moves to the right column above the Brew CTA, both centered on the same vertical axis
- Rotation gates the Brew CTA (PR #117) — out-of-rotation rows have no Brew shortcut; star indicator on rotation rows in the library list
- Hero scrim flip on `/coffees/[id]` (PR #121) — cream-to-transparent instead of `.card-scrim`'s black-to-near-opaque (Dark utility) so anthracite titles stay legible on any bag photo
- Brew session back goes to `/coffees/[coffeeId]` (PR #126) with `router.back()` as a fallback for legacy sessions whose `CoffeeIdentity` was persisted before `coffeeId` existed

**FlavorWheel Light (PRs #128–#131)**
- Direct conversion (no theme prop). Canvas transparent; cream-glass panels; anthracite text + icons via `currentColor`. Whole-wedge tonal state — tapping a category darkens both rings together. Thin cream ring divider between inner and outer; stroke weights tuned to 0.8 / 0.5 viewport units to match the label typography weight.

**PWA chrome (PRs #113–#119)**
- `themeColor: #D4B8C9` (soft mauve-pink) on viewport AND `manifest.json` — Android PWA + Safari URL bar tints mauve
- `manifest.background_color: #F3E5DC` (cream) — Android splash matches the Field base, no black flash
- `appleWebApp.statusBarStyle: "default"` (was `black-translucent`) — iOS PWA gets an opaque system status bar instead of the see-through one that exposed a hard color cut
- `html { background-color: #F3E5DC }` — the canvas under the Field is now cream, so even if the gradient is thin at the very top pixels (status bar area extended under the webview via `viewportFit: cover`), no dark bleed-through

**Chip vocabulary unified (PR #126, #127)**
- One static-tag style across SessionCard, `/coffees/[id]` (Bag notes + You taste), `/brew/[id]` flavor notes + Pill component, LightStepSummary, Café Library, Café detail: `px-3 py-1.5`, 12 px medium, `bg-light-card-default` + backdrop blur, anthracite text — matches the `Chip` primitive's default state used in `LightStepLog`.

**Cleanup (PR #137)**
- Deleted: `RadarChart.tsx` (orphan), Dark `Chip.tsx` (orphan), `BottomNav.tsx` (allowlist empty since #136)
- Simplified: `ScrollContainer` (no allowlist, no nav-padding reserve), `loading.tsx` (Light + inline cream bg)
- Dropped from globals.css: `--nav-bottom-padding` CSS var
- Kept (still consumed): Dark `CoffeeBeanGlow` (via `PhotoUpload` + CSS shim), Dark `StarRating` (via `CafeMap` for the intentional-Dark map page)

---

## Where files live now

```
src/
├── app/
│   ├── (light)/                ← Every visited route (LightShell wraps via layout.tsx)
│   │   ├── page.tsx            ← Home BTTS
│   │   ├── layout.tsx          ← LightShell
│   │   ├── brew/
│   │   │   ├── new/page.tsx    ← Brew flow step switcher
│   │   │   └── [id]/page.tsx   ← Session detail (Light per #122)
│   │   ├── coffees/
│   │   │   ├── page.tsx        ← Library list (photo-strip cards)
│   │   │   └── [id]/page.tsx   ← Coffee detail + rotation toggle
│   │   ├── cafes/
│   │   │   ├── page.tsx        ← Café Library (tabbed)
│   │   │   ├── place/[slug]/   ← Single café + inline edit
│   │   │   └── coffee/[id]/    ← Coffee tasted out
│   │   ├── taste/page.tsx      ← Taste profile + FlavorWheel radar
│   │   ├── login/page.tsx
│   │   ├── onboarding/page.tsx
│   │   └── past-conversations/
│   ├── cafes/map/page.tsx      ← Only Dark route left (intentional)
│   ├── loading.tsx             ← Light cream bg + Light bean
│   ├── layout.tsx              ← Root: PWA meta + ScrollContainer
│   ├── api/                    ← API routes
│   └── globals.css             ← [data-light-scope] shims live here
├── components/
│   ├── flow/                   ← LightStep*.tsx (seven brew steps)
│   ├── ui/
│   │   ├── light/              ← Light primitives (LightShell, Field, Card,
│   │   │                          Section, Footnote, Hero, CTA, CTAWarmth,
│   │   │                          Chip, ActionPill, ChatInput, ChatThread,
│   │   │                          NavigationOverlay, AttachmentSheet,
│   │   │                          ReferenceCoffeePicker, StarRating,
│   │   │                          CircularTimer, CoffeeBeanGlow)
│   │   ├── FlavorWheel.tsx     ← Light palette in place (no fork)
│   │   ├── PhotoUpload.tsx     ← Uses Dark CoffeeBeanGlow + CSS-shim invert
│   │   ├── StarRating.tsx      ← Dark — only CafeMap consumes it
│   │   └── …                   ← Shared neutrals (Button, NumberStepper, etc.)
│   ├── layout/
│   │   ├── ScrollContainer.tsx ← Root wrapper (100dvh + hidden scroll)
│   │   └── BottomSpacer.tsx
│   ├── cafes/CafeMap.tsx       ← Leaflet (used by /cafes/map only)
│   └── session/SessionCard.tsx ← Light — only /coffees/[id] All-brews uses it
├── lib/
│   ├── field/                  ← v1.1 zones, types, defaultZones, schema,
│   │                              composeGradient, FieldContext, mapNotesToZones,
│   │                              cache.ts (NEW — session-id keyed Field hint)
│   ├── claude/                 ← recommend.ts, analyzeBag.ts, escher.ts, …
│   ├── db/                     ← schema.ts (Drizzle), helpers.ts (rowToCoffee),
│   │                              migrations/00xx_*.sql
│   └── types/                  ← coffee.ts, session.ts, cafes.ts, preferences.ts
└── store/
    └── flowStore.ts            ← Zustand brew flow state + fieldZones slot
```

---

## Open items

Roughly in priority order:

1. **`/coffees` "Show only rotation" filter** — list shows the star indicator (#117) but no filter toggle. A 4th pill alongside Recent / Favorites / Roaster, or a sub-toggle. Small, scoped.
2. **`LightStepScan` Card/Chip refactor** — 1400 lines with bespoke buttons that should route through the `Card` + `Chip` primitives. Code quality only; no visible UX change. Big diff, low risk.
3. **Aromatic Goal validation** — PR #72 added the intent to `/api/recommend`. Per the Hard Rule on AI behavior changes (CLAUDE.md), it needs sample-before/after on the deployed PWA against a delicate coffee (Geisha, Wush Wush, Pink Bourbon). Markus said "Yes Go" but never explicitly tested recipe outputs.

---

## Pitfalls discovered (don't re-learn these)

- **iOS PWA caches `apple-mobile-web-app-status-bar-style` at install time.** Changing the meta tag does not update an already-installed PWA on iPhone. The user has to delete the PWA from the home screen AND clear Safari → Advanced → Website Data for the domain, then re-install. The same applies to `theme_color` on installed Android PWAs in some browsers — Service Workers can cache `manifest.json` (precached with revision hash) so a fresh manifest doesn't reach the chrome until the SW updates.
- **Tailwind only scans `src/{app,components,pages}`.** `src/lib/**` is NOT in `tailwind.config.ts` `content`. Utility classes that live only in lib (e.g. arbitrary-value classes like `bg-[linear-gradient(...)]`) are silently never generated and vanish at runtime. If you need a shared visual constant in lib, export it as a raw CSS value and apply via inline `style={{ background: ... }}` at the call site (see `src/lib/theme/gradients.ts`).
- **html canvas default.** `html { background-color: #F3E5DC }` (cream). `body { background-color: #0E0B0A }` by default, dropped to `transparent` only when `body:has([data-light-scope="true"])` matches. Light routes therefore show the cream canvas behind the Field; the legacy Dark `cafes/map` keeps its dark body. Loading state explicitly sets `background: #F3E5DC` inline because it renders BEFORE LightShell mounts.
- **Next.js standalone Docker image** does NOT expose `@anthropic-ai/sdk` as `node_modules/@anthropic-ai`. Backfill script started failing with `ERR_MODULE_NOT_FOUND` until rewritten to call the Messages API over plain `fetch`. `pg` IS in standalone deps (traced via Drizzle).
- **`lovable-v7/` must be in `.dockerignore`.** Without it the Docker `COPY . .` drags the Vite-targeted Lovable export into the build context and Next.js's worker tries to compile it → `react-router-dom not found` → deploy fails (PR #69).
- **Drizzle SELECT * is column-strict.** Adding a column to the schema BEFORE running the SQL migration on the VPS makes `/api/coffees` 500 with "column does not exist". Migrations must be applied to the DB BEFORE the schema/code that references them deploys.
- **`min-h-full flex flex-col` does not give children definite height.** `flex-1` inside collapses to 0. Leaflet container needed `h-dvh flex flex-col` + `flex-1 min-h-0` (PR #101).
- **The `[data-light-scope]` CSS shim** in `globals.css` catches inline `var(--card)` etc. for un-migrated components inside the Light tree — but NOT hardcoded hex values like `#2A241C`. Those need explicit Light tokens at the source.
- **CSS `filter: brightness(0)` under `[data-light-scope]`** is the trick used to invert hardcoded-white SVGs (`BrewMethodIcon` assets, original `CoffeeBeanGlow`) without forking the components.
- **localStorage starter cache.** Versioned key `brewlog.starter.v4.<date>.<bucket>`. Bumping the version is the canonical invalidation. If you change the greeting prompt, bump the cache to `v5`.
- **Hard Rule on AI behavior changes.** Any prompt / model / schema-enum change to `/api/recommend`, `/api/greeting`, `/api/match`, etc. needs sample-before-after outputs per `CLAUDE.md`. Cannot validate from this remote env — Markus runs on the deployed PWA.
- **Auto-deploy** is GitHub Actions → SSH → Hetzner (`.github/workflows/deploy.yml`). Direct push to `main` blocked; PR-only workflow with `enable_pr_auto_merge` (mergeMethod SQUASH).
- **Manual migrations.** SQL files in `src/lib/db/migrations/` are NOT auto-applied. Run on VPS per CLAUDE.md: `cat src/lib/db/migrations/00XX_*.sql | docker compose exec -T postgres psql -U brewlog -d brewlog`. The Drizzle journal only tracks `0000_init`.

---

## Conventions cheat sheet

- **Tokens:** `text-light-foreground` (anthracite), `text-light-muted-foreground`, `bg-light-card-default` (cream glass), `bg-light-card-selected` (warm taupe), `border-light-foreground/15`, `shadow-light-card-pressed`
- **Cream highlight on dark elements:** `text-[hsl(36_55%_96%)]` (e.g. CTA text on anthracite button)
- **Destructive (delete, error):** `bg-[hsl(12_70%_45%)]` warm rust — used by SessionCard swipe-delete + brew-session delete confirm modal
- **Hero question:** `font-fraunces font-semibold text-[40px] leading-[1.05] tracking-[-0.01em]`
- **Headline (route title):** `font-fraunces text-3xl text-light-foreground leading-none`
- **Eyebrow:** uppercase tracked, `text-light-muted-foreground text-xs tracking-widest`
- **Unified chip / tag:** `inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-medium leading-tight backdrop-blur-light-card backdrop-saturate-150 bg-light-card-default text-light-foreground`
- **Field rotation per brew step:** see `STEP_ROTATION` map in `LightFlowShell.tsx`
- **Light scope marker:** `[data-light-scope]` attribute set by LightShell wraps everything in the (light) route group. Use it for CSS rules that should ONLY apply to Light routes.

---

## Live state on VPS (verified 2026-05)

```
sessions          → indexed feed table
coffees           → 23 rows, all with field_zones populated
coffees.in_rotation column exists (migration 0009 applied)
places            → 6,202 rows (manual bulk load, no Git seed)
preferences       → user equipment + grinder + location
roasters          → custom roaster priors
knowledge         → seed-insights.mjs populated
coffee_alerts     → user subscriptions
auth_credentials  → WebAuthn passkey
conversations + conversation_messages → BTTS chat history
```

---

## Where to start next session

Light migration is closed. Most likely next moves: (1) Rotation filter on `/coffees`, (2) `LightStepScan` refactor for code quality, (3) Aromatic Goal validation on the deployed PWA. Any of these is scoped enough for a single session.

Before any prompt change to `/api/greeting`, `/api/recommend`, etc.: read the **Hard Rule on AI behaviour changes** in CLAUDE.md. Sample real outputs on the deployed PWA — Markus validates.

Read **`CLAUDE.md`** as the persistent context; this file only for the in-flight state.
