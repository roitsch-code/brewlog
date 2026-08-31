// Vessel-capacity guard tests — bundles the REAL src/lib/utils/vesselCapacity.ts
// with esbuild so the test tracks the actual rule. This is the deterministic
// backstop /recommend applies after generation: the Mistral spike (issue #453)
// showed large-volume requests can pick an over-capacity vessel despite the
// prompt forbidding it.
//
// Caps are owner-measured (2026-08-31), min AND max per vessel:
//   AeroPress ≤230 · Clever ≤450 · Origami ≤500 · Kalita ≤450 · Orea ≤450
//   V60 ≤550 · Chemex 350–750 · Moccamaster 500–1000 · Cold-brew jar ≤1000
//
//   node --test tests/dataflow/vessel-capacity.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const entry = `export { vesselOverflow, vesselCannotServe } from ${JSON.stringify(
  path.join(ROOT, "src/lib/utils/vesselCapacity.ts"),
)};`;
const dir = await mkdtemp(join(tmpdir(), "vessel-"));
const out = join(dir, "b.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { vesselOverflow, vesselCannotServe } = await import(pathToFileURL(out).href);

test("recipes within a vessel's window pass", () => {
  assert.equal(vesselOverflow("AeroPress", 200), null);
  assert.equal(vesselOverflow("Clever Dripper", 450), null); // exactly at max
  assert.equal(vesselOverflow("Origami Air M", 500), null); // Origami now 500
  assert.equal(vesselOverflow("Kalita Wave", 450), null);
  assert.equal(vesselOverflow("Orea Classic", 450), null);
  assert.equal(vesselOverflow("V60", 550), null); // V60 now capped at 550
  assert.equal(vesselOverflow("Moccamaster", 750), null);
  assert.equal(vesselOverflow("Chemex", 500), null);
});

test("over-max recipes are flagged", () => {
  assert.match(vesselOverflow("AeroPress", 260) ?? "", /AeroPress/);
  assert.match(vesselOverflow("Clever Dripper", 520) ?? "", /Clever/);
  assert.match(vesselOverflow("Origami (cone)", 520) ?? "", /Origami/); // 520 > 500
  assert.match(vesselOverflow("Kalita Wave", 500) ?? "", /Kalita/); // 500 > 450
  assert.match(vesselOverflow("Orea Open", 500) ?? "", /Orea/); // 500 > 450
  assert.match(vesselOverflow("V60", 600) ?? "", /V60/); // 600 > 550
  assert.match(vesselOverflow("Chemex", 800) ?? "", /Chemex/); // 800 > 750
});

test("below-min (batch brewer) recipes are flagged", () => {
  assert.match(vesselOverflow("Moccamaster", 350) ?? "", /Moccamaster/); // < 500 min
  assert.match(vesselOverflow("Chemex", 300) ?? "", /Chemex/); // < 350 min
});

test("iced recipes are NOT falsely flagged (waterGrams is the hot portion only)", () => {
  // Summer-time 520ml drink → Clever holds only the ~310g hot brew → fine.
  assert.equal(vesselOverflow("Clever Dripper", 310), null);
});

test("missing / non-finite inputs are safe (return null)", () => {
  assert.equal(vesselOverflow(undefined, 520), null);
  assert.equal(vesselOverflow("Clever", undefined), null);
  assert.equal(vesselOverflow("Clever", NaN), null);
  assert.equal(vesselOverflow("Clever", Infinity), null);
});

test("method match is case-insensitive and substring", () => {
  assert.match(vesselOverflow("clever dripper", 500) ?? "", /Clever/);
  assert.equal(vesselOverflow("V60 (no Assist)", 350), null);
});

// vesselCannotServe — the SERVE guard (both directions). Catches a vessel that
// physically can't serve the requested volume: above its max (the "450ml →
// 180ml AeroPress" clamp bug) OR below a batch brewer's min (a 350ml Moccamaster).
test("vessel too small for the requested volume is flagged", () => {
  assert.match(vesselCannotServe("AeroPress", 450) ?? "", /AeroPress/);
  assert.match(vesselCannotServe("Clever Dripper", 600) ?? "", /Clever/);
  assert.match(vesselCannotServe("Origami Air M", 520) ?? "", /Origami/); // 520 > 500
  assert.match(vesselCannotServe("Kalita Wave", 500) ?? "", /Kalita/); // 500 > 450
});

test("batch brewer below its min is flagged (single-cup on a Moccamaster)", () => {
  assert.match(vesselCannotServe("Moccamaster", 350) ?? "", /Moccamaster/); // < 500
  assert.match(vesselCannotServe("Chemex", 300) ?? "", /Chemex/); // < 350
});

test("the 450ml everyday amount keeps the owner's pour-over kit", () => {
  // At the new "Big" = 450ml preset, these must all SERVE it (nothing excluded).
  assert.equal(vesselCannotServe("V60", 450), null);
  assert.equal(vesselCannotServe("Orea Classic", 450), null); // exactly at max
  assert.equal(vesselCannotServe("Kalita Wave", 450), null); // exactly at max
  assert.equal(vesselCannotServe("Clever Dripper", 450), null); // exactly at max
  assert.equal(vesselCannotServe("Origami (cone)", 450), null);
  assert.equal(vesselCannotServe("Chemex", 450), null);
  // …and these two correctly drop out at 450.
  assert.match(vesselCannotServe("AeroPress", 450) ?? "", /AeroPress/);
  assert.match(vesselCannotServe("Moccamaster", 450) ?? "", /Moccamaster/);
});

test("vessel that CAN serve the volume is not flagged", () => {
  assert.equal(vesselCannotServe("V60", 500), null);
  assert.equal(vesselCannotServe("Chemex", 750), null); // exactly at max
  assert.equal(vesselCannotServe("Chemex", 350), null); // exactly at min
  assert.equal(vesselCannotServe("AeroPress", 200), null);
});

test("serve guard accepts BrewerType ids (corpus-filter path)", () => {
  assert.match(vesselCannotServe("aeropress-prismo", 450) ?? "", /AeroPress/);
  assert.match(vesselCannotServe("origami-cone", 520) ?? "", /Origami/);
  assert.equal(vesselCannotServe("v60", 450), null);
  assert.equal(vesselCannotServe("orea-classic", 450), null);
});

test("serve guard: missing / non-finite inputs are safe (return null)", () => {
  assert.equal(vesselCannotServe(undefined, 450), null);
  assert.equal(vesselCannotServe("AeroPress", undefined), null);
  assert.equal(vesselCannotServe("AeroPress", NaN), null);
});
