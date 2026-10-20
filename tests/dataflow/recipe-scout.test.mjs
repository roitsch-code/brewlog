// The recipe scout's pure parts (scripts/recipe-scout.mjs, 2026-10-19): the
// gap table over the owner's kit, the quote re-check that is the whole
// no-fabrication guarantee, and the candidate → corpus-entry gate.
//
//   node --test tests/dataflow/recipe-scout.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const S = await import(pathToFileURL(path.join(ROOT, "scripts/recipe-scout.mjs")).href);
const out = path.join(ROOT, "node_modules/.cache/recipe-scout/bundle.mjs");
await build({
  stdin: {
    contents: `
export { ALL_RECIPES, SCOUTED_RECIPES } from ${JSON.stringify(path.join(ROOT, "src/lib/knowledge/recipes/index.ts"))};
export { BREWER_ROLES, brewerCap } from ${JSON.stringify(path.join(ROOT, "src/lib/knowledge/brewers.ts"))};
export { TECHNIQUES } from ${JSON.stringify(path.join(ROOT, "src/lib/knowledge/techniques/data.ts"))};
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
const K = await import(pathToFileURL(out).href);
const roles = K.BREWER_ROLES.map((r) => ({ ...r, cap: K.brewerCap(r.key) }));
const techniqueIds = new Set(K.TECHNIQUES.map((t) => t.id));

test("the gap table: every owned hot brewer × the amounts its vessel holds, emptiest first; the cold jar is not a target", () => {
  const table = S.gapTable(K.ALL_RECIPES, roles);
  assert.ok(table.length > 20);
  assert.ok(table.every((r) => r.role !== "cold-brew-jar"));
  assert.ok(!table.some((r) => r.role === "aeropress" && r.amount > 230), "no AeroPress target above its 230 ml");
  assert.ok(!table.some((r) => r.role === "moccamaster" && r.amount < 500), "no Moccamaster target under its 500 ml");
  assert.ok(!table.some((r) => r.role.startsWith("origami") && r.amount > 350), "the Origami Air S holds 350");
  for (let i = 1; i < table.length; i++) assert.ok(table[i - 1].count <= table[i].count, "sorted by how empty the cell is");
  const targets = S.pickTargets(table, 4, 0);
  assert.equal(targets.length, 4);
  assert.equal(new Set(targets.map((t) => t.role)).size, 4, "one target per brewer, so a week spreads over the kit");
  assert.equal(targets[0].count, table[0].count, "week 0 starts at the emptiest cell");
  const nextWeek = S.pickTargets(table, 4, 1);
  assert.notDeepEqual(nextWeek.map((t) => t.role), targets.map((t) => t.role), "another week starts elsewhere in the kit");
  for (const t of nextWeek) assert.equal(t.count, Math.min(...table.filter((r) => r.role === t.role).map((r) => r.count)), "still the emptiest cell of its brewer");
  assert.equal(S.isoWeek(new Date("2026-10-19T00:00:00Z")), 43);
});

test("the quote re-check: whitespace, case and quote style do not matter; a quote that is not on the page fails", () => {
  const page = S.htmlToText(`<html><body><h1>James&rsquo;s V60</h1><p>15g of coffee,&nbsp;250g of water at <b>96&deg;C</b>.<br>Total brew time: 3:00&ndash;3:15</p><script>x()</script></body></html>`);
  assert.ok(S.quoteFound(page, "15g of coffee, 250g of water"));
  assert.ok(S.quoteFound(page, "at 96°C"));
  assert.ok(S.quoteFound(page, "total brew time: 3:00–3:15"));
  assert.ok(S.quoteFound(page, "James's V60"), "curly apostrophe vs straight");
  assert.ok(!S.quoteFound(page, "30g of coffee"));
  assert.ok(!S.quoteFound(page, "x()"), "script bodies are not page text");
  assert.ok(!S.quoteFound(page, "15g"), "a quote has to be more than a token");
});

test("the number gate: a paraphrase with the page's numbers passes, a number the page does not carry fails, nothing numeric fails", () => {
  const page = S.htmlToText(`<p>Use 16 grams of coffee to 250 ml of water at 92&deg;C. Bloom with 50 g for 45 seconds, then pour to 150 g by 1:15 and to 250 g by 2:00. Total 2:45.</p>`);
  assert.deepEqual(S.numbersIn("Dose: 16g, water 250g at 92°C"), ["16", "250", "92"]);
  assert.ok(S.numbersSupported(page, "Dose: 16g, water 250g at 92°C"), "the numbers are on the page, the wording is not");
  assert.ok(S.quoteSupported(page, "Coffee – 16 grams"));
  assert.ok(!S.numbersSupported(page, "Dose: 18g"), "18 is not on the page");
  assert.ok(!S.numbersSupported(page, "pour to 25 g"), "25 is only inside 250 — not a token");
  assert.ok(S.numbersSupported(page, "finish at 2:45"), "2 and 45 as tokens");
  assert.ok(!S.numbersSupported(page, "a gentle pour"), "no number, no support");
  assert.ok(!S.quoteSupported(page, "a gentle pour"));
});

const target = { role: "v60", method: "V60", brewer: "v60", brewers: ["v60"], amount: 250, count: 3, techniqueIds };
const good = {
  name: "Test Author's Daily V60",
  author: { person: "Test Author", affiliation: "Test Roasters", year: 2025 },
  source: { url: "https://example.com/v60", type: "blog", citation: "Test Roasters — Daily V60" },
  brewer: "v60",
  dose: 15,
  water: 250,
  tempC: 94,
  totalTimeSec: 180,
  grind: { referenceGrinder: "Comandante C40", referenceSetting: "24 clicks", description: "medium-fine" },
  pours: [
    { label: "Bloom", action: "pour", waterGramsAtEnd: 50, durationSec: 10 },
    { label: "Rest", action: "wait", durationSec: 35 },
    { label: "Pour 2", action: "pour", waterGramsAtEnd: 150, durationSec: 20 },
    { label: "Pour 3", action: "pour", waterGramsAtEnd: 250, durationSec: 20 },
  ],
  techniques: ["bloom", "pulse-pouring", "not-a-technique"],
  bestFor: { roastLevels: ["light", "weird"], processes: ["washed"], goals: ["high-clarity"] },
  teaches: "A gentle three-pour V60.",
  science: "Pulse pours keep the bed calm.",
  whenToUse: "A quiet morning cup.",
  quotes: { dose: "15g", water: "250g", temp: "94°C", time: "3:00", pours: ["50g bloom"] },
};

test("the gate turns a verified candidate into a corpus entry: unverified, dated, no Niche number, techniques and tags filtered to the enums", () => {
  const r = S.toRecipeEntry(good, target, K.ALL_RECIPES, "2026-10-19T06:05:00.000Z");
  assert.ok(!("error" in r), r.error);
  const e = r.recipe;
  assert.equal(e.id, "scout-test-author-v60-250");
  assert.equal(e.shortName, "Author V60");
  assert.equal(e.category, "reference");
  assert.equal(e.verified, false);
  assert.equal(e.addedAt, "2026-10-19T06:05:00.000Z");
  assert.equal(e.water.ratio, "1:16.7");
  assert.equal(e.grind.nicheZeroDegrees, undefined, "never a Niche number from the scout");
  assert.deepEqual(e.techniques, ["bloom", "pulse-pouring"]);
  assert.deepEqual(e.bestFor.roastLevels, ["light"]);
  assert.equal(e.pourSequence.length, 4);
  assert.equal(e.pourSequence.at(-1).waterGramsAtEnd, 250);
  assert.equal(e.sources[0].url, "https://example.com/v60");
  assert.match(e.notes, /Unverified until a session cross-checks/);
});

test("the gate refuses: another brewer, a plan that misses the water, a firehose pour, a duplicate of the corpus", () => {
  assert.match(S.toRecipeEntry({ ...good, brewer: "chemex" }, target, [], "2026-10-19T00:00:00Z").error, /brewer "chemex"/);
  assert.match(S.toRecipeEntry({ ...good, pours: good.pours.slice(0, 3) }, target, [], "2026-10-19T00:00:00Z").error, /reaches 150 g, not the 250 g/);
  const fast = { ...good, pours: [{ label: "All", action: "pour", waterGramsAtEnd: 250, durationSec: 10 }] };
  assert.match(S.toRecipeEntry(fast, target, [], "2026-10-19T00:00:00Z").error, /> 12 g\/s/);
  const kasuya = K.ALL_RECIPES.find((r) => r.id === "kasuya-4-6-standard");
  const dup = { ...good, name: "Another name", author: { person: kasuya.attribution.person }, water: kasuya.water.grams, dose: 20, pours: [{ label: "All", action: "pour", waterGramsAtEnd: kasuya.water.grams, durationSec: 60 }] };
  assert.match(S.toRecipeEntry(dup, { ...target, amount: 300 }, K.ALL_RECIPES, "2026-10-19T00:00:00Z").error, /already has/);
  assert.match(S.toRecipeEntry({ ...good, source: {} }, target, [], "2026-10-19T00:00:00Z").error, /missing author, name or url/);
});

test("the written file round-trips through the corpus: SCOUTED_RECIPES is in ALL_RECIPES, the validator knows addedAt", async () => {
  const text = S.renderScoutedFile([S.toRecipeEntry(good, target, [], "2026-10-19T00:00:00.000Z").recipe]);
  assert.match(text, /^\/\/ GENERATED by scripts\/recipe-scout\.mjs/);
  assert.match(text, /export const SCOUTED_RECIPES: Recipe\[\] = \[\n/);
  assert.ok(Array.isArray(K.SCOUTED_RECIPES));
  const helpers = await readFile(path.join(ROOT, "src/lib/knowledge/recipes/helpers.ts"), "utf8");
  assert.match(helpers, /\.\.\.SCOUTED_RECIPES,\n(?:  \.\.\.GOTA_RECIPES,\n)?\];/);
  const validate = await readFile(path.join(ROOT, "tests/recipes/validate.mjs"), "utf8");
  assert.match(validate, /still unverified — cross-check it against the originator/);
  const wf = await readFile(path.join(ROOT, ".github/workflows/recipe-scout.yml"), "utf8");
  assert.match(wf, /GH_PAT: \$\{\{ secrets\.GH_PAT \}\}/, "the PAT reaches the script for the push that fires the deploy");
  const script = await readFile(path.join(ROOT, "scripts/recipe-scout.mjs"), "utf8");
  assert.match(script, /GIT_CONFIG_KEY_0: "http\.https:\/\/github\.com\/\.extraheader"/, "the PAT travels as a header, never on a command line");
  assert.match(wf, /cron: "5 6 \* \* 1"/);
  assert.match(wf, /\.github\/recipe-scout-trigger/, "a branch run before the workflow is merged");
});

test("the pour plan must be backed step by step: an invented pour, an unbacked milestone, or a water only in a 'total' line is refused", () => {
  const ok = { ...good, quotes: { ...good.quotes, pours: ["Pour the initial 50ml to bloom", "After 40 seconds pour to 150g", "then pour to 250g"] } };
  assert.deepEqual(S.pourPlanProblems(ok), []);
  const byIncrement = { ...ok, quotes: { ...ok.quotes, pours: ["50ml bloom", "then 100ml", "then another 100ml"] } };
  assert.deepEqual(S.pourPlanProblems(byIncrement), [], "an increment backs a milestone too");
  // The third run's case: the page says 50 – 250, the header says 300ml, the model added a pour to 300.
  const invented = {
    ...ok,
    water: 300,
    pours: [...ok.pours, { label: "Final pour", action: "pour", waterGramsAtEnd: 300, durationSec: 30, notes: "Inferred from the header total — not individually narrated." }],
    quotes: { ...ok.quotes, water: "Total amount: 300ml", pours: [...ok.quotes.pours, "Total amount: 300ml"] },
  };
  const problems = S.pourPlanProblems(invented);
  assert.ok(problems.some((p) => /marked inferred/.test(p)), problems.join(" | "));
  const unbacked = { ...ok, quotes: { ...ok.quotes, pours: ["50ml bloom", "a slow pour", "to the end"] } };
  assert.ok(S.pourPlanProblems(unbacked).some((p) => /no pour quote carrying 150 or 100/.test(p)));
  const totalOnly = { ...ok, pours: ok.pours.slice(0, 3), water: 250, quotes: { ...ok.quotes, pours: ["50ml bloom", "pour to 150g"] } };
  assert.ok(S.pourPlanProblems(totalOnly).some((p) => /not reached by any quoted pour/.test(p)));
});

test("the candidate's quotes are flattened in a fixed order so a missing one names itself", () => {
  const q = S.candidateQuotes(good);
  assert.deepEqual(q.map((x) => x.key), ["dose", "water", "temp", "time", "pour1"]);
  assert.deepEqual(S.candidateQuotes({}), []);
});
