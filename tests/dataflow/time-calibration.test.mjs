// Measured timing-calibration tests. Bundles the REAL historyUtils.ts and
// asserts measuredTimeDelta — the volume-bucketed median (actual − target)
// that /recommend uses to raise a candidate's promised clock to what this
// method at this batch size has actually been measuring.
//
//   node --test tests/dataflow/time-calibration.test.mjs
//
// The problem it solves ("die Zeit ist off — mathematisch kommt es nicht hin"):
// a 450ml recipe scaled off a single-cup reference kept the reference's 3:30
// even though every past 450ml brew of that method ran longer. The per-method
// average in buildTimingStats mixes batch sizes, so the large-batch signal
// drowned. This helper buckets by volume and uses the MEDIAN of measured
// deltas — the app's own recorded data, never an invented scaling slope.

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const entry = `export { measuredTimeDelta } from ${JSON.stringify(
  path.join(ROOT, "src/lib/claude/historyUtils.ts"),
)};`;
const dir = await mkdtemp(join(tmpdir(), "timecal-"));
const out = join(dir, "tc.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { measuredTimeDelta } = await import(pathToFileURL(out).href);

const isPercolation = (m) =>
  m ? ["v60", "origami (wave)", "kalita wave"].includes(m.toLowerCase().trim()) : false;

/** A logged session: brewed `method` at `water`g, promised `target`s, took `actual`s. */
const mk = (method, water, target, actual) => ({
  brew: { methodUsed: method, actualTimeSec: actual },
  recommendation: {
    primaryMethod: method,
    primaryRecipe: { doseGrams: 30, waterGrams: water, waterTempC: 93, grindSize: "400°", targetTimeSec: target },
  },
});

test("median delta over same-method same-volume sessions", () => {
  const sessions = [
    mk("Origami (wave)", 450, 210, 250), // +40
    mk("Origami (wave)", 450, 210, 260), // +50
    mk("Origami (wave)", 440, 210, 245), // +35 (within ±20%)
  ];
  const cal = measuredTimeDelta(sessions, "Origami (wave)", 450, isPercolation);
  assert.ok(cal, "expected a calibration");
  assert.equal(cal.count, 3);
  assert.equal(cal.deltaSec, 40); // median of +35/+40/+50
});

test("different volumes do NOT pollute the bucket (the single-cup dilution bug)", () => {
  const sessions = [
    mk("Origami (wave)", 250, 180, 180), // on time — single cup, out of bucket
    mk("Origami (wave)", 250, 180, 175),
    mk("Origami (wave)", 450, 210, 255), // +45
    mk("Origami (wave)", 450, 210, 250), // +40
  ];
  const cal = measuredTimeDelta(sessions, "Origami (wave)", 450, isPercolation);
  assert.equal(cal.count, 2);
  assert.ok(cal.deltaSec >= 40, `single-cup on-time brews diluted the batch signal: ${cal.deltaSec}`);
});

test("other methods do not match", () => {
  const sessions = [mk("V60", 450, 210, 260), mk("V60", 450, 210, 255)];
  assert.equal(measuredTimeDelta(sessions, "Origami (wave)", 450, isPercolation), null);
});

test("fewer than 2 samples → null (never extrapolate from one brew)", () => {
  const sessions = [mk("Origami (wave)", 450, 210, 260)];
  assert.equal(measuredTimeDelta(sessions, "Origami (wave)", 450, isPercolation), null);
});

test("non-percolation and missing volume → null", () => {
  const sessions = [mk("Clever Dripper", 450, 330, 400), mk("Clever Dripper", 450, 330, 410)];
  assert.equal(measuredTimeDelta(sessions, "Clever Dripper", 450, isPercolation), null);
  assert.equal(measuredTimeDelta(sessions, "Origami (wave)", undefined, isPercolation), null);
});

test("the selected candidate's recipe wins over primaryRecipe (resolveBrewedRecipe)", () => {
  // The user brewed candidate 1 (450g), not the primary (250g) — the bucket
  // match must read the recipe actually brewed.
  const s = {
    brew: { methodUsed: "Origami (wave)", actualTimeSec: 250, selectedCandidateIdx: 1 },
    recommendation: {
      primaryMethod: "V60",
      primaryRecipe: { waterGrams: 250, targetTimeSec: 180 },
      candidates: [
        { method: "V60", recipe: { waterGrams: 250, targetTimeSec: 180 } },
        { method: "Origami (wave)", recipe: { waterGrams: 450, targetTimeSec: 210 } },
      ],
    },
  };
  const cal = measuredTimeDelta([s, s], "Origami (wave)", 450, isPercolation);
  assert.ok(cal, "expected the selected candidate's 450g recipe to match");
  assert.equal(cal.deltaSec, 40);
});
