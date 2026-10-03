// Speed round, 2026-10-03: the chat no longer carries the full 147-recipe
// corpus (~172k chars, ~43k tokens, cached, every turn). It carries a one-line
// INDEX (cached), the full text of today's angles for the bags on the counter
// (per turn), and a `lookup_recipe` tool for everything else.
//
//   node --test tests/dataflow/chat-recipe-lookup.test.mjs
//
// Pins the matcher, the index, the shortlist, the size of the cached prefix,
// and — per the hard rule — the CONSUMERS: the route dispatches the tool, the
// tool is defined and ordered safely, the prompt tells the model to call it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const entry = `
export { lookupRecipe, matchRecipesByName, recipeIndexLine } from ${JSON.stringify(path.join(ROOT, "src/lib/chat/recipeLookup.ts"))};
export { recipeLibraryBlock, buildRecipeShortlist } from ${JSON.stringify(path.join(ROOT, "src/lib/chat/agentContext.ts"))};
export { AGENT_SYSTEM_PROMPT, TOOLS } from ${JSON.stringify(path.join(ROOT, "src/lib/chat/agentPrompt.ts"))};
export { ALL_RECIPES } from ${JSON.stringify(path.join(ROOT, "src/lib/knowledge/recipes/index.ts"))};
`;
const dir = await mkdtemp(join(tmpdir(), "lookup-"));
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

const ROTATION = [
  { id: "friedhats__guji", roaster: "Friedhats", name: "Guji", origin: "Ethiopia", process: "Natural", sessionCount: 1, inRotation: true },
  { id: "cloud_picker__kiriga", roaster: "Cloud Picker", name: "Kiriga", origin: "Kenya", process: "Washed", variety: "SL28", sessionCount: 2, inRotation: true },
];
const NAMES = new Set(M.ALL_RECIPES.map((r) => r.name));
// Recipe names themselves contain " — " ("Hoffmann V60 — Better 1 Cup"), so a
// line is attributed by the longest corpus name it starts with, never by split.
const ALL_NAMES = [...NAMES].sort((a, b) => b.length - a.length);
const nameAtStart = (text) => ALL_NAMES.find((n) => text.startsWith(n + " — ") || text === n);

test("matcher: exact name → full text; a person or a brewer → an index of names; nonsense → a pointer back to the index", () => {
  const kasuya = M.lookupRecipe("Kasuya 4:6");
  assert.equal(kasuya.kind, "full");
  assert.match(kasuya.text, /▸ .*Kasuya/);
  assert.match(kasuya.text, /Sequence:/);

  const hoffmann = M.lookupRecipe("Hoffmann");
  assert.equal(hoffmann.kind, "index");
  assert.ok(hoffmann.matches > 3);
  for (const line of hoffmann.text.split("\n").filter((l) => l.startsWith("- "))) {
    assert.ok(nameAtStart(line.slice(2)), `"${line}" does not start with a corpus name`);
  }

  const v60 = M.lookupRecipe("V60");
  assert.equal(v60.kind, "index", "a brewer id is the whole group, not one recipe whose shortName is the same word");
  assert.ok(v60.matches > 20);
  assert.equal(M.lookupRecipe("orea-classic").matches, 2);

  const none = M.lookupRecipe("xyzzy plugh");
  assert.equal(none.kind, "none");
  assert.match(none.text, /No recipe matches/);
  assert.match(none.text, /Do not reconstruct a recipe from memory/);
});

test("index: every recipe exactly once, one line each, headline numbers but no pour sequence; small", () => {
  const idx = M.recipeLibraryBlock();
  assert.ok(idx.length > 8_000 && idx.length < 40_000, `index is ${idx.length} chars`);
  for (const r of M.ALL_RECIPES) {
    const n = idx.split(`- ${r.name} — `).length - 1;
    assert.equal(n, 1, `"${r.name}" appears ${n} times`);
  }
  assert.doesNotMatch(idx, /Sequence:/, "an index line must not carry pours");
  assert.match(idx, /HOW MANY RECIPES A BREWER HAS IS NOT A RECOMMENDATION/);
  assert.match(idx, /lookup_recipe/);
});

test("shortlist: today's angles followed by the FULL text of exactly those recipes; rotates by day; empty off-rotation", () => {
  const block = M.buildRecipeShortlist(ROTATION, 20_000);
  assert.match(block, /Today's angles/);
  assert.match(block, /SHORTLIST — full text/);
  const full = (block.match(/^▸ /gm) ?? []).length;
  assert.ok(full >= 2 && full <= 9, `${full} full recipes`);
  assert.match(block, /Sequence:/);
  // Each full entry is one of the named angles.
  const angleNames = new Set();
  for (const line of block.split("\n").filter((l) => l.startsWith("- "))) {
    for (const angle of line.slice(line.indexOf(":") + 1).split(" · ")) {
      const name = angle.split(" [")[0].trim();
      if (name) angleNames.add(name);
    }
  }
  for (const line of block.split("\n").filter((l) => l.startsWith("▸ "))) {
    const name = nameAtStart(line.slice(2));
    assert.ok(name, `"${line}" does not start with a corpus name`);
    assert.ok(angleNames.has(name), `full text for "${name}" which no angle named`);
  }
  const days = new Set();
  for (let d = 0; d < 14; d++) days.add(M.buildRecipeShortlist(ROTATION, 20_000 + d));
  assert.ok(days.size >= 3);
  assert.equal(M.buildRecipeShortlist([], 20_000), "");
});

test("the cached chat prefix dropped from ~207k to under 60k chars (prompt + index)", () => {
  const prefix = M.AGENT_SYSTEM_PROMPT.length + M.recipeLibraryBlock().length;
  assert.ok(prefix < 60_000, `prefix is ${prefix} chars`);
});

test("CONSUMERS: the tool exists and sits before suggest_navigation; the route dispatches it; the prompt tells the model to call it", async () => {
  const names = M.TOOLS.map((t) => t.name);
  assert.ok(names.includes("lookup_recipe"));
  assert.ok(names.indexOf("lookup_recipe") < names.indexOf("suggest_navigation"));
  assert.ok(names.indexOf("start_brew") < names.indexOf("remember_advice"), "chat-brew-target slices between these two");
  const tool = M.TOOLS.find((t) => t.name === "lookup_recipe");
  assert.deepEqual(tool.input_schema.required, ["query"]);

  const route = await readFile(path.join(ROOT, "src/app/api/explore-agent/route.ts"), "utf8");
  assert.match(route, /block\.name === "lookup_recipe"/);
  assert.match(route, /lookupRecipe\(input\.data\.query\)/);
  assert.match(route, /text: recipeLibraryBlock\(\), cache_control/);
  assert.match(route, /buildRecipeShortlist\(rotationCoffees, daySeedFor\(Date\.now\(\)\)\)/);
  assert.doesNotMatch(route, /buildTodaysAngles\(/, "the angles arrive through the shortlist now");

  const prompt = M.AGENT_SYSTEM_PROMPT;
  assert.match(prompt, /\*\*lookup_recipe\*\*/, "listed among the tools");
  assert.match(prompt, /lookup_recipe before/i, "the rule: fetch before quoting");
  assert.doesNotMatch(prompt, /"Reference Recipe Library" below/);
});
