// The recipe has to speak the grinder the user actually picked.
//
//   node --test tests/dataflow/grind-unit.test.mjs
//
// Report: "manchmal zeigt er Grad, obwohl ich sage Comandante". The grinder is
// picked in the flow, reaches the prompt, and the prompt says "NEVER Niche°"
// outright — and it still comes back in degrees. Same shape as the banned
// brewer and the disc offset: a hard rule stated in prose and enforced nowhere.
//
// A wrong unit is worse than a wrong number. "406" on a Comandante is not
// approximately right; the grinder has no such setting, so the recipe is
// unusable at the one moment it has to be read. Hence: convert, don't flag.
//
// The map is the owner's own measured anchors (docs/grind-settings.md):
// 380° = 23 clicks, 400° = 29 clicks, i.e. ~3.3° per click.

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const dir = await mkdtemp(join(tmpdir(), "grindunit-"));
const out = join(dir, "g.mjs");
await build({
  stdin: {
    contents: `export * from ${JSON.stringify(path.join(ROOT, "src/lib/utils/grindUnit.ts"))};`,
    resolveDir: ROOT,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  outfile: out,
  platform: "neutral",
  logLevel: "silent",
});
const { normalizeGrindToGrinder: fix, nicheToClicks, clicksToNiche } = await import(
  pathToFileURL(out).href
);

test("the measured anchors round-trip exactly", () => {
  // If these two ever drift, the conversion is no longer the owner's map.
  assert.equal(nicheToClicks(380), 23);
  assert.equal(nicheToClicks(400), 29);
  assert.equal(clicksToNiche(23), 380);
  assert.equal(clicksToNiche(29), 400);
});

test("degrees handed to the Comandante become clicks", () => {
  assert.equal(fix("406°", "Comandante C40"), "31 clicks");
  assert.equal(fix("380°", "Comandante C40"), "23 clicks");
  // Bare number, no unit marker — magnitude alone settles it.
  assert.equal(fix("400", "Comandante C40"), "29 clicks");
});

test("clicks handed to the Niche become degrees", () => {
  assert.equal(fix("26 clicks", "Niche Zero"), "390°");
  assert.equal(fix("23", "Niche Zero"), "380°");
});

test("a value already in the right unit is left completely alone", () => {
  // Not just the number — the wording too, so nothing is churned needlessly.
  assert.equal(fix("406°", "Niche Zero"), "406°");
  assert.equal(fix("26 clicks", "Comandante C40"), "26 clicks");
  assert.equal(fix("406° (Niche Zero)", "Niche Zero"), "406° (Niche Zero)");
});

test("anything unparseable is left alone rather than guessed at", () => {
  assert.equal(fix("medium-coarse", "Comandante C40"), "medium-coarse");
  assert.equal(fix("", "Niche Zero"), "");
  assert.equal(fix(undefined, "Niche Zero"), undefined);
});

test("an unknown or missing grinder is treated as the Niche", () => {
  // The default in recommend.ts is "Niche Zero" — the daily driver.
  assert.equal(fix("26", undefined), "390°");
  assert.equal(fix("406°", undefined), "406°");
});
