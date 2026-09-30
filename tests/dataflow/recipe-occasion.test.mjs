// Occasion and goal must actually steer which recipes /recommend is offered.
//
//   node --test tests/dataflow/recipe-occasion.test.mjs
//
// Measured 2026-09-30 on the real selector: across 3 coffees × 6 goals × 2
// volumes, the four hot occasions (Morning Ritual, Deep Focus, Social,
// Experiment) produced BYTE-IDENTICAL menus. No recipe tag could match them
// ("morning ritual" with a space never matches the UI id "morning-ritual";
// focus / social / experiment had no tags at all) and the prompt told the model
// to treat them as background. Meanwhile a variety tag (+3) outweighed the
// user's explicit goal (+2): only 11 recipes carry variety tags, almost all
// Geisha / SL28 / Heirloom, so an SL28 bag got Du 2019 in every menu whatever
// the goal.
//
// Owner decisions (2026-09-30): occasions get real meaning, taken from the UI
// footnote each one promises; goal +3, variety +1. Nothing is banned — fit
// still decides, and the Special (fast) time cap falls back when nothing fits.

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const dir = await mkdtemp(join(tmpdir(), "occasion-"));
const out = join(dir, "m.mjs");
await build({
  stdin: {
    contents: `
      export { selectRecipes, occasionAffinity, getRecipeById, ALL_RECIPES, brewersAvailableFromEquipment, CANONICAL_EQUIPMENT, normaliseGoal, normaliseRoastLevel, normaliseProcess } from ${JSON.stringify(path.join(ROOT, "src/lib/knowledge/recipes/index.ts"))};
      export { guardSpecialTime, SPECIAL_MAX_SEC } from ${JSON.stringify(path.join(ROOT, "src/lib/utils/timeBudget.ts"))};
    `,
    resolveDir: ROOT,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const M = await import(pathToFileURL(out).href);

const BREWERS = M.brewersAvailableFromEquipment([...M.CANONICAL_EQUIPMENT]);
const COFFEES = [
  { label: "washed light SL28", roastLevel: "Light", process: "Washed", variety: "SL28" },
  { label: "natural light heirloom", roastLevel: "Light", process: "Natural", variety: "Heirloom" },
  { label: "honey medium-light pink bourbon", roastLevel: "Medium-Light", process: "Honey", variety: "Pink Bourbon" },
];
const GOALS = ["balanced", "high-clarity", "sweetness-forward", "body-forward", "aromatic", "explore"];
const HOT = ["morning-ritual", "focus", "social", "experiment"];

const select = (c, goal, occasion, extra = {}) =>
  M.selectRecipes(
    {
      brewersAvailable: BREWERS,
      lockedBrewers: new Set(),
      roastLevel: M.normaliseRoastLevel(c.roastLevel),
      process: M.normaliseProcess(c.process),
      processes: [],
      variety: c.variety,
      goal: M.normaliseGoal(goal),
      occasion,
      maxWaterMl: 350,
      serveVolumeMl: 350,
      rotationSeed: 1,
      ...extra,
    },
    4,
  );
const key = (sel) => sel.map((s) => s.recipe.id).join("|");

test("the goal outranks a variety tag: the lead recipe carries the goal the user asked for", () => {
  const misses = [];
  for (const c of COFFEES) {
    for (const g of GOALS) {
      if (g === "balanced") continue;
      const lead = select(c, g, "morning-ritual")[0].recipe;
      if (!lead.bestFor.goals?.includes(g)) misses.push(`${c.label} / ${g} → ${lead.id} ${JSON.stringify(lead.bestFor.goals)}`);
    }
  }
  assert.deepEqual(misses, [], "a variety tag must not beat the chosen goal");
});

test("the four hot occasions produce different menus for the same coffee and goal", () => {
  for (const c of COFFEES) {
    for (const g of ["balanced", "sweetness-forward"]) {
      const menus = new Set(HOT.map((o) => key(select(c, g, o))));
      assert.ok(menus.size >= 2, `${c.label} / ${g}: all four occasions gave the same menu`);
    }
  }
});

test("occasionAffinity implements each footnote", () => {
  const r = (id) => M.getRecipeById(id);
  // Morning Ritual — "a slower, deliberate pour": multi-pour percolation, >= 3 min.
  assert.equal(M.occasionAffinity(r("kasuya-4-6-standard"), "morning-ritual"), 1);
  assert.equal(M.occasionAffinity(r("hoffmann-clever-ultimate"), "morning-ritual"), 0, "immersion is not a deliberate pour");
  assert.equal(M.occasionAffinity(r("wbrc-2019-du"), "morning-ritual"), 0, "a 1:45 fast recipe is not slow");
  // Deep Focus — "a clean, mid-strength cup": ratio 1:15–1:17, no bypass concentrate.
  assert.equal(M.occasionAffinity(r("hoffmann-v60-better-one-cup"), "focus"), 1);
  assert.equal(M.occasionAffinity(r("wac-2024-stanica"), "focus"), 0, "a bypass concentrate is not mid-strength brewing");
  // Social — "a forgiving recipe that holds its character as it cools".
  assert.equal(M.occasionAffinity(r("hoffmann-clever-ultimate"), "social"), 1);
  assert.equal(M.occasionAffinity(r("wendelboe-v60-light"), "social"), 0, "a clarity-only V60 is the least forgiving shape");
  // Experiment — only relative to what was already brewed on THIS bag.
  const brewed = { brewers: ["v60"], basedOn: ["Hoffmann Clever"] };
  assert.equal(M.occasionAffinity(r("kasuya-4-6-standard"), "experiment", brewed), 0, "brewer already used on this bag");
  assert.equal(M.occasionAffinity(r("hoffmann-clever-ultimate"), "experiment", brewed), 0, "recipe already used on this bag");
  assert.equal(M.occasionAffinity(r("wbrc-2019-du"), "experiment", brewed), 1);
  assert.equal(M.occasionAffinity(r("wbrc-2019-du"), "experiment"), 0, "no history → no signal");
  // Iced and cold brew are partitions, not affinities.
  assert.equal(M.occasionAffinity(r("kasuya-4-6-standard"), "summer-time"), 0);
});

test("Experiment steers away from brewers already used on this bag", () => {
  const used = ["v60", "kalita-wave"];
  const count = (sel) => sel.filter((s) => used.includes(s.recipe.brewer)).length;
  let plain = 0;
  let withHistory = 0;
  for (const c of COFFEES) {
    for (let seed = 1; seed <= 40; seed++) {
      plain += count(select(c, "balanced", "experiment", { rotationSeed: seed * 7919 }));
      withHistory += count(
        select(c, "balanced", "experiment", {
          rotationSeed: seed * 7919,
          brewedOnThisCoffee: { brewers: used, basedOn: [] },
        }),
      );
    }
  }
  assert.ok(plain > 0, "the baseline must actually contain V60/Kalita for this test to mean anything");
  assert.ok(withHistory < plain, `expected fewer V60/Kalita once they were brewed on this bag (${plain} → ${withHistory})`);
});

test("Special (fast shot) keeps the menu to fast recipes, and never empties it", () => {
  for (const c of COFFEES) {
    const sel = select(c, "balanced", "morning-ritual", { timeAvailable: "special" });
    assert.ok(sel.length >= 2, "the Special menu must not be empty");
    for (const s of sel) assert.ok(s.recipe.totalTimeSec <= M.SPECIAL_MAX_SEC, `${s.recipe.id} is ${s.recipe.totalTimeSec}s`);
  }
  // Legacy "quick" is the same bucket.
  const legacy = select(COFFEES[0], "balanced", "focus", { timeAvailable: "quick" });
  for (const s of legacy) assert.ok(s.recipe.totalTimeSec <= M.SPECIAL_MAX_SEC);
});

test("guardSpecialTime drops slow candidates on a Special brew, keeps all if all are slow", () => {
  const cand = (title, targetTimeSec) => ({ method: "V60", title, recipe: { targetTimeSec } });
  const kept = M.guardSpecialTime([cand("fast", 150), cand("slow", 260)], "special");
  assert.deepEqual(kept.map((c) => c.title), ["fast"]);
  const allSlow = M.guardSpecialTime([cand("a", 240), cand("b", 260)], "special");
  assert.equal(allSlow.length, 2, "never leave the user with no recipe");
  const normal = M.guardSpecialTime([cand("slow", 260)], "normal");
  assert.equal(normal.length, 1, "no-op outside Special");
});

test("recommend.ts wires occasion history, the time bucket and the Special guard", async () => {
  const src = await readFile(path.join(ROOT, "src/lib/claude/recommend.ts"), "utf8");
  assert.match(src, /brewedOnThisCoffee\s*[,:]/, "selector must receive brewedOnThisCoffee");
  assert.match(src, /timeAvailable:\s*context\.timeAvailable/, "selector must receive the time bucket");
  assert.match(src, /guardSpecialTime\(/, "the post-parse Special guard must run");
  assert.match(src, /context\.occasion === "experiment"/, "Experiment must open the exploration slot from brew 1");
});
