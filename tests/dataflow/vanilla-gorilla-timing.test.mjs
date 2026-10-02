// The Vanilla Gorilla brew (Origami wave, 350 g, 2 Oct 2026) as the anchor for
// the pour-time / rest-time / drawdown rework. Every number in VG below is the
// REAL stored recipe and the REAL Acaia reach times, pulled from production by
// .github/workflows/recommend-logs.yml:
//
//   steps   bloom:55@10 swirl@5 wait@35 pour:140@17 wait@18 pour:220@16
//           wait@15 pour:290@14 wait@15 final:350@15
//   clock   model 240 s → old time calibration +35 s → 275 s promised
//   actual  224 s; the scale saw the last gram land at 162 s
//
//   node --test tests/dataflow/vanilla-gorilla-timing.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const entry = `
export { calibrateDrawdownClock } from ${JSON.stringify(path.join(ROOT, "src/lib/claude/recommend.ts"))};
export { drawdownFor, measuredDrawdowns, DRIP_ASSIST_DRAWDOWN_KEEP, DRIP_ASSIST_DRAWDOWN_FLOOR_SEC } from ${JSON.stringify(path.join(ROOT, "src/lib/brew/drawdown.ts"))};
export { applyPourDurations } from ${JSON.stringify(path.join(ROOT, "src/lib/recipe/pourDurations.ts"))};
export { pourScheduleFor, housePourSec, stepPhaseAt, maxDrawdownSec, maxTargetTimeSec, MAX_DRAWDOWN_ABS_SEC } from ${JSON.stringify(path.join(ROOT, "src/lib/utils/pourSequence.ts"))};
export { buildBrewTimeline } from ${JSON.stringify(path.join(ROOT, "src/lib/brew/timeline.ts"))};
export { coachFlow } from ${JSON.stringify(path.join(ROOT, "src/lib/brew/flowCoach.ts"))};
export { scaleRecipe } from ${JSON.stringify(path.join(ROOT, "src/lib/recipe/scaleRecipe.ts"))};
export { ALL_RECIPES } from ${JSON.stringify(path.join(ROOT, "src/lib/knowledge/recipes/index.ts"))};
`;
const out = path.join(ROOT, "node_modules/.cache/vg-timing/bundle.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
  external: ["pg", "pg-native", "drizzle-orm", "drizzle-orm/*"],
});
const K = await import(pathToFileURL(out).href);

const NOW = Date.parse("2026-10-02T06:50:00Z");
const ROAST = "2026-09-21"; // 11 days → peak window, no bloom shift
const METHOD = "Origami (wave)";
const isPercolation = (m) => /v60|orea|origami|kalita|chemex/i.test(m ?? "");

const VG = {
  doseGrams: 23,
  waterGrams: 350,
  waterTempC: 93,
  grindSize: "393°",
  targetTimeSec: 240,
  pourSteps: [
    { label: "Bloom", action: "bloom", waterGramsAtEnd: 55, durationSec: 10 },
    { label: "Swirl", action: "swirl", durationSec: 5 },
    { label: "Rest", action: "wait", durationSec: 35 },
    { label: "Pour 2", action: "pour", waterGramsAtEnd: 140, durationSec: 17 },
    { label: "Rest", action: "wait", durationSec: 18 },
    { label: "Pour 3", action: "pour", waterGramsAtEnd: 220, durationSec: 16 },
    { label: "Rest", action: "wait", durationSec: 15 },
    { label: "Pour 4", action: "pour", waterGramsAtEnd: 290, durationSec: 14 },
    { label: "Rest", action: "wait", durationSec: 15 },
    { label: "Final pour", action: "final", waterGramsAtEnd: 350, durationSec: 15 },
  ],
};

/** A logged session the way production stores it. */
function session({ method = METHOD, recipe = VG, actual, lastReach, createdAt = "2026-10-02T06:56:00Z" }) {
  return {
    id: `s-${actual}-${lastReach}-${method}`,
    createdAt,
    coffee: { name: "x", roaster: "y", roastDate: ROAST },
    recommendation: { candidates: [{ method, recipe }] },
    brew: {
      selectedCandidateIdx: 0,
      methodUsed: method,
      actualTimeSec: actual,
      ...(lastReach != null
        ? { flowAnalysis: { perPour: [{ label: "Final pour", actualSec: lastReach }] } }
        : {}),
    },
  };
}

const candidate = (recipe, over = {}) => ({
  method: METHOD,
  recipe,
  role: "anchor",
  title: "Wave-Filter Sweetness Build",
  basedOn: "Your Origami (wave) — Sprout Cream Dream",
  whyChosen: "",
  confidence: "high",
  ...over,
});

// ── Pour times ───────────────────────────────────────────────────────────────

test("house pour time: the owner's measured ~4 g/s in whole 5-second steps", () => {
  // His own curve for this brew: 55 g in 12.4 s, 85 g in ~20 s, 70 g in ~18 s.
  assert.equal(K.housePourSec(55), 15);
  assert.equal(K.housePourSec(85), 20);
  assert.equal(K.housePourSec(70), 20);
  assert.equal(K.housePourSec(60), 15);
  assert.equal(K.housePourSec(200), 50);
  assert.equal(K.housePourSec(3), 5, "never under 5 s");
});

test("VG: the 55 g bloom gets 15 s, not the model's 10 s — and the cadence holds", () => {
  const res = K.applyPourDurations(VG, { basedOn: "Your Origami (wave)", method: METHOD });
  assert.equal(res.source, "house");
  const water = res.recipe.pourSteps.filter((s) => s.waterGramsAtEnd != null);
  assert.deepEqual(
    water.map((s) => s.durationSec),
    [15, 20, 20, 20, 15],
  );
  // The model's rests absorb the change so each pour still STARTS where the
  // recipe put it — only the split between pouring and resting moves.
  const before = K.pourScheduleFor(VG, ROAST, NOW, METHOD).steps.filter((s) => s.pourGrams > 0);
  const after = K.pourScheduleFor(res.recipe, ROAST, NOW, METHOD).steps.filter((s) => s.pourGrams > 0);
  assert.deepEqual(after.map((s) => s.startTimeSec), before.map((s) => s.startTimeSec));
  // The swirl now comes AFTER the 15 s bloom pour, not at 10 s.
  const swirl = K.pourScheduleFor(res.recipe, ROAST, NOW, METHOD).steps.find((s) => s.action === "swirl");
  assert.equal(swirl.startTimeSec, 15);
});

test("a verified reference keeps its OWN published pour times (we don't falsify recipes)", () => {
  const ref = K.ALL_RECIPES.find((r) => r.id === "hoffmann-v60-better-one-cup");
  assert.ok(ref && ref.verified);
  const scaled = K.scaleRecipe(ref, 250);
  const drifted = {
    doseGrams: 15, waterGrams: 250, waterTempC: 100, grindSize: "380°", targetTimeSec: 180,
    pourSteps: scaled.pourSteps.map((s) => (s.waterGramsAtEnd != null ? { ...s, durationSec: 30 } : s)),
  };
  const res = K.applyPourDurations(drifted, { basedOn: ref.name, method: "V60" });
  assert.equal(res.source, "reference");
  assert.deepEqual(
    res.recipe.pourSteps.filter((s) => s.waterGramsAtEnd != null).map((s) => s.durationSec),
    scaled.pourSteps.filter((s) => s.waterGramsAtEnd != null).map((s) => s.durationSec),
  );
});

test("immersion is left alone — filling a Clever isn't pouring onto a bed", () => {
  const clever = {
    doseGrams: 18, waterGrams: 300, waterTempC: 96, grindSize: "410°", targetTimeSec: 240,
    pourSteps: [
      { label: "Add water", action: "pour", waterGramsAtEnd: 300, durationSec: 15 },
      { label: "Steep", action: "wait", durationSec: 120 },
      { label: "Drain", action: "drain", durationSec: 105 },
    ],
  };
  assert.equal(K.applyPourDurations(clever, {}).recipe, clever);
});

// ── Pour phase vs rest phase ────────────────────────────────────────────────

test("every rendered step carries its pour phase AND its rest", () => {
  const recipe = K.applyPourDurations(VG, { method: METHOD }).recipe;
  const steps = K.pourScheduleFor(recipe, ROAST, NOW, METHOD).steps;
  const pour2 = steps.find((s) => s.label === "Pour 2");
  assert.equal(pour2.startTimeSec, 50);
  assert.equal(pour2.pourEndSec, 70, "85 g in 20 s");
  assert.equal(pour2.restSec, 15, "then wait until Pour 3 at 1:25");
  assert.equal(K.stepPhaseAt(pour2, 69), "active");
  assert.equal(K.stepPhaseAt(pour2, 70), "rest");
  for (let i = 0; i < steps.length - 1; i++) {
    assert.equal(steps[i].pourEndSec + steps[i].restSec, steps[i + 1].startTimeSec);
  }
});

// ── The clock ────────────────────────────────────────────────────────────────

test("VG: the clock is pour end + the MEASURED drawdown — 3:44, not 4:35", () => {
  // Two measured Origami-wave brews near 350 g: this one (224 − 162 = 62 s)
  // and another that drained in 65 s.
  const past = [
    session({ actual: 224, lastReach: 162 }),
    session({ actual: 230, lastReach: 165, recipe: { ...VG, waterGrams: 330 } }),
  ];
  const [c] = K.calibrateDrawdownClock([candidate(VG)], past, isPercolation, ROAST, NOW);
  const phaseEnd = K.pourScheduleFor(VG, ROAST, NOW, METHOD).pourPhaseEndSec;
  assert.equal(phaseEnd, 160);
  assert.equal(c.recipe.targetTimeSec, 160 + 64, "median of 62 and 65 s, rounded");
  assert.ok(c.recipe.targetTimeSec < 240, "not the model's 4:00, and nowhere near the old 4:35");
});

test("a total-time delta from a DIFFERENT pour phase no longer leaks in", () => {
  // The old calibration added (actual − target) of past brews. A past brew whose
  // model clock was far too short (target 170, actual 248) moved every later
  // clock by +78 s even though its drawdown says nothing of the kind.
  const past = [
    session({ actual: 224, lastReach: 162 }),
    session({ actual: 226, lastReach: 160, recipe: { ...VG, targetTimeSec: 170 } }),
  ];
  const [c] = K.calibrateDrawdownClock([candidate(VG)], past, isPercolation, ROAST, NOW);
  assert.equal(c.recipe.targetTimeSec, 160 + 64);
});

test("Origami CONE brews do not pollute the WAVE pool (flat vs cone)", () => {
  const wave = [session({ actual: 224, lastReach: 162 }), session({ actual: 230, lastReach: 165 })];
  const cone = [1, 2, 3].map((i) =>
    session({ method: "Origami (cone)", actual: 170 + i, lastReach: 160 }),
  );
  const [a] = K.calibrateDrawdownClock([candidate(VG)], wave, isPercolation, ROAST, NOW);
  const [b] = K.calibrateDrawdownClock([candidate(VG)], [...wave, ...cone], isPercolation, ROAST, NOW);
  assert.equal(b.recipe.targetTimeSec, a.recipe.targetTimeSec);
});

test("fewer than 2 measured brews → the published-recipe median for the brewer", () => {
  const est = K.drawdownFor([session({ actual: 224, lastReach: 162 })], METHOD, 350);
  assert.equal(est.source, "corpus");
  const [c] = K.calibrateDrawdownClock([candidate(VG)], [], isPercolation, ROAST, NOW);
  assert.equal(c.recipe.targetTimeSec, 160 + est.sec);
});

test("a session from before the cadence-first renderer, without a scale curve, is not used", () => {
  const old = [1, 2].map((i) =>
    session({ actual: 300 + i, lastReach: null, createdAt: "2026-08-01T07:00:00Z" }),
  );
  assert.deepEqual(K.measuredDrawdowns(old, METHOD, 350), []);
});

test("Drip Assist without disc history keeps a thin share of the bare tail", () => {
  const disc = "Origami (wave) + Drip Assist";
  const bare = K.drawdownFor([], METHOD, 350);
  const est = K.drawdownFor([], disc, 350);
  assert.equal(est.source, "disc");
  assert.equal(
    est.sec,
    Math.max(K.DRIP_ASSIST_DRAWDOWN_FLOOR_SEC, Math.round(bare.sec * K.DRIP_ASSIST_DRAWDOWN_KEEP)),
  );
});

test("iced, cold steeps and immersion keep their clocks", () => {
  const past = [session({ actual: 224, lastReach: 162 }), session({ actual: 230, lastReach: 165 })];
  const iced = candidate({ ...VG, iceGrams: 150 });
  const cold = candidate({ ...VG, targetTimeSec: 43200 });
  const clever = candidate(VG, { method: "Clever Dripper" });
  const outs = K.calibrateDrawdownClock([iced, cold, clever], past, isPercolation, ROAST, NOW);
  assert.deepEqual(outs.map((c) => c.recipe.targetTimeSec), [240, 43200, 240]);
});

test("the padding cap is a CEILING now, not a floor", () => {
  // Before: max(240, 0.65 T) — a 4:35 clock could carry 240 s of drawdown.
  assert.equal(K.maxDrawdownSec(275), Math.round(275 * 0.65));
  assert.ok(K.maxDrawdownSec(600) <= K.MAX_DRAWDOWN_ABS_SEC);
  assert.ok(K.maxTargetTimeSec(160) <= 160 + K.MAX_DRAWDOWN_ABS_SEC);
});

// ── The coach ────────────────────────────────────────────────────────────────

function timeline() {
  return K.buildBrewTimeline(K.applyPourDurations(VG, { method: METHOD }).recipe, ROAST, NOW, METHOD);
}
/** Samples pouring at `rate` g/s for the 1.5 s before `elapsed`, ending at `grams`. */
function samples(rate, grams) {
  const t = 1_000_000;
  return Array.from({ length: 16 }, (_, i) => ({ atMs: t + i * 100, grams: grams - rate * (1.5 - i * 0.1) }));
}

test("coach: no 'Slower' in the first 1.5 s of a pour (the kettle's opening surge)", () => {
  const c = K.coachFlow(timeline(), 1.0, true, 9, samples(9, 9));
  assert.notEqual(c.cue, "pour-slower");
});

test("coach: in the REST after a pour it never says 'Slower' — a late pour is late, not fast", () => {
  // Pour 2 runs 50 → 70 s; at 75 s the plan is resting.
  const c = K.coachFlow(timeline(), 75, true, 125, samples(9, 125));
  assert.equal(c.cue, "keep-flow");
  assert.equal(c.message, "Finish pour");
});

test("coach: 'Slower' needs the grams to be AHEAD of the plan, not just a fast slope", () => {
  // 5 s into Pour 2 the ramp expects 55 + 85·5/20 ≈ 76 g.
  const onRamp = K.coachFlow(timeline(), 55, true, 78, samples(9, 78));
  assert.notEqual(onRamp.cue, "pour-slower");
  const ahead = K.coachFlow(timeline(), 55, true, 100, samples(9, 100));
  assert.equal(ahead.cue, "pour-slower");
});

// ── Wiring ───────────────────────────────────────────────────────────────────

test("WIRING: /recommend stamps pour times, then sets the clock from the drawdown", async () => {
  const src = await readFile(path.join(ROOT, "src/lib/claude/recommend.ts"), "utf8");
  assert.match(src, /applyPourDurations\(c\.recipe/);
  assert.match(src, /const physicsChecked\s*=\s*pourTimed\.map/);
  assert.match(src, /calibrateDrawdownClock\(\s*discGuarded/);
  assert.match(src, /discTimed\.map\(/, "the clocked candidates must flow on to the gap guard");
  assert.doesNotMatch(src, /calibrateTargetTimes\(|calibrateDripAssistFinish\(/);
});

test("WIRING: the chat's start_brew recipe gets the same pour-time rule", async () => {
  const ctx = await readFile(path.join(ROOT, "src/lib/chat/agentContext.ts"), "utf8");
  assert.match(ctx, /return applyPourDurations\(reconcileWaterToPourPlan\(out\), ctx\)\.recipe/);
});

test("WIRING: the brew screen splits each step into pour and rest, and taps at the pour's end", async () => {
  const ui = await readFile(path.join(ROOT, "src/components/flow/LightStepBrew.tsx"), "utf8");
  assert.match(ui, /stepPhaseAt\(activeStep, elapsed\) === "rest"/, "the card must know the phase");
  assert.match(ui, />Wait</, "the rest phase has its own card");
  assert.match(ui, /"Stop pouring in"/, "the pour phase counts down the pour, not the next step");
  assert.match(ui, /pourPace\(activeStep\.pourGrams, activeStep\.timingDurationSec\)/,
    "the pace line reads the time the schedule gives the pour — bloom included");
  assert.match(ui, /useBrewStepHaptics\(boundaries, elapsed, started, restStarts\)/);
  const hook = await readFile(path.join(ROOT, "src/hooks/useBrewStepHaptics.ts"), "utf8");
  assert.match(hook, /pourEndTap\(\)/, "a rest start fires the light tap");
});
