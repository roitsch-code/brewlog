// "What works for you" — the user's brew dials scored against their ratings.
//
//   node --test tests/dataflow/brew-parameter-stats.test.mjs
//
// The risk on this screen is a confident-looking number built on nothing, so
// the tests are mostly about what it REFUSES to show: thin buckets, a single
// bucket with nothing to compare against, and — the one that would be actively
// wrong — Niche degrees averaged together with Comandante clicks.

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const dir = await mkdtemp(join(tmpdir(), "bps-"));
const out = join(dir, "s.mjs");
await build({
  stdin: {
    contents: `export { buildBrewParameterStats, MIN_SAMPLES } from ${JSON.stringify(path.join(ROOT, "src/lib/taste/brewParameterStats.ts"))};`,
    resolveDir: ROOT,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  outfile: out,
  platform: "neutral",
  logLevel: "silent",
});
const { buildBrewParameterStats, MIN_SAMPLES } = await import(pathToFileURL(out).href);

let seq = 0;
function session({ rating, temp, dose, water, grind }) {
  seq += 1;
  return {
    id: `s${seq}`,
    createdAt: new Date(1735689600000 + seq * 86400000).toISOString(),
    result: { rating, flavorNotes: [] },
    recommendation: {
      primaryRecipe: {
        doseGrams: dose,
        waterGrams: water,
        waterTempC: temp,
        grindSize: grind,
        targetTimeSec: 210,
      },
      primaryMethod: "V60",
    },
  };
}
const many = (n, cfg) => Array.from({ length: n }, () => session(cfg));
const group = (groups, title) => groups.find((g) => g.title === title);

test("a temperature band only appears once it clears the sample floor", () => {
  const thin = buildBrewParameterStats([
    ...many(MIN_SAMPLES - 1, { rating: 5, temp: 95, dose: 15, water: 250, grind: "390°" }),
    ...many(MIN_SAMPLES, { rating: 3, temp: 92, dose: 15, water: 250, grind: "390°" }),
  ]);
  // The 5-star band is one brew short, so it is withheld — and with only one
  // qualifying band left there is nothing to compare, so the group goes too.
  assert.equal(group(thin, "Temperature"), undefined);

  const enough = buildBrewParameterStats([
    ...many(MIN_SAMPLES, { rating: 5, temp: 95, dose: 15, water: 250, grind: "390°" }),
    ...many(MIN_SAMPLES, { rating: 3, temp: 92, dose: 15, water: 250, grind: "390°" }),
  ]);
  const temp = group(enough, "Temperature");
  assert.ok(temp, "expected a Temperature group once both bands qualify");
  assert.equal(temp.buckets.length, 2);
  const hot = temp.buckets.find((b) => b.label === "94–96°");
  assert.equal(hot.avgRating, 5);
  assert.equal(hot.count, MIN_SAMPLES);
});

test("bands stay in natural order, not ranked by score", () => {
  const groups = buildBrewParameterStats([
    ...many(MIN_SAMPLES, { rating: 2, temp: 88, dose: 15, water: 250, grind: "390°" }),
    ...many(MIN_SAMPLES, { rating: 5, temp: 92, dose: 15, water: 250, grind: "390°" }),
    ...many(MIN_SAMPLES, { rating: 3, temp: 95, dose: 15, water: 250, grind: "390°" }),
  ]);
  const labels = group(groups, "Temperature").buckets.map((b) => b.label);
  assert.deepEqual(labels, ["90° and below", "91–93°", "94–96°"]);
});

test("Niche degrees and Comandante clicks never average together", () => {
  const groups = buildBrewParameterStats([
    ...many(MIN_SAMPLES, { rating: 5, temp: 93, dose: 15, water: 250, grind: "390°" }),
    ...many(MIN_SAMPLES, { rating: 5, temp: 93, dose: 15, water: 250, grind: "410°" }),
    ...many(MIN_SAMPLES, { rating: 2, temp: 93, dose: 15, water: 250, grind: "24 clicks" }),
    ...many(MIN_SAMPLES, { rating: 2, temp: 93, dose: 15, water: 250, grind: "30 clicks" }),
  ]);
  const niche = group(groups, "Grind (Niche)");
  const clicks = group(groups, "Grind (Comandante)");
  assert.ok(niche && clicks, "both grinders should report separately");
  // 24 clicks must not be filed as a Niche setting, nor 390° as clicks.
  assert.ok(niche.buckets.every((b) => /°/.test(b.label)));
  assert.ok(clicks.buckets.every((b) => /click/.test(b.label)));
  assert.equal(
    niche.buckets.reduce((n, b) => n + b.count, 0),
    MIN_SAMPLES * 2,
  );
});

test("ratio comes from the brewed recipe, and out-of-range junk is ignored", () => {
  const groups = buildBrewParameterStats([
    ...many(MIN_SAMPLES, { rating: 5, temp: 93, dose: 15, water: 240, grind: "390°" }), // 1:16
    ...many(MIN_SAMPLES, { rating: 3, temp: 93, dose: 20, water: 260, grind: "390°" }), // 1:13
    // A nonsense ratio (1:100) must not create a band of its own.
    ...many(MIN_SAMPLES, { rating: 1, temp: 93, dose: 2, water: 200, grind: "390°" }),
  ]);
  const ratio = group(groups, "Ratio");
  assert.deepEqual(
    ratio.buckets.map((b) => b.label),
    ["1:14 and tighter", "1:15–1:16"],
  );
});

test("no brews, no claims", () => {
  assert.deepEqual(buildBrewParameterStats([]), []);
  assert.deepEqual(buildBrewParameterStats([session({ rating: 0, temp: 93 })]), []);
});
