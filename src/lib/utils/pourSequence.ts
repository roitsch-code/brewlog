/**
 * Pour-over timing math — pure, deterministic, unit-tested.
 *
 * The goal is that the last pour lands at exactly:
 *     (targetTimeSec - drawdownReserve)
 *
 * We reserve 33% of the total brew time for the final drawdown
 * (~89s at 270s total, ~69s at 210s total), subtract the bloom, and
 * evenly space the (n - 2) intervals between the first pour after
 * bloom and the final pour. That guarantees the clock milestone
 * above.
 *
 * NOTE — the 33% multiplier was originally sized for the Drip Assist
 * disc bottleneck. The disc has since been retired from daily use; a
 * bare V60 drawdown sits closer to 15–20% of total time, so the
 * reserve is currently larger than the physics demand and total
 * recipe times come out conservatively padded. Re-calibrating the
 * multiplier is a behavioral change touching every brew and needs an
 * empirical drawdown measurement on the current setup — leave the
 * 0.33 in place until that's done. See the BTTS audit plan file.
 */

export interface PourStep {
  index: number;
  label: string;
  cumulativeGrams: number;
  pourGrams: number;
  startTimeSec: number;
  action: "bloom" | "pour" | "final";
}

/**
 * Hoffmann/Rao consensus: 45s peak. Very fresh beans still off-gassing CO2
 * get +5s, past-peak beans with minimal CO2 get cut to 30s.
 *
 * @param roastDate ISO date string. Defaults to peak window (45s) if omitted.
 * @param now injected clock for deterministic testing
 */
export function getBloomDuration(roastDate?: string, now: number = Date.now()): number {
  if (roastDate) {
    const daysOld = Math.floor((now - new Date(roastDate).getTime()) / 86_400_000);
    if (daysOld < 7) return 50;
    if (daysOld < 22) return 45;
    return 30;
  }
  return 45;
}

/**
 * Parse a " – "-separated cumulative-grams milestone string (e.g. "50 – 180 – 320 – 500")
 * into a timed pour schedule. Returns null if the sequence isn't parseable.
 */
export function parsePourSteps(
  sequence: string,
  targetTimeSec: number,
  roastDate?: string,
  now: number = Date.now(),
): PourStep[] | null {
  const parts = sequence.split(/\s*[–—\-]\s*/).map((s) => s.trim());
  if (parts.length < 2 || !parts.every((p) => /^\d+$/.test(p))) return null;

  const milestones = parts.map(Number);
  const n = milestones.length;
  const bloomDur = getBloomDuration(roastDate, now);
  const drawdownReserve = Math.round(targetTimeSec * 0.33);
  const remaining = targetTimeSec - bloomDur - drawdownReserve;
  const interval = n > 2 ? remaining / (n - 2) : 0;

  return milestones.map((grams, i) => ({
    index: i,
    label: i === 0 ? "Bloom" : i === n - 1 ? "Final pour" : `Pour ${i + 1}`,
    cumulativeGrams: grams,
    pourGrams: i === 0 ? grams : grams - milestones[i - 1],
    startTimeSec: i === 0 ? 0 : Math.round(bloomDur + (i - 1) * interval),
    action: (i === 0 ? "bloom" : i === n - 1 ? "final" : "pour") as PourStep["action"],
  }));
}

export function getActiveIdx(elapsed: number, steps: PourStep[]): number {
  let idx = 0;
  for (let i = 0; i < steps.length; i++) {
    if (elapsed >= steps[i].startTimeSec) idx = i;
  }
  return idx;
}
