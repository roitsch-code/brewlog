/**
 * Where a candidate's grind number comes from (grind audit, 2026-10-18) — set
 * deterministically AFTER the guard chain and shown under the grind on the
 * recipe screen, so the owner sees at a glance whether a setting is measured,
 * published, his own, or a measurement brew.
 */
import type { RecommendationCandidate, Session } from "../types/session";
import { brewMethodKey } from "../utils/brewMethodKey";
import { grindStringToDegrees, buildMeasuredGrind } from "./measuredGrind";
import { resolveReference } from "./recipeFidelity";
import { scaleGrind } from "../recipe/scaleRecipe";
import { batchGrindDeltaDeg, V60_DOUBLE_ANCHOR } from "../constants/grindSettings";

export type GrindProvenance = "user" | "measured" | "published" | "v60-anchor" | "measurement-brew";

/** Degrees of slack when comparing a candidate to a measured / published value. */
const TOL_DEG = 2;

export function grindProvenanceOf(
  c: Pick<RecommendationCandidate, "method" | "basedOn" | "recipe">,
  ctx: { sessions: Session[]; userGrind?: string; computedWindows?: { methodKey: string; min: number; max: number }[] },
): GrindProvenance {
  const deg = grindStringToDegrees(c.recipe.grindSize);
  if (ctx.userGrind) {
    const u = grindStringToDegrees(ctx.userGrind);
    if (u !== null && deg !== null && Math.abs(u - deg) <= TOL_DEG) return "user";
  }
  if (deg === null) return "measurement-brew";
  const key = brewMethodKey(c.method);
  const water = c.recipe.waterGrams;

  // The owner's own logged grind on this brewer at this batch (≥3 brews).
  const measured = buildMeasuredGrind(ctx.sessions, water).find((m) => m.methodKey === key);
  if (measured && deg >= measured.minDeg - TOL_DEG && deg <= measured.maxDeg + TOL_DEG) return "measured";
  // …or a window COMPUTED from his own slope (grindSlope.ts).
  for (const w of ctx.computedWindows ?? []) {
    if (w.methodKey === key && deg >= w.min - TOL_DEG && deg <= w.max + TOL_DEG) return "measured";
  }

  // A reference recipe's SOURCED value (grind.nicheSource), scaled only on a V60.
  const ref = resolveReference(c.basedOn);
  if (ref?.grind?.nicheSource && ref.water?.grams > 0 && water > 0) {
    const g = scaleGrind(ref, water / ref.water.grams, c.method);
    // scaleGrind gives no range on a non-V60 batch change (unmeasured), so a
    // published value only counts there at the reference's own batch (±5 %).
    const own = ref.grind.nicheZeroDegrees;
    const atOwnBatch = Math.abs(water / ref.water.grams - 1) < 0.05;
    const base: [number, number] | null =
      g.nicheRange ?? (atOwnBatch && own !== undefined ? (Array.isArray(own) ? own : [own, own]) : null);
    if (base && deg >= base[0] - TOL_DEG && deg <= base[1] + TOL_DEG) return "published";
  }

  // The measured V60 anchors with the V60-measured dose law.
  if (key === "v60" && water > 0) {
    const anchor = 380 + batchGrindDeltaDeg(250, water);
    const double = V60_DOUBLE_ANCHOR.niche + batchGrindDeltaDeg(V60_DOUBLE_ANCHOR.waterG, water);
    if (Math.abs(deg - anchor) <= TOL_DEG || Math.abs(deg - double) <= TOL_DEG) return "v60-anchor";
  }
  return "measurement-brew";
}
