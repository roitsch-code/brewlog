/**
 * Live "not water" filter for the brew screen's coach. Once the current pour
 * has reached its target, a sudden INCREASE on the scale is something set onto
 * the brewer — the Clever's lid, the coffee in a water-first Clever, a hand
 * pressing down — never water: a kettle cannot pour that fast (MAX_POUR_GPS).
 * Without this the coach read the Clever lid as "Overshot +Ng" (owner,
 * 2026-10-29). The fold is undone by the matching sudden DROP (lid off, hand
 * released), capped at what was folded, so a lift of the brewer for a swirl
 * moves nothing it did not move before.
 *
 * Live only. The stored whole-brew curve stays raw-net: the post-brew analysis
 * has rejectNonPourJumps, which can look ahead and see whether a jump returns.
 */
import { isNonPourJump } from "@/lib/brew/flowAnalysis";

export interface LiveMassState {
  /** Grams on the scale that are not water (subtract from the net reading). */
  offset: number;
  lastRaw: number | null;
  lastMs: number;
}

export const LIVE_MASS_START: LiveMassState = { offset: 0, lastRaw: null, lastMs: 0 };

export function foldLiveMass(
  state: LiveMassState,
  raw: number,
  atMs: number,
  /** The active step has no grams target, or the live water already reached it. */
  pourDone: boolean,
): LiveMassState {
  let offset = state.offset;
  if (state.lastRaw != null) {
    const delta = raw - state.lastRaw;
    const dt = (atMs - state.lastMs) / 1000;
    if (isNonPourJump(delta, dt)) {
      if (delta > 0 && pourDone) offset += delta;
      else if (delta < 0 && offset > 0) offset -= Math.min(offset, -delta);
    }
  }
  return { offset, lastRaw: raw, lastMs: atMs };
}
