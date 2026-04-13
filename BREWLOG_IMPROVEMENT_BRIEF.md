# BrewLog — Improvement Briefing

## Situation
MacBook SSD failed — 10 days of code lost. Code is being recovered from Vercel
deployment `82RzzAfVC`. Once recovered and pushed to GitHub, these improvements
are the first priority.

---

## Improvement 1 — "Would you brew again?" is misunderstood

**Current behaviour:**
The question is interpreted as "this method with this origin again?"

**Intended meaning:**
"This specific coffee, from this specific roaster, on this occasion,
with this exact recipe — again?"

The full combination matters, not just method × origin.

**What to fix:**
- The question wording shown to the user
- How the answer is stored in the session data
- How it is used in the history summary passed to Claude

---

## Improvement 2 — Ratings have nuance that gets lost

**The problem:**
- 3★ is not bad. 3.5★ is good.
- A 3★ on a rushed morning brew of an unfamiliar coffee is completely
  different from a 3★ on a carefully dialled-in session.
- The current history summary flattens all of this before it reaches Claude.

**What to fix:**
- The history summary should carry context: craft rating, fit rating,
  occasion, free notes — not just the star rating.
- Claude should reason over the full combination, not treat ratings
  as a simple scale.

---

## The Deeper Principle

Taste is multidimensional. What transfers from past sessions to a new
coffee recommendation is not "honey process = X rating."

It is patterns across the full intersection:

  roaster × origin × variety × process × water × method
  × grind × occasion × what was actually tasted

The data model already captures all of this richness.
The problem is that the history summary compresses it too aggressively
before it reaches Claude, and the recommendation prompt does not ask
Claude to reason across all dimensions.

**Goal: give Claude the full picture. Trust it to find the patterns.
Do not pre-filter by category.**

---

## Files to Change

| File | What to look at |
|------|----------------|
| `src/lib/claude/historyUtils.ts` | History summary fed into Claude prompts — needs to carry more dimensions |
| `src/lib/claude/recommend.ts` | Recommendation system prompt — needs to ask for cross-dimensional reasoning |
| `src/lib/types/session.ts` | `TasteResult` interface — `wouldUseMethodAgain`, `craft`, `fit`, `attribution` |

---

## Order of Work

1. Recover code from Vercel deployment `82RzzAfVC` → push to GitHub
2. Set up resilient dev environment (Codespaces, Vercel connected to GitHub)
3. Implement these improvements
4. Later: evaluate move to European stack (Supabase Frankfurt + Cloudflare Pages)
