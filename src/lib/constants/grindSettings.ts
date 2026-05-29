// Niche Zero grind settings — single source of truth.
// Mirrors docs/grind-settings.md and the user's CLAUDE.md profile.
// The Niche Zero uses continuous degree (°) settings; the Comandante C40 MK2
// (travel grinder) uses clicks.
//
// ── EMPIRICAL CALIBRATION (user-measured, May 2026) ─────────────────────────
// The user validated their own grinders against two real reference points,
// both V60 (no Drip Assist — the disc is retired), ratio 1:16.7:
//     15 g / 250 ml  →  Niche 380°  ==  Comandante 23 clicks   (standard single cup)
//     30 g / 500 ml  →  Niche 400°  ==  Comandante 29 clicks   (double batch)
//
// Two relationships fall straight out of those two points:
//   • Niche ↔ Comandante:  ~3.3° per click  (anchor 380°=23, 400°=29).
//       clicks ≈ 23 + (niche − 380) × 0.3      niche ≈ 380 + (clicks − 23) × 3.33
//   • Dose scaling (same method/ratio): doubling the dose runs ~+20° / +6 clicks
//     COARSER (bigger bed → more flow resistance → coarsen to hold the timing).
//     See DOSE_SCALING_RULE below.
//
// CONFIDENCE: only the V60 entry is directly measured. Every other method's
// absolute value is the PREVIOUS relative offset carried onto the new V60
// baseline (re-based by the same delta) — an ESTIMATE, not a measurement, per
// the user's explicit instruction. Peng/Kasuya are anchored to their published
// recipe grind instead of the blanket shift. Measure per method to firm these up.

export interface GrindSetting {
  method: string;
  process?: string;
  niche: { min: number; max: number };
  /** Comandante C40 clicks, derived from `niche` via the user's measured map. */
  comandante: { min: number; max: number };
  /** "measured" only for the V60 anchor; everything else is an estimate. */
  confidence: "measured" | "estimate" | "recipe-anchored";
  notes?: string;
}

export const NICHE_GRIND_SETTINGS: GrindSetting[] = [
  // V60 — the measured anchor (380° / 23 clicks = standard 15 g single cup).
  {
    method: "V60",
    niche: { min: 375, max: 385 },
    comandante: { min: 22, max: 25 },
    confidence: "measured",
    notes: "Anchor: 15 g single cup = 380° / 23 clicks. Larger batches coarsen (see dose-scaling rule).",
  },
  { method: "Orea V4", niche: { min: 380, max: 390 }, comandante: { min: 23, max: 26 }, confidence: "estimate" },
  { method: "Origami Dripper", process: "Washed", niche: { min: 380, max: 386 }, comandante: { min: 23, max: 25 }, confidence: "estimate" },
  { method: "Origami Dripper", process: "Honey", niche: { min: 382, max: 387 }, comandante: { min: 24, max: 25 }, confidence: "estimate" },
  { method: "Origami Dripper", process: "Natural", niche: { min: 383, max: 388 }, comandante: { min: 24, max: 25 }, confidence: "estimate" },
  { method: "Clever Dripper", niche: { min: 395, max: 415 }, comandante: { min: 28, max: 34 }, confidence: "estimate" },
  { method: "AeroPress", niche: { min: 356, max: 366 }, comandante: { min: 16, max: 18 }, confidence: "estimate" },
  { method: "Moccamaster", niche: { min: 410, max: 420 }, comandante: { min: 32, max: 35 }, confidence: "estimate" },
  // Kalita Wave: flat bed, three small holes — runs around the V60 baseline,
  // a touch coarser to keep the bed from stalling. Chemex: thick filter +
  // restricted drain → medium-coarse to avoid over-extraction on the slow flow.
  // Both added May 2026 for the Markus-Additions recipes; estimates off the V60
  // anchor + grind feel, not directly measured.
  { method: "Kalita Wave", niche: { min: 384, max: 394 }, comandante: { min: 24, max: 27 }, confidence: "estimate" },
  { method: "Chemex", niche: { min: 398, max: 410 }, comandante: { min: 28, max: 32 }, confidence: "estimate" },
  // Peng champ grind is anchored to his published ~Comandante 26 (≈390°), NOT the
  // blanket −21° shift, which would have wrongly driven it to ~19 clicks.
  { method: "Peng 2025 (Championship)", niche: { min: 385, max: 395 }, comandante: { min: 25, max: 28 }, confidence: "recipe-anchored" },
  { method: "Kasuya 4:6", niche: { min: 390, max: 400 }, comandante: { min: 26, max: 29 }, confidence: "estimate" },
];

/**
 * Dose-scaling rule (user-measured, same method + ratio):
 * doubling the dose runs ~+20° Niche / +6 Comandante clicks COARSER.
 * Linear approximation between the two anchors — a guideline, not a hard table.
 */
export const DOSE_SCALING_RULE =
  "Larger batch = coarser grind: per doubling of dose (at the same ratio) go ~+20° Niche / +6 Comandante clicks coarser; halving goes the same amount finer. Measured anchors: 15 g = 380°/23 clicks, 30 g = 400°/29 clicks (V60).";

export const GRIND_FOOTNOTE =
  "Niche ↔ Comandante: ~3.3° per click (380°=23, 400°=29 clicks). " +
  DOSE_SCALING_RULE +
  " Adjust grind coarser/finer to fix flow timing — never use temperature for that; temperature controls extraction chemistry only.";

// Drip Assist is fully retired — removed from the active set (do not surface in
// UI / prompts). The user stopped using the disc; all V60 figures above are
// no-Assist.

export function formatGrindSettingsForPrompt(): string {
  const lines = NICHE_GRIND_SETTINGS.map((s) => {
    const head = s.process ? `${s.method} (${s.process})` : s.method;
    return `- ${head}: ${s.niche.min}–${s.niche.max}° Niche (~${s.comandante.min}–${s.comandante.max} Comandante clicks)`;
  });
  return lines.join("\n");
}
