/**
 * The clock a chat-authored recipe should promise — since 2026-10-19 exactly
 * what /recommend promises: the composed timeline's finish
 * (src/lib/brew/composeTimeline.ts) — pours as written, the owner's measured
 * drawdown for this exact brewer at this amount, the corpus median when he
 * has not measured one yet. Kept as a thin wrapper so the start_brew gate
 * and its tests keep one name for "the clock the server expects".
 */
import { composeTimeline } from "@/lib/brew/composeTimeline";
import type { BrewRecipe, Session } from "@/lib/types/session";

/** The model's clock may differ from the composed one by this much before the
 * recipe goes back for repair. Within it the server sets the exact number and
 * the prose ("about 4:00") stays honest. */
export const CHAT_CLOCK_TOLERANCE_SEC = 15;

export interface ExpectedChatClock {
  /** pours end + drawdown, in seconds. */
  sec: number;
  pourPhaseEndSec: number;
  drawdownSec: number;
  /** Provenance of the drawdown, for the model and the log. */
  detail: string;
}

/**
 * Null when the recipe has no pour cadence to time (immersion, cold steep,
 * iced) — the caller then leaves the model's clock alone.
 */
export function expectedChatClock(
  recipe: BrewRecipe,
  method: string | undefined,
  pastSessions: Session[],
  roastDate?: string,
  now: number = Date.now(),
): ExpectedChatClock | null {
  const t = recipe.targetTimeSec;
  if (typeof t !== "number" || !(t > 0) || t >= 3600) return null;
  if (typeof recipe.iceGrams === "number" && recipe.iceGrams > 0) return null;
  const res = composeTimeline(recipe, { method, basedOn: undefined, pastSessions, roastDate, now });
  if (!res.ok || res.timeline.shape !== "percolation") return null;
  const tl = res.timeline;
  return {
    sec: tl.finishSec,
    pourPhaseEndSec: tl.pourPhaseEndSec,
    drawdownSec: tl.drawdownSec,
    detail: `${tl.drawdownSource}: ${tl.drawdownBasis}`,
  };
}
