// 2026-10-19 — the Comandante is a real option, not a travel grinder. The
// model may PROPOSE it with a reason; the owner answers on the recipe screen
// with one tap; nothing is regenerated. The unit rule is untouched: Niche =
// degrees, Comandante = clicks — and six prompt blocks that printed degrees
// to a Comandante brew now take the grinder.
//
//   node --test tests/dataflow/grinder-suggestion.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const dir = await mkdtemp(join(tmpdir(), "grinder-"));

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
export { applyGrinderAnswer } from ${JSON.stringify(path.join(ROOT, "src/lib/flow/grinderAnswer.ts"))};
export { formatGrind, formatRecipeForPrompt, ALL_RECIPES, grindInUnit } from ${JSON.stringify(path.join(ROOT, "src/lib/knowledge/recipes/index.ts"))};
export { formatScaledForPrompt, scaleRecipe } from ${JSON.stringify(path.join(ROOT, "src/lib/recipe/scaleRecipe.ts"))};
export { formatGrindSlopeBlock } from ${JSON.stringify(path.join(ROOT, "src/lib/claude/grindSlope.ts"))};
export { formatMeasuredChemexBlock } from ${JSON.stringify(path.join(ROOT, "src/lib/claude/measuredChemex.ts"))};
export { validateParsed } from ${JSON.stringify(path.join(ROOT, "src/lib/claude/userRequest.ts"))};
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

const COFFEE = { roaster: "Sprout", name: "Vizinhos", origin: "Brazil", process: "Natural", roastLevel: "Light", aiExtracted: false };
const PREFS = { equipment: ["V60"], grinder: "Niche Zero", tasteProfile: { preferredBodyLevel: "medium", preferredAcidityLevel: "medium" } };
const ctx = (extra = {}) => ({ occasion: "focus", amount: "small", timeAvailable: "normal", moodPreference: "balanced", intent: "balanced", grinder: "", ...extra });
const pours = (water) => [
  { label: "Bloom", action: "bloom", waterGramsAtEnd: 50, durationSec: 10 },
  { label: "Wait", action: "wait", durationSec: 30 },
  { label: "Final", action: "final", waterGramsAtEnd: water, durationSec: 40 },
];
const cand = (grindSize, grinderSuggestion, extra = {}) => ({
  method: "V60", role: "anchor", title: `t-${grindSize}`, basedOn: "Own experiment", whyChosen: "fit", confidence: "high", experiment: "x",
  recipe: { doseGrams: 23, waterGrams: 350, waterTempC: 94, grindSize, targetTimeSec: 240, pourSteps: pours(350) },
  ...(grinderSuggestion ? { grinderSuggestion } : {}),
  ...extra,
});

async function run(context, opts, answer) {
  M.stub.calls.length = 0;
  M.stub.queue.length = 0;
  M.stub.queue.push(answer);
  const res = await M.generateRecommendation(COFFEE, context, PREFS, [], undefined, undefined, undefined, undefined, opts);
  return res.recommendation.candidates;
}

test("a proposal is attached with the grind converted into the proposed unit; the recipe's own grind is untouched", async () => {
  const [c] = await run(ctx(), {}, { candidates: [cand("380°", { grinder: "Comandante C40", reason: "Wölfl published it on a Comandante" })] });
  assert.equal(c.recipe.grindSize, "380°");
  assert.deepEqual(c.grinderSuggestion, { grinder: "Comandante C40", reason: "Wölfl published it on a Comandante", grindSize: "23 clicks" });
  const [far] = await run(ctx(), {}, { candidates: [cand("440°", { grinder: "Comandante C40", reason: "slow Sunday" })] });
  assert.deepEqual(far.grinderSuggestion, { grinder: "Comandante C40", reason: "slow Sunday", grindSize: "41 clicks", extrapolated: true });
});

test("a proposal is dropped when it names the brew's own grinder, an unknown grinder, a prose grind, or when the owner typed a grind", async () => {
  const [same] = await run(ctx({ grinder: "Niche Zero" }), {}, { candidates: [cand("380°", { grinder: "Niche Zero", reason: "x" })] });
  assert.equal(same.grinderSuggestion, undefined);
  const [unknown] = await run(ctx(), {}, { candidates: [cand("380°", { grinder: "Timemore", reason: "x" })] });
  assert.equal(unknown.grinderSuggestion, undefined);
  const [prose] = await run(ctx(), {}, { candidates: [cand("medium-fine", { grinder: "Comandante C40", reason: "x" })] });
  assert.equal(prose.grinderSuggestion, undefined);
  const userRequest = M.validateParsed("385 Grad", { params: { grind: "385°" } });
  const [typed] = await run(ctx(), { userRequest }, { candidates: [cand("380°", { grinder: "Comandante C40", reason: "x" })] });
  assert.equal(typed.grinderSuggestion, undefined, "his typed number wins; no proposal");
  assert.equal(typed.recipe.grindSize, "385°");
  // The reverse direction: a Comandante brew may be proposed the Niche.
  const [toNiche] = await run(ctx({ grinder: "Comandante C40" }), {}, { candidates: [cand("26 clicks", { grinder: "Niche Zero", reason: "x" })] });
  assert.deepEqual(toNiche.grinderSuggestion, { grinder: "Niche Zero", reason: "x", grindSize: "390°" });
});

test("the owner's tap: accept swaps the grind into clicks and sets the brew's grinder; decline restores both; the toggle round-trips", () => {
  const draft = {
    type: "coffee", mode: "home",
    context: { occasion: "focus", amount: "small", timeAvailable: "normal", moodPreference: "balanced", grinder: "" },
    recommendation: {
      candidates: [
        { ...cand("380°"), grinderSuggestion: { grinder: "Comandante C40", reason: "r", grindSize: "23 clicks" } },
        cand("390°"),
      ],
      primaryRecipe: cand("380°").recipe,
      reasoning: "", generatedAt: "",
    },
  };
  const accepted = M.applyGrinderAnswer(draft, 0, true);
  assert.equal(accepted.recommendation.candidates[0].recipe.grindSize, "23 clicks");
  assert.equal(accepted.recommendation.candidates[0].grinderSuggestion.grindSize, "380°");
  assert.equal(accepted.recommendation.candidates[0].grinderSuggestion.accepted, true);
  assert.equal(accepted.recommendation.primaryRecipe.grindSize, "23 clicks", "the back-compat primaryRecipe follows");
  assert.equal(accepted.context.grinder, "Comandante C40");
  assert.equal(accepted.recommendation.candidates[1].recipe.grindSize, "390°", "the other candidate is untouched");
  assert.equal(M.applyGrinderAnswer(accepted, 0, true), null, "answering the same way twice is a no-op");
  const declined = M.applyGrinderAnswer(accepted, 0, false);
  assert.equal(declined.recommendation.candidates[0].recipe.grindSize, "380°");
  assert.equal(declined.recommendation.candidates[0].grinderSuggestion.grindSize, "23 clicks");
  assert.equal(declined.recommendation.candidates[0].grinderSuggestion.accepted, false);
  assert.equal(declined.context.grinder, "", "the grinder the brew was set up with comes back");
  const again = M.applyGrinderAnswer(declined, 0, true);
  assert.equal(again.recommendation.candidates[0].recipe.grindSize, "23 clicks");
  assert.equal(M.applyGrinderAnswer(draft, 1, true), null, "no proposal, nothing to answer");
});

test("six prompt blocks render the grind in the brew's grinder unit — no degrees on a Comandante brew", () => {
  const C = "Comandante C40";
  const ranged = M.ALL_RECIPES.find((r) => Array.isArray(r.grind.nicheZeroDegrees));
  const hoffmann = M.ALL_RECIPES.find((r) => r.id === "hoffmann-v60-better-one-cup");
  // 1. formatGrind / formatRecipeForPrompt
  assert.match(M.formatGrind(hoffmann, C), /^Comandante 23 clicks/);
  assert.doesNotMatch(M.formatGrind(hoffmann, C), /\d°/);
  assert.match(M.formatGrind(hoffmann), /^Niche 380°/);
  assert.doesNotMatch(M.formatRecipeForPrompt(hoffmann, { grinder: C }), /Niche \d+°/);
  assert.ok(ranged, "the corpus holds at least one sourced Niche RANGE");
  assert.match(M.formatRecipeForPrompt(ranged, { grinder: C }), /Comandante \d+–\d+ clicks/);
  assert.doesNotMatch(M.formatRecipeForPrompt(ranged, { grinder: C }), /Niche \d+/);
  // 2. the scaled line
  const scaled = M.scaleRecipe(hoffmann, 280, { method: "V60" });
  assert.match(M.formatScaledForPrompt(scaled, C), /grind 2\d clicks/);
  assert.doesNotMatch(M.formatScaledForPrompt(scaled, C), /°/);
  assert.match(M.formatScaledForPrompt(scaled), /grind 38\d°/);
  // 3. grindInUnit flags extrapolation beyond the measured 23–29
  assert.equal(M.grindInUnit(380, C), "23 clicks");
  assert.equal(M.grindInUnit(440, C), "41 clicks (extrapolated)");
  assert.equal(M.grindInUnit(380), "380°");
  // 4. the measured Chemex block
  const ms = [{ date: "2026-10-18", grind: "400°", grindDeg: 400, doseGrams: 50, waterGrams: 750, actualSec: 440, plannedSec: 299, rating: 4 }];
  const chemex = M.formatMeasuredChemexBlock(ms, 750, C);
  assert.match(chemex, /2026-10-18: 29 clicks, 50 g/);
  assert.match(chemex, /29 clicks ran slow at this batch/);
  assert.doesNotMatch(chemex, /400°/);
  // 5. the grind-slope block (two dry-bed brews of one coffee, two grinds, both at 350 g)
  const brew = (deg, sec, date) => ({
    id: date, type: "coffee", mode: "home", createdAt: `${date}T06:00:00Z`, coffee: COFFEE,
    recommendation: { candidates: [{ method: "V60", role: "anchor", title: "t", whyChosen: "", confidence: "high", recipe: { doseGrams: 23, waterGrams: 350, waterTempC: 94, grindSize: `${deg}°`, targetTimeSec: 240, pourSteps: pours(350) } }], reasoning: "", generatedAt: "" },
    brew: { methodUsed: "V60", selectedCandidateIdx: 0, actualTimeSec: sec, doneAtDryBed: true, grindSettingUsed: `${deg}°` },
    result: { rating: 4, flavorNotes: [], body: "medium", acidity: "medium" },
  });
  const sessions = [brew(380, 260, "2026-10-01"), brew(390, 230, "2026-10-02"), brew(400, 205, "2026-10-03")];
  const slopeDeg = M.formatGrindSlopeBlock(sessions, 350);
  const slopeClicks = M.formatGrindSlopeBlock(sessions, 350, C);
  if (slopeDeg) {
    assert.match(slopeDeg, /s per degree/);
    assert.match(slopeClicks, /s per click/);
    assert.doesNotMatch(slopeClicks, /\d°/);
  }
});

test("the prompt tells the model whether the grinder is his pick or the default (wiring)", async () => {
  const src = await readFile(path.join(ROOT, "src/lib/claude/recommend.ts"), "utf8");
  assert.match(src, /const grinderPicked = Boolean\(context\.grinder && context\.grinder\.trim\(\)\)/);
  assert.match(src, /He picked this grinder himself for this brew/);
  assert.match(src, /This is the default, not his pick — you may propose the Comandante/);
  assert.match(src, /grinderSuggestion: z\.object\(\{ grinder: z\.string\(\), reason: z\.string\(\)\.max\(200\) \}\)\.optional\(\)/);
  // 6. the timing-calibration line goes to clicks on the Comandante
  assert.match(src, /isComandante\(sessionGrinder\) \? `about \$\{Math\.max\(1, Math\.round\(deg \/ 3\.33\)\)\} click/);
});

test("the recipe screen renders the two-chip answer and the store exposes the tap; the sessions POST keeps context + recommendation as loose records", async () => {
  const ui = await readFile(path.join(ROOT, "src/components/flow/LightStepRecommend.tsx"), "utf8");
  assert.match(ui, /answerGrinderSuggestion\(selectedIdx, false\)/);
  assert.match(ui, /answerGrinderSuggestion\(selectedIdx, true\)/);
  assert.match(ui, /active\.grinderSuggestion\.grinder\} would fit: \{active\.grinderSuggestion\.reason\}/);
  assert.match(ui, /\(extrapolated\)/);
  const store = await readFile(path.join(ROOT, "src/store/flowStore.ts"), "utf8");
  assert.match(store, /applyGrinderAnswer\(s\.draft, candidateIdx, accepted\)/);
  const route = await readFile(path.join(ROOT, "src/app/api/sessions/route.ts"), "utf8");
  assert.match(route, /context: z\.record\(z\.string\(\), z\.unknown\(\)\)\.optional\(\),\n  recommendation: z\.record\(z\.string\(\), z\.unknown\(\)\)\.optional\(\),/);
  // The Log prefill and the brew screen read recipe.grindSize, which the tap swaps.
  const log = await readFile(path.join(ROOT, "src/components/flow/LightStepLog.tsx"), "utf8");
  assert.match(log, /grindSize/);
});
