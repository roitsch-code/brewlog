# BTTS (BrewLog) — Architecture & AI Inspiration Reference

> **Purpose.** A single, self-contained map of how BTTS is built, written to **inspire a different
> project**. It is faithful to the code (every concrete claim is traceable to a file path), but each
> mechanism is also restated as a **domain-agnostic `Transferable pattern`** you can lift into any app.
>
> **How to read it.**
> - *Human:* skim the headings and the `Transferable pattern` callouts; section 1 is the one-screen map,
>   section 10 is the "steal this" checklist.
> - *LLM:* each section is `What it does → How it works (mechanics + snippet/diagram) → Transferable
>   pattern`. The data-model appendix (§9) and the checklist (§10) are the machine-actionable summary.
>
> **Honesty note.** Numbers that drift between releases (recipe-corpus counts, exact grinder degrees)
> are described as mechanics, not asserted as precise — the project's "never fabricate parameters" rule
> applies to this doc too. Where a figure matters, the code path is named so it can be re-checked.
>
> **Companion docs:** `docs/coffee-experts.md` (the knowledge corpus), `docs/liquid-design.md` (the Field
> motion system), `docs/voice-and-tone.md` (AI copy rules), `docs/ios-shell-roadmap.md` (the native shell).
> The root `CLAUDE.md` is the operating manual.

---

## 1. TL;DR — the one-screen map

BTTS ("Better taste than sorry") is a **single-user** coffee brew advisor + diary, shipped as a
**Next.js 14 (App Router) PWA** backed by **Postgres (Drizzle ORM, JSONB-heavy)** and **Claude**, deployed
on a **Hetzner VPS** (Docker Compose), with a **Capacitor iOS shell** wrapping the live site.

It is, underneath the coffee, a study in three reusable ideas:

1. **A generative background painted from content semantics.** Each coffee's free-text *tasting notes*
   are mapped — by a cheap one-shot LLM call — onto a tiny fixed perceptual vocabulary (6 colour "zones"),
   persisted as a weights vector, and rendered **deterministically** into a living gradient. The whole UI
   "wears" the coffee. (§4 — the centerpiece.)
2. **A multi-tier "coach" that learns from a logged corpus** and turns model output into **user-curated,
   durable memory** via an explicit status state machine, with anti-hallucination contracts ("cite a real
   count") and preservation rules so regeneration never erases what the human endorsed. (§5.)
3. **A tool-using chat that terminates into actions, not just talk.** Two "terminal action" tools let a
   conversation *start a real task* (drop the user into the brew timer with an exact recipe) or *write a
   durable learning* (save coach advice), each gated by a human tap. (§6.)

Everything else — the model fleet (§3), the verified knowledge layer (§7), and the end-to-end iterative
loop (§8) — exists to serve those three.

---

## 2. System architecture at a glance

| Layer | Choice | Notes |
|---|---|---|
| **UI / routing** | Next.js 14 App Router, single `(light)` route group | One design system ("BTTS Light"): Cream base, Fraunces/Chivo type, anthracite ink, generative Field background. |
| **State** | Zustand (`flowStore`), localStorage-persisted | Survives a mid-brew reload; the multi-step brew flow is a state machine in the store. |
| **Data** | Postgres + Drizzle ORM | Nested objects (coffee / context / recommendation / brew / result) live in **JSONB**, so TypeScript types persist unchanged. Feed order via an indexed `createdAtMs DESC`. |
| **AI** | `@anthropic-ai/sdk`, three model tiers | See §3. Server-side only; routes in `src/app/api/*`. |
| **Knowledge** | Typed TS corpus in `src/lib/knowledge/*` | Recipes / varieties / techniques, `verified`-flagged, injected per request. See §7. |
| **PWA / native** | `@ducanh2912/next-pwa`, Capacitor 8 iOS shell | The iOS app is a remote-URL shell loading the live site, so web changes reach both instantly. |
| **Infra** | Hetzner VPS, Docker Compose (postgres/app/caddy/ofelia), GitHub Actions auto-deploy | Cron jobs via Ofelia; SQL migrations via a manual GitHub Actions workflow. |

**API surfaces (the request map).** The core is `sessions` (CRUD over the brew diary) and `coffees`
(library). The AI surfaces are `recommend` (recipe generation), `explore-agent` (the home chat),
`greeting` (daily starter), `insights` + `coffees/[id]/insight` (the coach), `analyze-bag` / `analyze-url`
(vision + scrape ingestion), and a handful of Haiku helpers (`taste-summary`, `brew-insight`, `translate`).

**The single-user design choice — code-canonical profile.** BTTS has exactly one user and always will, so
there is **no onboarding and no settings screen to depend on**. The owner's equipment, grinder, water, and
taste are **constants in code**: `CANONICAL_PROFILE` (`src/lib/claude/userProfile.ts`) builds the cached
"About you" prompt block, and `CANONICAL_EQUIPMENT` (`src/lib/knowledge/recipes/helpers.ts`) filters recipe
selection. `/recommend` **unions** the stored DB preferences with the code constants so a stale DB row can
never hide an owned brewer.

> **Transferable pattern — collapse configurability you don't need.** For a single-tenant or
> opinionated-default app, hard-code the "profile" as typed constants and treat the DB as an optional
> override, not the source of truth. You delete an entire onboarding/settings surface and remove a class of
> "stale config" bugs. Union (don't replace) when a DB value exists.

---

## 3. The model fleet — which Claude does what, and why

BTTS tiers models by **reasoning depth required**, not by defaulting to the biggest. (Model IDs verified in
code; they are the app's choices, independent of whichever model authored this doc.)

| Task | File / route | Model | Why |
|---|---|---|---|
| Recipe generation (2–4 candidates) | `recommendPrompt.ts` (`RECOMMEND_MODEL`), `recommend.ts:514` | **`claude-opus-4-7`** | Deep, multi-axis reasoning: roast × process × freshness × method, two *divergent* candidates each with a justified hypothesis + observation. Prompt-cached system block. |
| Corpus coach insights | `insights.ts:380` | **`claude-opus-4-7`** | Multivariate pattern detection over the whole session corpus without inventing. |
| Per-coffee coach card | `coffeeInsight.ts:166` | **`claude-opus-4-7`** | One bag, grounded in its own history + priors. |
| Home chat agent | `explore-agent/route.ts:909` | **`claude-sonnet-4-6`** | Real-time, multi-turn, tool-using; balances quality × latency × cost; streams. |
| Bag vision, escher, coach-question | (analyze-bag, etc.) | **`claude-sonnet-4-6`** | Structured extraction / short reasoning. |
| Daily greeting | `greeting/route.ts:254` | **`claude-haiku-4-5`** | One conditional line from structured context; cheap, daily. |
| **Notes → Field zones** | `mapNotesToZones.ts:98` | **`claude-haiku-4-5`** | Tiny classification into a fixed vocabulary; `T=0`, 256 tokens, ~$0.0001/coffee. |
| taste-summary, translate, hints, roaster style, research | (various) | **`claude-haiku-4-5`** | Fast, cost-sensitive helpers. |

**Prompt-cache discipline.** The Opus `/recommend` system prefix is kept **byte-stable** across deploys so
the ephemeral cache key holds; the per-turn variation (coffee details, priors, injected insights) lives in
the *user* message, not the system block. (This is why `grindSettings.ts` is intentionally **not** imported
into the prompt — the grind reference is inlined to keep the cached prefix immutable; recalibrating means
editing the constants file *and* the prompt block in lockstep.)

> **Transferable pattern — a tiered model fleet + an immutable cached prefix.** Route each task to the
> smallest model that clears its reasoning bar (classification → small; conversation+tools → mid;
> multi-axis synthesis → large). Put everything stable in a cached system prefix and push all per-request
> variance into the user turn, so you pay full price only for novel tokens.

---

## 4. ★ The generative Field — a background painted from flavor notes

This is the idea most worth stealing. **Every coffee gets a unique, living background gradient derived from
its tasting notes**, so the home screen, the brew flow, and the cup's detail page all "wear" that specific
coffee. The motion is GPU-only; React is never in the per-frame loop.

### 4.1 The pipeline

```
tasting notes: string[]                      e.g. ["jasmine","bergamot","white peach"]
        │
        ▼  (one Haiku call, once per coffee, T=0)   src/lib/field/mapNotesToZones.ts
FieldZones { version, zones:[{id,weight}], modifiers:{saturation,lightness}, source, computedAt }
        │
        ▼  persist                                   coffees.field_zones  (jsonb, migration 0008)
        │
        ▼  pure + deterministic                      src/lib/field/composeGradient.ts
   ┌────────────────────────────────┬───────────────────────────────────────┐
   │ composeFieldGradient(zones,rot)│ fieldBlobColors(zones)                 │
   │  → CSS gradient "sandwich"     │  → 4 drifting disc colours+anchors     │
   └────────────────┬───────────────┴───────────────────┬───────────────────┘
                    ▼                                    ▼
            static base layer                  living motion layers (FieldBlobs)
                         \__________  Field.tsx  __________/
                                  + FieldGrain + FieldBloom (finger glow)
```

The expensive step (the LLM call) happens **once, at ingest time**, and is cached forever in the DB. Every
render is pure math over the persisted vector — so the background is both *unique per coffee* and *cheap to
paint*.

### 4.2 The 6-zone perceptual palette

The fixed vocabulary the notes are mapped onto. Each zone is a band in **hue × saturation × lightness**
(`src/lib/field/zones.ts`):

| Zone id | Exemplar aromas | Hue | Sat | Light | Role |
|---|---|---|---|---|---|
| `fruity-bright` | citrus, lemon, berry, cherry, peach | 0–30° | high | high | bright citric/berry |
| `fruity-deep` | dried fruit, date, raisin, plum, port | ~350–375° (wraps) | mid | mid | fermented fruit warmth |
| `floral` | jasmine, rose, lavender, bergamot | 320–355° | mid | high | perfumy, high-lightness |
| `nutty-cocoa` | chocolate, cocoa, nut, malt | 20–40° | low-mid | low | rich, warm, dim |
| `spice-earth` | cinnamon, tobacco, leather, cedar, smoke | 25–45° | low | low | dry, earthy |
| `sweet-caramel` | caramel, honey, vanilla, toffee, maple | 30–50° | high | mid-high | warm sweetness |

**The key design insight:** zones **overlap on hue on purpose** (fruity-bright and sweet-caramel both span
~30–50°). Differentiation comes from **saturation × lightness**, not hue. The whole palette is warm
(hues 0–60° + 320–360°) — it is engineered to **never read cold**, while a broadened lightness range
(≈25–90%) still allows a dim cocoa-bomb Brazil to look different from a luminous floral Geisha.

### 4.3 The Haiku mapping call (notes → weighted zones)

`mapNotesToZones(notes, source)` — `src/lib/field/mapNotesToZones.ts`:

- **Model** `claude-haiku-4-5`, **`temperature: 0`**, **`max_tokens: 256`**, a fixed system prompt of
  exemplar aromas + texture modifiers; user message is literally `Notes: ${JSON.stringify(notes)}`.
- **Output** (Zod-validated, normalized): 1–3 zones whose weights sum to 1.0, plus global modifiers.

```ts
interface FieldZones {
  version: 1;
  zones: { id: ZoneId; weight: number }[];          // 1–3 entries, Σ weight = 1.0
  modifiers: { saturation: number; lightness: number }; // each ∈ [-15, +15]
  source: "tasting-notes" | "variety-implied" | "default";
  computedAt: string;                                // ISO
}
```

Texture words tilt the modifiers ("juicy/vibrant" → +saturation; "dense/heavy" → −lightness). On any
error the call returns `null` and the caller falls back to `DEFAULT_FIELD_ZONES`
(`src/lib/field/defaultZones.ts` — a fixed floral/sweet-caramel/fruity-bright blend). Cost ≈ $0.0001 per
coffee; **runs once per coffee**, never at render.

### 4.4 Gradient composition (deterministic render)

`composeFieldGradient(zones, rotationDeg)` is **pure** — same input → identical CSS string. It sorts the
top-3 weighted zones and stacks six layers: one dimmed/desaturated linear base wash plus five rotated
radial hotspots. Named, on-device-tunable "richness dials" (`src/lib/field/composeGradient.ts`):

| Dial | Value | Effect |
|---|---|---|
| `BASE_DESAT` | 8 | the linear base loses 8% saturation |
| `BASE_DIM` | 6 | the linear base loses 6% lightness |
| `RADIAL_ALPHA_BOOST` / `RADIAL_ALPHA_CAP` | 0.12 / 0.9 | each hotspot's alpha is boosted then clamped |
| `BLOB_ALPHA` | 0.62 | opacity of the drifting blobs (the living layer) |
| `BLOB_SAT_BOOST` | 12 | blobs are more saturated than the base so motion reads |

Three internal helpers do the work: `sampleZone(zoneId, huePos, satPos, lightPos)` interpolates a colour
anywhere inside a zone's range, `applyMods(hsl, mods)` shifts S/L by the global modifiers, and
`rotatePos(x, y, deg)` rotates a hotspot around the viewport centre.

### 4.5 Living motion (4 drifting blobs)

`fieldBlobColors(zones)` returns four `{ color, cx, cy }` discs spanning the full lightness range — bright
highlights anchored against deep shadows, because on a pale palette it's **moving light against dark**, not
hue, that makes drift visible (so saturation is boosted `+12`). Each blob is three nested divs (the
"wrapper trick"): an outer div reads interaction CSS vars, a middle div runs a transform-only `blobflow-*`
keyframe (compositor, no repaint), an inner div is the blurred colour disc painted once and merely moved.

`useFieldMotion` runs **one** `requestAnimationFrame` loop that writes `--field-*` / `--ptr-*` CSS vars
(pointer-lean, scroll-parallax, tap-swell, finger-following bloom); the layers *read* the vars in inline
transforms — **zero React re-render**. `LightFlowShell` rotates the Field 25° per brew step (scan 0° →
context 25° → … → summary 125°) as a progress signal; rotation moves positions + base angle, **never hues**.
All of it is `prefers-reduced-motion`-gated. (Full motion-tuning reference and the "keyframes must live
in the component, not `globals.css`, or the installed PWA serves them stale" trap are in
`docs/liquid-design.md`.)

### 4.6 Persistence & the anti-flash cache

`coffees.field_zones` (jsonb, migration 0008) is the source of truth. A small sessionStorage layer
(`src/lib/field/cache.ts`) pre-warms a session's zones when `/coffees/[id]` loads so that `/brew/[id]` —
which only learns the `coffeeId` after its fetch resolves — can paint the **right** Field from frame 1
instead of flashing the default for ~300 ms.

> **Transferable pattern — "semantic theming."** Map any content's free-text descriptors onto a *small,
> fixed perceptual vocabulary with weights* using one cheap LLM call; persist that vector; render it
> **deterministically** at request time. The LLM cost is paid once at ingest, the render is pure and
> infinitely cacheable, and every item gets a distinct yet on-brand visual identity. The domain is
> arbitrary — a song's mood → a cover gradient, a document's tone → an accent palette, a product → a vibe,
> a user's writing → an avatar. The discipline that makes it *feel designed* rather than random: a tiny
> curated vocabulary (not "any RGB"), differentiation on a secondary axis (here saturation×lightness, not
> hue), and a hand-tuned deterministic renderer with named dials.

---

## 5. Smart learning — the multi-tier coach

How BTTS learns from logged brews **without fabricating**. Three tiers feed one curated memory.

### 5.1 Tier 1 — corpus-wide insights (`insights.ts`, Opus)

Load rated sessions → pre-compute brew signatures + cross-session patterns (so the model gets *evidence*,
not raw rows) → Opus writes 5–8 **multivariate** observations. Two hard contracts:

- **Cite ≥2 axes.** "You like washed coffees" is forbidden; it must cross axes, e.g. *"19 of 28 washed
  brews scored 4★+ at peak freshness; only 3 of 9 past peak."*
- **Cite a real count.** Every observation must reference an actual number from the corpus.

Each insight carries `citationFields` (e.g. `["variety","freshness","rating"]`), a `suggestion` (a concrete
next move *or* a precise test question, never vague), and the `latestSessionMs` it was computed against —
which is the **cache key**: regeneration only runs when the corpus has advanced.

### 5.2 Tier 2 — per-coffee card (`coffeeInsight.ts`, Opus)

One bag's own history (recent sessions, the *actually-brewed* recipe, ratings, flavor notes) + its roaster
prior + variety prior → a single observation/suggestion card on `/coffees/[id]` (rotation-bags only).
Stored in `coffees.coach_insight` (jsonb, migration 0015). Cache key `(coffeeId, latestSessionMs)`;
crucially it is **not** regenerated while the user is mid-`trying`/`confirmed` — you never move the card
under someone who's acting on it.

### 5.3 Tier 3 — injection into `/recommend`

The top insights are selected by **`citationFields` overlap** with the current brew's attributes (variety /
process / roast / origin / locked method first, then recency) and injected into the recipe prompt **as
advice the model reasons *from*, not as instructions**. If an insight conflicts with coffee physics, the
prompt tells the model to *name the conflict in its reasoning and pick the better path*.

### 5.4 The insight status state machine

Both corpus and per-coffee insights share one state machine (`InsightStatus` in `schema.ts`), surfaced as a
**two-stage** card UI:

```
                 ┌────────────────────────────────────────────────────────┐
   Opus ───────► │  new                                                    │
                 │   ├─ "Save to try"  ─────────────►  trying              │
                 │   ├─ "Confirmed"    ─────────────►  confirmed (source→  │
                 │   │                                  user-confirmed)    │
                 │   └─ "Doesn't apply"────────────►  doesnt-apply         │
                 └───────────────┬────────────────────────────────────────┘
                  trying card:   │
                   ├─ "It helped"────► confirmed
                   ├─ "Didn't help"──► doesnt-apply
                   └─ "Skip"  ───────► snoozed (snoozed_until = now + 7d)
```

`InsightStatus = "new" | "trying" | "confirmed" | "doesnt-apply" | "snoozed"`.

**Preservation tiers on regeneration** (the part that makes it durable memory, not a feed):

- `source = 'user-confirmed'` → **kept verbatim, always** (a hand-saved or endorsed note is never deleted).
- any user-acted row (`trying` / `confirmed` / `doesnt-apply`) → kept verbatim.
- `snoozed` with `snoozed_until > now()` → kept (active snooze hidden from queues).
- `snoozed` with an **expired** `snoozed_until` → flows back in as if `new` (a second look is earned).
- `new` (Opus, untouched) → replaceable.
- A re-emitted similar observation **inherits the prior status** via an 80-char text match, so the same
  advice doesn't pop back as `new`.

**Query-time filter.** Before any prompt sees them, consumers exclude `doesnt-apply` and actively-snoozed
rows (`status != 'doesnt-apply' AND (not snoozed OR snoozed_until <= now())`).

> **Transferable pattern — "corpus → grounded observations → user-curated memory."** Turn raw logs into a
> small set of model-written observations under two contracts: **cross ≥2 dimensions** and **cite a real
> number** (the anti-hallucination clause). Then give the human a lightweight **status state machine**
> (try → confirmed/rejected/snoozed) so the model's output becomes *durable, user-owned knowledge*. The
> two rules that make it not-annoying over time: (1) **preservation tiers** so regeneration can't erase
> what the human touched, and (2) **text-match inheritance** so re-derived observations keep their prior
> verdict. Feed the confirmed memory back into the next generation, weighted by relevance.

---

## 6. Human-AI conversations — the chat that ends in actions

The home screen has an inline chat over `POST /api/explore-agent` — a streaming **Sonnet** agent loop
(≤8 tool roundtrips per turn). What makes it more than a chatbot is that **two of its tools commit to app
state**, so a conversation can *do* things.

### 6.1 Per-turn context injection

Each turn the route assembles a rich, grounded context block (so the chat answers with real numbers, not
guesses): the current **time bucket** (morning/midday/…); **today's greeting** (so the user can reference
"the greeting"); the **last 5 recipes with the actual dose/water/grind/temp/timing brewed**
(`buildRecentRecipes` in `historyUtils.ts`, reading the *actually-brewed* candidate via
`resolveBrewedRecipe`); the **most-recent brew**; the **owned bags each carrying an `id`** — the ★ rotation
bags *plus* the ~50 most-recent library bags, deduped — so any bag is linkable/brewable; **roaster priors**;
**variety priors**; the **technique vocabulary**; and the **reference recipe library**.

### 6.2 The tool set

| Tool | Kind | What it does |
|---|---|---|
| `search_places` | query | Search the café/roastery DB; diacritic-insensitive (`Düsseldorf`/`Dusseldorf`/`Duesseldorf` all match via a fold). |
| `fetch_page` | query | Retrieve a webpage (auto-resolves Shopify collections → `products.json`). |
| `analyze_image` | query | Download + visually analyze an image (bag photo → origin/process/notes). |
| `suggest_navigation` | UI | Propose an in-app destination (coffee detail, library, café map, taste profile, …). |
| **`start_brew`** | **terminal action** | Hand the chat's *exact* recipe to the brew timer — the user lands on Step "brew", no re-recommendation. |
| **`remember_advice`** | **terminal action** | Surface a tap-to-save "Remember this for …" pill that writes a durable coach note. |

### 6.3 The two terminal-action bridges

- **`start_brew` (chat → task).** When the reply lays out a complete recipe for a library bag, the model
  *must* call `start_brew` (a library link or "Brew again" is forbidden as the CTA for a written recipe).
  The recipe is run server-side through the **shared sanitizer** `sanitizePourSteps`
  (`src/lib/utils/pourSteps.ts` — the same one `/recommend` uses) so the brew timer renders identically;
  the tool's `destination` is set from the **tool name** (a subtle bug class: the tool input has no
  destination field). The bridge function is `startBrewFromChat` (`src/lib/flow/brewAgain.ts`).
- **`remember_advice` (chat → durable learning).** When the chat works out concrete, parameter-level
  guidance for a specific bag, it surfaces a pill. **Nothing persists until the user taps it.** On tap it
  POSTs to `/api/insights`, which writes *two* places: an insight row (`status='trying'`,
  `source='user-confirmed'`, with `citationFields` for ranking) **and** the targeted coffee's
  `coach_insight` card — so the advice both influences future `/recommend` calls and shows on that bag's
  detail page.

**Grounding discipline.** The recipe in `start_brew` must equal the prose exactly, and recipes are verified
against the structured corpus — the chat never free-hands pour arithmetic (it presents verified recipes,
scaling only grams). The brand voice ("BTTS — your knowledgeable friend about coffee, pragmatic, editorial,
not a coach") and the "show your reasoning when you pick between things the user owns" rule live in the
system prompt (see `docs/voice-and-tone.md`).

> **Transferable pattern — terminal-action tools + a human commit gate.** Give a chat agent a few tools
> that *commit to app state* — start a flow, write a memory, schedule a job — alongside the read/search
> tools. The conversation becomes a front-end to the app's real actions instead of a dead-end Q&A. Two
> safeguards make it trustworthy: (1) route the committed payload through the **same sanitizer/validator
> the rest of the app uses** so a chat-authored object behaves exactly like a first-class one, and (2)
> require a **human tap** before anything durable is written (the chat proposes; the user commits).

---

## 7. The knowledge layer & sourcing discipline

`/recommend` and `/explore-agent` are grounded in a **typed, citable corpus** under
`src/lib/knowledge/{recipes,varieties,techniques}` rather than facts baked into the prompt:

- **recipes** — championship + named-expert + experimental entries, each with structured pour mechanics,
  per-step durations, attribution, source, and a **`verified` flag**. `selectRecipes()` scores by context
  match (roast/process/variety/goal/occasion/vessel) and returns a diverse top-N; a **locked method**
  hard-filters to that brewer. Ranking is purely best-match — no pedigree bonus.
- **varieties** — ~25 WCR-grounded cultivar priors (genetics, agronomy, cup signature), `confidence`-tiered
  (`wcr-curated` / `industry-canonical` / `inferred`).
- **techniques** — ~25 atomic, id-addressable brewing moves, cross-referenced both ways to the recipes that
  exemplify them (enforced by a test), so the model can cite a *mechanism by id* and reach a worked example.

All three are injected per turn **without touching the cached system prefix** (cache-stable). The provenance
discipline is a project Hard Rule: *the codebase is not a source, aggregators are not primary sources, and
`verified: true` means cross-checked in-session against the originator's own publication.* (Full corpus:
`docs/coffee-experts.md`.)

> **Transferable pattern — a verification-tiered, retrievable knowledge base.** Keep domain facts in a
> typed module with **provenance as a first-class field** (`verified` / `confidence` + a source), retrieve
> the relevant slice per request, and inject it into the user turn (not the cached system block). The model
> reasons *from* citable, scoreable facts instead of from its weights, and "is this verified?" becomes a
> queryable property rather than a vibe.

---

## 8. The iterative loop, end to end

```
        ┌──────────────────────────────────────────────────────────────────────┐
        │                                                                        │
        ▼                                                                        │
  user brews a coffee ──► session logged (coffee · context · recipe · result)   │
        │                         │                                             │
        │                         ├─► greeting (Haiku) reflects rotation +       │
        │                         │   recent recipes next morning               │
        │                         │                                             │
        │                         ├─► per-coffee insight (Opus) regen when THIS  │
        │                         │   coffee gets a newer session               │
        │                         │                                             │
        │                         └─► corpus insights (Opus) regen when the      │
        │                             corpus latestSessionMs advances            │
        │                                                                        │
        ├─► home chat (Sonnet): remember_advice ──► user-confirmed memory ───────┤
        │                       start_brew ──────► drops into the brew timer     │
        │                                                                        │
        └─► next /recommend (Opus): injects curated insights (ranked by          │
            citationFields) + real brew history + roaster/variety priors ─► 2–4  │
            candidates ─► user picks, brews, rates ─► (loop) ────────────────────┘
                                  │
                                  └─ user acts on insight cards (try/confirm/reject/snooze)
                                     → memory curated → feeds the next /recommend
```

The data spine: `sessions` (JSONB diary, the corpus), `insights` (corpus memory + state machine),
`coffees.coach_insight` (per-bag memory), `preferences` (override layer over the code-canonical profile).
One small utility, `resolveBrewedRecipe(session)` (`src/lib/utils/resolveRecipe.ts`), is the **single source
of truth for "what the user *actually* brewed"** (the selected candidate, not the primary) — used by chat
history, timing stats, the offline cache, and brew detail so a whole bug class can't recur.

> **Transferable pattern — a closed learning loop with one "ground truth" accessor.** Log rich events →
> derive memory from them on a cache key that only advances with new data → let the human curate that
> memory → inject the curated memory back into generation. And designate **one function** as the canonical
> reader of the most-confused fact in your domain, so every consumer agrees on reality.

---

## 9. Data-model appendix (machine-readable shapes)

Abbreviated; JSONB sub-objects shown inline. See `src/lib/db/schema.ts` + `src/lib/types/*`.

```ts
// sessions — the brew diary (the learning corpus). createdAtMs is indexed DESC for feed order.
Session {
  id; createdAt; createdAtMs;
  coffee:   { name, roaster, origin, region, variety, process, roastLevel,
              fermentationStyle, tastingNotesFromBag: string[], cuppingScore, roastDate };
  context:  { occasion, amount, customWaterMl, timeAvailable, waterSource,
              preferredMethod, grinder, intent /* goal */ };
  recommendation: { candidates: RecommendationCandidate[], primaryRecipe, alternativeRecipe,
                    reasoning, sessionObjective, coffeeAssessment };
  brew:     { selectedCandidateIdx /* which candidate was brewed */, methodUsed, doseGrams,
              waterGrams, actualTempC, grindSettingUsed, actualTimeSec, flow, modifications };
  result:   { rating /*1–5*/, flavorNotes: string[], body, acidity, sweetness, bitterness,
              finish, clarity, wouldBrewAgain, freeNotes };
}

// coffees — the library (one row per roaster+name)
Coffee {
  id; roaster; name; origin; process; variety; latestRoastDate;
  sessionCount; avgRating; ratingSum; ratingCount;
  commonNotes: string[]; bagFlavors: string[]; personalNotes;
  inRotation: boolean;                                   // migration 0009 — "open on the counter"
  field_zones: FieldZones | null;                        // migration 0008 — the semantic theme vector
  coach_insight: CoffeeCoachInsight | null;              // migration 0015 — per-bag memory card
}

// FieldZones — the persisted semantic-theme vector (§4)
FieldZones {
  version: 1;
  zones: { id: "fruity-bright"|"fruity-deep"|"floral"|"nutty-cocoa"|"spice-earth"|"sweet-caramel";
           weight: number }[];                           // 1–3, Σ = 1.0
  modifiers: { saturation: number; lightness: number };  // each ∈ [-15,+15]
  source: "tasting-notes" | "variety-implied" | "default"; computedAt: string;
}

// insights — corpus memory + the state machine (§5)
Insight {
  id; observation; suggestion; citationFields: string[];
  latestSessionMs;                                        // cache key — regen only when corpus advances
  source: "opus" | "user-confirmed";
  status: "new" | "trying" | "confirmed" | "doesnt-apply" | "snoozed";
  snoozed_until?;                                         // set only when snoozed (now + 7d)
  userNote?; createdAt; updatedAt;
}

CoffeeCoachInsight {
  observation; suggestion;
  status: "new" | "trying" | "confirmed" | "doesnt-apply" | "snoozed";
  generatedAtSessionMs; generatedAt;
}

// preferences — single-row override layer; the real profile is CANONICAL_PROFILE in code
UserPreferences { equipment: string[]; grinder; tasteProfile { … }; defaultAmount; }

// RecommendationCandidate — the recipe-generation output unit (§3, /recommend)
RecommendationCandidate {
  method; role: "primary"|"alternative"; title; basedOn /* verified ref name | "Own recipe" */;
  recipe: { doseGrams, waterGrams, waterTempC, grindSize, targetTimeSec,
            pourSequence /* legacy string */, pourSteps: BrewPourStep[] /* structured, preferred */ };
  hypothesis; predictedCupProfile; primaryVariable; whatToObserve;
  confidence; confidenceReason; learningValue; brewingLesson;
}
// BrewStepAction = bloom|pour|final|stir|swirl|wait|press|invert|flip|drain|bypass|melodrip|agitate-bed
```

---

## 10. "Steal this" checklist — the transferable patterns

A compact, LLM-actionable index of the ideas above, decoupled from coffee:

1. **Semantic theming.** One cheap LLM call maps content's free-text descriptors → a small fixed perceptual
   vocabulary with weights; persist the vector; render deterministically. Unique-yet-on-brand visuals,
   cost paid once at ingest. *(§4 — `mapNotesToZones.ts`, `composeGradient.ts`, `coffees.field_zones`.)*
2. **Differentiate on a secondary axis.** When the primary axis must stay on-brand (here: hue stays warm),
   carry the *variety* on a secondary axis (saturation × lightness). *(§4.2.)*
3. **Tiered model fleet.** Route each task to the smallest model that clears its reasoning bar; don't
   default to the biggest. *(§3.)*
4. **Immutable cached prefix.** Keep the system block byte-stable; push all per-request variance to the
   user turn. *(§3.)*
5. **Grounded multivariate insights.** Model-written observations under two contracts — *cross ≥2
   dimensions* and *cite a real count*. *(§5.1.)*
6. **User-curated memory via a status state machine.** `new → trying → confirmed/rejected/snoozed`, with
   **preservation tiers** + **text-match inheritance** so regeneration never erases human-touched rows.
   *(§5.4.)*
7. **Terminal-action chat tools + a human commit gate.** Tools that start a flow or write a memory, with
   the committed payload run through the app's *shared* validator and a human tap as the commit. *(§6.)*
8. **Verification-tiered, retrievable knowledge base.** Provenance as a first-class field (`verified` /
   `confidence` + source); inject the relevant slice per request, outside the cached prefix. *(§7.)*
9. **A closed learning loop with one ground-truth accessor.** Log → derive memory on an advancing cache
   key → curate → re-inject; and designate one canonical reader for your most-confused fact. *(§8.)*
10. **Collapse configurability you don't need.** Code-canonical profile + DB as optional override deletes
    onboarding and a class of stale-config bugs. *(§2.)*
