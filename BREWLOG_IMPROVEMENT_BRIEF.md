# BrewLog — Combined Improvement Briefing

## Situation

MacBook SSD failed — 10 days of code lost. Code is being recovered from Vercel
deployment `82RzzAfVC`. Once recovered and pushed to GitHub, the improvements
below are the first priority.

Two threads converge here:

1. Fixing how session nuance (ratings, "brew again," occasion) reaches Claude
2. Adding a two-stage interpretive layer so Claude's output matches the richness of the input

They share one principle: **stop flattening**. Let nuance travel end-to-end.

---

## The Deeper Principle

Taste is multidimensional. What transfers from past sessions to a new
recommendation is not "honey process = X rating."

It is patterns across the full intersection:

  roaster × origin × variety × process × water × method
  × grind × occasion × what was actually tasted

The data model already captures this richness. Two things break it:

1. The history summary compresses too aggressively before Claude sees it
   (Improvements 1 & 2 address this)
2. The output flattens too aggressively on the way back to the user —
   binary recommendations, "method × origin" verdicts, no "yes, but"
   (the translation layer addresses this)

**Goal: give Claude the full picture on input, and let Claude return nuance
on output. Do not pre-filter by category on either side.**

---

## Improvement 1 — "Would you brew again?" is misunderstood

**Current behaviour:** interpreted as "this method with this origin again?"

**Intended meaning:** "This specific coffee, from this specific roaster, on this
occasion, with this exact recipe — again?" The full combination matters.

**What to fix:**
- `wouldUseMethodAgain` is the wrong field name — rename to `wouldBrewAgain`
- The question wording shown to the user
- How it is used in the history summary passed to Claude

**Implementation notes:**
- Rename in `TasteResult` interface; make optional for backward compat with old Firestore docs
- Read sites use: `s.result?.wouldBrewAgain ?? (s.result as any)?.wouldUseMethodAgain`
- Zod schema in `sessions/route.ts` accepts both field names during migration window
- UI label ("Would you brew this again?") is already correct — no wording change needed
- Update history summary text from "would NOT repeat this method" → "would not brew again"

---

## Improvement 2 — Ratings have nuance that gets lost

**The problem:**
- 3★ is not bad. 3.5★ is good.
- A 3★ on a rushed morning brew of an unfamiliar coffee is not the same
  as a 3★ on a carefully dialled-in session.
- The current history summary flattens craft, fit, occasion, and free notes
  into a single star rating before Claude sees it.

**What to fix:**
- History summary carries craft, fit, occasion, free notes, `wouldBrewAgain` — not just stars
- Preserve roaster / origin / variety / process / water / method / grind per session
- Recommendation prompt asks Claude to reason across the full combination,
  not treat ratings as a scale

**Five new fields for `buildHistorySummary`:**
- `s.coffee.roaster` — roaster identity
- `s.coffee.variety` — cultivar if set
- `s.context?.occasion` — morning-ritual / focus / experiment / after-dinner / social
- `s.recommendation?.primaryRecipe?.grindSize` — grind setting actually used
- `s.context?.waterSource` — tap / diluted

**Prompt addition for `recommend.ts`:**
```
- Reason across the full combination: craft × fit × occasion × grind × water.
  · craft=exceptional + fit=not-my-style = style mismatch, not quality failure
  · craft=off = likely execution — check grind and water before changing bean
  · occasion=morning-ritual + low rating = not a morning driver; try as experiment
  · grind drift without rating improvement = extraction problem, not a bean problem
  · water=tap + low rating on washed light = water chemistry suppressing delicacy
```

---

## Improvement 3 — Translation Layer (new)

Even with Improvements 1 and 2, Claude's output currently reads informational.
The goal is nuanced, "yes, but" prose that matches the input's richness.

**Architecture: two-stage pipeline.**

### Stage 1 — Retrieval & pattern extraction (structured)

Existing `recommend.ts` and `explore/route.ts` logic, plus a new pattern-detection
pass over the full log. Output: a JSON object containing:

- `recent_activity` — last N brews/beans with full parameters (not flattened)
- `patterns` — recurring behaviors detected across the full log
- `query_context` — what the user asked, if any

**Pattern detection** (`src/lib/claude/patterns.ts` — new file, pure computation + Firestore cache):

| Signal | Detection logic |
|--------|----------------|
| Oscillation | Grind setting drifting without converging for the same bean (≥ 4 sessions, sign changes in delta) |
| Return patterns | Roasters/origins abandoned and re-bought; same flavor complaint recurring across different coffees |
| Rating-behavior mismatch | High-rated beans not re-ordered; low-rated bought repeatedly; high stars + `wouldBrewAgain=false` or vice versa |
| Craft-vs-fit divergence | Sessions where craft=exceptional but fit=not-my-style, or craft=off but fit=my-kind |
| Parameter-preference correlation | Grind/ratio ranges that correlate with highest self-ratings, per origin or process |
| Occasion-dependent preference | Coffees/methods that perform differently on rushed mornings vs. dialled-in sessions |
| Vocabulary drift | Flavor descriptor frequency shifting over time (split log in half, compare frequencies) |

**Caching:** Store computed result in Firestore at `insights/patterns`. Staleness check: session count. Re-run on new session write (fire-and-forget), not per query. Gate: minimum 5 sessions — below this, pattern claims are thin.

### Stage 2 — Translation (interpretive)

New file `src/lib/claude/translate.ts`. Consumes Stage 1 JSON and returns:

- `narrative` — the prose the user sees
- `substrate` — structured signals used (for UI elements, debugging; never the primary answer)

**Voice requirements (encode in system prompt):**
- Nuanced, comparative, willing to contradict stated preferences when the log says otherwise
- No binary recommendations. No "you should." Prefer: "you've been," "this reads like," "worth testing whether"
- Coffee vocabulary: body, brightness, structure, extraction phases, origin character
- Comfortable with "yes, but"
- 2–4 sentences per observation. Total: 3–6 sentences. Never pad.
- No markdown, no bullets, no headers, no emojis
- Reference specific numbers from the log

**Example of desired tone:**

> You've been grinding finer on the Tim Wendelboe Kieni over three weeks and
> rating each cup lower. The log reads like overextraction of a coffee you want
> to stay bright — the last two brews at your finest settings scored below your
> Kieni average, and your highest-rated pours were two clicks coarser with a
> slightly shorter drawdown. Worth opening the grind back up before changing the
> dose or ratio.

**Fallback:** If `patterns.sessionCount < 5`, skip the Stage 2 Claude call and
return `recommendation.reasoning` as the narrative directly.

---

## Files to Change

| File | Change |
|------|--------|
| `src/lib/types/session.ts` | Rename `wouldUseMethodAgain` → `wouldBrewAgain`; add `narrative?`/`substrate?` to `Recommendation` |
| `src/components/flow/StepLog.tsx` | Update field key |
| `src/store/flowStore.ts` | Update field key |
| `src/app/api/sessions/route.ts` | Zod schema accepts both names; cache invalidation after write |
| `src/lib/claude/historyUtils.ts` | Compat read + 5 new history fields + updated "brew again" text |
| `src/lib/claude/recommend.ts` | Prompt addition + Stage 2 wiring |
| `src/app/api/recommend/route.ts` | Fetch pattern cache; pass to `generateRecommendation` |
| `src/app/api/explore/route.ts` | Inject patterns JSON into system prompt (no second Claude call) |
| `src/components/flow/StepRecommend.tsx` | Show `rec.narrative \|\| rec.reasoning` |
| `src/lib/claude/patterns.ts` | **NEW** — pure pattern detection + Firestore cache |
| `src/lib/claude/translate.ts` | **NEW** — Stage 2 Claude call (`claude-sonnet-4-6`, max 600 tokens) |

---

## Order of Work

1. Recover code from Vercel deployment `82RzzAfVC` → push to GitHub
2. Set up resilient dev environment (Codespaces, Vercel connected to GitHub)
3. Improvement 1 — rename field, update storage and history summary
4. Improvement 2 — expand history summary; update recommendation prompt
5. Improvement 3a — `patterns.ts` (pattern detection module)
6. Improvement 3b — `translate.ts` + integration in `recommend.ts`, `sessions/route.ts`, `explore/route.ts`, `StepRecommend.tsx`
7. Later: evaluate European stack (Supabase Frankfurt + Cloudflare Pages)

The ordering matters: 1 and 2 feed 3. Doing the translation layer before fixing
the input compression would just produce nuanced prose over flattened data —
worse than the current state, because it would read confident while being thin.
