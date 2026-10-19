// Convergence policy (2026-10-03) — the rating of the LAST brew of a coffee
// decides the first candidate. Anchored on the real production sequence the
// outcome ledger exposed: Beshasha 4★, 4★, 4★ on three different recipes, then
// 3★ on a fourth — brewer, temperature and grind all moved on every brew, so no
// cup could be attributed to anything.
//
// Asserts (1) a ≥4★ last brew → CONVERGE on it, <4★ → DIVERGE, (2) the check
// accepts exactly one changed dial and rejects zero or two, (3) the diverge
// check rejects re-serving the missed brew's brewer+reference, (4) the prompt
// block carries the base numbers and the exact basedOn name, and (5) the policy
// is wired into recommend.ts — a producer-only test is what let #530/#535 ship
// unwired.
//
//   node --test tests/dataflow/convergence.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const dir = await mkdtemp(join(tmpdir(), "convergence-"));
const out = join(dir, "b.mjs");
await build({
  stdin: {
    contents: `export * from ${JSON.stringify(path.join(ROOT, "src/lib/claude/convergence.ts"))};`,
    resolveDir: ROOT,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const C = await import(pathToFileURL(out).href);

// The real 2026-10-01 Beshasha brew (recommend-logs run 37139068766): V60,
// Rao Vortex, 22g:352g at 97°C, 378°, rated 4★.
const RAO_RECIPE = {
  doseGrams: 22,
  waterGrams: 352,
  waterTempC: 97,
  grindSize: "378°",
  targetTimeSec: 210,
  pourSteps: [
    { label: "Bloom", action: "bloom", waterGramsAtEnd: 50, durationSec: 10 },
    { label: "Swirl", action: "swirl", durationSec: 5 },
    { label: "Rest", action: "wait", durationSec: 35 },
    { label: "Pour 2", action: "pour", waterGramsAtEnd: 200, durationSec: 25 },
    { label: "Spin", action: "swirl", durationSec: 3 },
    { label: "Rest", action: "wait", durationSec: 10 },
    { label: "Final pour", action: "final", waterGramsAtEnd: 352, durationSec: 25 },
    { label: "Settle swirl", action: "swirl", durationSec: 5 },
  ],
};

const session = (iso, rating, method, basedOn, recipe = RAO_RECIPE, extra = {}) => ({
  id: iso,
  type: "coffee",
  mode: "home",
  createdAt: iso,
  createdAtMs: Date.parse(iso),
  coffee: { roaster: "Santa Domenica", name: "Beshasha", origin: "Ethiopia", process: "Washed", roastLevel: "Light", aiExtracted: false },
  context: { occasion: "morning-ritual", amount: "small", timeAvailable: "normal", moodPreference: "balanced", waterSource: "tap" },
  recommendation: {
    primaryMethod: method,
    primaryRecipe: recipe,
    candidates: [{ method, role: "anchor", title: `${method} brew`, basedOn, recipe, whyChosen: "", confidence: "high" }],
    reasoning: "",
  },
  brew: { methodUsed: method, selectedCandidateIdx: 0, actualTimeSec: 203, grindSettingUsed: recipe.grindSize, actualTempC: recipe.waterTempC, ...extra },
  result: { rating, flavorNotes: ["citrus"], body: "medium", acidity: "bright", freeNotes: "nice cup, a touch sharp" },
});

const S_0929 = session("2026-09-29T05:31:00Z", 4, "Orea Classic", "Easy Does It — Orea Wide Classic — OREA", { ...RAO_RECIPE, doseGrams: 25, waterGrams: 400, waterTempC: 95, grindSize: "398°" });
const S_1001 = session("2026-10-01T06:07:00Z", 4, "V60", "Rao Vortex V60 (Spin-Driven) — Scott Rao");
const S_1003 = session("2026-10-03T08:56:00Z", 3, "V60", "Gagné — V60 Trench + Rao-Spin — Jonathan Gagné", { ...RAO_RECIPE, doseGrams: 26, waterGrams: 400, waterTempC: 96, grindSize: "395°" });

test("no prior brew → first-brew arc; unrated last brew → unrated", () => {
  assert.equal(C.deriveConvergence([]).kind, "first");
  const unrated = { ...S_1001, result: undefined };
  assert.equal(C.deriveConvergence([unrated]).kind, "unrated");
});

test("last brew 4★ → CONVERGE on it (newest by time, not array order)", () => {
  const st = C.deriveConvergence([S_0929, S_1001]);
  assert.equal(st.kind, "converge");
  assert.equal(st.base.method, "V60");
  assert.equal(st.base.rating, 4);
  assert.equal(st.base.name, "Your V60 — Santa Domenica Beshasha (2026-10-01)");
  assert.equal(st.base.recipe.grindSize, "378°");
  // Array order must not matter — the latest brew decides.
  assert.equal(C.deriveConvergence([S_1001, S_0929]).base.method, "V60");
});

test("the logged grind/temperature override the recipe numbers in the base", () => {
  const changed = session("2026-10-01T06:07:00Z", 4.5, "V60", "Rao Vortex V60", RAO_RECIPE, { grindSettingUsed: "385°", actualTempC: 94 });
  const st = C.deriveConvergence([changed]);
  assert.equal(st.kind, "converge");
  assert.equal(st.base.recipe.grindSize, "385°");
  assert.equal(st.base.recipe.waterTempC, 94);
});

test("last brew 3★ → DIVERGE (the real 10-03 Beshasha sequence)", () => {
  const st = C.deriveConvergence([S_0929, S_1001, S_1003]);
  assert.equal(st.kind, "diverge");
  assert.equal(st.last.rating, 3);
  assert.equal(st.last.method, "V60");
  assert.equal(st.count, 3);
});

// 2026-10-19: the convergence RULE ("exactly one change", the check, the
// repair) is gone — the owner's history is information the model weighs. The
// block describes the last brew and names both honest answers.
test("the information block carries the base numbers, the quotable basedOn and BOTH honest answers — no rule", () => {
  const conv = C.formatConvergenceInfo(C.deriveConvergence([S_1001]), { targetWaterGrams: 352 });
  assert.match(conv, /THIS COFFEE'S LAST BREW WORKED \(4★/);
  assert.match(conv, /22g : 352g \(1:16\.0\) at 97°C · grind 378° · clock 3:30/);
  assert.match(conv, /basedOn "Your V60 — Santa Domenica Beshasha \(2026-10-01\)"/);
  assert.match(conv, /Two honest answers/);
  assert.match(conv, /Your call/);
  assert.doesNotMatch(conv, /EXACTLY ONE CHANGE|RULE|overrides|must/i);
  assert.doesNotMatch(conv, /asked for 352 g today/);
  const scaledNote = C.formatConvergenceInfo(C.deriveConvergence([S_1001]), { targetWaterGrams: 450 });
  assert.match(scaledNote, /asked for 450 g .* keeps the ratio and the pour count/);
  // Comandante: the grinds in the block come in clicks.
  const clicks = C.formatConvergenceInfo(C.deriveConvergence([S_1001]), { targetWaterGrams: 352, grinder: "Comandante C40" });
  assert.match(clicks, /grind 22 clicks \(extrapolated\)/);
  assert.doesNotMatch(clicks, /378°/);

  const div = C.formatConvergenceInfo(C.deriveConvergence([S_1003]), {});
  assert.match(div, /THIS COFFEE'S LAST BREW MISSED \(3★/);
  assert.match(div, /Two honest answers/);
  assert.doesNotMatch(div, /NOT a baseline|must/);
  assert.match(C.formatConvergenceInfo({ kind: "first" }), /first brew of this bag/);
  assert.match(C.formatConvergenceInfo({ kind: "unrated", count: 2 }), /brew 3 of this bag/);
});

test("recommend.ts is wired: derives the state, builds the information block from it, and checks nothing", async () => {
  const src = await readFile(path.join(ROOT, "src/lib/claude/recommend.ts"), "utf8");
  assert.match(src, /from "\.\/convergence"/, "must import the module");
  assert.match(src, /deriveConvergence\(sessionsForThisCoffee\)/, "must derive the state from THIS coffee's sessions");
  assert.match(src, /const sessionArcNote = formatConvergenceInfo\(convergence,/, "the block text must come from the state");
  assert.match(src, /\+ EXPLORATION_SLOT/, "the exploration slot is always on");
  assert.doesNotMatch(src, /checkConvergence|formatConvergenceRepair|isProtectedName|freshnessBrewers|demoteBrewers/, "no rule, no repair, no demotion");
  assert.match(src, /convergeBase \? \[\.\.\.ownReferenceNamesForTurn, convergeBase\.name\]/, "the base name counts as a menu name (binding log)");
  assert.doesNotMatch(src, /Don't recycle what worked; push the boundary/);
  assert.doesNotMatch(src, /Expert territory\. Find the ceiling/);
});

test("grind audit: the dose law moves 'same grind' with the batch on a V60 only", () => {
  // V60 base 352 g → 448 g: the grind must move +7° (the measured law).
  const v60 = C.changedDials(RAO_RECIPE, { ...RAO_RECIPE, doseGrams: 28, waterGrams: 448, grindSize: "378°" }, "V60");
  assert.ok(v60.includes("grind"), "a V60 batch change with an unmoved grind is a grind change");
  // Same numbers on a Chemex: the batch effect is unmeasured — never counted.
  const chemex = C.changedDials(RAO_RECIPE, { ...RAO_RECIPE, doseGrams: 28, waterGrams: 448, grindSize: "378°" }, "Chemex");
  assert.ok(!chemex.includes("grind"), JSON.stringify(chemex));
  assert.equal(C.doseLawApplies("V60"), true);
  assert.equal(C.doseLawApplies("Chemex"), false);
});
