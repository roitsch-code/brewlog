// A published recipe applies only within ±20 % of its published water
// (2026-10-10, owner: "It is called 1 cup recipe. Don't scale this one. There
// is a 2-cup recipe from Hoffmann as well. Use that.").
//
//   node --test tests/dataflow/reference-batch-window.test.mjs
//
// Anchor: the chat's SEY V60 of 10-10 15:21 bound to "Hoffmann V60 — 2024
// Refinement" — an UNVERIFIED corpus entry (18 g : 300 g, "Hoffmann YouTube —
// V60 refresh 2024", no URL, never cross-checked) stretched to 450 g. The entry
// is gone; the window is one constant used by the menu, the fidelity snap, the
// pour-time copy, the chat validator and a /recommend relabel.

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const dir = await mkdtemp(join(tmpdir(), "batchwindow-"));
const out = join(dir, "t.mjs");
await build({
  stdin: {
    contents: `
export { REFERENCE_BATCH_WINDOW, batchWithinWindow } from ${JSON.stringify(path.join(ROOT, "src/lib/recipe/batchWindow.ts"))};
export { resolveReference, reconcileToReference, referenceAppliesAtBatch } from ${JSON.stringify(path.join(ROOT, "src/lib/claude/recipeFidelity.ts"))};
export { applyPourDurations } from ${JSON.stringify(path.join(ROOT, "src/lib/recipe/pourDurations.ts"))};
export { validateRecipe } from ${JSON.stringify(path.join(ROOT, "src/lib/recipe/validateRecipe.ts"))};
export { selectRecipes, formatRecipeForPrompt } from ${JSON.stringify(path.join(ROOT, "src/lib/knowledge/recipes/helpers.ts"))};
export { ALL_RECIPES } from ${JSON.stringify(path.join(ROOT, "src/lib/knowledge/recipes/index.ts"))};
export { NICHE_GRIND_SETTINGS } from ${JSON.stringify(path.join(ROOT, "src/lib/constants/grindSettings.ts"))};
export { pourScheduleFor } from ${JSON.stringify(path.join(ROOT, "src/lib/utils/pourSequence.ts"))};
`,
    resolveDir: ROOT,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
  external: ["pg", "pg-native", "drizzle-orm", "drizzle-orm/*"],
});
const M = await import(pathToFileURL(out).href);
const ONE_CUP = M.ALL_RECIPES.find((r) => r.id === "hoffmann-v60-better-one-cup");
const ULTIMATE = M.ALL_RECIPES.find((r) => r.id === "hoffmann-v60-big-batch");

test("the unsourced 'Hoffmann V60 — 2024 Refinement' is gone and its name binds to nothing", () => {
  assert.equal(M.ALL_RECIPES.find((r) => r.id === "hoffmann-v60-2024"), undefined);
  assert.equal(M.resolveReference("Hoffmann V60 — 2024 Refinement"), null, "no silent rebinding to another Hoffmann");
  assert.ok(ONE_CUP && ULTIMATE);
});

test("the window: 250 g serves 200–300 g, 500 g serves 400–600 g", () => {
  assert.equal(M.REFERENCE_BATCH_WINDOW, 0.2);
  assert.equal(M.referenceAppliesAtBatch(ONE_CUP, 300), true);
  assert.equal(M.referenceAppliesAtBatch(ONE_CUP, 350), false, "the 1-Cup does not exist at 350 g");
  assert.equal(M.referenceAppliesAtBatch(ONE_CUP, 450), false);
  assert.equal(M.referenceAppliesAtBatch(ULTIMATE, 450), true, "450 g is Hoffmann's 2-cup recipe");
  assert.equal(M.referenceAppliesAtBatch(ULTIMATE, 350), false);
});

const ONE_CUP_AT = (water) => ({
  doseGrams: Math.round((water / 250) * 15),
  waterGrams: water,
  waterTempC: 100,
  grindSize: "380°",
  targetTimeSec: 200,
  pourSteps: [
    { label: "Bloom", action: "bloom", waterGramsAtEnd: water * 0.2, durationSec: 10 },
    { label: "Swirl", action: "swirl", durationSec: 5 },
    { label: "Rest", action: "wait", durationSec: 30 },
    { label: "Pulse 1", action: "pour", waterGramsAtEnd: water * 0.4, durationSec: 10 },
    { label: "Pause", action: "wait", durationSec: 10 },
    { label: "Pulse 2", action: "pour", waterGramsAtEnd: water * 0.6, durationSec: 10 },
    { label: "Pause", action: "wait", durationSec: 10 },
    { label: "Pulse 3", action: "pour", waterGramsAtEnd: water * 0.8, durationSec: 10 },
    { label: "Pause", action: "wait", durationSec: 10 },
    { label: "Pulse 4", action: "pour", waterGramsAtEnd: water, durationSec: 10 },
  ],
});

test("the fidelity snap and the pour-time copy stop at the window", () => {
  // Inside: the verified 1-Cup's own scaled pour times are used.
  const inside = M.applyPourDurations(ONE_CUP_AT(250), { basedOn: ONE_CUP.name, method: "V60", pourRateGPS: 2.4 });
  assert.equal(inside.source, "reference");
  // Outside: the owner's pace, and no snap against a recipe that does not apply.
  const outside = M.applyPourDurations(ONE_CUP_AT(450), { basedOn: ONE_CUP.name, method: "V60", pourRateGPS: 2.4 });
  assert.equal(outside.source, "house");
  const drifted = { ...ONE_CUP_AT(450), waterTempC: 88, targetTimeSec: 320 };
  assert.equal(M.reconcileToReference(drifted, ONE_CUP.name, "V60").changed, false, "no snap outside the window");
});

test("ANCHOR: the chat validator rejects a reference published for a different batch, naming the author's other size", () => {
  const problems = M.validateRecipe(ONE_CUP_AT(450), { method: "V60", basedOn: ONE_CUP.name });
  const p = problems.find((x) => x.code === "reference-wrong-batch");
  assert.ok(p, JSON.stringify(problems.map((x) => x.code)));
  assert.match(p.message, /published for 250 g/);
  assert.match(p.message, /Hoffmann V60 — Ultimate Technique \(30 g : 500 g\)/, "the sibling at that size is named");
  assert.ok(!M.validateRecipe(ONE_CUP_AT(250), { method: "V60", basedOn: ONE_CUP.name }).some((x) => x.code === "reference-wrong-batch"));
});

test("the menu offers a reference only within ±20 % of its published water — both directions", () => {
  const base = { roastLevel: "light", process: "washed", goal: "balanced", brewersAvailable: new Set(["v60", "clever", "kalita", "orea-classic", "origami-wave", "chemex"]) };
  const at = (ml) => M.selectRecipes({ ...base, maxWaterMl: ml, serveVolumeMl: ml }, 12).map((s) => s.recipe.id);
  assert.ok(!at(450).includes("hoffmann-v60-better-one-cup"), "the 1-Cup is not a 450 g reference");
  assert.ok(!at(350).includes("hoffmann-v60-better-one-cup"), "nor a 350 g one");
  assert.ok(!at(350).includes("hoffmann-v60-big-batch"), "the Ultimate is not a 350 g reference");
  for (const ml of [250, 350, 450]) {
    for (const id of at(ml)) {
      const r = M.ALL_RECIPES.find((x) => x.id === id);
      assert.ok(M.batchWithinWindow(r.water.grams, ml), `${id} (${r.water.grams} g) offered at ${ml} g`);
    }
    assert.ok(at(ml).length >= 2, `the menu at ${ml} g is not empty`);
  }
});

test("the scaled line appears at exactly 450 g off a 500 g recipe (the k−1 > 0.1 hole)", () => {
  const line = M.formatRecipeForPrompt(ULTIMATE, { scaleTo: { targetWaterGrams: 450 } });
  assert.match(line, /Scaled to your 450g/);
});

test("the 1-Cup carries the owner's measured grind anchor and renders at Hoffmann's own cadence", () => {
  assert.deepEqual(ONE_CUP.grind.nicheZeroDegrees, [375, 385]);
  const v60 = M.NICHE_GRIND_SETTINGS.find((g) => g.method === "V60");
  assert.deepEqual([v60.niche.min, v60.niche.max], ONE_CUP.grind.nicheZeroDegrees, "pinned to the measured V60 row in grindSettings.ts");
  const bloom = ONE_CUP.pourSequence[0];
  assert.equal(bloom.durationSec, 10, "50 g at his ~5 g/s is 10 s (0:00–0:10 in the video), not 5");
  const sched = M.pourScheduleFor(
    { doseGrams: 15, waterGrams: 250, waterTempC: 100, grindSize: "380°", targetTimeSec: 180, pourSteps: ONE_CUP.pourSequence.filter((s) => s.action !== "drain") },
    "2026-10-01", Date.parse("2026-10-10T12:00:00Z"), "V60",
  );
  assert.deepEqual(sched.steps.filter((s) => s.pourGrams > 0).map((s) => s.startTimeSec), [0, 45, 70, 90, 110], "0:45 / 1:10 / 1:30 / 1:50 as he publishes");
});

test("WIRING: /recommend relabels an out-of-window reference; the chat validator runs the batch check", async () => {
  const rec = await readFile(path.join(ROOT, "src/lib/claude/recommend.ts"), "utf8");
  assert.match(rec, /referenceAppliesAtBatch\(ref, water\)/);
  assert.match(rec, /\[recommend\] batch window:/);
  assert.match(rec, /const pourTimed = batchChecked\.map/, "the relabelled candidates flow on to the pour timing");
  const val = await readFile(path.join(ROOT, "src/lib/recipe/validateRecipe.ts"), "utf8");
  assert.match(val, /problems\.push\(\.\.\.checkReferenceBatch\(recipe, ctx\)\)/);
  const helpers = await readFile(path.join(ROOT, "src/lib/knowledge/recipes/helpers.ts"), "utf8");
  assert.match(helpers, /w < input\.maxWaterMl \/ \(1 \+ REFERENCE_BATCH_WINDOW\)/, "the menu's LOWER bound");
});
