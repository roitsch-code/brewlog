// 2026-10-19 — "Brewer werden nicht in die Selection mit aufgenommen". The
// old 4-slot menu with its batch window, vessel filter, one-Orea rule and
// Special ceiling put the AeroPress, Moccamaster and Origami wave on 0 of 360
// Small menus. Owner: every brewer is on the table, equally; a vessel smaller
// than the amount or a recipe published at another size is INFORMATION.
//
// This suite is the tripwire: every owned brewer has an entry on every menu,
// the reach path is stated, the least recently offered brewers lead, and the
// cached index is byte-identical.
//
//   node --test tests/dataflow/brewer-menu.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const dir = await mkdtemp(join(tmpdir(), "menu-"));
const entry = `
export { buildBrewerMenu, formatMenuForPrompt, formatRecipeIndexBlock, brewersAvailableFromEquipment, CANONICAL_EQUIPMENT, normaliseGoal, normaliseRoastLevel, normaliseProcess, ALL_RECIPES, isNewRecipe } from ${JSON.stringify(path.join(ROOT, "src/lib/knowledge/recipes/index.ts"))};
export { BREWER_ROLES, BREWER_TYPE_TO_ROLE, reachFor, brewerCap, formatBrewerRolesBlock } from ${JSON.stringify(path.join(ROOT, "src/lib/knowledge/brewers.ts"))};
export { VESSEL_CAPS } from ${JSON.stringify(path.join(ROOT, "src/lib/utils/vesselCapacity.ts"))};
export { brewerRecency, roleFromMethod } from ${JSON.stringify(path.join(ROOT, "src/lib/claude/methodRotation.ts"))};
`;
const out = join(dir, "m.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
  alias: { "@": path.join(ROOT, "src") },
});
const M = await import(pathToFileURL(out).href);

const OWNED = M.brewersAvailableFromEquipment([...M.CANONICAL_EQUIPMENT]);
const HOT_ROLES = M.BREWER_ROLES.filter((r) => !r.coldOnly).map((r) => r.key);
const GOALS = ["balanced", "high-clarity", "sweetness-forward", "body-forward", "aromatic", "explore"];
const PROCESSES = ["washed", "natural", "honey"];
const OCCASIONS = ["morning-ritual", "focus", "social", "experiment"];

const menuFor = (water, goal, process, occasion, extra = {}) =>
  M.buildBrewerMenu({
    brewersAvailable: OWNED,
    roastLevel: M.normaliseRoastLevel("Light"),
    process: M.normaliseProcess(process),
    processes: [],
    goal: M.normaliseGoal(goal),
    occasion,
    rotationSeed: 7919,
    targetWaterGrams: water,
    ...extra,
  });

test("every owned brewer is on every hot menu — 300 / 350 / 450 g, every goal, process, occasion and seed", () => {
  const missing = [];
  for (const water of [300, 350, 450]) {
    for (const goal of GOALS) {
      for (const process of PROCESSES) {
        for (const occasion of OCCASIONS) {
          for (let seed = 1; seed <= 5; seed++) {
            const menu = menuFor(water, goal, process, occasion, { rotationSeed: seed * 7919 });
            const roles = new Set(menu.entries.map((e) => e.role));
            for (const r of HOT_ROLES) if (!roles.has(r)) missing.push(`${r} @ ${water} g ${goal}/${process}/${occasion}/${seed}`);
            assert.ok(!roles.has("cold-brew-jar"), "the cold-brew jar is not on a hot menu");
          }
        }
      }
    }
  }
  assert.deepEqual(missing, []);
});

test("every hot role has at least one documented recipe, and the entry carries its best fit with the factor to today's amount", () => {
  const menu = menuFor(350, "balanced", "washed", "morning-ritual");
  for (const e of menu.entries) {
    assert.ok(e.recipes.length > 0, `${e.role} has no recipe — the corpus lost one`);
    assert.ok(e.best, `${e.role} has no best fit`);
    assert.equal(e.scaleFactor, 350 / e.best.recipe.water.grams);
  }
});

test("the reach path is physics from VESSEL_CAPS: AeroPress → concentrate + bypass, batch brewers → not for this size", () => {
  assert.equal(M.reachFor("aeropress", 350).how, "concentrate-bypass");
  assert.match(M.reachFor("aeropress", 350).text, /holds 230 ml .* concentrate and add bypass water/);
  assert.equal(M.reachFor("moccamaster", 350).how, "not-for-this-size");
  assert.match(M.reachFor("moccamaster", 350).text, /needs at least 500 ml/);
  assert.equal(M.reachFor("chemex", 300).how, "not-for-this-size");
  assert.equal(M.reachFor("chemex", 350).how, "fits");
  assert.equal(M.reachFor("v60", 450).how, "fits");
  assert.equal(M.reachFor("origami-cone", 450).how, "not-for-this-size", "the Origami Air S holds 350 ml");
  assert.equal(M.reachFor("origami-cone", 350).how, "fits");
  assert.equal(M.reachFor("clever", 450).how, "fits");
  assert.equal(M.reachFor("kalita-wave", undefined).how, "fits", "no amount → nothing to say");
  // Every role's cap is the owner-measured one from VESSEL_CAPS, never a copy.
  for (const r of M.BREWER_ROLES) {
    const cap = M.brewerCap(r.key);
    const src = M.VESSEL_CAPS.find((c) => c.match.test(r.key));
    assert.ok(src, `${r.key} must resolve a VESSEL_CAPS row`);
    assert.equal(cap.maxMl, src.maxMl);
    assert.equal(cap.minMl, src.minMl);
  }
});

test("every recipe brewer the owner owns maps to a role; the Orea body and the Origami label pool under their bottoms / filters", () => {
  for (const b of OWNED) {
    assert.ok(M.BREWER_TYPE_TO_ROLE.has(b), `${b} has no role`);
  }
  assert.equal(M.BREWER_TYPE_TO_ROLE.get("orea-v4-wide"), "orea-fast");
  assert.equal(M.BREWER_TYPE_TO_ROLE.get("aeropress-prismo"), "aeropress");
  assert.equal(M.BREWER_TYPE_TO_ROLE.get("origami-air-m"), "origami-cone");
  assert.equal(M.roleFromMethod("Orea Fast"), "orea-fast");
  assert.equal(M.roleFromMethod("Origami (wave)"), "origami-wave");
  assert.equal(M.roleFromMethod("V60 + Drip Assist"), "v60");
  assert.equal(M.roleFromMethod("Clever Dripper"), "clever");
});

test("a locked brewer is the only entry, with up to five of its recipes in full; shown ids are off the menu", () => {
  const locked = menuFor(350, "balanced", "washed", "focus", { lockedBrewers: new Set(["orea-apex"]) });
  assert.deepEqual(locked.entries.map((e) => e.role), ["orea-apex"]);
  assert.ok(locked.locked);
  assert.equal(locked.leads.length, 1);
  const text = M.formatMenuForPrompt(locked, { lockedMethod: "Orea Apex" });
  assert.match(text, /YOUR BREWER TODAY — you locked Orea Apex/);
  const shown = menuFor(300, "balanced", "washed", "focus", { lockedBrewers: new Set(["v60"]), excludeRecipeIds: new Set(["kasuya-4-6-standard"]) });
  assert.ok(!shown.entries[0].recipes.some((s) => s.recipe.id === "kasuya-4-6-standard"), "a shown reference is off the menu");
});

test("the least recently offered brewers lead, and every brewer leads within two consecutive turns", () => {
  const roles = HOT_ROLES;
  const lastOffered = new Map();
  const ledOn = new Map();
  let sessions = 0;
  for (let turn = 0; turn < 2; turn++) {
    const menu = menuFor(350, "balanced", "washed", "focus", { rotationSeed: 7919 * (turn + 1), lastOffered });
    assert.equal(menu.leads.length, 8);
    for (const e of menu.leads) ledOn.set(e.role, turn);
    // The next turn: the leads were "offered" (brews ago shift by one).
    for (const [k, v] of Array.from(lastOffered.entries())) lastOffered.set(k, v + 1);
    for (const e of menu.leads) lastOffered.set(e.role, 0);
    sessions += 1;
  }
  const never = roles.filter((r) => !ledOn.has(r));
  assert.deepEqual(never, [], "a brewer that never leads is a brewer the model never sees in full");
  // Never-offered beats offered: with everything offered except two, those two lead.
  const all = new Map(roles.map((r) => [r, 0]));
  all.delete("moccamaster");
  all.delete("origami-wave");
  const m = menuFor(350, "balanced", "washed", "focus", { lastOffered: all });
  const leadRoles = m.leads.map((e) => e.role);
  assert.ok(leadRoles.indexOf("moccamaster") < 2 && leadRoles.indexOf("origami-wave") < 2, JSON.stringify(leadRoles));
});

test("the cold-brew occasion carries only cold steeps; summer-time keeps every brewer, with or without an iced recipe", () => {
  const cold = menuFor(500, "balanced", "natural", "cold-brew");
  assert.ok(cold.entries.length > 0);
  for (const e of cold.entries) for (const s of e.recipes) assert.ok(s.recipe.totalTimeSec >= 3600 || s.recipe.bestFor.occasions?.includes("cold-brew"), `${s.recipe.id} is not a cold steep`);
  assert.ok(cold.entries.some((e) => e.role === "cold-brew-jar"));
  const iced = menuFor(350, "balanced", "natural", "summer-time");
  assert.equal(new Set(iced.entries.map((e) => e.role)).size, HOT_ROLES.length, "every brewer stays on the table for an iced brew");
  assert.ok(iced.entries.some((e) => e.recipes.length === 0), "a brewer without a documented iced recipe is listed as such, not hidden");
  for (const e of iced.entries) for (const s of e.recipes) assert.ok(s.recipe.bestFor.occasions?.some((o) => o === "summer-time" || o === "iced"), `${s.recipe.id} is not an iced recipe`);
});

test("the prompt block: one line per brewer with reach + recency, then the leads' full text; out-of-window entries carry their factor", () => {
  const recency = new Map([["v60", 0], ["clever", 1]]);
  const menu = menuFor(350, "balanced", "washed", "morning-ritual", { lastOffered: recency });
  const text = M.formatMenuForPrompt(menu, { grinder: "Niche Zero" });
  assert.match(text, new RegExp(`YOUR BREWERS TODAY \\(${HOT_ROLES.length}\\)`));
  assert.match(text, /- AeroPress · \d+ recipes fit · best fit: [^\n]* · holds 230 ml — for 350 g brew a concentrate/);
  assert.match(text, /- Moccamaster · [^\n]*needs at least 500 ml — not for 350 g/);
  assert.match(text, /- V60 · [^\n]*offered on your last brew/);
  assert.match(text, /- Clever Dripper · [^\n]*last offered 2 brews ago/);
  assert.match(text, /- Orea Apex · [^\n]*not offered in your last 10 brews/);
  const full = text.slice(text.indexOf("FULL TEXT"));
  const entries = full.match(/^\d+\. ▸ /gm) ?? [];
  assert.equal(entries.length, menu.leads.length, "one full recipe per lead");
  assert.doesNotMatch(text.slice(0, text.indexOf("FULL TEXT")), /NEVER|FORBIDDEN|BANNED|must EARN/, "information, not rules");
  // A 500 g Moccamaster recipe at 350 g: labelled with its factor, no scaled line.
  if (/\(Moccamaster\)/.test(full)) {
    const mocc = full.slice(full.indexOf("(Moccamaster)"));
    const block = mocc.slice(0, mocc.indexOf("\n\n"));
    assert.match(block, /Published at \d+ g — ×\d\.\d\d to your 350 g, outside its ±20 % window/);
  }
});

test("the cached REFERENCE RECIPE INDEX is byte-identical across calls and lists every owned-brewer recipe once", () => {
  const a = M.formatRecipeIndexBlock();
  const b = M.formatRecipeIndexBlock();
  assert.equal(a, b);
  assert.match(a, /^REFERENCE RECIPE INDEX — every documented recipe on a brewer you own \(\d+\)/);
  const owned = M.ALL_RECIPES.filter((r) => OWNED.has(r.brewer) && M.BREWER_TYPE_TO_ROLE.has(r.brewer));
  for (const r of owned) assert.ok(a.includes(`- ${r.name} — `), `${r.id} missing from the index`);
  assert.equal((a.match(/^- /gm) ?? []).length, owned.length);
  assert.match(a, /HOW MANY RECIPES A BREWER HAS IS NOT A RECOMMENDATION/);
});

test("brewerRecency counts offered AND brewed methods, newest first, and says who was never offered", () => {
  const s = (methods, brewed) => ({ id: "x", type: "coffee", mode: "home", createdAt: "2026-10-01T06:00:00Z", coffee: {}, recommendation: { candidates: methods.map((m) => ({ method: m, recipe: {}, role: "anchor", title: m, whyChosen: "", confidence: "high" })), reasoning: "", generatedAt: "" }, brew: brewed ? { methodUsed: brewed } : undefined });
  const r = M.brewerRecency([s(["V60", "Clever Dripper"], "V60"), s(["Orea Fast", "Kalita Wave"], "Orea Fast"), s(["V60", "Chemex"], "Chemex")]);
  assert.equal(r.lastOffered.get("v60"), 0);
  assert.equal(r.lastOffered.get("clever"), 0);
  assert.equal(r.lastOffered.get("orea-fast"), 1);
  assert.equal(r.lastOffered.get("chemex"), 2);
  assert.ok(r.notOffered.includes("moccamaster") && r.notOffered.includes("aeropress") && r.notOffered.includes("origami-wave"));
  assert.match(r.line, /BREWER RECENCY over your last 3 brews — information, not a rule/);
  assert.match(r.line, /not offered at all: [^\n]*Moccamaster/);
  assert.match(r.line, /V60 \(last brew\)/);
  assert.match(r.line, /Chemex \(3 brews ago\)/);
  assert.equal(M.brewerRecency([]).line, "");
});

test("the static YOUR BREWERS block names every role as an equal with its limit, and carries no preference rule", () => {
  const block = M.formatBrewerRolesBlock();
  for (const r of M.BREWER_ROLES) assert.ok(block.includes(`- ${r.method} — ${r.style}; ${r.role}.`), `${r.key} missing`);
  assert.match(block, /every one of them is on the table, equally/);
  assert.match(block, /Origami \(cone\) — [^\n]*Holds up to 350 ml/);
  assert.match(block, /Moccamaster — [^\n]*Holds 500–1000 ml/);
  assert.doesNotMatch(block, /primary|NEVER recommend|FORBIDDEN|avoid/i);
});
