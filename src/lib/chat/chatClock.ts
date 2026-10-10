/**
 * The clock a chat-authored recipe should promise — the same arithmetic
 * /recommend's `calibrateDrawdownClock` applies (src/lib/claude/recommend.ts):
 * the rendered pour phase plus the owner's own measured drawdown for that
 * brewer and batch (src/lib/brew/drawdown.ts), the corpus median when he has
 * not measured one yet.
 *
 * Why this exists (2026-10-10): the chat's Brew pill carried whatever
 * `targetTimeSec` the model wrote. For the SEY V60 of 10-10 15:21 that was
 * 250 s on a pour plan that ended at 2:25 — a 1:45 drawdown promised, while
 * the owner's measured V60 drawdown at that batch is ~100 s. The timer was
 * fiction and he stopped it at 2:47. The chat has carried the owner's
 * MEASURED DRAWDOWN block since #601, so the model has the number; this makes
 * the server hold it to the number.
 */
import { drawdownFor } from "@/lib/brew/drawdown";
import type { BrewRecipe, Session } from "@/lib/types/session";
import { pourScheduleFor } from "@/lib/utils/pourSequence";

/** The model's clock may differ from the computed one by this much before the
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
 * iced) or when nothing at all is known about the brewer's drawdown — the
 * caller then leaves the model's clock alone, exactly as /recommend does.
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
  const schedule = pourScheduleFor(recipe, roastDate, now, method);
  if (!schedule) return null;
  const est = drawdownFor(pastSessions, method, recipe.waterGrams);
  if (!est) return null;
  return {
    sec: schedule.pourPhaseEndSec + est.sec,
    pourPhaseEndSec: schedule.pourPhaseEndSec,
    drawdownSec: est.sec,
    detail: est.detail,
  };
}
