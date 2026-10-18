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
  /** Comandante C40 clicks via the owner's measured map. */
  comandante: { min: number; max: number };
  /** "measured": the owner measured it. "owner-stated": the owner gave the
   * value himself (the Drip Assist offset). Nothing else belongs here. */
  confidence: "measured" | "owner-stated";
  notes?: string;
}

// GRIND AUDIT (owner, 2026-10-18: "never estimate — research, calculate,
// prove"). This table held a row per brewer; every row but the V60 was an
// estimate carried over from an older baseline, never measured and never
// published. They are gone. For every other brewer the grind comes from the
// owner's own logged brews (src/lib/claude/measuredGrind.ts), from a reference
// recipe's SOURCED value (grind.nicheSource), or it is a declared measurement
// brew — see the NICHE° GRIND REFERENCE block in recommendPrompt.ts.
export const NICHE_GRIND_SETTINGS: GrindSetting[] = [
  // V60 — measured: 15 g / 250 ml = 380° = 23 clicks; 30 g / 500 ml = 400° = 29.
  {
    method: "V60",
    niche: { min: 380, max: 380 },
    comandante: { min: 23, max: 23 },
    confidence: "measured",
    notes: "Measured at 15 g / 250 ml. Also measured: 30 g / 500 ml = 400° / 29 clicks.",
  },
  // The Hario Drip Assist offset as the owner states it (CLAUDE.md equipment
  // profile: "When it IS in use: ~+5° coarser").
  {
    method: "V60 + Drip Assist",
    niche: { min: 385, max: 385 },
    comandante: { min: 25, max: 25 },
    confidence: "owner-stated",
    notes: "Owner-stated offset: about 5° coarser than the bare V60. Emergency / travel only.",
  },
];

/** The owner's second measured V60 point (30 g / 500 ml). */
export const V60_DOUBLE_ANCHOR = { waterG: 500, niche: 400, clicks: 29 } as const;

/** The +20°-per-doubling law as a number (same rule as DOSE_SCALING_RULE). */
export const NICHE_DEG_PER_DOUBLING = 20;

/** How many Niche° coarser (positive) a brew of `toWaterG` grinds than the same
 * recipe at `fromWaterG`, by the dose-scaling law. 0 when either is unknown. */
export function batchGrindDeltaDeg(fromWaterG: number, toWaterG: number): number {
  if (!(fromWaterG > 0) || !(toWaterG > 0)) return 0;
  return Math.round(NICHE_DEG_PER_DOUBLING * Math.log2(toWaterG / fromWaterG));
}

/**
 * Dose-scaling rule (user-measured, same method + ratio):
 * doubling the dose runs ~+20° Niche / +6 Comandante clicks COARSER.
 * Linear approximation between the two anchors — a guideline, not a hard table.
 */
export const DOSE_SCALING_RULE =
  "V60 only (the only brewer it is measured on): per doubling of dose at the same ratio, +20° Niche / +6 Comandante clicks coarser; halving goes the same amount finer. Measured anchors: 15 g = 380°/23 clicks, 30 g = 400°/29 clicks. On every other brewer the batch effect on grind is unmeasured.";

export const GRIND_FOOTNOTE =
  "Niche ↔ Comandante: ~3.3° per click (380°=23, 400°=29 clicks). " +
  DOSE_SCALING_RULE +
  " Adjust grind coarser/finer to fix flow timing — never use temperature for that; temperature controls extraction chemistry only.";

// Drip Assist status (May 2026): retired from daily use BUT still selectable
// in the flow picker as an emergency / travel-only option (no gooseneck
// available). The V60 figures in the main entry above are the no-Assist
// baseline; the "V60 + Drip Assist" row above carries the disc offset
// (~+5° coarser) so the prompt and UI have a usable target when the disc
// is in. Do NOT recommend the Assist proactively — only honor it when the
// user explicitly picks it.

export function formatGrindSettingsForPrompt(): string {
  const lines = NICHE_GRIND_SETTINGS.map((s) => {
    const head = s.process ? `${s.method} (${s.process})` : s.method;
    return `- ${head}: ${s.niche.min}° Niche (${s.comandante.min} Comandante clicks) — ${s.confidence}${s.notes ? `. ${s.notes}` : ""}`;
  });
  lines.push(
    "- Every other brewer: no measured or published Niche value exists. Use the owner's own logged grind on that brewer, or a recipe's sourced value; otherwise say plainly that the setting is a measurement brew — never present a number as a known value.",
  );
  return lines.join("\n");
}
