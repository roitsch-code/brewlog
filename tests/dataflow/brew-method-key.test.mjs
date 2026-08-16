// The canonical brewer key that lets the user's OWN measured brews pool.
//
//   node --test tests/dataflow/brew-method-key.test.mjs
//
// Bundles the real module (recipe-fidelity pattern) so what's asserted is what
// ships. The contract that matters: one physical brewer is ONE bucket however
// the label was written, the Drip Assist stays a separate flow regime, and two
// unknown brewers never collapse into a shared "other".

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const dir = await mkdtemp(join(tmpdir(), "bmk-"));
const out = join(dir, "k.mjs");
await build({
  stdin: {
    contents: `export { brewMethodKey } from ${JSON.stringify(path.join(ROOT, "src/lib/utils/brewMethodKey.ts"))};`,
    resolveDir: ROOT,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  outfile: out,
  platform: "neutral",
  logLevel: "silent",
});
const { brewMethodKey } = await import(pathToFileURL(out).href);

test("the same brewer pools however the label was written", () => {
  // This is the whole point: the flow writes "Orea Classic", the chat writes
  // "Orea V4 Classic". An exact string compare split those, so each bucket sat
  // under the calibration's 2-sample floor and it never fired.
  const orea = ["Orea Classic", "Orea V4 Classic", "orea v4 classic", "Orea V4 Wide", "Orea Apex"];
  const keys = new Set(orea.map(brewMethodKey));
  assert.equal(keys.size, 1, `expected one Orea bucket, got ${[...keys]}`);

  assert.equal(brewMethodKey("V60"), brewMethodKey("Hario V60 size 02"));
  assert.equal(brewMethodKey("AeroPress"), brewMethodKey("Inverted AeroPress"));
});

test("the Drip Assist is a separate flow regime, not a separate brewer", () => {
  // The disc adds resistance, so disc and no-disc must not average together...
  assert.notEqual(brewMethodKey("Orea V4 Classic"), brewMethodKey("Orea V4 Classic + Drip Assist"));
  assert.notEqual(brewMethodKey("V60"), brewMethodKey("V60 + Drip Assist"));

  // ...but the disc must not swallow the brewer either. The old local
  // normaliser returned "v60-drip-assist" for ANY method mentioning the disc,
  // filing an Orea-with-disc brew under the V60.
  assert.notEqual(
    brewMethodKey("Orea V4 Classic + Drip Assist"),
    brewMethodKey("V60 + Drip Assist"),
  );
  assert.match(brewMethodKey("Orea V4 Classic + Drip Assist"), /^orea/);

  // Spelling of the accessory doesn't fork the bucket.
  assert.equal(brewMethodKey("V60 + Drip Assist"), brewMethodKey("v60 + drip-assist"));
});

test("a V60 paper in an Origami is still an Origami", () => {
  assert.match(brewMethodKey("Origami (cone, V60 filter)"), /^origami/);
  assert.equal(brewMethodKey("Origami Air M"), brewMethodKey("origami air m"));
});

test("unknown brewers stay distinct instead of averaging together", () => {
  const a = brewMethodKey("Solo Dripper");
  const b = brewMethodKey("Cafec Flower");
  assert.notEqual(a, b);
  assert.notEqual(a, "unknown");
  // Punctuation/spacing alone must not fork one unknown brewer.
  assert.equal(brewMethodKey("Solo Dripper"), brewMethodKey("solo  dripper"));
});

test("missing method is its own bucket, never a crash", () => {
  assert.equal(brewMethodKey(undefined), "unknown");
  assert.equal(brewMethodKey(""), "unknown");
  assert.equal(brewMethodKey("   "), "unknown");
});
