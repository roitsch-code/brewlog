/**
 * The owner's MEASURED pour pace — the rate at which his hand actually
 * delivers water, read off his own Acaia curves.
 *
 * CORRECTION (2026-10-10, same day as #620): the first version read
 * flowAnalysis.avgFlowRateGPS and called its 2.35 g/s median "his pace". That
 * field is pourGrams ÷ (this target reached − the PREVIOUS target reached),
 * which INCLUDES the rest before the pour — a delivery rate over the cadence,
 * not a pour rate. His real per-pour reach times (bloom 90 g at 17.9 s, 72 g
 * at 18 s, 70 g in ~14 s of pouring) are 4–5 g/s. For a few hours every
 * house-paced pour was planned at 2.4 g/s, nearly twice as long as he pours.
 *
 * Now this reads ONLY flowAnalysis.avgPourRateGPS — pourGrams ÷ (target
 * reached − the curve's RISE for that pour), i.e. the hand's time, rest
 * excluded — which is written from 2026-10-10 on. Sessions saved before it
 * carry no value and are ignored, so the pace stays the house 4 g/s until
 * enough clean brews exist (MIN_PACE_SAMPLES_*). "Who says my pace is 4 g/s?"
 * — his own curves, roughly; the number is re-read from them once there are
 * enough.
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

/** Every scale brew's measured HAND pour rate (avgPourRateGPS — never the
 * rest-inclusive avgFlowRateGPS), with the brewer it was poured on. */
export function measuredPaceSamples(sessions: Session[]): Array<{ gps: number; key: string }> {
  const out: Array<{ gps: number; key: string }> = [];
  for (const s of sessions) {
    const gps = s.brew?.flowAnalysis?.avgPourRateGPS;
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
