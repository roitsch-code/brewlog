// Brew-notification boundary tests (iOS shell Phase 1). Bundles the REAL
// brewNotifications.ts + pourSequence.ts with esbuild so the asserted schedule
// is the one the app actually computes — not a re-declared copy.
//
//   node --test tests/dataflow/brew-notifications.test.mjs
//
// What's locked down: the lock-screen notification schedule must mirror the
// on-screen step schedule exactly — same startTimeSec per pour, bloom and
// setup steps skipped (the user just pressed Start and is watching), a final
// "brew finishing" boundary at targetTimeSec, and prose-only legacy recipes
// producing NO notifications. A drifting boundary would buzz the phone at the
// wrong moment of a live brew — worse than no notification at all.

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
export { buildBrewBoundaries } from ${JSON.stringify(
  path.join(ROOT, "src/lib/native/brewNotifications.ts"),
)};
export { parsePourSteps, buildGuideSteps } from ${JSON.stringify(
  path.join(ROOT, "src/lib/utils/pourSequence.ts"),
)};
`;
const dir = await mkdtemp(join(tmpdir(), "brewnotif-"));
const out = join(dir, "b.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { buildBrewBoundaries, parsePourSteps, buildGuideSteps } = await import(
  pathToFileURL(out).href
);

// ── Percolation (V60 grams string → PourStep[]) ─────────────────────────────

test("percolation: one boundary per non-bloom pour, times mirror the step schedule", () => {
  // 4 milestones at 210s target, no roastDate → bloom 45s, reserve 69s.
  const steps = parsePourSteps("50 – 120 – 180 – 250", 210);
  assert.ok(steps && steps.length === 4);

  const boundaries = buildBrewBoundaries(steps, null, 210);
  // Bloom (t=0) skipped → 3 pour boundaries + 1 drawdown boundary.
  assert.equal(boundaries.length, 4);

  // Times must be EXACTLY the steps' startTimeSec — same schedule the screen shows.
  assert.deepEqual(
    boundaries.slice(0, 3).map((b) => b.atSec),
    steps.slice(1).map((s) => s.startTimeSec),
  );

  // Title carries the pour delta, body the running total.
  assert.equal(boundaries[0].title, "Pour 2 — +70g");
  assert.equal(boundaries[0].body, "→ 120g total");
  assert.equal(boundaries[2].title, "Final pour — +70g");

  // Final boundary lands at target.
  assert.equal(boundaries[3].atSec, 210);
  assert.equal(boundaries[3].title, "Drawdown — brew finishing");
  assert.match(boundaries[3].body, /3:30/);
});

test("percolation: per-pour temperature annotation lands in the body", () => {
  const steps = parsePourSteps("70 (@70°C) – 220 – 370", 240);
  assert.ok(steps);
  const boundaries = buildBrewBoundaries(steps, null, 240);
  // Bloom carries the 70°C but is skipped; later pours have no temp → plain body.
  assert.equal(boundaries[0].body, "→ 220g total");
});

// ── Immersion / AeroPress (structured steps → GuideStep[]) ──────────────────

test("immersion: setup and t=0 steps skipped, hand-actions get boundaries", () => {
  const recipe = {
    targetTimeSec: 180,
    pourSteps: [
      { label: "Invert the AeroPress", action: "invert" },
      { label: "Pour to 200g", action: "pour", durationSec: 30, waterGramsAtEnd: 200 },
      { label: "Steep", action: "wait", durationSec: 90 },
      { label: "Flip onto cup", action: "flip", durationSec: 5 },
      { label: "Press slowly", action: "press", durationSec: 25 },
    ],
  };
  const guide = buildGuideSteps(recipe);
  assert.ok(guide);

  const boundaries = buildBrewBoundaries(null, guide, 180);
  // Invert (setup) + first pour (t=0) skipped → Steep@30, Flip@120, Press@125,
  // + finishing boundary at 180 (≥5s after the last step boundary).
  assert.deepEqual(
    boundaries.map((b) => [b.atSec, b.title]),
    [
      [30, "Steep"],
      [120, "Flip onto cup"],
      [125, "Press slowly"],
      [180, "Brew finishing"],
    ],
  );
  assert.equal(boundaries[0].body, ""); // no grams/temp/notes on the steep step
});

test("immersion: no finishing boundary when the last step already lands at target", () => {
  const recipe = {
    targetTimeSec: 150,
    pourSteps: [
      { label: "Pour to 250g", action: "pour", durationSec: 30, waterGramsAtEnd: 250 },
      { label: "Steep", action: "wait", durationSec: 117 },
      { label: "Press", action: "press", durationSec: 3 },
    ],
  };
  const guide = buildGuideSteps(recipe);
  const boundaries = buildBrewBoundaries(null, guide, 150);
  // Press starts at 147 — within 5s of target, so no extra finishing boundary.
  assert.deepEqual(
    boundaries.map((b) => b.atSec),
    [30, 147],
  );
});

// ── Legacy prose + empty inputs ──────────────────────────────────────────────

test("prose-only legacy recipe produces no notifications", () => {
  assert.deepEqual(buildBrewBoundaries(null, null, 240), []);
  assert.deepEqual(buildBrewBoundaries([], [], 240), []);
});
