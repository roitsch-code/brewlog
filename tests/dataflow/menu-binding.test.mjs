// Does a candidate's basedOn name something the turn actually offered?
//
// WHY: /recommend scores and rotates a small reference library per brew, but
// nothing checked whether the model USED it — so the menu could measurably
// rotate (19/20 distinct after #523) while the candidates stayed the same. The
// fidelity guard can't tell the difference either: resolveReference searches
// all ~135 corpus recipes, so a recipe the turn never offered still resolves.
//
// This is a measurement and a soft prompt signal, never an exclusion (owner's
// rule: nothing is banned, best fit decides). These tests pin the matcher,
// because the matching is where an earlier anti-repetition lever silently
// died: it compared names EXACTLY, and the model writes "Kasuya 4:6" where the
// corpus says "Kasuya 4:6 Method — Standard", so it never matched anything.
//
//   node --test tests/dataflow/menu-binding.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const entry = `export { isInMenu, menuNamesOf } from ${JSON.stringify(
  path.join(ROOT, "src/lib/claude/menuBinding.ts"),
)};`;
const dir = await mkdtemp(join(tmpdir(), "menu-binding-"));
const out = join(dir, "b.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { isInMenu, menuNamesOf } = await import(pathToFileURL(out).href);

const MENU = [
  "Kasuya 4:6 Method — Standard",
  "Hoffmann V60 — Better 1 Cup",
  "Wölfl 2024 — Orea Fast (WBrC)",
];

test("a short form the model actually writes matches the long corpus name", () => {
  // The exact failure mode that made an earlier lever a silent no-op.
  assert.equal(isInMenu("Kasuya 4:6", MENU), true);
  assert.equal(isInMenu("Hoffmann V60", MENU), true);
  assert.equal(isInMenu("Wölfl 2024", MENU), true);
});

test("an exact name matches", () => {
  assert.equal(isInMenu("Hoffmann V60 — Better 1 Cup", MENU), true);
});

test("a recipe the turn did not offer is reported as out-of-menu", () => {
  assert.equal(isInMenu("Clever Extended", MENU), false);
  assert.equal(isInMenu("Rao — V60 Spin Method", MENU), false);
});

test("a fragment too short to be specific does not match", () => {
  // "4:6" appears inside a menu name but says nothing about which recipe —
  // below the specificity floor, so it must not count as a match.
  assert.equal(isInMenu("4:6", MENU), false);
});

test("self-authored work counts as in-menu, not as ignoring the menu", () => {
  // An own experiment is an encouraged answer — it is the honest alternative to
  // reconstructing a published recipe from memory — so it must not read as the
  // model reaching past what it was given.
  assert.equal(isInMenu("Own experiment", MENU), true);
  assert.equal(isInMenu("Own recipe", MENU), true);
  assert.equal(isInMenu(undefined, MENU), true);
  assert.equal(isInMenu("", MENU), true);
});

test("the user's own brews count when they were offered this turn", () => {
  const own = ["Your Orea V4 Classic — DAK Berry Swirl (12 Aug 2026)"];
  const names = menuNamesOf(
    MENU.map((name) => ({ recipe: { name } })),
    own,
  );
  assert.equal(isInMenu("Your Orea V4 Classic — DAK Berry Swirl (12 Aug 2026)", names), true);
  // The "Your …" shape is recognised even against a menu that omits it, so a
  // turn that offered own references never logs them as out-of-menu.
  assert.equal(isInMenu("Your Chemex — Friedhats Guji (3 Aug 2026)", MENU), true);
});

test("menuNamesOf offers both the full name and the short name", () => {
  const names = menuNamesOf([
    { recipe: { name: "Kasuya 4:6 Method — Standard", shortName: "Kasuya 4:6" } },
  ]);
  assert.ok(names.includes("Kasuya 4:6 Method — Standard"));
  assert.ok(names.includes("Kasuya 4:6"));
});

test("case and whitespace differences do not create false out-of-menu reports", () => {
  assert.equal(isInMenu("  hoffmann   v60  ", MENU), true);
});
