# Session Handover — May 2026

> Snapshot at the end of a long polish + feature day after the Light migration arc. Persistent rules + tokens live in `CLAUDE.md`. This file is **state**, not policy.

---

## Knowledge-layer ground-truth audit — substantively complete (2026-05-28)

A multi-session audit triggered after the Hoffmann V60 Better 1 Cup entry in `reference.ts` was found to disagree with Hoffmann's own published recipe on three axes (temp 92 °C vs his "freshly boiled", 2 pours vs his 4 pulses, 3:30 vs his ~3:00 target). That triggered the third Hard Rule in `CLAUDE.md` (commit `aa3019b`) against fabricating brewing parameters, and a full audit of every claim in `src/lib/knowledge/`, `src/lib/roasters/priors.ts`, `src/lib/coffeeHints.ts`, and `src/lib/constants/grindSettings.ts`.

**Audit headline** — across ~302 quantitative or factual claims: 11% have a specific cited source, 11% have only vague description, 78% have no source attribution at all. Zero URLs anywhere in the codebase's `sources` arrays before this work.

**Shipped this arc on branch `claude/wonderful-albattani-uLM1n`:**

- `f4c83b1` Drip Assist purge (12 files + 4 assets)
- `aa3019b` Third Hard Rule added to CLAUDE.md (fabrication prohibition)
- `b9fc86b` Roaster priors purge — 14 insider-knowledge quantities + 5 unverified award claims removed (Friedhats, La Cabra, SEY, The Roosters, Fuglen, Five Elephant, Bonanza, Square Mile, Supreme Roastworks, April, Tanat, Nomad, Gardelli, Hard Beans)
- `6939b3a` Hoffmann V60 1-Cup rewrite + Hedrick V60 Framework entry + 7 new techniques + 6 new hints + `docs/coffee-experts.md` mirror
- `d93a859` Recipe ground-truth PR A (quick wins) — Hoffmann Clever URL + Kasuya 4:6 standard cadence fix + Hario/book sources + Turbo V60 (Hedrick) attribution tightening
- `9684eef` Recipe ground-truth PR B (substantial fixes) — Hoffmann AeroPress (standard not inverted; 95 °C not 85 °C; 3:00 not 2:30) + Hoffmann Iced (two-cup variant 37.5:500 + 170 g ice) + Kasuya 2016 Pour 1 = 50 g not 60 g + Medina 2023 (Origami Air S; 5 × 50 g pours) + Wölfl 2024 (Chicago not Copenhagen; 630 µm; correct 4-pour cadence) + Wallgren Kalita (15:250 not 22:330; 96 °C not 94 °C)
- `793d9e7` Recipe ground-truth PR C (demote + rewrite/rename) — 10 entries where parameters materially diverged from the originator's actual published recipe: Hoffmann Moccamaster (ratio uncertain), Du 2019 (16 g not 20 g; 1:15 not 1:12; 3 pours not 4), Hsu 2022 (temperature uncertainty), Peng 2025 (catastrophic — 1:14 not 1:4, 96/96/80 not 96/88/80, 800 µm not medium-fine), Stanica WAC (Lisbon not Bucharest; 50+50 g extraction not 120+80 bypass; no flip step), Gagné AeroPress (HOT + long, not low-temp + long — every parameter wrong), Perger V60 (12 g not 22 g; 200 g not 352 g; drop Rao-spin step), Rao "Rule of Thirds" (renamed to Two-Pour with Rao Spin — Rao opposes 3-pour publicly), Rolf (renamed — "Minimum Variables" not traceable to a Rolf primary), Hatakeyama (renamed — numbers are generic Cafec, not Hatakeyama's WBrC routine).
- Hard Rule strengthening (this commit) — sub-rules 5–8 added against aggregator-as-primary, `verified: true`-without-content-cross-check, peer-data audit when adjacent data is changed, and retroactive audit on rule enactment

**Pivotal reframing (2026-05-28 evening):** the user (Markus) and the experts agree — grinder settings are inherently individual. Hoffmann, Hedrick, Kasuya all say "every grinder is different." So the codebase should NOT carry universal Niche degrees. Instead: build per-recipe grind settings from one empirical anchor + published cross-brewer ratios. Markus is not going to brew 50+ calibration cups.

**Anchor empirical session (2026-05-28):**
- 1-Cup Hoffmann **with the wrong codebase recipe** (92 °C, 2 pours, 3:30 target) gave Niche 385° / Comandante 23 / clean sweet floral cup. **Not a valid Hoffmann anchor** — the recipe was wrong on the day.
- Comandante 23 clicks landed Hoffmann's claimed 3:30 on his (wrong-codebase) recipe. Niche 385° = same drawdown ish.
- Real Hoffmann 1-Cup (100 °C + 4 pulse pours + 3:00 target) NOT yet re-brewed.

**Audit status — 19 named-expert recipe entries done:**

| Outcome | Count | Examples |
|---|---|---|
| Keep as-is | 1 | hoffmann-clever-ultimate |
| Minor fix (URL upgrade, cadence) | 2 | kasuya-4-6-standard, turbo-v60-hedrick |
| Substantial fix with primary URL (PR B) | 6 | hoffmann-aeropress-standard, hoffmann-immersion-iced-clever, wbrc-2016-kasuya, wbrc-2023-medina, wbrc-2024-wolfl, wallgren-kalita-sieved |
| Demote to `verified: false` + rewrite/rename (PR C) | 10 | hoffmann-moccamaster, wbrc-2019-du, wbrc-2022-hsu, wbrc-2025-peng, wac-2024-stanica, gagne-long-aeropress, perger-high-extraction-v60, rao-rule-of-thirds, rolf-minimum-variables, hatakeyama-cafec-flower |

**Pending — next session(s):**

1. **520 ml brew anchor** — Markus to brew **30 g : 500 g V60, Comandante 30 clicks**, time + taste. Anchor from Wendelboe's published V60 video (`https://www.youtube.com/watch?v=r-4TjpGYZ2U` — Markus's URL; not in-session-verified yet). Niche degree TBD by what hits ~4:00 drawdown.
2. After step 1: rebuild `grindSettings.ts` as a per-recipe + per-brewer framework anchored to Markus's empirical brew(s) + published cross-brewer directional data (Kalita coarser than V60, Origami flow-faster, dose-up coarser — all directional, no published quantitative slopes from named experts). NOT universal Niche degrees per brewer.
3. **Variety audit** (`src/lib/knowledge/varieties/data.ts`) — 25 entries: 8 Class A (WCR-grounded), 6 Class B (Royal Green Book only), 11 Class C (WCR-only or empty). Needs WCR catalog page-URL cross-check per variety. Lowest risk of the remaining work.
4. **Class B techniques audit** (`techniques/data.ts`) — 7 entries with vague YouTube/blog sources need URL augmentation: Turbo (Hedrick), swirl-not-stir (Hoffmann), high-agitation (Perger), minimal-agitation (Rolf), water-first (Bailey/Hoffmann), roast-tailored filter (Hatakeyama), inverted AeroPress (community).
5. **`coffeeHints.ts` quantitative-claim audit** — ~115 Class C quantitative hints (historic dates, origin specifics, SCA standards). Long tail; triage between "industry standard, just add URL" vs "delete".
6. **`expanded.ts` recipes** — ~60 entries, mixed Class A/B. Heaviest source-hunting workload; likely needs its own multi-session arc.
7. **Re-promotion to `verified: true`** — every demoted entry has notes documenting what content cross-check is needed to re-promote. Items to actually watch end-to-end (YouTube blocks WebFetch in-session): WCE Hsu 2022 finals, Origami Du 2019 walkthrough, Slow Pour Solo Dripper Peng 2025, WAC Stanica 2024, Hoffmann 2021 AeroPress, Hoffmann 2023 Moccamaster, Hoffmann 2023 Iced, BH Perger V60, Rao V60 scottrao.com video, Hatakeyama 2021 WBrC Round One.

**Verified primary source URLs collected this session** (all now cited in code):
- Hoffmann *A Better 1 Cup V60 Technique* — https://www.youtube.com/watch?v=1oB1oDrDkHM
- Hoffmann *How To Avoid A Bad Pour Over Brew* — https://www.youtube.com/watch?v=mMwscUNKbPk
- Hoffmann *The Ultimate V60 Technique* (2019, 30:500 batch) — https://www.youtube.com/watch?v=AI4ynXzkSQo
- Hoffmann *The Ultimate Clever Dripper Technique* (2020) — https://www.youtube.com/watch?v=RpOdennxP24
- Hoffmann *The Ultimate AeroPress Technique* (2021, Ep. 3) — https://www.youtube.com/watch?v=j6VlT_jUVPc
- Hoffmann *The Perfect Moccamaster Brew Recipe* (2023) — https://www.youtube.com/watch?v=xwFvlapyVl4
- Hoffmann *Immersion Iced Coffee: A Better & Easier Technique* (2023) — https://www.youtube.com/watch?v=8uGGeV8A-BM
- Hedrick *Pourover Lesson for Advanced Brewers* (2024, covers his Lazy 80% framework) — https://www.youtube.com/watch?v=2mrLiE4ilXw
- European Coffee Trip *3 Essential Hario V60 Recipes* (third-party demo of Hoffmann 2019, Kasuya 4:6, Cafec Osmotic Flow) — https://www.youtube.com/watch?v=P0mI6Ue8BKc
- Wölfl 2024 ECT walkthrough — https://europeancoffeetrip.com/winning-pour-over-recipe-martin-woelfl/ + https://www.youtube.com/watch?v=3SIFFaT1MFU
- Peng 2025 Slow Pour Supply — https://www.slowpoursupply.co/blogs/journal/2025-world-brewers-cup-champion-george-pengs-solo-dripper-recipe + Sprudge + Solo Dripper YouTube
- Stanica WAC 2024 — https://aeropress.com/blogs/w-a-c-aeropress-recipes/1st-george-stanica-romania-2024 + WAC archive + YouTube
- Gagné AeroPress — https://coffeeadastra.com/2021/09/07/reaching-fuller-flavor-profiles-with-the-aeropress/
- Perger BH — Medium 80:20 + baristahustle.com 80:20 + Espresso Compass
- Rao V60 — https://www.scottrao.com/blog/2017/9/14/v60-video + Why Spin + Hario UK Ambassador
- Kasuya — https://en.philocoffea.com/products/signed-book-by-tetsu-kasuya-anyone-can-make-great-coffee-the-worlds-best-4-6-method-for-getting-addicted-to-good-coffee (book) + https://www.hario-europe.com/blogs/hario-community/v60-ambassadors-tetsu-kasuya (interview)
- Wallgren — https://www.baristamagazine.com/brewing-experiments-mikaela-wallgrens-2016-world-brewers-cup-championship-recipe/
- Du 2019 — https://www.youtube.com/watch?v=Fl4fuM5bVQU (Origami official) + Sprudge
- Hsu 2022 — https://www.youtube.com/watch?v=sTroaHo5zsk (WCE official)
- Medina 2023 — https://www.youtube.com/watch?v=XQd8ddPKbXU (WCE official) + Slow Pour Supply

**Branch state:** working tree clean. 8 commits ahead of `main`. No PR opened yet on GitHub — Markus has not asked.

---

## Latest — Offline Brew Mode (PR #184 → #185, 2026-05-24) ✅ shipped + verified on device

Re-brew a **known** coffee with no network. The brew process was already client-only (timer, pour guide, tasting log; pour math is local); the only offline-breaking pieces were fetching a recipe (`/api/recommend`) and saving (`/api/sessions`). Both closed by reusing a past recipe + queuing the save.

- **#184** — the feature:
  - `src/lib/storage/idb.ts` — tiny IndexedDB wrapper, DB `brewlog-offline`, stores `brewable` + `pendingSessions`.
  - `src/lib/storage/offlineLibrary.ts` — caches each coffee's identity + Field zones + **top-2 best-rated** deduped recipes. Warmed in the background on online `/coffees` loads (full-feed fetch) and per-coffee on `/coffees/[id]`.
  - `src/lib/storage/saveQueue.ts` — parks the POST body when offline; flush drains it and **never drops a brew** on a failed POST.
  - `src/lib/flow/brewAgain.ts` — shared entry: `startBrewAgain()` (online → Step "context") / `startBrewAgainOffline()` (seed cached recipe → Step "brew"). Now used by `/coffees`, `/coffees/[id]`, `ActionPill`.
  - `src/hooks/useOnline.ts`, `src/app/(light)/offline/page.tsx` (SW document fallback), `next.config.mjs` `fallbacks.document`.
  - `flowStore` → **localStorage** (was sessionStorage) so a mid-brew reload survives. `NavigationOverlay` "New Session" now calls `reset()`.
  - Offline recipe picker opens **inline on the `/coffees` list** (a sheet), NOT via `/coffees/[id]` — that route is server-rendered (ƒ in the build), so its RSC isn't reliably cached offline; `/coffees` + `/brew/new` are precached.
- **#185** — the sync fix (first cut didn't sync): iOS PWAs fire the `online` event unreliably (so does next-pwa `reloadOnOnline`). New `ConnectionStatus` component (rendered by `LightShell`) drives the flush off `navigator.onLine` re-checked on **mount + `visibilitychange`**, and surfaces Offline / Syncing / "didn't sync — tap to retry".

**Markus verified on the deployed PWA:** offline brew works, and after #185 the save syncs on reconnect. ("Funktioniert.")

**Caveat:** the cache only holds coffees opened online at least once. Open the Coffee Library online once after any fresh install to populate it.

---

## Top priority for next session

**`/cafes/map` polish + integration with "I've been here".** The map page is the single sore thumb left: it still renders dark CartoCDN tiles with default Leaflet blue markers while everything around it is Light cream + anthracite. Two coupled jobs:

1. **Map theme** — swap the tile provider away from the dark Carto. Best options:
   - CartoCDN `voyager` or `positron` (light, neutral, retina-friendly) — easiest swap
   - Stadia "Outdoors" or "Light" (slightly warmer cream feel) — closer to BTTS aesthetic
   - OpenStreetMap raw default — beige, very Light, no API key
   - Custom JSON style (vector tiles) — full control but more setup
   - Hacky last resort: CSS `filter: invert(0.95) hue-rotate(180deg)` on the existing dark layer — works at zero infra cost but image-heavy areas (parks, photos) look weird
2. **Markers** — Leaflet's default blue droplet doesn't match anything else in the app. Replace with anthracite circle markers (or custom SVG with the coffee-bean glow icon). Differentiate visited (filled anthracite) vs unvisited (outline only). Maybe cluster at low zoom.
3. **"I've been here" entry from the map** (coupled feature) — once the user can tap a place on the map, expose the visit modal directly. New flow:
   - Tap a marker → small popup with the place name + "I've been here" pill + "Open detail →"
   - "I've been here" → opens the same modal we built in PR #145, POSTs to `/api/cafe-visits` with the place's name + location
   - The visited flag immediately reflects on the marker style
4. **Search bar** — currently functional but could surface own visited/brewed cafés separately from generic search hits. Lower priority.

Look at `src/app/cafes/map/page.tsx` (62 lines) and `src/components/cafes/CafeMap.tsx` for the structure. `places` table on the VPS has 6,202 rows; the map page reads from `/api/places` with a city / token search.

After the map work, the whole app reads one consistent Light language end-to-end.

---

## What shipped today (PRs #138 → #145)

### Docs
- **PR #138** — Post-light-migration docs refresh (CLAUDE.md routes table, components, Status snapshot; HANDOVER.md full rewrite from in-flight to closed). Today's PRs continue the line.

### Login + UX fixes
- **PR #139** — Login wordmark "Better taste / than sorry." replaces the BREWLOG eyebrow. Login CTAs swapped to pill shape (`rounded-full h-14`) matching the onboarding primary buttons. SessionCard background dropped from 55 % → 30 % cream so the flavor chips at 55 % visibly pop.
- **PR #140** — Login wordmark restyled to **exactly** match the Home `<h1>` — Fraunces 3xl, leading 1.05, full anthracite, with `<br />` line break. Same brand statement at every entry point.

### Routing fix
- **PR #141** — `/cafes` Coffees-tab tap now lands on the Coffee Library detail (`/coffees/[coffeeId]`) when the bag exists in the library; falls back to the café-only aggregate (`/cafes/coffee/[key]`) only for café-only coffees. Reverts PR #134's blanket routing.

### Scan editing
- **PR #143** — `EditableRow` discoverability:
  - Underline switched from `decoration-white/20` (invisible on cream) → `decoration-light-foreground/30`
  - Added a small pencil icon on the right edge of every row
  - Roaster + Coffee rows always render (were `!== undefined`-gated); empty value shows "tap to edit"
  - Lets the user shorten "El Congo by Carlos Montero – Don Eli" → "El Congo" at scan time.

### Roaster rebrand
- **PR #142** — Migration `0010_rename_rvtc.sql`. Collapses every variant of `Rösterei Vier / The Commonage` → `RVTC` across `coffees.roaster`, the `sessions.coffee.roaster` JSONB field, and the `roasters` priors cache.
- **Applied on the VPS 2026-05** — `UPDATE 3` coffees + `UPDATE 16` sessions + `DELETE 1` cached roaster prior.

### Orea V4 bottoms
- **PR #144** — Four distinct bottom variants now render with their own icons. New SVGs in `public/brew-icons/`: `orea-classic.svg` (central plate + cross of 4 flow slots), `orea-open.svg` (clean donut), `orea-apex.svg` (8 inward-pointing triangular teeth), `orea-fast.svg` (8 short radial bars between inner + outer ring). `BrewMethodIcon.brewIconSrc` switches on the variant keyword inside the orea branch — legacy "Orea V4 Wide" falls back to Classic. `BREW_METHODS` replaced the single `orea` entry with four kebab-case ids (`orea-classic`, `orea-open`, `orea-apex`, `orea-fast`) aligned to the `LightStepContext` picker labels.

### "I've been here" — new feature
- **PR #145** — Visit-only café log with a binary thumbs rating.
  - New table `cafe_visits` (migration `0011_add_cafe_visits.sql`, applied on VPS 2026-05). Schema: `id`, `cafe_name`, `location`, `rating` ('come-back' | 'wont-return'), `notes`, `visited_at`, `visited_at_ms`.
  - New API `/api/cafe-visits` (GET + POST) and `/api/cafe-visits/[id]` (DELETE), Zod-validated payloads.
  - UI on `/cafes/place/[slug]`: anthracite "I've been here" pill below Open in Maps → modal sheet with ThumbsUp "Would come back" / ThumbsDown "Won't see me again". Visits render in the timeline above brew sessions as small cream-glass cards with a delete-x.
  - `/api/cafes` aggregation folds in `cafe_visits` rows. Visit-only places now appear in the Café Library with the visit count.

---

## Deploy quirk we hit

GitHub Actions auto-deploy + manual `docker compose up -d app` raced on the VPS and produced a Docker container name conflict (`/588a8065ea44_brewlog-app-1 is already in use by container 75746d301bda...`). Resolved by `docker rm -f brewlog-app-1 && docker compose up -d app`. App is live with all today's changes.

**Followup for next session:** harden `.github/workflows/deploy.yml` so it tolerates the race — add `docker compose down` before `up -d`, or pass `--remove-orphans --force-recreate`. See open item #7 below.

---

## Live state on VPS (verified 2026-05)

```
sessions          → indexed feed table
coffees           → 23 rows; all with field_zones populated
                    RVTC rename applied (UPDATE 3 in #142)
coffees.in_rotation column exists
sessions.coffee.roaster JSONB renamed where it referenced old RVTC name (UPDATE 16)
cafe_visits       → new table (migration 0011 applied)
places            → 6,202 rows (manual bulk load, no Git seed)
preferences       → user equipment + grinder + location
roasters          → cached priors, RVTC stale row deleted (will lazily regenerate)
knowledge         → seed-insights.mjs populated
coffee_alerts     → user subscriptions
auth_credentials  → WebAuthn passkey
conversations + conversation_messages → BTTS chat history
```

12 tables total now.

---

## Open items (live ranking)

1. **`/cafes/map` Light pass + "I've been here" entry from map** — see Top priority section above. Coupled job, single session.
2. **`/coffees` "Show only rotation" filter** — list shows the star indicator but no toggle yet to filter to rotation bags only. Small, scoped.
3. **`LightStepScan` Card/Chip refactor** — 1400 lines with bespoke buttons that should route through the `Card` + `Chip` primitives. Code quality, no visible UX change.
4. **Aromatic Goal validation** — PR #72 added the intent to `/api/recommend`. Per the Hard Rule it needs sample-before/after on the deployed PWA against a delicate coffee. Needs real brews.
5. **Cafe visit notes UI** — `cafe_visits.notes` column exists; UI only lets you delete + re-add a visit. Cheap follow-up: inline note edit on the visit card.
6. **Deploy workflow harden** — `.github/workflows/deploy.yml` needs to tolerate manual + automated `up -d` races (see Deploy quirk above).

---

## Pitfalls discovered (don't re-learn these)

- **Docker name conflict on parallel `up -d`.** Manual `docker compose up -d app` while a GitHub Action is running the same command races. Resolution: `docker rm -f brewlog-app-1 && docker compose up -d app`. Future deploys should harden the workflow (open item #6).
- **iOS PWA caches `apple-mobile-web-app-status-bar-style` at install time.** Changing the meta tag does not update an already-installed PWA on iPhone. User has to delete the PWA from the home screen AND clear Safari → Advanced → Website Data for the domain, then re-install.
- **iOS PWA `online`/`offline` events are unreliable.** A reconnect frequently never fires `online`, so anything waiting on that event (a React `online` state, next-pwa `reloadOnOnline`) silently doesn't run. This cost a round-trip on the offline-sync feature (#184's flush didn't fire → #185). Fix pattern: re-check `navigator.onLine` (accurate when READ) on `visibilitychange` / app foreground and on mount — don't rely on the event alone. See `ConnectionStatus.tsx`.
- **App Router dynamic routes aren't reliably available offline.** A `[id]` route is server-rendered (ƒ in the build output), so its RSC payload is only SW-cached for ids visited online — navigating to an unvisited id offline falls to the `/offline` fallback. Keep offline entry points on precached static routes (`/coffees`, `/brew/new`); that's why the offline recipe picker is an inline sheet on the list, not a detail-page navigation.
- **Tailwind only scans `src/{app,components,pages}`.** `src/lib/**` is NOT in `tailwind.config.ts` `content`. Utility classes that live only in lib are silently never generated. If you need a shared visual constant in lib, export it as a raw CSS value and apply via inline `style={{ background: ... }}` at the call site.
- **html canvas default.** `html { background-color: #F3E5DC }` (cream). `body { background-color: #0E0B0A }` by default, dropped to `transparent` only when `body:has([data-light-scope="true"])` matches. Light routes therefore show the cream canvas behind the Field; the legacy Dark `cafes/map` keeps its dark body. `loading.tsx` explicitly sets `background: #F3E5DC` inline because it renders BEFORE LightShell mounts.
- **Next.js standalone Docker image** does NOT expose `@anthropic-ai/sdk` as `node_modules/@anthropic-ai`. Backfill script started failing with `ERR_MODULE_NOT_FOUND` until rewritten to call the Messages API over plain `fetch`. `pg` IS in standalone deps (traced via Drizzle).
- **`lovable-v7/` must be in `.dockerignore`.** Without it the Docker `COPY . .` drags the Vite-targeted Lovable export into the build context and Next.js's worker tries to compile it → `react-router-dom not found` → deploy fails.
- **Drizzle SELECT * is column-strict.** Adding a column to the schema BEFORE running the SQL migration on the VPS makes `/api/coffees` 500 with "column does not exist". Migrations must be applied to the DB BEFORE the schema/code that references them deploys.
- **`min-h-full flex flex-col` does not give children definite height.** `flex-1` inside collapses to 0. Leaflet container needed `h-dvh flex flex-col` + `flex-1 min-h-0`.
- **The `[data-light-scope]` CSS shim** in `globals.css` catches inline `var(--card)` etc. for un-migrated components inside the Light tree — but NOT hardcoded hex values like `#2A241C`. Those need explicit Light tokens at the source.
- **CSS `filter: brightness(0)` under `[data-light-scope]`** is the trick used to invert hardcoded-white SVGs (`BrewMethodIcon` assets, original `CoffeeBeanGlow`) without forking the components.
- **localStorage starter cache.** Versioned key `brewlog.starter.v4.<date>.<bucket>`. Bumping the version is the canonical invalidation. If you change the greeting prompt, bump the cache to `v5`.
- **Hard Rule on AI behavior changes.** Any prompt / model / schema-enum change to `/api/recommend`, `/api/greeting`, `/api/match`, etc. needs sample-before-after outputs per `CLAUDE.md`. Cannot validate from this remote env — Markus runs on the deployed PWA.
- **Manual migrations.** SQL files in `src/lib/db/migrations/` are NOT auto-applied. Run on VPS: `cat src/lib/db/migrations/00XX_*.sql | docker compose exec -T postgres psql -U brewlog -d brewlog`. The Drizzle journal only tracks `0000_init`. Today's apply pattern (0010, 0011) is the canonical workflow.

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
│   │   │   └── [id]/page.tsx   ← Session detail
│   │   ├── coffees/
│   │   │   ├── page.tsx        ← Library list (photo-strip cards)
│   │   │   └── [id]/page.tsx   ← Coffee detail + rotation toggle
│   │   ├── cafes/
│   │   │   ├── page.tsx        ← Café Library (tabbed)
│   │   │   ├── place/[slug]/   ← Single café + inline edit + "I've been here" modal
│   │   │   └── coffee/[id]/    ← Coffee tasted out
│   │   ├── taste/page.tsx
│   │   ├── login/page.tsx      ← Fraunces 3xl wordmark + pill CTAs
│   │   ├── onboarding/page.tsx
│   │   ├── offline/page.tsx     ← NEW — SW document fallback (#184)
│   │   └── past-conversations/
│   ├── cafes/map/page.tsx      ← Only Dark route left (next session's target)
│   ├── api/
│   │   ├── cafe-visits/        ← NEW — POST/GET, DELETE/[id]
│   │   ├── cafes/route.ts      ← Now folds in cafe_visits aggregation
│   │   └── …
│   ├── loading.tsx             ← Light cream bg + Light bean
│   ├── layout.tsx              ← Root: PWA meta + ScrollContainer
│   └── globals.css             ← [data-light-scope] shims live here
├── components/
│   ├── flow/                   ← LightStep*.tsx (seven brew steps)
│   ├── ui/
│   │   ├── light/              ← Light primitives (+ ConnectionStatus.tsx, NEW #185 — offline/sync pill)
│   │   ├── FlavorWheel.tsx     ← Light palette in place
│   │   ├── BrewMethodIcon.tsx  ← Routes Orea variants to specific SVGs
│   │   ├── PhotoUpload.tsx     ← Uses Dark CoffeeBeanGlow + CSS-shim invert
│   │   ├── StarRating.tsx      ← Dark — only CafeMap consumes it
│   │   └── …
│   ├── layout/
│   │   ├── ScrollContainer.tsx ← Root wrapper (100dvh + hidden scroll)
│   │   └── BottomSpacer.tsx
│   ├── cafes/CafeMap.tsx       ← Leaflet (used by /cafes/map only)
│   └── session/SessionCard.tsx ← Light, 30% card opacity so chips pop
├── lib/
│   ├── field/                  ← v1.1 zones + cache.ts (coffee↔brew Field carry)
│   ├── claude/                 ← recommend.ts, analyzeBag.ts, …
│   ├── storage/                ← s3.ts + idb.ts / offlineLibrary.ts / saveQueue.ts (NEW — offline brew, #184)
│   ├── flow/brewAgain.ts       ← NEW — shared Brew-Again entry (online + offline)
│   ├── db/
│   │   ├── schema.ts           ← + cafeVisits table
│   │   ├── helpers.ts
│   │   └── migrations/         ← 0000..0011 (0010 + 0011 applied 2026-05)
│   └── types/                  ← + CafeVisit, CafeVisitRating in cafes.ts
├── hooks/
│   └── useOnline.ts            ← NEW — connectivity boolean
└── store/
    └── flowStore.ts            ← localStorage-persisted (was sessionStorage, #184)
public/brew-icons/
├── orea-classic.svg            ← NEW (#144)
├── orea-open.svg                ← NEW
├── orea-apex.svg                ← NEW
├── orea-fast.svg                ← NEW
└── orea-v4.png                  ← legacy fallback, no longer routed
```

---

## Conventions cheat sheet

- **Tokens:** `text-light-foreground` (anthracite), `text-light-muted-foreground`, `bg-light-card-default` (cream glass 55 %), `bg-light-card-selected` (warm taupe), `border-light-foreground/15`, `shadow-light-card-pressed`
- **Cream highlight on dark elements:** `text-[hsl(36_55%_96%)]` (e.g. CTA text on anthracite button)
- **Card variants:** default cards use `bg-light-card-default` (55 %); SessionCard (chips inside) uses `bg-[hsl(36_55%_96%/0.30)]` — the lower opacity so child chips visibly contrast.
- **Destructive (delete, error):** `bg-[hsl(12_70%_45%)]` warm rust
- **Hero question:** `font-fraunces font-semibold text-[40px] leading-[1.05] tracking-[-0.01em]`
- **Headline (route title):** `font-fraunces text-3xl text-light-foreground leading-none`
- **Wordmark (Home + Login):** `<h1 className="font-fraunces text-3xl leading-[1.05] text-light-foreground">Better taste<br />than sorry.</h1>` — exact same markup, two entry points
- **Eyebrow:** uppercase tracked, `text-light-muted-foreground text-xs tracking-widest`
- **Unified chip / tag:** `inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-medium leading-tight backdrop-blur-light-card backdrop-saturate-150 bg-light-card-default text-light-foreground`
- **Primary CTA pill:** `w-full h-14 rounded-full bg-light-foreground text-[hsl(36_55%_96%)] font-semibold` + `active:scale-[0.98] transition-transform`
- **Field rotation per brew step:** see `STEP_ROTATION` map in `LightFlowShell.tsx`
- **Light scope marker:** `[data-light-scope]` attribute set by LightShell wraps everything in the (light) route group

---

## Where to start next session

Map polish + visit entry from map is the obvious next move — see the Top priority section. After that the punchlist is small enough that you could go down it in one session: rotation filter, scan refactor, visit notes UI, deploy workflow hardening. Aromatic Goal validation needs Markus on the deployed PWA brewing actual coffee.

Before any prompt change to `/api/greeting`, `/api/recommend`, etc.: read the **Hard Rule on AI behaviour changes** in CLAUDE.md.

Read **`CLAUDE.md`** as the persistent context; this file only for the in-flight state.
