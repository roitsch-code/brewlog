# Grind Settings — Niche Zero (°) + Comandante (clicks)

> **Code source of truth:** `src/lib/constants/grindSettings.ts`. The constants file is canonical for the per-method default table; this doc mirrors it for humans. Wiring (corrected 2026-08-18): `/explore-agent` reads the constants LIVE (`formatGrindSettingsForPrompt()` via `userProfile.ts` — no hardcoded copy there); only `/recommend` carries a hardcoded NICHE° GRIND REFERENCE block (`recommendPrompt.ts`, kept literal for prompt-cache stability) — and that block is pinned to the constants by `tests/dataflow/grind-reference-consistency.test.mjs`, which fails CI on any disagreement. To re-calibrate: update the constants + this doc, then the `/recommend` block (the test forces the third).

## Empirical calibration (user-measured, May 2026)

Both reference points are **V60, no Drip Assist** (the disc is retired), ratio 1:16.7:

| Dose / Water | Niche | Comandante |
|---|---|---|
| 15 g / 250 ml (single cup) | **380°** | **23 clicks** |
| 30 g / 500 ml (double) | **400°** | **29 clicks** |

Two relationships fall out of those points:

- **Niche ↔ Comandante:** ~**3.3° per click** (anchor 380°=23, 400°=29). `clicks ≈ 23 + (niche − 380) × 0.3`.
- **Dose scaling — V60 only, the only brewer it is measured on (grind audit 2026-10-18):** doubling the dose runs **~+20° / +6 clicks coarser** (bigger bed → more flow resistance). Halving goes the same amount finer. Guideline, not a hard table.
  - **Applied logarithmically in code** (`scaleGrind`, `src/lib/recipe/scaleRecipe.ts`): `Δ° = 20 × log₂(doseRatio)`. So 1.5× is ≈ +12°, 2× is +20°, 0.5× is −20°. The old linear form `20 × (ratio − 1)` matched the measured anchors only at exactly 2× and got the halving side wrong (−10° instead of −20°).
  - Direction corroborated by Wendelboe's own brew guide: *"for less volumes grind finer than if you are brewing more volume"* (timwendelboe.no), and by Rao and Gagné on bed depth (a deeper bed adds flow resistance, so it wants a coarser grind).

## Per-method defaults

**Grind audit (owner, 2026-10-18: "never estimate — research, calculate, prove").** The table used to carry a row per brewer; every row but the V60 was an estimate re-based from an older baseline, never measured, never published. They are removed.

| Method | Niche° | Comandante | Source |
|--------|--------|------------|--------|
| V60, 15 g / 250 ml | **380°** | **23** | measured by the owner |
| V60, 30 g / 500 ml | **400°** | **29** | measured by the owner |
| V60 + Drip Assist | 385° | 25 | owner-stated: about 5° coarser than the bare V60 (emergency / travel only) |
| Every other brewer | — | — | no measured or published value: the owner's own logged grind (`measuredGrind.ts`), a recipe's sourced value (`grind.nicheSource`), or a declared measurement brew |

Research behind "no published value" (2026-10-18): Niche publishes no degree scale; Comandante's FAQ gives "18-35 clicks for a pour over" with no per-brewer rows; Orea publishes click ranges for the V4 Narrow only and "grind a little coarser" for the Wide; the 131 corpus recipes were checked one by one (CLAUDE.md, Current status item 8).

> Grind coarser/finer to adjust timing. Temperature controls extraction chemistry — never use it to fix flow speed.

**Since 2026-08-23 `/recommend` also carries the owner's OWN measured grind** for the brewers they actually use at the batch size in question (`src/lib/claude/measuredGrind.ts` → the MEASURED GRIND block): median, range and the ≥4★ window from `brew.grindSettingUsed`, pooled by brewer family and volume. That block is the ONLY grind source for every brewer but the V60; with fewer than 3 logged brews at that size the candidate is a measurement brew. It is reported to the model, never enforced: grind is bean-dependent.

> **The `/recommend` prompt no longer keeps its own copy of these numbers out of sync.** Its NICHE° GRIND REFERENCE block is corrected to this measured baseline and pinned to `grindSettings.ts` by `tests/dataflow/grind-reference-consistency.test.mjs`, so the ~+21° drift that put V60 at 396–406° (≈6 Comandante clicks coarser than the owner grinds) cannot recur silently.
