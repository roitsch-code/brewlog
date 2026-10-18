// 2026-10-18 — three owner reports in one test file:
//   1. "Ten Pour Recipe by Kasuya" / "KEIN Clever" typed on the Context step
//      must actually steer /recommend (userRequest.ts).
//   2. Going Back and asking again must never serve the same recipes
//      (shownGuard.ts + flowStore shownCandidates).
//   3. A 750 ml Chemex came back at 400° and drained 141 s over plan
//      (grindSettings.ts CHEMEX floor, chemexGrindFloor.ts, convergence grind).
//
// Per the hard rule, the end-to-end tests run the REAL generateRecommendation
// with only the model call stubbed: they read the user message the model would
// receive (the value must ARRIVE, not merely be built) and the candidates that
// come out of the full guard chain.
//
//   node --test tests/dataflow/user-request-and-reshow.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const dir = await mkdtemp(join(tmpdir(), "ureq-"));

// The model stub: records every user message, answers from a queue.
const STUB = `
export const calls = [];
export const queue = [];
export async function callRecommendModel(userMessage) {
  calls.push(userMessage);
  const next = queue.length ? queue.shift() : { candidates: [] };
  return { text: JSON.stringify(next), usage: { input_tokens: 1, output_tokens: 1 }, provider: "anthropic" };
}
`;

const entry = `
export { generateRecommendation } from ${JSON.stringify(path.join(ROOT, "src/lib/claude/recommend.ts"))};
export * as stub from "recommend-stub";
export { resolveRecipeMention, resolveUserRequest, validateParsed, fallbackRequest, applyUserParams, formatUserRequestBlock } from ${JSON.stringify(path.join(ROOT, "src/lib/claude/userRequest.ts"))};
export { findReshown, parseShownCandidates } from ${JSON.stringify(path.join(ROOT, "src/lib/claude/shownGuard.ts"))};
export { resolveReference } from ${JSON.stringify(path.join(ROOT, "src/lib/claude/recipeFidelity.ts"))};
export { selectRecipes, brewersAvailableFromEquipment, CANONICAL_EQUIPMENT } from ${JSON.stringify(path.join(ROOT, "src/lib/knowledge/recipes/index.ts"))};
export { batchGrindDeltaDeg, NICHE_DEG_PER_DOUBLING } from ${JSON.stringify(path.join(ROOT, "src/lib/constants/grindSettings.ts"))};
export { GRIND_DEG_PER_DOUBLING } from ${JSON.stringify(path.join(ROOT, "src/lib/recipe/scaleRecipe.ts"))};
export { measuredChemexAtBatch, slowestFloorDeg, findTooFineChemex } from ${JSON.stringify(path.join(ROOT, "src/lib/claude/measuredChemex.ts"))};
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
  plugins: [
    {
      name: "stub-model",
      setup(b) {
        b.onResolve({ filter: /recommendProvider$|^recommend-stub$/ }, () => ({ path: "recommend-stub", namespace: "stub" }));
        b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: STUB, loader: "js" }));
      },
    },
  ],
});
const M = await import(pathToFileURL(out).href);

// ── fixtures ────────────────────────────────────────────────────────────────
const COFFEE = { roaster: "Sprout", name: "Vizinhos", origin: "Brazil", process: "Natural", roastLevel: "Light", aiExtracted: false };
const PREFS = { equipment: ["V60", "Chemex", "CleverDripper"], grinder: "Niche Zero", tasteProfile: { preferredBodyLevel: "medium", preferredAcidityLevel: "medium" } };
const ctx = (extra = {}) => ({ occasion: "morning-ritual", amount: "big", timeAvailable: "normal", moodPreference: "balanced", intent: "balanced", grinder: "Niche Zero", ...extra });

const pours = (water, n = 3) => {
  const steps = [{ label: "Bloom", action: "bloom", waterGramsAtEnd: Math.round(water * 0.15), durationSec: 10 }, { label: "Wait", action: "wait", durationSec: 30 }];
  for (let i = 1; i <= n; i++) {
    steps.push({ label: `Pour ${i}`, action: i === n ? "final" : "pour", waterGramsAtEnd: Math.round(water * (0.15 + (0.85 * i) / n)), durationSec: 20 });
    if (i < n) steps.push({ label: "Wait", action: "wait", durationSec: 20 });
  }
  return steps;
};
const cand = (title, method, basedOn, water = 450, grind = "390°", extra = {}) => ({
  method, role: "anchor", title, basedOn, whyChosen: "fit", confidence: "high", experiment: title,
  recipe: { doseGrams: Math.round(water / 15), waterGrams: water, waterTempC: 94, grindSize: grind, targetTimeSec: 240, pourSteps: pours(water) },
  ...extra,
});

async function run(context, opts, ...answers) {
  M.stub.calls.length = 0;
  M.stub.queue.length = 0;
  M.stub.queue.push(...answers);
  const res = await M.generateRecommendation(COFFEE, context, PREFS, [], undefined, undefined, undefined, undefined, opts);
  return { rec: res.recommendation, calls: M.stub.calls.slice(), usage: res.usage };
}

// ── 1. recipe resolution ────────────────────────────────────────────────────
test("free-text recipe names resolve deterministically against the corpus", () => {
  assert.equal(M.resolveRecipeMention("Ten Pour Recipe by Kasuya")?.id, "kasuya-super-coarse-10-pour");
  assert.equal(M.resolveRecipeMention("Kasuya zehn pour")?.id, "kasuya-super-coarse-10-pour");
  assert.equal(M.resolveRecipeMention("Kasuya 4:6")?.id, "wbrc-2016-kasuya");
  assert.equal(M.resolveRecipeMention("Hoffmann Chemex")?.id, "chemex-hoffmann");
  assert.equal(M.resolveRecipeMention("Tales Coffee house recipe"), null, "not in the library → unresolved, never guessed");
});

test("parser output is validated: unknown brewers dropped, numbers range-checked", () => {
  const p = M.validateParsed("x", {
    recipeMentions: ["Ten Pour Recipe by Kasuya"],
    excludeBrewers: ["clever dripper", "Toaster"],
    requireBrewer: "Hario Switch",
    params: { tempC: 92, doseG: 900, grind: "420°" },
    otherInstructions: "sweet",
  });
  assert.deepEqual(p.excludeBrewers, ["Clever Dripper"]);
  assert.equal(p.requireBrewer, undefined);
  assert.deepEqual(p.params, { tempC: 92, grind: "420°" });
  const r = M.resolveUserRequest(p, 450);
  assert.ok(r.excludedBrewerTypes.has("clever"));
  assert.equal(r.recipe?.id, "kasuya-super-coarse-10-pour");
  assert.equal(M.validateParsed("x", "nope"), null);
});

test("the user's numbers are written onto the recipe; ratio sets the dose", () => {
  const base = { doseGrams: 30, waterGrams: 450, waterTempC: 96, grindSize: "400°", targetTimeSec: 240 };
  const a = M.applyUserParams(base, { tempC: 92, grind: "420" });
  assert.equal(a.recipe.waterTempC, 92);
  assert.equal(a.recipe.grindSize, "420°");
  assert.equal(M.applyUserParams(base, { ratio: 16 }).recipe.doseGrams, 28);
});

// ── 2. shown guard ──────────────────────────────────────────────────────────
test("a shown reference is off the menu; the requested one stays", () => {
  const base = {
    brewersAvailable: M.brewersAvailableFromEquipment(M.CANONICAL_EQUIPMENT),
    lockedBrewers: new Set(["v60"]),
    maxWaterMl: 300,
    occasion: "morning-ritual",
  };
  const menu = M.selectRecipes(base, 30).map((s) => s.recipe.id);
  assert.ok(menu.includes("kasuya-4-6-standard"), "fixture: the 4:6 is on a 300 g V60 menu");
  const without = M.selectRecipes({ ...base, excludeRecipeIds: new Set(["kasuya-4-6-standard"]) }, 30).map((s) => s.recipe.id);
  assert.ok(!without.includes("kasuya-4-6-standard"));
  assert.equal(without.length, menu.length - 1);
});

test("findReshown: same reference, or same brewer + same title, is an offender; an explicit request is not", () => {
  const shown = [{ title: "Freeform big batch", method: "Chemex", basedOn: "Freeform — Chemex 6-Cup" }, { title: "Clever water-first", method: "Clever Dripper", basedOn: "Own experiment" }];
  const off = M.findReshown(
    [
      { title: "A new name", method: "Chemex", basedOn: "Freeform Chemex" },
      { title: "Clever water-first", method: "Clever Dripper", basedOn: "Own experiment" },
      { title: "Something else", method: "V60", basedOn: "Kasuya 4:6" },
    ],
    shown,
    M.resolveReference,
  );
  assert.deepEqual(off.map((o) => o.index), [0, 1]);
  const ref = M.resolveReference("Freeform Chemex");
  assert.equal(M.findReshown([{ title: "x", method: "Chemex", basedOn: "Freeform Chemex" }], shown, M.resolveReference, new Set([ref.id])).length, 0);
  assert.deepEqual(M.parseShownCandidates([{ title: "t", method: "V60" }, 3, null, { basedOn: 5 }]), [{ title: "t", method: "V60" }]);
});

// ── 3. Chemex ───────────────────────────────────────────────────────────────
// The owner's measured 2026-10-18 Chemex: Freeform 6-Cup, 50 g / 750 g, 400°,
// logged 440 s against a 299 s plan (recommend-logs branch run 39153592276).
const CHEMEX_SESSION = {
  id: "s-chemex", createdAt: "2026-10-18T09:39:00Z", createdAtMs: 1, mode: "home", type: "coffee",
  coffee: COFFEE, context: {},
  recommendation: { candidates: [{ method: "Chemex", title: "Freeform", basedOn: "Freeform — Chemex 6-Cup", role: "anchor", confidence: "high", whyChosen: "", recipe: { doseGrams: 50, waterGrams: 750, waterTempC: 94, grindSize: "400°", targetTimeSec: 299 } }], reasoning: "", generatedAt: "" },
  brew: { selectedCandidateIdx: 0, methodUsed: "Chemex", grindSettingUsed: "400°", actualTimeSec: 440 },
  result: { rating: 4 },
};

test("Chemex: only the owner's measured brews at this batch; a slow setting sets the direction", () => {
  assert.equal(M.NICHE_DEG_PER_DOUBLING, M.GRIND_DEG_PER_DOUBLING, "one dose law, two constants — keep them equal");
  const ms = M.measuredChemexAtBatch([CHEMEX_SESSION], 750);
  assert.equal(ms.length, 1);
  assert.equal(ms[0].actualSec, 440);
  assert.equal(M.slowestFloorDeg(ms), 400, "400° ran slow → a Chemex candidate must be coarser than 400°");
  assert.equal(M.measuredChemexAtBatch([CHEMEX_SESSION], 450).length, 0, "a 750 g brew is not evidence for 450 g");
  const bad = M.findTooFineChemex([{ title: "a", method: "Chemex", recipe: { grindSize: "400°" } }, { title: "b", method: "Chemex", recipe: { grindSize: "406°" } }, { title: "c", method: "V60", recipe: { grindSize: "380°" } }], 400);
  assert.deepEqual(bad.map((b) => b.index), [0]);
});

test("the big-batch Chemex library entries carry no estimated Niche° number", async () => {
  const src = await readFile(path.join(ROOT, "src/lib/knowledge/recipes/markusAdditions.ts"), "utf8");
  for (const id of ["madcap-chemex-6-cup", "freeform-chemex-6-cup", "manual-coffee-brewing-chemex-1l-mega-batch", "project-barista-chemex-8-cup-big-batch", "sample-mardan-chemex-6-cup"]) {
    const from = src.indexOf(`id: "${id}"`);
    const grind = src.slice(src.indexOf("grind: {", from), src.indexOf("pourSequence", from));
    assert.doesNotMatch(grind, /nicheZeroDegrees/, id);
  }
});

// ── end-to-end through the real generateRecommendation ─────────────────────
test("E2E: the free text reaches the prompt, leads the menu, and is enforced", async () => {
  const userRequest = M.validateParsed("Ten Pour Recipe by Kasuya, kein Clever, 92 Grad", {
    recipeMentions: ["Ten Pour Recipe by Kasuya"],
    excludeBrewers: ["Clever Dripper"],
    params: { tempC: 92 },
    otherInstructions: "",
  });
  const { rec, calls } = await run(
    ctx(),
    { userRequest },
    // first answer: ignores the request, uses the excluded Clever
    { candidates: [cand("Clever thing", "Clever Dripper", "Own experiment"), cand("V60 thing", "V60", "Own experiment")] },
    // repair answer: complies
    { candidates: [cand("Ten pours", "V60", "Kasuya Super Coarse 10-Pour", 450, "440°"), cand("Explore", "V60", "Own experiment")] },
  );
  const prompt = calls[0];
  assert.match(prompt, /USER REQUEST FOR THIS BREW/);
  assert.match(prompt, /REQUESTED RECIPE: "Kasuya Super Coarse 10-Pour"/);
  assert.match(prompt, /EXCLUDED BY THE USER: Clever Dripper/);
  assert.match(prompt, /water temperature 92°C/);
  assert.match(prompt, /Equipment available: V60, Chemex\n/, "the excluded brewer leaves the equipment line too");
  // The requested recipe is entry 1 of the menu, scaled though it is published at 300 g.
  const menu = prompt.slice(prompt.indexOf("RELEVANT REFERENCE RECIPES ("));
  assert.match(menu, /\n1\. [^\n]*Kasuya Super Coarse 10-Pour/);
  assert.doesNotMatch(menu.slice(0, menu.indexOf("AVAILABLE TECHNIQUES")), /Hoffmann Ultimate Clever|brewer: clever/i);
  assert.equal(calls.length, 2, "one repair round");
  assert.match(calls[1], /REPAIR — EXCLUDED BREWER/);
  assert.match(calls[1], /REPAIR — REQUESTED RECIPE/);
  assert.ok(rec.candidates.every((c) => !/clever/i.test(c.method)));
  assert.match(rec.candidates[0].basedOn, /Kasuya Super Coarse 10-Pour/);
  assert.ok(rec.candidates.every((c) => c.recipe.waterTempC === 92), "the typed temperature survives the guard chain");
  assert.equal(rec.userRequestApplied.recipe, "Kasuya Super Coarse");
});

test("E2E: an excluded brewer still used after the repair is dropped", async () => {
  const userRequest = M.validateParsed("no Clever", { excludeBrewers: ["Clever Dripper"] });
  const bad = { candidates: [cand("Clever thing", "Clever Dripper", "Own experiment"), cand("V60 thing", "V60", "Own experiment")] };
  const { rec } = await run(ctx(), { userRequest }, bad, bad);
  assert.deepEqual(rec.candidates.map((c) => c.method), ["V60"]);
});

test("E2E: shown candidates are named, kept off the menu and repaired", async () => {
  const shown = [{ title: "Freeform big batch", method: "Chemex", basedOn: "Freeform — Chemex 6-Cup" }];
  const { rec, calls } = await run(
    ctx({ amount: "custom", customWaterMl: 750 }),
    { shown },
    { candidates: [cand("Freeform again", "Chemex", "Freeform — Chemex 6-Cup", 750, "400°"), cand("Explore", "V60", "Own experiment", 750)] },
    { candidates: [cand("Madcap", "Chemex", "Madcap — Chemex 6-Cup", 750, "400°"), cand("Explore", "V60", "Own experiment", 750)] },
  );
  assert.match(calls[0], /ALREADY SHOWN IN THIS SESSION/);
  const menu = calls[0].slice(calls[0].indexOf("RELEVANT REFERENCE RECIPES ("), calls[0].indexOf("AVAILABLE TECHNIQUES"));
  assert.doesNotMatch(menu, /Freeform — Chemex 6-Cup/, "the shown reference is off the menu");
  assert.equal(calls.length, 2);
  assert.match(calls[1], /REPAIR — ALREADY SHOWN/);
  assert.match(rec.candidates[0].basedOn, /Madcap/);
  // No measured Chemex in this fixture → the block says "measurement brew", gives no number.
  assert.match(calls[0], /CHEMEX AT THIS BATCH \(750 g\)/);
  assert.match(calls[0], /No measured Chemex brew at this batch yet/);
  assert.doesNotMatch(calls[0], /never finer than \d+°/);
});

test("E2E: the measured slow Chemex reaches the prompt, and a candidate at that grind is repaired", async () => {
  M.stub.calls.length = 0;
  M.stub.queue.length = 0;
  M.stub.queue.push(
    { candidates: [cand("Same again", "Chemex", "Own experiment", 750, "400°"), cand("Explore", "V60", "Own experiment", 750)] },
    { candidates: [cand("Coarser", "Chemex", "Own experiment", 750, "410°"), cand("Explore", "V60", "Own experiment", 750)] },
  );
  const res = await M.generateRecommendation(COFFEE, ctx({ amount: "custom", customWaterMl: 750 }), PREFS, [CHEMEX_SESSION], undefined, undefined, undefined, undefined, {});
  const calls = M.stub.calls;
  assert.match(calls[0], /2026-10-18: 400°, 50 g \/ 750 g, logged total 440 s vs planned 299 s \(\+141 s\), 4★ — RAN SLOW/);
  assert.match(calls[0], /MUST be ground coarser than 400°/);
  assert.match(calls[0], /chemexcoffeemaker\.com\/pages\/faq/);
  assert.equal(calls.length, 2);
  assert.match(calls[1], /REPAIR — CHEMEX GRIND/);
  assert.equal(res.recommendation.candidates[0].recipe.grindSize, "410°", "the model's measurement step is kept, never overwritten by a computed number");
});

test("E2E: no free text, nothing shown → no extra blocks, no extra call", async () => {
  const { calls } = await run(ctx(), {}, { candidates: [cand("A", "V60", "Own experiment"), cand("B", "Chemex", "Own experiment")] });
  assert.equal(calls.length, 1);
  assert.doesNotMatch(calls[0], /USER REQUEST FOR THIS BREW|ALREADY SHOWN/);
});
