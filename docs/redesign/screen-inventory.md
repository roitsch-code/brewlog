# BrewLog Screen Inventory

> **Purpose:** map of every user-facing view, written for strategic discussions about IA, redesign sequencing, and design-system cleanup. Companion to `docs/redesign/spec.md` (which currently only covers Explore chat).
>
> **What this doc is NOT:** a UX audit. Status labels here are limited to what is verifiable from `main` (does a redesign spec exist? does the route exist?). "What feels broken" comes from screenshots + chat context, not this file.
>
> **Verified against:** `main` HEAD on 2026-05-09. Routes from `src/app/`, data sources from `src/lib/db/schema.ts`, AI calls from `src/app/api/` and `src/lib/claude/`.

---

## Quick map

| Group | Route | Redesign spec exists? |
|-------|-------|------------------------|
| Auth | `/login` | no |
| Auth | `/onboarding` | no |
| Home | `/` | no |
| Brew flow | `/brew/new` (7-step wizard) | no — **first planned hero-view migration: Brew Detail** |
| Brew detail | `/brew/[id]` | no |
| Coffee library | `/coffees`, `/coffees/[id]` | no |
| Cafés | `/cafes`, `/cafes/place/[slug]`, `/cafes/coffee/[id]` | no |
| Taste | `/taste` | no |
| Match | `/match` | no |
| Explore | `/explore` | **yes — `docs/redesign/spec.md` v0.1** |
| Hub | `/library` | no |

Of 14 routes, 1 has a redesign spec. The other 13 will need spec addenda as their phases come up.

---

## Per-view detail

### `/login`
- **Purpose:** WebAuthn passkey login (single user).
- **Data:** `auth_credentials`, `auth_challenges`.
- **AI:** none.
- **Notes:** Single-user app — login is once-per-device, not a daily-use surface. Low redesign priority.

### `/onboarding`
- **Purpose:** first-run wizard for equipment, grinder, location, brewing preferences. Writes to `preferences`.
- **Data:** `preferences` table.
- **AI:** none.
- **Notes:** Runs once per user. The data it captures is read by every AI prompt that follows (`loadUserProfile()` in `src/lib/claude/userProfile.ts`).

### `/` (Home)
- **Purpose:** session diary feed + primary entry to "New Brew" / "Brew Again".
- **Data:** `sessions` (paginated by `createdAtMs DESC`).
- **AI:** none in the feed itself; each `SessionCard` may surface AI-generated insight stored on the session.
- **Notes:** Highest-frequency view. Whatever pattern is set here defines the day-to-day feel of the app.

### `/brew/new` — the 7-step brew flow
Steps are separate components in `src/components/flow/`:

| Step | File | What | AI |
|------|------|------|-----|
| 1. Mode | `StepMode.tsx` | Home Brew / Coffee Shop / Taste Match selector | — |
| 2. Scan | `StepScan.tsx` | Bag photo upload + clarification | `analyze-bag` (Sonnet 4.6 Vision), `analyze-bag/clarify` (Haiku 4.5), `analyze-url` (Haiku 4.5) |
| 3. Context | `StepContext.tsx` | Occasion, water amount, time, mood, equipment | — |
| 4. Recommend | `StepRecommend.tsx` | 2–4 recipe candidates with reasoning | **`recommend` (Opus 4.7)** — engineered for Opus, do not swap |
| 5. Brew | `StepBrew.tsx` | Circular timer, real-time pour guide, step alerts, screen wake-lock | — (math is local) |
| 6. Log | `StepLog.tsx` | Flavor wheel, star rating, tasting notes | tasting-notes ↔ SCA via `lib/claude/translate.ts` (Haiku 4.5) |
| 7. Summary | `StepSummary.tsx` | Review + save | `brew-insight` (Haiku 4.5) for the post-brew terrain one-liner |

- **State:** Zustand `flowStore` (sessionStorage-persisted), commits to `sessions` on save.
- **Notes:** Most code-heavy view in the app. The brew step in particular has invariants (timer math, wake-lock, audio cues) that any redesign must preserve — see CLAUDE.md "Done" section.

### `/brew/[id]` — Brew detail
- **Purpose:** edit / review an existing session.
- **Data:** single `sessions` row.
- **AI:** stored insight is shown; no live regeneration on view.
- **Notes:** **First planned hero-view for the redesign.** Everything else waits behind this.

### `/coffees`, `/coffees/[id]`
- **Purpose:** bag library; per-coffee detail page with rating history, brew signatures (weighted averages per method), notes.
- **Data:** `coffees` table; signatures computed from `sessions` via `lib/claude/brewSignature.ts`.
- **AI:** signatures are heuristic, not LLM. No per-view AI calls.

### `/cafes` family
- **`/cafes`:** map (Leaflet) + place search. Reads `places` (~6.2k geocoded entries) and aggregates café visits from `sessions`.
- **`/cafes/place/[slug]`:** individual café detail (visit count, avg rating, coffees tasted there, last visited).
- **`/cafes/coffee/[id]`:** coffee tasted at an external location (not roaster-bag context).
- **Data:** `places`, `sessions`. Map search has a diacritic-tolerant fold (`Düsseldorf` ↔ `Dusseldorf` ↔ `Duesseldorf`).
- **AI:** none in the views themselves.

### `/taste`
- **Purpose:** taste profile + AI-written summary of taste evolution across sessions.
- **Data:** `sessions` (cross-session pattern extraction in `lib/claude/extractor.ts`, `patterns.ts`).
- **AI:** `taste-summary` (Haiku 4.5).

### `/match`
- **Purpose:** guided taste-match flow — score past sessions against a current coffee.
- **Data:** `sessions`.
- **AI:** `match` (Sonnet 4.6).

### `/explore`
- **Purpose:** conversational AI + map explorer. Voice in/out (ElevenLabs Scribe STT + TTS).
- **Data:** `sessions`, `coffees`, `roasters`, `places`, `preferences`.
- **AI:** `explore-agent` (Sonnet 4.6) with tools: `search_places`, `fetch_page`, `analyze_image`, `suggest_navigation`. Plus the helper context blocks: recent recipes, live preferences, coffee library (last 30 bags), roaster priors (up to 5).
- **Notes:** **Only view with a redesign spec** (`docs/redesign/spec.md` v0.1). Phase 1–3 of the redesign cover this surface. Voice + chat + sources + attachments are all DOT-translated to dark per the spec.

### `/library`
- **Purpose:** navigation hub — links to library, sessions, insights.
- **Data:** none on the page itself; it's a router.
- **AI:** none.
- **Notes:** Likely the simplest redesign target — it's nav, not content.

---

## Strategic anchors (for chat context)

These come from CLAUDE.md and the existing redesign spec — included here so the strategy chat can reference them without loading every doc:

- **Single user, iPhone PWA.** No multi-user isolation needed. Wake-lock + safe-area-inset are real concerns.
- **No external UI libraries.** Every component is bespoke (`CLAUDE.md` Conventions + Explicitly NOT Wanted).
- **Tailwind only.** No inline styles except `safe-area-inset-*`.
- **Editorial / premium tone.** No emojis in UI.
- **Migration mode is view-by-view, not big-bang.** `docs/redesign/spec.md` v0.1 is scoped to the chat surface; other surfaces get spec addenda when their phase starts.
- **Stack is fixed:** Next.js 14 App Router + Postgres + Drizzle + Hetzner. No Vercel, no Supabase, no rewrite.
- **Three Claude models in production:** Opus 4.7 (recommend, engineered for Opus), Sonnet 4.6 (analyze-bag, match, explore, escher), Haiku 4.5 (everything cheap).
