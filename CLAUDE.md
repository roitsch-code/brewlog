# BrewLog — Claude Code Context

Personal coffee brew advisor & diary PWA. Next.js 14 App Router + Postgres + Claude AI + Hetzner.

---

## Project Structure & Key Files

```
src/
├── app/
│   ├── page.tsx                     # Home — session diary feed
│   ├── brew/new/page.tsx            # Flow entry point
│   ├── taste/page.tsx               # Taste profile + AI summary
│   ├── coffees/                     # Coffee library (list + detail)
│   ├── explore/page.tsx             # AMA chat with coffee expert
│   ├── match/page.tsx               # Taste-match finder
│   └── api/
│       ├── sessions/route.ts        # ★ Core CRUD — session save/load
│       ├── recommend/route.ts       # Brew recipe generation
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
│   ├── db/client.ts                # Drizzle ORM + pg Pool
│   ├── db/schema.ts                # All table definitions
│   ├── db/migrations/              # SQL migrations (drizzle-kit)
│   └── storage/s3.ts               # Hetzner Object Storage (S3-compatible)
└── store/flowStore.ts              # ★ Zustand brew flow state (sessionStorage)
```

**Deploy:** `git push origin main` on VPS → `docker compose build app && docker compose up -d app`
**Type-check before every commit:** `node node_modules/.bin/tsc --noEmit`

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

### ❌ Not Done / Known Gaps
- Photo uploads: stored under `bags/` — old sessions scanned before this fix have no bagPhotoUrl
- Single-user app by design (no multi-user isolation needed)
- Research cron data (insights/hints/news) needs seeding on new installs: `node scripts/seed-insights.mjs`
- Data migration from Firebase: `node scripts/migrate-firestore-to-postgres.mjs` + `node scripts/migrate-storage-to-s3.mjs`

---

## Partnership Rules

- **Flag proactively.** If something is inefficient (wastes tokens/time), insecure, or messy process-wise — raise it in the conversation. Don't silently tolerate it. The user is non-technical and cannot spot these issues on their own; it is your job to surface them.
- Examples worth flagging: files stored in odd formats, unused endpoints, duplicated code paths, secrets in the wrong places, stale dependencies, missing error handling at system boundaries, slow API calls that could be cached, confusing UX that you happened to notice while editing nearby code.
- Flag once, explain the trade-off plainly, then wait for a yes/no before acting. Don't hoard issues for a big cleanup later.
- **Translate, don't jargon-dump.** The user reads everything you write. Plain English, no unexplained acronyms or shorthand. If a technical term is unavoidable, define it inline once.

---

## Conventions

### Code
- **TypeScript strict** — no `any`, no `@ts-ignore` without comment
- **Tailwind only** — no inline styles except `safe-area-inset-*`
- **No external UI libraries** — every component is bespoke
- **Refs over state** for values that don't need to trigger renders (timers, wake lock, callbacks)
- `useCallback` deps must be accurate — don't omit to silence linter
- **Zod schemas** on all API POST routes; strip nulls with `deepStripNulls()` before parsing

### Database (Postgres + Drizzle)
- JSONB columns for nested objects (coffee, brew, result, etc.) — preserves TypeScript types unchanged
- Session timestamps: `createdAt` (timestamptz) + `createdAtMs` (bigint, indexed DESC for feed order)
- Upload paths must start with `bags/` or `uploads/` (enforced in upload route)
- Numeric fields (ratingSum, avgRating, cuppingScore) stored as `numeric` in Postgres, use `String()` when inserting

### AI models
- `claude-sonnet-4-6` — recommend, analyze-bag, match, explore
- `claude-haiku-4-5` — brew-insight, taste-summary, research, clarify

### Git / Deploy
- **Plan vs. Code mode** — Plan mode is where we discuss and agree the approach. Once we enter code mode, you run the full pipeline end-to-end with no intermediate stop: commit → merge into `main` → push `main` → Vercel auto-deploys → live on the iPhone PWA.
- **"Done" means shipped** — merged into `main` and deployed. The user is non-technical and tests only on the deployed PWA, never on GitHub diffs. "Pushed to feature branch" is NOT done; do not stop there.
- **No PR step** — merge feature branches straight into `main` (`git merge --no-ff`) and push `main`. Skip PRs entirely; they have no value for a solo non-reading user.
- **Ship every feature branch by default.** Only stop before merging if the user explicitly says "don't ship yet" or "just push the branch".
- Commit message: imperative, lowercase prefix (`fix:`, `feat:`, `remove:`)
- Always `tsc --noEmit` before commit
- Deploy immediately after merge — no staging environment

---

## Explicitly NOT Wanted

- **No token usage logging** — `logTokenUsage` / `usageLogs` collection was removed; don't re-add
- **No Zod `.transform()` that produces `undefined`** — breaks Firestore writes (null → strip at source instead)
- **No external component libraries** (shadcn, radix, headless-ui, etc.)
- **No changes to unrelated files** when fixing a bug — surgical edits only
- **No emojis in UI** — design is editorial/premium
- **No separate "total" row** in pour sequence tables — drawdown end = total time = done
- **No temperature-for-timing advice** — grind coarser/finer to fix timing; temp is for extraction chemistry only
- **No `npm run dev` assumptions** — app is always tested on deployed Vercel URL (iPhone PWA)

---

## User / Equipment Profile

| Device | Details |
|--------|---------|
| **PRIMARY** | V60 size 2 + Hario Drip Assist |
| Other | Orea V4 Wide, Clever Dripper, Kalita Wave, AeroPress, Moccamaster, Chemex |
| **Grinder** | Niche Zero — **° settings, NEVER clicks** |
| Travel grinder | Comandante C40 MK2 — clicks |
| Water (daily) | Tap ~300 ppm | Diluted: 1:1 tap+distilled ~150 ppm |

**Taste:** silky, balanced, floral/fruity (elegant); light roast SO; avoids anaerobic/infused/dark.
**Grind quick ref:** @./docs/grind-settings.md
