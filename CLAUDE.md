# BrewLog — Claude Code Context

Personal coffee brew advisor & diary PWA. Next.js 14 App Router + Postgres + Claude AI + Hetzner.

---

## Operating mode — own the mechanics, keep asking (OVERRIDES the friction rules below)

The user runs this project from a phone, usually with no terminal. The thing to eliminate is **manual mechanical work on the user's side** — never the conversation. This section takes precedence over any "validate before shipping" instruction elsewhere in this file, but it does NOT tell you to stop asking questions.

- **Asking is a MUST, not friction.** The user wants to steer: clarify ambiguity, confirm direction, surface trade-offs, present real options for decisions (especially anything subjective, visual, product-shaping, or with no clear default). Erring toward asking on *what to build / which way to go* is correct and wanted. What the user is sick of is being *blocked* — not being *consulted*.
- **Never offload mechanics onto the user.** Do NOT hand them commands to type, do NOT expect them to `git pull` / push / merge / run a script / SSH / type anything in a terminal. YOU run git, YOU open and merge the PR, deploy is automatic, SQL migrations go through the GitHub Actions "Run SQL Migration" workflow. The only legitimate "you do it" is a setting that genuinely lives behind a web UI you can't reach (e.g. GitHub repo-settings toggles) — and even then, name the exact clicks and offer to walk them through it.
- **Ship the execution end-to-end.** Once a direction is agreed: make the change → `tsc` → commit → push → open the PR → enable auto-merge (or merge on green) → confirm `main` advanced. "Done" = merged + deploying, never "pushed to a branch" and never "here's the command, you run it".
- **Pause for decisions and for the genuinely irreversible.** Ask the user on real forks. Hard-stop only for wiping/overwriting production data, deleting things you didn't create, force-pushing `main`, rotating secrets, or spending money. Ordinary code / asset / config / prompt changes are revertible via git — execute them, then report.
- **A wall means route around it, not dump it on the user.** A tool is blocked? Find another path before surfacing it. When you do surface a wall, say what you already tried — don't make the user do the legwork.
- **Self-correct in place.** Made a mistake? Fix it and move on. No spiralling, no wall of hedging.

**What this does NOT relax:** the "never fabricate coffee parameters / facts" rule stays fully in force — but it means *look it up or mark it unverified and keep going*, never *halt the task*. Honesty about data (don't invent row counts, don't claim verified when you didn't check) is about not lying to the user.

---

## Infrastructure

| What | Detail |
|------|--------|
| **VPS** | Hetzner Cloud, host in the `DEPLOY_HOST` GitHub Actions secret, path `/opt/brewlog` |
| **Stack** | Docker Compose: `postgres`, `app` (Next.js), `caddy` (reverse proxy), `ofelia` (cron) |
| **Vercel** | **Deleted.** App is 100% on Hetzner. No Vercel, no Vercel env vars, nothing. |
| **Auto-deploy** | `.github/workflows/deploy.yml` — pushes to `main` trigger SSH deploy on VPS |
| **Auto-deploy secrets** | `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH` in GitHub repo secrets |

**Manual deploy (fallback):** SSH into VPS → `cd /opt/brewlog && git pull origin main && docker compose build app && docker compose up -d app`

**Running a new SQL migration:** Trigger the **"Run SQL Migration" GitHub Actions workflow** (`.github/workflows/migration.yml`, manual `workflow_dispatch`). Inputs: `migration_file` (e.g. `0017_add_insight_snooze.sql`) and `ref` (branch holding the file — defaults to `main`; a feature branch is allowed so the column can exist BEFORE the code merges, since Drizzle is column-strict). The workflow SSHes into the VPS and pipes the file into psql — it IS the manual step below, driven from a web UI. Once per migration. Expect `INSERT 0 N` / `CREATE TABLE` in the run log.

Manual fallback (only if Actions is down — never hand this to the owner):
```bash
cd /opt/brewlog && cat src/lib/db/migrations/<file>.sql | docker compose exec -T postgres psql -U brewlog -d brewlog
```

**Type-check before every commit:** `npx tsc --noEmit`

**CI on every PR (`.github/workflows/ci.yml`):**
- **`check` job** — `tsc --noEmit` + `node --test` (pour-math suite). Fast quality gate.
- **`screenshots` job** — boots the app against a throwaway Postgres (applies every migration to an empty DB), logs in via the **PIN path** (`POST /api/auth/login {type:"pin"}`; CI uses a throwaway `AUTH_PIN=1234` + test `AUTH_SECRET`, runs `next dev` so the session cookie isn't `secure`-gated over http), then drives a headless mobile-viewport Chromium (Playwright, installed ad-hoc — not a committed dep) through every key screen and uploads them as the **`app-screenshots`** artifact. This is how a human/Claude eyeballs layout on a PR without running anything; download the artifact from the PR's checks. A screen returning 5xx fails the job. AI sections render empty unless an `ANTHROPIC_API_KEY` repo secret is set (run passes either way). Screen list + opportunistic dynamic-route capture live in `tests/smoke/screenshot.mjs`.

---

## Project Structure & Key Files

### Pages (`src/app/`)

Light migration is **complete** as of PRs #134–#137. Every visited route lives inside the **`(light)` route group** (BTTS Light theme — Cream background, Fraunces/Chivo, anthracite foreground, generative Field) and inherits `LightShell` from `(light)/layout.tsx`. The `(light)` segment is URL-invisible — `/coffees` resolves through `(light)/coffees/page.tsx`. `LightShell` sets the `[data-light-scope]` data attribute used by the CSS shim in `globals.css`.

Every route is now Light, including `cafes/map` (headlined "Nearby") — the cream→transparent scrim at the top keeps the title legible against the warm-tinted Positron tiles.

| Route | Theme | Purpose |
|-------|-------|---------|
| `(light)/page.tsx` | Light | Home BTTS — daily greeting, Action Pill (Brew-Again candidates), inline AI chat over `/api/explore-agent` |
| `(light)/layout.tsx` | — | Wraps `(light)` group in `LightShell` (sets `[data-light-scope]`) |
| `(light)/past-conversations/page.tsx` | Light | Conversation history list (archived chats) |
| `(light)/past-conversations/[id]/page.tsx` | Light | Single past conversation thread (read-only replay) |
| `(light)/brew/new/page.tsx` | Light | Multi-step brew flow — routes `flowStore.step` to the right `LightStep*` component |
| `(light)/brew/[id]/page.tsx` | Light | Read-only session detail — Brew-method as headline, Field of the linked coffee, **2×2 stat grid** (Dose \| Grind on row 1, Water \| Temp on row 2 — PR #215, replaces the prior 3-up + Grind-below layout), then sections for brew notes / taste / reasoning |
| `(light)/coffees/page.tsx` | Light | Coffee library — searchable list with full-bleed bag-photo card (96 px left strip), brew count over Brew CTA in the right column |
| `(light)/coffees/[id]/page.tsx` | Light | Coffee detail — Field + rotation toggle + gated Brew CTA + **single coach card** between Roaster and Notes (rotation-only; reads the coffee's own `coffees.coach_insight` column — Opus-generated per-coffee insight via `CoffeeCoachCard`, migration 0015, replacing the old library-wide citationFields overlap that surfaced other bags' insights on the wrong coffee) + rating history + brew signatures |
| `(light)/coffees/drip/new/page.tsx` | Light | Drip-bag scan + log — single-serve sachet (e.g. INNO Signature Drip): scan identity, pick tasted flavours, 1–5 star rating. No recipe, no timer. Writes to the isolated `drip_bags` table (migration 0016) |
| `(light)/coffees/drip/[id]/page.tsx` | Light | Drip-bag detail — read-only identity + Field + bag/tasted notes + rating. Isolated from sessions/coffees/AI corpus |
| `(light)/cafes/page.tsx` | Light | Café Library — tabbed list (Cafés + Coffees tasted out), photo-strip cards in the Coffees tab |
| `(light)/cafes/place/[slug]/page.tsx` | Light | Single café detail + inline session edit panel |
| `(light)/cafes/coffee/[id]/page.tsx` | Light | Coffee tasted at an external location, cross-links to library coffee via `coffeeId` |
| `(light)/taste/page.tsx` | Light | Taste profile — Avg rating + rated count header, then **Coach** (top 3 of the `new` + saved-`trying` insights, two-stage workflow — New: Save to try / Confirmed / Doesn't apply; Saved: It helped / Didn't help / Skip; the back of the 5–8 queue slides into place when one is solved — PRs #215 + migration 0017), then **What you brew** (always-visible, no collapsible): FlavorWheel + top flavors + rating trend + body / acidity + best origins / processes / methods |
| `(light)/login/page.tsx` | Light | Passkey (WebAuthn) login UI + PIN fallback + reset path |
| `(light)/onboarding/page.tsx` | Light | **Deprecated** first-run equipment + grinder wizard — nothing routes to it; the profile is code-canonical (see the single-user Hard Rule). Kept only for legacy reach-by-URL. |
| `(light)/offline/page.tsx` | Light | Service-worker document fallback (`next.config.mjs` `fallbacks.document`). Shown when an uncached route is opened offline; links to `/coffees`. Safety net — the real offline path lives in the precached `/coffees` + `/brew/new` shell. |
| `layout.tsx` | — | Root layout: PWA meta tags, font preloads, `<ScrollContainer>` wrapper |
| `loading.tsx` | Light | Global loading state — Light CoffeeBeanGlow on inline cream bg (renders before LightShell mounts) |
| `(light)/cafes/map/page.tsx` | Light | Nearby — full-bleed Leaflet map (Positron tiles warmed via the `[data-light-scope]` sepia filter on `.leaflet-tile-pane`); floating header with the Light wordmark pattern + cream→transparent scrim so the title reads cleanly over the tiles |

Removed routes: legacy Dark `page.tsx` (replaced by `(light)/page.tsx`), `match/page.tsx` + `/api/match` (folded into `/api/explore-agent`), `explore/page.tsx` + `/api/explore` (replaced by the inline chat on home over `/api/explore-agent` — the API route itself is deleted, not just the page), `library/page.tsx` (the Coffee Library / Café Library picker — redundant once `NavigationOverlay` gained direct entries for both).

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
| `recommend` | ★ POST coffee + context → 2–4 AI brew recipe candidates. Each recipe carries a structured `pourSteps[]` (per-step action/grams/duration/temperature/notes; agitation emitted as explicit stir/swirl steps) alongside the legacy `pourSequence` string; each candidate carries `basedOn` (the reference recipe it adapts, or "Own recipe"). `pourSteps` is sanitised + action-normalised post-parse (`sanitizeRecipe`) — a malformed array is dropped, never fatal (PR #197/#198). |
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
| `conversations/cleanup` | POST (cron-auth) — Ofelia daily at 04:00 UTC, deletes archived conversations older than 7 days. Live conversation (archivedAt IS NULL) is NEVER touched. Messages cascade-delete via the conversation_messages FK. (PR #217) |
| `explore-agent` | ★ Agent loop with tool-use (`search_places`, `fetch_page`, `analyze_image`, `suggest_navigation`, `start_brew`, `remember_advice`) — powers the inline chat on `(light)/page.tsx`. `start_brew` (PR #199/#200) is a terminal action tool: when the agent has laid out a complete recipe for a library bag it hands the exact recipe (dose/water/ice/temp/grind/`targetTimeSec`/`pourSteps` + method/title/basedOn) to the brew timer so the user lands straight in Step "brew" — no context, no re-recommendation. Its `destination` is set from the TOOL NAME (the input has no destination field — that omission caused the no-op fixed in #200). Per-turn context now includes recipe names + a "Most Recent Brew" block, all read from the actually-brewed candidate. **`remember_advice`** is a second terminal action tool (chat→recommendations bridge): when the chat works out durable, parameter-level guidance for a specific library bag, it surfaces a **tap-to-save** "Remember this for …" pill (`ActionPill`). Tapping POSTs to `/api/insights`, which writes a `status='trying'` / `source='user-confirmed'` insight row (so `/recommend` + the brew Context reminder pill apply it next time that coffee is brewed) AND writes the same note into the targeted coffee's `coach_insight` column (so it becomes that bag's card on `/coffees/[id]`). The chat names the bag in the observation text (per-coffee targeting) and supplies `citationFields` (recommend ranking). Nothing is written until the user taps — the chat never silently persists. **Caveat:** the saved note lives in TWO places with independent statuses (the insights row and the coffee's `coach_insight` card) and they are NOT synced — "Doesn't apply" on the /taste card clears the insights row but the coffee-detail card keeps showing until acted on there too, and vice versa. |
| `research` | Weekly deep-research cron agent (Ofelia) |
| `preferences` | GET / POST user preferences (equipment, grinder, location) |
| `roasters` | GET / POST roaster profiles |
| `roasters/generate` | AI-generate roaster style summary |
| `places` | GET / POST café locations (auto-geocodes via Nominatim/OSM on POST) |
| `cafes` | GET aggregated café summary across sessions (visit count, avg rating, last visited) |
| `upload` | Multipart photo → Hetzner S3, returns URL |
| `voice/synthesize` | POST text → ElevenLabs TTS audio |
| `voice/transcribe` | POST audio → ElevenLabs Scribe STT transcript |
| `insights` | ★ Coach observations over the full session corpus. **Opus** (`src/lib/claude/insights.ts`). GET = cache-aware Opus regeneration + full list for /taste (client-side status filtering); a `?status=` filtered read exists but currently has no UI consumer (both per-coffee surfaces read `/api/coffees/[id]/insight` since migration 0015). PATCH `{ id, status }` advances an insight through a **two-stage** workflow (migration 0017): **New** (`new` → Save to try / Confirmed / Doesn't apply) then **Saved** (`trying` → It helped=`confirmed` / Didn't help=`doesnt-apply` / Skip=`snoozed`). `snoozed` rows set `snoozed_until` (default +7 days) and are hidden until it passes, then resurface and regen treats them like `new` — EXCEPT `source='user-confirmed'` rows, which regeneration never deletes (June 2026 fix; previously Save → Skip → 7 days could silently delete a hand-saved note, because PATCH also used to reset `source` to `'opus'` on snooze). Confirm is the only transition that changes `source` (→ `user-confirmed`). The regeneration only replaces `status='new'` (and expired-snooze opus) rows; user-acted rows are preserved and re-emitted similar observations inherit the existing status (text-match on first 80 chars). **POST** writes a chat-authored coach note (tap-to-save from the home chat's `remember_advice` pill, and the post-brew Summary insight card) to **two** places: (a) an insights row (`status='trying'` or `'confirmed'` / `source='user-confirmed'`), deduped on the first 80 chars and anchored to the current corpus `latestSessionMs` so it never freezes regeneration; and (b) the targeted coffee's `coach_insight` column so the note becomes that bag's card on `/coffees/[id]` — a precise per-coffee write that supersedes the auto-generated per-coffee insight (rotation-gated card; a note saved for an out-of-rotation bag won't render a card). The two copies' statuses are NOT synced (see explore-agent row caveat). (PR #215, migrations 0014 + 0017) |
| `coffees/[id]/insight` | GET / PATCH — the **per-coffee** coach card (`coffees.coach_insight`, migration 0015, **Opus** via `src/lib/claude/coffeeInsight.ts`). GET returns the cached insight, regenerating when this coffee has a newer session AND status is `new`/`doesnt-apply` (never while `trying`/`confirmed` — don't move the card under the user). PATCH advances the card's own status. Consumed by `CoffeeCoachCard` (/coffees/[id]) and the /brew/new Context reminder pill. |
| `admin/prewarm-coffee-insights` | POST (CRON_SECRET bearer) — one-shot Opus pre-warm of per-coffee insights for every rotation coffee, so /coffees/[id] cards appear instantly after migration 0015 / a rotation batch. Preserves `trying`/`confirmed` cards. |
| `loading-insights` | GET — live rows of the **auto-refreshed loading-screen insight pool** shown during the recipe-crafting wait (`LightStepRecommend`). Defensive: returns `[]` on any failure (incl. pre-migration) so the static `COFFEE_HINTS` seed always covers it. requireAuth-gated. |
| `loading-insights/refresh` | ★ POST (CRON_SECRET) — the **insight agent**. Generates short headline lines grounded in the verified corpus (recipes/varieties/techniques) + brew aggregates + live `web_search` (each web line must carry a verbatim quote), runs every candidate through a deterministic gate (`src/lib/insights/loadingInsightLint.ts`) **and** a model claim-check, inserts survivors, retires oldest over a 150 cap. Full-auto, **NO human review** — the machine gate replaces it so nothing ungrounded reaches the screen (the "never fabricate" rule). Table self-bootstraps (`CREATE TABLE IF NOT EXISTS`). Monthly via `.github/workflows/loading-insights-refresh.yml` (SSH → `docker compose exec app curl`, reuses deploy key). **Full reference: `docs/loading-insights.md`.** |
| `coach-question` | POST — post-rating micro-dialogue (Sonnet). Called by `LightStepLog` only when a client-side ambiguity heuristic fires (`shouldAskCoach`); returns one short question + 3 answer chips, stored as `tasteResult.coachAnswer` and read downstream by /recommend + /insights. |
| `hints` | GET contextual brewing hints |
| `news` | GET coffee news feed |
| `questions` | GET suggestion questions for explore mode |
| `alerts` | GET / POST coffee availability alert subscriptions |
| `webhooks/coffee-alert` | Incoming webhook for coffee availability notifications |
| `drip-bags` | GET list / POST — single-serve drip-bag documentation records (migration 0016). Isolated from sessions/coffees/the AI corpus (mirrors the `cafe-visits` precedent) so they never skew `/recommend`, `/insights`, `/taste`, or the Café Library |
| `drip-bags/[id]` | GET / DELETE individual drip-bag record |
| `cafe-visits` | GET / POST — visit-only café logs with binary thumbs rating (independent of brew sessions) |
| `cafe-visits/[id]` | DELETE — remove a logged visit |
| `admin/seed` | Populate knowledge base (run once on new installs) |

### Components

**Flow steps (`src/components/flow/`):**

All Light. The Dark `Step*.tsx` files (`FlowShell`, `StepMode`, `StepScan`, `StepContext`, `StepRecommend`, `StepBrew`, `StepLog`, `StepSummary`, `StepMatchResult`) were deleted in PR #95 (~4,300 lines) when `/brew/new` cut over to Light.

| Component | Purpose |
|-----------|---------|
| `LightStepMode.tsx` | Home Brew / Coffee Shop / Taste Match selector |
| `LightStepScan.tsx` | ★ Camera / photo upload / URL / manual + AI bag extraction + roaster Q&A (1400+ lines — biggest step) |
| `LightStepContext.tsx` | Occasion, water amount, time, mood, equipment, goal. Goal picker has 6 options incl. `aromatic` (PR #192). Method list incl. "V60 + Drip Assist" emergency-only option (PR #193). Locking a method sets `context.preferredMethod` → hard-filters recipe selection. **Coach reminder pill** above the selectors when the chosen coffee's own coach card (`/api/coffees/[id]/insight`) is `status='trying'` — quiet read-only nudge, per-coffee by id, NO attribute-overlap matching (that pre-0015 mechanism surfaced other bags' insights on the wrong coffee and is gone). (PR #215 + migration 0015) |
| `LightStepRecommend.tsx` | 2–4 AI recipe candidates with reasoning. Selecting a candidate sets `brew.selectedCandidateIdx` so Brew/Log/Summary read THAT candidate's recipe by index, not by method name (PR #193 — fixed alternative inheriting the primary's temp/grind when both share a method). Shows the candidate `title` + `based on …` reference name (PR #198). |
| `LightStepBrew.tsx` | ★ Circular timer + **step-by-step, method-aware** pour guide (Web Audio cue + vibrate on step change). Shows the recipe **name** (candidate `title` + `based on …`). Two renderers, chosen per recipe (PR #197): **`LivePourSequence`** for percolation (cumulative-grams pours, drawdown reserve) and **`StepGuide`** for immersion/AeroPress/iced/staged (setup card, steep countdown, action cards for invert/flip/press/drain/bypass). **Agitation is recipe-driven** (PR #198): the swirl/stir button shows only where the recipe calls for it — no stray swirl on a reduced-agitation recipe. Reads the recipe via `selectedCandidateIdx`; per-pour temperatures + notes render per step. |
| `LightStepLog.tsx` | Post-brew: flavor wheel, star rating, tasting notes |
| `LightStepSummary.tsx` | Review + save session |

**Light UI primitives (`src/components/ui/light/`):**
`LightShell` (wraps `(light)` group, sets `[data-light-scope]`), `LightFlowShell` (drives `useFieldConfig` per step, scrolls top on step change), `Field` (reads FieldContext → renders the **living motion stack** fixed -z-10: static `composeFieldGradient(zones, rotation)` base + `FieldBlobs` drift + `FieldGrain` + finger-following `FieldBloom`, driven by `useFieldMotion` CSS vars — see docs/liquid-design.md), `FieldBlobs` / `FieldGrain` / `FieldBloom` (the Field motion layers), `HaikuStarter` (home welcome-haiku — shimmer → scattered per-word spring entrance → dissolve → per-word touch lens), `Card`, `Section`, `Footnote`, `Chip`, `Hero` (eyebrow + Fraunces 40px question), `CTA` (anthracite button + cream text), `CTAWarmth`, `ActionPill` (Brew-Again candidates on home), `ChatInput`, `ChatThread`, `AttachmentSheet`, `NavigationOverlay` (full-screen menu — Home / Past Conversations / New Session / Coffee Library / Nearby / Café Library / Taste Profile), `ReferenceCoffeePicker`, `StarRating` (rotation toggle + log rating), `CircularTimer` (Light fork — anchored to Date.now, visibility-snap), `CoffeeBeanGlow` (anthracite stroke fork), `ConnectionStatus` (top-center pill rendered by `LightShell` — shows Offline / Syncing / "didn't sync — tap to retry"; owns the offline-save flush, re-checking `navigator.onLine` on mount + `visibilitychange` rather than the unreliable iOS online event), `LiquidHeadline` (reusable per-word scatter entrance + reverse per-word exit — backs the animated Hero questions + the recipe insight; see docs/liquid-design.md), `BagPhoto` (the ONE shared rounded-3xl inset bag-image treatment + cream scrim — coffee-detail / Save-brew / scan preview all use it), `CraftingStatus` (recipe-screen status line: black, sentence-case card-title style, cycling phases + animated 1-2-3 dots).

**Shared / Dark-era UI primitives (`src/components/ui/`):**
`Button`, `CoffeeBeanGlow` (kept for `PhotoUpload`; CSS shim `[data-light-scope] { filter: brightness(0) }` inverts it to anthracite at the consumer), `FlavorWheel` (now Light palette in place — canvas transparent, cream-glass panels, anthracite text/icons), `BrewMethodIcon` (inverted via the same shim), `NumberStepper`, `PhotoUpload`, `PlaceSearch`, `ProgressDots`, `StarRating` (still consumed by `CafeMap` only), `ThinkingDots`, `WaveformBars`.

Removed during the Light cleanup (PR #137): `BottomNav`, Dark `Chip`, `RadarChart` — all orphaned once their consumers migrated.

**Layout (`src/components/layout/`):**
`ScrollContainer` (root 100dvh wrapper with hidden scroll — no more allowlist, no nav-padding reserve), `BottomSpacer`

**Session:** `SessionCard` (Light, consumed only by `/coffees/[id]` All-brews list — Brew-method as headline, Field's cream-glass cards, swipe-to-delete with rust-red destructive button)
**Cafés:** `CafeMap` (Leaflet — consumed by `(light)/cafes/map`, now Light with warmed Positron tiles)
**Coach (`src/components/coach/`):** `CoachCard` (presentational card with the two-stage footer — New: Save to try / Confirmed / Doesn't apply; Saved: It helped / Didn't help / Skip — consumed by `/taste` queue) + `CoffeeCoachCard` (per-coffee card that reads the coffee's own `coffees.coach_insight` column — migration 0015 — an Opus-generated insight specific to THIS coffee; rotation-only). The old library-wide `citationFields`-overlap matching was replaced by 0015 because it surfaced other bags' insights on the wrong coffee. PR #215.

### `src/lib/`

```
lib/
├── coffeeHints.ts          # ★ COFFEE_HINTS — static seed + offline floor for the recipe-screen insight pool (docs/loading-insights.md)
├── insights/
│   └── loadingInsightLint.ts  # ★ Deterministic gate for the loading-screen insight agent — shared SoT (agent + read route + screen + CI)
├── auth/
│   ├── requireAuth.ts      # Server helper: throws if no valid session cookie
│   └── session.ts          # JWT session cookie create/verify (jose)
├── claude/
│   ├── recommend.ts        # ★ Full system prompt + recipe generation
│   ├── recipeFidelity.ts   # ★ Deterministic backstop (PR #266): after the model returns candidates, reconcileToReference() snaps a candidate's grind/temp/total-time/pourSteps back to the VERIFIED corpus recipe it's `basedOn` if they drifted beyond tolerance when scaled to the user's batch. Verified-refs only, 0.5–2.5× scale only, skips iced/bypass. Caught the Kasuya Super-Coarse "+50ml→+1:15" mangle. Tests: tests/dataflow/recipe-fidelity.test.mjs
│   ├── analyzeBag.ts       # Vision prompt + BagAnalysisResult type
│   ├── insights.ts         # ★ Coach orchestrator (Opus) — cache-aware regeneration over the full session corpus; preservation tiers (user-confirmed rows are never deleted)
│   ├── coffeeInsight.ts    # ★ Per-coffee coach card generator (Opus) — backs /api/coffees/[id]/insight + the prewarm admin route (migration 0015)
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
│   ├── session.ts          # ★ Core data model (all interfaces). BrewRecipe carries optional structured `pourSteps: BrewPourStep[]` (preferred over the legacy `pourSequence` string) using the `BrewStepAction` union (bloom/pour/final/stir/swirl/wait/press/invert/flip/drain/bypass/melodrip/agitate-bed). RecommendationCandidate carries `basedOn` (stable reference-recipe name). selectedCandidateIdx on BrewLog = the brewed candidate.
│   ├── coffee.ts           # Coffee-specific types
│   ├── preferences.ts      # UserPreferences interface
│   ├── cafes.ts            # CafeSummary + PlaceCoordinates
│   └── dripBag.ts          # DripBag interface — single-serve drip-bag records (isolated from sessions/coffees)
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
│   ├── 0009_add_in_rotation.sql           # coffees.in_rotation boolean (rotation marker)
│   ├── 0010_rename_rvtc.sql                # bulk rename "Rösterei Vier / The Commonage" → "RVTC"
│   ├── 0011_add_cafe_visits.sql            # cafe_visits table — visit-only logs + binary thumbs rating
│   ├── 0012_add_lessons.sql                # lessons table (PR #210). DEPRECATED — feature replaced by insights in #211; table preserved but unused
│   ├── 0013_add_insights.sql               # insights table + indexes (PR #211, coach observation corpus)
│   ├── 0013_add_lesson_questions.sql        # questions/answers cols + 'pending' status on the (now-removed) lessons "ask before rating" flow — dead alongside the lessons table
│   ├── 0014_add_insight_status.sql         # status workflow column on insights (`new`/`trying`/`confirmed`/`doesnt-apply`), PR #215
│   ├── 0015_add_coffee_coach_insight.sql    # coffees.coach_insight jsonb — per-coffee Opus insight (CoffeeCoachCard source)
│   ├── 0016_add_drip_bags.sql               # drip_bags table — single-serve drip-bag documentation records, isolated from the corpus
│   ├── 0017_add_insight_snooze.sql          # insights.snoozed_until + 'snoozed' status (two-stage coach workflow, +7-day skip)
│   └── 0018_add_loading_insights.sql        # loading_insights table — auto-refreshed loading-screen insight pool (also self-bootstrapped by the refresh route)
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
│   ├── cache.ts               # sessionStorage cache keyed by session id — /coffees/[id] pre-warms,
│   │                            /brew/[id] reads on mount so the cup's Field paints from frame 1
│   │                            instead of flashing default while the coffee fetch resolves
│   └── FieldContext.tsx       # React Context Provider + useFieldConfig() hook
│   # Consumed by <Field> (src/components/ui/light/Field.tsx), LightFlowShell, and the
│   # /coffees/[id] + /brew/[id] detail pages (which both call useFieldConfig directly).
│   # LightFlowShell rotates 25° per brew step (scan 0° → context 25° → recommend 50° → brew 75° → log 100° → summary 125°).
├── knowledge/
│   ├── insights.ts / news.ts / hints.ts / questions.ts / alerts.ts
│   ├── recipes/            # ★ Structured recipe corpus — 128 recipes total (6 championship + 77 reference [15 reference.ts + 62 expanded.ts] + 45 experimental; counted per-file June 2026 — an earlier "9 championship + 74 reference" breakdown didn't match the files). championship.ts = WBrC/WAC champions (Kasuya 2016, Du 2019, Medina 2023, Wölfl 2024, Stanica WAC 2024, Nemo Pop WAC 2025 — all 6). reference.ts + expanded.ts = Hoffmann V60/Clever/AeroPress/Moccamaster/Iced, Kasuya 4:6, April V60 (Rolf), Gagné, Perger, Rao, Hatakeyama, Wallgren + dozens more. markusAdditions.ts = 45 user-supplied recipes (category "experimental"). Full pour mechanics with per-step durations, attribution, sources, verified flag. NO staged/multi-temperature recipes — removed June 2026 (impractical for everyday; needs two water setups). Every recipe brews at ONE constant temperature. selectRecipes() injected into /recommend per turn. **Equal best-match ranking (PR #193):** scoreRecipe() has NO pedigree/verified bonus — every recipe competes purely on context match (roast/process/variety/goal/occasion). **Method lock:** when the user locks a method in the flow (context.preferredMethod), selectRecipes hard-filters to that brewer (via brewersFromMethod) and returns the best N recipes FOR THAT METHOD; with no lock it's the one-per-brewer diversity portfolio. **Full mirror:** @./docs/recipes-full.md (partially stale — predates the experimental additions); @./docs/coffee-experts.md is the curated summary (partially stale). (May 2026 source-audit: removed Turbo V60 — espresso-origin; replaced fabricated "Rolf Minimum Variables" with April's real house V60; corrected Perger to 12g/200g; flagged Hatakeyama numbers unsourced.) **June 2026 primary-source audit (PRs #265–#277, owner-supplied transcripts + web):** every named-expert recipe re-verified against the originator's own video/page. Corrected the worst "different recipe wearing the author's name" cases — Gagné AeroPress (was 80°C low-temp → his real HOT 100°C/18g:260g/10-min), Rao (was "Rule of Thirds" equal-thirds → his actual spin-method 20g:330g, he opposes >2 pours), Hoffmann AeroPress (was inverted → his UPRIGHT Ultimate), Hoffmann Moccamaster (was 8:00 → his measured 3:30 for 750g), Hatakeyama (unsourced reconstruction → real 2024 JBrC: 15g:240g/85°C/coarse). New entries: Hoffmann Japanese Iced V60 (pour-over), Nemo Pop WAC 2025, Stanica's separate inverted-Melodrip recipe (his WAC winner is the upright Flow-Control one — both kept, cross-referenced). Kasuya 4:6 temp 92→93. Fabricated water ppm (Wölfl/Kasuya "55ppm") removed.
│   ├── varieties/          # ★ ~25 WCR-grounded variety priors. Bourbon family (Bourbon, Caturra, Catuai, Mundo Novo, Pacas, Yellow Bourbon, Pink Bourbon), Typica family (Typica, Java, Maragogype, Sumatra), Ethiopia landrace (Heirloom, Wush Wush, Chiroso, Sidra), Geisha, SL series (SL28, SL34, Ruiru 11, Batian), F1 / disease-resistant (Castillo, Tabi, Centroamericano), Pacamara, Mokka. Pink Bourbon flagged per WCR 2024 finding it's NOT a Bourbon mutation. Sidra origin marked as disputed. getVarietyPriorsForBag() injected into /recommend + /explore-agent.
│   ├── techniques/         # ★ 25 atomic brewing moves citable by id — 16 named-expert + 9 general/foundational (added June 2026 in the tag cleanup so every recipe references a real id, not free text). Named: Temperature (turbo/boiling-water-coarse-grind [espresso-origin, Hedrick popularised], Gagné second-sweet-spot), agitation (Rao spin, Hoffmann swirl-not-stir, Perger high-extraction, minimal-agitation, Peng Melodrip, Bailey/Hoffmann water-first), pour-pattern (Kasuya 4:6, Rao thirds), pre-brew (Wallgren sieving, Hatakeyama roast-tailored filter), post-brew (Hoffmann/Stanica bypass, flash chilling), AeroPress inversion, Hendon low-mineral water. General (verified:false, no single originator): bloom, pulse-pouring, immersion-steep, central-pour, spiral-pour, continuous-pour, machine-drip-brew, batch-scaling, flat-bed-pour. Each cross-references exemplifying recipe IDs. Compact id+description list injected per turn. The cross-reference is gated BOTH ways by tests/recipes/validate.mjs: every recipe technique id must exist in techniques, AND every technique exemplifiedBy id must exist in the recipe corpus (reverse check added June 2026 after the staged-temp purge + inversion-exemplar fix left dangling/contradictory exemplars undetected). (staged-temperature + three-roast-layering removed June 2026 with the staged-temp recipes.)
├── roasters/priors.ts      # ★ 50+ curated roaster style priors; getRoasterPrior() + formatRoasterPriorForPrompt() consumed by /recommend AND /explore-agent
├── constants/
│   ├── brewMethods.ts / flavorTaxonomy.ts / scaFlavorWheel.ts
│   └── grindSettings.ts    # ★ Single source of Niche Zero degrees — replaces hardcoded copies in CLAUDE.md / docs / prompts
├── theme/
│   └── gradients.ts        # Shared gradient tokens (CSS strings) used across pages
├── storage/
│   ├── s3.ts               # Hetzner Object Storage (S3-compatible)
│   ├── idb.ts              # ★ Tiny promise-based IndexedDB wrapper — DB `brewlog-offline`, two stores (brewable, pendingSessions). Backs the offline brew feature.
│   ├── offlineLibrary.ts   # ★ Caches coffees + their TOP-2 best-rated recipes (deduped) for offline re-brew. Warmed in background on online /coffees loads.
│   └── saveQueue.ts        # ★ Offline save queue — parks the /api/sessions POST body in IDB; flushQueue() drains it (never drops a brew on failure).
├── flow/
│   └── brewAgain.ts        # ★ Shared brew-flow entries — startBrewAgain() (online → Step "context") + startBrewAgainOffline() (seed cached recipe → Step "brew") + startBrewFromChat() (seed the chat's exact recipe as a 1-candidate recommendation → Step "brew"; backs the chat `start_brew` button, PR #199). Used by /coffees list, /coffees/[id], ActionPill.
└── utils/
    ├── cn.ts / safeFetch.ts / formatTime.ts
    ├── pourSequence.ts     # ★ Pure pour timing. parsePourSteps() (tolerant of inline @temp/notes annotations) → percolation PourStep[]; pourStepsFromStructured() builds the same from a recipe's structured pourSteps AND derives per-pour agitation from adjacent stir/swirl steps; buildGuideSteps() + hasImmersionShape() drive the immersion StepGuide. PourStep carries temperatureC/notes/agitation.
    ├── resolveRecipe.ts    # ★ resolveBrewedRecipe(session) — single source of truth for "the recipe the user ACTUALLY brewed" (the selectedCandidateIdx candidate, NOT primaryRecipe). Used by chat history, timing stats, offline cache, brewSignature, brew detail so the primary-vs-selected bug class (PR #193, #198) can't recur per-call. brewedRecipeName() = title (+ "based on …").
    └── pourSequence.test.mjs  # node --test suite — pour math + tolerant parse + structured/guide + agitation + resolveBrewedRecipe
```

### Other key files

| File | Purpose |
|------|---------|
| `src/store/flowStore.ts` | ★ Zustand brew flow state (**localStorage**-persisted since the offline work — survives a mid-brew reload; "New Session" in `NavigationOverlay` calls `reset()` so it never resumes a stale draft) |
| `src/hooks/useOnline.ts` | Connectivity boolean (seeds `true` for SSR, then `navigator.onLine` + online/offline events). Used by the `/coffees` pages for the offline read path. |
| `src/hooks/useWakeLock.ts` | Keep screen on during active brew |
| `src/hooks/useVoiceCapture.ts` | Mic recording + level metering for inline-chat voice input (BTTS Home) |
| `src/hooks/useVoicePlayback.ts` | Streaming TTS playback for inline-chat voice output (BTTS Home) |
| `src/hooks/useFieldMotion.ts` | ★ Living-Field motion driver — one rAF loop writes `--field-*`/`--ptr-*` CSS vars (pointer lean, scroll parallax, tap swell, finger bloom) on the Field root; layers read them, zero React re-render. Reduced-motion-gated. See docs/liquid-design.md |
| `src/hooks/usePresence.ts` | Generic delayed-unmount `(present, exitMs) → {mounted, state}` — keeps a node mounted through its exit animation (haiku dissolve). Replaces framer-motion AnimatePresence |
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

### Database tables (Drizzle + Postgres)

`sessions`, `coffees`, `auth_credentials`, `auth_challenges`, `preferences`, `roasters`, `knowledge`, `coffee_alerts`, `places`, `conversations`, `conversation_messages`, `cafe_visits`, `insights`, `drip_bags`, `loading_insights` (15 tables; `lessons` from PR #210 also exists but is read-by-nothing post-#211 — its `/lessons` page, `/api/lessons` route, and `src/lib/claude/lessons.ts` distiller were all removed, only the table + migrations 0012/0013_add_lesson_questions remain as dead schema).

Recent additions:
- `coffees.field_zones jsonb` (migration 0008) — persisted Field composition per coffee
- `coffees.in_rotation boolean NOT NULL DEFAULT false` (migration 0009) — star toggle for "currently brewing this bag"
- **Migration 0010** (applied 2026-05) — bulk-rename roaster variants `"Rösterei Vier / The Commonage"` / `"RVTC – Rösterei Vier / The Commonage"` → `"RVTC"` across coffees + sessions JSONB + roasters priors cache.
- **Migration 0011 + new `cafe_visits` table** (applied 2026-05) — schema: `id`, `cafe_name`, `location`, `rating` ('come-back' | 'wont-return'), `notes`, `visited_at`, `visited_at_ms`. Visit-only café logs without an attached brew session. Binary thumbs rating since there's no brew context for stars. Aggregated into `/api/cafes` so visit-only places appear in the Café Library.
- **Migration 0013 + new `insights` table** (applied 2026-06) — schema: `id`, `observation`, `suggestion`, `citation_fields jsonb`, `latest_session_ms`, `source` ('opus' | 'user-confirmed'), `status` (added by 0014), `dismissed_at` (legacy, replaced by status), `user_note`, `created_at`, `updated_at`. Multivariate coach observations over the full session corpus. (PR #211)
- **Migration 0014 — `insights.status text`** (applied 2026-06-02) — workflow state machine `new`/`trying`/`confirmed`/`doesnt-apply`. Indexed. Default `'new'`. Orchestrator (`src/lib/claude/insights.ts`) only replaces `status='new'` rows on regeneration; user-acted rows (trying/confirmed/doesnt-apply) are preserved, and re-emitted similar observations inherit the existing status. `/recommend` + `/greeting` filter `status != 'doesnt-apply'` AND hide actively-snoozed rows (an expired snooze flows back in). (PR #215)
- **Migration 0015 — `coffees.coach_insight jsonb`** — per-coffee Opus insight (`{observation, suggestion, status, generatedAtSessionMs, generatedAt}`, type `CoffeeCoachInsight` in `schema.ts`). Backs `CoffeeCoachCard` on `/coffees/[id]`. Regenerates when the coffee gets a newer session, EXCEPT while status is `trying`/`confirmed` (don't move the card under the user). Replaced the prior library-wide citationFields-overlap matching that surfaced other bags' insights on the wrong coffee.
- **Migration 0016 + new `drip_bags` table** — single-serve drip-bag documentation records (id, roaster, name, origin/region/variety/process/roast_level, bag_notes, flavor_notes, rating, free_notes, bag_photo_*, field_zones, ai_extracted, created_at(_ms)). Fixed brew (200 ml through the built-in filter) → no recipe, no timer. **Deliberately isolated** from sessions/coffees/the AI corpus (mirrors `cafe_visits`) so drip bags never skew `/recommend`, `/insights`, `/taste`, or the Café Library. Surfaced only in the Coffee Library (flagged) + their own `/coffees/drip/[id]` detail. Type `DripBag` in `src/lib/types/dripBag.ts`; routes `/api/drip-bags` (+ `[id]`).
- **Migration 0017 — `insights.snoozed_until` + `'snoozed'` status** — the coach card became a **two-stage** workflow: New (`new`) → Save to try / Confirmed / Doesn't apply, then Saved (`trying`) → It helped / Didn't help / Skip. **Skip** = remind-me-later → `status='snoozed'`, `snoozed_until = now()+7 days`; hidden until it passes, then resurfaces and regen treats it like `new`. The status CHECK constraint was rebuilt to allow the new value.
- **One-shot data fix** (applied 2026-06-02) — Friedhats Quiquira + Policarpo Yossa Rojos roast date bumped from `2025-05-18` → `2026-05-18` in both `coffees.latest_roast_date` and `sessions.coffee` JSONB. Bag-scanner had defaulted to last year on ambiguous month/day stamps; PR #216 closes the loop in code so it can't recur.

All migrations applied manually on the VPS — see migration NOTE above.

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

## Current Status — Snapshot June 2026

### ✅ Done

**Auto-refreshed loading-screen insight agent (June 2026, PRs #342 / #345 / #346 / #347)**
- The recipe-crafting loading screen (`LightStepRecommend`) rotated a static `COFFEE_HINTS` array; now a scheduled agent grows/swaps the pool **monthly, full-auto, no human review**. Because the owner chose no review and "never fabricate" is non-negotiable, a **machine gate replaces the human one**: every candidate — from the verified corpus, brew aggregates, AND live `web_search` — must be grounded in a cited source (numbers + mid-line proper nouns must appear in it), pass `src/lib/insights/loadingInsightLint.ts` + a model claim-check, before insert. Web lines carry a verbatim quote as their grounding; residual web-fabrication risk is accepted for this low-stakes surface.
- `loading_insights` table (migration 0018, **also self-bootstrapped** via `CREATE TABLE IF NOT EXISTS` in the refresh route — the integration can't dispatch the migration workflow, `403`). GET `/api/loading-insights` is defensive (→ seed on any failure); `LightStepRecommend` merges pool + seed, and the seed is the unbreakable floor (instant, offline-safe, never regresses).
- Runs via `.github/workflows/loading-insights-refresh.yml` (monthly cron + `workflow_dispatch`): SSHes in with the **deploy key** and triggers `docker compose exec -T app curl` from inside the container — zero new secrets, reads the container's own `CRON_SECRET`, no Ofelia restart.
- **The Dockerfile now installs `curl`** (`node:20-alpine` shipped without it). This ALSO unbroke the existing Ofelia crons (`/api/research`, `/api/conversations/cleanup`, `/api/coffees/compact`), which had been silently failing on `curl: not found` (Ofelia only Slacks on error, which isn't wired). Don't remove curl.
- Full reference: **`docs/loading-insights.md`** (architecture, the gate, the sources, ops, tuning dials). Tests: `tests/dataflow/loading-insight-lint.test.mjs`.

**Recipe-fidelity system + extraction-budget framework + primary-source audit + deploy fix (June 2026, PRs #265–#278)**
- **Recipe fidelity (two layers).** (1) Prompt rule in `recommend.ts` (#265): when a candidate is `basedOn` a documented recipe, preserve its grind/cadence/temp/total-time and scale ONLY the grams — adding 50ml must never add 1:15. (2) Deterministic backstop `src/lib/claude/recipeFidelity.ts` (#266): `reconcileToReference()` runs after parsing and snaps a drifted candidate's mechanics back to the VERIFIED scaled corpus recipe. Verified-refs only, 0.5–2.5× scale only, skips iced/bypass. Tests: `tests/dataflow/recipe-fidelity.test.mjs`. Root cause was the Kasuya Super-Coarse "+50ml→+1:15 / lost super-coarse grind" mangle (the model rewrote the recipe at generation time; the timing math was innocent).
- **Extraction-budget framework (#268, mirrored to explore-agent #269).** Layer-2 of `recommend.ts` reworked around one dial — *how much input does this coffee need* — with a strict precedence so factors can't contradict: **GOAL > ROAST > PROCESS > FRESHNESS**. Conflict rule for the stale-natural case (process says coarser, age says finer): grind follows the drawdown-time target, temperature + agitation close the gap (temp stays an extraction lever, never a flow one). Fixed two self-contradictions (washed "high solubility" vs needs-most-coaxing; natural pour-count "fewer" vs "5 pours"). Naturals default to fewer pours on clarity/balanced; a body/sweetness goal may use more pours AT a coarser grind (Kasuya percolation-cycles effect).
- **Time buckets simplified.** `LightStepContext` only offers **Quick (~2 min)** and **Normal (~5 min)** — "Unhurried" was dropped from the UI; `recommend.ts` time vocabulary now matches (no `unhurried`/`≥360s` bucket; a stray one folds into normal's slow end, ~330s cap). (#273)
- **Primary-source recipe audit (#267, #270–#277).** Every named-expert recipe re-verified against the originator's own video/page (owner-supplied transcripts for the YouTube-blocked ones). Corrected the worst fabrications — Gagné AeroPress (80°C low-temp → real HOT 100°C), Rao (equal-thirds "Rule of Thirds" → his spin method; he opposes >2 pours), Hoffmann AeroPress (inverted → UPRIGHT Ultimate), Hoffmann Moccamaster (8:00 → measured 3:30/750g), Hatakeyama (unsourced → real 2024 JBrC 15g:240g/85°C/coarse). Confirmed-correct: Hoffmann V60 1-Cup, Clever, Immersion Iced, Kasuya, Du, Medina, April/Rolf. New entries: Hoffmann Japanese Iced V60 (pour-over), Nemo Pop WAC 2025, Stanica's separate inverted-Melodrip recipe. **NOTE: Stanica won WAC 2024 with the UPRIGHT Flow-Control recipe (`wac-2024-stanica`); his inverted-Melodrip recipe (`stanica-inverted-melodrip`, reference.ts) is a DIFFERENT recipe — both kept, cross-referenced in their notes.** Corpus 125 → 128. Owner-supplied parameters; Niche degrees derived from published Comandante clicks where given.
- **Deploy concurrency fix (#278).** `deploy.yml` had no `concurrency` guard, so two push-triggered deploy runs could race on the VPS git checkout → `cannot lock ref 'refs/remotes/origin/main'` (a red but harmless failure — the parallel run for the same commit deployed fine). Added `concurrency: { group: deploy-hetzner, cancel-in-progress: false }` (queue, don't cancel) + on the VPS clear any stale ref lock and `git reset --hard FETCH_HEAD` instead of `origin/main`.

**Removed all staged-/multi-temperature recipes (June 2026)**
- Staged temperature (cool-bloom-then-hot, descending-temp pours, etc.) needs water at two temperatures during one brew — not practical for everyday brewing. Killed by request.
- **Recipes removed (9):** `wbrc-2022-hsu` (the one that kept surfacing), `wbrc-2025-peng` three-roast staged, `the-peak-staged-temp`, and 6 experimental cold-bloom / multi-temp entries in `markusAdditions.ts`. Corpus 133 → 124.
- **Techniques removed (2):** `staged-temperature` and `three-roast-layering` (the latter only ever exemplified by Peng). 18 → 16. Dangling exemplars re-pointed (melodrip → Wölfl, who genuinely uses one; low-mineral-water → Du only).
- **Prompts scrubbed:** `recommend.ts` + `explore-agent` now carry an explicit "NO STAGED TEMPERATURE — every recipe uses one constant temperature; achieve aromatic preservation via grind/ratio/low-mineral water/minimal agitation" rule, and `pourSteps[].temperatureC` is instructed to be omitted. Variety recipe-pair lists, the grind-reference block, the quick-time list and the expert-name lists all had Hsu/Peng pulled.
- **Docs mirrored:** `coffee-experts.md`, `recipes-full.md`, `grind-settings.md` updated. (Behavioral change — its own commit.)

**Coach workflow + /taste layout + per-coffee insight + brew detail 2×2 (PR #215, June 2026)**
- **Three-action insight workflow.** `insights.status` column (migration 0014) with state machine `new → trying → confirmed` or `→ doesnt-apply`. **Try it** queues a quiet reminder for the next time the user opens `/brew/new` on a matching coffee. **Confirmed** boosts `/recommend` + `/greeting` weight (also bumps `source = 'user-confirmed'`). **Doesn't apply** soft-dismisses and is preserved across regenerations so the same observation isn't re-pitched. The orchestrator (`src/lib/claude/insights.ts`) ONLY replaces `status='new'` rows on regeneration — user-acted rows are kept verbatim, and re-emitted similar observations inherit the existing status (text-match on the first 80 chars).
- **`/taste` page restructured.** Coach section at the top: top 3 `status='new'` insights as cards. When a card is processed (Confirmed or Doesn't apply count as solved — Trying doesn't), the next from the 5–8-deep queue slides in. **"What you brew" is now ALWAYS VISIBLE** — flavor wheel, top flavors, rating trend, body / acidity, best origins / processes / methods. No collapsible. The two-paragraph card layout (observation row, suggestion row, different weights) is intentional for scanning.
- **`/coffees/[id]` single coach card** between the Roaster section and the Personal Notes section. **Rotation-only** (out-of-rotation pages stay clean — no card). *(As shipped in #215 this matched by `citationFields` overlap with the coffee's attributes — that mechanism surfaced other bags' insights on the wrong coffee and was REPLACED by migration 0015: the card now reads the coffee's own `coach_insight` column via `/api/coffees/[id]/insight`. Don't reintroduce overlap matching.)*
- **`/brew/new` Context step quiet reminder.** Read-only card above the selectors, surfaces when the chosen coffee's own coach card is `status='trying'` (same per-coffee source as above — post-0015, no attribute matching). The user already chose Save-to-try; this is the nudge when they reach for that coffee.
- **`/brew/[id]` 2×2 stat grid.** Dose | Grind on row 1, Water | Temp on row 2. Same `Stat` primitive as before. Iced brews still get an extra Ice + Final cup row underneath.
- **Recipe intro widened.** `recommend.ts` prompt: `reasoning` is now ONE substantive sentence (40–60 words) grounded in a named coffee-science principle. Not a headline fragment, not a 6-sentence wall.

**Bag scanner roast-date current-year guard (PR #216, June 2026)**
- The bag scanner consistently parsed month-and-day-only stamps as last year's date (a Friedhats Quiquira bag from 2 weeks ago was logged as 14 months old, cascading through the welcome haiku + `/recommend` freshness + zone classifier).
- **Prompt fix:** `analyzeBag.ts` builds `USER_PROMPT` fresh per call so today's date can be injected. Explicit ROAST DATE RULES section forces the model to use the current year on ambiguous month/day stamps, only drop back a year if that would put the date in the future, never use a "best before" date as roastDate, always return ISO `YYYY-MM-DD`.
- **Defensive post-process:** `guardRoastYear()` — if the returned date is more than 11 months in the past AND shifting it forward by one year lands within the fresh-bag window without going into the future, take the bump. Catches the case where the model still gets it wrong despite the prompt rule.
- **Data fix:** Friedhats Quiquira + Policarpo Yossa Rojos (both in rotation) bumped from `2025-05-18` → `2026-05-18` in both `coffees.latest_roast_date` and per-session `coffee.roastDate` JSONB on 2026-06-02.

**Conversation 1-week TTL + Ofelia cleanup cron (PR #217, June 2026)**
- New `POST /api/conversations/cleanup` endpoint deletes archived conversations whose `archivedAt < now() - 7 days`. Messages cascade-delete via the existing `conversation_messages.conversation_id` FK (`onDelete: 'cascade'`).
- New Ofelia job in `deploy/ofelia.ini` runs daily at 04:00 UTC, same `CRON_SECRET` bearer pattern as `/api/research` and `/api/coffees/compact`.
- **NEVER touches active conversations** (`archivedAt IS NULL`) — that's the live thread on /home; auto-deleting it after a quiet week would surprise the user.

**Deploy workflow hardening (PR #218, June 2026)**
- The deploy after PR #216 failed with `Error response from daemon: removal of container <id> is already in progress` (exit code 123). Root cause: a manual `docker compose up -d ofelia` (run earlier to pick up the conversation-cleanup cron) triggered a compose reconciliation that began removing the app container; the workflow's hand-rolled `docker rm -f` then fired while removal was in flight and the daemon rejected the second rm.
- **Fix:** drop the hand-rolled rm sequence; let compose drive the recreate via `docker compose up -d --force-recreate --no-deps app`. `--force-recreate` handles "container already exists" + "removal in progress" daemon states gracefully (compose serialises with its own teardown); `--no-deps` keeps postgres + caddy + ofelia untouched. Five-attempt fallback retry loop with growing backoff preserved for daemon wedges.

**Security scrub + visibility flip (PR #219, June 2026)**
- Repo was public the whole time without anyone realising. CLAUDE.md leaked the literal Hetzner IP (`89.167.31.219`), the deploy SSH paths, the user's email, and the Düsseldorf location. The "main is branch-protected" claim was also false (GitHub's free plan + private repo can't enforce branch protection).
- **CLAUDE.md scrubbed:** Hetzner IP → reference to `DEPLOY_HOST` GitHub Actions secret. "Düsseldorf tap" → "hard local tap" (chemistry is what matters). Branch-protection claim updated to reflect reality (PR flow is by convention).
- **`deploy/README.md` scrubbed:** same IP replaced with placeholder in three places (server header, ssh example, DNS A-record example).
- **Stale Pages marketing site deleted** from `docs/`: the `index.html` / `about.html` / `how-it-works.html` / `open-source.html` / `the-gap.html` files referenced a Firebase stack that hasn't existed since the Postgres migration, AND they were stored in git as JSON-wrapped base64 (got mangled in a fetch-write roundtrip). GH Pages was disabled in repo settings anyway.
- **Caveat:** the IP still exists in git history from the public period. Real security boundary is the Hetzner SSH key + Caddy + firewall, not the IP being secret.
- Repo flipped private momentarily for the scrub, then back to public. Dependabot alerts + Secret scanning enabled on the Security tab.

**Step-by-step brew timer + recipe names + chat→brew (PR #195 → #200, May 2026)**
- **BTTS chat branding + no pour-arithmetic** (#195): the home chat brands itself only as "Better taste than sorry / BTTS" (no "BrewLog" in replies — internal code/headers unchanged) and is instructed to present verified recipes rather than improvise pour math.
- **Step-by-step, method-aware timer** (#197): the active-brew guide used to stall on "Step 1 of 1" whenever a pour string carried inline annotations (e.g. staged per-pour temps `70 (@70°C) – …`). `parsePourSteps` is now annotation-tolerant; `BrewRecipe.pourSteps` carries structured steps; immersion/AeroPress/inverted/iced route to an action-aware `StepGuide` (setup card, steep countdown, flip/press/drain cue at the right moment); recommend emits structured `pourSteps` (sanitised post-parse, graceful fallback to the string).
- **The no-go — chat reported a wrong grind** (#198): `buildRecentRecipes` (and offline cache, brewSignature, timing stats) read `primaryRecipe` instead of the brewed candidate, so the chat stated the primary's numbers (398° vs the 405° actually brewed). Fixed with one shared `resolveBrewedRecipe()` used everywhere. **Recipe-driven agitation:** the swirl/stir button shows only where the recipe calls for it (no stray swirl on reduced-agitation recipes). **Recipe name** (`title` + `basedOn`) now shows on the brew screen, brew detail, recommend screen, and in the chat context ("Most Recent Brew" block).
- **Chat → direct brew** (#199, fixed #200): the chat's "Brew X" button (`start_brew` tool → `startBrewFromChat`) drops the user straight into the timer with the chat's *exact* recipe — no context, no re-recommendation. Use case: a few grams left, brewed via a one-off chat recipe not worth saving. (#200 fixed the button being a no-op — `start_brew`'s `destination` is set from the tool name, not its input.) ⚠️ The chat-emitted recipe must equal its prose; enforced by prompt only — flag if a mismatch ever appears on the PWA.

**Recipe corpus expansion + selection fairness + flow fixes (PR #190 → #193, May 2026)**
- **Recipe pool 19 → 133** (#191, #192): added `markusAdditions.ts` (51 user-supplied recipes, category "experimental") on top of the corrected championship/reference sets. Source-audit corrections to existing entries (Hoffmann V60/Clever/Iced/AeroPress, Wallgren, Du/Hsu/Wölfl/Peng) against primary transcripts. Niche grind re-baselined to the measured V60 anchors. `docs/recipes-full.md` is the full mirror (all 133 with brew steps).
- **6th goal `aromatic`** (#192): the flow already offered "Aromatic / Floral" but the recipe `Goal` type + `normaliseGoal()` didn't know it (silently fell back to `balanced`). Added to the type/normaliser; remapped 10 iced/cold-bloom/staged-with-cool-finish recipes onto it.
- **Equal best-match selection** (#192): removed the `+1` championship-pedigree and `+0.5` verified bonuses in `scoreRecipe()`. All 133 recipes rank purely on context match. **Method lock:** `context.preferredMethod` hard-filters `selectRecipes` to that brewer (`brewersFromMethod`) and returns the best N FOR THAT METHOD; no lock → one-per-brewer diversity portfolio.
- **Alternative-recipe temp/grind bug** (#193): Brew/Log/Summary/`/brew/[id]` resolved the chosen recipe by method NAME — when two candidates shared a method (common with the method-lock), they always loaded candidate 0's temp/grind. Fix: `BrewLog.selectedCandidateIdx` carries the explicit index through the whole flow (name-match → primaryRecipe fallback for legacy).
- **Drip Assist demoted to emergency-only** (#193): "V60 + Drip Assist" is selectable in the method picker ("no gooseneck? emergency only", maps to v60), but not in onboarding and never recommended proactively. Legacy compat fields kept so old sessions render.

**Offline Brew Mode — re-brew a known coffee without a network (PR #184 + #185)**
- The brew process itself was already client-only (timer, pour guide, tasting log — no network; pour math is local). The two gaps were getting a recipe (the `/api/recommend` Opus gate) and saving (`/api/sessions` POST). Offline mode closes both by **reusing a previously-brewed recipe** and **queuing the save**.
- **Scope:** offline you open a coffee from the locally-cached library, pick one of its **two best-rated** past recipes (auto-used if there's only one), brew with the full timer + pour guide, log, and the save is buffered + auto-synced on reconnect. NO offline AI, NO offline bag scan, NO brand-new coffees offline. Online flow is **unchanged** (KI still generates fresh recipes) — the recipe picker is offline-only, so the validated Opus path is untouched.
- **Cache (`src/lib/storage/offlineLibrary.ts`, IndexedDB):** per coffee, its richest identity + Field zones + up to 2 deduped best-rated recipes, derived from the session feed. Warmed in the background on every online `/coffees` load (full-feed fetch → top-2 per coffee) and refreshed per-coffee on `/coffees/[id]`. Never blocks the visible list.
- **Offline entry:** `/coffees` reads from cache when offline; tapping a coffee opens an **inline recipe-picker sheet on the list** (NOT the detail route — `/coffees/[id]` is server-rendered, so its RSC isn't reliably cached offline, whereas `/coffees` + `/brew/new` are precached). Picking seeds the flow via `startBrewAgainOffline()` and jumps straight to Step "brew", skipping context + recommend. `/coffees/[id]` also has an offline slim view (picker) for the case it IS cached.
- **Save queue (`src/lib/storage/saveQueue.ts`):** `LightStepSummary` enqueues the exact POST body when offline (or on a network throw); success screen says "saved offline — will sync". `flushQueue()` drains it and **never drops a brew** on failure (a stuck save stays visible + retryable).
- **Sync trigger (`ConnectionStatus`, the fix in #185):** iOS Safari PWAs fire the `online`/`offline` events unreliably (so does next-pwa's `reloadOnOnline`), so flushing is driven off `navigator.onLine` re-checked on **mount + `visibilitychange`** (reopening / foregrounding the app reliably fires) — the `online` event is a bonus trigger only. The pill surfaces Offline / Syncing / "didn't sync — tap to retry".
- **Durability:** `flowStore` persists to `localStorage` (was `sessionStorage`) so a mid-brew reload doesn't lose the draft. `NavigationOverlay`'s "New Session" calls `reset()` so a fresh session never resumes a stale draft.
- **PWA:** `next.config.mjs` `fallbacks.document: "/offline"` catches uncached offline navigations. App shell (`/`, `/coffees`, `/brew/new`) precached via the existing `cacheOnFrontEndNav`.
- **Cache caveat:** the offline cache only contains coffees whose library/detail you opened online at least once. A coffee never seen online won't be brewable offline (list empty-state / `/offline` handle it gracefully).

**BTTS Light migration — complete (PR #65 → #137)**
- Every visited surface lives in the `(light)` route group with the BTTS Light theme — Cream background, Fraunces 40 px hero, Chivo body, anthracite foreground, generative Field background.
- Light primitives stack: `LightShell`, `LightFlowShell`, `Field`, `Card`, `Section`, `Footnote`, `Chip`, `Hero`, `CTA`, `CTAWarmth`, `ActionPill`, `ChatInput`, `ChatThread`, `NavigationOverlay`, `StarRating`, `CircularTimer` (fork), `CoffeeBeanGlow` (fork).
- Atomic cut-over (PR #95) renamed `(light)/brew/preview` → `(light)/brew/new` and deleted ~4,300 lines of Dark step code (`Step*.tsx` + `FlowShell.tsx` + Dark `CircularTimer`).
- `[data-light-scope]` CSS shim in `globals.css` adapts shared Dark-era components (`BrewMethodIcon`, original `CoffeeBeanGlow`) via `filter: brightness(0)` so they read as anthracite inside the Light tree without being forked.
- Migrated this arc (Sep–May 2026): `/brew/[id]` (#122), `/coffees/[id]` Field adoption (#123), SessionCard rewrite (#120), `/cafes` + `/cafes/place/[slug]` + `/cafes/coffee/[id]` (#134), `/login` + `/onboarding` (#135), `/taste` (#136). `/cafes/map` (Nearby) is also fully Light — warmed Positron tiles via the `[data-light-scope]` sepia filter — pin to a specific PR pending.
- Cleanup pass (#137): removed `BottomNav`, `RadarChart`, Dark `Chip` (all orphaned post-migration); `loading.tsx` flipped to Light with explicit cream bg so route transitions don't flash dark; `ScrollContainer` simplified (no allowlist, no nav-padding reserve); `--nav-bottom-padding` CSS var dropped.
- PWA chrome aligned (#113–#119): `themeColor: #D4B8C9` (mauve) on viewport + `manifest.json`, `manifest.background_color: #F3E5DC` (cream so the splash matches the Field base), `appleWebApp.statusBarStyle: "default"`, `html { background-color: #F3E5DC }` so the Light cream is the baseline even if the Field gradient is thin at the very top pixels.

**UI polish across the Light surfaces**
- Chip vocabulary unified across SessionCard, `/coffees/[id]`, `/brew/[id]`, `LightStepSummary`, Café Library, Café detail — all static tags now share the `Chip` primitive's default cream-glass look (`px-3 py-1.5`, 12 px, `bg-light-card-default` + backdrop blur, anthracite text). Bordered outline variant was a regression noticed in #124 and reverted in #126.
- Coffee Library card architecture (#127, #132, #133): full-bleed 96 px bag-photo strip on the left, content middle, right column with brew count over the Brew CTA (centered, not edge-aligned). Brew CTA gated on `inRotation` so out-of-rotation rows don't dangle an action they shouldn't trigger (#117).
- Coffee Detail (`/coffees/[id]`) reads its coffee's Field via `useFieldConfig` (#123). Hero scrim flipped to cream-to-transparent (#121) so anthracite titles stay legible against any bag photo. Rotation toggle gates the "Brew this" CTA (#117) — out-of-rotation = bag-not-on-counter, no shortcut shown.
- SessionCard (`/coffees/[id]` All-brews list) rewritten as a Light card (#120): brew method headline + recipe meta (date · dose · water · time) + flavor chips; swipe-to-delete button fades in proportional to swipe progress (#124) so it doesn't bleed through the translucent cream at rest.
- Brew Session Detail (`/brew/[id]`) inherits the cup's Field via `lib/field/cache.ts` (#125) — `/coffees/[id]` pre-warms the cache for all its sessions when it loads, `/brew/[id]` reads synchronously on mount, so navigating between the two paints the same Field with no flash through default. Back arrow routes to `/coffees/[coffeeId]` (#126) instead of the library root, with router.back() as a fallback for legacy sessions whose `CoffeeIdentity` was persisted before `coffeeId` existed.

**Late-May follow-ups (PR #139 → #145)**
- Login wordmark renders as the Home hero ("Better taste / than sorry." in Fraunces 3xl, full anthracite) across all three login states (#139, #140). Login CTAs (Use Face ID / Unlock / Set up Face ID) are pill-shaped (rounded-full + h-14) matching the onboarding primary buttons.
- SessionCard background dropped from 55 % to 30 % cream (#139) so the flavor chips inside (still at 55 %) pop visibly against the card — fixes the white-on-white screenshot.
- Café Coffees-tab cross-link (#141): tapping a coffee that exists in the library routes to `/coffees/[coffeeId]` instead of the café-specific aggregate. Café-only coffees still land on `/cafes/coffee/[key]`.
- Scan edit affordance (#143): the `EditableRow` rows on the bag confirmation step always render with a visible underline + pencil icon. Roaster + Coffee rows always show (were `!== undefined`-gated, so unextracted bags had no editable rows). Lets the user shorten long names like "El Congo by Carlos Montero – Don Eli" → "El Congo" at scan time.
- Orea V4 four-bottom variants (#144): new SVGs `orea-classic.svg` / `orea-open.svg` / `orea-apex.svg` / `orea-fast.svg` in `public/brew-icons/`. `BrewMethodIcon.brewIconSrc` switches on the variant keyword inside the orea branch; legacy "Orea V4 Wide" falls back to Classic. `BREW_METHODS` replaced the single `orea` entry with four kebab-case ids aligned to the `LightStepContext` picker labels.
- **"I've been here" mode (#145)** — `cafe_visits` table + `/api/cafe-visits` + modal on `/cafes/place/[slug]` with binary thumbs rating. Visits appear in the café's timeline alongside brew sessions, and roll into `/api/cafes` so visit-only places appear in the Café Library.
- Database renames (#142, migration 0010 applied 2026-05): all variants of `Rösterei Vier / The Commonage` collapsed to `RVTC` across `coffees.roaster`, `sessions.coffee.roaster` JSONB, and the `roasters` priors cache.

**FlavorWheel Light palette (#128–#131)**
- Direct conversion (no theme prop). The wheel is intrinsically monochrome — `scaFlavorWheel.ts` gives every category a near-identical dark gray, so differentiation comes from icons + label opacity + active/has-sel tonal lifts, not from per-category brand color.
- Canvas → transparent so the Field paints through. Category segments → cream-glass at 55 % (`bg-light-card-default` token), taupe lift for has-selection, anthracite press at 18 % alpha for active. Outer sub-category ring mirrors the same three states at slightly weaker alpha so the inner ring stays primary. Whole-wedge tonal state — tapping a category darkens both rings together.
- Thin cream ring divider between inner and outer rings (#130); divider stroke weights dropped to 0.8 / 0.5 viewport units (#131) to match the label typography weight.
- Icons refactored to `currentColor` with the wrapping `<g>` setting `color`, single icon-path source.

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
- localStorage cache keyed by `brewlog.starter.v4.<date>.<bucket>` — regenerates 5× per day at tod-bucket boundaries instead of once per calendar day. Bumping the version is the canonical invalidation lever for any greeting prompt change.

**Nearby map split (PR #101) — Light-finished**
- `/cafes/map` (headlined "Nearby") is its own dedicated route, now fully Light. `/cafes` is the tabbed Café Library list (Cafés + Coffees tasted out). `NavigationOverlay` "Nearby" → `/cafes/map`; "Café Library" → `/cafes`.
- Tiles served by Carto Positron, warmed in CSS via `[data-light-scope] .leaflet-tile-pane { filter: sepia(0.4) hue-rotate(-15deg) saturate(0.7) brightness(1.04) }` so they read as cream rather than cold gray.
- Floating header sits on top of a cream→transparent scrim so the page title stays legible without a hard banner edge.
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
- Zustand flow store with localStorage persistence (survives a mid-brew reload — see Offline Brew Mode)

**AI features**
- Brew recipe generation: 2–4 candidates with reasoning (`recommend.ts`)
- Post-brew Escher insights: terrain/pattern prose analysis
- Cross-session pattern extraction (pace, craft approach, occasions)
- Brew signature: weighted averages per coffee/method combo
- Taste profile page with AI-written summary
- Taste-match finder: scores past sessions against current coffee
- **Explore chat coach upgrade (May 2026)** — the chat no longer relies on a hardcoded user profile. (Built on the then-standalone `/api/explore`; that route has since been REMOVED and every one of these injections lives on in `/api/explore-agent`, the home-chat endpoint.) Each turn injects:
  - **Recent recipes block** — `buildRecentRecipes()` shows the actual dose/water/ratio/Niche degrees/temp/target+actual timing/flow/Drip Assist/water source for the last 5 brews, so timing questions get answered with real numbers
  - **Live preferences block** — `loadUserProfile()` reads the `preferences` table; canonical equipment + grind settings live in a separately cached system block that invalidates only when onboarding changes
  - **Coffee library block** — `loadCoffeeLibraryCompact()` lists the last 30 bags with roast-date freshness, so "which bag should I open next?" gets a specific answer
  - **Roaster priors block** — up to 5 unique roasters from recent sessions hydrated via `getRoasterPrior()` so it can reference Friedhats' clarity bias, April's minimal-agitation rule, etc.
  - **BrewLog feature awareness** — system prompt now knows about Match, Taste, Cafés and points the user at them when relevant
  - **Self-aware capabilities (May 2026 follow-up)** — `## Your Capabilities` block in `src/app/api/explore-agent/route.ts` lists every tool the agent has (`search_places`, `fetch_page`, `analyze_image`, `suggest_navigation`) plus voice in/out (ElevenLabs Scribe STT + TTS). When the user asks "what can you do?" the chat answers from the list instead of hallucinating.
  - **Reasoning on internal picks (May 2026)** — Response Style now includes "Show your reasoning when you compare or pick": when the user asks the chat to choose between things they already own (their bags, past sessions, kit), it must briefly name each candidate and what it brings to the criterion before declaring the pick. Prevents the failure mode where "Direct, confident" + "Brevity first" collapsed to a one-line declaration with no explanation.
- **Place search — English DB + diacritic-tolerant fold (May 2026)** — `places.city` is stored in English/ASCII (Cologne, Munich, Dusseldorf, Vienna, Prague, Bucharest, Lisbon, …). Both the home chat (`searchPlaces` in `/api/explore-agent`) and the `/cafes` map (`/api/places` GET) accept any spelling: a `fold()` helper in `src/app/api/explore-agent/route.ts` strips diacritics and collapses German digraphs (`ue→u`, `oe→o`, `ae→a`, `ß→ss`) on both query and DB rows in memory, so "Düsseldorf" / "Dusseldorf" / "Duesseldorf" all match the same row. The chat's system prompt instructs it to translate any German city name (Köln→Cologne, München→Munich) before searching. Map search additionally splits the query on whitespace and ANDs tokens, so "Kolo Berlin" finds Kolo in Berlin.
- Weekly deep-research cron (Ofelia)
- Knowledge base: insights, hints, news, questions
- **Structured knowledge layer (May 2026)** — `src/lib/knowledge/{recipes,varieties,techniques}` carries the science/expertise corpus that backs `/recommend` and `/explore-agent`. **Human-readable mirror:** @./docs/coffee-experts.md (mirror only — update the TS files first, then mirror). Replaces ad-hoc recipe paragraphs that were embedded directly in the prompts. **Recipes** = 128 total (6 championship + 77 reference + 45 experimental/user-supplied in `markusAdditions.ts`): WBrC/WAC champions (Kasuya 2016, Du 2019, Medina 2023, Wölfl 2024, Stanica WAC 2024, Nemo Pop WAC 2025), Hoffmann V60/Clever/AeroPress/Moccamaster/Iced (+ Japanese Iced V60 pour-over), Kasuya 4:6, April V60 (Rolf), Gagné, Perger, Rao, Hatakeyama 2024 JBrC, Wallgren Kalita-sieve, plus dozens more. (All named-expert entries re-verified against primary sources June 2026 — see the recipes/ note above.) NO staged/multi-temperature recipes (removed June 2026 — every recipe brews at one constant temperature). Each entry: structured pour sequence with per-step durations, attribution, sources, `verified` flag distinguishing canonical vs reconstructed details. Ranked equally on best-match (no pedigree/verified bonus); a locked method hard-filters selection to that brewer (see recipes/ note above). **Varieties** = ~25 WCR-grounded cultivar priors covering Bourbon family, Typica family, Ethiopian landraces, Geisha, SL series, F1 hybrids, Pacamara, Mokka. Genetic / agronomic facts sourced to the WCR Arabica Coffee Varieties Catalog; cup descriptions from Royal Coffee's *Green Coffee Book*. Pink Bourbon flagged per WCR's 2024 finding that it is genetically distinct from Bourbon despite the marketing name. **Techniques** = 25 atomic brewing moves (16 named-expert: Peng Melodrip, Wallgren sieving, Rao spin, water-first, low-mineral water, etc. + 9 general/foundational: bloom, pulse-pouring, immersion-steep, central/spiral/continuous-pour, machine-drip-brew, batch-scaling, flat-bed-pour) cross-referenced to exemplifying recipes — the brain can cite mechanism by id and reach a worked example. Every recipe's `techniques` field references a real id, and every technique's `exemplifiedBy` references a real recipe id (both directions enforced by `tests/recipes/validate.mjs`). All three modules injected per turn; system prompts are NOT touched (cache hits preserved).

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

**Open items:**
1. `/coffees` "Show only rotation" filter — list shows the star indicator (#117) but no toggle yet to filter the list to rotation bags only
2. Aromatic Goal validation — PR #72 added the intent to `/api/recommend`; it was never sample-validated against a delicate coffee on the deployed PWA. (The old "validate before shipping AI changes" rule that demanded this was retired by the "AI behavior changes: do what the user asks" section — this stays only as an open quality-check idea, not a blocker.)
3. **Cafe visit notes edit UI** — `cafe_visits.notes` column exists but UI only lets you delete + re-add, no inline edit. Cheap follow-up.
4. **Branch protection / required checks** — CI now runs on every PR (`.github/workflows/ci.yml`: a `check` job = `tsc --noEmit` + `node --test`, and a `screenshots` job, see CI section below). What's still NOT done is wiring these as *required* status checks — branch protection isn't enabled (GitHub free plan limitation noted in the Git section), so green CI is advisory, not enforced. The PR flow stays by convention.
5. **Drip Assist demoted to "emergency / travel only"** in the user profile, but it's still selectable in `LightStepContext` as one of the brewer options (PR #193 kept it for legacy session render compat). Worth re-checking that it never gets recommended proactively now that the user's V60 Drip Assist is retired from daily use.
6. **Palette / "less cream" pass (owner-requested, not started)** — owner wants to move away from the cream-dominant Light aesthetic toward the fruity/floral Field colours ("cream is old-school coffee ugly — bring nuanced colour in with caution"). The Nearby map got a first cautious step (the `.leaflet-tile-pane` filter pushed from cream toward rose/peach). The broader change is FOUNDATIONAL — Field base, card glass (`bg-light-card-default`), scrims (incl. the `BagPhoto` cream scrim + `gradientCreamScrim`), and several `light-*` tokens — so it needs its own coherent pass, NOT piecemeal edits.

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
- Flag once, explain the trade-off plainly. Per the Operating-mode section, if the fix is safe and revertible just do it and report it in the same breath; only wait for a yes/no when it's genuinely irreversible. Don't hoard issues for a big cleanup later.
- **Translate, don't jargon-dump.** The user reads everything you write. Plain English, no unexplained acronyms or shorthand. If a technical term is unavoidable, define it inline once.
- **Build everything new on the Design System.** Any new page, component, primitive, or modal MUST compose from the documented Light tokens (`text-light-foreground`, `text-light-text-on-dark`, `bg-light-card-default`, `bg-light-surface`, `bg-light-destructive`, `light-accent-overtime`, `light-scrim`, `backdrop-blur-light-card`, the gutter `px-5`, the primary pill `h-14 rounded-full`, etc.) — see the "Light design tokens (cheat sheet)" section. Never reintroduce a literal `hsl(...)` / `rgba(...)` / `#hex` for a colour role the system already has a token for, and never roll a one-off pill height or radius. If a genuinely new visual role appears (e.g. a fresh status colour), add it to `tailwind.config.ts` as a `light-*` token FIRST, then consume the token — single source of truth in one place. Drift like this is what produced the May 2026 token-cleanup pass; do not invite a sequel.

---

## AI behavior changes: do what the user asks

When the user explicitly requests a prompt change, model swap, threshold tweak, or any other change to AI behavior — ship it. Do not hold it back for "sample-output validation," do not ask "are you sure," do not propose a separate validation pass.

Two narrow exceptions:
1. **Model swap on a prompt engineered for a specific model** — the user gets a one-line disclosure ("this prompt was engineered for Opus; swapping to Sonnet may degrade — proceeding") then ships. Never block.
2. **Self-initiated AI behavior changes** (changes the user didn't ask for, e.g. unsolicited performance optimization that swaps a model) — these stay forbidden. Don't make AI behavior changes the user didn't request.

Behavioral changes still get their own commits so they can be reverted cleanly. That's the only structural rule that stays.

Cause: an earlier version of this rule required pre-shipping sample validation on every prompt edit. The user kept telling me what to ship, I kept holding it back asking for validation passes, and the project lost an evening to me re-asking the same questions. Don't repeat.

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

## Hard rule: never fabricate parameters or facts — research before stating

A "fabricated parameter" is any specific value, number, or product claim stated without a named, in-session-verified source. Zero tolerance:

1. **Recipe parameters** (pour counts, temperatures, target times, dose/water ratios) for any named brewing method or expert (Hoffmann, Kasuya, Wendelboe, Peng, Stanica, Perger, Rao, etc.). If the user asks for "Hoffmann's recipe," **fetch or quote the actual published recipe**. Never reconstruct from memory. Never trust your recollection of a recipe you've seen before.
2. **Hardware facts** (burr type/size, dial scale conventions, click counts per turn, ppm specs, brewer geometry). Look up the official spec before stating it. The Niche Zero has 63 mm Mazzer **conical** burrs, NOT flat — do not invent geometries to explain observed differences.
3. **Quantitative extrapolations.** Do not scale grind clicks by an invented slope, do not interpolate temperatures, do not estimate timings, do not "approximate" recipe shifts when the user scales up or down. If you do not have a published slope from a named source, say so and ask the user to measure empirically.
4. **The codebase is NOT a source.** A number existing in a `*.ts` file is downstream of real sources. If a codebase value disagrees with the original publication, the codebase is wrong — not the publication. Validate against the brewer's blog, video, or competition publication before treating a codebase value as authoritative. (This includes `src/lib/knowledge/recipes/*` — those entries were transcribed once and can be transcribed wrong.)
5. **Aggregators are NOT primary sources.** Recipe aggregators (timer.coffee, honestcoffeeguide, fluentincoffee, ECT brew demos, etc.) are useful as **index pointers** — they often link to the originator's actual video or blog. They are never sufficient on their own to set `verified: true`. The originator's own publication (their YouTube channel video with timestamp, their blog post URL, their book with edition/page) is the only valid primary source. Aggregator transcriptions degrade — they paraphrase, round, or substitute (timer.coffee mapping Hoffmann's "freshly boiled" to "95 °C" is a documented example).
6. **`verified: true` means content-cross-checked in-session.** Not "the citation sounds attributed enough," not "the source name looks right." If you cannot retrieve the primary source and confirm the parameters match in this session, the entry stays `verified: false` until someone can. YouTube blocks WebFetch — that is not a reason to mark something verified; that is a reason to keep it unverified and note the constraint.
7. **Peer-data audit when adjacent data is changed.** When fixing one recipe / variety / technique entry, audit the **peer entries by the same author or in the same cluster** at the same time. If you rewrite Hoffmann's V60 1-Cup against his actual video, you have inherited a working source-verification process — apply it immediately to his AeroPress / Clever / Moccamaster / Iced entries before they bite. Do not "fix one and walk away" when the same fabrication pattern is sitting one entry below in the same file.
8. **Retroactive audit when a Hard Rule is enacted.** When a Hard Rule is added, ALL pre-existing data in scope falls under it retroactively. Schedule the retroactive sweep with the rule, not weeks later. If you add a new Hard Rule, run the cross-check of every existing entry before closing the commit — discovering the gap weeks later means weeks of downstream consumers built on wrong data.

When in doubt, say **"I don't know — let's measure"** or **"let me look that up first."** Do NOT estimate, approximate with "~", or hedge with "around" — those are hallucinations wearing humility costumes.

Cause for this rule: in the May 2026 Niche ↔ Comandante calibration session, fabrications cumulatively contaminated the empirical baseline the user was trying to establish: (a) invented a "flat vs conical burr geometry" difference between the Niche Zero and the Comandante to explain visible grind-distribution differences — both grinders use conical burrs, the difference is burr size + RPM, (b) reconstructed Hoffmann's *A Better 1 Cup* V60 recipe from memory with wrong pour count (2 large pours instead of 4 pulses), wrong temperature (92 °C instead of "freshly boiled" for light roasts), and wrong total time target (3:30 instead of ~3:00) — and then trusted the matching wrong values in `src/lib/knowledge/recipes/reference.ts` instead of validating against Hoffmann's published recipe, (c) proposed quantitative grind shifts ("~395°", "~25 clicks", "+5–10° coarser per scale-up", "+2 clicks for a doubled brew") with no source behind any of them. The user spent an evening calibrating against a recipe that was not actually Hoffmann's, contaminating the data the codebase update was supposed to be grounded in. Do not repeat. If you cannot cite a source for a number, you do not have the number.

Cause for sub-rules 5–8: a follow-up audit of all 19 named-expert recipe entries in the codebase found that 18 had at least one parameter disagreeing with the originator's actual published recipe, and 8 had parameters so far off they were "different recipes wearing the original author's name" — Gagné's AeroPress was attributed as low-temp/long-steep when his actual published recipe is hot + long; Rao's "Rule of Thirds" was a three-pour recipe attributed to him when Rao publicly opposes three-pour V60 patterns; Peng's 2025 WBrC ratio was logged as 1:4 when his actual brewing ratio is 1:14; Stanica's championship location was Bucharest when WAC 2024 was in Lisbon; Wölfl's 2024 championship city was Copenhagen when WBrC 2024 was in Chicago. Every one of these errors would have been caught earlier if (a) peer-data had been audited when adjacent recipes were touched, (b) aggregator transcriptions had not been silently promoted to primary status, and (c) a retroactive sweep had run when the Hard Rule was added. Do not repeat.

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
- `claude-opus-4-7` — recommend (engineered for Opus; do NOT swap models without the one-line disclosure per the "AI behavior changes" section), insights (coach observations, `src/lib/claude/insights.ts`), per-coffee coach insight (`src/lib/claude/coffeeInsight.ts` — also behind `/api/admin/prewarm-coffee-insights`)
- `claude-sonnet-4-6` — analyze-bag, explore-agent, escher (post-brew insight helper), coach-question (post-rating micro-dialogue)
- `claude-haiku-4-5` — brew-insight, taste-summary, research, analyze-bag/clarify, analyze-url, coffees/compact, roasters/generate, translate (tasting-notes ↔ SCA helper), greeting (daily starter), field/mapNotesToZones (notes → Field zones)

### Git / Deploy
- **"Done" means shipped** — merged to `main`, auto-deploy runs on Hetzner, live on the iPhone PWA. "Pushed to a feature branch" is NOT done. Stopping at a branch leaves the user staring at the still-broken app, re-reporting the bug, and re-fixing what is already fixed. That is chaos and it is not acceptable.
- **Workflow is PR-based.** Every change goes: feature branch → PR → squash-merge to `main` → auto-deploy. Use the GitHub MCP tools (`mcp__github__create_pull_request`, `mcp__github__merge_pull_request`, `mcp__github__enable_pr_auto_merge`). The PR flow is **by convention** — branch protection is not currently enabled, so direct pushes to `main` are technically possible but should never be done.
- **Auto-merge is enabled on the repo.** For PRs that pass CI without review gating, call `enable_pr_auto_merge` (mergeMethod: SQUASH); GitHub merges as soon as checks go green. If checks are already clean, call `merge_pull_request` directly.
- **Session-level harness instructions are compatible.** If a system prompt tells you to develop on a feature branch — fine, that's the actual flow. Just don't stop at the branch: open the PR, merge it, confirm `main` advanced.
- **Auto-deploy** — GitHub Actions runs on every push to `main`. No manual steps needed unless the action fails (fallback: SSH to VPS and run docker compose manually per the Infrastructure section).
- Commit message: imperative, lowercase prefix (`fix:`, `feat:`, `remove:`, `docs:`, `build:`)
- Always `npx tsc --noEmit` before commit
- No staging environment — once merged to `main` it is live within minutes

### Light design tokens (cheat sheet)
- **Tokens:** `text-light-foreground` (anthracite), `text-light-muted-foreground`, `bg-light-card-default` (cream glass 55 %), `bg-light-card-selected` (warm taupe), `bg-light-surface` (opaque cream, modal/sheet surfaces), `border-light-foreground/15`, `shadow-light-card-pressed`
- **Cream highlight on dark elements:** `text-light-text-on-dark` (single token; replaced the two pre-token literals `hsl(36 55% 96%)` and `hsl(30 40% 97%)` so CTA / ActionPill / ChatInput buttons / ConnectionStatus all share the same cream)
- **Card variants:** default cards use `bg-light-card-default` (55 %); SessionCard (chips inside) uses `bg-[hsl(36_55%_96%/0.30)]` — the lower opacity so child chips visibly contrast
- **Destructive (delete, error):** `bg-light-destructive` (warm rust) — `text-light-destructive` for error copy
- **Amber accent (overtime):** `light-accent-overtime` — used by `CircularTimer` when elapsed > target; inline SVG strokes mirror the value via two module-level constants `ANTHRACITE` / `OVERTIME` since SVG strokes can't read Tailwind tokens
- **Floating-chrome elevation:** `shadow-light-float` — warm-dark soft outer lift (distinct from the inset `shadow-light-card-pressed`). The home chrome is **all-dark + lifted**: the Burger, the `+`/clear/cancel round controls, the chat input bar, and the Action Pill are solid `bg-light-foreground` + `text-light-text-on-dark` (icons/text) + `shadow-light-float`, so they float above the living Field instead of muddying into it as glass. In-bar buttons (send/mic/remove-X/coffee chip) invert to cream-on-dark (`bg-light-text-on-dark text-light-foreground`). The same dark+lift swap is on the `h-11 w-11` header buttons across every `(light)` route + the NavigationOverlay close. Detail-page photo-hero buttons + pop-over menu *surfaces* (AttachmentSheet etc.) stay cream glass — they get only the lift.
- **Glass blur:** `backdrop-blur-light-card backdrop-saturate-150` — the canonical pair on every glass surface (Card, Chip, ChatThread, AttachmentSheet, NavigationOverlay sheet, ReferenceCoffeePicker, ConnectionStatus). Don't write `backdrop-blur-[14px]` — it bypasses the token. (NOT the home chrome anymore — Burger / `+` / chat bar / Action Pill are now solid-anthracite floating chrome, see above.)
- **Photo scrim:** import `gradientCreamScrim` from `@/lib/theme/gradients` for the cream→transparent vertical fade overlaid on bag photos (consumed by `/coffees/[id]`, `/brew/[id]`, `/coffees/drip/[id]`)
- **Hero question:** `font-fraunces font-semibold text-[40px] leading-[1.05] tracking-[-0.01em]`
- **Headline (route title):** `font-fraunces text-3xl text-light-foreground leading-none`
- **Wordmark (Home + Login):** `<h1 className="font-fraunces text-3xl leading-[1.05] text-light-foreground">Better taste<br />than sorry.</h1>` — exact same markup at both entry points
- **Eyebrow:** `text-light-muted-foreground text-xs tracking-widest` uppercase (no `font-medium` — that's an outlier)
- **Chip / tag (two sizes — `Chip` primitive `size` prop):** base `inline-flex items-center rounded-full font-medium leading-tight backdrop-blur-light-card backdrop-saturate-150 bg-light-card-default text-light-foreground`. **`default`** = `px-4 py-2 text-[13px]` for a pick-one chip that IS the question's primary control (Sensory rows, SensoryToggle Yes/No, grinder picker). **`sm`** = `px-3 py-1.5 text-[12px]` for multi-select tag rows, dense pickers, card-footer actions, secondary inline confirms (FlavorWheel picks, candidate role picker, country/process/roast pickers, Coach actions, onboarding equipment multi-select). Rule: stands alone as the answer → `default`; one of many / dense / secondary → `sm`. Never mix the two on one row.
- **Primary CTA pill:** `w-full h-14 rounded-full bg-light-foreground text-light-text-on-dark font-semibold` + `active:scale-[0.98] transition-transform` — both `h-14` AND `rounded-full` are required; `py-3.5 rounded-2xl` is NOT a CTA, it's a card
- **Page gutter:** `px-5` (20 px). Don't use `px-8` — it's not a defined gutter width
- **Light scope marker:** `[data-light-scope]` attribute set by `LightShell` wraps the whole `(light)` route group; the `globals.css` shim catches inline `var(--card)` etc. for un-migrated components — but NOT hardcoded hex like `#2A241C`, which needs explicit Light tokens at the source

### Voice & tone
- **Reference:** @./docs/voice-and-tone.md — full voice/tone guide for UI copy AND AI-generated text. Covers what BTTS sounds like (knowledgeable friend, not coach; pragmatic; editorial), what it doesn't (no apology, no emoji, no hype-default adjectives, no HTTP codes user-side), per-surface worked examples (errors / empty states / destructive confirms / coach cards / chat replies), and a self-test before shipping copy.
- **When to consult:** any new UI copy, any prompt change for `/api/greeting`, `/api/recommend`, `/api/brew-insight`, `/api/insights`, `/api/explore-agent`, or any rewrite of error/empty-state strings.
- **Per-surface examples carry file paths.** Update the doc examples when the source surface's copy changes.

### iOS PWA / install gotcha
- iOS caches `apple-mobile-web-app-status-bar-style` **at PWA install time** — changing the meta tag does NOT update an already-installed home-screen app. To pick up the change the user must delete the PWA from the home screen AND clear Safari → Advanced → Website Data for the domain, then re-install.

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

## iOS Shell Project (in progress)

Multi-session arc to turn BTTS into a native iOS app via a Capacitor remote-URL shell distributed through TestFlight internal testing — closes the documented "Step alerts during background are missed" gap and unlocks Acaia BT + widget + Live Activity + Apple Watch on later milestones.

**Working doc:** @./docs/ios-shell-roadmap.md — read its "Multi-session execution model" and the latest "Session log" entry before touching anything in `src/lib/native/`, `src/hooks/useBrewStepNotifications.ts`, the `native/` directory, or `.github/workflows/ios-*`. Every session that advances the project updates the doc (session-log entry + any new Stolperstein) in the same commit as the code.

---

## Liquid / motion design (in progress)

The "fluidity pass" — the living Field background (static base gradient + drifting colour blobs + film grain + finger-following bloom) and the liquid welcome-haiku (scattered per-word spring entrance → dissolve → per-word touch lens). All motion runs on the GPU compositor (CSS `@keyframes` + CSS vars written by one rAF loop); React is never in the per-frame loop.

**Working doc:** @./docs/liquid-design.md — read its "Tuning dials" table before any "make the background bigger / the haiku slower / the glow stronger" change, and its top rule before debugging "motion is dead in the PWA." Touch points: `src/components/ui/light/{Field,FieldBlobs,FieldGrain,FieldBloom,HaikuStarter}.tsx`, `src/hooks/{useFieldMotion,usePresence}.ts`, `src/lib/field/composeGradient.ts`, and the motion blocks in `globals.css`. Every advancing session updates the doc (session-log entry + dials kept honest) in the same commit as the code.

**Load-bearing rule:** continuously-iterated `@keyframes` (blob drift, haiku entrance) live **co-located in the component** via `<style jsx global>`, NEVER in `globals.css` — the installed PWA serves a stale cached `globals.css` even after the JS updates, so keyframes there silently don't animate (the "haiku moves, background dead" bug). After any deploy, force-quit + reopen the PWA to drop the cache.

---

## User / Equipment Profile

| Device | Details |
|--------|---------|
| **PRIMARY** | V60 size 2 (Hario Drip Assist **retired from daily use** — emergency-only when no gooseneck kettle is around, e.g. travelling. Selectable in the flow as "V60 + Drip Assist" but never recommended proactively; PR #193) |
| Other | Orea V4 Wide, Origami Air M (resin / AS-resin "Air" line — lighter, lower thermal mass than ceramic; takes both V60 conical and Kalita Wave flat-bottom filters), Clever Dripper, Kalita Wave, AeroPress, Moccamaster, Chemex |
| **Kettle** | Fellow Stagg EKG — gooseneck, precise temp control, 60-min hold |
| **Grinder** | Niche Zero — uses **degree (°) settings**, continuous (no clicks) |
| Travel grinder | Comandante C40 MK2 — uses **clicks**, not degrees |
| **Scale** | Acaia Lunar (2017) + Acaia Pearl (älter, exaktes Jahr nicht bestätigt) — 0.1 g precision. |
| **Water** | BWT Bestmax Premium V (bypass 0): ~370 ppm hard local tap → **~220 ppm** filtered (GH 5–6 / KH 4 °dH), daily driver for naturals/honeys · **clarity blend** 1:2 filtered+distilled = **~73 ppm** (KH ~1.3 °dH) for washed florals & championship methods (Kasuya/Wölfl) |

### Hard rule: single-user PROJECT, not a product — no onboarding

This app has exactly **one user (the owner, roitsch@gmail.com) and always will.** It is a personal project, not a product. Consequences that OVERRIDE any "make it configurable / generic" instinct:

- **There is no onboarding flow to rely on.** The `(light)/onboarding` page is deprecated; do not route new behaviour through it or assume the user will (re-)run it. The user cannot re-select equipment through a wizard — there is no settings screen.
- **The profile is CODE-CANONICAL.** The owner's equipment, grinder, water, and taste are the source of truth in code: `CANONICAL_PROFILE` (`src/lib/claude/userProfile.ts`) for prompt text and `CANONICAL_EQUIPMENT` (`src/lib/knowledge/recipes/helpers.ts`) for recipe-brewer filtering. When the kit changes, edit those constants — never wait on a DB/onboarding round-trip. `/recommend` unions the stored `preferences.equipment` with `CANONICAL_EQUIPMENT` so a stale DB row can never hide an owned brewer (this was the cause of Origami/Chemex being filtered out of recommendations — PR #250).
- **Don't add per-user generality** (multi-tenant isolation, per-user onboarding gates, "first-run" UX). It's wasted complexity for a one-person project.

**Live data:** the production DB (Postgres on the VPS) is NOT reachable from a Claude Code session — only the repo is. Work from the code: read the schema, the constants, and the canonical profile to know how things behave. Do NOT guess at, extrapolate, or fabricate row contents (see the "never infer repo state from partial evidence" Hard Rule). If a specific live value genuinely matters and can't be determined from code, say so plainly and ask the owner — don't invent tooling to paper over it.


**Taste:** silky, balanced, floral/fruity (elegant); light roast SO; avoids anaerobic/infused/dark.
**Grind quick ref:** @./docs/grind-settings.md
**Grind source of truth (code):** `src/lib/constants/grindSettings.ts` is the canonical per-method default table — `docs/grind-settings.md` mirrors it for humans. Each entry in `src/lib/knowledge/recipes/` carries its own `grind.nicheZeroDegrees` translation specific to that recipe (e.g. Wölfl 2024 = 401–411°). Different scopes — `grindSettings.ts` = "default for this method", recipes = "what this specific published routine calls for".

**Important — not yet wired through:** `grindSettings.ts` is NOT imported by `/recommend` or `/explore-agent` at the time of writing. Both routes carry their own hardcoded "NICHE° GRIND REFERENCE" block embedded in the system prompt for prompt-cache stability. **To re-calibrate degrees end-to-end you must update three places:** the constants file, `docs/grind-settings.md`, AND the `NICHE° GRIND REFERENCE` block inside the prompt strings (`src/lib/claude/recommend.ts` ~line 349, `src/app/api/explore-agent/route.ts` — currently no dedicated block, grind appears inline in the goal-vocabulary and recipe sections). A future cleanup could inject the table dynamically, but that's a self-initiated AI-behavior change (forbidden unless the owner asks — see the "AI behavior changes" section), so only do it as a deliberate, owner-approved behavioral commit.
