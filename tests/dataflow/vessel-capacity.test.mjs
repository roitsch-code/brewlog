// Vessel-capacity guard tests — bundles the REAL src/lib/utils/vesselCapacity.ts
// with esbuild so the test tracks the actual rule. This is the deterministic
// backstop /recommend applies after generation: the Mistral spike (issue #453)
// showed large-volume requests can pick an over-capacity vessel (Clever/Origami
// at 520ml) despite the prompt forbidding it.
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

test("vessels within capacity pass", () => {
  assert.equal(vesselOverflow("AeroPress", 200), null);
  assert.equal(vesselOverflow("Clever Dripper", 450), null);
  assert.equal(vesselOverflow("Origami Air M", 450), null);
  assert.equal(vesselOverflow("Moccamaster", 750), null);
  assert.equal(vesselOverflow("V60", 520), null); // no hard limit
});

test("over-capacity vessels are flagged (the spike's 520ml failures)", () => {
  assert.match(vesselOverflow("AeroPress", 260) ?? "", /AeroPress/);
  assert.match(vesselOverflow("Clever Dripper", 520) ?? "", /Clever/);
  assert.match(vesselOverflow("Origami (cone)", 520) ?? "", /Origami/);
  assert.match(vesselOverflow("Moccamaster", 350) ?? "", /Moccamaster/);
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
