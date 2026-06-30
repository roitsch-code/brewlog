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
| `recommend` | ★ POST coffee + context → 2–4 AI brew recipe candidates. Each recipe carries a structured `pourSteps[]` (per-step action/grams/duration/temperature/notes; agitation emitted as explicit stir/swirl steps) alongside the legacy `pourSequence` string; each candidate carries `basedOn` (the reference recipe it adapts, or "Own recipe"). `pourSteps` is sanitised + action-normalised post-parse (`sanitizeRecipe`) — a malformed array is dropped, never fatal (PR #197/#198). **Runs on Mistral Large 3** (EU) since June 2026 (PR #455) via `src/lib/ai/recommendProvider.ts` — Opus rollback through `RECOMMEND_PROVIDER=anthropic`, auto-fallback to Opus on a Mistral error; a deterministic capacity guard (`vesselCapacity.ts`) drops over-capacity-vessel candidates. |
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
| `explore-agent` | ★ Agent loop with tool-use (`search_places`, `fetch_page`, `analyze_image`, `suggest_navigation`, `start_brew`, `remember_advice`) — powers the inline chat on `(light)/page.tsx`. `start_brew` (PR #199/#200) is a terminal action tool: when the agent has laid out a complete recipe for a library bag it hands the exact recipe (dose/water/ice/temp/grind/`targetTimeSec`/`pourSteps` + method/title/basedOn) to the brew timer so the user lands straight in Step "brew" — no context, no re-recommendation. Its `destination` is set from the TOOL NAME (the input has no destination field — that omission caused the no-op fixed in #200). Per-turn context now includes recipe names + a "Most Recent Brew" block, all read from the actually-brewed candidate. **start_brew id availability + sanitation (PRs #410/#413, June 2026):** the chat can only `start_brew` a bag it has an `id` for, so the per-turn context injects BOTH the ★-rotation bags AND the 50 most-recent library bags (`loadCoffeeLibraryCompact(50)` merged with `loadRotationCoffees()`, deduped), each carrying its `[id:…]`. Without the recent-library half a freshly-scanned-but-unstarred bag had no id and the model fell back to a `coffee_library` link / `brew_again` — the "chat won't open the recipe" regression (#247 had narrowed the chat context to rotation-only on June 6; #413 restored the recent-library injection while keeping #247's ★-rotation discipline for "what should I brew?"). The prompt now makes `start_brew` **mandatory** whenever the reply lays out a recipe for a library bag — a `coffee_detail`/`coffee_library` link or `brew_again` as the CTA for a written recipe is forbidden; `brew_again` is scoped to "wants to brew a bag but you did NOT write a recipe". The chat's raw `start_brew` recipe is run through `cleanChatRecipe()` server-side — `sanitizePourSteps()` (shared `src/lib/utils/pourSteps.ts`, action-normalized exactly like `/recommend`'s `sanitizeRecipe`) + a derived `pourSequence` backstop + `reconcileWaterToPourPlan()` — so the brew timer renders its pour guide instead of a blank screen (the AeroPress "no steps" bug, #410). **`remember_advice`** is a second terminal action tool (chat→recommendations bridge): when the chat works out durable, parameter-level guidance for a specific library bag, it surfaces a **tap-to-save** "Remember this for …" pill (`ActionPill`). Tapping POSTs to `/api/insights`, which writes a `status='trying'` / `source='user-confirmed'` insight row (so `/recommend` + the brew Context reminder pill apply it next time that coffee is brewed) AND writes the same note into the targeted coffee's `coach_insight` column (so it becomes that bag's card on `/coffees/[id]`). The chat names the bag in the observation text (per-coffee targeting) and supplies `citationFields` (recommend ranking). Nothing is written until the user taps — the chat never silently persists. **Caveat:** the saved note lives in TWO places with independent statuses (the insights row and the coffee's `coach_insight` card) and they are NOT synced — "Doesn't apply" on the /taste card clears the insights row but the coffee-detail card keeps showing until acted on there too, and vice versa. |
| `research` | Weekly deep-research cron agent (Ofelia) |
| `preferences` | GET / POST user preferences (equipment, grinder, location) |
| `roasters` | GET / POST roaster profiles |
| `roasters/generate` | AI-generate roaster style summary |
| `places` | GET / POST café locations (auto-geocodes via Nominatim/OSM on POST) |
| `cafes` | GET aggregated café summary across sessions (visit count, avg rating, last visited) |
| `upload` | Multipart photo → Hetzner S3, returns URL |
| `voice/synthesize` | POST text → ElevenLabs TTS audio |
| `voice/transcribe` | POST audio → ElevenLabs Scribe STT transcript. Sends `tag_audio_events=false` (+ a `stripAudioEventTags()` backstop) so the "I'm listening" earcon / kettle clatter isn't transcribed as e.g. `(computer chirp)` |
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
| `LightStepContext.tsx` | Occasion, water amount, time, mood, equipment, goal. **Occasions = 6 (June 2026):** Morning Ritual, Deep Focus, Social, Experiment, Summer Time, **Cold Brew** ("After Dinner" removed). **Time = Normal / Special (June 2026, renamed from Quick/Normal):** "Special" is a fast shot (≤~150s, the old "Quick"); long steeps come ONLY from the Cold Brew occasion. Picking **Cold Brew** hides the Time card (the steep is the time) and stamps `timeAvailable: "long-steep"`; `/recommend` then routes to the cold-brew recipe block + the brew step renders `ColdBrewSteep` instead of the live timer. Goal picker has 6 options incl. `aromatic` (PR #192). Method list incl. "V60 + Drip Assist" emergency-only option (PR #193). Locking a method sets `context.preferredMethod` → hard-filters recipe selection. **Coach reminder pill** above the selectors when the chosen coffee's own coach card (`/api/coffees/[id]/insight`) is `status='trying'` — quiet read-only nudge, per-coffee by id, NO attribute-overlap matching (that pre-0015 mechanism surfaced other bags' insights on the wrong coffee and is gone). (PR #215 + migration 0015) |
| `LightStepRecommend.tsx` | 2–4 AI recipe candidates with reasoning. Selecting a candidate sets `brew.selectedCandidateIdx` so Brew/Log/Summary read THAT candidate's recipe by index, not by method name (PR #193 — fixed alternative inheriting the primary's temp/grind when both share a method). Shows the candidate `title` + `based on …` reference name (PR #198). |
| `LightStepBrew.tsx` | ★ Circular timer + **step-by-step, method-aware** pour guide (Web Audio cue + vibrate on step change). Shows the recipe **name** (candidate `title` + `based on …`). Two renderers, chosen per recipe (PR #197): **`LivePourSequence`** for percolation (cumulative-grams pours, drawdown reserve) and **`StepGuide`** for immersion/AeroPress/iced/staged (setup card, steep countdown, action cards for invert/flip/press/drain/bypass). **Agitation is recipe-driven** (PR #198): the swirl/stir button shows only where the recipe calls for it — no stray swirl on a reduced-agitation recipe. Reads the recipe via `selectedCandidateIdx`; per-pour temperatures + notes render per step. **Live Acaia scale coaching** (PRs #330/#411): when the scale is connected, the active **pour** step shows a `CoachCue` ("Steady" / "Ease off" / "Overshot +Xg" with the running grams) from `coachFlow` (`src/lib/brew/flowCoach.ts`, over the canonical `buildBrewTimeline`). #411 lifted the prior percolation-only gate so `coachFlow` coaches ANY step carrying a cumulative-grams target — so immersion/AeroPress water-pour steps get the same scale guidance as a V60 (the `StepGuide` renderer now also receives `coach`); steep/press/drain steps (no grams target) stay time-only. Off-native / no scale connected → no cue, exactly as before. **#443:** the active step is TIME-based (`getActiveIdx`) and the `CoachCue`/`WeightHold` show the RAW live `scale.weight` (the weight-gating + peak + median were removed — see the Brew-timer rework Done note). |
| `LightStepLog.tsx` | Post-brew: flavor wheel, star rating, tasting notes |
| `LightStepSummary.tsx` | Review + save session |

**Light UI primitives (`src/components/ui/light/`):**
`LightShell` (wraps `(light)` group, sets `[data-light-scope]`), `LightFlowShell` (drives `useFieldConfig` per step, scrolls top on step change), `Field` (reads FieldContext → renders the **living motion stack** fixed -z-10: directional `composeFieldGradient(zones, rotation)` base + `FieldBlobs` (the **murmuration** colour masses) + `FieldGrain` + finger-following `FieldBloom`, driven by `useFieldMotion` CSS vars — see docs/liquid-design.md), `FieldBlobs` (the murmuration layer — all colour masses ride ONE shared slow `field-flow` sweep so they flow together + turn direction, with small per-mass `murmur-*` drift; co-located keyframes) / `FieldGrain` / `FieldBloom` (the Field motion layers), `HaikuStarter` (home welcome-haiku — shimmer → scattered per-word spring entrance → dissolve → per-word touch lens), `Card`, `Section`, `Footnote`, `Chip`, `Hero` (eyebrow + Fraunces 40px question), `CTA` (anthracite button + cream text), `CTAWarmth`, `ActionPill` (Brew-Again candidates on home), `ChatInput`, `ChatThread`, `AttachmentSheet`, `NavigationOverlay` (full-screen menu — Home / Past Conversations / New Session / Coffee Library / Nearby / Café Library / Taste Profile), `ReferenceCoffeePicker`, `StarRating` (rotation toggle + log rating), `CircularTimer` (Light fork — anchored to Date.now, visibility-snap), `CoffeeBeanGlow` (anthracite stroke fork), `ConnectionStatus` (top-center pill rendered by `LightShell` — shows Offline / Syncing / "didn't sync — tap to retry"; owns the offline-save flush, re-checking `navigator.onLine` on mount + `visibilitychange` rather than the unreliable iOS online event), `LiquidHeadline` (reusable per-word scatter entrance + reverse per-word exit — backs the animated Hero questions + the recipe insight; see docs/liquid-design.md), `BagPhoto` (the ONE shared rounded-3xl inset bag-image treatment + cream scrim — coffee-detail / Save-brew / scan preview all use it), `CraftingStatus` (recipe-screen status line: black, sentence-case card-title style, cycling phases + animated 1-2-3 dots).

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
├── ai/
│   └── recommendProvider.ts # ★ The ONLY place that picks the /recommend model: Mistral Large by default (≈¼ Opus cost, PR #455), Opus via RECOMMEND_PROVIDER=anthropic or when MISTRAL_API_KEY absent; auto-fallback to Opus on a Mistral error. Same byte-identical SYSTEM_PROMPT for both.
├── claude/
│   ├── recommend.ts        # ★ Full system prompt + recipe generation. Model call goes through ai/recommendProvider.ts (Mistral/Opus); guardVesselCapacity() drops over-capacity-vessel candidates post-parse (uses utils/vesselCapacity.ts).
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
│   ├── zones.ts               # 7-zone perceptual palette (fruity-bright, fruity-deep, floral, nutty-cocoa, spice-earth, sweet-caramel + cool-berry). cool-berry = the one COOL zone, hue 210–244 = real BLUE for BERRIES (blueberry/blackberry/blackcurrant/cassis). Grape/plum stay warm-red in fruity-deep ("blue for berries, purple is for grape/plum" — June 2026). Saturation floors cranked in the Big-Sur pass.
│   ├── defaultZones.ts        # Fallback composition for coffees with no Field yet
│   ├── curatedFields.ts       # ★ CURATED_FIELDS (8 elegant 2–3-flavour combos) + getGeneralField() — the general/home background picks the NEXT combo per app-open (localStorage counter, module-memoized, SSR-safe). Wired as the FieldContext fallback default so every non-coffee screen cycles.
│   ├── composeGradient.ts     # ★ zones + rotation → CSS gradient. DIRECTIONAL (June 2026 murmuration rework): a diagonal linear base blending the 2–3 dominant zones + two large soft corner masses anchoring one diagonal seam + a pale light-ribbon highlight (the "Mac wallpaper" look) — NOT the old 5 scattered radial hotspots. Big-Sur dials (BLOB_ALPHA 0.85, BASE_DESAT 0, etc.) at the top.
│   ├── schema.ts              # Zod schema for persisted field_zones
│   ├── mapNotesToZones.ts     # Haiku call: tasting notes → weighted zone composition (blueberry/cassis → cool-berry)
│   ├── cache.ts               # sessionStorage cache keyed by session id — /coffees/[id] pre-warms,
│   │                            /brew/[id] reads on mount so the cup's Field paints from frame 1
│   │                            instead of flashing default while the coffee fetch resolves
│   └── FieldContext.tsx       # React Context Provider + useFieldConfig() hook. Fallback default + unmount-reset target = getGeneralField() (the per-app-open curated combo), not the static DEFAULT_FIELD_ZONES.
│   # Consumed by <Field> (src/components/ui/light/Field.tsx), LightFlowShell, and the
│   # /coffees/[id] + /brew/[id] detail pages (which both call useFieldConfig directly).
│   # LightFlowShell rotates 25° per brew step (scan 0° → context 25° → recommend 50° → brew 75° → log 100° → summary 125°).
├── knowledge/
│   ├── insights.ts / news.ts / hints.ts / questions.ts / alerts.ts
│   ├── recipes/            # ★ Structured recipe corpus — 136 recipes total (6 championship + 85 reference [16 reference.ts + 69 expanded.ts] + 45 experimental; counted per-file June 2026 — an earlier "9 championship + 74 reference" breakdown didn't match the files). championship.ts = WBrC/WAC champions (Kasuya 2016, Du 2019, Medina 2023, Wölfl 2024, Stanica WAC 2024, Nemo Pop WAC 2025 — all 6). reference.ts + expanded.ts = Hoffmann V60/Clever/AeroPress/Moccamaster/Iced, Kasuya 4:6, April V60 (Rolf), Gagné, Perger, Rao, Hatakeyama, Wallgren, Asser Daily Pour-Over (Christensen) + dozens more. markusAdditions.ts = 45 user-supplied recipes (category "experimental"). Full pour mechanics with per-step durations, attribution, sources, verified flag. **Cold brew (June 2026):** 8 long-cold-steep recipes tagged `occasions: ["cold-brew"]` — Hoffmann Fine+Finings (75g:1L RTD), Specialty RTD 1:10, Counter Culture 1:8, Stumptown, AeroPress Overnight, Clever (capped ≤450ml), Toddy, AeroPress cold-immersion. Big-batch immersion uses the new `cold-brew-jar` brewer (always in CANONICAL_EQUIPMENT — everyone owns a jar); the Clever/AeroPress cold brews stay on their own vessels at REAL capacity (a 900ml Clever is a hard error — fixed). `scoreRecipe()` hard-partitions cold steeps (totalTimeSec ≥ 3600 OR occasion `cold-brew`) from the rest, so a 12h steep never leaks into a hot turn and a cold-brew occasion never pulls a hot pour-over. NO staged/multi-temperature recipes in the corpus — every recipe brews at ONE constant temperature; the Cold-Brew Hot-Bloom variant + the optional 20:80-saline bitterness finish live in the `/recommend` prompt only (hot-bloom uses two temps → not a corpus recipe; it is the ONE sanctioned exception to the no-staged-temp rule, cold-brew only). selectRecipes() injected into /recommend per turn. **Equal best-match ranking (PR #193):** scoreRecipe() has NO pedigree/verified bonus — every recipe competes purely on context match (roast/process/variety/goal/occasion). **Method lock:** when the user locks a method in the flow (context.preferredMethod), selectRecipes hard-filters to that brewer (via brewersFromMethod) and returns the best N recipes FOR THAT METHOD; with no lock it's the one-per-brewer diversity portfolio. **Full mirror:** @./docs/recipes-full.md (partially stale — predates the experimental additions); @./docs/coffee-experts.md is the curated summary (partially stale). (May 2026 source-audit: removed Turbo V60 — espresso-origin; replaced fabricated "Rolf Minimum Variables" with April's real house V60; corrected Perger to 12g/200g; flagged Hatakeyama numbers unsourced.) **June 2026 primary-source audit (PRs #265–#277, owner-supplied transcripts + web):** every named-expert recipe re-verified against the originator's own video/page. Corrected the worst "different recipe wearing the author's name" cases — Gagné AeroPress (was 80°C low-temp → his real HOT 100°C/18g:260g/10-min), Rao (was "Rule of Thirds" equal-thirds → his actual spin-method 20g:330g, he opposes >2 pours), Hoffmann AeroPress (was inverted → his UPRIGHT Ultimate), Hoffmann Moccamaster (was 8:00 → his measured 3:30 for 750g), Hatakeyama (unsourced reconstruction → real 2024 JBrC: 15g:240g/85°C/coarse). New entries: Hoffmann Japanese Iced V60 (pour-over), Nemo Pop WAC 2025, Stanica's separate inverted-Melodrip recipe (his WAC winner is the upright Flow-Control one — both kept, cross-referenced). Kasuya 4:6 temp 92→93. Fabricated water ppm (Wölfl/Kasuya "55ppm") removed.
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
├── brew/                      # ★ Canonical brew timeline + live scale coach (PRs #328/#330/#331, June 2026)
│   ├── timeline.ts         # buildBrewTimeline(recipe) — the SINGLE "intended flow", a normalize layer over pourSequence.ts (pourStepsFromStructured / buildGuideSteps / parsePourSteps). Returns the renderer-ready pourSteps/guideSteps/proseSequence AND a normalized steps[] + expectedGramsAt() + activeStepAt() the flow coach builds on. hasGramsCurve flags percolation. Golden test: tests/dataflow/brew-timeline.test.mjs.
│   └── flowCoach.ts        # coachFlow(timeline, elapsed, started, liveGrams, samples) → one teaching cue ("Steady"/"Ease off"/"Overshot +Xg") comparing the Acaia weight stream to the intended flow. Coaches ANY step with a cumulative-grams target — percolation AND immersion/AeroPress pour steps (#411 dropped the old percolation-only gate); steps with no grams target (steep/press/drain) return "none". #443: selects the active step via the TIME-based `activeStepAt` (matching the card) and reads the RAW live weight (the `settledGrams` median + the `weightedActiveIdx` step-pick were removed). Tests: tests/dataflow/brew-flowcoach.test.mjs.
├── flow/
│   └── brewAgain.ts        # ★ Shared brew-flow entries — startBrewAgain() (online → Step "context") + startBrewAgainOffline() (seed cached recipe → Step "brew") + startBrewFromChat() (seed the chat's exact recipe as a 1-candidate recommendation → Step "brew"; backs the chat `start_brew` button, PR #199). Used by /coffees list, /coffees/[id], ActionPill.
└── utils/
    ├── cn.ts / safeFetch.ts / formatTime.ts
    ├── pourSequence.ts     # ★ Pure pour timing. parsePourSteps() (tolerant of inline @temp/notes annotations) → percolation PourStep[]; pourStepsFromStructured() builds the same from a recipe's structured pourSteps AND derives per-pour agitation from adjacent stir/swirl steps; buildGuideSteps() + hasImmersionShape() drive the immersion StepGuide. PourStep carries temperatureC/notes/agitation.
    ├── pourSteps.ts        # ★ Shared pour-step sanitizer (PR #410). normalizeStepAction() (synonym → exact BrewStepAction, e.g. "Plunge"→press, "Steep"→wait) + sanitizePourSteps() (zod-validate + action-normalize + ≥2-step guard) + pourSequenceFromSteps() (legacy grams-string backstop). ONE source of truth used by BOTH /recommend (sanitizeRecipe) AND explore-agent (cleanChatRecipe), so a chat-authored recipe routes + renders exactly like a /recommend one. Tests: tests/dataflow/chat-recipe-sanitize.test.mjs.
    ├── resolveRecipe.ts    # ★ resolveBrewedRecipe(session) — single source of truth for "the recipe the user ACTUALLY brewed" (the selectedCandidateIdx candidate, NOT primaryRecipe). Used by chat history, timing stats, offline cache, brewSignature, brew detail so the primary-vs-selected bug class (PR #193, #198) can't recur per-call. brewedRecipeName() = title (+ "based on …").
    ├── vesselCapacity.ts   # ★ vesselOverflow(method, waterGrams) — deterministic /recommend backstop (PR #455). guardVesselCapacity() in recommend.ts drops any candidate whose brewer can't hold its waterGrams (AeroPress >230, Clever/Origami >450, Moccamaster <500). Checks waterGrams (what the vessel holds), so iced recipes aren't falsely flagged. Closes Mistral's one spike weakness. Tests: tests/dataflow/vessel-capacity.test.mjs.
    └── pourSequence.test.mjs  # node --test suite — pour math + tolerant parse + structured/guide + agitation + resolveBrewedRecipe
```

### Other key files

| File | Purpose |
|------|---------|
| `src/store/flowStore.ts` | ★ Zustand brew flow state (**localStorage**-persisted since the offline work — survives a mid-brew reload; "New Session" in `NavigationOverlay` calls `reset()` so it never resumes a stale draft) |
| `src/hooks/useOnline.ts` | Connectivity boolean (seeds `true` for SSR, then `navigator.onLine` + online/offline events). Used by the `/coffees` pages for the offline read path. |
| `src/hooks/useWakeLock.ts` | Keep screen on during active brew — iOS shell via the app-local `ScreenAwake` plugin (`window.Capacitor.Plugins.ScreenAwake`, #443), Web Wake Lock API fallback elsewhere; re-asserts on visibility + every 15 s |
| `src/hooks/useVoiceCapture.ts` | Mic recording + level metering for inline-chat voice input (BTTS Home). Plays the "I'm listening" earcon (`src/lib/audio/listeningCue.ts` — ascending E5→B5, distinct from the brew timer's descending step cue) the instant the mic arms. An `autoListenSignal` prop on `ChatInput` arms it from the Siri / Action-Button `btts://voice` deep link |
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
| `.dockerignore` | Excludes `native/`, `node_modules`, `.next`, `.env*` from the Next.js build context. |

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

**`/recommend` migrated from Opus to Mistral Large 3 — sovereign EU AI, ≈¼ the per-call cost (June 2026, PR #455)**
- **Why:** real Anthropic usage CSVs showed the bill was **57–63 % Opus**, almost all of it `/recommend`. Moving that ONE call off Opus is the only change that materially cuts cost — a hybrid keeping Opus on recommend would have saved ~12 %. (Don't re-propose hybrid; the numbers killed it.)
- **Validation (3-round spike, NOT guesswork):** `scripts/recommend-model-spike.mjs` (workflow `.github/workflows/recommend-spike.yml`, fired via the `.github/recommend-spike-trigger` bump) esbuild-bundles the REAL recommend prompt (`SYSTEM_PROMPT` + injected corpus) and fires it **byte-identically** at `claude-opus-4-7` vs `mistral-large-latest` vs `claude-sonnet-4-6` across 6 bean profiles × goals × occasions × volumes. Objective detectors: `reconcileToReference` drift (fabrication), staged-temp, schema-valid, **vessel-capacity**, iced `iceGrams`. **Result: Mistral 0 fabrication-drift across 24 samples** (matching Opus), schema-valid throughout, **~$0.05/call vs Opus ~$0.20**. Full results in `docs/recommend-spike-run2.md` + `docs/recommend-spike-run3.md` and **issue #453**. One weakness surfaced: at large volumes Mistral occasionally picked an over-capacity vessel.
- **What shipped:** `src/lib/ai/recommendProvider.ts` is the ONLY place that picks the recommend model — `RECOMMEND_PROVIDER=mistral|anthropic` forces a side, else auto (Mistral when `MISTRAL_API_KEY` present, else Opus, so deploying can't break recommend), and a Mistral error **falls back to Opus per-request**. The prompt is byte-identical for both providers (no `SYSTEM_PROMPT` change). `src/lib/utils/vesselCapacity.ts` + `guardVesselCapacity()` in `recommend.ts` deterministically drop any candidate whose brewer can't hold its `waterGrams` (checked against waterGrams, NOT the drink volume, so iced recipes aren't falsely flagged). Tests: `tests/dataflow/vessel-capacity.test.mjs`.
- **Env / ops:** `MISTRAL_API_KEY` + `RECOMMEND_PROVIDER` in `docker-compose.yml` + `.env.example`. `deploy.yml` **append-only-injects** `MISTRAL_API_KEY` into the VPS `.env` from the GitHub secret (guarded — never rewrites the file) so go-live needed no terminal work. The Mistral key lives in a dedicated **"BrewLog" Mistral workspace** (cost-separated from the owner's other project; the Le-Chat/Tools/retention/tracing settings in that workspace are irrelevant — we call the API). **Rollback = `RECOMMEND_PROVIDER=anthropic`.** This was an owner-approved AI-behavior change (own commit); the spike-validated swap is the sanctioned exception to "don't swap an Opus-engineered prompt".
- **Still on Claude (unchanged):** `insights`, `coffeeInsight`, `explore-agent`, all the Haiku endpoints — moving them saves far less. The provider abstraction makes migrating them later trivial if the owner asks.

**Field "Big-Sur" colour + murmuration motion + blue berries + dark fonts + rotating backgrounds (June 2026, PRs #445 / #446 / #447 / #448 / #449)**
- **Big-Sur intensity (#445/#446).** The Field deliberately held itself back to stay cream-dominant; the owner wanted the opposite (a vivid magenta→blue wallpaper feel). Cranked the six richness dials in `composeGradient.ts` (`BLOB_ALPHA 0.62→0.85`, `BLOB_SAT_BOOST 12→24`, `BASE_DESAT 8→0`, `RADIAL_ALPHA_BOOST 0.12→0.20`, cap `0.9→0.97`, `BASE_DIM 6→3`) + lifted the saturation floors of the vivid zones in `zones.ts`. Applies to every coffee instantly (hues read live, no DB change). Added the cool `cool-berry` zone; a CRON_SECRET admin route (`/api/admin/remap-field-zones`) + the `field-zones-remap` workflow (fired via a `.github/field-zones-remap-trigger` push, since the integration token can't `workflow_dispatch`) re-mapped all 43 coffees so blackcurrant/Kenyan bags carry it.
- **Berries blue, not purple (#447).** `cool-berry` hue 250–290 read purple → retuned to 210–244 (cornflower BLUE). Owner rule: "blue for berries, purple is for grape/plum" — grape/plum stay warm-red in `fruity-deep` (no separate purple zone, by choice).
- **Dark fonts (#447).** `light-muted-foreground` 40 % grey → 16 % near-black (safe — pills use the cream `text-on-dark` token, never grey); `.label-eyebrow` 0.7→0.9; raised the faint `text-light-foreground/40`–`/50` labels on the detail pages.
- **Directional composition + murmuration motion (#448).** Owner: the blobby look was "too crazy bunt"; the Mac wallpaper is 2–3 colours as broad DIRECTIONAL gradients flowing as ONE coherent mass. `composeGradient.ts`: 5 scattered radial hotspots → a diagonal linear base + 2 corner masses + a pale light-ribbon. `FieldBlobs.tsx`: 4 independent drifters → all masses on ONE shared `field-flow` sweep (coordinated, turns direction) + small per-mass `murmur-*` drift. New `curatedFields.ts` (`CURATED_FIELDS` + `getGeneralField()`) cycles the general/home background through elegant 2–3-flavour combos per app-open, wired via `FieldContext.tsx`.
- **Motion-visibility fix (#449).** The first murmuration cut paired huge soft masses with a tiny slow sweep (±8vmax/120s) → optically frozen ("keine Bewegungen mehr"). Opened the travel up (`field-flow` 70s, ±18vmax + ±13° rotate; `murmur` ±13vmax; discs 96vmax/blur 50px) — same coordinated sweep, now legible. Owner-confirmed "Love it." All dials documented in `docs/liquid-design.md`. **iOS:** all web code → reaches the Capacitor shell on deploy, nothing native touched.

**Brew-timer rework: pour-timing math + weight on every step + TIME-based steps + real native screen-on (June 2026, PRs #438 / #440 / #442 / #443)**
- **Lesson (the why — read before touching this screen again).** Active-step selection went through FOUR iterations because each "fix" added cleverness and a new failure mode: #438 weight-gated the step (wait for the poured grams) → a weight DIP jumped it backwards → #440 tracked the running MAX ("peak") to stop that → a tap/swirl FORCE-SPIKE froze into the peak → permanent "Overshot" → #442 median-smoothed the peak → laggy/stiff. #443 DELETED the whole weight-gating apparatus and went TIME-based — the simplest thing — and the owner confirmed it "works beautifully". When a fix needs another fix, step back and delete. (Two more lessons banked from this arc: a stubborn *symptom* can have an upstream root cause — the "flaky Acaia" was actually the screen sleeping, see the wake-lock bullet — and a Capacitor npm plugin in package.json is NOT necessarily linked into the iOS binary.)
- **Pour SCHEDULE math (`buildPourOver`).** The inter-pour window was split EQUALLY, ignoring pour size — a 180 g pour (~45 s at 4 g/s) got the same slot as a 50 g pour and the step flipped before you'd finished pouring (the "200 ml pour disappears after 15 s" bug). Now the time between pours is distributed PROPORTIONALLY to each pour's grams (time follows water). Invariants preserved so nothing else shifts: bloom@0, the final pour still lands at `target − reserve`, total time unchanged, and EQUAL-size pours reproduce the old uniform schedule byte-for-byte. The 0.33 drawdown reserve is NOT changed (no fabricated parameter). NB: this also shifts the haptic/watch step boundaries (`boundariesFromTimeline`) to the corrected times.
- **TIME-based active step (`getActiveIdx`) — the freeze removed (#443).** The active pour step advances purely on the recipe's TIME schedule (`getActiveIdx`, `src/lib/utils/pourSequence.ts`), NOT on weight. Every step shows a LIVE weight box vs its target, so the card needn't wait for the pour — pour slow and you still read what you've poured against the goal on the next card (owner's call). The displayed weight + the live coach read the RAW live `scale.weight` (it drops/spikes naturally, then settles — no peak, no median, nothing to "freeze"); `coachFlow` selects the SAME time-based index (`activeStepAt`) so its numbers match the card. Drain is time-based too. **DELETED in #443** (do not reintroduce): `weightedActiveIdx`, `peakGramsRef`, `settledGrams`, `REACH_TOL_G`, `AGITATION_DWELL_SEC`. The earlier weight-gating/monotonic-peak (#438/#440) and the #442 median each over-corrected (see the Lesson above). The top `ScalePanel` shows the same raw live weight.
- **Weight box + always-on countdown on EVERY step.** Swirl/agitation and drain steps now show the cream `WeightHold` box (live g/s + current/target grams) — same readout the pour card's `CoachCue` already had. The drain card was rebuilt (Now / Drain / total / Hold / "Finish in" countdown). Every active card carries a live countdown — the trailing end-swirl gets a "Drain in" footer so it's never inert/"lost". **No top "ON THE SCALE" pill** (that `LiveScaleTotal`, deleted in #432, was NOT restored — the weight lives inside each card). The swirl button stays.
- **Overtime colour readable on warm Fields (`CircularTimer`).** Timer digits stay anthracite (amber numerals were unreadable on a warm/dark coffee Field); the overtime "Done" button is a SOLID amber fill + cream text. Amber ring + "+over" label keep the signal.
- **Real native screen-on, via an app-local plugin (#443).** Held on mount→unmount (gated to skip the cold-steep branch), not just once the timer starts. The screen-off bug — and with it the "flaky Acaia" — had a hidden root cause: the npm `@capacitor-community/keep-awake` was in package.json but **never linked into the iOS binary** (absent from `native/ios/App/CapApp-SPM/Package.swift`), so its `keepAwake()` was a silent no-op → `useWakeLock` fell back to the Web Wake Lock API → WKWebView doesn't support it → the screen slept → WKWebView JS suspended → the Acaia's 1 s heartbeat `setInterval` paused → the scale dropped. Fix: a new **app-local** plugin `ScreenAwakePlugin` (`native/ios/App/App/ScreenAwakePlugin.swift`) that flips `UIApplication.isIdleTimerDisabled`, explicitly registered in `MainViewController.capacitorDidLoad` + added to the App target via `add_watch_target.rb`'s `APP_SWIFT_FILES` — the same guaranteed-compiled-in pattern as BrewWatch/Widget/LiveActivity. `useWakeLock` calls `window.Capacitor.Plugins.ScreenAwake.keep()/.allow()` (typed accessor, mirrors `brewWatch.ts`), keeping the Web Wake Lock fallback + the visibility/15 s re-assert (iOS clears `isIdleTimerDisabled` on background). Scale/BLE code untouched — it stabilized purely from the screen staying on. **Needs a TestFlight rebuild** (native change), unlike the rest of this rework. See `docs/ios-shell-roadmap.md`.
- **End-swirl reliability (`/recommend` prompt, AI-behaviour, #438).** The corpus has end-swirls (61/136 recipes settle the bed with a swirl/tap before drawdown) and the render pipeline preserves them — but the model writes its own `pourSteps`. Tightened the prompt so the `basedOn` reference recipe's settle swirl/tap is carried into `pourSteps`; minimal/reduced-agitation recipes (Orea/Origami/Chemex/Moccamaster) still emit none. The swirl appears when the recipe calls for one, not always.
- **Architecture reminder:** all of the above is web code → reaches BOTH the iOS Capacitor remote-URL shell AND the Safari PWA the moment the Hetzner deploy finishes (no TestFlight rebuild). The native Apple-Watch app (build 19) only runs the step schedule the phone hands it via `useBrewStepWatch`/`brewWatch.ts`; this work didn't touch that path or the watch binary — only the boundary TIMES changed. **"Acaia connection worse" — SOLVED in #443:** it was the screen sleeping (the keep-awake plugin was never in the binary → JS suspends → the scale's 1 s heartbeat pauses → BLE drops); the app-local `ScreenAwakePlugin` fixed it, owner-confirmed. **Still open / unreproduced:** "chat recipes show no pour guidance" could NOT be reproduced from the code (chat V60 + AeroPress both produce correct guidance through `buildBrewTimeline`); if it recurs, a specific recipe is needed to repro. Tests: proportional-spacing cases in `pourSequence.test.mjs` (the `weightedActiveIdx` cases were removed with the function in #443).

**Brew-from-chat: pour guide + scale coaching + reliable recipe linking (June 2026, PRs #410 / #411 / #413)**
- **#410 — AeroPress/immersion pour guide was blank.** The home chat's `start_brew` handed the brew timer the model's RAW recipe; unlike `/recommend` it wasn't sanitized, so drifted step actions ("Steep"/"Plunge"/"Press") never matched the renderer's exact `BrewStepAction` vocab → the immersion `StepGuide` mis-routed and showed nothing. Extracted the sanitizer into shared `src/lib/utils/pourSteps.ts` (`normalizeStepAction` + `sanitizePourSteps` + `pourSequenceFromSteps`), now used by BOTH `/recommend` (`sanitizeRecipe`) and explore-agent's new `cleanChatRecipe()` (which also derives the `pourSequence` backstop + snaps headline water via `reconcileWaterToPourPlan`).
- **#411 — live Acaia scale coaching now works on AeroPress/immersion too.** `coachFlow` was hard-gated to pour-over (`hasGramsCurve`); dropped that gate so it coaches any step with a cumulative-grams target. `StepGuide` now receives `coach` and renders the same `CoachCue` ("Overshot +Xg" etc.) the V60 view shows — on the water-pour steps; steep/press stay time-only. Only when the scale is connected.
- **#413 — chat wouldn't link a written recipe to the brew (showed a library link / "Brew again").** Root cause: `start_brew` needs the coffee's `id`, but since #247 (June 6) the chat only got ★-rotation bags — a named-but-unstarred bag had no id. Now injects the 50 most-recent library bags (merged with rotation, deduped) so every owned bag is brewable by id, + hardened the prompt so a written recipe MUST use `start_brew` (never `brew_again`/a library link). NOTE: a bag older than the ~50 most-recent AND unstarred still has no id → falls back to a library link; a `find_coffee` lookup tool is the documented follow-up if that ever bites.

**Cold Brew as an occasion + occasion/time rework (June 2026, PRs #396 / #398 / #399 / #400 / #401)**
- **Occasions are now 6:** Morning Ritual, Deep Focus, Social, Experiment, Summer Time, **Cold Brew**. **"After Dinner" removed** (unused). Defined in `LightStepContext` `OCCASIONS`.
- **The standalone Cold Brew page + nav item were deleted** — Cold Brew is an occasion. `src/lib/coldBrew/coldBrew.ts` is kept and **repurposed** as the steep-reminder engine (schedules a single iOS local notification at the finish time via the shell's `@capacitor/local-notifications`; localStorage-persisted).
- **Time buckets renamed Quick/Normal → Normal / Special.** "Special" = a fast shot (≤~150s, the old Quick). Long steeps come ONLY from the Cold Brew occasion, whose Time card is hidden (steep = the time, `timeAvailable: "long-steep"`).
- **Cold-brew recipes** (8, sourced) added/retagged — see the `recipes/` note. Vessel-correct: `cold-brew-jar` brewer for big batches, Clever capped ≤450ml, AeroPress ≤200ml; `/recommend` carries hard vessel-by-volume rules + honours the exact custom volume (e.g. 900ml → a 900ml jar, never a 900ml Clever). Hot-Bloom variant + 20:80-saline finish are prompt-only.
- **Brew step renders `src/components/flow/ColdBrewSteep.tsx`** when the recipe is a cold steep (occasion `cold-brew` OR `targetTimeSec ≥ 3600`) instead of the live pour timer: recipe card (built from the SAME Light primitives as the hot-brew card — `label-eyebrow` + `font-mono-num` 4-up stat grid) → "Start steep" (schedules the reminder + parks a flow-draft snapshot) → big `font-mono-num` countdown ("Xh Ym left") → **"Leave it steeping"** exits Home so you can brew other coffee meanwhile.
- **Parked + resumable:** `startColdBrew` snapshots the whole flow draft into the cold-brew record; `flowStore.resumeColdBrew()` re-hydrates it. The **`NavigationOverlay` shows a live "Cold brew · Xh Ym left / ready — log it" entry** whenever one is steeping — tap to return and log it. One cold brew at a time; resuming replaces the current in-progress draft.
- Recommend page shows steep time in **hours** (`formatDuration`) and a plain method-step list (not the pour-math table); grams/temp on both the recommend + steep cards are finite-guarded so a bad model value renders "—", never `NaNg`.
- **Architecture reminder (why these shipped instantly):** the iOS app is a **Capacitor remote-URL shell** that loads the live web app — so every screen/recipe change here is web code that reaches BOTH the iOS app and the Safari PWA the moment the Hetzner deploy finishes. Only genuinely native capabilities (the closed-app steep notification, BLE, widget, watch, Live Activity) need a TestFlight shell build. See `docs/ios-shell-roadmap.md`.

**Auto-refreshed loading-screen insight agent (June 2026, PRs #342 / #345 / #346 / #347)**
- The recipe-crafting loading screen (`LightStepRecommend`) rotated a static `COFFEE_HINTS` array; now a scheduled agent grows/swaps the pool **monthly, full-auto, no human review**. Because the owner chose no review and "never fabricate" is non-negotiable, a **machine gate replaces the human one**: every candidate — from the verified corpus, brew aggregates, AND live `web_search` — must be grounded in a cited source (numbers + mid-line proper nouns must appear in it), pass `src/lib/insights/loadingInsightLint.ts` + a model claim-check, before insert. Web lines carry a verbatim quote as their grounding; residual web-fabrication risk is accepted for this low-stakes surface.
- `loading_insights` table (migration 0018, **also self-bootstrapped** via `CREATE TABLE IF NOT EXISTS` in the refresh route — the integration can't dispatch the migration workflow, `403`). GET `/api/loading-insights` is defensive (→ seed on any failure); `LightStepRecommend` merges pool + seed, and the seed is the unbreakable floor (instant, offline-safe, never regresses).
- Runs via `.github/workflows/loading-insights-refresh.yml` (monthly cron + `workflow_dispatch`): SSHes in with the **deploy key** and triggers `docker compose exec -T app curl` from inside the container — zero new secrets, reads the container's own `CRON_SECRET`, no Ofelia restart.
- **The Dockerfile now installs `curl`** (`node:20-alpine` shipped without it). This ALSO unbroke the existing Ofelia crons (`/api/research`, `/api/conversations/cleanup`, `/api/coffees/compact`), which had been silently failing on `curl: not found` (Ofelia only Slacks on error, which isn't wired). Don't remove curl.
- Full reference: **`docs/loading-insights.md`** (architecture, the gate, the sources, ops, tuning dials). Tests: `tests/dataflow/loading-insight-lint.test.mjs`.

**Recipe-fidelity system + extraction-budget framework + primary-source audit + deploy fix (June 2026, PRs #265–#278)**
- **Recipe fidelity (two layers).** (1) Prompt rule in `recommend.ts` (#265): when a candidate is `basedOn` a documented recipe, preserve its grind/cadence/temp/total-time and scale ONLY the grams — adding 50ml must never add 1:15. (2) Deterministic backstop `src/lib/claude/recipeFidelity.ts` (#266): `reconcileToReference()` runs after parsing and snaps a drifted candidate's mechanics back to the VERIFIED scaled corpus recipe. Verified-refs only, 0.5–2.5× scale only, skips iced/bypass. Tests: `tests/dataflow/recipe-fidelity.test.mjs`. Root cause was the Kasuya Super-Coarse "+50ml→+1:15 / lost super-coarse grind" mangle (the model rewrote the recipe at generation time; the timing math was innocent).
- **Extraction-budget framework (#268, mirrored to explore-agent #269).** Layer-2 of `recommend.ts` reworked around one dial — *how much input does this coffee need* — with a strict precedence so factors can't contradict: **GOAL > ROAST > PROCESS > FRESHNESS**. Conflict rule for the stale-natural case (process says coarser, age says finer): grind follows the drawdown-time target, temperature + agitation close the gap (temp stays an extraction lever, never a flow one). Fixed two self-contradictions (washed "high solubility" vs needs-most-coaxing; natural pour-count "fewer" vs "5 pours"). Naturals default to fewer pours on clarity/balanced; a body/sweetness goal may use more pours AT a coarser grind (Kasuya percolation-cycles effect).
- **Time buckets.** `LightStepContext` offers **Normal (~3–5 min)** and **Special (a fast shot, ≤~150s)** — renamed June 2026 from the prior Quick/Normal (#273 had collapsed Quick/Normal/Unhurried → Quick/Normal). "Special" = the old "Quick" fast path; long steeps come ONLY from the Cold Brew occasion (which hides the Time card and sends `timeAvailable: "long-steep"`). `recommend.ts` vocabulary matches: `normal` 180–330s, `special` ≤150s, `long-steep` = cold brew (steep = the time); legacy `quick`→special, `unhurried`→slow end of normal.
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
- 7-zone perceptual palette (fruity-bright, fruity-deep, floral, nutty-cocoa, spice-earth, sweet-caramel + `cool-berry` — blue-violet/indigo for blueberry/blackcurrant, the one cool zone, added in the "Big-Sur punch" pass); composition stored as weighted JSON in `coffees.field_zones`.
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
- **Structured knowledge layer (May 2026)** — `src/lib/knowledge/{recipes,varieties,techniques}` carries the science/expertise corpus that backs `/recommend` and `/explore-agent`. **Human-readable mirror:** @./docs/coffee-experts.md (mirror only — update the TS files first, then mirror). Replaces ad-hoc recipe paragraphs that were embedded directly in the prompts. **Recipes** = 136 total (6 championship + 85 reference + 45 experimental/user-supplied in `markusAdditions.ts`): WBrC/WAC champions (Kasuya 2016, Du 2019, Medina 2023, Wölfl 2024, Stanica WAC 2024, Nemo Pop WAC 2025), Hoffmann V60/Clever/AeroPress/Moccamaster/Iced (+ Japanese Iced V60 pour-over), Hedrick Flash Brew Iced, Kasuya 4:6, April V60 (Rolf), Gagné, Perger, Rao, Hatakeyama 2024 JBrC, Wallgren Kalita-sieve, Asser Daily Pour-Over (Christensen), plus dozens more — and 8 cold-brew long-steeps (June 2026, occasion `cold-brew`; jar/Clever/AeroPress vessels). (All named-expert entries re-verified against primary sources June 2026 — see the recipes/ note above.) NO staged/multi-temperature recipes in the corpus (every recipe brews at one constant temperature; the cold-brew Hot-Bloom variant is the one prompt-only exception). Each entry: structured pour sequence with per-step durations, attribution, sources, `verified` flag distinguishing canonical vs reconstructed details. Ranked equally on best-match (no pedigree/verified bonus); a locked method hard-filters selection to that brewer (see recipes/ note above). **Varieties** = ~25 WCR-grounded cultivar priors covering Bourbon family, Typica family, Ethiopian landraces, Geisha, SL series, F1 hybrids, Pacamara, Mokka. Genetic / agronomic facts sourced to the WCR Arabica Coffee Varieties Catalog; cup descriptions from Royal Coffee's *Green Coffee Book*. Pink Bourbon flagged per WCR's 2024 finding that it is genetically distinct from Bourbon despite the marketing name. **Techniques** = 25 atomic brewing moves (16 named-expert: Peng Melodrip, Wallgren sieving, Rao spin, water-first, low-mineral water, etc. + 9 general/foundational: bloom, pulse-pouring, immersion-steep, central/spiral/continuous-pour, machine-drip-brew, batch-scaling, flat-bed-pour) cross-referenced to exemplifying recipes — the brain can cite mechanism by id and reach a worked example. Every recipe's `techniques` field references a real id, and every technique's `exemplifiedBy` references a real recipe id (both directions enforced by `tests/recipes/validate.mjs`). All three modules injected per turn; system prompts are NOT touched (cache hits preserved).

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
6. **Palette — NOT a gap. The app is already colourful (do not describe it as "cream/bland").** The generative **Field** background paints a saturated, full-bleed **directional** gradient on *every* screen — `src/lib/field/zones.ts` spans fruity reds/oranges (0–30), deep red/burgundy (350–375), floral pinks (320–355), warm caramel (30–50), and the cool **blue** `cool-berry` (210–244). Since the June-2026 Big-Sur + murmuration pass it's cranked to full saturation and composed as a diagonal blend + corner masses + a pale light-ribbon (the "Mac wallpaper" look), flowing via the `FieldBlobs` murmuration sweep. Cream is only the card-glass + base *under* that gradient; the dominant visual is the colour. The app must never be called cream-dominant.

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
- `mistral-large-latest` (**Mistral, EU-hosted**) — **recommend** (`/api/recommend`), migrated off Opus June 2026 (≈¼ the per-call cost; spike-validated, 0 fabrication over 24 samples — see the Done entry + issue #453). Routed via `src/lib/ai/recommendProvider.ts` (the ONLY place that picks the recommend model): `RECOMMEND_PROVIDER=mistral|anthropic` forces a side, else Mistral when `MISTRAL_API_KEY` is set, else Opus; a Mistral error falls back to Opus per-request. `SYSTEM_PROMPT` unchanged — both providers get byte-identical input. Capacity guard in `src/lib/utils/vesselCapacity.ts` + `recommend.ts`.
- `claude-opus-4-7` — insights (coach observations, `src/lib/claude/insights.ts`), per-coffee coach insight (`src/lib/claude/coffeeInsight.ts` — also behind `/api/admin/prewarm-coffee-insights`). NOTE: recommend's prompt was engineered for Opus; its Mistral swap was the owner-approved, spike-validated exception — do NOT swap any OTHER Opus-engineered prompt without the one-line disclosure per the "AI behavior changes" section.
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
- **Tokens:** `text-light-foreground` (anthracite `hsl(0 0% 14%)`), `text-light-muted-foreground` (now near-black `hsl(0 0% 16%)` — darkened from 40 % grey in June 2026 so secondary text reads on the saturated Field; pills never use it, they use the cream `text-on-dark`), `bg-light-card-default` (cream glass 55 %), `bg-light-card-selected` (warm taupe), `bg-light-surface` (opaque cream, modal/sheet surfaces), `border-light-foreground/15`, `shadow-light-card-pressed`
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
