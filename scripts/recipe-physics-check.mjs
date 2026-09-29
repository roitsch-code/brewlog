/**
 * Render every percolation recipe in the corpus through the REAL brew timeline
 * and report the physics violations a user would actually meet.
 *
 * This is the before/after metric for the cadence-first rewrite (Sep 2026). Run
 * it at the recipe's own published volume, and again scaled up, so a change to
 * the timing math can be measured instead of asserted:
 *
 *   node scripts/recipe-physics-check.mjs            # own volume
 *   node scripts/recipe-physics-check.mjs --scale 1.6
 *   node scripts/recipe-physics-check.mjs --verbose  # list every violation
 *
 * Baseline on the reserve-based renderer it replaced: 13 of 99 percolation
 * recipes were flagged at their OWN published volume — published expert recipes
 * that the app then refused to offer. Cadence-first should be 0.
 */
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const verbose = args.includes("--verbose");
const scaleArg = args.indexOf("--scale");
const scale = scaleArg >= 0 ? Number(args[scaleArg + 1]) : 1;

const entry = `
export { buildBrewTimeline } from ${JSON.stringify(path.join(ROOT, "src/lib/brew/timeline.ts"))};
export { maxRenderedPourGapSec, pourScheduleFor, hasImmersionShape, MAX_POUR_RATE_GPS, minDrawdownSec } from ${JSON.stringify(path.join(ROOT, "src/lib/utils/pourSequence.ts"))};
export { LONG_DESIGNED_WAIT_SEC } from ${JSON.stringify(path.join(ROOT, "src/lib/knowledge/recipes/helpers.ts"))};
export { ALL_RECIPES } from ${JSON.stringify(path.join(ROOT, "src/lib/knowledge/recipes/index.ts"))};
`;
const dir = await mkdtemp(join(tmpdir(), "physics-"));
const out = join(dir, "bundle.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const K = await import(pathToFileURL(out).href);

// A fixed clock + roast age so the run is deterministic (19 days → 45 s bloom).
const NOW = Date.parse("2026-09-29T08:00:00Z");
const ROAST = "2026-09-10";

/** Recipes whose cumulative pours deliberately stop short of `water`: an iced
 * build pours the hot half onto ice, a bypass recipe dilutes after brewing, and
 * a machine drip authors no per-pour milestones at all. */
const SPLIT_BUILD = /iced|bypass|flash|japanese/i;
const isSplitBuild = (r) =>
  SPLIT_BUILD.test(r.id) ||
  (Array.isArray(r.pourSequence) && r.pourSequence.some((s) => s.action === "bypass")) ||
  (r.occasions ?? []).includes("summer-time");

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

function toRecipe(r, k) {
  const steps = r.pourSequence.map((s) => ({
    label: s.label,
    action: s.action,
    ...(typeof s.waterGramsAtEnd === "number"
      ? { waterGramsAtEnd: Math.round(s.waterGramsAtEnd * k) }
      : {}),
    ...(typeof s.durationSec === "number" ? { durationSec: s.durationSec } : {}),
  }));
  return {
    doseGrams: r.dose.grams * k,
    waterGrams: Math.round(r.water.grams * k),
    waterTempC: r.temperature?.celsius ?? 93,
    grindSize: "x",
    targetTimeSec: r.totalTimeSec,
    pourSequence: "",
    pourSteps: steps,
  };
}

const rows = [];
let checked = 0;
for (const r of K.ALL_RECIPES) {
  if (!Array.isArray(r.pourSequence) || (r.totalTimeSec ?? 0) >= 3600) continue;
  const recipe = toRecipe(r, scale);
  const method = r.brewer ?? "V60";
  // Immersion is timed by its own authored steps, not by a pour cadence.
  if (K.hasImmersionShape(recipe)) continue;
  const schedule = K.pourScheduleFor(recipe, ROAST, NOW, method);
  if (!schedule) continue; // machine drip / prose — no pour schedule to check
  checked++;
  const problems = [];

  const gap = K.maxRenderedPourGapSec(recipe, ROAST, NOW, method);
  if (gap > K.LONG_DESIGNED_WAIT_SEC) {
    problems.push(`dead-gap ${Math.round(gap)}s (> ${K.LONG_DESIGNED_WAIT_SEC}s)`);
  }

  for (const s of schedule.steps) {
    if (s.pourGrams <= 0) continue;
    const rate = s.pourGrams / Math.max(1, s.timingDurationSec);
    if (rate > K.MAX_POUR_RATE_GPS + 0.01) {
      problems.push(`"${s.label}" ${s.pourGrams}g in ${s.timingDurationSec}s = ${rate.toFixed(1)} g/s`);
    }
  }

  const floor = K.minDrawdownSec(method);
  if (schedule.drawdownSec < floor) {
    problems.push(`drawdown ${schedule.drawdownSec}s < ${floor}s floor`);
  }
  if (schedule.extended) {
    problems.push(`clock ${fmt(recipe.targetTimeSec)} too short — pours run to ${fmt(schedule.pourPhaseEndSec)}`);
  }

  if (!isSplitBuild(r)) {
    const water = schedule.steps.filter((s) => s.pourGrams > 0);
    const lastCumulative = water.length ? water[water.length - 1].cumulativeGrams : 0;
    if (Math.abs(lastCumulative - recipe.waterGrams) > 1) {
      problems.push(`pours reach ${lastCumulative}g but recipe says ${recipe.waterGrams}g`);
    }
  }

  if (problems.length) rows.push({ id: r.id, problems });
}

console.log(
  `\nPercolation recipes checked: ${checked}` +
    (scale !== 1 ? `  (scaled ×${scale})` : "  (own published volume)"),
);
console.log(`Recipes with a physics violation: ${rows.length}\n`);
if (rows.length && verbose) {
  for (const row of rows) console.log(`  ${row.id}\n    - ${row.problems.join("\n    - ")}`);
} else if (rows.length) {
  for (const row of rows) console.log(`  ${row.id}: ${row.problems[0]}`);
}
process.exitCode = 0;
