// Published recipes must render at their published times.
//
//   node --test tests/dataflow/corpus-cadence.test.mjs
//
// THE GATE: the brew timer used to re-derive every pour start from
// `targetTimeSec` — a roast-age bloom, a fixed 33% drawdown reserve, and the
// remainder split between the pours in proportion to their grams. That silently
// re-timed every expert recipe in the corpus. Kasuya's 45-second intervals came
// out at 32; Rao's designed 58-second rest rendered as a 106-second hole, which
// then tripped the app's own dead-gap guard and got his recipe dropped from the
// menu entirely. Six of the corpus's expert recipes were being thrown away that
// way, including every big-batch recipe a 450–500ml brew needs.
//
// These cases are anchored to the ORIGINATORS' published schedules, not to
// whatever the code currently does, so they fail if the timer ever goes back to
// inventing its own cadence.
import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const entry = `
export { buildBrewTimeline } from ${JSON.stringify(path.join(ROOT, "src/lib/brew/timeline.ts"))};
export { maxRenderedPourGapSec } from ${JSON.stringify(path.join(ROOT, "src/lib/utils/pourSequence.ts"))};
export { ALL_RECIPES, LONG_DESIGNED_WAIT_SEC } from ${JSON.stringify(path.join(ROOT, "src/lib/knowledge/recipes/index.ts"))};
`;
const dir = await mkdtemp(join(tmpdir(), "cadence-"));
const out = join(dir, "c.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { buildBrewTimeline, maxRenderedPourGapSec, ALL_RECIPES, LONG_DESIGNED_WAIT_SEC } =
  await import(pathToFileURL(out).href);

// A bag inside the peak window, so the roast-age bloom shift is zero and the
// recipes render exactly as published.
const NOW = Date.parse("2026-09-29T08:00:00Z");
const PEAK_ROAST = "2026-09-10";

function render(id) {
  const r = ALL_RECIPES.find((x) => x.id === id);
  assert.ok(r, `${id} missing from the corpus`);
  const recipe = {
    doseGrams: r.dose.grams,
    waterGrams: r.water.grams,
    waterTempC: r.temperature?.celsius ?? 93,
    grindSize: "x",
    targetTimeSec: r.totalTimeSec,
    pourSequence: "",
    pourSteps: r.pourSequence.map((s) => ({
      label: s.label,
      action: s.action,
      ...(typeof s.waterGramsAtEnd === "number" ? { waterGramsAtEnd: s.waterGramsAtEnd } : {}),
      ...(typeof s.durationSec === "number" ? { durationSec: s.durationSec } : {}),
    })),
  };
  const tl = buildBrewTimeline(recipe, PEAK_ROAST, NOW, r.brewer);
  return {
    recipe,
    brewer: r.brewer,
    timeline: tl,
    pourStarts: (tl.pourSteps ?? []).filter((p) => p.pourGrams > 0).map((p) => p.startTimeSec),
    gap: maxRenderedPourGapSec(recipe, PEAK_ROAST, NOW, r.brewer),
  };
}

test("Hoffmann's 1-Cup V60 renders at the times he publishes", () => {
  // hario-usa.com, "James Hoffmann - 1 Cup V60 Technique": bloom at 0:00, then
  // pours to 100g at 1:00, 150g at 1:10, 200g at 1:30 and 250g at 1:50, with
  // drawdown finishing around 3:00. The corpus encodes the pours starting at
  // 0:45 (his 45s bloom), and each one lands on his published clock.
  const { pourStarts, timeline } = render("hoffmann-v60-better-one-cup");
  assert.deepEqual(pourStarts, [0, 45, 70, 90, 110]);
  assert.equal(timeline.targetTimeSec, 180);
  assert.ok(timeline.drawdownSec >= 55, `drawdown ${timeline.drawdownSec}s`);
});

test("Kasuya's 4:6 keeps its 45-second intervals", () => {
  // The whole method is the interval: five equal pours, one every 45s. The old
  // renderer compressed them to ~32s, which changes the recipe into a different
  // one — the phases stop draining between pours.
  const { pourStarts, gap } = render("kasuya-4-6-standard");
  assert.deepEqual(pourStarts, [0, 45, 90, 135, 165]);
  const intervals = pourStarts.slice(1).map((t, i) => t - pourStarts[i]);
  assert.deepEqual(intervals, [45, 45, 45, 30]);
  assert.ok(gap <= LONG_DESIGNED_WAIT_SEC);
});

test("Rao's designed 58-second rest is a rest, not a hole", () => {
  // His recipe is bloom + two pours with a long rest between them. Rendered by
  // the old reserve formula that rest became a 106s gap — over the app's own
  // 75s dead-gap threshold — so the recipe was dropped from every hot menu.
  // His cadence as the corpus encodes it: a 60s bloom block (pour 8s, spin 5s,
  // rest 47s), pour to 200g over 20s, a 2s spin, then his 58s rest → 2:20.
  const { pourStarts, gap } = render("rao-rule-of-thirds");
  assert.deepEqual(pourStarts, [0, 60, 140]);
  assert.equal(gap, 60, "the gap IS his designed rest plus the spin");
  assert.ok(
    gap <= LONG_DESIGNED_WAIT_SEC,
    `a published recipe must not read as a stalled brew (gap ${Math.round(gap)}s)`,
  );
});

test("the big-batch recipes a 500ml brew needs are brewable again", () => {
  // Bloom + two long pours, back to back, then a long drawdown. Under the old
  // renderer all three showed a 76–156s hole and were dropped — which is why a
  // 450–500ml request had no expert big-batch recipe to draw on.
  for (const id of ["hoffmann-v60-big-batch", "wendelboe-v60-big-batch", "chemex-hoffmann"]) {
    const { gap, timeline } = render(id);
    assert.ok(gap <= LONG_DESIGNED_WAIT_SEC, `${id} still renders a ${Math.round(gap)}s hole`);
    assert.ok(timeline.finishSec >= timeline.pourPhaseEndSec, `${id} ends mid-pour`);
  }
});

test("every percolation recipe in the corpus renders a brewable schedule", () => {
  const IMMERSION = new Set(["clever", "aeropress", "aeropress-prismo", "cold-brew-jar", "moccamaster"]);
  const broken = [];
  for (const r of ALL_RECIPES) {
    if (IMMERSION.has(r.brewer)) continue;
    if (!Array.isArray(r.pourSequence) || r.totalTimeSec >= 3600) continue;
    if (!r.pourSequence.some((s) => typeof s.waterGramsAtEnd === "number")) continue;
    const { timeline, gap, brewer } = render(r.id);
    if (timeline.shape !== "percolation") continue;
    const problems = [];
    if (gap > LONG_DESIGNED_WAIT_SEC) problems.push(`${Math.round(gap)}s hole`);
    for (const p of timeline.pourSteps.filter((x) => x.pourGrams > 0)) {
      const rate = p.pourGrams / p.timingDurationSec;
      if (rate > 8.001) problems.push(`${p.label} at ${rate.toFixed(1)} g/s`);
    }
    if (problems.length) broken.push(`${r.id} (${brewer}): ${problems.join(", ")}`);
  }
  assert.deepEqual(broken, [], `recipes the timer would render unbrewably:\n  ${broken.join("\n  ")}`);
});
