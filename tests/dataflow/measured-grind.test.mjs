// The user's OWN logged grind settings reach /recommend.
//
//   node --test tests/dataflow/measured-grind.test.mjs
//
// Why this exists: every per-method row in grindSettings.ts except the V60 is
// marked confidence:"estimate", while brew.grindSettingUsed has recorded what
// the owner actually ground at on every brew since the flow shipped. Timing
// already learns from history (measuredTimeDelta); grind did not.
//
// This asserts BOTH the function AND the route-level interpolation. This repo
// has twice shipped a function documented as feeding a prompt while nothing
// called it (#530, #535), both "pinned" by producer-only tests.

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const entry = `
export {
  buildMeasuredGrind,
  formatMeasuredGrindForPrompt,
  grindStringToDegrees,
} from ${JSON.stringify(path.join(ROOT, "src/lib/claude/measuredGrind.ts"))};
`;
const dir = await mkdtemp(join(tmpdir(), "mgrind-"));
const out = join(dir, "g.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "silent",
});
const { buildMeasuredGrind, formatMeasuredGrindForPrompt, grindStringToDegrees } =
  await import(pathToFileURL(out).href);

/** A logged brew: method, water actually used, grind ground at, rating. */
function s(method, water, grind, rating) {
  return {
    brew: { methodUsed: method, waterGrams: water, grindSettingUsed: grind },
    result: rating == null ? undefined : { rating, flavorNotes: [], body: "", acidity: "" },
  };
}

test("degrees and clicks both parse; the scales can't be confused by magnitude", () => {
  assert.equal(grindStringToDegrees("388°"), 388);
  assert.equal(grindStringToDegrees("24 clicks"), 383); // 380 + (24-23)/0.3
  assert.equal(grindStringToDegrees("26 clicks (Comandante C40)"), 390);
  assert.equal(grindStringToDegrees("medium-coarse"), null);
  assert.equal(grindStringToDegrees(undefined), null);
});

test("reports the median and range of what the user actually ground at", () => {
  const past = [
    s("V60", 350, "384°", 4.5),
    s("V60", 350, "388°", 4),
    s("V60", 360, "386°", 3),
  ];
  const [g] = buildMeasuredGrind(past, 350);
  assert.equal(g.count, 3);
  assert.equal(g.medianDeg, 386);
  assert.equal(g.minDeg, 384);
  assert.equal(g.maxDeg, 388);
});

test("the 4-star-plus subset is reported separately — that's the preference signal", () => {
  const past = [
    s("V60", 350, "384°", 4.5), s("V60", 350, "386°", 4), s("V60", 350, "385°", 5),
    s("V60", 350, "400°", 2), s("V60", 350, "402°", 2.5),
  ];
  const [g] = buildMeasuredGrind(past, 350);
  assert.equal(g.count, 5);
  assert.equal(g.good.count, 3);
  assert.equal(g.good.medianDeg, 385);
  assert.equal(g.good.maxDeg, 386, "the badly-rated coarse brews must not widen the proven window");
});

test("under three brews it says nothing — one bean's opinion is not a habit", () => {
  const past = [s("V60", 350, "384°", 5), s("V60", 350, "386°", 5)];
  assert.deepEqual(buildMeasuredGrind(past, 350), []);
});

test("volume-bucketed: a single cup must not set the grind for a big batch", () => {
  const past = [
    s("V60", 250, "380°", 5), s("V60", 250, "381°", 5), s("V60", 250, "382°", 5),
    s("V60", 600, "402°", 4), s("V60", 600, "404°", 4), s("V60", 600, "406°", 4),
  ];
  const [small] = buildMeasuredGrind(past, 250);
  const [big] = buildMeasuredGrind(past, 600);
  assert.equal(small.medianDeg, 381);
  assert.equal(big.medianDeg, 404);
});

test("pooled by brewer FAMILY, and the Drip Assist stays its own bucket", () => {
  const past = [
    s("Orea Classic", 350, "386°", 4), s("Orea V4 Classic", 350, "388°", 4),
    s("Orea V4 Classic", 350, "390°", 4),
    s("V60 + Drip Assist", 350, "393°", 4), s("V60 + Drip Assist", 350, "395°", 4),
    s("V60 + Drip Assist", 350, "397°", 4),
  ];
  const table = buildMeasuredGrind(past, 350);
  assert.equal(table.length, 2, "two distinct buckets");
  const orea = table.find((t) => /orea/i.test(t.label));
  const disc = table.find((t) => /drip assist/i.test(t.label));
  assert.equal(orea.count, 3, "Orea Classic and Orea V4 Classic are one brewer");
  assert.equal(disc.count, 3, "the disc changes flow — never pooled with the bare brewer");
  assert.equal(disc.medianDeg, 395);
});

test("a locked method narrows the table to that brewer", () => {
  const past = [
    s("V60", 350, "384°", 4), s("V60", 350, "386°", 4), s("V60", 350, "388°", 4),
    s("Clever", 350, "410°", 4), s("Clever", 350, "412°", 4), s("Clever", 350, "414°", 4),
  ];
  assert.equal(buildMeasuredGrind(past, 350).length, 2);
  const locked = buildMeasuredGrind(past, 350, "Clever");
  assert.equal(locked.length, 1);
  assert.match(locked[0].label, /clever/i);
});

test("the block renders in the grinder's own unit and never as a target", () => {
  const past = [s("V60", 350, "384°", 4), s("V60", 350, "386°", 5), s("V60", 350, "388°", 4)];
  const table = buildMeasuredGrind(past, 350);

  const niche = formatMeasuredGrindForPrompt(table, "Niche Zero");
  assert.match(niche, /MEASURED GRIND/);
  assert.match(niche, /386°/);
  assert.match(niche, /centre of gravity, not a target/i,
    "grind is bean-dependent — the block must not read as an instruction");

  const coma = formatMeasuredGrindForPrompt(table, "Comandante C40 MK2");
  assert.match(coma, /clicks/, "a Comandante has no degrees");
  assert.doesNotMatch(coma, /°/, "and must not be handed any");
});

test("nothing measured → empty string, so the general table still applies", () => {
  assert.equal(formatMeasuredGrindForPrompt([], "Niche Zero"), "");
  assert.deepEqual(buildMeasuredGrind([], 350), []);
});

test("recommend.ts imports the builder AND interpolates the block", () => {
  // The producer-only failure class: a block built and never pushed.
  const src = readFileSync("src/lib/claude/recommend.ts", "utf8");
  assert.match(
    src,
    /import\s*\{[^}]*buildMeasuredGrind[^}]*\}\s*from\s*"\.\/measuredGrind"/,
    "recommend must import the builder",
  );
  assert.match(src, /const measuredGrindBlock = formatMeasuredGrindForPrompt\(/,
    "and build the block");
  assert.match(src, /\$\{measuredGrindBlock\}/,
    "and INTERPOLATE it into the user message — building it is not using it");
  // Fed from the session's real water target and the locked method.
  const idx = src.indexOf("const measuredGrindBlock");
  assert.match(src.slice(idx, idx + 320), /targetWaterMl/, "bucketed on this brew's water");
  assert.match(src.slice(idx, idx + 320), /context\.preferredMethod/, "narrowed by a locked method");
});
