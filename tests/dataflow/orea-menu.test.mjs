// The Orea V4 Wide has to reach the /recommend menu at the owner's usual
// batch sizes — on the bottom that fits the brew, and only one bottom at a time.
//
//   node --test tests/dataflow/orea-menu.test.mjs
//
// 2026-10-19: "Warum werden keine Orea Rezepte mehr angeboten?" Since the ±20 %
// batch window (#621) a reference is offered only near its published water, and
// the Orea set was single-cup: at 450 g only Dara for Two (Open) survived, so a
// sweetness brew never saw an Orea (0 of 50 simulated menus; production: 0 Orea
// candidates in 8 unlocked recommendations after 10-10). Fix: OREA's own two-cup
// recipes + their published Classic / Apex adaptations, and one Orea bottom per
// menu so the bottoms don't crowd the V60 / Kalita off a 4-slot menu.

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const dir = await mkdtemp(join(tmpdir(), "oreamenu-"));
const out = join(dir, "m.mjs");
await build({
  stdin: {
    contents: `export { selectRecipes, brewersAvailableFromEquipment, CANONICAL_EQUIPMENT, normaliseGoal, normaliseRoastLevel, normaliseProcess } from ${JSON.stringify(path.join(ROOT, "src/lib/knowledge/recipes/index.ts"))};`,
    resolveDir: ROOT,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  outfile: out,
  platform: "neutral",
  logLevel: "silent",
});
const M = await import(pathToFileURL(out).href);
const BREWERS = M.brewersAvailableFromEquipment(M.CANONICAL_EQUIPMENT);
const SEEDS = Array.from({ length: 30 }, (_, i) => 1786000000000 + i * 7777777);

function menus(process, goal, occasion, water) {
  return SEEDS.map((seed) =>
    M.selectRecipes(
      {
        brewersAvailable: BREWERS,
        lockedBrewers: new Set(),
        roastLevel: M.normaliseRoastLevel("Light"),
        process: M.normaliseProcess(process),
        goal: M.normaliseGoal(goal),
        occasion,
        maxWaterMl: water,
        serveVolumeMl: water,
        rotationSeed: seed,
      },
      4,
    ),
  );
}
const oreaIn = (menu) => menu.filter((s) => s.recipe.brewer.startsWith("orea"));

test("a Big (450 g) washed sweetness brew gets an Orea on the menu", () => {
  const ms = menus("Washed", "sweetness", "focus", 450);
  const withOrea = ms.filter((m) => oreaIn(m).length > 0).length;
  assert.ok(withOrea >= SEEDS.length * 0.8, `only ${withOrea}/${SEEDS.length} menus carry an Orea`);
});

test("the Orea bottom follows the context: body → Open, sweetness → not Open", () => {
  const body = menus("Washed", "body", "focus", 450).flatMap(oreaIn).map((s) => s.recipe.brewer);
  assert.ok(body.length > 0 && body.every((b) => b === "orea-open"), `body menus offered ${[...new Set(body)]}`);
  const sweet = menus("Washed", "sweetness", "focus", 450).flatMap(oreaIn).map((s) => s.recipe.brewer);
  assert.ok(sweet.length > 0 && !sweet.includes("orea-open"), `sweetness menus offered ${[...new Set(sweet)]}`);
});

test("never more than one Orea bottom on an unlocked menu", () => {
  for (const [p, g, o, w] of [
    ["Washed", "body", "focus", 450],
    ["Honey", "explore", "experiment", 450],
    ["Washed", "sweetness", "morning-ritual", 350],
    ["Natural", "sweetness", "social", 300],
  ]) {
    for (const m of menus(p, g, o, w)) {
      assert.ok(oreaIn(m).length <= 1, `${p}/${g}/${w}: ${oreaIn(m).map((s) => s.recipe.id)}`);
    }
  }
});

test("a locked Orea bottom still gets its best N recipes (no one-bottom cap under a lock)", () => {
  const m = M.selectRecipes(
    {
      brewersAvailable: BREWERS,
      lockedBrewers: new Set(["orea-classic"]),
      roastLevel: M.normaliseRoastLevel("Light"),
      process: M.normaliseProcess("Washed"),
      goal: M.normaliseGoal("sweetness"),
      occasion: "focus",
      maxWaterMl: 450,
      rotationSeed: 1,
    },
    4,
  );
  assert.ok(m.length >= 2 && m.every((s) => s.recipe.brewer === "orea-classic"), m.map((s) => s.recipe.id).join(", "));
});
