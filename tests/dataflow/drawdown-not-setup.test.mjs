// The drawdown is a brew step, never a setup step.
//
//   node --test tests/dataflow/drawdown-not-setup.test.mjs
//
// Reported 2026-10-10 (Clever, water-first): the timer ended on "Let grounds
// settle — 0:00 left" and ran over, while the SETUP card read "Place on carafe —
// drawdown". The drain step was classified as pre-brew setup because its LABEL
// starts with "Place", so the whole drawdown left the timeline — and the
// physics guard, which uses the same classifier, shrank the clock to match.
// Hoffmann's own verified Clever recipe (reference.ts) uses exactly that label.

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
export { buildGuideSteps, isSetupAction } from ${JSON.stringify(path.join(ROOT, "src/lib/utils/pourSequence.ts"))};
export { buildBrewTimeline } from ${JSON.stringify(path.join(ROOT, "src/lib/brew/timeline.ts"))};
export { enforceRecipePhysics } from ${JSON.stringify(path.join(ROOT, "src/lib/recipe/enforceRecipePhysics.ts"))};
`;
const dir = await mkdtemp(join(tmpdir(), "drawdown-"));
const out = join(dir, "d.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { buildGuideSteps, isSetupAction, buildBrewTimeline, enforceRecipePhysics } = await import(
  pathToFileURL(out).href
);

// The shape the reported recipe carried (Hoffmann Ultimate Clever).
const clever = {
  doseGrams: 18,
  waterGrams: 300,
  waterTempC: 100,
  grindSize: "405°",
  targetTimeSec: 240,
  pourSequence: "",
  pourSteps: [
    { label: "Pour water first (off boil)", action: "pour", waterGramsAtEnd: 300, durationSec: 15 },
    { label: "Add coffee + gentle stir to wet", action: "stir", durationSec: 5 },
    { label: "Steep", action: "wait", durationSec: 120 },
    { label: "Break the crust (one gentle stir)", action: "stir", durationSec: 5 },
    { label: "Let grounds settle", action: "wait", durationSec: 30 },
    { label: "Place on carafe — drawdown", action: "drain", durationSec: 65 },
  ],
};

test("a drain step labelled 'Place on carafe' is a timed step, not setup", () => {
  assert.equal(isSetupAction("drain", "Place on carafe — drawdown"), false);
  const g = buildGuideSteps(clever);
  const drain = g.find((s) => s.action === "drain");
  assert.equal(drain.isSetup, false);
  assert.equal(drain.startTimeSec, 175);
  assert.equal(drain.startTimeSec + drain.durationSec, 240, "the steps end where the clock ends");
});

test("press / flip / bypass are never setup either, whatever the label says", () => {
  for (const a of ["press", "flip", "bypass", "drain"]) {
    assert.equal(isSetupAction(a, "Place cap and " + a), false, a);
  }
});

test("real setup steps still stay setup", () => {
  assert.equal(isSetupAction("wait", "Place 120g ice in server"), true);
  assert.equal(isSetupAction("invert", "Setup inverted, add coffee"), true);
  assert.equal(isSetupAction("wait", "Rinse filter, discard water"), true);
});

test("the rendered timeline keeps the drawdown as its last step", () => {
  const tl = buildBrewTimeline(clever, { method: "Clever Dripper" });
  const timed = tl.steps;
  assert.equal(timed[timed.length - 1].action, "drain");
  assert.ok(!tl.setupSteps.some((s) => s.action === "drain"));
});

test("the physics guard does not shave the drawdown off the clock", () => {
  const r = enforceRecipePhysics(clever, { method: "Clever Dripper" });
  assert.equal(r.dropped, false);
  assert.equal(r.recipe.targetTimeSec, 240, r.changes.join("; "));
});
