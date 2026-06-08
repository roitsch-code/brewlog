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
const entry = `export { reconcileToReference, resolveReference } from ${JSON.stringify(
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
const { reconcileToReference, resolveReference } = await import(pathToFileURL(out).href);

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
