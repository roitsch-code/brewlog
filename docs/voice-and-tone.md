# Voice & Tone — BTTS

> **Source of truth for writing decisions in BTTS.** Voice is constant; tone shifts per situation. The CLAUDE.md "Explicitly NOT Wanted" section sets a few writing rules (no emoji, etc.) that this doc treats as load-bearing.
>
> When new copy is written or AI-generated text is reviewed, this doc is the rubric. When a system prompt for `/api/greeting`, `/api/recommend`, `/api/brew-insight`, `/api/insights`, or `/api/explore-agent` is edited, the relevant constraints below should appear in the prompt.

---

## 1. What BTTS sounds like

Three anchors. Every piece of copy in the app should be reconcilable with all three.

1. **A knowledgeable friend, not a coach.** Speaks to someone who already cares about coffee. Doesn't motivate, congratulate, or grade. Comments on what's in front of both of you.
2. **Pragmatic.** The brand name is the philosophy: brewing well is the goal, perfection isn't. When something goes sideways, route around it. Don't apologize, don't dramatize.
3. **Editorial, not playful.** Fraunces 40 px headlines + Chivo body set the register — magazine-essay, not chat-app. Sentences are direct. White space carries weight. Wit lives in restraint, not punchlines.

Voice test: read the sentence aloud. If it sounds like something you'd say to a friend over coffee about coffee, it passes. If it sounds like an automated email, a hype-Twitter caption, or a fitness-app push notification, it fails.

---

## 2. What BTTS doesn't sound like

Explicit avoids. Treat these as bugs.

- **Coach-bro:** "let's nail this brew", "level up your pour", "you've got this", "crush that bloom".
- **Wellness-app:** "savor the moment", "breathe with your coffee", "honor the bean".
- **Enterprise-SaaS:** "submit", "kindly review", "we appreciate your patience", "an error has occurred".
- **Apologetic:** "oops!", "uh-oh", "sorry about that", "please try again", "we're sorry but…". Calm direct statements only.
- **Folksy:** "cuppa", "java", "joe", "brew up", "brewski".
- **Hype-default:** "stunning", "delicious", "beautiful" used as filler. If a cup IS stunning, name what makes it so.
- **Emoji.** Anywhere. Not in copy, not in AI replies, not in commits, not in PR titles. (CLAUDE.md "Explicitly NOT Wanted".)
- **Exclamation marks** — reserve for genuine personal-record moments only. The default punctuation is a period.
- **Generic interjections:** "Hey there!", "Welcome back!", "Hi friend!". The greeting Haiku is specific — use it; never paper over it with a generic.
- **HTTP codes, error IDs, stack-trace fragments user-side.** Always.

---

## 3. Tone by situation

Voice stays constant; the dial that moves is **warmth × imperative × brevity**. This table is the dial.

| Situation | Warmth | Imperative | Brevity | One-line guidance |
|---|---|---|---|---|
| Home greeting | high | low | medium | Warm, curious, time-of-day-aware. Reference something specific the user owns. |
| Recipe recommendation | medium | medium | high | Grounded. Name the principle. One sentence, 40–60 words. |
| Active brew (timer, pour guide) | low | high | maximum | Hands are busy. "Pour to 60g." not "Now go ahead and pour to 60g of water." |
| Post-brew insight | medium | low | high | Friend-observation, not graded feedback. One thing you noticed; one thing to try. |
| Error / failure | low | medium | high | Calm. State what happened. Give the next move. No apology. |
| Empty state | medium | low | medium | Explain the mechanism — how content lands here, not just that it isn't here yet. |
| Destructive confirmation | low | high | high | Title is the question; buttons answer it with verbs. |
| Coach card (insight) | medium | medium | high | Observation row + suggestion row. Different visual weights. Optimized for scanning. |
| Chat reply | medium | low | medium | Conversational, reasoned. Show the working when comparing or picking. |
| Loading state | low | low | maximum | Present-progressive + ellipsis. "Reading the session…" Not "Loading…". |

---

## 4. Vocabulary

| Use | Don't use |
|---|---|
| Brew (verb + noun) | Brew up, brewski |
| Coffee, bag, cup | Beans (when the user means a bag), cuppa, java, joe |
| Recipe, dose, water, ratio | Formula, blend (of pour params), "the way we make it" |
| Roaster | Brand, producer (producer means the farm) |
| Notes (tasting, free, bag) | Flavors-and-stuff, your impressions |
| Drawdown, bloom, agitation, grind | Settling, breathing, mixing, fineness |
| Niche degrees with the `°` symbol | "About 25 on the Niche" |
| Specific named techniques: Kasuya 4:6, Hoffmann V60 1-Cup, Wölfl Orea Fast | "Some Japanese guy's recipe", generic gestures |
| Try, brew, pour, swirl, log, save, delete | Kindly, please, would you, if you could |
| Save Brew, Delete Coffee, Retry, Choose Other | OK, Submit, Confirm, Yes, No, Done |

Coffee jargon stays when it's load-bearing — TDS, EY, ratio, drawdown, bloom, agitation, dose, percolation, immersion. Don't translate down. The user is the audience and the user knows the words.

---

## 5. Patterns that apply everywhere

Apply on every surface, regardless of where you're writing.

1. **Verb the action in buttons.** "Save Brew" not "OK". "Delete Coffee" not "Yes". "Retry" not "Try Again". (Apple's alert rule: if a user only reads the button labels, they should still understand what they're choosing.)
2. **No apology, no "please".** Calm direct statements. The system is fine; the user is fine; describe what happened. ✗ "Failed to save — please try again." ✓ "Couldn't save this brew. Try again — your notes are still here."
3. **Specific beats generic.** ✗ "Something went wrong." ✓ "Couldn't read this photo. Try again or enter the details manually."
4. **No technical bleed.** No HTTP status codes, no error IDs, no stack fragments. Resolved errors describe consequence + next step in plain English.
5. **Front-load purpose.** The first 5–8 words of any screen establish what it's for. Hero pattern: eyebrow + Fraunces question is the canonical implementation.
6. **One thought per line for loading copy.** "Reading the session…" is enough. Don't pile on "Loading your data, this may take a moment, please be patient".
7. **Lower-case + ellipsis for present-progressive.** `Saving…` / `Analyzing bag…` / `Crafting your recipe…` Not `SAVING` or `Saving (please wait)…`.
8. **Title case for buttons.** `Save Brew`, not `save brew` or `SAVE BREW`.
9. **American English.** `Analyzing`, `color`, `behavior`. The codebase already leans this way — keep it consistent. (PR #283 fixed a stray "Analysing" in `PhotoUpload.tsx`.)
10. **Read it aloud.** From Apple's UX-writing talk and applicable verbatim. If you'd never say it to a friend, change it.

---

## 6. Worked examples by surface

Real BTTS surfaces with positive (✓) and negative (✗) versions. The positive versions live in the current codebase except where marked.

### Home greeting (Haiku-driven, `/api/greeting`)

✓ "Morning. The Friedhats Quiquira's been in rotation a week — try it cooler today?"
✓ "Late afternoon — Yossa Rojos is sitting at three weeks, still in the window."
✗ "Good morning, coffee lover! Ready to brew something amazing? ☕️"
✗ "Hey there! What can I help with today?"

### Recipe reasoning (`/api/recommend`)

✓ "Naturals like this Sidra carry their fermentation right in the ester profile, so an 88 °C extraction at 1:16 holds the fruit without amplifying any vinegary edge — Kasuya's logic for going leaner on naturals applies even on a non-4:6 recipe."
✗ "We picked this recipe because it's great for natural coffees!"
✗ "This recipe will give you the best results for this coffee."

Rule (from CLAUDE.md): one substantive sentence, 40–60 words, grounded in a named coffee-science principle.

### Active brew — timer and pour guide (`LightStepBrew`)

✓ "Pour to 60g. Swirl gently."
✓ "Steep 1:30. Then press."
✗ "Now go ahead and pour up to 60g of water, then don't forget to swirl gently!"
✗ "Time to start your bloom phase, get ready!"

### Post-brew insight (`/api/brew-insight`)

✓ "The Sidra ran 4 seconds long — second pour might've been heavier than the recipe planned."
✓ "Grind drifted a click coarser than your last Quiquira brew; that may be why the cup read thinner."
✗ "Great brew! Just one tiny thing to work on next time."
✗ "Your extraction was slightly off-target. Consider adjusting your technique."

### Errors (`LightStepSummary`, `LightStepScan`)

✓ "Couldn't read this photo. Try again or enter the details manually." (`LightStepScan.tsx:194`, PR #283)
✓ "Couldn't save this brew. Try again — your notes are still here." (`LightStepSummary.tsx`, PR #283)
✓ "Couldn't pull details from that page. Try a different URL or enter the details manually." (`LightStepScan.tsx:314`, PR #283)
✗ "Save failed (500)" — leaks HTTP code.
✗ "Failed to save — please try again" — apologizes; no actionable info.
✗ "Oops! Something went wrong analyzing your photo. Please try again."

### Empty states

✓ "No coffees yet. Coffees you scan — and drip bags you log — appear here." (`/coffees`)
✓ "No archived conversations yet. Send a message on Home, leave the app idle for 30 minutes, and it lands here." (`/past-conversations`)
✓ "Log and rate a few more brews — the coach needs at least four rated sessions to spot a cross-axis pattern." (`/taste`)
✓ "All clear. Coach is watching for the next pattern." (`/taste`, Coach empty)
✗ "Nothing here yet — check back soon!"
✗ "No data available."
✗ "Nothing strike your fancy?" (Apple's own negative example — whimsical, doesn't explain.)

Rule: explain the mechanism. The user should know how content lands in this view next time, not just that it's empty today.

### Destructive confirmation

✓ Title: "Delete this conversation?" Buttons: `Delete` / `Cancel`. (`/past-conversations/page.tsx`)
✓ Title: "Remove this brew session?" Buttons: `Remove Session` / `Cancel`.
✗ Title: "Are you sure?" Buttons: `Yes` / `No`.
✗ Title: "Confirm Cancellation" Buttons: `Confirm` / `Cancel`. (Apple's own negative example — ambiguous which is destructive.)

Rule: the destructive button's label is a verb phrase that answers the title's question. Cancel is always literal cancel, not a destructive action.

### Coach card (insight) — `CoachCard`, `CoffeeCoachCard`

✓ Observation: "Your low-rated brews share a common thread: temperature 90 °C or below on naturals."
✓ Suggestion: "Try 92–94 °C on the next natural and see if the fruit holds up."
✓ Actions: `Save to try` / `Confirmed` / `Doesn't apply` (New stage) — `It helped` / `Didn't help` / `Skip` (Saved stage).
✗ Single-paragraph: "We've noticed your low-rated brews all use temperatures of 90 °C or below on natural coffees, so we suggest you try 92–94 °C on your next natural and see if that helps."
✗ Action labels: `OK` / `Dismiss` / `Maybe Later`.

Rule: two-paragraph structure with different visual weights (already implemented). Action labels name what each action does — never `OK`.

### Chat reply (`/api/explore-agent`)

✓ "Between the Quiquira and the Yossa Rojos: the Quiquira is the lighter cup (jasmine, white peach), and you've been craving structure lately. The Yossa Rojos has more body — go with that."
✗ "Brew the Yossa Rojos."
✗ "Either would be a good choice."

Rule (from CLAUDE.md "Reasoning on internal picks"): when choosing between things the user owns, briefly name each candidate and what it brings to the criterion before declaring the pick.

### Loading states

✓ `Reading the session…` (`LightStepSummary.tsx`)
✓ `Crafting your recipe…` (`LightStepRecommend.tsx`)
✓ `Looking up roaster profile…` (`LightStepScan.tsx`)
✓ `Analyzing bag…` (`PhotoUpload.tsx`, fixed from `Analysing` in PR #283)
✗ `Loading…` (generic — anthropomorphize the thing actually happening)
✗ `Please wait while we process your request…`

Rule: present-progressive verb describing the actual action, ellipsis, lower-case after the first word, ≤ 4 words.

---

## 7. For AI-generated copy (system prompts)

When editing prompts for `/api/greeting`, `/api/recommend`, `/api/brew-insight`, `/api/insights`, `/api/explore-agent`, bake these constraints into the system text. They are NOT inferable from a "voice description" — they need to be stated.

- **Forbid:** apologies (`please`, `sorry`, `oops`, `uh-oh`, `we're sorry`), generic interjections (`hey there`, `welcome back`), emoji, exclamation marks (one exception: personal records).
- **Forbid:** HTTP codes, technical IDs, internal field names, stack-trace fragments.
- **Forbid:** hype-default adjectives (`stunning`, `delicious`, `beautiful`) used as filler. If a cup IS one of those, the prompt must require naming what makes it so.
- **Require:** verb-the-action in any embedded suggestion. `Try X` not `You might want to consider trying X`.
- **Reasoning paragraphs:** one substantive sentence, 40–60 words, grounded in a named principle (already required in `recommend.ts`).
- **Chat replies on picks:** name each candidate and what it brings before declaring the pick (already in `explore-agent` Response Style).
- **Tone-shift on errors / failures inside AI replies:** calm, direct, no apology — same rule as static UI copy.

When the prompt itself describes the brand: `"You are BTTS — Better taste than sorry. You're the user's knowledgeable friend about coffee — pragmatic, editorial, not a coach."` (The exact brand line lives at the top of `/api/explore-agent`; keep it consistent.)

Behavioral changes to AI-generated copy are subject to the CLAUDE.md "AI behavior changes" hard rule — they get their own commits so they can be reverted cleanly. This doc itself is descriptive and stable; updating an example here is not a behavioral change. Editing a prompt to match this doc IS one, and gets its own commit.

---

## 8. Self-test before shipping copy

Walk through this list before merging any copy change.

1. **Read it aloud.** Does it sound like the brand?
2. **Apology check.** Any `please`, `sorry`, `oops`, `uh-oh`, `kindly`, `we're sorry`?
3. **Emoji check.** Anywhere?
4. **Verb-the-action check.** Do every button label and every embedded suggestion name the action?
5. **Specific check.** Would the user know what just happened?
6. **Front-load check.** Does the first sentence of the screen establish purpose?
7. **Edge-case check.** Is the failure copy in the same voice as the success copy?
8. **Jargon check.** Is the coffee jargon load-bearing? If yes, keep it. If no, simplify.
9. **Spelling check.** American English. `Analyzing`, `color`, `behavior`.
10. **Length check.** Could this be 30% shorter without losing meaning? If yes, cut.

---

## 9. Where examples live in code

For traceability when a positive example above needs to be updated:

| Surface | File |
|---|---|
| Home wordmark + greeting consumer | `src/app/(light)/page.tsx` |
| Greeting prompt | `src/app/api/greeting/route.ts` |
| Recipe reasoning prompt | `src/lib/claude/recommend.ts` |
| Active brew timer + pour guide | `src/components/flow/LightStepBrew.tsx` |
| Post-brew insight prompt | `src/app/api/brew-insight/route.ts` (Haiku) |
| Save error copy | `src/components/flow/LightStepSummary.tsx` |
| Scan error copy | `src/components/flow/LightStepScan.tsx` |
| Empty states — Coffees | `src/app/(light)/coffees/page.tsx` |
| Empty states — Past conversations | `src/app/(light)/past-conversations/page.tsx` |
| Empty states — Taste | `src/app/(light)/taste/page.tsx` |
| Empty states — Offline | `src/app/(light)/offline/page.tsx` |
| Destructive confirmation patterns | `src/components/session/SessionCard.tsx`, `/past-conversations/page.tsx` |
| Coach card | `src/components/coach/CoachCard.tsx`, `src/components/coach/CoffeeCoachCard.tsx` |
| Chat reply Response Style block | `src/app/api/explore-agent/route.ts` |
| Loading copy | `LightStepRecommend.tsx`, `LightStepSummary.tsx`, `LightStepScan.tsx`, `PhotoUpload.tsx` |
