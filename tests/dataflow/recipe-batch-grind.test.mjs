// Batch-grind backstop tests. Bundles the REAL recipeFidelity.ts (+ the real
// recipe corpus) with esbuild and asserts the large-batch grind guard.
//
//   node --test tests/dataflow/recipe-batch-grind.test.mjs
//
// The guard's job (the "450ml/3:30 doesn't drain" complaint): when a candidate
// is scaled to a genuinely larger batch (≥1.3× the reference water) but keeps a
// single-cup grind, coarsen ONLY the grind (grind-settings.md ~+20°/doubling of
// dose) so the deeper bed still drains in a controlled time at the correct
// extraction. The total time is NEVER stretched — a longer clock over-extracts;
// grind is the flow lever.

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const entry = `export { reconcileToReference } from ${JSON.stringify(
  path.join(ROOT, "src/lib/claude/recipeFidelity.ts"),
)};`;
const dir = await mkdtemp(join(tmpdir(), "batchgrind-"));
const out = join(dir, "b.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { reconcileToReference } = await import(pathToFileURL(out).href);

// Kasuya 4:6 (resolves to wbrc-2016-kasuya): 20g:300g, Niche 390–400°, 3:30.
// Batch-appropriate grind for a 1.5× batch = round(395) + round(20*0.5) = 405°.
function kasuyaBatch({ dose, water, grind, time = 210 }) {
  return {
    doseGrams: dose,
    waterGrams: water,
    waterTempC: 93,
    grindSize: grind,
    targetTimeSec: time,
    pourSequence: "60 – 180 – 300 – 450",
    pourSteps: [
      { label: "Bloom", action: "bloom", waterGramsAtEnd: 60, durationSec: 45 },
      { label: "Pour 2", action: "pour", waterGramsAtEnd: 180, durationSec: 30 },
      { label: "Pour 3", action: "pour", waterGramsAtEnd: 300, durationSec: 30 },
      { label: "Final pour", action: "final", waterGramsAtEnd: 450, durationSec: 30 },
    ],
  };
}

test("large batch + single-cup grind → grind coarsened to the batch value", () => {
  const { recipe, changed, reasons, reference } = reconcileToReference(
    kasuyaBatch({ dose: 30, water: 450, grind: "395°" }), // 1.5× the 300g reference
    "Kasuya 4:6",
  );
  assert.equal(changed, true);
  assert.equal(recipe.grindSize, "405°"); // 395 + 10 (grind-settings +20°/doubling)
  assert.match(reference, /Kasuya/);
  assert.match(reasons[0], /too fine/i);
});

test("coarsening NEVER stretches the total time or the pour plan", () => {
  const input = kasuyaBatch({ dose: 30, water: 450, grind: "395°", time: 210 });
  const { recipe } = reconcileToReference(input, "Kasuya 4:6");
  // Grind is the flow lever; the clock is untouched (a longer clock over-extracts).
  assert.equal(recipe.targetTimeSec, 210);
  assert.equal(recipe.pourSequence, input.pourSequence);
  assert.deepEqual(recipe.pourSteps, input.pourSteps);
});

test("small batch change (<1.3×) is left untouched", () => {
  // 330g is only 1.1× the 300g reference — a single-cup grind is still fine.
  const { changed } = reconcileToReference(
    kasuyaBatch({ dose: 22, water: 330, grind: "395°" }),
    "Kasuya 4:6",
  );
  assert.equal(changed, false);
});

test("large batch already coarse enough is left untouched", () => {
  const { changed } = reconcileToReference(
    kasuyaBatch({ dose: 30, water: 450, grind: "406°" }), // ≥ 405 target
    "Kasuya 4:6",
  );
  assert.equal(changed, false);
});

test("reference without published Niche degrees is not grind-corrected", () => {
  // Hoffmann V60 publishes no Niche number (calibrate) → the guard can't compute
  // a batch grind, so it leaves the candidate for the prompt rule to handle.
  const { changed } = reconcileToReference(
    { doseGrams: 27, waterGrams: 450, waterTempC: 94, grindSize: "390°", targetTimeSec: 200, pourSequence: "60 – 180 – 300 – 450" },
    "Hoffmann V60",
  );
  assert.equal(changed, false);
});
