// Adaptive hydration target tests. Bundles the REAL computeTarget.ts with
// esbuild and asserts the spec (§3) examples against it, so the tests track
// the actual implementation — not a re-declared copy.
//
//   node --test tests/dataflow/hydration-target.test.mjs
//
// Examples from the spec: +480 ml at apparent 31 °C, +500 ml at 900 active
// kcal, the combined "hot commute day" total, and the hard caps. Config is
// passed explicitly so the test is independent of any .env tuning.

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const entry = `export { computeTarget } from ${JSON.stringify(
  path.join(ROOT, "src/lib/hydration/computeTarget.ts"),
)};`;
const dir = await mkdtemp(join(tmpdir(), "hydration-"));
const out = join(dir, "b.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
});
const { computeTarget } = await import(pathToFileURL(out).href);

// Spec defaults, pinned explicitly (basis = 2700 for Markus ~112 kg).
const cfg = {
  basisMl: 2700,
  schwelleC: 23,
  mlProGrad: 60,
  hitzeCapMl: 1000,
  aktivBasisKcal: 400,
  mlProKcal: 1.0,
  bewegungCapMl: 1200,
  zielCapMl: 4500,
  meldeDeltaMl: 300,
};

test("heat surcharge: apparent 31 °C → +480 ml", () => {
  const r = computeTarget({ config: cfg, apparentTempMax: 31, activeCalories: null });
  assert.equal(r.hitzeMl, 480);
  assert.equal(r.bewegungMl, 0);
  assert.equal(r.zielMl, 3180); // 2700 + 480
});

test("movement surcharge: 900 active kcal → +500 ml", () => {
  const r = computeTarget({ config: cfg, apparentTempMax: null, activeCalories: 900 });
  assert.equal(r.bewegungMl, 500);
  assert.equal(r.hitzeMl, 0);
  assert.equal(r.zielMl, 3200); // 2700 + 500
});

test("hot commute day: 31 °C + 900 kcal → 3680 ml", () => {
  const r = computeTarget({ config: cfg, apparentTempMax: 31, activeCalories: 900 });
  assert.equal(r.hitzeMl, 480);
  assert.equal(r.bewegungMl, 500);
  assert.equal(r.zielMl, 3680); // 2700 + 480 + 500
});

test("below threshold: 20 °C → no heat surcharge", () => {
  const r = computeTarget({ config: cfg, apparentTempMax: 20 });
  assert.equal(r.hitzeMl, 0);
});

test("below activity baseline: 300 kcal → no movement surcharge", () => {
  const r = computeTarget({ config: cfg, activeCalories: 300 });
  assert.equal(r.bewegungMl, 0);
});

test("caps: extreme inputs are clamped (heat 1000, movement 1200, ziel 4500)", () => {
  const r = computeTarget({ config: cfg, apparentTempMax: 100, activeCalories: 5000 });
  assert.equal(r.hitzeMl, 1000);
  assert.equal(r.bewegungMl, 1200);
  assert.equal(r.zielMl, 4500); // min(2700 + 1000 + 1200, 4500)
});

test("missing both inputs → bare basis", () => {
  const r = computeTarget({ config: cfg });
  assert.equal(r.hitzeMl, 0);
  assert.equal(r.bewegungMl, 0);
  assert.equal(r.zielMl, 2700);
});

test("NaN inputs are treated as missing, not propagated", () => {
  const r = computeTarget({ config: cfg, apparentTempMax: NaN, activeCalories: NaN });
  assert.equal(r.zielMl, 2700);
});
