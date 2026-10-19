// Vessel-capacity guard tests — bundles the REAL src/lib/utils/vesselCapacity.ts
// with esbuild so the test tracks the actual rule. This is the deterministic
// backstop /recommend applies after generation: the Mistral spike (issue #453)
// showed large-volume requests can pick an over-capacity vessel despite the
// prompt forbidding it.
//
// Caps are owner-measured (2026-08-31), min AND max per vessel:
//   AeroPress ≤230 · Clever ≤450 · Origami ≤350 (Air S) · Kalita ≤450 · Orea ≤450
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
const entry = `export { vesselOverflow } from ${JSON.stringify(
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
const { vesselOverflow } = await import(pathToFileURL(out).href);

test("recipes within a vessel's window pass", () => {
  assert.equal(vesselOverflow("AeroPress", 200), null);
  assert.equal(vesselOverflow("Clever Dripper", 450), null); // exactly at max
  assert.equal(vesselOverflow("Origami Air S", 350), null); // the Air S holds 350
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

// vesselCannotServe (the selector's hard filter) was removed 2026-10-19: a
// vessel smaller than the amount is information on the menu, never a reason
// to hide the brewer (src/lib/knowledge/brewers.ts reachFor).
test("the serve filter is gone; the module exports only the overflow check", async () => {
  const { readFile } = await import("node:fs/promises");
  const src = await readFile(path.join(ROOT, "src/lib/utils/vesselCapacity.ts"), "utf8");
  assert.doesNotMatch(src, /export function vesselCannotServe/);
  assert.match(src, /Origami", maxMl: 350/, "the Origami Air S holds 350 ml (owner, 2026-10-19)");
});
