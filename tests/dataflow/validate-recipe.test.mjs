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
const entry = `export { validateRecipe, formatProblemsForModel } from ${JSON.stringify(
  path.join(ROOT, "src/lib/recipe/validateRecipe.ts"),
)};`;
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
const { validateRecipe, formatProblemsForModel } = await import(pathToFileURL(out).href);

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

test("THE ANCHOR: the recipe the chat actually shipped is rejected", () => {
  const problems = validateRecipe(SCREENSHOT_RECIPE, SCREENSHOT_CTX);
  assert.ok(problems.length > 0, "the reported recipe must not pass validation");

  // Its defining defect: half the water in the last sliver of the clock.
  assert.ok(
    codes(problems).includes("pour-too-fast"),
    `expected a pourability problem, got: ${JSON.stringify(problems, null, 2)}`,
  );

  const pour = problems.find((p) => p.code === "pour-too-fast");
  assert.match(pour.message, /225g/, "should name the actual pour size");
  assert.match(pour.message, /g\/s/, "should state the implied rate");
});

test("the dead gap before the final pour is reported too", () => {
  const problems = validateRecipe(SCREENSHOT_RECIPE, SCREENSHOT_CTX);
  assert.ok(
    codes(problems).includes("dead-gap"),
    `expected a dead-gap problem, got: ${codes(problems).join(", ")}`,
  );
});

test("the model gets one actionable block naming every problem", () => {
  const text = formatProblemsForModel(validateRecipe(SCREENSHOT_RECIPE, SCREENSHOT_CTX));
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
