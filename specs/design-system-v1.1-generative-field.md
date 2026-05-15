# BrewLog Design System v1.1 — Generative Field

**Status:** v1.1 — draft. Replaces v1.0 §2.1 (The Field).
**Scope:** The Field becomes coffee-driven across the Brew Flow + Coffee Detail Page; all other views use the v1.0 default Field with per-view rotation.
**Relationship to v1.0:** v1.0 is frozen. v1.1 replaces only §2.1. Every other v1.0 section — typography, cards, sections, footnotes, page structure, icons, interactions — remains authoritative. Cards still float on the Field; the Field is just no longer a single fixed composition.
**Source for data architecture:** verified against production DB and code on 2026-05-11. See Appendix B.

---

## 0. How to read this document

This spec replaces one section of v1.0. To use it: open v1.0, skip §2.1, read everything else as-is, then apply this document for Field generation logic.

Concrete Tailwind values and CSS structures are inlined where useful. The AI mapping prompt and the gradient composition algorithm are spec-level definitions — Step B will translate them into `src/lib/field/` code.

⚠️ **Anti-pattern** boxes still apply across both documents.

---

## 1. The concept: Field as coffee signature

**The Field becomes a property of the coffee.**

When the user scans a Pacas from Honduras with notes `["Blueberry", "Hibiscus", "Red Grapes", "Juicy", "Elegant"]`, the Field that wraps the brew flow is **for that coffee**: floral, rose-leaning, with fruity undertones, brighter for "Juicy", more delicate for "Elegant". When the user scans a chocolatey Brazilian, the Field is cocoa-warm, lower lightness, gold-tinted.

**Same coffee → same Field, every time, in every view that coffee appears.** Different coffees → genuinely different Fields. The gradient *means* something. This is the system's primary new semantic affordance compared to v1.0.

**Within a single brew flow, the Field rotates per step** — same composition, slightly turned. This makes the seven-step flow feel like "same room, different time of day", not "seven different rooms".

**The v1.0 default Field is itself a coffee signature** — a balanced Ethiopia-Yirgacheffe-style cup of floral + caramel + bright-citrus, expressed as roughly 0.4 Floral + 0.35 Sweet-Caramel + 0.25 Fruity-Bright. v1.1 generalises this. v1.0's specific composition becomes the "no signal available" fallback, not a special case.

⚠️ **Anti-pattern:** The Field is not Goal-driven or Occasion-driven. Those are *user inputs inside the Context step* — they appear after the scan, at which point the Field is already on screen. A Field that changed when the user tapped Goal/Occasion would break v1.0 §1's "static room" anchor. The Field is set by the coffee, not by the user's choices in the flow.

---

## 2. The six Field Zones

Every Field is composed of one or more Zones plus modifiers. A Zone is a palette specification — a hue, saturation, and lightness range plus a list of exemplar tasting notes.

The Zones live within v1.0's warm envelope: hues 0–60° and 320–360°. **No cool blues, greens, or neutral greys.** The Lightness range is broadened from v1.0's 65–95% down to 25%, allowing genuinely dark warm Fields (a cocoa-bomb Brazilian Natural can be dim-warm without becoming cold). This is the one rule from v1.0 §1 that v1.1 relaxes — "never cold" stays, "never dim" goes.

| Zone | Hue range | Saturation | Lightness | Character | Exemplar notes |
|---|---|---|---|---|---|
| **Fruity-Bright** | 0–30° (red-orange) | 60–90% | 70–90% | hell, klar, säuerlich-frisch | citrus, lemon, orange, grapefruit, mandarin, berry, blueberry, raspberry, cherry, cranberry, peach, apricot, currant, pomegranate |
| **Fruity-Deep** | 350–360° ∪ 0–15° (deep red) | 50–75% | 50–70% | gereift, weinig, dunkel-fruchtig | dried fruit, date, raisin, fig, prune, plum, red grape, port, wine, fermented fruit, dark cherry |
| **Floral** | 320–355° (rose-mauve-pink) | 40–70% | 70–88% | rosé, parfümiert, sanft | jasmine, rose, hibiscus, bergamot, chamomile, tea, lavender, elderflower, white flowers, floral, perfume |
| **Nutty-Cocoa** | 20–40° (brown-amber) | 35–55% | 30–55% | warm-braun, kakao, geröstet | chocolate, cocoa, milk chocolate, dark chocolate, nut, almond, hazelnut, walnut, pecan, peanut, roasted, malt |
| **Spice-Earth** | 25–45° (umbra, ocre, sienna) | 25–45% | 28–48% | erdig, würzig, gedeckt | cinnamon, clove, cardamom, tobacco, leather, earth, herbs, savoury, spice, woody, cedar, smoke |
| **Sweet-Caramel** | 30–50° (honey-gold-amber) | 55–85% | 60–80% | golden, weich, gebackene Süße | caramel, honey, brown sugar, maple, vanilla, butter, toffee, syrup, molasses, custard, marzipan |

**Zone overlap is intentional.** Nutty-Cocoa and Sweet-Caramel share hue range (~30–45°) but differ sharply in saturation/lightness: Nutty-Cocoa is dim and muted, Sweet-Caramel is bright and saturated. Same hue family, different perceptual weight — like dark chocolate vs. honey on the same warm axis. Same logic for Fruity-Bright vs. Fruity-Deep on the red axis.

**A coffee's Field is rarely a single Zone.** Most coffees mix 2–3 Zones at varying weights. Single-Zone coffees exist but are extreme cases (a deeply roasted single-origin Brazilian might be 100% Nutty-Cocoa).

---

## 3. Mapping tasting notes to Zones — the AI pipeline

The mapping from `tastingNotesFromBag` to a weighted Zone composition is done by a single Haiku 4.5 call, triggered once per coffee and persisted in `coffees.field_zones` (see §11). This is path **β** as agreed.

### 3.1 Why AI mapping, not a closed lookup table

A closed table would require maintaining ~80–150 hardcoded notes-to-zones entries and updating it every time a roaster introduces a new descriptor. In production data, tasting notes are wildly heterogeneous — German roasters write `pflaumig`, Scandinavian roasters write `lingonberry`, marketing-forward roasters write `like biting into a fresh peach on a summer afternoon`. A closed table fails open-vocabulary inputs by either dropping them silently (bad) or mis-routing them to the wrong Zone (worse).

A Haiku call costs roughly $0.0001 per coffee. The call is made **once** per coffee (cached in `field_zones`) and never re-run unless tasting notes change. Cost is structurally trivial.

⚠️ **Anti-pattern:** Do not call Haiku at render time. The Field gets seeded once at scan-complete and persisted. Render reads from cache. A render-time AI call would make every page navigation an API round-trip — unacceptable on iPhone PWA.

### 3.2 The mapping output

The Haiku call returns:

```json
{
  "zones": [
    { "id": "floral", "weight": 0.45 },
    { "id": "fruity-bright", "weight": 0.30 },
    { "id": "fruity-deep", "weight": 0.25 }
  ],
  "modifiers": {
    "saturation": 5,
    "lightness": 10
  }
}
```

Constraints:

- `zones` array contains 1–3 entries
- `weight` values are in [0, 1] and **sum to 1.0**
- `modifiers.saturation` and `modifiers.lightness` are integers in [-15, +15]
- Zone ids are exactly one of the six defined in §2

The full prompt is in **Appendix A**.

### 3.3 Modifiers — texture/quality descriptors

Some descriptors aren't aromas — they're texture, intensity, or quality signals that should shift the Field's overall feel without changing its Zone composition. These map to the `modifiers` object, not to Zones:

| Descriptor pattern | Modifier shift |
|---|---|
| `juicy`, `vibrant`, `lively`, `bright` | `saturation: +5 to +10` |
| `elegant`, `delicate`, `refined` | `lightness: +5 to +10`, `saturation: -5` |
| `clean`, `crisp`, `pristine` | `lightness: +5`, `saturation: -5` |
| `complex`, `deep`, `intense` | no shift; signals to allow 3 zones rather than 2 |
| `balanced`, `harmonic`, `silky` | no shift |
| `creamy`, `velvety`, `rich` | `lightness: -5`, `saturation: +5` |
| `dense`, `heavy`, `full-bodied` | `lightness: -10`, `saturation: +5` |

Haiku is told these patterns in the prompt. It's allowed to combine multiple modifier signals (e.g. "juicy and elegant" → `saturation: +5, lightness: +8`), clamped to the [-15, +15] range.

---

## 4. Process modifier

Process (`Washed` / `Natural` / `Honey` / `Anaerobic`) is a **secondary modifier** applied after the Zone composition is computed. It's a small global shift, not a Zone signal.

| Process | Modifier shift | Rationale |
|---|---|---|
| `Washed` | `lightness: +5`, `saturation: +3` | Cleaner, more transparent cup → more luminous Field |
| `Natural` | `lightness: -5`, `saturation: +3` | Deeper, more fermented texture → denser Field |
| `Honey` | `lightness: 0`, `saturation: +5` | Middle ground with extra golden saturation |
| `Anaerobic` | `lightness: -3`, `saturation: +8` | Fermentation-forward → more vivid, slightly deeper |
| `null` / `Other` | no shift | Pass through |

Production data check (verified 2026-05-11): the `coffees.process` column carries 4 distinct values — `Washed` (11), `Natural` (6), `Honey` (3), `null` (1). No `Anaerobic` yet (the user's library avoids it). The four-value table above covers reality plus the future-safe `Anaerobic` case.

Process modifier is **additive** to the notes-derived modifier from §3.3, clamped to [-15, +15].

---

## 5. Variety fallback

When `tastingNotesFromBag` is empty or missing (manual coffee add, scan extraction failure, low-info roaster), the system falls back to **variety-implied notes**.

### 5.1 Pipeline

1. Read `coffee.variety` from the session's `coffee` JSONB (or directly from `BagAnalysisResult.extracted.variety` during the scan flow).
2. Look up the variety in `src/lib/knowledge/varieties/data.ts` via the existing `getVarietyPriorsForBag()` helper.
3. From the variety's `cup signature` description in the knowledge file, derive implied tasting notes. **The same Haiku mapping prompt from §3 is run, but with these implied notes as input instead of bag notes.**

### 5.2 Why reuse the Haiku pipeline instead of pre-baking variety→zone in the knowledge file

The variety knowledge file (`coffee-experts.md` mirror + `varieties/data.ts`) describes cup signatures in prose: e.g. Geisha is "jasmine, bergamot, white peach, lemon zest, tea-like". That prose can be fed directly into the same Haiku mapping call — output is naturally a Floral-dominant composition with Fruity-Bright secondary. No separate variety→zone mapping table needed; the existing aromatic descriptions ARE the input.

This means **the Zone-Mapping prompt is the only mapping layer in the system.** Tasting notes from the bag and aromatic descriptions from variety knowledge both flow through it. One pipeline, one place to debug, one place to refine.

### 5.3 Variety string heterogeneity — known limitation

Production data check: variety strings in `sessions.coffee.variety` are free-form, often with marketing prose (`"SL9* (locally known as 'Gesha Inca' — a rare cultivar belonging to the Ethiopian legacy group)"`). The existing `getVarietyPriorsForBag()` helper handles this with fuzzy matching. If it returns no prior, the system falls through to §6 (Default).

This is the same fuzzy-match behaviour `/recommend` already uses for variety priors. No new logic needed here.

---

## 6. Default fallback

When neither tasting notes nor a matchable variety is available:

- Use the v1.0 Field composition: `0.40 Floral + 0.35 Sweet-Caramel + 0.25 Fruity-Bright`, no modifiers.
- This is the gradient that ships in v1.0, expressed as a Zone composition.
- It is **identical to v1.0 in rendered output**. Users with no scanned coffees see the v1.0 Field they already know.

The Default is stored in code (`src/lib/field/defaultZones.ts`), not in the DB. It's a constant, not a row.

---

## 7. Composing the gradient from a Zone specification

Given a `field_zones` JSON object, the system produces a 6-layer CSS gradient with **the same structural shape as v1.0's Field** — one linear base, five radial hotspots, blur 60px, scale 1.18. Only the colors change. The composition shape is fixed; the palette varies.

### 7.1 Mapping rule (Zone composition → 6 layers)

Each of the six gradient layers samples its color from the Zone composition:

| Layer (from v1.0 §2.1) | Position | Color source |
|---|---|---|
| **1 (linear base)** | 135° diagonal across viewport | Three-stop interpolation across the top 3 weighted Zones, dim and de-saturated (lightness -10, saturation -15 from Zone baseline) |
| **2 (bottom-left hotspot)** | `12% 92%`, radius 60% | Highest-weight Zone, picked at Zone's hue mid, saturation high end, lightness Zone mid |
| **3 (mid-right warm)** | `95% 45%`, radius 50% | Second-weight Zone, hue mid, saturation Zone mid, lightness Zone high |
| **4 (mid-left anchor)** | `18% 50%`, radius 55% | Third-weight Zone if 3 zones present; else echo of highest with hue rotated +10° |
| **5 (upper-mid)** | `55% 25%`, radius 50% | Highest-weight Zone, hue mid, saturation Zone low end (more transparent), lightness Zone high |
| **6 (top-right highlight)** | `92% 8%`, radius 60% | Lightness-max sample from highest-weight Zone — the "lit ceiling" |

After layer colors are sampled, the **modifiers** (`saturation`, `lightness`) from §3.3 + §4 are applied globally — every layer's HSL is shifted by the same amount.

### 7.2 Determinism

The same `field_zones` object always produces the same gradient. There is **no randomness** at render time. Random sampling happens once at mapping time (Haiku), is persisted, and renders are pure functions of the persisted state.

This is a critical property: two opens of the same coffee detail page show the same Field. Two devices show the same Field for the same coffee. No drift, no flicker.

### 7.3 The composition algorithm lives in code

The mapping rule above is the spec. The actual implementation — `composeFieldGradient(zones, modifiers, rotation): string` — belongs in `src/lib/field/composeGradient.ts` and is the deliverable of Step B. The spec defines *what* it produces; the code defines *how*.

⚠️ **Anti-pattern:** Do not expose individual layer colors as user-tunable. The Field is a single semantic unit ("this coffee's signature"), not a six-knob console. Tuning happens upstream — at the Zone weights or modifiers level, never at the per-layer level.

---

## 8. Step rotation within the Brew Flow

A single brew flow takes the user through up to seven steps (`mode → scan → context → recommend → brew → log → summary`). The Field stays the same composition throughout but **rotates subtly per step** to give a sense of progression without leaving the room.

### 8.1 Mechanics

- Step 1 (Mode): No coffee is scanned yet. Use Default Field, rotation 0°.
- Step 2 (Scan): Coffee scan completes mid-step. As soon as `field_zones` is computed, the Field swaps from Default to coffee-driven, rotation 0°. The swap is **instant** at step transition, not animated mid-step.
- Steps 3–7: Same `field_zones`, increasing rotation:
  - Step 3 (Context): 25°
  - Step 4 (Recommend): 50°
  - Step 5 (Brew): 75°
  - Step 6 (Log): 100°
  - Step 7 (Summary): 125°

125° total drift over five steps. Each per-step delta is 25°, large enough to feel like a turn, small enough to feel like the same room.

### 8.2 What "rotation" actually does

Rotation rotates the **position angles** of the five radial hotspots around the viewport center. The linear base layer's 135° angle also rotates by the same delta. Hues do not change. Lightness/saturation do not change. The composition stays identical — only the spatial arrangement turns.

This means a 25° rotation moves the bottom-left peach hotspot slightly counter-clockwise toward the bottom edge, and so on for every other hotspot. The viewer perceives "the room turned a bit", not "different content".

### 8.3 No animation between steps

Step transitions are not interpolated. v1.0 says cards don't hover; v1.1 says Fields don't animate mid-screen. Each step view shows its rotation as a fixed state. The change happens during the step transition (covered by the existing page-transition behaviour), not as an explicit animation.

⚠️ **Anti-pattern:** Live-interpolated rotation tied to scroll, time, or user input. This was option (iii) in the design discussion and was rejected for breaking the "static room" anchor and costing frames on iOS Safari.

---

## 9. Per-view rotation for non-coffee views

Views that are not coffee-specific use the **Default Field** (§6) with a fixed per-view rotation, so each view has a recognisable face without each being a different room.

| View | Rotation |
|---|---|
| Home / Diary feed | 0° |
| Cafés (map + place detail) | 72° |
| Taste | 144° |
| Explore | 216° |
| Library hub | 288° |

Five views, 72° apart, evenly spaced around the full circle.

**Auth views** (`/login`, `/onboarding`) and any view not in the above list: rotation 0°. The five-view fan covers the everyday navigation surfaces.

**Coffee Detail Page (`/coffees/[id]`)** is **not** in this list — it's coffee-driven. The Field uses the coffee's `field_zones` at rotation 0°. Each coffee has its own face on its own detail page.

**Brew Detail Page (`/brew/[id]`)** reads the session's `coffee` reference, looks up `field_zones` for that coffee, and renders at rotation 0°. Same coffee → same Field across the diary feed entry, the brew detail, and the coffee detail.

---

## 10. Schema: `coffees.field_zones`

### 10.1 Migration

Add a single JSONB column to the `coffees` table:

```sql
ALTER TABLE coffees ADD COLUMN field_zones jsonb;
```

This is the only schema change v1.1 requires. No other tables touched.

### 10.2 Value shape

```json
{
  "version": 1,
  "zones": [
    { "id": "floral", "weight": 0.45 },
    { "id": "fruity-bright", "weight": 0.30 },
    { "id": "fruity-deep", "weight": 0.25 }
  ],
  "modifiers": {
    "saturation": 5,
    "lightness": 10
  },
  "source": "tasting-notes",
  "computedAt": "2026-05-11T17:00:00.000Z"
}
```

Fields:

- `version` — schema version of the value itself. `1` for v1.1. Allows future evolution without re-migration.
- `zones` — 1–3 entries, ids from the six in §2, weights summing to 1.0.
- `modifiers` — integers in [-15, +15] for both saturation and lightness.
- `source` — one of `"tasting-notes"` (path §3), `"variety-implied"` (path §5), `"default"` (path §6). Useful for debugging and for indicating to the user later why the Field looks the way it does, if we ever surface that.
- `computedAt` — ISO timestamp of when the mapping ran. Used for cache freshness if we ever want to re-run.

`field_zones` is `null` when the value has not been computed yet. Rendering code interprets `null` as "use Default".

### 10.3 When the value is computed

Three triggers, all server-side:

1. **Bag scan succeeds** (`/api/analyze-bag` returns a result with `tastingNotesFromBag.length > 0`): Haiku mapping runs immediately after extraction. Result written to `coffees.field_zones` before the response returns.
2. **Coffee created manually** (`/api/coffees POST` with no scan): if `variety` is set, run §5 variety fallback. Otherwise leave `field_zones = null` (renders as Default).
3. **Coffee's bag notes or variety edited**: previous `field_zones` is invalidated (set to `null`). Next read triggers re-computation (lazy regeneration) or a foreground re-mapping call (whichever Step B chooses; spec doesn't mandate).

### 10.4 Invalidation rules

`field_zones` is **set to `null`** when:

- `coffees.common_notes` is edited (if that column ever becomes a real write path — currently it's effectively dead, see Appendix B).
- The latest session's `coffee.tastingNotesFromBag` is replaced via re-scan.
- `coffee.variety` is edited and tasting notes are empty.

Next read after invalidation re-runs the mapping. Costs one Haiku call. Acceptable.

⚠️ **Anti-pattern:** Do not store `field_zones` in `sessions.coffee` JSONB. The Field is a property of the coffee, not the session. Storing it per-session would re-run the Haiku call for every brew of the same coffee, multiply costs by session count, and create drift between two brews of the same bag (which would break the "same coffee = same Field" promise). The data lives on `coffees`, not on `sessions`.

---

## 11. Anti-patterns specific to v1.1

Recap of new anti-patterns introduced above, in one list:

1. **Field driven by Goal or Occasion** (§1). The user picks those after the Field is on screen; changing the Field mid-step breaks v1.0 §1's static-room anchor.
2. **Haiku mapping at render time** (§3.1). Mapping is computed once per coffee, cached. Render is pure read.
3. **Per-layer user tuning** (§7.3). The Field is one semantic unit. Tune Zone weights or modifiers, never raw layer colors.
4. **Animated rotation** (§8.3). Rotation changes between steps, not within a step. No scroll-driven, time-driven, or input-driven rotation.
5. **Storing `field_zones` per-session** (§10.4). It's a coffee property, not a session property.

The v1.0 anti-patterns (Field re-rendered per view, ring variant on cards, sticky CTA, footnote owns bottom space, etc.) all still apply. v1.1 adds to the list, doesn't replace it.

---

## 12. Open items / v1.2 anchors

Items deliberately deferred from v1.1, marked here so they're not forgotten:

- **Roaster Prior integration.** A known clarity-biased roaster (Friedhats, April) could subtly nudge the Field toward higher Lightness / lower Saturation regardless of notes. Not in v1.1 because it adds a second signal layer to debug. Possible v1.2.
- **Animated rotation interpolation.** Currently rotation jumps between steps. A subtle 400ms ease-out on rotation during step transition could feel right. Decide after seeing v1.1 live.
- **User-visible Field reasoning.** Showing the user *why* their Field looks the way it does ("Floral dominant from Hibiscus, Bergamot; Fruity-Bright secondary from Blueberry") could be a delightful diary surface. Not in v1.1.
- **Variety-derived implied notes pre-computation.** Variety data is static; the Haiku mapping for variety-implied notes could be pre-baked at build time into `varieties/data.ts`. Removes one runtime AI call. v1.2.
- **Field on auth screens.** Currently auth views use Default rotation 0°. A roastery-warm onboarding Field could welcome the user differently. Cosmetic, low priority.
- **Coffee-driven Field on Library list view.** The `/coffees` list shows many coffees at once — each card could carry a mini Field thumbnail derived from its `field_zones`. Performance question (rendering N gradients on one screen). v1.2 candidate.

---

## Appendix A — Haiku mapping prompt (full)

This is the exact prompt to be sent to Haiku 4.5 in the `/api/analyze-bag` post-extraction step and in the variety-fallback path.

**System:**

```
You are a perceptual aroma-to-color mapper for a specialty coffee app. Given an array of tasting notes (English or German), you return a JSON object specifying which BrewLog Field Zones the notes map to, with weights, plus optional saturation/lightness modifiers from texture descriptors. Return JSON only, no prose.

Available Field Zones (id : exemplar aromas):
- fruity-bright : citrus, lemon, orange, grapefruit, mandarin, berry, blueberry, raspberry, cherry, cranberry, peach, apricot, currant, pomegranate
- fruity-deep : dried fruit, date, raisin, fig, prune, plum, red grape, port, wine, fermented fruit, dark cherry
- floral : jasmine, rose, hibiscus, bergamot, chamomile, tea, lavender, elderflower, white flowers, floral, perfume
- nutty-cocoa : chocolate, cocoa, milk chocolate, dark chocolate, nut, almond, hazelnut, walnut, pecan, peanut, roasted, malt
- spice-earth : cinnamon, clove, cardamom, tobacco, leather, earth, herbs, savoury, spice, woody, cedar, smoke
- sweet-caramel : caramel, honey, brown sugar, maple, vanilla, butter, toffee, syrup, molasses, custard, marzipan

Texture/quality modifiers (NOT zones — adjust saturation and lightness instead):
- juicy / vibrant / lively / bright → saturation +5 to +10
- elegant / delicate / refined → lightness +5 to +10, saturation -5
- clean / crisp / pristine → lightness +5, saturation -5
- complex / deep / intense → no shift, allow 3 zones
- balanced / harmonic / silky → no shift
- creamy / velvety / rich → lightness -5, saturation +5
- dense / heavy / full-bodied → lightness -10, saturation +5

Rules:
- Output 1-3 zones. Most coffees are 2-3 zones.
- Zone weights are floats in [0, 1] summing to exactly 1.0.
- modifier.saturation and modifier.lightness are integers in [-15, +15].
- If a note is unfamiliar or non-aromatic (e.g. "rare", "delightful"), ignore it.
- If ALL notes are unfamiliar, return {"zones": [], "modifiers": {"saturation": 0, "lightness": 0}}.
  The caller will treat empty zones as "fall back to default".
- German notes are valid input: pflaumig → prune (fruity-deep), nussig → nutty-cocoa, zitronig → citrus (fruity-bright), schokoladig → chocolate (nutty-cocoa).
```

**User:**

```
Notes: ["Blueberry", "Hibiscus", "Red Grapes", "Juicy", "Elegant"]
```

**Expected output:**

```json
{
  "zones": [
    {"id": "floral", "weight": 0.40},
    {"id": "fruity-bright", "weight": 0.30},
    {"id": "fruity-deep", "weight": 0.30}
  ],
  "modifiers": {
    "saturation": 5,
    "lightness": 10
  }
}
```

**Parameters:**

- Model: `claude-haiku-4-5`
- `max_tokens`: 256 (output is small structured JSON)
- `temperature`: 0 (we want determinism per input)
- Response parsing: via existing `parseClaudeJson()` helper with Zod schema validation

A Zod schema for the response lives in Step B's code:

```ts
const FieldZonesResponseSchema = z.object({
  zones: z.array(z.object({
    id: z.enum(["fruity-bright", "fruity-deep", "floral", "nutty-cocoa", "spice-earth", "sweet-caramel"]),
    weight: z.number().min(0).max(1),
  })).max(3),
  modifiers: z.object({
    saturation: z.number().int().min(-15).max(15),
    lightness: z.number().int().min(-15).max(15),
  }),
});
```

---

## Appendix B — Verified against / open data questions

### B.1 Verified on 2026-05-11

- **Bag notes live in `sessions.coffee.tastingNotesFromBag`**, a flat `string[]` written by `analyzeBag.ts` and stored in the session JSONB. Coffee Detail Page reads `latestCoffee?.tastingNotesFromBag` directly (verified at `src/app/coffees/[id]/page.tsx:127`). Sample value from production: `["chocolate", "roasted nuts"]`.
- **`BagAnalysisResult.extracted.tastingNotesFromBag`** is the in-flight equivalent during the scan API call, before persistence. Field zones can be computed from this directly without waiting for session save.
- **`coffees.common_notes`** exists in schema (`src/lib/db/schema.ts:63`) and has a partial write path in `src/app/api/coffees/compact/route.ts:140` (aggregates `topNotes(sessions, 5)`), but is **effectively dead in production** — all 21 rows in `coffees` show `common_notes = null`. Either the aggregator is never triggered, or it returns empty. Independent bug from v1.1; flagged separately for Step B or a future cleanup.
- **`coffees.process`** is a `text` column with four observed values in production: `Washed` (11), `Natural` (6), `Honey` (3), `null` (1). Clean enough for direct mapping without normalisation.
- **Variety lives in `sessions.coffee.variety`** (jsonb path), not in the `coffees` table. Values are free-form strings, sometimes carrying marketing prose. The existing `getVarietyPriorsForBag()` in `src/lib/knowledge/varieties/helpers.ts` handles fuzzy matching; v1.1 reuses it.
- **`getVarietyPriorsForBag()`** is already consumed by `recommend.ts:647`, `explore-agent`, and `explore`. v1.1 adds a fourth consumer (the variety-fallback path in §5).

### B.2 Open data questions

- **`common_notes` dead-field cleanup.** The column exists, has a partial write path, and is read by `helpers.ts:23`. Production data shows no rows ever populated. Decide before Step B: either fix the write path (aggregator runs on session save) or drop the column. v1.1 does not depend on it — Field zones read tasting notes from `sessions.coffee.tastingNotesFromBag`, the source of truth — but the lingering half-implementation is confusion debt.
- **Variety extraction quality.** Production `sessions.coffee.variety` includes strings like `"SL9* (locally known as 'Gesha Inca' — a rare cultivar belonging to the Ethiopian legacy group)"`. The fuzzy matcher in `varieties/helpers.ts` is reused by v1.1, so its behaviour governs Field fallback quality. Periodic spot-check recommended; not v1.1 scope.
- **Field rendering performance on iPhone PWA.** Six-layer blurred gradient with `backdrop-filter` is known-OK from v1.0 production. v1.1 keeps the same structural shape, so no new perf concern is expected. To be confirmed on the first integrated build.

### B.3 Source files cross-checked

- `src/lib/claude/analyzeBag.ts` — Zod schema for `BagAnalysisResult.extracted.tastingNotesFromBag: string[]`
- `src/lib/db/schema.ts` — `coffees.common_notes jsonb`, `coffees.process text NOT NULL`
- `src/lib/db/helpers.ts` — `rowToCoffee` mapping
- `src/app/api/coffees/compact/route.ts` — only known `common_notes` write path
- `src/app/coffees/[id]/page.tsx` — Coffee Detail Page reading `tastingNotesFromBag` from latest session
- `src/lib/knowledge/varieties/` — variety priors module consumed by `recommend`, `explore`, `explore-agent`
- Production DB sample: 21 coffees, 14 distinct varieties (free-form), 4 distinct processes (clean)

---

*End of v1.1 draft.*
