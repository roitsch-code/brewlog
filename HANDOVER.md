# Session Handover — May 2026

> Snapshot of where the project stands at the end of the long Brew-Flow Light migration + Field v1.1 + Coffee Rotation arc. Read this once when picking up a new Claude session; the persistent rules + tokens live in `CLAUDE.md`. This file is **state**, not policy.

---

## What just shipped (PR #65 → #102)

### Light brew flow — end-to-end ✅
All seven steps migrated and cut over. `/brew/new` resolves through `(light)/brew/new/page.tsx`. Dark `StepScan/StepMode/StepContext/StepRecommend/StepBrew/StepLog/StepSummary/FlowShell/CircularTimer` files **deleted** (~4,300 lines). Light forks under `src/components/flow/LightStep*.tsx` are the only surviving step files.

### Generative Field v1.1 — live ✅
- `src/lib/field/{zones,defaultZones,types,composeGradient,mapNotesToZones,schema,FieldContext}.tsx`
- DB column `coffees.field_zones jsonb` (migration 0008 — **applied on VPS**)
- `<Field>` in `src/components/ui/light/Field.tsx` reads `FieldContext`, paints via `composeFieldGradient(zones, rotation)`
- LightFlowShell drives `useFieldConfig` per step: scan 0°, mode 0°, context 25°, recommend 50°, brew 75°, log 100°, summary 125°
- 23 existing coffees backfilled via `scripts/backfill-field-zones.mjs` — every coffee in the library now has a personal Field
- Brew-Again paths lift `fieldZones` from `coffees.field_zones` (ActionPill, /coffees list, /coffees/[id])

### Generative Field v1.1 — deliberately deferred
- **Phase 4 Variety Fallback** — for coffees with no tasting notes, derive Field from variety knowledge. Currently moot (backfill output: `skipped no notes: 0`) but useful for future no-notes scans.

### Coffee Rotation marker ✅
- DB column `coffees.in_rotation boolean default false` (migration 0009 — **applied on VPS**)
- Star toggle on `/coffees/[id]` under the Brew-this button (optimistic PATCH)
- Greeting prompt's library snapshot prefixes rotation entries with `★ IN ROTATION |`
- New `ROTATION DISCIPLINE` block in the greeting system prompt — prefer rotation bags as the day's invitation
- `/coffees` list does NOT yet surface the rotation marker visually (open item, see below)

### Greeting Haiku — bug fixes
- Time-of-day discipline added to the prompt (no more "Late night" at 18:44)
- Library snapshot uses `formatLibraryForPrompt` (with usage signal) instead of bare roaster+name
- localStorage cache keyed by `brewlog.starter.v3.<date>.<bucket>` — regenerates 5x per day at tod-bucket boundaries instead of once per calendar day
- `/api/greeting` (src/app/api/greeting/route.ts) already passes time-of-day + library snapshot + rotation prefix

### Coffee Library Light migration ✅ (PR #102)
`/coffees` + `/coffees/[id]` moved under `(light)` route group, all surfaces light-tokenised.

### Nearby map ✅ (PR #101)
`/cafes/map` is the new full-screen Map view (Leaflet, dark CartoCDN tiles). `NavigationOverlay` "Nearby" → `/cafes/map`; "Café Library" → `/cafes`. Original `/cafes` is the tabbed list (Cafés + Coffees), no Map tab any more.

### Reference material
- `lovable-v7/` — committed Lovable v7 export. **Excluded from Docker build context** via `.dockerignore` (PR #69). Used by humans when porting per-view content (card labels, footnote copy, exact section counts).

---

## Light route inventory

| Route | State |
|---|---|
| `/` (Home BTTS) | Light ✅ |
| `/past-conversations` + `/past-conversations/[id]` | Light ✅ |
| `/brew/new` | Light ✅ (cut-over PR #95) |
| `/coffees` + `/coffees/[id]` | Light ✅ (PR #102) |
| `/cafes` (tabbed list) | **Dark** ❌ |
| `/cafes/map` (Nearby) | Dark intentionally — dark Carto tiles, full-screen map |
| `/cafes/place/[slug]` | **Dark** ❌ |
| `/cafes/coffee/[id]` | **Dark** ❌ |
| `/brew/[id]` (session detail edit) | **Dark** ❌ |
| `/taste` | **Dark** ❌ |
| `/onboarding` | **Dark** ❌ |
| `/login` | **Dark** ❌ |
| `/library` (hub picker) | **Dark** ❌ (small, low traffic) |

---

## Open punch list

Roughly in priority order. Numbers are Markus' tentative ranking from earlier in this session.

1. **`/coffees` rotation indicator + filter** — list rows don't show the star yet; "Show only rotation" filter would make the list scannable
2. **`/cafes` Light migration** — high-traffic, last big Library surface
3. **`/cafes/place/[slug]` + `/cafes/coffee/[id]` Light** — small follow-ons after `/cafes`
4. **`/taste` Light + RadarChart Light** — taste profile page with AI summary
5. **FlavorWheel Light SVG** — currently Dark inside LightStepLog (jarring but rarely opened, deferred per the migration plan)
6. **`/brew/[id]` Session Detail Light** — reached via SessionCard on /home + diary
7. **Dark `Chip.tsx` removal** — once `/brew/[id]` is Light, the last Dark Chip consumer is gone
8. **LightStepScan Card/Chip primitive refactor** — Markus flagged "many different chip and card designs" earlier; refactor StepScan's custom buttons through the Card + Chip primitives
9. **Aromatic Goal validation** — PR #72 added the aromatic intent to `/api/recommend` but per CLAUDE.md hard rule it needs sample-validation. Markus said "Yes Go" but never explicitly tested recipe outputs. Run 2–3 test brews with goal "Aromatic / Floral" on a delicate coffee (Geisha, Wush Wush, Pink Bourbon) and compare to "Bright / Clarity" on the same bag

---

## Pitfalls discovered (don't re-learn these)

- **Next.js standalone Docker image** does NOT expose `@anthropic-ai/sdk` as `node_modules/@anthropic-ai`. Backfill script started failing with `ERR_MODULE_NOT_FOUND` until rewritten to call the Messages API over plain `fetch`. `pg` IS in standalone deps (traced via Drizzle).
- **`lovable-v7/` must be in `.dockerignore`**. Without it the Docker `COPY . .` drags the Vite-targeted Lovable export into the build context and Next.js's worker tries to compile it → `react-router-dom not found` → deploy fails. Fix in PR #69.
- **Drizzle SELECT * is column-strict.** Adding `coffees.in_rotation` to the schema BEFORE running the SQL migration on the VPS made `/api/coffees` 500 with "column in_rotation does not exist". Coffee Library appeared empty (Markus' bug report between PR #97 and #99). Migrations must be applied to the DB BEFORE the schema/code that references them deploys.
- **`min-h-full flex flex-col` does not give children definite height.** `flex-1` inside collapses to 0. Leaflet container needed `h-dvh flex flex-col` + `flex-1 min-h-0` (PR #101).
- **The `[data-light-scope]` CSS shim** in globals.css catches inline `var(--card)` etc. for un-migrated components inside the Light tree — but NOT hardcoded hex values like `#2A241C`. Those need explicit Light tokens at the source.
- **CSS `filter: brightness(0)` under `[data-light-scope]`** is the trick used to invert hardcoded-white SVGs (BrewMethodIcon assets, original CoffeeBeanGlow) without forking the components.
- **localStorage starter cache.** Versioned key `brewlog.starter.v3.<date>.<bucket>`. Bumping the version is the canonical invalidation. If you change the greeting prompt, bump the cache to `v4`.
- **Hard Rule on AI behavior changes.** Any prompt / model / schema-enum change to `/api/recommend`, `/api/greeting`, `/api/match`, etc. needs sample-before-after outputs per `CLAUDE.md`. Cannot validate from this remote env — Markus runs on the deployed PWA.
- **Auto-deploy** is GitHub Actions → SSH → Hetzner (`.github/workflows/deploy.yml`). Direct push to `main` blocked; PR-only workflow with `enable_pr_auto_merge` (mergeMethod SQUASH).
- **Manual migrations.** SQL files in `src/lib/db/migrations/` are NOT auto-applied. Run on VPS per CLAUDE.md: `cat src/lib/db/migrations/00XX_*.sql | docker compose exec -T postgres psql -U brewlog -d brewlog`. The Drizzle journal only tracks `0000_init`.

---

## Where files live

```
src/
├── app/
│   ├── (light)/                ← Light route group (LightShell wraps these)
│   │   ├── page.tsx            ← Home BTTS
│   │   ├── layout.tsx          ← Wraps in LightShell
│   │   ├── brew/new/page.tsx   ← Brew flow step switcher
│   │   ├── coffees/
│   │   │   ├── page.tsx        ← Library list
│   │   │   └── [id]/page.tsx   ← Coffee detail
│   │   └── past-conversations/
│   ├── api/                    ← API routes (greeting, analyze-bag, recommend, etc.)
│   ├── cafes/                  ← Dark — list, map, place, coffee
│   ├── brew/[id]/              ← Dark session detail
│   ├── taste/                  ← Dark taste profile
│   ├── login/, onboarding/, library/
│   └── globals.css             ← [data-light-scope] shims live here
├── components/
│   ├── flow/                   ← LightStep*.tsx (the seven brew steps)
│   ├── ui/
│   │   ├── light/              ← Light primitives (Card, Section, Footnote, Hero,
│   │   │                          CTA, CTAWarmth, Chip, LightFlowShell, LightShell,
│   │   │                          Field, StarRating, CircularTimer, CoffeeBeanGlow,
│   │   │                          ActionPill, ChatInput, ChatThread,
│   │   │                          NavigationOverlay, AttachmentSheet,
│   │   │                          ReferenceCoffeePicker)
│   │   └── *.tsx               ← Dark primitives still consumed by Dark routes
│   ├── cafes/CafeMap.tsx       ← Leaflet map (used by /cafes/map)
│   └── session/SessionCard.tsx ← Dark — used on /home diary feed
├── lib/
│   ├── field/                  ← v1.1 zones, types, defaultZones, schema,
│   │                              composeGradient, FieldContext, mapNotesToZones
│   ├── claude/                 ← recommend.ts, analyzeBag.ts, escher.ts, etc.
│   ├── db/                     ← schema.ts (Drizzle), helpers.ts (rowToCoffee),
│   │                              migrations/0008_add_field_zones.sql,
│   │                              migrations/0009_add_in_rotation.sql
│   └── types/                  ← coffee.ts, session.ts, cafes.ts, preferences.ts
└── store/
    └── flowStore.ts            ← Zustand brew flow state + fieldZones slot

scripts/
├── backfill-field-zones.mjs    ← v1.1 Phase 5 — already ran on prod (23/23)
└── (existing migrate-/seed- scripts)

lovable-v7/                     ← Read-only design reference, .dockerignore'd
specs/                          ← design-system-v1.0.md, v1.1-generative-field.md
docs/                           ← coffee-experts.md (mirror of lib/knowledge),
                                    grind-settings.md
```

---

## Conventions cheat sheet

- **Tokens:** `text-light-foreground` (anthracite), `text-light-muted-foreground`, `bg-light-card-default` (cream glass), `bg-light-card-selected` (warm taupe), `border-light-foreground/15`, `shadow-light-card-pressed`
- **Cream highlight on dark elements:** `text-[hsl(36_55%_96%)]` (e.g. CTA text on anthracite button)
- **Hero question:** `font-fraunces font-semibold text-[40px] leading-[1.05] tracking-[-0.01em]`
- **Eyebrow:** `.label-eyebrow` utility (Chivo 11/600 uppercase tracked 0.14em)
- **Field rotation per step:** see `STEP_ROTATION` map in LightFlowShell.tsx
- **Light scope marker:** `[data-light-scope]` attribute set by LightShell wraps everything in the (light) route group. Use it for CSS rules that should ONLY apply to Light routes.

---

## Live state on VPS (verified)

```
sessions          → indexed feed table
coffees           → 23 rows, all with field_zones populated (Phase 5 done)
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

Ask Markus what's on the punch list. Most likely candidates: `/cafes` Light migration (#2 above) or `/taste` Light (#4). Both are scoped similarly — single-page refactors with the same sed-driven token mapping pattern used for `/coffees`.

Before any prompt changes to `/api/greeting`, `/api/recommend`, etc.: read the **Hard Rule on AI behaviour changes** in CLAUDE.md. Sample real outputs on the deployed PWA — Markus will validate.

Read **`CLAUDE.md`** as the persistent context, this file only for the in-flight state.
