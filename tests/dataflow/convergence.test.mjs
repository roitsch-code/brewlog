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

test("converge check: exactly one changed dial passes; zero and two fail; another brewer fails", () => {
  const st = C.deriveConvergence([S_1001]);
  const cand = (recipe, experiment = "2°C cooler to soften the sharpness") => ({ method: "V60", basedOn: st.base.name, experiment, recipe });

  // one dial — temperature
  assert.equal(C.checkConvergence(st, cand({ ...RAO_RECIPE, waterTempC: 95 })), null);
  // one dial — grind
  assert.equal(C.checkConvergence(st, cand({ ...RAO_RECIPE, grindSize: "384°" })), null);
  // one dial — ratio (dose moves, water held)
  assert.equal(C.checkConvergence(st, cand({ ...RAO_RECIPE, doseGrams: 23 })), null);
  // one dial — pour plan (an extra pulse)
  const morePours = {
    ...RAO_RECIPE,
    pourSteps: [
      ...RAO_RECIPE.pourSteps.slice(0, 4),
      { label: "Pour 3", action: "pour", waterGramsAtEnd: 280, durationSec: 20 },
      ...RAO_RECIPE.pourSteps.slice(4),
    ],
  };
  assert.equal(C.checkConvergence(st, cand(morePours)), null);
  // scaled to today's bigger batch at the same ratio is NOT a change
  const scaled = { ...RAO_RECIPE, doseGrams: 28, waterGrams: 448, pourSteps: RAO_RECIPE.pourSteps.map((p) => (p.waterGramsAtEnd ? { ...p, waterGramsAtEnd: Math.round(p.waterGramsAtEnd * 448 / 352) } : p)) };
  assert.equal(C.checkConvergence(st, cand({ ...scaled, waterTempC: 95 })), null);

  // zero dials, nothing named → violation
  const zero = C.checkConvergence(st, cand(RAO_RECIPE, ""));
  assert.ok(zero && /no change named/.test(zero.reason));
  // zero numeric dials but the water source is the named change → accepted
  assert.equal(C.checkConvergence(st, cand(RAO_RECIPE, "switch to the ~73 ppm clarity blend water")), null);
  // two dials → violation naming both
  const two = C.checkConvergence(st, cand({ ...RAO_RECIPE, waterTempC: 94, grindSize: "390°" }));
  assert.ok(two && two.changed.includes("temperature") && two.changed.includes("grind"), JSON.stringify(two));
  // another brewer → violation
  const other = C.checkConvergence(st, { method: "Clever Dripper", basedOn: "Hoffmann Ultimate Clever", recipe: RAO_RECIPE, experiment: "" });
  assert.ok(other && other.changed.includes("brewer"));
});

test("diverge check: same brewer + same reference fails; a different brewer or reference passes", () => {
  const st = C.deriveConvergence([S_1003]);
  const again = C.checkConvergence(st, { method: "V60", basedOn: "Gagné — V60 Trench + Rao-Spin", recipe: RAO_RECIPE });
  assert.ok(again && /re-serves/.test(again.reason));
  assert.equal(C.checkConvergence(st, { method: "V60", basedOn: "Kasuya 4:6 Method — Standard", recipe: RAO_RECIPE }), null);
  assert.equal(C.checkConvergence(st, { method: "Orea Classic", basedOn: "Easy Does It — Orea Wide Classic", recipe: RAO_RECIPE }), null);
  // two "Own experiment"s on the same brewer cannot be told apart → fails
  const ownLast = session("2026-10-03T08:56:00Z", 3, "Clever Dripper", "Own experiment");
  const st2 = C.deriveConvergence([ownLast]);
  assert.ok(C.checkConvergence(st2, { method: "Clever Dripper", basedOn: "Own experiment", recipe: RAO_RECIPE }));
});

test("the prompt block carries the base numbers, the exact basedOn and the one-change rule; the slot is always appended", () => {
  const slot = " THE SECOND CANDIDATE IS THE EXPLORATION SLOT.";
  const conv = C.formatConvergenceNote(C.deriveConvergence([S_1001]), { explorationSlot: slot, targetWaterGrams: 352 });
  assert.match(conv, /LAST BREW OF THIS COFFEE WORKED \(4★/);
  assert.match(conv, /22g : 352g \(1:16\.0\) at 97°C · grind 378° · clock 3:30/);
  assert.match(conv, /EXACTLY ONE CHANGE/);
  assert.match(conv, /basedOn EXACTLY to "Your V60 — Santa Domenica Beshasha \(2026-10-01\)"/);
  assert.match(conv, /overrides RECENTLY RECOMMENDED, METHOD FIT & FRESHNESS and PORTFOLIO DIVERSITY/);
  assert.ok(conv.endsWith(slot));
  assert.doesNotMatch(conv, /asked for 352g today/);
  const scaledNote = C.formatConvergenceNote(C.deriveConvergence([S_1001]), { explorationSlot: slot, targetWaterGrams: 450 });
  assert.match(scaledNote, /asked for 450g today .* SAME ratio/);

  const div = C.formatConvergenceNote(C.deriveConvergence([S_1003]), { explorationSlot: slot });
  assert.match(div, /LAST BREW OF THIS COFFEE MISSED \(3★/);
  assert.match(div, /NOT a baseline/);
  assert.ok(div.endsWith(slot));
  assert.ok(C.formatConvergenceNote({ kind: "first" }, { explorationSlot: slot }).endsWith(slot));
  assert.ok(C.formatConvergenceNote({ kind: "unrated", count: 2 }, { explorationSlot: slot }).endsWith(slot));
});

test("recommend.ts is wired: derives the state, builds the arc from it, checks candidate 1, protects the base from the recency levers", async () => {
  const src = await readFile(path.join(ROOT, "src/lib/claude/recommend.ts"), "utf8");
  assert.match(src, /from "\.\/convergence"/, "must import the module");
  assert.match(src, /deriveConvergence\(sessionsForThisCoffee\)/, "must derive the state from THIS coffee's sessions");
  assert.match(src, /const sessionArcNote = formatConvergenceNote\(convergence,/, "the arc text must come from the state");
  assert.match(src, /explorationSlot:\s*EXPLORATION_SLOT/, "the exploration slot is always on");
  assert.match(src, /checkConvergence\(convergence, raw\.candidates\[0\]\)/, "candidate 1 must be checked");
  assert.match(src, /repairs\.push\(formatConvergenceRepair\(convergence, violation\)\)/, "the convergence repair joins the single merged repair call");
  assert.doesNotMatch(src, /callRecommendModel\(\s*userMessage \+ formatConvergenceRepair/, "no standalone convergence-repair call");
  assert.match(src, /recentReferenceNames\(pastSessions\)\.filter\(\(n\) => !isProtectedName\(n\)\)/, "the base's names are exempt from recent-reference demotion");
  assert.match(src, /demoteBrewers:\s*freshnessBrewers/, "the base's brewer is exempt from menu demotion");
  assert.match(src, /convergeBase \? \[\.\.\.ownReferenceNamesForTurn, convergeBase\.name\]/, "the base name counts as a menu name (repeat guard + binding)");
  // The count-based arc is gone.
  assert.doesNotMatch(src, /Don't recycle what worked; push the boundary/);
  assert.doesNotMatch(src, /Expert territory\. Find the ceiling/);
});
