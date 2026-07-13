// Golden-equivalence test for the canonical brew timeline (PR 1, refactor-only).
//
//   node --test tests/dataflow/brew-timeline.test.mjs
//
// THE GATE: buildBrewTimeline is a normalize layer over the existing pour-math
// builders. This test bundles the REAL timeline.ts + pourSequence.ts +
// brewNotifications.ts and asserts, across a recipe corpus, that:
//   1. timeline.pourSteps / guideSteps / proseSequence are byte-identical to the
//      legacy inline derivation the brew screen used (so the two renderers get
//      the exact same data),
//   2. boundariesFromTimeline(timeline) deep-equals buildBrewBoundaries(...)
//      (so the haptic + Apple Watch cue schedule is provably unchanged),
//   3. activeStepAt matches the renderers' getActiveIdx scan, and
//   4. expectedGramsAt is a sane monotonic curve (0 at start → final at end).
// If any of these drift, the daily brew timer/cues changed — fail loudly.

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const entry = `
export { buildBrewTimeline, expectedGramsAt, activeStepAt } from ${JSON.stringify(
  path.join(ROOT, "src/lib/brew/timeline.ts"),
)};
export { buildBrewBoundaries, boundariesFromTimeline } from ${JSON.stringify(
  path.join(ROOT, "src/lib/native/brewNotifications.ts"),
)};
export { pourStepsFromStructured, parsePourSteps, buildGuideSteps, hasImmersionShape, getActiveIdx } from ${JSON.stringify(
  path.join(ROOT, "src/lib/utils/pourSequence.ts"),
)};
`;
const dir = await mkdtemp(join(tmpdir(), "brewtl-"));
const out = join(dir, "tl.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const {
  buildBrewTimeline,
  expectedGramsAt,
  activeStepAt,
  buildBrewBoundaries,
  boundariesFromTimeline,
  pourStepsFromStructured,
  parsePourSteps,
  buildGuideSteps,
  hasImmersionShape,
  getActiveIdx,
} = await import(pathToFileURL(out).href);

// Fixed clock + roast date so the bloom-duration math is deterministic.
const ROAST = "2026-06-01";
const NOW = new Date("2026-06-16T08:00:00Z").getTime(); // ~15 days → 45s bloom

const base = { doseGrams: 15, waterGrams: 250, waterTempC: 94, grindSize: "medium" };

const RECIPES = {
  "percolation-structured-with-agitation": {
    ...base,
    targetTimeSec: 180,
    pourSteps: [
      { label: "Bloom", action: "bloom", waterGramsAtEnd: 45, durationSec: 45, notes: "swirl" },
      { label: "Swirl", action: "swirl" },
      { label: "Pour 2", action: "pour", waterGramsAtEnd: 150 },
      { label: "Final pour", action: "final", waterGramsAtEnd: 250 },
    ],
  },
  "percolation-grams-string": {
    ...base,
    targetTimeSec: 210,
    pourSequence: "50 – 180 – 320 – 500",
    waterGrams: 500,
  },
  // V60 from the Home chat's start_brew: multiple rising-grams pours, a final
  // swirl, and the ~2:00 DRAWDOWN encoded as a trailing wait. Must stay
  // percolation (keeps the cumulative-grams renderer + the live flow coach) —
  // the trailing wait must NOT misroute it to the immersion guide.
  "percolation-v60-drawdown": {
    ...base,
    targetTimeSec: 270,
    waterGrams: 450,
    pourSteps: [
      { label: "Bloom", action: "bloom", waterGramsAtEnd: 90, durationSec: 8, notes: "swirl gently" },
      { label: "Pour 1", action: "pour", waterGramsAtEnd: 270, durationSec: 50 },
      { label: "Pour 2", action: "final", waterGramsAtEnd: 450, durationSec: 50 },
      { label: "Final swirl", action: "swirl" },
      { label: "Drawdown", action: "wait", durationSec: 120 },
    ],
  },
  // Origami-wave (flat-bottom PERCOLATION) whose long bloom is encoded as an
  // explicit "Bloom Rest" wait BEFORE the main pour, then a trailing drawdown +
  // settle swirl. The leading bloom-rest wait must NOT misroute it to the
  // immersion guide (which would trust the model's physically-impossible ~30s
  // Final Pour of ~235g); it must stay percolation so buildPourOver re-derives a
  // sane pour window. Regression guard for the "235ml in 30s at 4 g/s" report.
  "percolation-origami-bloom-rest": {
    ...base,
    targetTimeSec: 180,
    waterGrams: 350,
    pourSteps: [
      { label: "Bloom", action: "bloom", waterGramsAtEnd: 115, durationSec: 10 },
      { label: "Bloom Rest", action: "wait", durationSec: 90 },
      { label: "Final Pour", action: "final", waterGramsAtEnd: 350, durationSec: 30 },
      { label: "Drawdown", action: "wait", durationSec: 60 },
      { label: "Settle Swirl", action: "swirl" },
    ],
  },
  "immersion-inverted-aeropress": {
    ...base,
    targetTimeSec: 150,
    pourSteps: [
      { label: "Invert AeroPress", action: "invert" },
      { label: "Add coffee + water", action: "pour", waterGramsAtEnd: 200, durationSec: 15 },
      { label: "Steep", action: "wait", durationSec: 60 },
      { label: "Flip onto cup", action: "flip" },
      { label: "Press", action: "press", durationSec: 25 },
    ],
  },
  "immersion-clever": {
    ...base,
    targetTimeSec: 240,
    pourSteps: [
      { label: "Add all water", action: "pour", waterGramsAtEnd: 300, durationSec: 20 },
      { label: "Steep", action: "wait", durationSec: 120 },
      { label: "Drain onto cup", action: "drain", durationSec: 30 },
    ],
  },
  "prose-only": {
    ...base,
    targetTimeSec: 180,
    pourSequence: "bloom then pour slowly in spirals",
  },
};

// Recompute the legacy inline derivation (mirrors LightStepBrew pre-refactor).
function legacy(r) {
  const guideSteps = hasImmersionShape(r) ? buildGuideSteps(r) : null;
  const pourSteps = !guideSteps
    ? pourStepsFromStructured(r, ROAST, NOW) ??
      (r.pourSequence && r.targetTimeSec
        ? parsePourSteps(r.pourSequence, r.targetTimeSec, ROAST, NOW)
        : null)
    : null;
  const proseSequence = !guideSteps && !pourSteps && r.pourSequence ? r.pourSequence : null;
  return { guideSteps, pourSteps, proseSequence };
}

for (const [name, recipe] of Object.entries(RECIPES)) {
  test(`${name}: renderer arrays are byte-identical to the legacy derivation`, () => {
    const tl = buildBrewTimeline(recipe, ROAST, NOW);
    const leg = legacy(recipe);
    assert.deepEqual(tl.pourSteps, leg.pourSteps, "pourSteps drift");
    assert.deepEqual(tl.guideSteps, leg.guideSteps, "guideSteps drift");
    assert.equal(tl.proseSequence, leg.proseSequence, "proseSequence drift");
  });

  test(`${name}: cue boundaries are provably unchanged`, () => {
    const tl = buildBrewTimeline(recipe, ROAST, NOW);
    const leg = legacy(recipe);
    const fromTimeline = boundariesFromTimeline(tl);
    const fromLegacy = buildBrewBoundaries(leg.pourSteps, leg.guideSteps, recipe.targetTimeSec);
    assert.deepEqual(fromTimeline, fromLegacy, "boundary schedule changed — haptics/watch would drift");
  });

  test(`${name}: activeStepAt matches the renderer getActiveIdx scan`, () => {
    const tl = buildBrewTimeline(recipe, ROAST, NOW);
    const rendererArray =
      tl.shape === "percolation"
        ? tl.pourSteps
        : tl.shape === "immersion"
          ? tl.guideSteps.filter((s) => !s.isSetup)
          : [];
    if (rendererArray.length === 0) {
      assert.equal(activeStepAt(tl, 30, true), -1);
      return;
    }
    for (let e = 0; e <= recipe.targetTimeSec; e++) {
      assert.equal(
        activeStepAt(tl, e, true),
        getActiveIdx(e, rendererArray),
        `active step mismatch at ${e}s`,
      );
    }
    assert.equal(activeStepAt(tl, 30, false), -1, "not started → -1");
  });
}

test("percolation: a trailing drawdown wait stays percolation (keeps the flow coach)", () => {
  const recipe = RECIPES["percolation-v60-drawdown"];
  // The trailing wait must NOT trigger the immersion guide.
  assert.equal(hasImmersionShape(recipe), false, "trailing drawdown wait misrouted to immersion");
  const tl = buildBrewTimeline(recipe, ROAST, NOW);
  assert.equal(tl.shape, "percolation");
  assert.equal(tl.hasGramsCurve, true, "no grams curve → coachFlow returns none → no flow coach");
  assert.ok(tl.pourSteps && tl.pourSteps.length > 0, "must take the LivePourSequence path");
  assert.equal(tl.guideSteps, null, "must NOT build immersion guide steps");
});

test("percolation: a leading BLOOM REST wait stays percolation (Origami-wave bug)", () => {
  const recipe = RECIPES["percolation-origami-bloom-rest"];
  // The "Bloom Rest" wait is followed by MORE pouring (the Final Pour), so it's a
  // pause between pulses, not a steep — must NOT trigger the immersion guide.
  assert.equal(hasImmersionShape(recipe), false, "bloom-rest wait misrouted to immersion");
  const tl = buildBrewTimeline(recipe, ROAST, NOW);
  assert.equal(tl.shape, "percolation", "flat-bottom pour-over must render as percolation");
  assert.equal(tl.hasGramsCurve, true, "must keep the live flow coach");
  assert.ok(tl.pourSteps && tl.pourSteps.length > 0, "must take the LivePourSequence path");
  assert.equal(tl.guideSteps, null, "must NOT build immersion guide steps");

  // The single big Final Pour must now get a physically-pourable window: its
  // grams / its window must sit near a gentle pour rate, not the impossible ~8 g/s.
  const finalPour = tl.pourSteps.filter((p) => p.action === "final").at(-1);
  assert.ok(finalPour, "final pour present");
  const nextStep = tl.pourSteps.find((p) => p.startTimeSec > finalPour.startTimeSec);
  const windowSec = (nextStep ? nextStep.startTimeSec : tl.targetTimeSec) - finalPour.startTimeSec;
  const rate = finalPour.pourGrams / windowSec;
  assert.ok(rate <= 6, `final pour rate ${rate.toFixed(1)} g/s still implies a hard/impossible pour`);
});

test("immersion: a MID-brew steep (wait before drain/press) still routes to the guide", () => {
  // Guards that the drawdown fix didn't over-reach: Clever (wait → drain) and the
  // inverted AeroPress (invert/press) must remain immersion.
  assert.equal(hasImmersionShape(RECIPES["immersion-clever"]), true, "clever steep lost");
  assert.equal(
    hasImmersionShape(RECIPES["immersion-inverted-aeropress"]),
    true,
    "aeropress steep lost",
  );
});

test("percolation: expectedGramsAt is monotonic 0 → final", () => {
  const tl = buildBrewTimeline(RECIPES["percolation-grams-string"], ROAST, NOW);
  assert.equal(tl.hasGramsCurve, true);
  assert.equal(expectedGramsAt(tl, 0), 0, "0 grams at t=0");

  let prev = -1;
  for (let e = 0; e <= tl.targetTimeSec; e++) {
    const g = expectedGramsAt(tl, e);
    assert.ok(g >= prev - 1e-9, `not monotonic at ${e}s (${g} < ${prev})`);
    prev = g;
  }
  // Past the last pour → final cumulative (500g for this recipe).
  assert.equal(expectedGramsAt(tl, tl.targetTimeSec), 500);
});

test("percolation: expectedGramsAt interpolates mid-bloom", () => {
  // Structured: bloom 45g starting at t=0. pourDurationSec(45) = round(45/4) = 11s.
  // At t=5: 45 * 5/11 ≈ 20.45g.
  const tl = buildBrewTimeline(RECIPES["percolation-structured-with-agitation"], ROAST, NOW);
  const g = expectedGramsAt(tl, 5);
  assert.ok(Math.abs(g - (45 * 5) / 11) < 0.01, `mid-bloom interpolation off: ${g}`);
});

test("immersion + prose: no grams curve (expectedGramsAt null)", () => {
  for (const name of ["immersion-inverted-aeropress", "immersion-clever", "prose-only"]) {
    const tl = buildBrewTimeline(RECIPES[name], ROAST, NOW);
    assert.equal(tl.hasGramsCurve, false, `${name} should have no grams curve`);
    assert.equal(expectedGramsAt(tl, 30), null, `${name} expectedGramsAt should be null`);
  }
});

test("shapes are classified correctly", () => {
  assert.equal(buildBrewTimeline(RECIPES["percolation-structured-with-agitation"], ROAST, NOW).shape, "percolation");
  assert.equal(buildBrewTimeline(RECIPES["percolation-grams-string"], ROAST, NOW).shape, "percolation");
  assert.equal(buildBrewTimeline(RECIPES["immersion-inverted-aeropress"], ROAST, NOW).shape, "immersion");
  assert.equal(buildBrewTimeline(RECIPES["immersion-clever"], ROAST, NOW).shape, "immersion");
  assert.equal(buildBrewTimeline(RECIPES["prose-only"], ROAST, NOW).shape, "prose");
});
