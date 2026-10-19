// "Fresh" (src/lib/fresh/freshItems.ts + /api/fresh + FreshStrip, 2026-10-19):
// what is new since the last open of the Context step — never on Home.
//
//   node --test tests/dataflow/fresh-strip.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const out = path.join(ROOT, "node_modules/.cache/fresh-strip/bundle.mjs");
await build({
  stdin: {
    contents: `
export * from ${JSON.stringify(path.join(ROOT, "src/lib/fresh/freshItems.ts"))};
export { ALL_RECIPES } from ${JSON.stringify(path.join(ROOT, "src/lib/knowledge/recipes/index.ts"))};
`,
    resolveDir: ROOT,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
  external: ["pg", "pg-native", "drizzle-orm", "drizzle-orm/*"],
});
const F = await import(pathToFileURL(out).href);

const NOW = Date.parse("2026-10-19T12:00:00Z");
const day = 86_400_000;
const base = F.ALL_RECIPES.find((r) => r.brewer === "v60" && r.verified);
const aero = F.ALL_RECIPES.find((r) => r.brewer === "aeropress");
const mocca = F.ALL_RECIPES.find((r) => r.brewer === "moccamaster");
const at = (daysAgo) => new Date(NOW - daysAgo * day).toISOString();

test("a recipe is fresh for 30 days after addedAt, newest first; without addedAt it never is", () => {
  const recipes = [
    { ...base, id: "a", addedAt: at(2) },
    { ...base, id: "b", addedAt: at(10) },
    { ...base, id: "c", addedAt: at(40) },
    { ...base, id: "d" },
  ];
  const items = F.freshRecipes(recipes, { now: NOW });
  assert.deepEqual(items.map((i) => i.key), ["recipe:a", "recipe:b"]);
  assert.equal(items[0].kind, "recipe");
  assert.equal(items[0].recipeName, base.name, "the name the Context free text is prefilled with");
  assert.match(items[0].body, new RegExp(`${base.dose.grams} g : ${base.water.grams} g`));
  assert.equal(F.FRESH_RECIPE_DAYS, 30);
});

test("`since` narrows to what arrived after the last open", () => {
  const recipes = [{ ...base, id: "a", addedAt: at(2) }, { ...base, id: "b", addedAt: at(10) }];
  const items = F.freshRecipes(recipes, { now: NOW, since: NOW - 5 * day });
  assert.deepEqual(items.map((i) => i.key), ["recipe:a"]);
});

test("today's amount decides: a Moccamaster recipe is not fresh for a 350 g brew, an AeroPress one still is (concentrate + bypass)", () => {
  const recipes = [{ ...mocca, id: "m", addedAt: at(1) }, { ...aero, id: "ae", addedAt: at(1) }, { ...base, id: "v", addedAt: at(1) }];
  const keys = F.freshRecipes(recipes, { now: NOW, waterMl: 350 }).map((i) => i.key);
  assert.ok(!keys.includes("recipe:m"), keys.join(","));
  assert.ok(keys.includes("recipe:ae"), keys.join(","));
  assert.ok(keys.includes("recipe:v"));
  assert.ok(F.freshRecipes(recipes, { now: NOW, waterMl: 750 }).map((i) => i.key).includes("recipe:m"));
});

test("an unverified (scouted) recipe says so in its line", () => {
  const items = F.freshRecipes([{ ...base, id: "u", verified: false, addedAt: at(1) }], { now: NOW });
  assert.match(items[0].body, /unverified$/);
});

test("the queue: dismissed keys out, newest first, at most two", () => {
  const items = [
    { key: "coach:1", kind: "coach", title: "", body: "", at: at(1) },
    { key: "recipe:a", kind: "recipe", title: "", body: "", at: at(0.5) },
    { key: "recipe:b", kind: "recipe", title: "", body: "", at: at(3) },
    { key: "coffee-card:x", kind: "coffee-card", title: "", body: "", at: at(0.1) },
  ];
  const q = F.freshQueue(items, new Set(["coffee-card:x"]));
  assert.deepEqual(q.map((i) => i.key), ["recipe:a", "coach:1"]);
  assert.equal(F.FRESH_MAX_ITEMS, 2);
  assert.equal(F.readDismissed("garbage").size, 0);
  assert.deepEqual([...F.readDismissed('["a","b"]')], ["a", "b"]);
});

test("WIRING: the route reads recipes + the newest coach row + this bag's card; the strip sits on the Context step and NOT on Home", async () => {
  const route = await readFile(path.join(ROOT, "src/app/api/fresh/route.ts"), "utf8");
  assert.match(route, /freshRecipes\(ALL_RECIPES, \{ since, waterMl \}\)/);
  assert.match(route, /eq\(insights\.source, "opus"\), eq\(insights\.status, "new"\)/, "the general coach's new row");
  assert.match(route, /card\.status === "new"/, "this bag's new card");
  const ctx = await readFile(path.join(ROOT, "src/components/flow/LightStepContext.tsx"), "utf8");
  assert.match(ctx, /<FreshStrip\s+coffeeId=\{draft\.coffee\?\.coffeeId\}/);
  assert.match(ctx, /onPickRecipe=\{\(name\) => updateCtx\(\{ userRequest: name\.slice\(0, USER_REQUEST_MAX_CHARS\) \}\)\}/, "a tapped recipe leads today's menu through the free-text path");
  const home = await readFile(path.join(ROOT, "src/app/(light)/page.tsx"), "utf8");
  assert.doesNotMatch(home, /FreshStrip|\/api\/fresh/, "owner: Home stays clean");
  const strip = await readFile(path.join(ROOT, "src/components/ui/light/FreshStrip.tsx"), "utf8");
  assert.match(strip, /if \(items\.length === 0\) return null;/);
  assert.match(strip, /localStorage\.setItem\(FRESH_LAST_OPEN_KEY, String\(Date\.now\(\)\)\)/, "the next open starts from now");
});
