// Shared recipe-validator tests. Bundles the REAL validateRecipe.ts (which pulls
// the REAL timeline builder, grind table, corpus and fidelity guard) with
// esbuild, so these track the actual behaviour rather than a re-declared copy.
//
//   node --test tests/dataflow/validate-recipe.test.mjs
//
// The anchor case is the recipe the owner was actually handed by the chat on
// 2026-08-21: an Orea V4 Classic + Drip Assist at 450 ml whose final pour was
// 225 g — half the water — in the 15 s the clock had left, after a
// two-and-a-half-minute hole. Nothing in the chat path checked it. If this file
// ever goes green on that recipe again, the validator has stopped working.

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
export { validateRecipe, formatProblemsForModel } from ${JSON.stringify(
  path.join(ROOT, "src/lib/recipe/validateRecipe.ts"),
)};
export { buildBrewTimeline } from ${JSON.stringify(path.join(ROOT, "src/lib/brew/timeline.ts"))};
`;
const dir = await mkdtemp(join(tmpdir(), "validate-"));
const out = join(dir, "b.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { validateRecipe, formatProblemsForModel, buildBrewTimeline } = await import(
  pathToFileURL(out).href,
);

const codes = (problems) => problems.map((p) => p.code);

// ── The reported recipe, exactly as the brew screen rendered it ──────────────
const SCREENSHOT_RECIPE = {
  doseGrams: 28,
  waterGrams: 450,
  waterTempC: 94,
  grindSize: "26",
  targetTimeSec: 210,
  pourSteps: [
    { label: "Bloom", action: "bloom", waterGramsAtEnd: 90, durationSec: 45 },
    { label: "Pour 2", action: "pour", waterGramsAtEnd: 225, durationSec: 30 },
    { label: "Final pour", action: "final", waterGramsAtEnd: 450, durationSec: 30 },
  ],
};
const SCREENSHOT_CTX = {
  method: "Orea V4 Classic + Drip Assist",
  basedOn: "April Coffee 1-2-3 Method",
  grinder: "Comandante C40",
  now: Date.parse("2026-08-21T13:19:00Z"),
};

test("THE ANCHOR: the reported recipe is brewable — the RENDERER was the defect", () => {
  // This is the recipe from the owner's screenshot. It was reported as "225g in
  // the 15s the clock had left, after a 2.5-minute hole", and that is what the
  // brew screen showed — but it is NOT what the recipe says. The recipe gives
  // that pour 30s (7.5 g/s, inside Hoffmann's own 8 g/s) and asks for three
  // pours over 3:30. The old renderer threw those durations away, reserved a
  // fixed 33% of the clock for drawdown and squeezed the final pour into what
  // was left. Cadence-first (Sep 2026) the recipe renders as written, so it
  // passes — and the two assertions below are what "passes" has to mean.
  const problems = validateRecipe(SCREENSHOT_RECIPE, SCREENSHOT_CTX);
  // The pours, gaps and clock are sound. The ONE thing left is the owner's
  // 2026-10-10 rule: "April Coffee 1-2-3 Method" is published for 250 g and
  // this brew pours 450 g — a single-cup recipe is not that recipe at 1.8×, so
  // the basedOn is sent back (src/lib/recipe/batchWindow.ts).
  assert.deepEqual(
    codes(problems),
    ["reference-wrong-batch"],
    `the render is sound and only the batch rule fires; got ${JSON.stringify(problems, null, 2)}`,
  );
});

test("THE ANCHOR, as the user saw it: no impossible pour and no hole in the render", () => {
  const tl = buildBrewTimeline(
    SCREENSHOT_RECIPE,
    undefined,
    SCREENSHOT_CTX.now,
    SCREENSHOT_CTX.method,
  );
  const pours = tl.steps.filter((s) => (s.pourGrams ?? 0) > 0);
  // The reported symptom: half the water in the last sliver of the clock.
  for (const p of pours) {
    const rate = (p.pourGrams ?? 0) / (p.timingDurationSec ?? 1);
    assert.ok(rate <= 8.001, `${p.label} renders at ${rate.toFixed(1)} g/s`);
  }
  // The other reported symptom: nothing happening for two and a half minutes.
  for (let i = 0; i < pours.length - 1; i++) {
    const gap = pours[i + 1].startSec - (pours[i].startSec + (pours[i].timingDurationSec ?? 0));
    assert.ok(gap <= 75, `a ${Math.round(gap)}s hole opened between pours`);
  }
  // And the brew does not claim to be over while a pour is still running.
  assert.ok(tl.finishSec >= tl.pourPhaseEndSec);
});

test("a recipe that really is unpourable is still rejected", () => {
  // The same shape, but the model wrote a final pour it cannot honour: 225g in
  // 10s is 22.5 g/s. Nothing in the render can fix a number like that honestly,
  // so the chat is told to rewrite it.
  const problems = validateRecipe(
    {
      ...SCREENSHOT_RECIPE,
      pourSteps: SCREENSHOT_RECIPE.pourSteps.map((s) =>
        s.action === "final" ? { ...s, durationSec: 10 } : s,
      ),
    },
    SCREENSHOT_CTX,
  );
  assert.ok(codes(problems).includes("pour-too-fast"), codes(problems).join(", "));
  const pour = problems.find((p) => p.code === "pour-too-fast");
  assert.match(pour.message, /225g/, "should name the actual pour size");
  assert.match(pour.message, /g\/s/, "should state the implied rate");
});

test("a clock that ends before the pours do is rejected", () => {
  const problems = validateRecipe(
    { ...SCREENSHOT_RECIPE, targetTimeSec: 100 },
    SCREENSHOT_CTX,
  );
  assert.ok(codes(problems).includes("clock-too-short"), codes(problems).join(", "));
});

test("a pour plan that goes backwards is rejected", () => {
  const problems = validateRecipe(
    {
      ...SCREENSHOT_RECIPE,
      pourSteps: [
        { label: "Bloom", action: "bloom", waterGramsAtEnd: 90, durationSec: 45 },
        { label: "Pour 2", action: "pour", waterGramsAtEnd: 300, durationSec: 40 },
        { label: "Final pour", action: "final", waterGramsAtEnd: 225, durationSec: 30 },
      ],
    },
    SCREENSHOT_CTX,
  );
  assert.ok(codes(problems).includes("milestones-not-increasing"), codes(problems).join(", "));
});

test("an immersion recipe whose steps do not add up to its clock is rejected", () => {
  const problems = validateRecipe(
    {
      doseGrams: 18,
      waterGrams: 250,
      waterTempC: 94,
      grindSize: "medium",
      targetTimeSec: 240,
      pourSteps: [
        { label: "Add water", action: "pour", waterGramsAtEnd: 250, durationSec: 20 },
        { label: "Steep", action: "wait", durationSec: 90 },
        { label: "Drain", action: "drain", durationSec: 40 },
      ],
    },
    { method: "Clever Dripper", basedOn: "Own experiment" },
  );
  assert.ok(codes(problems).includes("immersion-sum-mismatch"), codes(problems).join(", "));
});

test("the model gets one actionable block naming every problem", () => {
  const broken = { ...SCREENSHOT_RECIPE, targetTimeSec: 100 };
  const text = formatProblemsForModel(validateRecipe(broken, SCREENSHOT_CTX));
  assert.match(text, /not brewable/i);
  assert.match(text, /start_brew/, "must tell the model how to retry");
});

// ── A sane recipe of the same shape must pass cleanly ────────────────────────
// Same brewer, same volume, same clock — but five pours, so every pour has room
// and no hole opens up. This is the recipe the chat should have written.
test("a well-formed 450ml disc recipe passes", () => {
  const problems = validateRecipe(
    {
      doseGrams: 28,
      waterGrams: 450,
      waterTempC: 94,
      grindSize: "27 clicks",
      targetTimeSec: 240,
      pourSteps: [
        { label: "Bloom", action: "bloom", waterGramsAtEnd: 60, durationSec: 15 },
        { label: "Pour 2", action: "pour", waterGramsAtEnd: 160, durationSec: 20 },
        { label: "Pour 3", action: "pour", waterGramsAtEnd: 260, durationSec: 20 },
        { label: "Pour 4", action: "pour", waterGramsAtEnd: 360, durationSec: 20 },
        { label: "Final pour", action: "final", waterGramsAtEnd: 450, durationSec: 20 },
      ],
    },
    { method: "Orea V4 Classic + Drip Assist", basedOn: "Own experiment", grinder: "Comandante C40" },
  );
  assert.deepEqual(problems, [], `expected no problems, got ${JSON.stringify(problems, null, 2)}`);
});

// ── Grind unit ───────────────────────────────────────────────────────────────
test("degrees handed to a Comandante is caught", () => {
  const problems = validateRecipe(
    { doseGrams: 15, waterGrams: 250, waterTempC: 93, grindSize: "390°", targetTimeSec: 180 },
    { grinder: "Comandante C40", basedOn: "Own experiment" },
  );
  assert.ok(codes(problems).includes("grind-unit"));
  assert.match(problems.find((p) => p.code === "grind-unit").message, /clicks/);
});

test("clicks handed to a Comandante is left alone", () => {
  const problems = validateRecipe(
    { doseGrams: 15, waterGrams: 250, waterTempC: 93, grindSize: "24 clicks", targetTimeSec: 180 },
    { grinder: "Comandante C40", basedOn: "Own experiment" },
  );
  assert.ok(!codes(problems).includes("grind-unit"));
});

// ── The honest escape hatch ──────────────────────────────────────────────────
test('"Own experiment" is never checked for reference drift', () => {
  const drifted = {
    doseGrams: 20,
    waterGrams: 300,
    waterTempC: 78,
    grindSize: "500°",
    targetTimeSec: 600,
    pourSteps: [
      { label: "Bloom", action: "bloom", waterGramsAtEnd: 60, durationSec: 30 },
      { label: "Pour", action: "pour", waterGramsAtEnd: 300, durationSec: 60 },
    ],
  };
  const asOwn = validateRecipe(drifted, { basedOn: "Own experiment" });
  assert.ok(!codes(asOwn).includes("reference-drift"));
});

test("a recipe claiming a verified reference it does not carry is flagged", () => {
  // Kasuya 4:6 is 20g:300g / 93°C / ~3:30. Same name, a different brew.
  const problems = validateRecipe(
    {
      doseGrams: 20,
      waterGrams: 300,
      waterTempC: 78,
      grindSize: "300°",
      targetTimeSec: 600,
      pourSteps: [
        { label: "Bloom", action: "bloom", waterGramsAtEnd: 60, durationSec: 30 },
        { label: "Pour", action: "pour", waterGramsAtEnd: 300, durationSec: 90 },
      ],
    },
    { basedOn: "Kasuya 4:6", method: "V60" },
  );
  assert.ok(
    codes(problems).includes("reference-drift"),
    `expected reference-drift, got: ${codes(problems).join(", ")}`,
  );
});

// ── Vessel ───────────────────────────────────────────────────────────────────
test("an AeroPress asked to hold 450g is flagged", () => {
  const problems = validateRecipe(
    { doseGrams: 28, waterGrams: 450, waterTempC: 94, grindSize: "380°", targetTimeSec: 180 },
    { method: "AeroPress", basedOn: "Own experiment" },
  );
  assert.ok(codes(problems).includes("vessel-overflow"));
});

// ── Non-regression: the validator must not reject the real corpus ────────────
test("immersion recipes are not judged on pour cadence", () => {
  const problems = validateRecipe(
    {
      doseGrams: 18,
      waterGrams: 225,
      waterTempC: 93,
      grindSize: "360°",
      targetTimeSec: 135,
      pourSteps: [
        { label: "Add water", action: "pour", waterGramsAtEnd: 225, durationSec: 20 },
        { label: "Steep", action: "wait", durationSec: 90 },
        { label: "Press", action: "press", durationSec: 25 },
      ],
    },
    { method: "AeroPress", basedOn: "Own experiment" },
  );
  assert.ok(!codes(problems).includes("pour-too-fast"));
  assert.ok(!codes(problems).includes("dead-gap"));
});
