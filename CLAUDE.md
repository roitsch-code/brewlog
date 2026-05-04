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

```
src/
├── app/
│   ├── page.tsx                     # Home — session diary feed
│   ├── brew/new/page.tsx            # Flow entry point
│   ├── cafes/page.tsx               # Café collection — all external visits
│   ├── taste/page.tsx               # Taste profile + AI summary
│   ├── coffees/                     # Coffee library (list + detail)
│   ├── explore/page.tsx             # AMA chat with coffee expert
│   ├── match/page.tsx               # Taste-match finder
│   └── api/
│       ├── sessions/route.ts        # ★ Core CRUD — session save/load
│       ├── recommend/route.ts       # Brew recipe generation
│       ├── cafes/route.ts           # Café visit aggregator (external sessions)
│       ├── analyze-bag/route.ts     # Claude Vision → coffee identity
│       ├── analyze-bag/clarify/     # Follow-up clarification AI
│       ├── match/route.ts           # Taste scoring algorithm
│       ├── explore/route.ts         # AMA system prompt
│       ├── brew-insight/route.ts    # Post-brew one-liner insight
│       ├── taste-summary/route.ts   # Taste profile AI summary
│       ├── upload/route.ts          # Hetzner S3 upload (bags/ prefix only)
│       └── research/route.ts        # Weekly cron agent (Ofelia)
├── components/flow/                 # 7-step brew flow UI
│   ├── FlowShell.tsx               # Step router + nav shell
│   ├── StepMode.tsx                # Home vs External
│   ├── StepScan.tsx                # Photo + AI extraction
│   ├── StepContext.tsx             # Occasion / mood / water
│   ├── StepRecommend.tsx           # Recipe card + reasoning
│   ├── StepBrew.tsx                # ★ Timer + live pour guide
│   ├── StepLog.tsx                 # Taste rating + notes
│   └── StepSummary.tsx             # Save + success screen
├── components/ui/                   # Reusable: CircularTimer, StarRating,
│                                   #   RadarChart, Chip, PhotoUpload, ...
├── hooks/useWakeLock.ts            # Keep screen on during brew
├── lib/
│   ├── claude/recommend.ts         # ★ Full system prompt (equipment baked in)
│   ├── claude/analyzeBag.ts        # Vision prompt + BagAnalysisResult type
│   ├── types/session.ts            # ★ Core data model (all interfaces)
│   ├── types/cafes.ts              # CafeSummary interface (shared server+client)
│   ├── db/client.ts                # Drizzle ORM + pg Pool
│   ├── db/schema.ts                # All table definitions
│   ├── db/migrations/              # SQL migrations (drizzle-kit)
│   └── storage/s3.ts               # Hetzner Object Storage (S3-compatible)
└── store/flowStore.ts              # ★ Zustand brew flow state (sessionStorage)
```

---

## Current Status

### ✅ Done
- Full 7-step brew flow (mode → scan → context → recommend → brew → log → summary)
- AI bag photo extraction (Claude Vision → Zod-validated session)
- Brew timer: circular, pour-over sequence + prose-step guide (AeroPress etc.)
- Screen wake lock during active brew (useWakeLock hook)
- Bloom duration from roast date (Hoffmann/Rao: 50s fresh / 45s peak / 30s old)
- Pour timing formula: `remaining / (n-2)` — last pour lands at `target - drawdownReserve`
- Proportional drawdown reserve: `targetTimeSec * 0.33`
- Session save: Zod validation → Postgres JSONB (null-safe, no JSON-roundtrip needed)
- Session GET: single indexed query on createdAtMs DESC (Postgres; no dual-index fallback)
- Taste profile page + Explore Next layout (stacked, not side-by-side)
- Coffee library, match finder, AMA explore chat, weekly research cron
- PWA (manifest, service worker, offline drafts)
- WebAuthn (passkey) auth
- **Immersion timer precision** — system prompt generates per-step durations that sum exactly to `targetTimeSec`; no "at X:XX" absolute timestamps. Steps like `"pour 15s · steep 3:40 · drain 55s"` = 300s exactly.
- **Background-safe timer** — `CircularTimer` uses `Date.now()` anchor instead of `setInterval` counter; snaps to real wall-clock time via `visibilitychange` event when returning from background on iOS
- **Step-change alerts** — 2-tone Web Audio cue (880 Hz → 660 Hz) fires on each auto-advanced immersion step; `navigator.vibrate(80)` for Android (no-op on iOS)
- **Café visit wording** — external sessions show "The Brew" (not "Your Brew") and "Would you drink this again?" (not "Would you brew again?")
- **Café collection page** — `/cafes` lists all visited cafés grouped from external sessions: visit count, avg rating, coffees tasted, last visited date
- **Auto-deploy via GitHub Actions** — push to `main` → GitHub runs SSH deploy on Hetzner VPS automatically

### ❌ Not Done / Known Gaps
- Photo uploads: stored under `bags/` — old sessions scanned before this fix have no bagPhotoUrl
- Single-user app by design (no multi-user isolation needed)
- Research cron data (insights/hints/news) needs seeding on new installs: `node scripts/seed-insights.mjs`
- Data migration from Firebase: `node scripts/migrate-firestore-to-postgres.mjs` + `node scripts/migrate-storage-to-s3.mjs`
- Step alerts during background are missed — iOS suspends JS; no workaround without server-push notifications

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

## Conventions

### Code
- **TypeScript strict** — no `any`, no `@ts-ignore` without comment
- **Tailwind only** — no inline styles except `safe-area-inset-*`
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
- `claude-sonnet-4-6` — recommend, analyze-bag, match, explore
- `claude-haiku-4-5` — brew-insight, taste-summary, research, clarify

### Git / Deploy
- **"Done" means shipped** — pushed to `main`, auto-deploy runs on Hetzner, live on the iPhone PWA. "Pushed to a feature branch" is NOT done.
- **No PR step** — push straight to `main`. No PRs, no feature branch merges, no staging.
- **Auto-deploy** — GitHub Actions runs on every push to `main`. No manual steps needed unless the action fails (fallback: SSH to VPS and run docker compose manually).
- Commit message: imperative, lowercase prefix (`fix:`, `feat:`, `remove:`)
- Always `npx tsc --noEmit` before commit
- Deploy immediately after commit — no staging environment

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
