# Grind Settings — Niche Zero (°) + Comandante (clicks)

> **Code source of truth:** `src/lib/constants/grindSettings.ts`. The constants file is canonical for the per-method default table; this doc mirrors it for humans. NOTE: `/recommend` and `/explore-agent` do NOT import the constants file — each carries its own hardcoded NICHE° GRIND REFERENCE in the system prompt. To re-calibrate a number, update all three (constants + this doc + the prompt block).

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
| V60 + Drip Assist | any | 380–390° | 24–27 | estimate (emergency/travel only — disc adds resistance → ~+5° coarser than bare V60) |
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
