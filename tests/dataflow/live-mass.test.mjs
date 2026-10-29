// Live "not water" filter (liveMass.ts): the Clever lid set on after the water
// reached its target must not read as "Overshot" (owner, 2026-10-29).
//
//   node --test tests/dataflow/live-mass.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const dir = await mkdtemp(join(tmpdir(), "livemass-"));
const out = join(dir, "lm.mjs");
await build({
  stdin: {
    contents: `export * from ${JSON.stringify(path.join(ROOT, "src/lib/brew/liveMass.ts"))};`,
    resolveDir: ROOT,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { foldLiveMass, LIVE_MASS_START } = await import(pathToFileURL(out).href);

// Feed raw readings at 10 Hz; returns the offset after each.
function run(readings, pourDoneAt = () => true) {
  let s = LIVE_MASS_START;
  return readings.map((g, i) => {
    s = foldLiveMass(s, g, i * 100, pourDoneAt(i));
    return s.offset;
  });
}

test("a lid set on after the water reached its target is not water", () => {
  // 300 g in, then the lid lands over ~0.2 s (+20, +18) and stays.
  const offs = run([300, 300, 300, 320, 338, 338, 338]);
  assert.equal(offs.at(-1), 38);
});

test("taking the lid off again undoes the fold, never more", () => {
  const offs = run([300, 300, 338, 338, 300, 300, 0]);
  assert.equal(offs[3], 38);
  assert.equal(offs[4], 0);
  assert.equal(offs.at(-1), 0, "a later lift of the brewer is not unfolded below zero");
});

test("water poured at a kettle's rate is never folded", () => {
  // 8 g/s → 0.8 g per 10 Hz sample, up to 300 g.
  const readings = Array.from({ length: 376 }, (_, i) => Math.min(300, i * 0.8));
  assert.equal(run(readings).at(-1), 0);
});

test("a sudden rise while a pour is still UNDER its target is left alone", () => {
  const offs = run([100, 100, 140, 140], () => false);
  assert.equal(offs.at(-1), 0);
});
