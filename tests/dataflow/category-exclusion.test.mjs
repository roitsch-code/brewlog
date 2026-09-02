// excludeLongWaits must be CATEGORY-aware: a long designed wait on an immersion
// brewer (Clever/AeroPress) IS the steep — the whole method — not a pour-over
// dead-gap. Lumping the two together stripped every immersion recipe from the
// hot menu, which left the recommender reaching for a Clever out-of-menu (the
// "3 of 4 recommendations are Clever water-first" report). The pour-over
// long-waits the owner dislikes (Kasuya Mugen draw, Hedrick bypass gap, Rao
// Rule-of-Thirds rest) must still be excluded.
//
//   node --test tests/dataflow/category-exclusion.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const dir = await mkdtemp(join(tmpdir(), "catex-"));
const out = join(dir, "o.mjs");
await build({
  stdin: {
    contents: `export { selectRecipes, ALL_RECIPES, isImmersionRecipe, hasLongDesignedWait } from ${JSON.stringify(path.join(ROOT, "src/lib/knowledge/recipes/helpers.ts"))};`,
    resolveDir: ROOT,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  outfile: out,
  platform: "neutral",
  logLevel: "silent",
});
const { selectRecipes, ALL_RECIPES, isImmersionRecipe, hasLongDesignedWait } = await import(
  pathToFileURL(out).href
);

const byId = (id) => ALL_RECIPES.find((r) => r.id === id);
// The three pour-over recipes the exclusion is meant to catch (owner-flagged
// long waits between pours). They carry the long wait but are NOT immersion.
const EXCLUDED_POUROVERS = ["kasuya-mugen-flat", "hedrick-bypass-v60", "rao-rule-of-thirds"];

test("the flagged pour-overs have a long wait AND are not immersion (so they're excluded)", () => {
  for (const id of EXCLUDED_POUROVERS) {
    const r = byId(id);
    assert.ok(r, `${id} missing from the corpus`);
    assert.equal(hasLongDesignedWait(r), true, `${id} should register a long designed wait`);
    assert.equal(isImmersionRecipe(r), false, `${id} is a pour-over, not immersion`);
  }
});

test("a Clever steep is a long wait but immersion — so the exemption is load-bearing", () => {
  const clever = byId("hoffmann-clever-ultimate");
  assert.ok(clever);
  // Under the OLD filter this would be excluded (long wait); the exemption keeps it.
  assert.equal(hasLongDesignedWait(clever), true);
  assert.equal(isImmersionRecipe(clever), true);
});

test("all Clever and AeroPress recipes are classed as immersion (0 misclassified)", () => {
  const immersionBrewers = new Set(["clever", "aeropress", "aeropress-prismo"]);
  for (const r of ALL_RECIPES) {
    if (immersionBrewers.has(r.brewer)) {
      assert.equal(isImmersionRecipe(r), true, `${r.id} (${r.brewer}) should be immersion`);
    } else {
      assert.equal(isImmersionRecipe(r), false, `${r.id} (${r.brewer}) should NOT be immersion`);
    }
  }
});

test("with excludeLongWaits, immersion survives the hot menu and the flagged pour-overs don't", () => {
  const brewersAvailable = new Set(ALL_RECIPES.map((r) => r.brewer));
  const menu = selectRecipes(
    {
      brewersAvailable,
      roastLevel: "light",
      process: "washed",
      goal: "balanced",
      excludeLongWaits: true, // the production rule on every hot brew
      rotationSeed: 1,
    },
    20,
  );
  assert.ok(
    menu.some((s) => s.recipe.brewer === "clever"),
    "a Clever recipe must be offered when immersion fits — it is no longer stripped",
  );
  const ids = new Set(menu.map((s) => s.recipe.id));
  for (const id of EXCLUDED_POUROVERS) {
    assert.ok(!ids.has(id), `${id} (pour-over long-wait) must not be offered on a hot brew`);
  }
});

test("recommend.ts still applies excludeLongWaits on hot brews (consumer wiring)", async () => {
  const src = await readFile(path.join(ROOT, "src/lib/claude/recommend.ts"), "utf8");
  assert.match(
    src,
    /excludeLongWaits:\s*Boolean\(dripAssistLocked\)\s*\|\|\s*isHotBrew/,
    "the category-aware exclusion is only reached because recommend.ts sets excludeLongWaits on hot brews",
  );
});
