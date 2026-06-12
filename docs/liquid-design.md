# Liquid / motion design — BTTS fluidity system

> **Working doc, not a one-off.** Lives in the repo so every new Claude Code session sees the
> current state via the `@./docs/liquid-design.md` reference in CLAUDE.md. Updated **in-place**
> at the end of every session that advances the motion work, in the same commit as the code
> (session-log entry + any new Stolperstein + the dials table kept honest). When this doc
> disagrees with the code, the code wins — and the next action is to fix the doc, not work
> around it.
>
> **Audience:** the owner directs ("make the background bigger / the haiku slower"); a Claude
> session executes. So this doc is built around **dials** — "to change X, edit constant Y in
> file Z" — not prose theory. Find the dial, change the number, ship.

---

## Status & next entry-point

*Updated at the end of every advancing session. Read this first.*

- **Shipped & live:** living Field background (static base gradient + 4 drifting colour blobs +
  film grain + finger-following bloom) and the liquid welcome-haiku (shimmer → scattered
  per-word spring entrance → soft dissolve → per-word touch lens). All motion is on the GPU
  compositor; React is never in the per-frame loop. Reduced-motion gracefully static.
- **Last tuned (2026-06-12):** extracted the haiku entrance into a reusable `LiquidHeadline` —
  the Hero questions ("What are you brewing today?", "What's the vibe?") now scatter in, and the
  recipe-crafting screen dropped the bean glow + "Did you know?" for a big rotating insight
  (scatter in → hold → dissolve DOWN = the opposite of the haiku → next). Refreshed `COFFEE_HINTS`
  to short, headline-sized lines. The `+` attachment card is now dark chrome. (Earlier same day:
  deep blobs re-anchored so strong colour wanders into the headers; all-dark floating home chrome;
  welcome haiku sticks through the `+` sheet and returns on cancel.)
- **Most-likely next asks (owner taste, on-device):** background bigger/smaller still →
  `FieldBlobs.tsx` dials; haiku faster/slower → `HaikuStarter.tsx` dials; finger glow
  stronger/weaker → `FieldBloom.tsx` + `useFieldMotion.ts`. See **Tuning dials** below.
- **Open polish (not yet built):** smooth per-step Field rotation in `LightFlowShell` (it
  currently snaps 25° per brew step), `NavigationOverlay` fade, the deferred "bold tier"
  quicksilver-lens distortion. See **Open / deferred**.

---

## The one rule that cost the most: keyframes go IN the component, never in globals.css

**If continuous motion "works in the browser but is dead in the installed PWA," this is why.**

`@keyframes` that an element runs *continuously* (the blob drift, the haiku entrance) must be
**co-located in the component** via styled-jsx:

```tsx
<style jsx global>{`
  @keyframes blobflow-1 { ... }
`}</style>
```

NOT in `src/app/globals.css`. The installed iOS PWA precaches the compiled stylesheet, and the
service worker serves that **stale** copy even after the JS bundle updates — so new/renamed
keyframes in `globals.css` silently don't exist for the element that references them. The class
animates against a missing keyframe = no motion, no error. This is the exact bug that produced
"the haiku moves but the background is dead" (the haiku keyframes were already co-located; the
blob keyframes were in globals.css). Fixed by moving the blob keyframes into `FieldBlobs.tsx`
(renamed `blob-drift-*` → `blobflow-*` so the dead globals.css copy can't shadow them).

Corollary the owner must know: **after every deploy, force-quit the PWA and reopen it** to drop
the cached shell. A normal reopen reuses the cache. (Document this in any "I don't see the
change" exchange — it's almost always the cache, not the code.)

Static, paint-once keyframes that don't change between releases (`haiku-shimmer`,
`haiku-dissolve`) can stay in globals.css — they were cached correctly from day one and never
rename. The rule is specifically about keyframes you **iterate on**: keep those in the component.

---

## Architecture

### Two motion sources, both off the React render loop

1. **Autonomous drift** — slow `@keyframes` on `transform` only (translate/rotate/scale). The
   GPU compositor runs these; no repaint, no JS. This is the STARIS "flowing mesh" — blobs
   drifting on their own clocks.
2. **Interactive nudge** — `useFieldMotion` (one `requestAnimationFrame` loop) writes CSS custom
   properties (`--field-*`, `--ptr-*`) on the Field root. The layers *read* those vars in their
   inline `transform` / `opacity`. So pointer-lean, scroll-parallax, tap-swell and the finger
   bloom all move on the compositor with **zero React re-render**. Raw events only stash target
   values; the rAF loop eases `cur += (target − cur) * GLIDE` toward them — that easing is what
   sells "fluid" over "twitchy."

`FieldContext` is untouched by all of this — it still carries the per-coffee `fieldZones` +
discrete `rotation`. Motion is purely DOM/CSS-var, never through React context or state.

### The Field layer stack (`Field.tsx`)

```
<div ref={useFieldMotion()} fixed inset-0 -z-10 isolation:isolate>   ← motion root, writes the vars
  <div translate3d(0, var(--field-shift-y), 0)>                      ← scroll-parallax wrapper
    1. base   — composeFieldGradient(zones, rotation), blur(60px), scale(1.2)   ← static floor
    2. blobs  — <FieldBlobs/>  4 drifting radial-gradient discs (the visible flow)
    3. grain  — <FieldGrain/>  static feTurbulence noise, mix-blend soft-light
  </div>
  4. bloom    — <FieldBloom/>  warm glow that follows the finger (viewport coords, no scroll-shift)
</div>
```

Each blob is **three nested divs** (the "wrapper trick"): outer reads the interaction vars
(`--field-drift-*`, `--field-tilt`, `--field-pulse`); middle runs the `blobflow-*` drift
keyframe (transform-only, no filter → compositor); inner is the blurred colour disc, painted
once and merely moved. A single element can't both run a keyframe transform *and* add a
var-driven transform, so the layers split them. Keyframe translate uses **vmax** (not %) because
the drift layer is zero-size — a `%` translate would resolve to 0.

### The haiku lifecycle (`HaikuStarter.tsx`)

`shimmer skeleton` (while `/api/greeting` is empty) → **liquid entrance** (each word an
`inline-block` span that springs in from a scattered, non-left-to-right order with an overshoot,
via `haiku-pop-1/2/3`) → **settle** (after the entrance, the per-word `animation` is dropped so
its `both` fill stops pinning `filter`, freeing the touch lens) → **dissolve** (`usePresence`
keeps the node mounted through `haiku-dissolve` when the user starts composing, instead of a
hard unmount). Once settled, dragging a finger over the line runs a **per-word touch lens**:
each `[data-hw]` span blurs by its distance to the fingertip (`blur = MAXB·max(0, 1 − d/FALLOFF)`)
on one rAF — so only the words under the finger smudge, not the whole poem.

The words stay `inline-block` spans for the haiku's **entire** life (entrance → settled →
dissolve). Swapping to a single text node mid-life re-wraps the line and hyphenates
("stone-fruit" jumped a line) — don't.

---

## File map

**Background (the living Field)**

| File | Role | Dials it owns |
|---|---|---|
| `src/components/ui/light/Field.tsx` | Assembles the layer stack; attaches `useFieldMotion`. | base `blur(60px)`, `scale(1.2)`, `inset-[-12%]` (the oversize that gives parallax room) |
| `src/components/ui/light/FieldBlobs.tsx` | The 4 drifting colour discs + their `blobflow-*` keyframes (co-located). **The main "background movement" surface.** | disc size (`vmax`), `blur`, `blobflow-*` travel (`vmax`), `DRIFT` durations |
| `src/components/ui/light/FieldGrain.tsx` | Static film grain (feTurbulence data-URI). | `opacity` (~0.09), `mixBlendMode` (`soft-light`), tile size |
| `src/components/ui/light/FieldBloom.tsx` | Warm glow that follows the finger. | disc `vmax`, gradient colours/stops, `blur`, opacity = `var(--ptr-on)` |
| `src/hooks/useFieldMotion.ts` | One rAF loop: pointer-lean / scroll-parallax / tap-swell / finger-bloom → CSS vars. | `MAX_DRIFT`, `MAX_TILT`, `SCROLL_PARALLAX`, `MAX_SHIFT`, the `*_GLIDE` easings, `IDLE_MS` |
| `src/lib/field/composeGradient.ts` | Pure: zones → base gradient string **and** `fieldBlobColors(zones)` (the 4 blob colours + positions). | `BASE_DESAT`, `BASE_DIM`, `RADIAL_ALPHA_BOOST/CAP`, `BLOB_ALPHA`, `BLOB_SAT_BOOST` — **the "warm but richer" palette**; the blob `cx/cy` anchors |

**Foreground (the welcome haiku)**

| File | Role | Dials it owns |
|---|---|---|
| `src/components/ui/light/HaikuStarter.tsx` | Shimmer → entrance → dissolve → touch lens; owns the `haiku-pop-*` keyframes (co-located). Home welcome-haiku ONLY (it has the touch-lens). | `STAGGER_MS`, `POP_MS` (entrance speed), `EXIT_MS` (dissolve), `DISTURB_MAX_BLUR`, `DISTURB_FALLOFF` (lens) |
| `src/components/ui/light/LiquidHeadline.tsx` | The haiku's per-word scatter entrance, extracted + reusable (NO touch-lens). Owns `lh-pop-*` + `lh-out-*-up/down` keyframes (co-located) + reduced-motion gate. **Exit is the entrance in REVERSE** — each word retreats one after another (last word in, first out), scattered + staggered, NOT a whole-line fade; `dissolveDir` only sets where they drift ("down" sinks/shrinks = the opposite of the haiku's up-float). Per-word duration via the `--lh-dur` CSS var so timings are prop-driven. Used by `Hero` (entrance only, `as="h1"`) and the recipe-crafting insight. Keyed on `text` so it replays the entrance whenever the headline changes. | props `popMs` / `staggerMs` / `exitMs` (per-instance speed); `LH_POP_MS` / `LH_STAGGER_MS` (Hero defaults); `liquidEntranceMs` / `liquidExitMs` helpers; the `lh-out-*` translate/scale (the "opposite" feel) |
| `src/components/flow/LightStepRecommend.tsx` | Recipe-crafting loading screen: a `LiquidHeadline` insight deck (shuffled `COFFEE_HINTS`) shown big (Fraunces 40), one at a time — scatter-in, hold to read, leave word-by-word in reverse (sinking down), next sets up. Slow + calm on purpose. Pinned-top status is `<CraftingStatus>` (replaced the bean glow + the uppercase-grey "CRAFTING…" / "Did you know?" eyebrow). | `INSIGHT_POP_MS` 1000 / `INSIGHT_STAGGER_MS` 110 / `INSIGHT_EXIT_MS` 850 / `INSIGHT_READ_MS` 4800 (the settled read time); the deck size (`shuffleSubset(…, 12)`); `max-w-[15ch]` (wrap width) |
| `src/components/ui/light/CraftingStatus.tsx` | Recipe-screen status line — black, sentence-case (card-title style) + animated 1-2-3 ellipsis. Cycles a `phases` list (passed in) and HOLDS on the last; the list is the **real per-bean factors** (`buildCraftingPhases` in `src/lib/craftingPhases.ts` — origin/process/variety/roast/freshness/mood/time/water/method → reference recipes → grind+temp → pours → "Adapting it to your beans"), personalized to the scanned coffee's own values, generic fallback otherwise (never fabricated). Paced to span the real ~minute, not 7s. Co-located styled-jsx keyframes + reduced-motion gate. | `buildCraftingPhases` (the walk + wording), `PHASE_MS` 4800 (advance speed), the `craft-d1/2/3` dot keyframes |
| `src/components/ui/light/Hero.tsx` | Page hero — animates the question via `LiquidHeadline` when it's a plain string. The scan / context / log questions now **vary between visits** (`nextHeroQuestion` in `src/lib/heroQuestions.ts`, localStorage rotation; set in a mount effect so SSR stays stable and the scatter-in plays once). | whether a hero animates (string vs JSX); the variant lists in `heroQuestions.ts` |
| `src/hooks/usePresence.ts` | Generic delayed-unmount `(present, exitMs) → {mounted, state}`. Replaces framer-motion AnimatePresence. Backs both `HaikuStarter` and `LiquidHeadline`. | — |
| `src/app/(light)/page.tsx` | Renders the haiku as an absolute overlay over `ChatThread`; `showStarter = messages.length===0 && !composing` (declarative — NOT a one-way latch, so the haiku returns when a draft clears). | when the haiku shows / dissolves (the `composing` flag) |
| `src/components/ui/light/ChatInput.tsx` | Reports `onComposingChange(isCompositionActive)` — true only with a real draft (text / photo / coffee / uploading). Opening the `+` sheet or a bare mic tap is NOT composing, so the haiku sticks; clearing the draft re-runs its entrance. The `+` sheet is overlaid (`absolute bottom-full` in a `relative` input row) so opening it doesn't grow the footer and shove the centred haiku up. | what counts as "composing" (dismisses the haiku) |

**Shared CSS** — `src/app/globals.css`: `haiku-shimmer`, `haiku-dissolve` (static, used), the
`prefers-reduced-motion` disable block (`[data-field-blob]`, `.haiku-word`, `.haiku-exit`,
`.haiku-shimmer`), and the `--field-*` var defaults under `[data-light-scope]`.
**Dead, safe to delete in a cleanup pass:** `blob-drift-1..4` and `haiku-settle` keyframes —
superseded by the co-located `blobflow-*` / `haiku-pop-*` and referenced by nothing.

**Tests** — `tests/dataflow/field-gradient.test.mjs` (esbuild-bundles the real
`composeGradient`; asserts determinism, layer count, 4 blobs, alpha cap). Motion itself isn't
unit-testable; the CI screenshot job only captures the *resting* frame.

---

## Tuning dials — "I want X, change Y"

> All values below are the **current** shipped values. Push in the stated direction. After any
> change: `tsc` → PR → merge → **force-quit & reopen the PWA** to see it.

### Background movement (the STARIS "bigger / larger areas" requests)

`src/components/ui/light/FieldBlobs.tsx`:

| Want | Dial | Now | Direction |
|---|---|---|---|
| **Bigger sweeps** (blobs travel further) | the `vmax` numbers inside `@keyframes blobflow-1..4` | ~24–32 vmax | ↑ for more, ↓ for calmer. Keep ≲ disc-size so a blob never fully clears the screen. |
| **Where the strong colour sits** (top vs bottom) | the `cx/cy` anchors in `fieldBlobColors()` (`composeGradient.ts`) | deep blobs at `cy 24` (upper-left, behind the wordmark) + `cy 82` (lower-left) | drop a deep `cy` for more top colour; raise it to keep colour low. This is the "wander into the headers" dial. |
| **Colour into the top, via motion** | the negative-Y peaks in `blobflow-2`/`-4` (the deep-blob keyframes) | `-32vmax` / `-26vmax` | ↑ (more negative) sweeps the deep blobs further up + off the top edge |
| **Larger areas / patterns** | inner disc `width`/`height` | `78vmax` | ↑ for bigger soft fields, ↓ for tighter blobs |
| **Softer / more mesh-like** | inner disc `filter: blur()` | `38px` | ↑ softer, ↓ crisper |
| **Slower / faster flow** | the `s` durations in `DRIFT[]` | `23/29/26/33s` | ↑ slower (STARIS is slow), ↓ faster. Keep them co-prime-ish so the composite doesn't visibly re-sync. |
| **More "breathing"** | the `scale(...)` in `blobflow-*` | ~0.82–1.26 | widen the spread |
| **More / fewer blobs** | `fieldBlobColors()` in `composeGradient.ts` (returns 4) + the `DRIFT`/keyframe count | 4 | keep `DRIFT.length` ≥ blob count |

**Do NOT change colour/intensity for a "make it more alive" ask** — the owner's standing
instruction is *"bigger movements / larger areas, **not colorwise**."* Richness lives in
`composeGradient.ts` (`BLOB_ALPHA`, `*_SAT_BOOST`, `RADIAL_ALPHA_*`); only touch those if the
ask is explicitly about colour.

### Pointer / scroll reactivity

`src/hooks/useFieldMotion.ts`:

| Want | Dial | Now |
|---|---|---|
| Background leans more toward the finger | `MAX_DRIFT` (px) | `22` |
| More tilt under the finger | `MAX_TILT` (deg) | `2.5` |
| Stronger scroll parallax | `SCROLL_PARALLAX` / `MAX_SHIFT` | `0.18` / `90px` |
| Snappier vs. floatier follow | the `*_GLIDE` constants (smaller = floatier) | `GLIDE 0.08`, `PTR_GLIDE 0.28` |
| Finger glow lingers longer when still | `IDLE_MS` | `1100` |

Finger-glow look itself: `src/components/ui/light/FieldBloom.tsx` (disc `vmax`, the warm
`radial-gradient` colours/stops, `blur`). Opacity is driven by `--ptr-on`, don't hardcode it.

### Haiku entrance / exit / lens

`src/components/ui/light/HaikuStarter.tsx`:

| Want | Dial | Now |
|---|---|---|
| **Entrance slower / faster** | `STAGGER_MS` (gap between words) + `POP_MS` (each word's duration) | `64` / `770` |
| More / less scattered order | the LCG in `scatterDelays()` (seed `1337`) | shuffled |
| Springier / calmer pop | the overshoot keyframes `haiku-pop-1/2/3` (the `~60%` overshoot row) | scale ~1.05–1.08 |
| Dissolve slower / faster | `EXIT_MS` | `280` |
| Touch lens stronger / wider | `DISTURB_MAX_BLUR` (px) / `DISTURB_FALLOFF` (px radius) | `6` / `85` |

Total entrance time ≈ `wordCount × STAGGER_MS + POP_MS` (the `ready` timer that frees the lens
uses exactly this).

---

## Reduced motion

Every effect is gated on `prefers-reduced-motion: reduce`:
- `useFieldMotion` early-returns before attaching any listener (vars stay neutral) and re-checks
  on the media-query `change` event, so toggling iOS Accessibility live disables it.
- The haiku touch-lens effect early-returns; the entrance/exit are disabled by the
  `@media (prefers-reduced-motion: reduce)` block in `globals.css` (`.haiku-word`, `.haiku-exit`,
  `.haiku-shimmer`, `[data-field-blob]` → `animation: none`).

When adding any new motion, add its selector to that globals.css block in the same change.

---

## Verification

- `npx tsc --noEmit` — first gate (the hooks, the `fieldBlobColors` export, the page wiring).
- `node --test` — `tests/dataflow/field-gradient.test.mjs` guards `composeGradient` determinism;
  keep it green when touching the palette dials.
- **CI screenshots** (Playwright, mobile `/`) — confirms no crash and the *resting* frame /
  shimmer renders. **Blind to motion, 60fps, reactivity, blend-mode, and reduced-motion** — those
  are static-frame blind spots.
- **The only real test is the iPhone PWA** (perf claims only hold there): smooth flow with no
  scroll stutter; lean/parallax/tap gentle not lurchy; grain reads as tooth not haze; haiku
  shimmer→entrance→dissolve feels liquid; finger lens smudges only the words it passes. **Always
  force-quit & reopen first** (cache). Toggle iOS *Reduce Motion* → everything static.

---

## Open / deferred

- **Voice no longer dismisses the haiku prematurely** (2026-06-12) — `startVoice` used to
  `markComposed()` on the bare mic tap, killing the haiku before a word was spoken (and for good
  if you cancelled). Now it waits for `onTranscript`. If the owner later wants the haiku to stay
  visible *during* recording AND fade only on send, that's a further step.
- **Smooth per-step Field rotation** — `LightFlowShell` snaps the Field 25° per brew step
  (scan 0° → context 25° → …). A CSS transition on the rotation would make it glide. Cheap,
  natural fast-follow; not yet done.
- **`NavigationOverlay` fade** — the full-screen menu hard-mounts; a `usePresence` fade (the hook
  already exists) would match the rest.
- **Bold tier (deferred, taste-risky):** `feDisplacementMap` "quicksilver lens" distortion on the
  haiku / Field — the maximal tier the owner explicitly did *not* pick for the first slice. Needs
  WebGL / SVG-filter work; comment hooks were noted in the original plan.
- **globals.css cleanup:** delete the dead `blob-drift-1..4` + `haiku-settle` keyframes.

---

## Stolperstein log

*Every trap hit once goes here so a future session reads it before starting.*

- **Stale PWA stylesheet cache** (the big one) — continuously-iterated `@keyframes` in
  `globals.css` get served stale by the installed PWA even after the JS updates → motion silently
  dead with no error. Fix: co-locate iterated keyframes in the component (`<style jsx global>`).
  Always force-quit/reopen the PWA after deploy. (PR #296.)
- **`%` translate on a zero-size drift layer resolves to 0** — the middle "drift" div has no
  intrinsic size, so a `translate(20%, …)` keyframe moves nothing. Use `vmax`. (PR #296.)
- **Single text node re-wraps + hyphenates the haiku** — swapping per-word `inline-block` spans
  for one node mid-life caused "stone-fruit" to break and jump a line. Keep the spans for the
  haiku's whole life. (PR #293.)
- **Whole-poem blur on touch** — computing finger distance to the paragraph box blurred the
  entire haiku. Fix: per-word distance to cached span centres (`[data-hw]`). (PR #296.)
- **Animating a blurred full-viewport `background` div stutters on iOS** — never animate the base
  gradient's `background` or slide the whole base. Float transform-only blob layers over a static
  base instead (the core architecture). (Original plan.)

---

## Session log

*Newest at the bottom; a glance at the tail shows current state. Keep entries tight.*

### 2026-06-12 — fluidity polish + this hand-over doc
- **Done:** created this doc and wired it into CLAUDE.md (auto-load via `@./docs/liquid-design.md`
  + a "Liquid / motion design" section + inventory rows for `FieldBlobs/Grain/Bloom`,
  `HaikuStarter`, `useFieldMotion`, `usePresence`). Slowed the haiku entrance a notch
  (`STAGGER_MS 52→64`, `POP_MS 680→770`). Enlarged the home Field movement — disc `48→66vmax`,
  blur `30→34px`, `blobflow-*` travel ~×1.45, durations `15/19/17/23 → 23/29/26/33s` (bigger,
  larger-area, slower flow; colours untouched per the owner's "not colorwise"). Fixed the welcome
  haiku vanishing on a bare mic tap — `startVoice` no longer `markComposed()`s; the haiku now
  survives recording and dissolves only when a transcript lands.
- **Open / next:** owner eyeballs on the iPhone PWA (force-quit/reopen first) and says whether the
  background wants to go bigger still / the haiku slower still — both are one-number changes in the
  dials table. Then optionally: smooth Field rotation, NavigationOverlay fade.
- **Traps found:** — (all pre-existing, logged above).
- **PRs this session:** (number assigned on open)

### 2026-06-12 — strong colour into the top + all-dark floating chrome
- **Done (background):** the *deep* blobs were anchored low (cy 86/48) so strong colour was
  pinned to the lower screen. Re-anchored in `fieldBlobColors()` to span the full height — one
  deep blob upper-left (`cy 24`, behind the wordmark/header), one kept low (`cy 82`); widened the
  `blobflow-*` sweeps (~24–32vmax) and biased the deep-blob keyframes UP (`blobflow-2` −32vmax,
  `blobflow-4` −26vmax) so colour wanders through the headers; discs `66→78vmax`, blur `34→38px`
  for the "beyond the screen" overflow. Positional/scale only — `BLOB_ALPHA`/saturation untouched,
  so `field-gradient.test.mjs` stays green. New dials-table rows document the anchor + upward-sweep
  levers.
- **Done (chrome — separate concern, owner picked "all-dark"):** new `shadow-light-float`
  elevation token (`tailwind.config.ts`); the home Burger, the `+`/clear/cancel round controls,
  the whole chat bar and the Action Pill went solid anthracite + cream icons/text + the lift, with
  the in-bar send/mic/remove-X/chip inverted to cream-on-dark. Same dark+lift swap applied to the
  `h-11 w-11` header buttons across every `(light)` route + the NavigationOverlay close for
  consistency. Detail-page photo-hero buttons + pop-over menus left cream (different context). Not
  a motion change — logged here only because it rides the same liquid-design pass.
- **Open / next:** owner eyeballs both on device. Background: bigger-still / lower-still are
  one-number anchor+sweep tweaks. Chrome: shadow softness is the `light-float` token.
- **Traps found:** — (ChatInput edit-ordering footgun handled in-session: invert inner
  `bg-light-foreground text-light-text-on-dark` BEFORE swapping the glass controls to it, or the
  new control class gets re-inverted by the substring match).
- **PRs this session:** (number assigned on open)

### 2026-06-12 — welcome haiku: sticks through the + sheet, returns on cancel
- **Done:** the haiku used a one-way `interacted` latch (flipped true on first focus/photo/etc.,
  never reset) — so once you poked the `+` sheet and backed out, it stayed gone on an otherwise
  empty screen. Replaced with a **declarative** model: `ChatInput` reports
  `onComposingChange(isCompositionActive)` (true only with a real draft — text/photo/coffee/
  uploading; NOT a bare mic tap, NOT an open `+` sheet), and the page computes
  `showStarter = messages.length===0 && !composing`. The existing `usePresence` + `ready`
  machinery already re-runs the scatter entrance when `show` flips back true, so the haiku
  **returns with its setup animation** when a draft clears. Removed the dead
  `markComposed`/`composeStartedRef`/`onComposeStart` plumbing. Also fixed the **"jump"**: the
  `+` `AttachmentSheet` was in the footer flow, so opening it grew the footer and shoved the
  centred haiku up — it's now overlaid (`absolute bottom-full` inside a `relative` input row), so
  the footer height is constant and the haiku stays put.
- **Open / next:** owner verifies on device — `+` → sheet (haiku stays put), X out → haiku
  re-enters; type → dissolve; mic tap → haiku stays until a transcript lands. Note: focusing the
  empty field no longer dissolves the haiku on its own (only real content does) — flag if you
  want the old focus-dissolve back.
- **Traps found:** the latch had a THIRD setter (`handleSend` set `interacted=true` post-send) +
  a conversation-load setter — both removed; `messages.length>0` already hides the starter.
- **PRs this session:** (number assigned on open)

### 2026-06-12 — reusable LiquidHeadline: Hero entrance + recipe-crafting insight + dark + card
- **Done:** extracted the welcome-haiku's per-word scatter entrance into
  `src/components/ui/light/LiquidHeadline.tsx` (co-located `lh-pop-*` + `lh-dissolve-up/down`
  keyframes + reduced-motion gate, NO touch-lens; `as` prop keeps the Hero an `<h1>`; keyed on
  `text` so it replays on change). `HaikuStarter` left untouched (it keeps its lens). **Hero** now
  animates the question when it's a plain string — converted the 5 flow callers from
  `question={<>…</>}` to `question="…"` ("What are you brewing today?", "What's the vibe?", "How
  was it?", "Where are you?", "Log a drip bag."). **Recipe-crafting screen** (`LightStepRecommend`)
  dropped `CoffeeBeanGlow` + the "Did you know?" 13px ticker for a big `LiquidHeadline` insight that
  scatters in, holds `liquidEntranceMs(words)+2600`ms to read, then dissolves DOWN (the opposite of
  the haiku's up-float) before the next sets up; a small "Crafting your recipe…" eyebrow stays
  pinned top so the wait reads as working. Insights pulled straight from `COFFEE_HINTS` (no
  `/api/hints` round-trip) — **rewrote that file** from 284 long em-dash facts to ~56 short,
  headline-sized, fact-checked lines (BTTS voice; no fabricated specifics per the Hard Rule).
- **Open / next:** owner eyeballs on device (force-quit/reopen). Tunables flagged: dwell read-buffer
  (2600ms), wrap width (`max-w-[15ch]`), whether to keep the "Crafting your recipe…" eyebrow, and
  the `lh-dissolve-down` direction. Confirm the short insight set reads right / wants more entries.
- **Traps found:** Hero questions were JSX fragments, not strings — a string-only animator needs
  the callers converted (and `coachQuestion` at LightStepLog:538 is a `CoachQuestionSheet` prop,
  NOT a Hero — left alone).
- **PRs this session:** (number assigned on open)

### 2026-06-12 — recipe insight: slower, per-word reverse exit, longer hold (+ scroll-to-top fix)
- **Done (motion):** the rotating recipe insight read as stressful — too fast, and the dissolve was
  a one-shot whole-line fade. Reworked `LiquidHeadline`'s exit to be the **entrance in reverse**:
  each word retreats one after another (last word in, first out), scattered + staggered, drifting in
  the `dissolveDir` direction (recipe = "down", sink + shrink). Made all timings prop-driven via a
  `--lh-dur` CSS var (so the Hero stays snappy at the defaults while the recipe is slow). Recipe now
  runs at `INSIGHT_POP_MS` 1000 / `INSIGHT_STAGGER_MS` 110 / `INSIGHT_EXIT_MS` 850 and holds
  `INSIGHT_READ_MS` 4800ms fully settled before leaving (was ~2600 + a 360ms whole-line fade). Added
  `liquidExitMs()` so the rotation waits exactly until every word has gone.
- **Done (scroll — separate concern, same session):** "How was it?" (and every step) opened at the
  previous step's scroll offset. Root cause: the app scrolls inside `ScrollContainer` (a 100dvh
  overflow div in the root layout), but `LightFlowShell` reset `window.scrollTo(0)` — a no-op on the
  real scroller. Fix: `ScrollContainer` now resets itself to top on every route change (`usePathname`)
  and exports `SCROLL_CONTAINER_ID`; `LightFlowShell` resets that element by id on step change (window
  call kept as a fallback). All pages/steps now open at the top.
- **Open / next:** owner eyeballs the new pace on device — `INSIGHT_*` are all one-number dials if it
  wants to go slower/faster or hold longer still.
- **Traps found:** `window.scrollTo` is a no-op when the real scroller is a custom overflow container
  that persists in the root layout — reset the element, and also on `usePathname` for route changes.
- **PRs this session:** (number assigned on open)

### 2026-06-12 — recipe status line + varying hero questions + image consistency + scan width + map colour
- **Done (motion-ish):** new `CraftingStatus` replaces the uppercase-grey "CRAFTING YOUR RECIPE…"
  eyebrow on the recipe screen — black, sentence-case (card-title style), with a cycling phase line
  + an animated 1-2-3 ellipsis (co-located keyframes, reduced-motion gated). Hero questions for
  scan/context/log now alternate between a few phrasings (`src/lib/heroQuestions.ts`, localStorage
  rotation, set in a mount effect — empty-initial so SSR stays stable and the `LiquidHeadline`
  scatter-in plays once).
- **Done (non-motion polish, same PR):** shared `BagPhoto` (rounded-3xl inset + cream scrim) now on
  coffee-detail, Save-brew, and (shape-matched) the scan preview, so the bag image is consistent.
  Scan content width fixed (removed a redundant inner `px-5` that double-padded it ~40px narrower).
  Nearby map tiles re-tinted from flat cream toward a soft rose/peach (fruity/floral) via the
  `.leaflet-tile-pane` filter — owner wants "away from cream"; cautious first step, values are dials.
- **Open / next:** the broader **"get rid of cream"** is a flagged future pass (cream is the Light
  system's foundation — background, card glass, scrims, tokens). On device, tune: `CraftingStatus`
  `PHASES`/`PHASE_MS`, the hero variant wording, the map `saturate`/`hue-rotate`.
- **Traps found:** the hero pick must run in a mount effect, not render — `localStorage`/random in
  render causes an SSR hydration mismatch + a double scatter-in.
- **PRs this session:** (number assigned on open)

### 2026-06-12 — crafting status = real per-bean factor walk (not fake steps) + coffee-detail controls off the photo
- **Done (status):** the recipe wait is ONE blocking Opus call (~30–60s, no streamed sub-steps —
  `recommend.ts:983`, `max_tokens 5000`), so the old 4 generic phases raced through in ~7s on the 2.4s
  timer then hung on "Adapting it to your beans" for the rest. Owner's call: not streaming, not
  stretching the same four — **walk the real factors that build the two recipes for THIS bean**. New
  pure `src/lib/craftingPhases.ts` `buildCraftingPhases(coffee, context)` returns an ordered list using
  the coffee's OWN stored values (origin/region/process/variety/roast/freshness/mood/occasion/time/
  water/method) with generic fallbacks on empty/"Unknown"/"Other" (no fabrication), then the real build
  steps (pull reference recipes → grind+temp → pours → hold on "Adapting it to your beans").
  `CraftingStatus` now takes a `phases` prop and `PHASE_MS` 2400→**4800** so the walk spans the real
  minute; `LightStepRecommend` memoizes the list from `draft.coffee`/`draft.context`. Test:
  `tests/dataflow/crafting-phases.test.mjs` (bundles the real helper — personalization, fallbacks,
  freshness, the held tail).
- **Done (coffee detail):** the back + burger were overlaid ON the rounded bag photo (#303). Moved them
  into a flex header row ABOVE the photo, over the Field, and onto the standard dark header treatment
  (`bg-light-foreground`/`text-light-text-on-dark`/`shadow-light-float`, `w-11 h-11`) for legibility +
  consistency with every other `(light)` route. Photo sits below.
- **Open / next:** on device, tune `craftingPhases` wording / `PHASE_MS`; confirm the detail header
  spacing. The broader "less cream" pass still pending.
- **Traps found:** — (`buildCraftingPhases` only ever shows stored values; placeholder guard prevents
  "the Other process" / "Unknown variety" leaking).
- **PRs this session:** (number assigned on open)
