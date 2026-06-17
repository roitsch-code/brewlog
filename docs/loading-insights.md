# Loading-screen insight agent

> **Source of truth:** the code under `src/app/api/loading-insights/`,
> `src/lib/insights/loadingInsightLint.ts`, and the seed `src/lib/coffeeHints.ts`.
> This doc mirrors them for humans — if a constant changes, update the code, then this file.

The recipe-creation loading screen (`LightStepRecommend`, shown while `/api/recommend`
builds the recipe) rotates short, headline-sized coffee insights in the big Fraunces-40
treatment. They used to be a **static** hand-written array (`COFFEE_HINTS`, 59 lines). This
feature adds an **agent that grows and swaps that pool automatically, ~monthly, with no human
in the loop** — while guaranteeing nothing fabricated reaches the screen.

---

## The one decision that shapes everything: full-auto, no review

The owner chose **full-auto with no human review**. The project's strongest, explicitly
carved-out rule is **"never fabricate coffee facts"** (CLAUDE.md). Those reconcile exactly one
way: the human reviewer is **replaced by a machine gate**. The owner asked for *no manual work*,
not for *fabrications* — so the review became code instead of a person, and an ungrounded line
physically cannot be inserted.

Every candidate line, from every source, must clear **both**:

1. **The deterministic gate** (`loadingInsightLint.ts`) — format + dedupe + **source-grounding**.
2. **A model claim-check** — a second cheap call confirming the line is fully supported by its
   cited source.

Only survivors of both are written.

---

## Architecture

```
            ┌─ corpus  (recipes / varieties / techniques)  → snippet = the verified entry text
 sources ──┼─ brews   (your session aggregates)            → snippet = buildHistorySummary()
            └─ web     (live web_search)                    → snippet = a model-supplied verbatim quote
                         │
                         ▼  one candidate line per snippet, grounded in that snippet
              ┌──────────────────────┐
              │ deterministic gate   │  ≤80 chars · ≤15 words · no emoji · no "!" ·
              │ (loadingInsightLint) │  dedupe · every number/proper-noun must be IN the source
              └──────────┬───────────┘
                         ▼
              ┌──────────────────────┐
              │ model claim-check    │  "is this line fully supported by its source? y/n"
              └──────────┬───────────┘
                         ▼
              insert survivors (status='live')  ·  retire oldest over the 150 cap
                         │
                         ▼
   GET /api/loading-insights  ──►  screen merges live rows + the static seed  ──►  shuffle 12
```

**The static seed is an unbreakable floor.** The screen always merges the DB pool with
`COFFEE_HINTS` and falls back to seed-only on any fetch failure (offline, error, or before the
first run). So the pool can only ever *add* to what's shown today — it can't regress or empty.

### Why each source is safe

- **corpus** — the generator is told to *restate a fact from the given snippet*, and that snippet
  is a verified corpus entry (`recipes` / `varieties` / `techniques`). Grounded by construction.
- **brews** — observations computed from *your own real sessions* (`buildHistorySummary`). They're
  facts about your data, not coffee-science claims the model could invent.
- **web** — the freshest and the riskiest. The model must attach a **verbatim quote** from a page
  it actually found; that quote becomes the grounding `sourceText`, so web rides the exact same
  gate. Residual risk (a fabricated quote) is accepted for this low-stakes surface and minimised
  by the "prefer the general principle; no numbers/names unless they're in the quote" rule — which
  the deterministic specifics-check then enforces.

---

## The gate (`src/lib/insights/loadingInsightLint.ts`)

Pure module, zero dependencies — the single source of truth shared by the agent, the read route,
the screen merge, and the CI test. `lintLoadingInsight(line, { sourceText?, existing? })` returns
`{ ok, reasons[] }`. Rejection reasons:

| reason | rule |
|---|---|
| `empty` | blank after trim |
| `too-long:<n>` | `> MAX_CHARS` (80) |
| `too-many-words:<n>` | `> MAX_WORDS` (15) |
| `emoji` | any emoji / pictograph |
| `exclamation` | contains `!` (brand voice) |
| `duplicate` | normalized form already in the `existing` set |
| `ungrounded:<token>` | a **factual token** not found in the cited `sourceText` |

**Factual tokens** (`factualTokens()`) = anything containing a digit (years, ppm, °C, ratios) +
any capitalized word that is *not* sentence-initial (a mid-line proper noun: a person, place, or
cultivar). Sentence-initial capitals are ordinary English and exempt. This is the riggel that
stops the web source from slipping an attributed specific ("Hendon's 2014 paper…") onto the
screen unless a real fetched quote backs it. (ASCII-based — a name opening with a non-ASCII
capital isn't flagged; an accepted under-catch, since the claim-check + prompt are the other two
layers.) The hand-verified seed is checked for format + dedupe only, never grounding.

`tests/dataflow/loading-insight-lint.test.mjs` bundles the real module + the real seed and asserts
(a) every seed line satisfies the mechanical contract and (b) the gate rejects/accepts as intended.

---

## Data model

`loading_insights` (migration `0018`, but the refresh route also `CREATE TABLE IF NOT EXISTS`-es
it, so it's self-bootstrapping — see below):

| column | meaning |
|---|---|
| `id` | uuid |
| `text` | the insight line |
| `source` | `corpus` \| `brews` \| `web` |
| `source_ref` | corpus entry id / `brews:summary` / the source url |
| `status` | `live` \| `retired` |
| `score` | reserved (all `1` today) |
| `created_at` / `created_at_ms` | timestamps |
| `verified_at_ms` | when it passed the gate |

A **unique index on `lower(text)`** is a DB-level dedup backstop on top of the agent's own
normalized dedup. `live` rows are what the screen reads; over the 150 cap the oldest are flipped
to `retired` (never deleted).

---

## Files

| File | Role |
|---|---|
| `src/lib/coffeeHints.ts` | `COFFEE_HINTS` — the static seed + offline floor (hand-verified) |
| `src/lib/insights/loadingInsightLint.ts` | the deterministic gate (shared SoT) |
| `src/app/api/loading-insights/route.ts` | `GET` — live rows for the screen; defensive (returns `[]` on any failure, incl. pre-migration) |
| `src/app/api/loading-insights/refresh/route.ts` | `POST` (CRON_SECRET) — the agent: ensureTable → generate (corpus+brews+web) → gate → claim-check → insert → retire |
| `src/components/flow/LightStepRecommend.tsx` | merges the fetched pool with the seed, length-capped, `shuffleSubset(…, 12)` |
| `src/middleware.ts` | `/api/loading-insights` added to `PUBLIC_PATHS` (refresh = CRON_SECRET-gated, GET = requireAuth-gated) |
| `src/lib/db/migrations/0018_add_loading_insights.sql` | canonical schema record |
| `.github/workflows/loading-insights-refresh.yml` | the monthly trigger |
| `tests/dataflow/loading-insight-lint.test.mjs` | gate + seed-contract tests |

Models: generation `claude-sonnet-4-6`, web `claude-sonnet-4-6` (+ `web_search` tool), claim-check
`claude-haiku-4-5`.

---

## How it runs (the monthly trigger)

`.github/workflows/loading-insights-refresh.yml` — `schedule: "0 5 1 * *"` (05:00 UTC, 1st of each
month) + `workflow_dispatch`. It **SSHes into the VPS with the same deploy key the Deploy workflow
uses**, then triggers the refresh **from inside the app container**:

```
docker compose exec -T app sh -c 'curl -fsS -X POST http://localhost:3000/api/loading-insights/refresh -H "Authorization: Bearer $CRON_SECRET"'
```

This means **zero owner setup**: it reuses the existing `DEPLOY_*` secrets, reads the container's
own `CRON_SECRET` (never exposed to GitHub), and needs no new GitHub secret and no Ofelia restart.
A missed run is harmless (seed floor).

- **Run it now:** Actions → "Refresh loading insights" → **Run workflow** (or **Re-run jobs** on a
  past run). Otherwise it fires monthly on its own.
- **Reading a run:** the `refresh` step prints the JSON the route returns, e.g.
  `{"snippets":27,"web":8,"candidates":35,"gated":22,"inserted":22,"retired":0}` —
  snippets pulled · web lines returned · total candidates · passed the gate+check · inserted ·
  retired over the cap. A big gap between `candidates` and `gated` means the gate is being strict.

> **`curl` dependency:** the app image is `node:20-alpine`, which has **no curl** by default. The
> Dockerfile (`runner` stage) installs it (`apk add --no-cache curl`) because the in-container
> trigger above — and the existing Ofelia crons in `deploy/ofelia.ini` — all shell out to curl.
> Before that fix those crons were silently failing with `curl: not found`; don't remove curl.

---

## Self-bootstrapping table

Because the GitHub integration can't dispatch the SQL-migration workflow (`403`), the refresh route
runs `CREATE TABLE IF NOT EXISTS loading_insights (…)` + indexes at the top of every run
(`ensureTable()`). So the agent is self-healing whether or not migration `0018` was applied on the
VPS; `0018` stays as the canonical schema record / fresh-install path. The `GET` read is defensive
regardless (missing table → `[]` → seed shows).

---

## Tuning dials

All in `src/app/api/loading-insights/refresh/route.ts` unless noted. Change the number, ship.

| Want | Dial | Now |
|---|---|---|
| More/fewer corpus lines per run | `N_RECIPES` / `N_VARIETIES` / `N_TECHNIQUES` | 10 / 8 / 8 |
| Bigger/smaller live pool before retiring | `POOL_CAP` | 150 |
| Brews source on/off threshold | `MIN_SESSIONS_FOR_BREWS` | 4 |
| More/fewer web searches per run | `web_search` `max_uses` | 5 |
| Web lines requested | the `generateWebCandidates` user prompt | "6–10" |
| Line length / word ceiling | `MAX_CHARS` / `MAX_WORDS` (`loadingInsightLint.ts`) | 80 / 15 |
| Run cadence | `cron` in the workflow | 1st of month, 05:00 UTC |
| On-screen pacing (read time / in-out speed) | `INSIGHT_READ_MS` / `INSIGHT_POP_MS` / `INSIGHT_EXIT_MS` (`LightStepRecommend.tsx`) | 4800 / 1000 / 850 ms |

Per-insight on-screen rhythm and the seed's character budget are documented in
`docs/liquid-design.md` (the recipe-crafting insight deck) — the seed sits at 41–80 chars / 8–15
words, and the gate enforces that ceiling on every generated line.

---

## Known limitations / residual risk

- **Web fabrication.** A line is grounded in a *model-supplied* quote, so a determined hallucination
  (fake quote + matching fake specific) could pass. Accepted for this surface; the
  "prefer general, no specifics unless in the quote" rule + the specifics-check + the claim-check
  make it unlikely and low-impact. Attributed web facts verbatim belong in the news feed, not here.
- **No live-DB visibility from a Claude session.** Production rows can't be read from a session —
  judge output from a run's `inserted` count and from the brew screen, or ask the owner.
- **Statuses aren't synced anywhere else.** This pool is independent of the coach `insights` table.
