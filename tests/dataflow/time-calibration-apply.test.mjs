// Consumer-side test for calibrateTargetTimes — the function that APPLIES the
// measured timing delta to /recommend candidates. time-calibration.test.mjs
// covers the underlying measuredTimeDelta (the producer); until this file,
// nothing pinned the applying function's gates: raise-only, the +20s floor,
// round-to-5, the +120s cap, and the iced/cold-brew/immersion skips. A
// producer-only test is exactly how #530 and #535 shipped broken wiring.
//
//   node --test tests/dataflow/time-calibration-apply.test.mjs

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
export { calibrateTargetTimes } from ${JSON.stringify(
  path.join(ROOT, "src/lib/claude/recommend.ts"),
)};
`;
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
const { calibrateTargetTimes } = await import(pathToFileURL(out).href);

const isPercolation = (m) => /v60|origami|kalita|chemex/i.test(m ?? "");

/** A past session brewing `method` at `waterGrams`, measured `actualTimeSec`
 *  against a followed recipe with `targetTimeSec`. Shape mirrors what
 *  measuredTimeDelta reads via resolveBrewedRecipe (primaryRecipe fallback). */
function session(method, waterGrams, targetTimeSec, actualTimeSec) {
  return {
    brew: { methodUsed: method, actualTimeSec },
    recommendation: {
      primaryRecipe: { method, waterGrams, targetTimeSec },
      candidates: [{ method, recipe: { method, waterGrams, targetTimeSec } }],
    },
  };
}

function candidate(method, targetTimeSec, extra = {}) {
  return {
    method,
    title: `${method} test`,
    recipe: { method, waterGrams: 300, targetTimeSec, ...extra },
  };
}

// Median measured overrun of +47s on V60 at ~300g (3 samples → median 45).
const PAST = [
  session("V60", 300, 180, 225), // +45
  session("V60", 310, 180, 227), // +47
  session("V60", 295, 180, 220), // +40
];

test("a measured median overrun raises targetTimeSec, rounded to 5s and capped", () => {
  const [c] = calibrateTargetTimes([candidate("V60", 200)], PAST, isPercolation);
  // median +45 → round(45/5)*5 = 45.
  assert.equal(c.recipe.targetTimeSec, 245);
});

test("the +120s cap holds for a huge measured delta", () => {
  const past = [session("V60", 300, 120, 400), session("V60", 300, 120, 410)];
  const [c] = calibrateTargetTimes([candidate("V60", 200)], past, isPercolation);
  assert.equal(c.recipe.targetTimeSec, 320);
});

test("raise-only: a measured UNDER-run never shortens the clock", () => {
  const past = [session("V60", 300, 240, 200), session("V60", 300, 240, 195)];
  const [c] = calibrateTargetTimes([candidate("V60", 240)], past, isPercolation);
  assert.equal(c.recipe.targetTimeSec, 240);
});

test("deltas under the 20s floor are noise, not calibration", () => {
  const past = [session("V60", 300, 180, 195), session("V60", 300, 180, 192)];
  const [c] = calibrateTargetTimes([candidate("V60", 180)], past, isPercolation);
  assert.equal(c.recipe.targetTimeSec, 180);
});

test("iced, cold-brew and immersion candidates are skipped", () => {
  const iced = candidate("V60", 200, { iceGrams: 150 });
  const cold = candidate("V60", 43200);
  const immersion = candidate("Clever", 240);
  const [a, b, c] = calibrateTargetTimes([iced, cold, immersion], PAST, isPercolation);
  assert.equal(a.recipe.targetTimeSec, 200);
  assert.equal(b.recipe.targetTimeSec, 43200);
  assert.equal(c.recipe.targetTimeSec, 240);
});

test("fewer than 2 similar-volume samples → untouched", () => {
  const past = [session("V60", 300, 180, 260), session("V60", 800, 180, 260)];
  const [c] = calibrateTargetTimes([candidate("V60", 200)], past, isPercolation);
  assert.equal(c.recipe.targetTimeSec, 200);
});
