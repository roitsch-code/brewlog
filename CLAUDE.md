# BrewLog — Claude Code Context

Personal coffee brew advisor & diary PWA. Next.js 14 App Router + Postgres + Claude AI + Hetzner.

---

## Infrastructure

| What | Detail |
|------|--------|
| **VPS** | Hetzner, IP `89.167.31.219`, path `/opt/brewlog` |
| **Stack** | Docker Compose: `postgres`, `app` (Next.js), `caddy` (reverse proxy), `ofelia` (cron) |
| **Vercel** | **Deleted.** App is 100% on Hetzner. No Vercel, no Vercel env vars, nothing. |
| **Auto-deploy** | `.github/workflows/deploy.yml` — pushes to `main` trigger SSH deploy on VPS |
| **Auto-deploy secrets** | `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH` in GitHub repo secrets |

**Manual deploy (fallback):** SSH into VPS → `cd /opt/brewlog && git pull origin main && docker compose build app && docker compose up -d app`

**Running a new SQL migration:** After deploying code that adds a new migration file, SSH into the VPS and run:
```bash
cd /opt/brewlog && cat src/lib/db/migrations/0001_add_places.sql | docker compose exec -T postgres psql -U brewlog -d brewlog
```
Replace the filename with the actual migration file. You should see `INSERT 0 N` or `CREATE TABLE` confirming success. This only needs to be done once per migration.

**Type-check before every commit:** `npx tsc --noEmit`

---

## Project Structure & Key Files

### Pages (`src/app/`)

Routes are split between the **`(light)` route group** (BTTS Light theme — Cream background, Fraunces/Chivo, anthracite foreground, generative Field) and the legacy **Dark** surfaces still pending migration. The `(light)` segment is URL-invisible — `/coffees` resolves through `(light)/coffees/page.tsx`. `LightShell` wraps everything in the group and sets the `[data-light-scope]` data attribute used by the CSS shim in `globals.css`.

| Route | Theme | Purpose |
|-------|-------|---------|
| `(light)/page.tsx` | Light | Home BTTS — daily greeting, Action Pill (Brew-Again candidates), inline AI chat over `/api/explore-agent` |
| `(light)/layout.tsx` | — | Wraps `(light)` group in `LightShell` (sets `[data-light-scope]`) |
| `(light)/past-conversations/page.tsx` | Light | Conversation history list (archived chats) |
| `(light)/past-conversations/[id]/page.tsx` | Light | Single past conversation thread (read-only replay) |
| `(light)/brew/new/page.tsx` | Light | Multi-step brew flow — routes `flowStore.step` to the right `LightStep*` component |
| `(light)/coffees/page.tsx` | Light | Coffee library — searchable list (burger top-right, no BottomNav) |
| `(light)/coffees/[id]/page.tsx` | Light | Coffee detail — Field + Brew-this CTA + rotation star toggle + rating history + brew signatures |
| `layout.tsx` | — | Root layout: auth check, PWA meta tags, font preloads |
| `login/page.tsx` | Dark | Passkey (WebAuthn) login UI |
| `onboarding/page.tsx` | Dark | First-run equipment / grinder / preferences wizard |
| `brew/[id]/page.tsx` | Dark | Read-only session detail (reached from SessionCard on /home diary) |
| `cafes/page.tsx` | Dark | Café Library — tabbed list (Cafés + Coffees tasted out) |
| `cafes/map/page.tsx` | Dark *(intentional)* | Nearby — full-screen Leaflet map (CartoCDN dark tiles); needs `h-dvh flex flex-col` + `flex-1 min-h-0` so Leaflet gets a non-zero container |
| `cafes/place/[slug]/page.tsx` | Dark | Individual café detail (menu, coffees tasted) |
| `cafes/coffee/[id]/page.tsx` | Dark | Coffee tasted at an external location |
| `taste/page.tsx` | Dark | Taste profile + AI-written summary + RadarChart |
| `library/page.tsx` | Dark | Navigation hub (small, low-traffic) |

Removed in the BTTS Light arc: legacy `page.tsx` (Dark home, replaced by `(light)/page.tsx`), `match/page.tsx` + `/api/match` (taste-match flow folded into `/api/explore-agent`), `explore/page.tsx` (replaced by inline chat on home). See HANDOVER.md for the punch-list of Dark routes still pending Light migration.

### API Routes (`src/app/api/`)

| Route | Purpose |
|-------|---------|
| `auth/login-challenge` | WebAuthn: generate login challenge |
| `auth/register-challenge` | WebAuthn: generate registration challenge |
| `auth/login` | WebAuthn: complete login |
| `auth/register` | WebAuthn: complete registration |
| `auth/logout` | Invalidate session cookie |
| `auth/status` | Check auth state |
| `auth/reset-passkey` | Re-enroll a passkey (clear + register) |
| `sessions` | ★ Core CRUD — GET (paginated feed) / POST new session |
| `sessions/[id]` | GET / PUT / DELETE individual session |
| `coffees` | GET library / POST new coffee |
| `coffees/[id]` | GET / PUT / DELETE individual coffee |
| `coffees/compact` | Lightweight list (id, roaster, name, photo) for dropdowns |
| `recommend` | ★ POST coffee + context → 2–4 AI brew recipe candidates |
| `analyze-bag` | Claude Vision → coffee identity from bag photo |
| `analyze-bag/clarify` | Follow-up clarification on extracted bag data |
| `analyze-url` | Scrape & analyze a coffee product page URL |
| `brew-insight` | AI terrain/pattern one-liner for post-brew screen |
| `taste-summary` | AI written summary of taste evolution across sessions |
| `greeting` | ★ Haiku daily-starter for the BTTS Home — time-of-day-aware, references rotation bags. Cached client-side by `(date, time-bucket)` |
| `conversations` | GET list / POST new conversation |
| `conversations/[id]` | GET / PUT / DELETE individual conversation thread |
| `conversations/active` | GET the currently-active conversation (live thread on /home) |
| `conversations/archive` | POST → move the active conversation to past-conversations |
| `explore` | AMA conversational exploration with sources (legacy; no page consumer left) |
| `explore-agent` | ★ Agent loop with tool-use (`search_places`, `fetch_page`, `analyze_image`, `suggest_navigation`) — powers the inline chat on `(light)/page.tsx` |
| `research` | Weekly deep-research cron agent (Ofelia) |
| `preferences` | GET / POST user preferences (equipment, grinder, location) |
| `roasters` | GET / POST roaster profiles |
| `roasters/generate` | AI-generate roaster style summary |
| `places` | GET / POST café locations (auto-geocodes via Nominatim/OSM on POST) |
| `cafes` | GET aggregated café summary across sessions (visit count, avg rating, last visited) |
| `upload` | Multipart photo → Hetzner S3, returns URL |
| `voice/synthesize` | POST text → ElevenLabs TTS audio |
| `voice/transcribe` | POST audio → ElevenLabs Scribe STT transcript |
| `insights` | GET curated articles from knowledge base |
| `hints` | GET contextual brewing hints |
| `news` | GET coffee news feed |
| `questions` | GET suggestion questions for explore mode |
| `alerts` | GET / POST coffee availability alert subscriptions |
| `webhooks/coffee-alert` | Incoming webhook for coffee availability notifications |
| `admin/seed` | Populate knowledge base (run once on new installs) |

### Components

**Flow steps (`src/components/flow/`):**

All Light. The Dark `Step*.tsx` files (`FlowShell`, `StepMode`, `StepScan`, `StepContext`, `StepRecommend`, `StepBrew`, `StepLog`, `StepSummary`, `StepMatchResult`) were deleted in PR #95 (~4,300 lines) when `/brew/new` cut over to Light.

| Component | Purpose |
|-----------|---------|
| `LightStepMode.tsx` | Home Brew / Coffee Shop / Taste Match selector |
| `LightStepScan.tsx` | ★ Camera / photo upload / URL / manual + AI bag extraction + roaster Q&A (1400+ lines — biggest step) |
| `LightStepContext.tsx` | Occasion, water amount, time, mood, equipment, aromatic goal |
| `LightStepRecommend.tsx` | 2–4 AI recipe candidates with reasoning |
| `LightStepBrew.tsx` | ★ Circular timer + real-time pour guide (Web Audio cue + vibrate on step change) |
| `LightStepLog.tsx` | Post-brew: flavor wheel, star rating, tasting notes |
| `LightStepSummary.tsx` | Review + save session |

**Light UI primitives (`src/components/ui/light/`):**
`LightShell` (wraps `(light)` group, sets `[data-light-scope]`), `LightFlowShell` (drives `useFieldConfig` per step, scrolls top on step change), `Field` (reads FieldContext → renders `composeFieldGradient(zones, rotation)` fixed -z-10), `Card`, `Section`, `Footnote`, `Chip`, `Hero` (eyebrow + Fraunces 40px question), `CTA` (anthracite button + cream text), `CTAWarmth`, `ActionPill` (Brew-Again candidates on home), `ChatInput`, `ChatThread`, `AttachmentSheet`, `NavigationOverlay` (full-screen menu — Home / Past Conversations / New Session / Coffee Library / Nearby / Café Library / Taste Profile), `ReferenceCoffeePicker`, `StarRating` (rotation toggle + log rating), `CircularTimer` (Light fork — anchored to Date.now, visibility-snap), `CoffeeBeanGlow` (anthracite stroke fork).

**Dark UI primitives (`src/components/ui/`):**
`Button`, `Chip`, `CoffeeBeanGlow`, `FlavorWheel` (still Dark inside `LightStepLog` — opt-in, deferred), `BrewMethodIcon` (inverted via `[data-light-scope] { filter: brightness(0) }` shim instead of forking), `NumberStepper`, `PhotoUpload`, `PlaceSearch`, `ProgressDots`, `RadarChart`, `StarRating`, `ThinkingDots`, `WaveformBars`.

**Layout (`src/components/layout/`):**
`BottomNav` (allowlist: `/taste`, `/library`, `/cafes` only — Light routes opt out), `ScrollContainer`, `BottomSpacer`

**Session:** `SessionCard` (Dark, used on home diary feed)
**Cafés:** `CafeMap` (Leaflet — consumed by `/cafes/map`)

### `src/lib/`

```
lib/
├── coffeeHints.ts          # Static contextual brewing hints used by /api/hints
├── auth/
│   ├── requireAuth.ts      # Server helper: throws if no valid session cookie
│   └── session.ts          # JWT session cookie create/verify (jose)
├── claude/
│   ├── recommend.ts        # ★ Full system prompt + recipe generation
│   ├── analyzeBag.ts       # Vision prompt + BagAnalysisResult type
│   ├── escher.ts           # Pattern/terrain interpreter (Escher insights)
│   ├── extractor.ts        # Cross-session pattern extraction
│   ├── brewSignature.ts    # Weighted brew signature per coffee/method
│   ├── patterns.ts         # Pace, craft approach, occasion patterns
│   ├── historyUtils.ts     # ★ Timing stats + buildHistorySummary + buildRecentRecipes (compact dose/water/grind/temp/timing per session)
│   ├── userProfile.ts      # ★ loadUserProfile() reads preferences table; formatProfileForPrompt() builds the cached "About you" system block
│   ├── coffeeLibrary.ts    # loadCoffeeLibraryCompact() + formatter — last 30 bags for "what should I open?" questions
│   ├── translate.ts        # Tasting notes ↔ SCA flavor wheel taxonomy
│   └── parseJson.ts        # Safe Claude JSON parsing with Zod
├── types/
│   ├── session.ts          # ★ Core data model (all interfaces)
│   ├── coffee.ts           # Coffee-specific types
│   ├── preferences.ts      # UserPreferences interface
│   └── cafes.ts            # CafeSummary + PlaceCoordinates
├── db/
│   ├── schema.ts           # Drizzle table definitions (9 tables)
│   ├── client.ts           # Lazy Drizzle client + pg Pool
│   └── helpers.ts          # rowToSession, rowToCoffee converters
├── db/migrations/
│   ├── 0000_init.sql                      # All core tables + indexes (only file registered in meta/_journal.json)
│   ├── 0001_add_places.sql                # creates places table; historic seed data, irrelevant in prod
│   ├── 0002_add_place_coords.sql          # lat/lng columns on places
│   ├── 0004_add_cologne_places.sql        # (0003 is intentionally absent)
│   ├── 0005_cologne_specialty_places.sql
│   ├── 0006_add_what_to_explore.sql       # preferences column for explore prompts
│   ├── 0007_add_conversations.sql         # conversations + conversation_messages tables
│   ├── 0008_add_field_zones.sql           # coffees.field_zones jsonb (Field v1.1 persistence)
│   └── 0009_add_in_rotation.sql           # coffees.in_rotation boolean (rotation marker)
│   # NOTE: 0001+ are applied manually via `psql` on the VPS — Drizzle journal does not track them.
│   # Applying schema/code that references a new column BEFORE running the migration on the VPS
│   # makes Drizzle SELECT 500 (column-strict). Always migrate VPS first, deploy code second.
│   # The real places dataset (6,202 rows, verified 2026-05-09) lives only in Production; no seed file in Git.
├── field/                     # ★ Generative Field v1.1 — coffee-driven background gradient
│   ├── types.ts               # FieldZone, FieldZoneId, FieldConfig types
│   ├── zones.ts               # 6-zone perceptual palette (fruity-bright, fruity-deep, floral, nutty-cocoa, spice-earth, sweet-caramel)
│   ├── defaultZones.ts        # Fallback composition for coffees with no Field yet
│   ├── composeGradient.ts     # zones + rotation → CSS radial/conic gradient sandwich
│   ├── schema.ts              # Zod schema for persisted field_zones
│   ├── mapNotesToZones.ts     # Haiku call: tasting notes → weighted zone composition
│   └── FieldContext.tsx       # React Context Provider + useFieldConfig() hook
│   # Consumed by <Field> (src/components/ui/light/Field.tsx) and LightFlowShell.
│   # LightFlowShell rotates 25° per brew step (scan 0° → context 25° → recommend 50° → brew 75° → log 100° → summary 125°).
├── knowledge/
│   ├── insights.ts / news.ts / hints.ts / questions.ts / alerts.ts
│   ├── recipes/            # ★ Structured recipe corpus — 7 WBrC/WAC champions (Kasuya 2016, Du 2019, Hsu 2022, Medina 2023, Wölfl 2024, Peng 2025, Stanica WAC 2024) + 11 reference recipes (Hoffmann V60/Clever/AeroPress/Moccamaster/Iced, Kasuya 4:6, Rolf, Gagné, Perger, Rao, Hatakeyama, Wallgren, Turbo). Full pour mechanics with per-step durations, staged temperatures, attribution, sources, verified flag. selectRecipes() injected into /recommend per turn.
│   ├── varieties/          # ★ ~25 WCR-grounded variety priors. Bourbon family (Bourbon, Caturra, Catuai, Mundo Novo, Pacas, Yellow Bourbon, Pink Bourbon), Typica family (Typica, Java, Maragogype, Sumatra), Ethiopia landrace (Heirloom, Wush Wush, Chiroso, Sidra), Geisha, SL series (SL28, SL34, Ruiru 11, Batian), F1 / disease-resistant (Castillo, Tabi, Centroamericano), Pacamara, Mokka. Pink Bourbon flagged per WCR 2024 finding it's NOT a Bourbon mutation. Sidra origin marked as disputed. getVarietyPriorsForBag() injected into /recommend, /explore, /explore-agent.
│   ├── techniques/         # ★ 18 atomic brewing moves citable by id. Temperature (Hsu/Peng staged-temp, Hedrick Turbo, Gagné second-sweet-spot), agitation (Rao spin, Hoffmann swirl-not-stir, Perger high-extraction, Rolf minimal, Peng Melodrip, Bailey/Hoffmann water-first), pour-pattern (Kasuya 4:6, Rao thirds), pre-brew (Wallgren sieving, Peng three-roast layering, Hatakeyama roast-tailored filter), post-brew (Hoffmann/Stanica bypass, flash chilling), AeroPress inversion, Hendon low-mineral water. Each cross-references exemplifying recipe IDs. Compact id+description list injected per turn.
├── roasters/priors.ts      # ★ 50+ curated roaster style priors; getRoasterPrior() + formatRoasterPriorForPrompt() consumed by /recommend AND /explore
├── constants/
│   ├── brewMethods.ts / flavorTaxonomy.ts / scaFlavorWheel.ts
│   └── grindSettings.ts    # ★ Single source of Niche Zero degrees — replaces hardcoded copies in CLAUDE.md / docs / prompts
├── theme/
│   └── gradients.ts        # Shared gradient tokens (CSS strings) used across pages
├── storage/s3.ts           # Hetzner Object Storage (S3-compatible)
└── utils/
    ├── cn.ts / safeFetch.ts / formatTime.ts / pourSequence.ts
    └── pourSequence.test.mjs  # node --test suite for pour math
```

### Other key files

| File | Purpose |
|------|---------|
| `src/store/flowStore.ts` | ★ Zustand brew flow state (sessionStorage-persisted) |
| `src/hooks/useWakeLock.ts` | Keep screen on during active brew |
| `src/hooks/useVoiceCapture.ts` | Mic recording + level metering for inline-chat voice input (BTTS Home) |
| `src/hooks/useVoicePlayback.ts` | Streaming TTS playback for inline-chat voice output (BTTS Home) |
| `src/middleware.ts` | Auth check + redirects |
| `.claude/hooks/session-start.sh` | Web Claude Code session bootstrap — runs `npm install` so tools work on cold start (gated on `$CLAUDE_CODE_REMOTE`) |
| `scripts/seed-insights.mjs` | Populate knowledge base (run once on new installs) |
| `scripts/migrate-firestore-to-postgres.mjs` | One-time Firebase → Postgres migration |
| `scripts/migrate-storage-to-s3.mjs` | One-time local storage → S3 migration |
| `scripts/rebuild-coffees-table.mjs` | Recompute coffee aggregates |
| `scripts/geocode-places.mjs` | Geocode places.address via Nominatim (OSM); ~2 hrs for 6k+ rows due to 1 req/s rate limit |
| `scripts/backfill-field-zones.mjs` | One-shot — call Haiku Messages API over plain `fetch` to map `coffees.tastingNotes` → `field_zones`. Ran on prod 2026-05 (23/23). Uses raw `fetch` because the Next.js standalone Docker image does not expose `@anthropic-ai/sdk` in `node_modules`. |
| `docker-compose.yml` | 4-service stack: postgres, app, caddy, ofelia |
| `.dockerignore` | Excludes `lovable-v7/`, `node_modules`, `.next`, `.env*` — `lovable-v7/` was dragging react-router-dom into the Next.js build context and failing the deploy. |
| `lovable-v7/` | Read-only design reference (Lovable v7 export). Excluded from Docker build context. |
| `HANDOVER.md` | In-flight project state — what shipped, what's next, pitfalls discovered. Read at session start for context above and beyond CLAUDE.md. |

### Database tables (Drizzle + Postgres)

`sessions`, `coffees`, `auth_credentials`, `auth_challenges`, `preferences`, `roasters`, `knowledge`, `coffee_alerts`, `places`, `conversations`, `conversation_messages` (11 tables).

Recent column additions on `coffees`:
- `field_zones jsonb` (migration 0008) — persisted Field composition per coffee
- `in_rotation boolean NOT NULL DEFAULT false` (migration 0009) — star toggle for "currently brewing this bag"

Both migrations applied manually on the VPS — see migration NOTE above.

### Key dependencies

| Package | Version | Role |
|---------|---------|------|
| `next` | 14.2.35 | Framework |
| `@anthropic-ai/sdk` | 0.80.0 | Claude API |
| `drizzle-orm` | 0.36.0 | ORM |
| `pg` | 8.13.0 | Postgres driver |
| `zustand` | 5.0.12 | State management |
| `zod` | 4.3.6 | Schema validation |
| `@simplewebauthn/server` | 13.3.0 | Passkey auth |
| `jose` | 6.2.2 | JWT |
| `leaflet` | 1.9.4 | Maps |
| `@aws-sdk/client-s3` | 3.700.0 | S3 uploads |
| `@ducanh2912/next-pwa` | 10.2.9 | PWA / service worker |

---

## Current Status — Snapshot May 2026

### ✅ Done
**BTTS Light migration (PR #65 → #103)**
- Whole brew flow + Home + Coffee Library now run under the `(light)` route group with the BTTS Light theme — Cream background, Fraunces 40px hero, Chivo body, anthracite foreground, generative Field background.
- Light primitives stack: `LightShell`, `LightFlowShell`, `Field`, `Card`, `Section`, `Footnote`, `Chip`, `Hero`, `CTA`, `CTAWarmth`, `ActionPill`, `ChatInput`, `ChatThread`, `NavigationOverlay`, `StarRating`, `CircularTimer` (fork), `CoffeeBeanGlow` (fork).
- Atomic cut-over (PR #95) renamed `(light)/brew/preview` → `(light)/brew/new` and deleted ~4,300 lines of Dark step code (`Step*.tsx` + `FlowShell.tsx` + Dark `CircularTimer`).
- `[data-light-scope]` CSS shim in `globals.css` adapts un-migrated Dark components (BrewMethodIcon via `filter: brightness(0)`; `var(--card)` tokens; CoffeeBeanGlow inversion) without forking the components.
- Dark surfaces still pending Light migration: `/cafes`, `/cafes/place/[slug]`, `/cafes/coffee/[id]`, `/taste`, `/brew/[id]`, `/login`, `/onboarding`, `/library`. `/cafes/map` stays Dark intentionally (dark CartoCDN tiles). See HANDOVER.md punch list.

**Generative Field v1.1 (PRs #78 → #100)**
- Each coffee gets its own background gradient composition derived from tasting notes.
- 6-zone perceptual palette (fruity-bright, fruity-deep, floral, nutty-cocoa, spice-earth, sweet-caramel); composition stored as weighted JSON in `coffees.field_zones`.
- Haiku call (`src/lib/field/mapNotesToZones.ts`) maps tasting notes → zone weights on first scan.
- `LightFlowShell` rotates Field 25° per brew step (scan 0°, mode 0°, context 25°, recommend 50°, brew 75°, log 100°, summary 125°) — visual progress signal.
- Brew-Again paths (ActionPill on home, `/coffees` list, `/coffees/[id]`) lift `fieldZones` from `coffees.field_zones` so the cup-specific Field travels with the user into the flow.
- Backfill (`scripts/backfill-field-zones.mjs`) ran on production: 23/23 existing coffees mapped (no skips).
- Variety fallback (Phase 4 — derive Field from variety knowledge for coffees without tasting notes) deferred as currently moot.

**Coffee Rotation marker (PR #97)**
- `coffees.in_rotation boolean` column — user-toggleable "currently brewing this bag" flag.
- Star toggle on `/coffees/[id]` (optimistic PATCH).
- Greeting prompt's library snapshot prefixes rotation entries with `★ IN ROTATION |`; `ROTATION DISCIPLINE` block in the system prompt instructs Haiku to prefer rotation bags as the day's invitation.

**Greeting Haiku (PR #87, #96)**
- Time-of-day discipline block in the system prompt (fixed "Late night" at 18:44).
- Library snapshot uses `formatLibraryForPrompt` (with rotation prefix + usage signal) instead of bare roaster+name.
- localStorage cache keyed by `brewlog.starter.v3.<date>.<bucket>` — regenerates 5× per day at tod-bucket boundaries instead of once per calendar day. Bumping the version is the canonical invalidation lever for any greeting prompt change.

**Nearby map split (PR #101)**
- `/cafes/map` is now a dedicated route (full-screen Leaflet with dark CartoCDN tiles). `/cafes` is the tabbed Café Library list (Cafés + Coffees tasted out). `NavigationOverlay` "Nearby" → `/cafes/map`; "Café Library" → `/cafes`.
- Fixed flex-collapse bug: Leaflet needs `h-dvh flex flex-col` + `flex-1 min-h-0` to get a non-zero container.

**Core brew flow**
- Full 7-step brew flow: mode → scan → context → recommend → brew → log → summary
- AI bag photo extraction (Claude Vision → Zod-validated session)
- Follow-up clarification step on bag extraction
- URL-based coffee product page analysis
- Brew timer: circular, pour-over sequence + prose-step guide (AeroPress / immersion etc.)
- Screen wake lock during active brew (`useWakeLock`)
- Bloom duration from roast date (Hoffmann/Rao: 50s fresh / 45s peak / 30s old)
- Pour timing formula: `remaining / (n-2)` — last pour lands at `target - drawdownReserve`
- Proportional drawdown reserve: `targetTimeSec * 0.33`
- **Immersion timer precision** — per-step durations sum exactly to `targetTimeSec`; no absolute timestamps
- **Background-safe timer** — `CircularTimer` uses `Date.now()` anchor; snaps via `visibilitychange` on iOS
- **Step-change alerts** — 2-tone Web Audio cue (880 Hz → 660 Hz) on each auto-advanced step; `navigator.vibrate(80)` on Android
- **"Brew this" entry shortcut (May 2026)** — both `/coffees` (library list) and `/coffees/[id]` (detail) expose a one-tap button that jumps straight to step 3 (Context) with the coffee preloaded. Same `reset → setCoffee → setMode("home") → setSkipScan(true) → setStep("context") → push /brew/new` pattern as the home page's "Brew Again" carousel. Detail page uses the latest scanned `CoffeeIdentity` from sessions; library list synthesizes from the aggregate (roastLevel defaults to "Light"). `/recommend` re-hydrates the full coffee row from `coffeeId` server-side, so synthesized identities are sufficient.

**Data & persistence**
- Session save: Zod validation → Postgres JSONB (null-safe)
- Session GET: single indexed query on `createdAtMs DESC`
- Coffee library with detail pages (rating history, brew signatures, notes)
- Roaster profiles with AI-generated style summaries
- Zustand flow store with sessionStorage persistence

**AI features**
- Brew recipe generation: 2–4 candidates with reasoning (`recommend.ts`)
- Post-brew Escher insights: terrain/pattern prose analysis
- Cross-session pattern extraction (pace, craft approach, occasions)
- Brew signature: weighted averages per coffee/method combo
- Taste profile page with AI-written summary
- Taste-match finder: scores past sessions against current coffee
- **Explore chat coach upgrade (May 2026)** — `/explore` no longer relies on a hardcoded user profile. Each turn injects:
  - **Recent recipes block** — `buildRecentRecipes()` shows the actual dose/water/ratio/Niche degrees/temp/target+actual timing/flow/Drip Assist/water source for the last 5 brews, so timing questions get answered with real numbers
  - **Live preferences block** — `loadUserProfile()` reads the `preferences` table; canonical equipment + grind settings live in a separately cached system block that invalidates only when onboarding changes
  - **Coffee library block** — `loadCoffeeLibraryCompact()` lists the last 30 bags with roast-date freshness, so "which bag should I open next?" gets a specific answer
  - **Roaster priors block** — up to 5 unique roasters from recent sessions hydrated via `getRoasterPrior()` so it can reference Friedhats' clarity bias, April's minimal-agitation rule, etc.
  - **BrewLog feature awareness** — system prompt now knows about Match, Taste, Cafés and points the user at them when relevant
  - **Self-aware capabilities (May 2026 follow-up)** — `## Your Capabilities` block in `src/app/api/explore-agent/route.ts` lists every tool the agent has (`search_places`, `fetch_page`, `analyze_image`, `suggest_navigation`) plus voice in/out (ElevenLabs Scribe STT + TTS). When the user asks "what can you do?" the chat answers from the list instead of hallucinating.
  - **Reasoning on internal picks (May 2026)** — Response Style now includes "Show your reasoning when you compare or pick": when the user asks the chat to choose between things they already own (their bags, past sessions, kit), it must briefly name each candidate and what it brings to the criterion before declaring the pick. Prevents the failure mode where "Direct, confident" + "Brevity first" collapsed to a one-line declaration with no explanation.
- **Place search — English DB + diacritic-tolerant fold (May 2026)** — `places.city` is stored in English/ASCII (Cologne, Munich, Dusseldorf, Vienna, Prague, Bucharest, Lisbon, …). Both the `/explore` chat (`searchPlaces`) and the `/cafes` map (`/api/places` GET) accept any spelling: a `fold()` helper in `src/app/api/explore-agent/route.ts` strips diacritics and collapses German digraphs (`ue→u`, `oe→o`, `ae→a`, `ß→ss`) on both query and DB rows in memory, so "Düsseldorf" / "Dusseldorf" / "Duesseldorf" all match the same row. The chat's system prompt instructs it to translate any German city name (Köln→Cologne, München→Munich) before searching. Map search additionally splits the query on whitespace and ANDs tokens, so "Kolo Berlin" finds Kolo in Berlin.
- Weekly deep-research cron (Ofelia)
- Knowledge base: insights, hints, news, questions
- **Structured knowledge layer (May 2026)** — `src/lib/knowledge/{recipes,varieties,techniques}` carries the science/expertise corpus that backs `/recommend`, `/explore`, and `/explore-agent`. **Human-readable mirror:** @./docs/coffee-experts.md (mirror only — update the TS files first, then mirror). Replaces ad-hoc recipe paragraphs that were embedded directly in the prompts. **Recipes** = 7 WBrC/WAC champion routines (Kasuya 2016, Du 2019, Hsu 2022, Medina 2023, Wölfl 2024, Peng 2025, Stanica WAC 2024) + 11 reference recipes (Hoffmann V60/Clever/AeroPress/Moccamaster/Iced, Kasuya 4:6, Rolf, Gagné, Perger, Rao, Hatakeyama Cafec, Wallgren Kalita-sieve, Turbo V60). Each entry: structured pour sequence with per-step durations and staged temperatures, attribution, sources, `verified` flag distinguishing canonical vs reconstructed details. **Varieties** = ~25 WCR-grounded cultivar priors covering Bourbon family, Typica family, Ethiopian landraces, Geisha, SL series, F1 hybrids, Pacamara, Mokka. Genetic / agronomic facts sourced to the WCR Arabica Coffee Varieties Catalog; cup descriptions from Royal Coffee's *Green Coffee Book*. Pink Bourbon flagged per WCR's 2024 finding that it is genetically distinct from Bourbon despite the marketing name. **Techniques** = 18 atomic brewing moves (Hsu staged-temperature, Peng Melodrip, Wallgren sieving, Rao spin, water-first, low-mineral water, etc.) cross-referenced to exemplifying recipes — the brain can cite mechanism by id and reach a worked example. All three modules injected per turn; system prompts are NOT touched (cache hits preserved).

**Auth & infra**
- WebAuthn (passkey) auth — register, login, re-enroll
- JWT session cookie via `jose`
- PWA (manifest, service worker, offline)
- Auto-deploy via GitHub Actions → SSH → Hetzner VPS

**Places & cafés**
- Café map with Leaflet, place search, detail pages
- `/cafes` collection: visit count, avg rating, coffees tasted, last visited
- External sessions show "The Brew" / "Would you drink this again?" wording
- Production `places` table: **6,202 rows** (verified 2026-05-09 via `SELECT count(*) FROM places`). The bulk dataset lives **only in the production DB** — no seed file in Git. For a fresh count rerun the same query on the VPS.

**Coffee alerts**
- Alert subscriptions + incoming webhook for coffee availability notifications

### ❌ Not Done / Known Gaps

**Light migration punch list** (roughly priority order — see HANDOVER.md for the live ranking):
1. `/coffees` rotation indicator + filter — list rows don't show the star yet; "Show only rotation" toggle would scan faster
2. `/cafes` Light migration — high-traffic, last big Library surface
3. `/cafes/place/[slug]` + `/cafes/coffee/[id]` Light — small follow-ons after `/cafes`
4. `/taste` Light + RadarChart Light — taste profile + AI summary
5. FlavorWheel Light SVG — currently Dark inside `LightStepLog` (opt-in, rarely opened — deferred per migration plan)
6. `/brew/[id]` Session Detail Light — reached via SessionCard
7. Dark `Chip.tsx` removal — only Dark consumer left is `/brew/[id]`
8. `LightStepScan` Card/Chip refactor — 1400 lines with bespoke buttons that should route through `Card` + `Chip` primitives
9. Aromatic Goal validation — PR #72 added the intent to `/api/recommend` but per the Hard Rule it needs sample-before/after against a delicate coffee on the deployed PWA

**Permanent gaps**
- Photo uploads: stored under `bags/` — old sessions scanned before this convention have no `bagPhotoUrl`
- Step alerts during background are missed — iOS suspends JS; no workaround without server-push notifications
- Single-user app by design (no multi-user isolation needed)
- Knowledge base needs seeding on new installs: `node scripts/seed-insights.mjs`
- Firebase migration scripts exist but are one-shot: `migrate-firestore-to-postgres.mjs` + `migrate-storage-to-s3.mjs`

---

## Partnership Rules

- **Flag proactively.** If something is inefficient (wastes tokens/time), insecure, or messy process-wise — raise it in the conversation. Don't silently tolerate it. The user is non-technical and cannot spot these issues on their own; it is your job to surface them.
- Examples worth flagging: files stored in odd formats, unused endpoints, duplicated code paths, secrets in the wrong places, stale dependencies, missing error handling at system boundaries, slow API calls that could be cached, confusing UX that you happened to notice while editing nearby code.
- Flag once, explain the trade-off plainly, then wait for a yes/no before acting. Don't hoard issues for a big cleanup later.
- **Translate, don't jargon-dump.** The user reads everything you write. Plain English, no unexplained acronyms or shorthand. If a technical term is unavoidable, define it inline once.

---

## Hard rule: validate before changing AI behavior

A "behavioral change" is anything that affects what the AI produces or what the user sees: model swaps (Opus ↔ Sonnet ↔ Haiku), prompt edits that change output character or scope, schema/enum changes, thresholds, `max_tokens`, default parameter values, prompt-internal rules. For any such change:

1. **Sample real outputs before and after.** Run the changed code path against at least 2-3 representative inputs and compare the actual outputs. Diffing the source code is not validation.
2. **Never claim "no meaningful quality delta" without that comparison.** If you have not run it, say so explicitly and ask the user before shipping. "I think this should be fine" is not allowed.
3. **Never bundle a behavioral change with an unrelated commit** (e.g. "perf: parallelize X, also revert model"). Behavioral changes get their own commit so they can be reverted cleanly.
4. **Performance is not a sufficient reason** to swap a model under a prompt that was engineered for a specific model. Either re-engineer the prompt for the smaller model and validate the new outputs, or accept the latency.

Cause for this rule: commit `932ff25` swapped the recommend model Opus → Sonnet "for performance" with the claim "no meaningful quality delta" — without sampling outputs. The prompt was engineered for Opus; under Sonnet it collapsed to a tiny safe set of brewers (V60/Kalita/Orea), shipped directly to main, and broke the core recipe feature for ~24 hours. Do not repeat.

---

## Hard rule: never infer repo state from partial evidence

Migrations files, seed scripts, `.env.example` and code comments only show what lives in Git. They do NOT show what's actually in the production DB, what was seeded manually on the VPS, or what happened outside the repo. Do not extrapolate.

1. **Never quote a row count, table size, or dataset size from a migration file alone.** A migration showing 33 INSERTs does not mean the table has 33 rows. The bulk data may have been loaded directly on the VPS with no script in Git. If asked, say "I can only see what's in the migrations; for the real count, run `SELECT count(*) FROM <table>` on the VPS."
2. **Search broadly before answering.** Before claiming "X doesn't exist" or "the repo only contains Y": grep across `scripts/`, code comments (real numbers often live there), `meta/_journal.json` (can diverge from the file list — manual `psql` migrations don't register), and any data files (`*.csv`, `*.json`, `*.sql`). Only after that, answer.
3. **Mark inference as inference.** "X lives only in production" is not the same as "I found nothing in the repo that explains X." Stating the first when only the second is true is hallucination. Use phrases like "no evidence in the repo" or "inference, not verified" — not assertive claims.
4. **Flag your own inconsistencies immediately.** If you produce two different numbers for the same thing in one session (12 vs. 13, 33 vs. 34), call it out openly and re-verify — do not silently overwrite the earlier number.
5. **When the user pushes back ("that's wrong, we have X"), do not defend.** Re-open the search, surface the path that led to the wrong conclusion ("I only checked Y, that's why I missed Z"), correct cleanly. Apologize once, fix, move on.

Cause for this rule: claimed "~33 cafés in the places table" based on counting INSERTs in three migration files, when the production DB actually holds 6,202 places (verified 2026-05-09) loaded outside the repo. The Drizzle `meta/_journal.json` only registers `0000_init` — all place migrations are applied manually via `psql` on the VPS, and the bulk dataset has no import script in Git at all. Do not extrapolate from migrations to reality.

---

## Conventions

### Code
- **TypeScript strict** — no `any`, no `@ts-ignore` without comment
- **Tailwind only** — no inline styles except `safe-area-inset-*` (and the gradient exception below)
- **Tailwind only scans `src/{app,components,pages}`** — `tailwind.config.ts` `content` paths do NOT include `src/lib/**`. Utility class strings that live solely in lib (including arbitrary values like `bg-[linear-gradient(...)]`) are silently never generated; the styles vanish at runtime with no error. If you need a shared visual constant in lib, export it as a raw CSS value and apply via inline `style={{ background: ... }}` at the call site — see `src/lib/theme/gradients.ts`. PR #40 fixed a regression where the /explore user-message cream pill never rendered because of this trap.
- **No external UI libraries** — every component is bespoke
- **Refs over state** for values that don't need to trigger renders (timers, wake lock, callbacks)
- `useCallback` deps must be accurate — don't omit to silence linter
- **Zod schemas** on all API POST routes; strip nulls with `deepStripNulls()` before parsing
- **Never import from `app/api/*/route.ts` in client components** — Next.js App Router enforces a strict server/client boundary. Shared types go in `src/lib/types/`.

### Database (Postgres + Drizzle)
- **BEFORE any SQL migration or UPDATE/DELETE: run a COUNT query first.** Verify the number of affected rows is what you expect. Never write a broad WHERE clause (or no WHERE clause) without checking the row count first. If the count is surprising, stop and ask.
- **Never reset or wipe existing data to fix a single row.** Target the specific row by id or a precise unique condition. Resetting a column for all rows with `address IS NOT NULL` when only 1 row needed fixing is not acceptable.
- JSONB columns for nested objects (coffee, brew, result, etc.) — preserves TypeScript types unchanged
- Session timestamps: `createdAt` (timestamptz) + `createdAtMs` (bigint, indexed DESC for feed order)
- Upload paths must start with `bags/` or `uploads/` (enforced in upload route)
- Numeric fields (ratingSum, avgRating, cuppingScore) stored as `numeric` in Postgres, use `String()` when inserting

### AI models
- `claude-opus-4-7` — recommend (engineered for Opus; do NOT swap to Sonnet without re-validating outputs — see Hard Rule above)
- `claude-sonnet-4-6` — analyze-bag, explore, explore-agent, escher (post-brew insight helper)
- `claude-haiku-4-5` — brew-insight, taste-summary, research, analyze-bag/clarify, analyze-url, coffees/compact, roasters/generate, translate (tasting-notes ↔ SCA helper), greeting (daily starter), field/mapNotesToZones (notes → Field zones)

### Git / Deploy
- **"Done" means shipped** — merged to `main`, auto-deploy runs on Hetzner, live on the iPhone PWA. "Pushed to a feature branch" is NOT done. Stopping at a branch leaves the user staring at the still-broken app, re-reporting the bug, and re-fixing what is already fixed. That is chaos and it is not acceptable.
- **Workflow is PR-based.** `main` is branch-protected on GitHub — direct pushes return HTTP 403. Every change goes: feature branch → PR → squash-merge to `main` → auto-deploy. Use the GitHub MCP tools (`mcp__github__create_pull_request`, `mcp__github__merge_pull_request`, `mcp__github__enable_pr_auto_merge`).
- **Auto-merge is enabled on the repo.** For PRs that pass CI without review gating, call `enable_pr_auto_merge` (mergeMethod: SQUASH); GitHub merges as soon as checks go green. If checks are already clean, call `merge_pull_request` directly.
- **Session-level harness instructions are compatible.** If a system prompt tells you to develop on a feature branch — fine, that's the actual flow. Just don't stop at the branch: open the PR, merge it, confirm `main` advanced.
- **Auto-deploy** — GitHub Actions runs on every push to `main`. No manual steps needed unless the action fails (fallback: SSH to VPS and run docker compose manually per the Infrastructure section).
- Commit message: imperative, lowercase prefix (`fix:`, `feat:`, `remove:`, `docs:`, `build:`)
- Always `npx tsc --noEmit` before commit
- No staging environment — once merged to `main` it is live within minutes

---

## Explicitly NOT Wanted

- **No token usage logging** — `logTokenUsage` / `usageLogs` collection was removed; don't re-add
- **No Zod `.transform()` that produces `undefined`** — breaks Firestore writes (null → strip at source instead)
- **No external component libraries** (shadcn, radix, headless-ui, etc.)
- **No changes to unrelated files** when fixing a bug — surgical edits only
- **No emojis in UI** — design is editorial/premium
- **No separate "total" row** in pour sequence tables — drawdown end = total time = done
- **No temperature-for-timing advice** — grind coarser/finer to fix timing; temp is for extraction chemistry only
- **No Vercel** — deleted. Do not reference Vercel URLs or Vercel deployment in any context.
- **No `npm run dev` assumptions** — app is always tested on the deployed Hetzner PWA

---

## User / Equipment Profile

| Device | Details |
|--------|---------|
| **PRIMARY** | V60 size 2 + Hario Drip Assist |
| Other | Orea V4 Wide, Origami Dripper, Clever Dripper, Kalita Wave, AeroPress, Moccamaster, Chemex |
| **Kettle** | Fellow Stagg EKG — gooseneck, precise temp control, 60-min hold |
| **Grinder** | Niche Zero — uses **degree (°) settings**, continuous (no clicks) |
| Travel grinder | Comandante C40 MK2 — uses **clicks**, not degrees |
| Water (daily) | Tap ~300 ppm | Diluted: 1:1 tap+distilled ~150 ppm |

**Taste:** silky, balanced, floral/fruity (elegant); light roast SO; avoids anaerobic/infused/dark.
**Grind quick ref:** @./docs/grind-settings.md
**Grind source of truth (code):** `src/lib/constants/grindSettings.ts` — `/recommend` and `/explore` both read from here for the user's brew-method defaults. Update degrees in this file; the markdown docs mirror it. Note: each entry in `src/lib/knowledge/recipes/` carries its own `grind.nicheZeroDegrees` translation specific to that recipe (e.g. Wölfl 2024 = 401–411°, Peng 2025 = 386–396°). Different scopes — `grindSettings.ts` = "default for this method", recipes = "what this specific published routine calls for".
