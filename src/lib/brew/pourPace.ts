/**
 * The owner's MEASURED pour pace — the rate at which he actually delivers
 * water from the kettle, read off his own Acaia curves.
 *
 * Why (2026-10-10, "Who says my pace is 4 g/s?"): POUR_RATE_GPS = 4 was set by
 * hand in June 2026 and re-stated in October from ONE scale curve. The Acaia
 * has recorded the mean per-pour pour rate of every scale brew since the
 * sessions schema stopped dropping flowAnalysis (#556): over 24 scale brews
 * the median is 2.35 g/s (quartiles 2.2–3.1; recommend-logs run 38057995770).
 * The house constant was nearly double what he pours. Every pour the app
 * timed at 4 g/s was therefore shorter than his hand, and the rest after it
 * started while he was still pouring.
 *
 * What avgFlowRateGPS measures: grams of a pour ÷ (the time the curve reached
 * the target − the time the step started). That includes the moment of
 * hesitation before the kettle tips, which is exactly what a timer that plans
 * his pours should include. It is the DELIVERED rate, not the hand's peak.
 *
 * Same discipline as the measured drawdown (src/lib/brew/drawdown.ts): his
 * own numbers first, the house estimate only when he has not measured enough.
 * Pooled by brewer family (a Clever fill and a V60 pulse are different motions)
 * when that family has enough brews, else over all his scale brews.
 */
import type { Session } from "@/lib/types/session";
import { brewMethodKey } from "@/lib/utils/brewMethodKey";
import { POUR_RATE_GPS } from "@/lib/utils/pourSequence";

/** Brews of one brewer family before its own median is trusted. */
export const MIN_PACE_SAMPLES_BREWER = 3;
/** Brews over all brewers before the overall median is trusted. */
export const MIN_PACE_SAMPLES_ALL = 5;
/** Below this the "pace" is a hesitation artefact (an un-tared scale, a
 * curve that never moved), above it nobody pours. */
export const PACE_CLAMP_GPS: readonly [number, number] = [1.5, 8];

export interface PourPace {
  gps: number;
  source: "measured-brewer" | "measured-all" | "house";
  count: number;
  detail: string;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const clamp = (g: number) => Math.min(PACE_CLAMP_GPS[1], Math.max(PACE_CLAMP_GPS[0], g));

/** Every scale brew's measured mean pour rate, with the brewer it was poured on. */
export function measuredPaceSamples(sessions: Session[]): Array<{ gps: number; key: string }> {
  const out: Array<{ gps: number; key: string }> = [];
  for (const s of sessions) {
    const gps = s.brew?.flowAnalysis?.avgFlowRateGPS;
    if (typeof gps !== "number" || !Number.isFinite(gps) || gps <= 0) continue;
    // A rate under the clamp floor is not a pour he made — an un-tared scale
    // whose curve sat at the vessel's mass for minutes (10-04/10-05 2026 show
    // the bloom "reached" at 146 s and 176 s) — and must not drag the median.
    if (gps < PACE_CLAMP_GPS[0]) continue;
    out.push({ gps: clamp(gps), key: brewMethodKey(s.brew?.methodUsed) });
  }
  return out;
}

export function measuredPourPace(sessions: Session[], method?: string): PourPace {
  const samples = measuredPaceSamples(sessions);
  const key = brewMethodKey(method);
  const own = samples.filter((x) => x.key === key).map((x) => x.gps);
  if (method && own.length >= MIN_PACE_SAMPLES_BREWER) {
    const gps = Math.round(median(own) * 10) / 10;
    return { gps, source: "measured-brewer", count: own.length, detail: `median of ${own.length} measured ${key} brews` };
  }
  const all = samples.map((x) => x.gps);
  if (all.length >= MIN_PACE_SAMPLES_ALL) {
    const gps = Math.round(median(all) * 10) / 10;
    return { gps, source: "measured-all", count: all.length, detail: `median of ${all.length} measured scale brews` };
  }
  return { gps: POUR_RATE_GPS, source: "house", count: all.length, detail: `house estimate (${POUR_RATE_GPS} g/s), fewer than ${MIN_PACE_SAMPLES_ALL} measured brews` };
}

/** One line for a prompt, so the model writes pours at the pace the timer will plan. */
export function formatPourPaceForPrompt(pace: PourPace): string {
  return `MEASURED POUR PACE — the user delivers water at ~${pace.gps} g/s (${pace.detail}). The app times every pour at this pace (whole 5-second steps); write pours and state per-pour seconds at it, never faster.`;
}
