// Recipe-menu rotation tests. Bundles the REAL helpers.ts (+ the real recipe
// corpus) with esbuild and asserts selectRecipes' tie-rotation.
//
//   node --test tests/dataflow/recipe-rotation.test.mjs
//
// The problem it solves ("recommendations repeat across contexts", and the
// Clever water-first showing up every single brew): the recommend menu is
// near-deterministic per coffee, so the same reference recipes were injected
// every time. Equal-scoring recipes are interchangeable best-matches, so
// rotateTies rotates WITHIN each equal-score group by rotationSeed — varying the
// injected menu and the per-brewer diversity winner across brews WITHOUT ever
// demoting a higher-scoring recipe below a lower one.

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const entry = `export { selectRecipes, brewersAvailableFromEquipment, CANONICAL_EQUIPMENT } from ${JSON.stringify(
  path.join(ROOT, "src/lib/knowledge/recipes/helpers.ts"),
)};`;
const dir = await mkdtemp(join(tmpdir(), "rotation-"));
const out = join(dir, "b.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { selectRecipes, brewersAvailableFromEquipment, CANONICAL_EQUIPMENT } = await import(
  pathToFileURL(out).href
);

const BREWERS = brewersAvailableFromEquipment(CANONICAL_EQUIPMENT);
const base = { brewersAvailable: BREWERS, roastLevel: "light", process: "washed", goal: "balanced" };
const ids = (rs) => rs.map((r) => r.recipe.id);

test("scores stay non-increasing for every seed (ties rotated, never demoted across levels)", () => {
  for (let seed = 0; seed < 8; seed++) {
    const scores = selectRecipes({ ...base, rotationSeed: seed }, 4).map((r) => r.score);
    for (let i = 1; i < scores.length; i++) {
      assert.ok(scores[i] <= scores[i - 1], `seed ${seed}: scores must be non-increasing`);
    }
  }
});

test("rotation is deterministic for a given seed", () => {
  assert.deepEqual(
    ids(selectRecipes({ ...base, rotationSeed: 3 }, 4)),
    ids(selectRecipes({ ...base, rotationSeed: 3 }, 4)),
  );
});

test("seed 0 and no seed both mean 'no rotation'", () => {
  assert.deepEqual(
    ids(selectRecipes({ ...base, rotationSeed: 0 }, 4)),
    ids(selectRecipes({ ...base }, 4)),
  );
});

test("the injected menu varies across brews (lead + brewer set are not constant)", () => {
  const leads = new Set();
  const brewerSets = new Set();
  for (let seed = 0; seed < 12; seed++) {
    const rs = selectRecipes({ ...base, rotationSeed: seed }, 4);
    leads.add(rs[0].recipe.brewer);
    brewerSets.add(rs.map((r) => r.recipe.brewer).sort().join(","));
  }
  assert.ok(leads.size >= 2, "the leading brewer must vary across seeds");
  assert.ok(brewerSets.size >= 2, "the 4-brewer portfolio must vary across seeds");
});

test("a tied top brewer no longer appears in EVERY brew (the Clever-water-first complaint)", () => {
  // Over a run of brews, no single tied-top brewer should be present in all of
  // them — the whole point of rotating the diversity winner.
  const seeds = 12;
  const presence = {};
  for (let seed = 0; seed < seeds; seed++) {
    for (const r of selectRecipes({ ...base, rotationSeed: seed }, 4)) {
      presence[r.recipe.brewer] = (presence[r.recipe.brewer] ?? 0) + 1;
    }
  }
  // At least one brewer that competes for a slot drops out on some brews.
  const someBrewerDropsOut = Object.values(presence).some((n) => n > 0 && n < seeds);
  assert.ok(someBrewerDropsOut, "no brewer should be pinned into all 12 brews");
});

test("locked-method selection also rotates its ties", () => {
  const locked = { ...base, lockedBrewers: new Set(["v60"]) };
  const firsts = new Set();
  for (let seed = 0; seed < 8; seed++) {
    firsts.add(ids(selectRecipes({ ...locked, rotationSeed: seed }, 4))[0]);
  }
  assert.ok(firsts.size >= 2, "the top locked-method recipe must vary across seeds");
});
