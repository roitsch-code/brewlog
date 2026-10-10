# BrewLog — Claude Code Context

Personal coffee brew advisor & diary PWA. Next.js 14 App Router + Postgres + Claude/Mistral AI + Hetzner. Brand: **BTTS — Better taste than sorry.**

**This file describes the CURRENT state only.** The build-by-build chronicle (what was reported, measured, shipped and verified, per PR) lives in **`docs/history.md`** — not auto-loaded, read it when a "why is it like this?" question comes up. When a change ships: update the state here, append the story there.

---

## Operating mode — own the mechanics, keep asking (OVERRIDES the friction rules below)

The user runs this project from a phone, usually with no terminal. The thing to eliminate is **manual mechanical work on the user's side** — never the conversation. This section takes precedence over any "validate before shipping" instruction elsewhere in this file, but it does NOT tell you to stop asking questions.

- **Asking is a MUST, not friction.** The user wants to steer: clarify ambiguity, confirm direction, surface trade-offs, present real options for decisions (especially anything subjective, visual, product-shaping, or with no clear default). Erring toward asking on *what to build / which way to go* is correct and wanted. What the user is sick of is being *blocked* — not being *consulted*.
- **Never offload mechanics onto the user.** Do NOT hand them commands to type, do NOT expect them to `git pull` / push / merge / run a script / SSH / type anything in a terminal. YOU run git, YOU open and merge the PR, deploy is automatic, SQL migrations go through the `.github/migrate` marker. The only legitimate "you do it" is a setting that genuinely lives behind a web UI you can't reach (e.g. GitHub repo-settings toggles, Apple developer portal) — and even then, name the exact clicks and offer to walk them through it.
- **Ship the execution end-to-end.** Once a direction is agreed: make the change → `tsc` → commit → push → open the PR → merge on green → confirm `main` advanced and the deploy run is green. "Done" = merged + deployed, never "pushed to a branch" and never "here's the command, you run it".
- **Pause for decisions and for the genuinely irreversible.** Ask the user on real forks. Hard-stop only for wiping/overwriting production data, deleting things you didn't create, force-pushing `main`, rotating secrets, or spending money. Ordinary code / asset / config / prompt changes are revertible via git — execute them, then report.
- **A wall means route around it, not dump it on the user.** A tool is blocked? Find another path before surfacing it. When you do surface a wall, say what you already tried.
- **Self-correct in place.** Made a mistake? Fix it and move on. No spiralling, no wall of hedging.

**What this does NOT relax:** the "never fabricate coffee parameters / facts" rule stays fully in force — but it means *look it up or mark it unverified and keep going*, never *halt the task*. Honesty about data (don't invent row counts, don't claim verified when you didn't check) is about not lying to the user.

---

## Infrastructure

| What | Detail |
|------|--------|
| **VPS** | Hetzner Cloud, host in the `DEPLOY_HOST` GitHub Actions secret, path `/opt/brewlog`. Co-hosts HealthSync + Ladeplanner (see the container-naming rule) |
| **Stack** | Docker Compose: `postgres`, `app` (Next.js, `container_name: brewlog-app`), `caddy` (the ONE public reverse proxy, sibling site blocks live in the repo `Caddyfile`), `ofelia` (cron) |
| **Vercel** | Deleted. 100 % Hetzner. Never reference Vercel. |
| **Domain** | `bettertastethansorry.com` (+ `staging.`). iOS = Capacitor remote-URL shell loading the live site (see `docs/ios-shell-roadmap.md`) |
| **Auto-deploy** | `.github/workflows/deploy.yml` on push to `main` (paths-ignore: `docs/**`, `**/*.md`, `.github/**`, `native/**`). SSH → `git reset --hard FETCH_HEAD` → `docker compose build app` (retried once) → `up -d --force-recreate --no-deps app caddy` → restart ofelia. Always-syncs `MISTRAL_API_KEY`, `MISTRAL_COACH_API_KEY`, `HEALTHSYNC_INGEST_SECRET` from repo secrets into the VPS `.env` (strip + re-append, guarded). Then two post-deploy jobs: **`smoke`** (ONE real Opus call through the app's own `callRecommendModel`, ~$0.20) and **`verify-domain`** (the login page must be BTTS, never a sibling app). A red post-deploy job means the deploy is NOT done. To redeploy with no code change, bump `.deploy-trigger`. |
| **Secrets** | `DEPLOY_HOST/USER/SSH_KEY/PATH`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`, `MISTRAL_COACH_API_KEY`, `HEALTHSYNC_INGEST_SECRET`, `GH_PAT`, the six Apple/ASC secrets (roadmap doc). Workflow run logs are PUBLIC (public repo) — never print a secret or `.env` content. |
| **Runtime** | `node:22-alpine` in all Dockerfile stages, `node-version: 22` in every workflow (Node 20 was EOL 2026-04-30). |
| **Backups** | `deploy/backup.sh` from the HOST crontab nightly (03:00 UTC): compose-resolved `pg_dump`, gzip-tested + size-checked before upload, rclone → `storagebox:backups/`, **30-day retention**, writes `~/.brewlog-backup.last`. **Verified weekly** by `backup-drill.yml` (Mondays 07:05 Düsseldorf, or bump `.github/backup-drill-trigger`): fails if the newest dump is >48 h old, restores it into a throwaway Postgres (`--network none`) and fails if `sessions` is empty. First drill 2026-10-10: 7 dumps, restore clean, 226 sessions. **S3 photos are NOT backed up.** |
| **Image optimizer** | OFF. Next 14.2.x serves `/_next/image` BEFORE the middleware runs (verified live), and it carries an unpatched unauthenticated AVIF RCE (GHSA-2xp9-vwfh-vxw4). `images.unoptimized: true` + `respond 404` for `/_next/image*` in the Caddyfile, pinned by `tests/dataflow/middleware-image-gate.test.mjs`. Real fix = Next 15 migration (owner: wait). |

**Co-hosting & container naming — HARD RULE.** Shared-network containers get globally unique `brewlog-*` names, never `app`/`web`/`db`; the Caddy upstream is `brewlog-app:3000`, never the service alias. (2026-09-07: both BTTS and the Ladeplanner were `app`, Docker DNS round-robined, the domain intermittently served the wrong app.) `deploy.yml` recreates `caddy` with `app` so the bind-mounted Caddyfile is re-read; `verify-domain` is the tripwire.

**Manual deploy (fallback, never handed to the owner):** SSH → `cd /opt/brewlog && git pull origin main && docker compose build app && docker compose up -d --force-recreate --no-deps app caddy`

**SQL migrations — the marker file.** Write the filename into **`.github/migrate`** and merge; `migrate-on-push.yml` SSHes in and pipes it into psql (`-v ON_ERROR_STOP=1`). No button — the integration token cannot `workflow_dispatch` (403). The marker keeps its last value, so every migration must be re-runnable (`IF NOT EXISTS`, zero-row guards; CI applies ALL migrations to an EMPTY DB on every PR). Drizzle is column-strict: migrate BEFORE (or with) the code that reads a new column. `migration.yml` is the manual `workflow_dispatch` alternative for a human at the GitHub UI. Manual fallback (Actions down only): `cat src/lib/db/migrations/<file>.sql | docker compose exec -T postgres psql -U brewlog -d brewlog`. **Every `docker compose exec` inside a workflow script fed over SSH stdin needs `</dev/null`** — `exec -T` otherwise swallows the rest of the script and the job exits 0 having skipped it.

**CI on every PR (`ci.yml`):** `check` (tsc, `node --test` over `src/`, `node tests/recipes/validate.mjs`, `node --test` over `tests/`, plus a non-blocking `npm audit --omit=dev` report), `chat-e2e` (real app + throwaway Postgres + a scripted model at `ANTHROPIC_BASE_URL` drives the real chat route — 24 checks), `screenshots` (boots the app, applies every migration, PIN login, headless mobile Chromium through every key screen → `app-screenshots` artifact; a 5xx fails it). Green CI is advisory — branch protection is not enabled (free plan); the PR flow is by convention.

**All 18 workflows** (`.github/workflows/`): `deploy.yml`, `ci.yml`, `migrate-on-push.yml` (+ `.github/migrate`), `migration.yml`, `backup-drill.yml` (+ trigger), `server-diagnostics.yml` (SSH diagnostics incl. provider env + backup state), `recommend-logs.yml` (+ `.github/recommend-logs-trigger` — **the first tool for any production report**: recommend error/guard lines, `[explore-agent]` lines, last 10 brewed recipes with Acaia reach times, actual-vs-promised per method, every OFFERED candidate of the last 30 recommendations, the last 3 start_brew pills, the OUTCOME LEDGER (rating trends); two SSH steps because GitHub refuses a single step script >~24 KB), `smoke-recommend.yml` (+ trigger — the same one live call as deploy's `smoke`, on demand), `chat-agent.yml` (+ trigger — 4 scenarios × 5 live Sonnet runs through the real chat prompt + validator; costs money, owner declines paid runs by default), `recommend-variety.yml` (+ trigger — candidate-level repetition over 20 fed-back brews; `--live` costs money), `recommend-spike.yml` (+ trigger), `verify-cache.yml` (+ trigger — proves the /recommend prompt cache hits), `loading-insights-refresh.yml` (monthly insight agent), `translate-flavor-notes.yml` + `field-zones-remap.yml` (one-shot admin triggers), `ios-testflight.yml` (monthly rebuild), `ios-bootstrap.yml`, `ios-dev-cert.yml`. Push-triggered diagnostics fire on the BRANCH push too — read a readout from the branch run, never merge just to get data; merge a workflow change only after its branch run is green.

---

## Project Structure & Key Files

### Pages (`src/app/`)

Every route lives in the **`(light)` route group** (BTTS Light theme — cream base, Fraunces/Chivo, anthracite foreground, generative Field background) under `LightShell` (`(light)/layout.tsx`, sets `[data-light-scope]`). The segment is URL-invisible.

| Route | Purpose |
|-------|---------|
| `(light)/page.tsx` | Home — welcome haiku (`/api/greeting`), Action Pill (Brew-Again candidates), inline AI chat over `/api/explore-agent` |
| `(light)/past-conversations[/[id]]` | Archived chat threads (list + read-only replay) |
| `(light)/brew/new` | The brew flow — routes `flowStore.step` to `LightStep*` (mode → scan → context → recommend → brew → log → summary) |
| `(light)/brew/[id]` | Read-only session detail: 2×2 stat grid (Dose/Grind, Water/Temp), notes, taste, reasoning; Field from `lib/field/cache.ts` |
| `(light)/coffees` | Coffee library (search, bag-photo cards, Brew CTA gated on `inRotation`); offline read path + inline recipe picker |
| `(light)/coffees/[id]` | Coffee detail: Field, rotation toggle, Brew CTA, `CoffeeCoachCard` (reads `coffees.coach_insight`), rating history, brew signatures, All-brews list |
| `(light)/coffees/drip/new` + `drip/[id]` | Single-serve drip-bag scan/log + detail (isolated `drip_bags` table, never in the AI corpus) |
| `(light)/cafes`, `cafes/place/[slug]`, `cafes/coffee/[id]`, `cafes/map` | Café Library (tabs), café detail + visit log, coffee tasted out, "Nearby" Leaflet map (warmed Positron tiles) |
| `(light)/taste` | Taste profile: avg rating header → **Coach** (two-stage insight queue) → **What you brew** (FlavorWheel, trends, "What works for you" findings) |
| `(light)/login` | Passkey (WebAuthn) + PIN fallback + reset |
| `(light)/onboarding` | **Deprecated** — nothing routes to it; the profile is code-canonical |
| `(light)/offline` | Service-worker document fallback |
| `layout.tsx` / `loading.tsx` | Root layout (PWA meta, vendored fonts via `src/app/fonts.css`, `<ScrollContainer>`, ChunkLoadError self-heal) / cream loading state |

### API Routes (`src/app/api/`, 51 `route.ts` files)

**The cookie gate is `src/middleware.ts`, not the route files.** Its matcher covers every path except `_next/static`, `favicon.ico`, `sw.js`, the SW helpers, `manifest.json`, `icons`, `screenshots`; `PUBLIC_PATHS` exempts exactly `/login`, `/api/auth`, `/api/research`, `/api/admin`, `/api/loading-insights` — and each of those enforces its own auth (`CRON_SECRET` bearer or `requireAuth`). Everything else needs a valid `cf_session` JWT cookie or gets a **307 to `/login`** (an API caller sees HTML). Reading a route's own file tells you nothing about whether it is public.

| Route | Purpose |
|-------|---------|
| `auth/*` | WebAuthn challenge/login/register/logout/status/reset-passkey. `register` is allowed only with no stored credential (first run / after reset) or a valid session — an unauthenticated register used to be an account takeover. |
| `sessions`, `sessions/[id]` | ★ Core CRUD. POST creates/merges the `coffees` row via `coffeeKeyFor(roaster, name)` — the shared slug; zod-schemas with **compile-time parity guards** so a new `BrewLog`/`TasteResult`/`CoffeeIdentity` field can never again be silently stripped. A rated home save kicks the coach regeneration. |
| `sessions/previous` | Previous HOME brew of this coffee + last 5 ratings — the Log screen's "Last time with this coffee" card and the better/same/worse verdict (`result.vsPrevious`) |
| `coffees`, `coffees/[id]` | Library GET / **POST standalone creator** (idempotent merge, never overwrites; id = `coffeeKeyFor`) / GET-PUT-DELETE |
| `coffees/[id]/insight` | Per-coffee coach card (`coffees.coach_insight`; regenerates only while status is `new`/`doesnt-apply`) |
| `coffees/compact` | CRON_SECRET batch summarizer (Ofelia, Mondays): `writtenSummary` + `whatToExplore` per bag via Haiku |
| `recommend`, `recommend/start` + `recommend/status` | ★ 2 recipe candidates for a coffee + context. Served as a **background job** (`start` → in-memory `jobStore`, 10-min TTL → `status` polling) so a backgrounded iOS PWA cannot kill it; the sync POST is a back-compat wrapper. Engine: `src/lib/recommend/run.ts` → `src/lib/claude/recommend.ts` (see lib). **Opus by default**, Mistral opt-in. Logs `[recommend] usage in=… out=… calls=N candidates=N`. |
| `explore-agent` | ★ The home chat — Sonnet tool loop. Prompt + tools in `src/lib/chat/agentPrompt.ts`, per-turn context in `agentContext.ts`. Data tools: `search_places`, `fetch_page`, `analyze_image`, `lookup_recipe`, `suggest_navigation`. Terminal action tools → tap-to-act pills: `start_brew` (exact recipe → brew timer; runs `cleanChatRecipe` + `validateRecipe`, ONE repair round, else no Brew button; id gated by `resolveStartBrewTarget` against the ids the turn offered), `remember_advice` (→ `/api/insights` + the coffee's `coach_insight`), `add_coffee` (→ `POST /api/coffees`, bag photo attached server-side). Nothing is written until the user taps. Every accepted/rejected start_brew and every `lookup_recipe` is logged `[explore-agent] …`. Emoji stripped from the SSE stream (`chat/stripEmoji.ts`, arrows + ✓ pass). |
| `analyze-bag`, `analyze-url` | Vision / page-scrape → coffee identity; tasting notes returned in English. Follow-up questions are deterministic client-side (`lib/scan/clarifications.ts`). |
| `brew-insight` | Post-brew 1–2 sentence Haiku line (≤40 words, `clipToSentences`); reuses `/recommend`'s Escher terrain (`Recommendation.terrain`) as clipped background; the Log screen prefetches it on Save (`flowStore.pendingInsight`, keyed by `insightRequestKey`) |
| `coach-question` | Post-rating micro-dialogue (Sonnet) on three ambiguity signals (≥20 % timing over/under-run, bitter-at-low-rating, muddy-at-high-rating); never repeats an answered question (`isRepeatQuestion`); the answer reaches the coach line and `/recommend`'s MEASURED BREW FEEDBACK block |
| `insights` | ★ Coach observations over the corpus (Mistral Large, Opus fallback). GET = cache-aware regeneration + list; PATCH advances the two-stage status (`new` → trying/confirmed/doesnt-apply; `trying` → confirmed/doesnt-apply/snoozed +7 d); POST = chat-authored note written to the insights row AND the coffee's `coach_insight` (two copies, statuses NOT synced). `source='user-confirmed'` rows are never deleted by regeneration. |
| `greeting` | Haiku daily starter, time-of-day aware, rotation bags + MEASURED CONTRAST findings; cached client-side by (date, bucket), cache key `brewlog.starter.v10` — bump it on any prompt change |
| `taste-summary`, `roasters[/generate]`, `preferences`, `places`, `cafes`, `cafe-visits[/[id]]`, `drip-bags[/[id]]`, `upload` (→ Hetzner S3, paths `bags/`/`uploads/`), `voice/synthesize` + `voice/transcribe` (ElevenLabs; `tag_audio_events=false`) | Supporting CRUD / AI helpers |
| `conversations`, `[id]`, `active`, `archive`, `cleanup` | Chat persistence; `cleanup` = Ofelia daily, deletes ARCHIVED conversations >7 days, never the live one |
| `live-activity/start` + `end` | iOS Live Activity push backend (APNs pushes each brew step while the phone is locked) |
| `loading-insights` + `loading-insights/refresh` | Recipe-wait insight pool (defensive GET → `[]`) + the monthly CRON_SECRET insight agent with a deterministic gate (`lib/insights/loadingInsightLint.ts`). Full reference `docs/loading-insights.md` |
| `research` | Deep-research agent — **dormant** (cron removed 2026-08-18; nothing reads what it wrote) |
| `admin/seed`, `admin/prewarm-coffee-insights`, `admin/translate-flavor-notes`, `admin/remap-field-zones` | CRON_SECRET one-shots |

### Components

**Flow steps (`src/components/flow/`):** `LightStepMode`, `LightStepScan` (★ camera/photo/URL/manual + AI extraction, the biggest step), `LightStepContext` (occasion ×6 incl. Summer Time + Cold Brew, amount presets Small 350 / Big 450 / Custom / Surprise, Time Normal/Special, goal ×6, method lock incl. the manual-only "V60 + Drip Assist", coach reminder pill), `LightStepRecommend` (candidates + `CraftingStatus` + rotating insight deck; `selectedCandidateIdx` is the brewed-candidate identity), `LightStepBrew` (★ timer + step-by-step pour guide: `LivePourSequence` for percolation, `StepGuide` for immersion; every pour card shows "N g in S s", counts "Stop pouring in", then a Wait card; live Acaia `CoachCue` from `coachFlow` with a tare baseline captured ONCE at Start; wake lock; haptics; Live Activity), `LightStepLog` (flavor wheel, sensory axes incl. astringency, rating, "Last time with this coffee" + better/same/worse, "What held it back most?" incl. "The recipe", coach question), `LightStepSummary` (save, pour analysis card, insight card; offline queue), `ScalePanel`, `ColdBrewSteep`, `BlendComponentsEditor`.

**Light UI primitives (`src/components/ui/light/`):** `LightShell`, `LightFlowShell` (Field rotates 25° per step), `Field` + `FieldBlobs` / `FieldGrain` / `FieldBloom` (the living background — see `docs/liquid-design.md`), `HaikuStarter`, `LiquidHeadline`, `CraftingStatus`, `Hero`, `Card`, `Section`, `Footnote`, `Chip`, `CTA`, `CTAWarmth`, `ActionPill`, `ChatInput`, `ChatThread`, `AttachmentSheet`, `NavigationOverlay`, `ReferenceCoffeePicker`, `StarRating`, `CircularTimer`, `CoffeeBeanGlow`, `ConnectionStatus` (offline/syncing pill, owns the save-queue flush), `BagPhoto`, `RecommendJobWatcher`.

**Shared (`src/components/ui/`):** `Button`, `FlavorWheel`, `BrewMethodIcon`, `NumberStepper`, `PhotoUpload`, `PlaceSearch`, `ProgressDots`, `StarRating`, `ThinkingDots`, `WaveformBars`. **Layout:** `ScrollContainer` (the real scroller — reset it, not `window`), `BottomSpacer`. **Session:** `SessionCard`. **Cafés:** `CafeMap`. **Coach:** `CoachCard.tsx` exports `CoachCard` + `CoffeeCoachCard`. **Native:** `NativeWidgetBridge`.

### `src/lib/` — what each module owns

**AI providers & prompts**
- `ai/recommendProvider.ts` — the ONLY place that picks the /recommend model: **Opus default**, `RECOMMEND_PROVIDER=mistral` opt-in, Mistral error → Opus. `callAnthropic` sets NO sampling parameter (`claude-opus-4-7` 400s on `temperature`; pinned by `tests/dataflow/recommend-request-shape.test.mjs`).
- `ai/coachProvider.ts` — the ONLY place that picks the coach model: Mistral Large when `MISTRAL_COACH_API_KEY` is set (own "BrewLog-Coach" workspace), else Opus; `COACH_PROVIDER=anthropic` forces Opus.
- `claude/recommendPrompt.ts` — the /recommend SYSTEM_PROMPT (cached). Carries NO recipe numbers (concrete recipes come only from the per-turn user message), the NICHE° GRIND REFERENCE pinned to `grindSettings.ts` by `tests/dataflow/grind-reference-consistency.test.mjs`, a GENERATED Comandante block, vessel limits mirrored from `VESSEL_CAPS`. Internal contradictions pinned by `tests/dataflow/prompt-contradictions.test.mjs` + `prompt-facts.test.mjs`.
- `claude/recommend.ts` — ★ `generateRecommendation()`: assembles the user message (roaster prior, coffee history, COACH INSIGHTS with verdict labels, MEASURED BREW FEEDBACK, MEASURED GRIND, MEASURED POUR PACE, knowledge layer, own references, method freshness, convergence arc, repeat rule up front), ONE model call + at most ONE merged repair call (repeat guard + convergence check together), then the deterministic guard chain: `guardRecipeFidelity` → `stripMinimalAgitationSwirls` → `applyPourDurations` → `enforceRecipePhysics` → `guardVesselCapacity` → `guardVolumeTarget` → `stripProactiveDripAssist` → `calibrateDrawdownClock` → long-gap guard → `guardSpecialTime` → `normalizeGrindToGrinder`; `pourSequence` is DERIVED from `pourSteps` after sanitation and again after the chain.
- `claude/convergence.ts` — the rating of the LAST brew of this coffee decides candidate 1: ≥4★ → reproduce it with EXACTLY ONE change (checked deterministically, one repair); <4★ → a different brewer family or reference; slot 2 is always exploration.
- `claude/repeatGuard.ts`, `menuBinding.ts`, `methodRotation.ts` — candidate-level repetition guard (free-form candidate on a family offered ≥2 of the last 4 → repair), menu binding, METHOD FIT & FRESHNESS (tie-scoped demotion, never a ban).
- `claude/recipeFidelity.ts` — per-field snap of a drifted candidate back to its VERIFIED `basedOn` reference, only within ±20 % of the published water (`recipe/batchWindow.ts`), only when the brewer family + Orea bottom match (`brewerMatchesReference`); temperature judged against the published range; large-batch grind guard (+20°/doubling, grind only); Drip-Assist +5° offset; clicks converted via `grindUnit`.
- `claude/ownReferenceRecipes.ts` (the owner's ≥4★ brews as a BASELINE TO BUILD ON, category-spread), `measuredGrind.ts` (MEASURED GRIND block — reported, never enforced), `insightsBlock.ts` (coach rows ranked confirmed → trying → new, labelled), `coachPriors.ts`, `insights.ts` (coach orchestrator; `serialiseSessionForCoach` carries every sensory axis), `coffeeInsight.ts`, `escher.ts`, `insightTerrain.ts`, `extractor.ts`, `patterns.ts`, `brewSignature.ts`, `historyUtils.ts` (`buildTimingStats`, `buildHistorySummary` → loading-insights only, `buildMeasuredFeedback` → /recommend, `recentReferenceNames`), `userProfile.ts` (`CANONICAL_PROFILE` + `formatProfileForPrompt` — consumed by the chat ONLY), `coffeeLibrary.ts`, `sessionCorpus.ts` (`loadRecentSessions(n)` — server-side reads; chat 20, recommend 400), `analyzeBag.ts`, `parseJson.ts`.

**Chat (`chat/`)** — `agentPrompt.ts` (★ prompt + TOOLS), `agentContext.ts` (per-turn blocks: library with `[id:…]` for up to 200 bags, Reference Recipe INDEX (cached, ~19k chars), `buildRecipeShortlist` (today's angles + full text of those recipes), measured context, coach rows, `cleanChatRecipe`), `recipeLookup.ts` (`lookup_recipe`), `todaysAngles.ts`, `measuredContext.ts`, `chatClock.ts` (the Brew pill's clock = pours + measured drawdown, ±15 s), `chatBrewTarget.ts`, `addCoffee.ts`, `stripEmoji.ts`.

**Recipe engine (`recipe/`, `brew/`, `utils/`)** — `recipe/validateRecipe.ts` (★ the shared validator: checks the RENDERED timeline — pourability ≤8 g/s, dead gaps >75 s, clock vs drawdown, grind unit, disc offset, reference drift, batch window, vessel capacity; used by the chat, mirrors /recommend's guards), `recipe/scaleRecipe.ts` (ratio/count/rests hold; pour rate ×√k capped 8 g/s; grind +20°/doubling; drawdown ×√k — see `docs/coffee-experts.md` §4b), `recipe/pourDurations.ts` (the APP sets pour seconds: verified reference keeps its scaled times, else `housePourSec` at the owner's measured pace; rests are never eaten), `recipe/enforceRecipePhysics.ts`, `recipe/batchWindow.ts` (`REFERENCE_BATCH_WINDOW = 0.2`), `brew/drawdown.ts` (clock = pour end + median of the owner's MEASURED drawdowns for that brewer family + volume, else the corpus median), `brew/pourPace.ts` (`measuredPourPace` reads ONLY `flowAnalysis.avgPourRateGPS` — grams ÷ the hand's pouring time; `avgFlowRateGPS` includes the rests and must never be used for this), `brew/timeline.ts` (★ `buildBrewTimeline` — the single intended-flow normalizer; `buildPourSchedule` is CADENCE-FIRST: every step keeps its authored time, the bloom shifts by roast age, the drawdown is what the clock has left), `brew/flowCoach.ts` (per-recipe pour-rate targets; rate verdicts off under the disc), `brew/flowAnalysis.ts` (post-brew: steadiness, overshoot, `rejectNonPourJumps` with an 8 s return window), `brew/previousBrew.ts`, `brew/insightKey.ts`, `utils/pourSequence.ts` (pure pour math; `isSetupAction` never classifies drain/press/flip/bypass as setup), `utils/pourSteps.ts` (shared sanitizer + `derivePourSequence`), `utils/resolveRecipe.ts` (`resolveBrewedRecipe` — the SELECTED candidate, never `primaryRecipe`), `utils/vesselCapacity.ts` (`VESSEL_CAPS`, owner-measured: AeroPress ≤230 · Clever ≤450 · Origami ≤500 · Kalita ≤450 · Orea ≤450 · V60 ≤550 · Chemex 350–750 · Moccamaster 500–1000 · cold-brew jar ≤1000 — the single source for UI chips, prompt and guards), `utils/grindUnit.ts` (Niche° ⟷ Comandante clicks, anchors 380°=23 / 400°=29), `utils/brewMethodKey.ts` (brewer-family key; disc stays part of it; Origami wave vs cone separate; all Orea bottoms pool), `utils/agitationGuard.ts`, `utils/dripAssist.ts`, `utils/timeBudget.ts` (`SPECIAL_MAX_SEC` 180).

**Knowledge (`knowledge/`)** — `recipes/` (★ the structured corpus: championship / reference / experimental, incl. 10 Orea V4 Wide recipes and 8 cold-brew steeps; every entry has a full pour sequence, attribution, sources, `verified` flag; NO staged-temperature recipes; `scoreRecipe` hard-partitions cold brew and iced; `selectRecipes` = one-per-brewer best-fit portfolio with `pickRepresentative` rotation, occasion affinity, goal +3 / variety +1, method lock = best N for that brewer, serve-volume filter from `VESSEL_CAPS`, references only within ±20 % of published water; `tests/recipes/validate.mjs` enforces technique cross-refs both ways, occasion tags, minimal-agitation shape, one WBrC champion per verified year, pour rate ≤12 g/s, plan reaches water), `varieties/` (~25 WCR-grounded priors), `techniques/` (25 atomic moves citable by id). Human mirrors: `docs/coffee-experts.md` (current), `docs/recipes-full.md` (stale, predates the experimental additions). Count the corpus with the validator, never from memory.

**Other** — `field/` (generative Field: 7-zone palette incl. the one cool `cool-berry` BLUE zone for berries, `composeGradient.ts` directional composition, `curatedFields.ts` general backgrounds, `mapNotesToZones.ts` Haiku mapping, `FieldContext.tsx`), `roasters/priors.ts` (50+ roaster style priors), `constants/grindSettings.ts` (★ the per-method Niche° default table; only V60 is measured, the rest are estimates), `coffee/coffeeKey.ts` (★ `coffeeKeyFor` — both writers must use it or one bag forks two rows), `coffee/freshness.ts` (the ONE bean-age classification), `coffee/blend.ts`, `coffee/roastDate.ts`, `coach/questionRepeat.ts`, `taste/brewContextInsights.ts` ("What works for you" — conditional per origin×process segment, reads the dials the user ACTUALLY used, water as a separator, silent when nothing clears the bar), `scan/clarifications.ts`, `scan/translateNotes.ts`, `storage/` (`s3.ts`, `idb.ts`, `offlineLibrary.ts`, `saveQueue.ts` — offline re-brew + queued saves), `native/` (iOS bridges, all feature-detected, no-ops on the PWA: `brewNotifications`, `brewHaptics`, `liveActivity*`, `widgetBridge`/`widgetDeepLinks`, `geo`, `acaia/` — the ported Beanconqueror scale protocol; never reconstruct it from memory), `health/healthsyncPush.ts`, `coldBrew/coldBrew.ts`, `audio/listeningCue.ts`, `craftingPhases.ts`, `heroQuestions.ts`, `coffeeHints.ts`, `insights/loadingInsightLint.ts`, `recommend/run.ts` + `jobStore.ts`, `auth/`, `db/` (`schema.ts`, `client.ts`, `helpers.ts`), `types/`, `theme/gradients.ts`, `utils/cn|safeFetch|formatTime`.

### Other key files

| File | Purpose |
|------|---------|
| `src/store/flowStore.ts` | ★ Zustand brew-flow state, localStorage-persisted (survives a mid-brew reload; "New Session" calls `reset()`) |
| `src/hooks/` | `useOnline`, `useWakeLock` (iOS shell via the app-local `ScreenAwake` plugin, Web Wake Lock fallback), `useVoiceCapture` / `useVoicePlayback`, `useAcaiaScale`, `useBrewStepHaptics`, `useBrewLiveActivity`, `useFieldMotion`, `usePresence` |
| `src/middleware.ts` | ★ The cookie gate (see API Routes) |
| `src/app/fonts.css` + `src/app/fonts/` | Vendored Google fonts (`scripts/vendor-google-fonts.mjs`) — `next/font/google` fetched from Google on every VPS build and broke four deploys; pinned by `tests/dataflow/fonts-self-hosted.test.mjs` |
| `scripts/` | `recommend-variety-sim.mjs`, `chat-agent-sim.mjs`, `chat-e2e-mock.mjs`, `smoke-recommend-call.mjs`, `recipe-physics-check.mjs`, `recommend-model-spike.mjs`, `generate-app-icon.py` (icon variant `orchid`), one-shot migrations (`seed-insights`, `migrate-firestore-to-postgres`, `migrate-storage-to-s3`, `rebuild-coffees-table`, `geocode-places`, `backfill-field-zones`) |
| `docker-compose.yml`, `Caddyfile`, `deploy/` (`backup.sh`, `ofelia.ini`, `README.md`), `Dockerfile`, `.dockerignore` | The VPS stack |
| `native/` | The Capacitor iOS shell (own `package.json` + lockfile — a dep change must regenerate `native/package-lock.json`); `docs/ios-shell-roadmap.md` is its working doc |

### Database (Postgres + Drizzle)

15 tables: `sessions`, `coffees`, `auth_credentials`, `auth_challenges`, `preferences`, `roasters`, `knowledge`, `coffee_alerts` (dead schema), `places` (6,202 rows in prod, loaded outside the repo), `conversations`, `conversation_messages`, `cafe_visits`, `insights`, `drip_bags`, `loading_insights`; plus `lessons` (dead schema, read by nothing). Sessions keep `coffee`/`context`/`recommendation`/`brew`/`result` as JSONB; `createdAtMs` is the indexed feed order.

Migrations `src/lib/db/migrations/0000`–`0024` (0003 absent; 0001+ applied via the marker or `psql`, Drizzle's journal only knows `0000_init`). The most recent: 0023 `coffees.variety/region/roast_level` (backfilled 55 rows → 45/48/49), 0024 one-off data fix (the 2026-10-10 15:21 chat brew → SEY Susan Meneses). The CI screenshots job applies them all to an empty DB, so every file must be a no-op there.

### Key dependencies

`next` 14.2.35 (last 14.x; 23 unpatched advisories, fixed only in 15.5.x/16 — the Next 15 migration is an owner decision, currently "wait"), `@anthropic-ai/sdk` 0.80, `drizzle-orm` 0.36, `pg` 8.13, `zustand` 5, `zod` 4.3 (strips unknown nested keys SILENTLY — hence the schema parity guards), `@simplewebauthn/server` 13, `jose` 6, `leaflet` 1.9, `@aws-sdk/client-s3` 3, `@ducanh2912/next-pwa` 10. No external UI libraries.

---

## Current status

**The chronicle is in `docs/history.md`.** State that still matters is in the rows above. Open items:

1. **Next 15 migration** — owner: wait. Until then `npm audit` runs as a report in CI and the image optimizer is off.
2. **Outcome ledger re-read** — the convergence policy (2026-10-03) and the pour-pace / clock / batch-window work (2026-10-10) are UNVERIFIED on real cups. After ~20 brews bump `.github/recommend-logs-trigger` and read OUTCOME LEDGER 2 (brew n vs n−1) before touching the recipe engine again. **Stop rule (owner-approved): no further repetition/variety fixes without re-reading the ledger first.**
3. **Measured drawdowns pool all Orea bottoms** (Fast drains ~10 s, Classic ~48 s) and the V60 drawdown median at ~400 g sits on 3 heterogeneous samples — both known noise sources in the clock, not yet split.
4. **Cost tracking Opus→Mistral** — never closed with a measured June-vs-July comparison. Clean numbers = Mistral workspace totals ("BrewLog" + "BrewLog-Coach") + Anthropic filtered by the app's production key; the org total mixes in the chat and development sessions.
5. Small UI follow-ups: `/coffees` "show only rotation" filter; inline edit for `cafe_visits.notes`; a possibly stale React nesting warning on `/coffees` (re-verify in a browser console before chasing it).
6. `docs/recipes-full.md` and parts of `docs/coffee-experts.md` lag the corpus.

**Permanent gaps / by design:** photos scanned before the `bags/` convention have no `bagPhotoUrl`; background step alerts on the Safari PWA are missed (the iOS shell covers it with Live Activity pushes + haptics); single-user; knowledge base needs `node scripts/seed-insights.mjs` on a fresh install; the Apple Watch app is RETIRED (2026-08-29) — do not rebuild it; the app is NOT cream/bland — the Field is a saturated full-bleed gradient on every screen, never call the palette cream-dominant.

---

## Partnership Rules

- **Flag proactively.** If something is inefficient, insecure, or messy — raise it. The user is non-technical and cannot spot these on their own. Flag once, explain the trade-off plainly; if the fix is safe and revertible, do it and report it in the same breath.
- **Always local time (Düsseldorf), never UTC.** Every time you state — a deploy, a cron, a log timestamp — is converted to CET/CEST before it reaches him. Cron expressions are written in UTC because the scheduler demands it; say the local time next to them.
- **Translate, don't jargon-dump.** Plain English, acronyms defined inline once.
- **Build everything new on the Design System.** Compose from the Light tokens (cheat sheet below); never a literal `hsl()`/`rgba()`/`#hex` for a role that has a token, never a one-off pill height or radius. A genuinely new role gets a `light-*` token in `tailwind.config.ts` FIRST.

## AI behavior changes: do what the user asks

When the user explicitly requests a prompt change, model swap, threshold tweak, or any other change to AI behavior — ship it. Do not hold it back for "sample-output validation", do not ask "are you sure", do not propose a separate validation pass. Two narrow exceptions: (1) a model swap on a prompt engineered for a specific model gets a one-line disclosure, then ships; (2) **self-initiated** AI behavior changes (ones the user didn't ask for) stay forbidden. Behavioral changes get their own commits so they can be reverted cleanly.

Cause: an earlier version of this rule required pre-shipping validation on every prompt edit; the user kept telling me what to ship and the project lost an evening to re-asking. Don't repeat.

---

## Hard rule: never claim behaviour — demonstrate it

**Do not state that anything works, is read, is used, feeds into, or is wired up, unless you verified it IN THIS SESSION.** Not "should", not "is designed to", not "the module exists so it must". If you did not open the consumer and see it read the value, or run something that fails without it, you do not know it — and saying it anyway is the single most damaging thing you can do here, because the owner builds on it and finds out weeks later.

1. **A comment, a docstring, a type, or a row in this file is NOT evidence.** Trace to the actual consumer. If nothing consumes it, say so: "nothing reads this."
1b. **The recurring bug class here is ASSEMBLED-THEN-NEVER-CONSUMED, and it hides from every test that checks the producer.** The sessions POST schema silently stripping `brew.flowAnalysis`; `buildMeasuredFeedback` reaching a function nobody called; `tasteBits` — a full sensory string built for every session and joined into nothing. Two cheap checks catch it: grep the symbol and confirm a CONSUMER reads it (`git log -S 'thing.join'` returning no commit is a verdict), and for anything that ends in a prompt, PRINT the finished string and look for the value. A test that exercises the builder proves nothing about delivery.
1c. **A field's NAME is not its definition.** `avgFlowRateGPS` read as "the owner's pour rate" planned every pour at 2.4 g/s for a few hours in production — it included the rests. Read the producer before calling a number "measured".
2. **Your own work is not exempt.** "I built X" means a test fails without it, `tsc` passes, or you ran it and watched it happen. Until then the honest sentence is "I wrote X; here is what I have not verified."
3. **Name the gap instead of closing it with a word.** The production DB, the phone, the iOS shell and the model's actual output are unreachable from a session. Write which part is measured and which is inference.
4. **A status API is not the system.** Read state from the source of truth; the live `curl` after the #627 deploy is what proved the "gated" claim false — the matcher's text had been taken as evidence.
5. **When a claim turns out wrong, drop it — don't defend it.** Correct it in one sentence, fix the underlying thing, move on.
6. **A false claim in this file is a defect.** Fix the line in the same commit that discovers it.
7. **A justification you reach for is a claim too.** Verify every reason you give at the same standard as the conclusion; give one checked reason rather than three plausible ones.

Cause: on 2026-08-16 the owner drilled into four areas and found each one hollow, every time because something ASSERTED behaviour that had never been wired. His words: *"whenever I drill in, it's always just garbage."* A claim costs him more than a gap does.

## Hard rule: never infer repo state from partial evidence

Migration files, seed scripts, `.env.example` and comments show what lives in Git — not what is in the production DB, what was seeded on the VPS, or what happened outside the repo.

1. **Never quote a row count or dataset size from a migration file.** Say "for the real count run `SELECT count(*)` on the VPS" (or read it off `recommend-logs.yml` / the backup drill, which print real counts).
2. **Search broadly before answering** "X doesn't exist": `scripts/`, comments, `meta/_journal.json`, data files.
3. **Mark inference as inference** — "no evidence in the repo", never an assertive claim.
4. **Flag your own inconsistencies immediately** and re-verify.
5. **When the user pushes back, do not defend.** Re-open the search, surface the path that misled you, correct cleanly.

Cause: claimed "~33 cafés" from counting INSERTs in migrations when the production `places` table holds 6,202 rows loaded outside the repo.

## Hard rule: never fabricate parameters or facts — research before stating

A "fabricated parameter" is any specific value, number, or product claim stated without a named, in-session-verified source. Zero tolerance:

1. **Recipe parameters** for any named method or expert: fetch or quote the actual publication. Never reconstruct from memory.
2. **Hardware facts** (burrs, dial scales, clicks, ppm, geometry): look up the spec. The Niche Zero has 63 mm **conical** burrs.
3. **Quantitative extrapolations**: no invented slopes, interpolations or timing estimates. Without a published slope, say so and measure.
4. **The codebase is NOT a source.** A number in a `*.ts` file is downstream of real sources; if it disagrees with the publication, the codebase is wrong.
5. **Aggregators are NOT primary sources** — index pointers only; never enough for `verified: true`.
6. **`verified: true` means content-cross-checked in-session** against the originator's own publication. YouTube blocking WebFetch is a reason to keep an entry unverified, not to mark it verified.
7. **Peer-data audit when adjacent data is changed** — fix one entry by an author, check the author's others.
8. **Retroactive audit when a Hard Rule is enacted.**

When in doubt: **"I don't know — let's measure"** or **"let me look that up first."** No "~", no "around" — hallucinations wearing humility costumes.

Cause: the May 2026 calibration session reconstructed Hoffmann's 1-Cup from memory (wrong pours, temperature, time), invented a burr-geometry explanation, and proposed grind shifts with no source; a follow-up audit found 18 of 19 named-expert entries disagreeing with the originator and 8 that were different recipes wearing the author's name.

---

## Conventions

### Code
- **TypeScript strict** — no `any`, no `@ts-ignore` without comment. **Tailwind only** — no inline styles except `safe-area-inset-*` and the lib gradient exception. **No external UI libraries.** **Refs over state** for timers/callbacks; accurate `useCallback` deps.
- **Tailwind scans only `src/{app,components,pages}`** — class strings that live solely in `src/lib` are never generated. Export a raw CSS value and apply it inline (`src/lib/theme/gradients.ts`).
- **Nothing may extend past the viewport, and every `overflow-y-auto` box needs `.scroll-y-only`.** `overflow-x: hidden` still makes a draggable scroll container in WebKit; `overflow-y: auto` promotes the other axis to `auto`. Don't use `overflow-x: clip` (computes back to hidden) or a blanket `touch-action: pan-y` (breaks the chip carousels).
- **Continuously iterated `@keyframes` live co-located in the component** (`<style jsx global>`), never in `globals.css` — the installed PWA serves a stale cached stylesheet. **No `filter: blur()` on the Field discs** (85 % of raster cost for nothing visible). Rest-state `filter: none` on animated inline-block words or Fraunces descenders clip. See `docs/liquid-design.md`.
- **Zod schemas on every POST**, `deepStripNulls()` before parsing; the sessions schema has compile-time parity guards — extend the schema when a Session sub-type gains a field.
- **Never import from `app/api/*/route.ts` in client components**; shared types in `src/lib/types/`.
- **A shared CTA forwards its click event** — `onNext={handleDone}` once passed a SyntheticEvent as `actualTimeSec` and broke saving; wrap or coerce.
- **Never assume a Capacitor plugin's return shape**, and a Capacitor npm plugin in `package.json` is not necessarily linked into the iOS binary — app-local, explicitly registered plugins are the reliable pattern.

### Database
- **BEFORE any UPDATE/DELETE/migration: COUNT first.** Target rows by id or a precise condition; never reset a column broadly to fix one row; write migrations with a 0-row no-op and a >N-row abort.
- JSONB for nested objects; `createdAt` + `createdAtMs`; upload paths start with `bags/` or `uploads/`; numerics inserted as `String()`.

### AI models
- `claude-opus-4-7` — `/recommend` (default; Mistral opt-in). No sampling parameter.
- Coach (`insights`, `coffeeInsight`) — Mistral Large when `MISTRAL_COACH_API_KEY` is set, else Opus.
- `claude-sonnet-4-6` — explore-agent (the chat), analyze-bag, escher, coach-question, loading-insights/refresh.
- `claude-haiku-4-5` — brew-insight, taste-summary, analyze-url, coffees/compact, roasters/generate, greeting, mapNotesToZones, translateNotes, research (dormant).
- **Any change to a model call — parameters, model id, provider, prompt structure — is unverified until a real request has been made.** A green test suite says nothing about it; the post-deploy `smoke` job is that request.

### Git / Deploy
- **"Done" means merged to `main` + the Deploy run (incl. `smoke` and `verify-domain`) green + live on the phone.** Feature branch → PR → squash-merge. Use `gh api` REST (GraphQL and `gh pr …` are blocked here; draft→ready and auto-merge go through the `/ccr/` routes; auto-merge needs branch protection, which is off — merge with `PUT …/pulls/N/merge merge_method=squash` after CI is green).
- **Read CI/deploy state from the RUN or JOB endpoint** (`actions/runs/<id>/jobs`), never from a commit's `check_runs` (lags) and never via `curl api.github.com` (no token → empty forever).
- **After a squash merge the local branch is stale** — `git checkout -B <branch> origin/main` for the next change.
- **A workflow change is merged only after its branch run is green**; `.github/**` edits do not deploy.
- Commit messages: imperative, lowercase prefix (`fix:`, `feat:`, `docs:`, `build:`, `ops:`, `migrate:`). `npx tsc --noEmit` before every commit. No staging — merged = live within minutes.
- **Never push doc-only commits to `main` on their own in quick succession** — every `main` push deploys and rotates chunk hashes; the PWA's service worker can strand a client (now self-healing, still wasteful).

### Light design tokens (cheat sheet)
- `text-light-foreground` (anthracite), `text-light-muted-foreground` (near-black 16 %), `text-light-text-on-dark` (the ONE cream for dark elements), `bg-light-card-default` (cream glass 55 %), `bg-light-card-selected` (taupe — non-button surfaces only), `bg-light-surface` (opaque cream), `bg-light-destructive`, `light-accent-overtime` (amber), `light-scrim`, `shadow-light-card-pressed`, `shadow-light-float`, `backdrop-blur-light-card backdrop-saturate-150` (the canonical glass pair — never `backdrop-blur-[14px]`).
- **Selected state = anthracite FILL** (`bg-light-foreground text-light-text-on-dark shadow-light-float`); `Card` carries `group` so children flip via `group-aria-pressed:`; custom children inside a selectable `Card` must add that variant themselves.
- **Home chrome is all-dark + lifted** (burger, `+`, chat bar, Action Pill); in-bar buttons invert to cream-on-dark; photo-hero buttons and pop-over surfaces stay cream glass.
- **Hero:** `font-fraunces font-semibold text-[40px] leading-[1.05] tracking-[-0.01em]`. **Headline:** `font-fraunces text-3xl leading-none`. **Wordmark:** `Better taste<br />than sorry.` identical on Home + Login. **Eyebrow:** `text-xs tracking-widest` uppercase. **Chip:** `default` (`px-4 py-2 text-[13px]`, a pick-one primary control) vs `sm` (`px-3 py-1.5 text-[12px]`, multi-select/dense/secondary); never mixed on one row. **Primary CTA:** `w-full h-14 rounded-full bg-light-foreground text-light-text-on-dark font-semibold active:scale-[0.98]`. **Gutter:** `px-5`. Photo scrim: `gradientCreamScrim` from `@/lib/theme/gradients`.

### Voice & tone
`docs/voice-and-tone.md` is the rubric for every UI string and every AI prompt: knowledgeable friend, pragmatic, editorial; no apology, no "please", no emoji, no exclamation marks, no HTTP codes user-side; verb-the-action buttons; present-progressive loading copy; American English.

### iOS PWA gotcha
iOS caches `apple-mobile-web-app-status-bar-style` at install time. After any deploy, **force-quit and reopen the PWA** to drop the cached shell; a service worker is per-origin, so a fresh tab does not bypass it.

---

## Explicitly NOT Wanted

- No token usage logging. No Zod `.transform()` that produces `undefined`. No external component libraries. No changes to unrelated files when fixing a bug. **No emojis in UI or AI output.** No separate "total" row in pour tables (drawdown end = done). **No temperature-for-timing advice** (grind fixes timing; temperature is extraction chemistry). No Vercel. No `npm run dev` assumptions (tested on the deployed PWA).
- **No rebuilding the Apple Watch app** — retired 2026-08-29 after builds 8–20 never achieved reliable background haptics and drained the battery.
- **Never re-suggest:** pour auto-advance from the scale, widget photos, roast-freshness nudges, coffee alerts, status-bar styling, a hybrid Opus/Mistral split, family-grouping the Orea bottoms / Origami filters, re-raising the Wendelboe / Harris / Rojewska / Douglas corpus decisions (closed by the owner).
- **No deterministic "physics" rule from grind / temperature / water hardness / geometry to drain time** — no cited source gives a slope; those factors reach the clock through the owner's MEASURED drawdowns. No hard temperature/grind validators (verified recipes sit outside the prompt's own windows).
- **Don't falsify recipes to fit a device** — a verified reference keeps its own scaled pour times and drawdown; the fix for an unsuitable recipe is not to offer it.

---

## iOS shell (Capacitor remote-URL shell → TestFlight)

**Working doc: `docs/ios-shell-roadmap.md`** — read its "Status & next entry-point", the latest session-log entry and the Stolperstein log before touching `src/lib/native/`, `native/`, or `.github/workflows/ios-*`. Shipped and owner-verified: lock-screen step notifications, Taptic haptics, Acaia BLE scale, two home-screen widgets, Live Activity with APNs step pushes, Share Sheet, Siri/Action-Button voice chat, app-local `ScreenAwake` wake lock. Builds run ONLY through `ios-testflight.yml` (fire it by bumping `.github/ios-build-trigger`); the owner never touches a Mac or a terminal. Every advancing session updates that doc in the same commit.

## Liquid / motion design

**Working doc: `docs/liquid-design.md`** — the dials table ("to change X, edit constant Y in file Z") before any "bigger / slower / stronger" request, and its top rule before debugging "motion is dead in the PWA". Touch points: `Field*`, `HaikuStarter`, `LiquidHeadline`, `useFieldMotion`, `usePresence`, `composeGradient.ts`.

---

## User / Equipment Profile

| Device | Details |
|--------|---------|
| **PRIMARY** | V60 size 2 |
| Other | Orea V4 Wide (Apex / Classic / Open / Fast bottoms — separate brewers, never grouped), Origami Air M (resin; takes V60 cone AND Kalita wave filters — separate keys), Clever Dripper, Kalita Wave, AeroPress, Moccamaster, Chemex |
| **Pour-control disc** | Hario Drip Assist — owned, **used very rarely, never automatically.** Owner (2026-10-10): *"nicht nie, aber mega selten. Nicht automatisch — nie. Nur aktiv per Hand in der manuellen Selektion."* The ONLY ways it enters a brew: he picks "V60 + Drip Assist" by hand in the method picker, or he says in a chat conversation that he is brewing with it. `/recommend` strips any disc candidate he did not lock (`stripProactiveDripAssist`); the chat prompt puts it on nothing unless he said so (no gooseneck ≠ disc); nothing else may set a disc method. When it IS in use: ~+5° coarser, thin drawdown, rate coaching off. |
| **Kettle** | Fellow Stagg EKG — gooseneck, precise temp control |
| **Grinder** | Niche Zero — **degree (°)** settings, continuous. Travel: Comandante C40 MK2 — **clicks** (380° = 23 clicks, 400° = 29, ~3.3°/click, owner-measured) |
| **Scale** | Acaia Lunar (2017) + Acaia Pearl — 0.1 g, old BLE protocol |
| **Water** | BWT Bestmax Premium V (bypass 0): ~370 ppm tap → **~220 ppm** daily driver · **clarity blend** 1:2 filtered+distilled = **~73 ppm** for washed florals / championship methods |

**Taste:** silky, balanced, floral/fruity, light-roast single origins; avoids anaerobic/infused/dark roasts. **Not at home: pineapple-forward coffees** — a SELECTION filter only (a bag he owns is still brewed as well as it can be; absence of a flavour in the log is NOT evidence of a dislike). Canonical in `CANONICAL_PROFILE` (`src/lib/claude/userProfile.ts`).

**Grind sources of truth:** the owner's OWN logged grind (`measuredGrind.ts`, ≥3 brews per brewer × batch) beats the per-method default table `src/lib/constants/grindSettings.ts` (mirrored for humans in `docs/grind-settings.md`; only V60 is measured, 380° single cup / 400° double); each corpus recipe carries its own published grind. The `/recommend` prompt's grind block is pinned to the constants by test. The chat reads the constants live.

### Hard rule: single-user PROJECT, not a product — no onboarding

Exactly **one user (the owner) and always will be.** No onboarding flow to rely on (the page is deprecated), no settings screen. The profile is **CODE-CANONICAL**: `CANONICAL_PROFILE` (prompt text) + `CANONICAL_EQUIPMENT` (`src/lib/knowledge/recipes/helpers.ts`, recipe-brewer filtering; `/recommend` unions it with the stored preferences so a stale DB row can never hide an owned brewer). When the kit changes, edit those constants. Don't add per-user generality. **The production DB is not reachable from a session** — work from the code, read real counts off the diagnostics workflows, and ask the owner for a live value you genuinely need rather than inventing tooling or guessing.
