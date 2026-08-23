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
- **Dose scaling (same method/ratio):** doubling the dose runs **~+20° / +6 clicks coarser** (bigger bed → more flow resistance). Halving goes the same amount finer. Guideline, not a hard table.

## Per-method defaults

| Method | Process | Niche° | Comandante | Confidence |
|--------|---------|--------|------------|------------|
| V60 | any | 375–385° | 22–25 | **measured** (380°/23 = single cup) |
| V60 + Drip Assist | any | 380–390° | 24–27 | estimate (emergency/travel only — disc adds resistance → ~+5° coarser than the standard V60) |
| Orea V4 (Apex) | any | 382–386° | 24–25 | estimate |
| Orea V4 (Classic) | any | 385–390° | 24–26 | estimate |
| Orea V4 (Open) | any | 381–388° | 23–25 | estimate |
| Orea V4 | any | 380–390° | 23–26 | estimate |
| Origami Dripper | Washed | 380–386° | 23–25 | estimate |
| Origami Dripper | Honey | 382–387° | 24–25 | estimate |
| Origami Dripper | Natural | 383–388° | 24–25 | estimate |
| Clever Dripper | any | 395–415° | 28–34 | estimate |
| AeroPress | any | 356–366° | 16–18 | estimate |
| Kalita Wave | any | 384–394° | 24–27 | estimate |
| Chemex | any | 398–410° | 28–32 | estimate |
| Moccamaster | any | 410–420° | 32–35 | estimate |
| Kasuya 4:6 | any | 390–400° | 26–29 | estimate |

**Confidence:** only **V60** is directly measured. The other methods carry their previous *relative* offset onto the new V60 baseline (re-based by the same delta) — an **estimate**, not a measurement. Kasuya is anchored to its published recipe grind. Measure per method to firm these up.

> Grind coarser/finer to adjust timing. Temperature controls extraction chemistry — never use it to fix flow speed.

**Since 2026-08-23 `/recommend` also carries the owner's OWN measured grind** for the brewers they actually use at the batch size in question (`src/lib/claude/measuredGrind.ts` → the MEASURED GRIND block): median, range and the ≥4★ window from `brew.grindSettingUsed`, pooled by brewer family and volume. That block beats this table wherever it exists — these per-method rows stay the fallback for a brewer with fewer than 3 logged brews at that size. It is reported to the model, never enforced: grind is bean-dependent.

> **The `/recommend` prompt no longer keeps its own copy of these numbers out of sync.** Its NICHE° GRIND REFERENCE block is corrected to this measured baseline and pinned to `grindSettings.ts` by `tests/dataflow/grind-reference-consistency.test.mjs`, so the ~+21° drift that put V60 at 396–406° (≈6 Comandante clicks coarser than the owner grinds) cannot recur silently.
