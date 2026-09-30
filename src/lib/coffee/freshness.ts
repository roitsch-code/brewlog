/**
 * Bean age — ONE table for the whole app.
 *
 * Until 2026-09-30 roast age was classified in four places with slightly
 * different edges (recommend.ts's prompt note, the bloom in pourSequence.ts,
 * brewSignature's freshness zone, and the /recommend prompt itself — which
 * said ">22 days → grind finer" in one line and ">35 days" in another). The
 * edges below are the ones recommend.ts already used; the other consumers now
 * read them from here. Pure, dependency-free. Tests:
 * tests/dataflow/freshness.test.mjs.
 */

export type FreshnessBucket =
  | "too-fresh" //  < 5 days (also a roast date in the future)
  | "very-fresh" // 5–6
  | "peak" //       7–21
  | "past-peak" //  22–34
  | "softening" //  35–59
  | "stale" //      60+
  | "unknown";

const DAY_MS = 86_400_000;

export function daysSinceRoast(roastDate?: string | null, now: number = Date.now()): number | null {
  if (!roastDate) return null;
  const t = new Date(roastDate).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.floor((now - t) / DAY_MS);
}

export function freshnessBucket(daysOld: number | null | undefined): FreshnessBucket {
  if (daysOld == null || !Number.isFinite(daysOld)) return "unknown";
  if (daysOld < 5) return "too-fresh";
  if (daysOld < 7) return "very-fresh";
  if (daysOld < 22) return "peak";
  if (daysOld < 35) return "past-peak";
  if (daysOld < 60) return "softening";
  return "stale";
}

/** The note /recommend puts next to the roast date in its user message. */
export function freshnessNote(bucket: FreshnessBucket): string {
  switch (bucket) {
    case "too-fresh":
      return "too fresh — heavy CO₂, channeling risk, bloom 50s+";
    case "very-fresh":
      return "very fresh — bloom 50s recommended";
    case "peak":
      return "peak window — ideal";
    case "past-peak":
      return "past peak — fewer pours, gentler agitation; keep the grind unless the drawdown runs fast";
    case "softening":
      return "softening — flavors fading; grind finer to recover solubility";
    case "stale":
      return "likely stale — grind finer to recover solubility";
    default:
      return "";
  }
}

/** Old enough that grinding finer is the deliberate, correct move. */
export function wantsFinerForAge(daysOld: number | null | undefined): boolean {
  const b = freshnessBucket(daysOld);
  return b === "softening" || b === "stale";
}
