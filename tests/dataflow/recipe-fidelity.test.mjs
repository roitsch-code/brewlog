// Recipe-fidelity backstop tests. Bundles the REAL recipeFidelity.ts (which
// pulls the REAL recipe corpus) with esbuild and asserts the guard against it,
// so the tests track the actual data — not a re-declared copy.
//
//   node --test tests/dataflow/recipe-fidelity.test.mjs
//
// The guard's job: when /recommend returns a candidate that claims to adapt a
// verified published recipe but has mangled its grind / cadence / total time,
// snap the mechanics back to the faithful scaled reference. This is the exact
// Kasuya Super Coarse 10-Pour failure (20g:300g super-coarse ~3:30 → served as
// 23g:350g at a normal 412° with a 4:45 total) that scared the user.

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const entry = `export { reconcileToReference, resolveReference, reconcileWaterToPourPlan } from ${JSON.stringify(
  path.join(ROOT, "src/lib/claude/recipeFidelity.ts"),
)};`;
const dir = await mkdtemp(join(tmpdir(), "fidelity-"));
const out = join(dir, "b.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { reconcileToReference, resolveReference, reconcileWaterToPourPlan } = await import(
  pathToFileURL(out).href
);

// The exact mangled recipe from the screenshot: Kasuya Super Coarse 10-Pour
// scaled to 350ml, but with a normal grind and a stretched ~4:45 total.
function mangledKasuya() {
  return {
    doseGrams: 23,
    waterGrams: 350,
    waterTempC: 96,
    grindSize: "412°",
    targetTimeSec: 285, // 4:45 — should be ~3:30
    pourSequence: "35 – 70 – 105 – 140 – 175 – 210 – 245 – 280 – 315 – 350",
    pourSteps: Array.from({ length: 10 }, (_, i) => ({
      label: i === 0 ? "Bloom" : `Pour ${i + 1}`,
      action: i === 0 ? "bloom" : "pour",
      waterGramsAtEnd: 35 * (i + 1),
      durationSec: 28,
    })),
  };
}

test("resolveReference matches a verified recipe by name (and shortName)", () => {
  const r1 = resolveReference("Kasuya Super Coarse 10-Pour");
  assert.ok(r1, "should resolve the full name");
  assert.match(r1.id, /kasuya-super-coarse/);

  const r2 = resolveReference("Kasuya Super Coarse");
  assert.ok(r2, "should resolve the short form");
  assert.match(r2.id, /kasuya-super-coarse/);
});

test("resolveReference returns null for 'Own recipe' and gibberish", () => {
  assert.equal(resolveReference("Own recipe"), null);
  assert.equal(resolveReference(undefined), null);
  assert.equal(resolveReference("xyzzy not a recipe"), null);
});

test("a mangled Kasuya Super Coarse is snapped back to the published recipe", () => {
  const { recipe, changed, reasons, reference } = reconcileToReference(
    mangledKasuya(),
    "Kasuya Super Coarse 10-Pour",
  );
  assert.equal(changed, true, "should detect drift and correct");
  assert.match(reference, /Super Coarse/);

  // Total time snapped back to the published ~3:30 (210s), NOT 4:45.
  assert.equal(recipe.targetTimeSec, 210);

  // Grind snapped back into the super-coarse range (published 435–455°), NOT 412°.
  const deg = Number(/(\d{2,3})/.exec(recipe.grindSize)[1]);
  assert.ok(deg >= 430 && deg <= 460, `grind should be super-coarse, got ${recipe.grindSize}`);

  // The user's batch is preserved.
  assert.equal(recipe.doseGrams, 23);
  assert.equal(recipe.waterGrams, 350);

  // Pours are the published cadence scaled to 350ml: final milestone lands on 350.
  const last = recipe.pourSteps.filter((s) => typeof s.waterGramsAtEnd === "number").pop();
  assert.equal(last.waterGramsAtEnd, 350);
  // Published pour cadence is fast (5s pulses), NOT the 28s the model invented.
  // (The drawdown DRAIN step is legitimately ~55s — exclude it; we check pours.)
  const longestPour = Math.max(
    ...recipe.pourSteps.filter((s) => s.action === "pour" || s.action === "bloom").map((s) => s.durationSec ?? 0),
  );
  assert.ok(longestPour <= 10, `pour pulses should be the published ~5s, got ${longestPour}s`);

  assert.ok(reasons.some((r) => /total time/.test(r)), "reasons should mention the time drift");
});

test("a faithful scaled Kasuya is left untouched", () => {
  // 20g:300g published → faithful 350ml scale: super-coarse grind, ~3:30.
  const faithful = {
    doseGrams: 23,
    waterGrams: 350,
    waterTempC: 96,
    grindSize: "445°",
    targetTimeSec: 210,
    pourSteps: Array.from({ length: 10 }, (_, i) => ({
      label: i === 0 ? "Bloom" : `Pour ${i + 1}`,
      action: i === 0 ? "bloom" : "pour",
      waterGramsAtEnd: 35 * (i + 1),
      durationSec: 5,
    })),
  };
  const { changed } = reconcileToReference(faithful, "Kasuya Super Coarse 10-Pour");
  assert.equal(changed, false, "a faithful recipe must not be touched");
});

test("'Own recipe' candidates are never reconciled", () => {
  const { changed } = reconcileToReference(mangledKasuya(), "Own recipe");
  assert.equal(changed, false);
});

test("a small, legitimate adaptation passes (no over-triggering)", () => {
  // Same recipe, brewed slightly slower (3:45 vs 3:30) and one notch finer —
  // within tolerance, should NOT be snapped.
  const tweaked = {
    doseGrams: 20,
    waterGrams: 300,
    waterTempC: 96,
    grindSize: "440°",
    targetTimeSec: 225, // +15s
    pourSteps: [
      { label: "Bloom", action: "bloom", waterGramsAtEnd: 30, durationSec: 5 },
      { label: "Pour", action: "pour", waterGramsAtEnd: 300, durationSec: 5 },
    ],
  };
  const { changed } = reconcileToReference(tweaked, "Kasuya Super Coarse 10-Pour");
  assert.equal(changed, false, "a small in-tolerance tweak must pass");
});

// ── reconcileWaterToPourPlan — headline-vs-pour-plan consistency guard ──────

test("waterGrams is snapped to the pour plan when the header disagrees", () => {
  // The reported case: header says 225g, pour plan pours to 230g (an inverted
  // AeroPress immersion adapted from Stanica's 18g:225g reference).
  const recipe = {
    doseGrams: 15,
    waterGrams: 225, // stale — copied from the reference header
    waterTempC: 90,
    grindSize: "26",
    targetTimeSec: 230,
    pourSteps: [
      { label: "Pour", action: "pour", waterGramsAtEnd: 80, durationSec: 10 },
      { label: "Bloom", action: "bloom", waterGramsAtEnd: 80, durationSec: 35 },
      { label: "Final pour", action: "final", waterGramsAtEnd: 230, durationSec: 15 },
      { label: "Steep", action: "wait", durationSec: 145 },
      { label: "Flip & press", action: "press", durationSec: 40 },
    ],
  };
  const fixed = reconcileWaterToPourPlan(recipe);
  assert.equal(fixed.waterGrams, 230, "header water should follow the pour plan");
  // Everything else is untouched (dose/temp/grind have no second source here).
  assert.equal(fixed.doseGrams, 15);
  assert.equal(fixed.waterTempC, 90);
});

test("a consistent recipe is returned unchanged (same object)", () => {
  const recipe = {
    doseGrams: 15,
    waterGrams: 250,
    waterTempC: 94,
    grindSize: "380°",
    targetTimeSec: 180,
    pourSteps: [
      { label: "Bloom", action: "bloom", waterGramsAtEnd: 45, durationSec: 45 },
      { label: "Pour", action: "pour", waterGramsAtEnd: 150, durationSec: 30 },
      { label: "Final pour", action: "final", waterGramsAtEnd: 250, durationSec: 30 },
    ],
  };
  const fixed = reconcileWaterToPourPlan(recipe);
  assert.equal(fixed, recipe, "no divergence → original object returned");
});

test("bypass water is excluded — concentrate recipes keep their brew-water header", () => {
  // Stanica-style: brew to 225g, then 25g room-temp bypass. waterGrams = brew
  // water (225), NOT 225+25 — the bypass step must not inflate the header.
  const recipe = {
    doseGrams: 18,
    waterGrams: 225,
    waterTempC: 93,
    grindSize: "388°",
    targetTimeSec: 135,
    pourSteps: [
      { label: "Pour", action: "pour", waterGramsAtEnd: 225, durationSec: 30 },
      { label: "Steep", action: "wait", durationSec: 60 },
      { label: "Press", action: "press", durationSec: 30 },
      { label: "Bypass", action: "bypass", waterGramsAtEnd: 250, durationSec: 10 },
    ],
  };
  const fixed = reconcileWaterToPourPlan(recipe);
  assert.equal(fixed.waterGrams, 225, "bypass must not inflate the brew-water header");
});

test("iced recipes keep waterGrams as the hot-water amount", () => {
  // Hoffmann Immersion Iced: 250g hot onto 150g ice. waterGrams = 250 (hot),
  // iceGrams = 150 separate. The pour plan reaches 250; ice is not a pour.
  const recipe = {
    doseGrams: 20,
    waterGrams: 250,
    iceGrams: 150,
    waterTempC: 95,
    grindSize: "421°",
    targetTimeSec: 300,
    pourSteps: [
      { label: "Pour water", action: "pour", waterGramsAtEnd: 250, durationSec: 15 },
      { label: "Steep", action: "wait", durationSec: 220 },
      { label: "Drain onto ice", action: "drain", durationSec: 55 },
    ],
  };
  const fixed = reconcileWaterToPourPlan(recipe);
  assert.equal(fixed.waterGrams, 250, "hot-water header preserved");
  assert.equal(fixed.iceGrams, 150);
});

test("an incomplete pour plan (final pour has no milestone) is left untouched", () => {
  const recipe = {
    doseGrams: 30,
    waterGrams: 500,
    waterTempC: 94,
    grindSize: "400°",
    targetTimeSec: 210,
    pourSteps: [
      { label: "Bloom", action: "bloom", waterGramsAtEnd: 60, durationSec: 45 },
      { label: "Final pour", action: "final", durationSec: 60 }, // no milestone
    ],
  };
  const fixed = reconcileWaterToPourPlan(recipe);
  assert.equal(fixed.waterGrams, 500, "incomplete plan must not drag the header down");
});

test("recipes without pourSteps are left untouched", () => {
  const recipe = {
    doseGrams: 15,
    waterGrams: 250,
    waterTempC: 92,
    grindSize: "380°",
    targetTimeSec: 180,
    pourSequence: "50 – 150 – 250",
  };
  const fixed = reconcileWaterToPourPlan(recipe);
  assert.equal(fixed, recipe);
});

test("unverified references are not snapped (we don't trust reconstructed steps)", () => {
  // Perger High-Extraction V60 is verified:false in the corpus. Even a wild
  // drift should be left alone — the prompt rule covers it, not this guard.
  const wild = {
    doseGrams: 12,
    waterGrams: 200,
    waterTempC: 80, // published is 97°C — wildly off
    grindSize: "300°",
    targetTimeSec: 600,
    pourSteps: [
      { label: "Bloom", action: "bloom", waterGramsAtEnd: 30, durationSec: 5 },
      { label: "Pour", action: "pour", waterGramsAtEnd: 200, durationSec: 5 },
    ],
  };
  const { changed } = reconcileToReference(wild, "Perger High-Extraction V60");
  assert.equal(changed, false, "unverified reference → no snap");
});
