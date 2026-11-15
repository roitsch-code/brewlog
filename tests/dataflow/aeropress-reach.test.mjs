// The AeroPress past its chamber (owner, 2026-11-15): "you cannot scale an
// aeropress recipe to whatever you want … if there is no dedicated recipe you
// cannot hallucinate a recipe up to 350 or 450 ml. In small dimensions you can
// scale, but not like this." The menu offers only concentrate + bypass recipes
// whose published cup is within ±20 % of the amount (brewer-menu.test.mjs);
// this file pins the /recommend backstop that drops any other AeroPress
// candidate the model writes anyway, and its wiring.
//
//   node --test tests/dataflow/aeropress-reach.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const dir = await mkdtemp(join(tmpdir(), "apreach-"));
const out = join(dir, "o.mjs");
await build({
  stdin: {
    contents: `export { guardAeropressReach } from ${JSON.stringify(path.join(ROOT, "src/lib/claude/aeropressReach.ts"))};`,
    resolveDir: ROOT,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  outfile: out,
  platform: "node",
  packages: "external",
  logLevel: "silent",
  alias: { "@": path.join(ROOT, "src") },
});
const { guardAeropressReach } = await import(pathToFileURL(out).href);

const cand = (method, basedOn, title = method) => ({ method, basedOn, title, recipe: { waterGrams: 150 } });
const ids = { "Roasters AeroPress (Gota)": "gota-aeropress-aeropress-bypass", "Adler Original": "adler-original-aeropress", "Kasuya 4:6": "kasuya-4-6" };
const resolve = (b) => ids[b];

test("past the chamber an AeroPress candidate must adapt a recipe the menu offered for this amount", () => {
  const allowed = new Set(["gota-aeropress-aeropress-bypass"]);
  const kept = guardAeropressReach(
    [cand("AeroPress", "Adler Original", "sized-up Adler"), cand("V60", "Kasuya 4:6"), cand("AeroPress", "Own experiment", "invented")],
    allowed,
    resolve,
  );
  assert.deepEqual(kept.map((c) => c.title), ["V60"], "a sized-up concentrate and an invented AeroPress recipe are dropped; other brewers untouched");
  const ok = guardAeropressReach([cand("AeroPress", "Roasters AeroPress (Gota)"), cand("V60", "Kasuya 4:6")], allowed, resolve);
  assert.equal(ok.length, 2, "a documented concentrate for this cup stays");
});

test("the recipe the owner named himself stays; inside the chamber nothing is checked", () => {
  const kept = guardAeropressReach([cand("AeroPress", "Adler Original"), cand("V60", "Kasuya 4:6")], new Set(), resolve, "adler-original-aeropress");
  assert.equal(kept.length, 2);
  const inside = guardAeropressReach([cand("AeroPress", "Own experiment")], null, resolve);
  assert.equal(inside.length, 1, "allowedIds null = the amount fits the chamber");
});

test("never empty: every candidate failing is kept and logged, not a failed recommendation", () => {
  const both = [cand("AeroPress", "Own experiment", "a"), cand("AeroPress", "Adler Original", "b")];
  assert.equal(guardAeropressReach(both, new Set(), resolve).length, 2);
});

test("WIRING — recommend.ts runs the guard on the menu's AeroPress entry, before the batch relabel renames basedOn", async () => {
  const src = await readFile(path.join(ROOT, "src/lib/claude/recommend.ts"), "utf8");
  assert.match(src, /const apEntry = menu\.entries\.find\(\(e\) => e\.role === "aeropress"\)/);
  assert.match(src, /apEntry\.reach\.how !== "fits"/);
  assert.match(src, /const reachGuarded = guardAeropressReach\(deSwirled, apAllowed,/);
  assert.match(src, /const batchChecked = reachGuarded\.map\(/);
});
