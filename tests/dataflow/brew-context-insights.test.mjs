// Conditional "what works for you" — sentences per coffee type.
//
//   node --test tests/dataflow/brew-context-insights.test.mjs
//
// This replaced a marginal-average table whose rows invited exactly the wrong
// read: take the best band from each dial and compose them (89 degrees + 1:13
// + 384 on the Niche — cold, tight and fine at once). So most of these tests
// are about REFUSING to speak: no segment, no contrast, no sentence.

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const dir = await mkdtemp(join(tmpdir(), "bci-"));
const out = join(dir, "c.mjs");
await build({
  stdin: {
    contents: `export { buildContextInsights, formatContextFindingsForGreeting, MIN_SEGMENT_BREWS, MIN_GROUP_BREWS, HIT_RATING, MISS_RATING } from ${JSON.stringify(path.join(ROOT, "src/lib/taste/brewContextInsights.ts"))};`,
    resolveDir: ROOT,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  outfile: out,
  platform: "neutral",
  logLevel: "silent",
});
const { buildContextInsights, formatContextFindingsForGreeting, MIN_SEGMENT_BREWS, MIN_GROUP_BREWS, HIT_RATING, MISS_RATING } =
  await import(pathToFileURL(out).href);

let seq = 0;
function brew({ rating, origin = "Ethiopia", process = "Natural", temp = 93, dose = 15, water = 250, grind = "395°" }) {
  seq += 1;
  return {
    id: `s${seq}`,
    createdAt: new Date(1735689600000 + seq * 3600000).toISOString(),
    coffee: { origin, process, roaster: "R", name: `C${seq}` },
    brew: { methodUsed: "V60" },
    result: { rating, flavorNotes: [] },
    recommendation: {
      primaryMethod: "V60",
      primaryRecipe: { doseGrams: dose, waterGrams: water, waterTempC: temp, grindSize: grind, targetTimeSec: 210 },
    },
  };
}
const many = (n, cfg) => Array.from({ length: n }, () => brew(cfg));

test("a dial that genuinely separates best from worst gets a sentence", () => {
  const { insights } = buildContextInsights([
    ...many(MIN_GROUP_BREWS, { rating: 5, temp: 92 }),
    ...many(MIN_GROUP_BREWS, { rating: 3, temp: 97 }),
  ]);
  assert.equal(insights.length, 1);
  const i = insights[0];
  assert.equal(i.segment, "African naturals");
  // The sentence names the coffee TYPE and the direction, never a bare number
  // to be combined with another row's number.
  assert.match(i.sentence, /African naturals/);
  assert.match(i.sentence, /cooler water \(92° vs 97°\)/);
  assert.equal(i.hits, MIN_GROUP_BREWS);
  assert.equal(i.misses, MIN_GROUP_BREWS);
});

test("consistent brewing produces NO finding, and says so", () => {
  // Same dials on both sides: the ratings differ, the brewing doesn't. The old
  // table would still have printed four confident-looking averages here.
  const { insights, inconclusiveSegments } = buildContextInsights([
    ...many(MIN_GROUP_BREWS, { rating: 5, temp: 93 }),
    ...many(MIN_GROUP_BREWS, { rating: 3, temp: 93 }),
  ]);
  assert.deepEqual(insights, []);
  assert.deepEqual(inconclusiveSegments, ["African naturals"]);
});

test("a difference smaller than everyday scatter is not a finding", () => {
  // 1 degree apart — below the threshold, so it stays quiet.
  const { insights } = buildContextInsights([
    ...many(MIN_GROUP_BREWS, { rating: 5, temp: 93 }),
    ...many(MIN_GROUP_BREWS, { rating: 3, temp: 94 }),
  ]);
  assert.deepEqual(insights, []);
});

test("dials are never mixed across coffee types", () => {
  // Naturals liked cool, washed liked hot. Pooled, these cancel out — which is
  // exactly how the marginal table lost the bean.
  const { insights } = buildContextInsights([
    ...many(MIN_GROUP_BREWS, { rating: 5, process: "Natural", temp: 92 }),
    ...many(MIN_GROUP_BREWS, { rating: 3, process: "Natural", temp: 97 }),
    ...many(MIN_GROUP_BREWS, { rating: 5, process: "Washed", origin: "Colombia", temp: 97 }),
    ...many(MIN_GROUP_BREWS, { rating: 3, process: "Washed", origin: "Colombia", temp: 92 }),
  ]);
  assert.equal(insights.length, 2);
  const nat = insights.find((i) => i.segment === "African naturals");
  const wash = insights.find((i) => i.segment === "Latin American washed");
  assert.match(nat.sentence, /cooler water/);
  assert.match(wash.sentence, /hotter water/);
});

test("too few brews on one side means no claim", () => {
  const { insights } = buildContextInsights([
    ...many(MIN_GROUP_BREWS - 1, { rating: 5, temp: 92 }),
    ...many(MIN_SEGMENT_BREWS, { rating: 3, temp: 97 }),
  ]);
  assert.deepEqual(insights, []);
});

test("the mushy middle is excluded, not split down the middle", () => {
  // A pile of 4-star brews is not two groups. Only clear hits/misses count.
  const middle = many(MIN_SEGMENT_BREWS * 2, { rating: 4, temp: 92 });
  const { insights, inconclusiveSegments } = buildContextInsights(middle);
  assert.deepEqual(insights, []);
  assert.deepEqual(inconclusiveSegments, ["African naturals"]);
  assert.ok(HIT_RATING > 4 && MISS_RATING < 4);
});

test("a segment too small to reason about is silent, not inconclusive", () => {
  const { insights, inconclusiveSegments } = buildContextInsights([
    ...many(2, { rating: 5, temp: 92 }),
    ...many(2, { rating: 3, temp: 97 }),
  ]);
  assert.deepEqual(insights, []);
  assert.deepEqual(inconclusiveSegments, []);
});

test("at most two dials per sentence", () => {
  const { insights } = buildContextInsights([
    ...many(MIN_GROUP_BREWS, { rating: 5, temp: 92, water: 210, grind: "410°" }),
    ...many(MIN_GROUP_BREWS, { rating: 3, temp: 97, water: 270, grind: "380°" }),
  ]);
  assert.equal(insights.length, 1);
  // Three dials separate here; only the two strongest are spoken, so the line
  // stays a finding instead of turning back into a list of knobs.
  assert.equal((insights[0].sentence.match(/ vs /g) || []).length, 2);
});

test("no coffee type, no claim", () => {
  const unknown = many(MIN_SEGMENT_BREWS * 2, { rating: 5, origin: "Unknown", process: "" });
  assert.deepEqual(buildContextInsights(unknown).insights, []);
  assert.deepEqual(buildContextInsights([]).insights, []);
});

test("the greeting block carries exact figures, only for bags in rotation", () => {
  const sessions = [
    ...many(MIN_GROUP_BREWS, { rating: 5, temp: 92 }),
    ...many(MIN_GROUP_BREWS, { rating: 3, temp: 97 }),
    ...many(MIN_GROUP_BREWS, { rating: 5, process: "Washed", origin: "Colombia", temp: 97 }),
    ...many(MIN_GROUP_BREWS, { rating: 3, process: "Washed", origin: "Colombia", temp: 92 }),
  ];
  const { insights } = buildContextInsights(sessions);
  assert.equal(insights.length, 2);

  // Only the Ethiopian natural is open on the counter, so only that finding
  // may reach the greeting — a line about Colombian washed would point at a
  // coffee the user can't brew this morning.
  const block = formatContextFindingsForGreeting(insights, [
    { roaster: "Friedhats", name: "Quiquira", origin: "Ethiopia", process: "Natural" },
  ]);
  assert.match(block, /African naturals/);
  assert.doesNotMatch(block, /Latin American/);
  // The figures must be present verbatim — "a bit cooler" is worthless here.
  assert.match(block, /92°C vs 97°C/);
  assert.match(block, /Friedhats Quiquira/);

  // Nothing in rotation matches → no block at all, so the greeting can't
  // reach for a finding that has no bag behind it.
  assert.equal(
    formatContextFindingsForGreeting(insights, [
      { roaster: "X", name: "Y", origin: "Indonesia", process: "Washed" },
    ]),
    "",
  );
  assert.equal(formatContextFindingsForGreeting(insights, []), "");
});

test("a ratio finding reads as a ratio, not a bare number", () => {
  const { insights } = buildContextInsights([
    ...many(MIN_GROUP_BREWS, { rating: 5, water: 210 }),
    ...many(MIN_GROUP_BREWS, { rating: 3, water: 270 }),
  ]);
  const block = formatContextFindingsForGreeting(insights, [
    { roaster: "R", name: "N", origin: "Ethiopia", process: "Natural" },
  ]);
  assert.match(block, /1:14 vs 1:18/);
});
