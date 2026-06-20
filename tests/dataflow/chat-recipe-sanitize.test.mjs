// The home-chat `start_brew` path must hand the brew timer a recipe the renderer
// can actually lay out — same treatment /recommend gives its recipes.
//
//   node --test tests/dataflow/chat-recipe-sanitize.test.mjs
//
// THE BUG THIS LOCKS: a chat-authored AeroPress recipe arrived with drifted step
// actions ("Steep", "Plunge") and NO pourSequence string. The brew renderers
// match `step.action` against the exact BrewStepAction vocabulary, so the
// immersion guide (which fires on press/invert/flip/long-wait) never recognised
// it, fell back to the pour-over renderer, found no cumulative-grams milestones,
// and showed an EMPTY pour guide. sanitizePourSteps normalizes the actions so
// hasImmersionShape routes it to the step guide; pourSequenceFromSteps adds the
// legacy backstop string.

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
export { sanitizePourSteps, pourSequenceFromSteps, normalizeStepAction } from ${JSON.stringify(
  path.join(ROOT, "src/lib/utils/pourSteps.ts"),
)};
export { buildBrewTimeline } from ${JSON.stringify(path.join(ROOT, "src/lib/brew/timeline.ts"))};
`;
const dir = await mkdtemp(join(tmpdir(), "chatrec-"));
const out = join(dir, "m.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { sanitizePourSteps, pourSequenceFromSteps, normalizeStepAction, buildBrewTimeline } =
  await import(pathToFileURL(out).href);

test("normalizeStepAction maps drifted AeroPress wording onto the vocabulary", () => {
  assert.equal(normalizeStepAction("Plunge"), "press");
  assert.equal(normalizeStepAction("Steep"), "wait");
  assert.equal(normalizeStepAction("Invert"), "invert");
  assert.equal(normalizeStepAction("Pour"), "pour");
  assert.equal(normalizeStepAction("Bloom"), "bloom");
});

// The exact failure the owner hit: an AeroPress recipe from the chat with
// capitalised / synonym actions and no pourSequence string.
const rawAeroPress = {
  doseGrams: 15,
  waterGrams: 220,
  waterTempC: 90,
  grindSize: "medium-fine",
  targetTimeSec: 150,
  pourSteps: [
    { label: "Add coffee, pour 220g", action: "Pour", waterGramsAtEnd: 220 },
    { label: "Steep", action: "Steep", durationSec: 90 },
    { label: "Plunge slowly", action: "Plunge", durationSec: 30 },
  ],
};

test("sanitizePourSteps normalizes actions and keeps ≥2 steps", () => {
  const clean = sanitizePourSteps(rawAeroPress.pourSteps);
  assert.ok(clean, "expected a sanitized array");
  assert.deepEqual(
    clean.map((s) => s.action),
    ["pour", "wait", "press"],
  );
});

test("BEFORE: raw AeroPress steps render NO immersion guide (the bug)", () => {
  // Drifted actions → hasImmersionShape can't see press/wait → mis-routes.
  const t = buildBrewTimeline(rawAeroPress, "2026-06-01", new Date("2026-06-16T08:00:00Z").getTime());
  assert.notEqual(t.shape, "immersion");
});

test("AFTER: sanitized AeroPress routes to the immersion step guide", () => {
  const clean = sanitizePourSteps(rawAeroPress.pourSteps);
  const recipe = { ...rawAeroPress, pourSteps: clean };
  const t = buildBrewTimeline(recipe, "2026-06-01", new Date("2026-06-16T08:00:00Z").getTime());
  assert.equal(t.shape, "immersion");
  assert.ok(t.guideSteps && t.guideSteps.length >= 2, "expected populated guide steps");
});

test("pourSequenceFromSteps derives the legacy grams backstop for pour-overs", () => {
  const pourOver = sanitizePourSteps([
    { label: "Bloom", action: "Bloom", waterGramsAtEnd: 50 },
    { label: "Pour to 180", action: "Pour", waterGramsAtEnd: 180 },
    { label: "Final pour", action: "Final", waterGramsAtEnd: 320 },
  ]);
  assert.equal(pourSequenceFromSteps(pourOver), "50 – 180 – 320");
  // AeroPress (only one water-adding milestone) → no useful string backstop.
  assert.equal(pourSequenceFromSteps(sanitizePourSteps(rawAeroPress.pourSteps)), undefined);
});
