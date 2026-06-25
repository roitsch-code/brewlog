// Live pour-flow coach tests. Bundles the REAL flowCoach.ts + timeline.ts and
// asserts each teaching cue fires on the right weight/rate situation.
//
//   node --test tests/dataflow/brew-flowcoach.test.mjs
//
// Locked: least-squares flow rate from a noisy-ish sample window; and the cue
// boundaries — pour-slower (too fast), keep-flow (stalled mid-pour), pour-faster
// (too slow), ease-off (near target), overshot, hold (reached), steady; plus
// graceful no-data on the immersion path.

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
export { coachFlow, flowRateGPS } from ${JSON.stringify(path.join(ROOT, "src/lib/brew/flowCoach.ts"))};
export { buildBrewTimeline } from ${JSON.stringify(path.join(ROOT, "src/lib/brew/timeline.ts"))};
`;
const dir = await mkdtemp(join(tmpdir(), "flowcoach-"));
const out = join(dir, "fc.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { coachFlow, flowRateGPS, buildBrewTimeline } = await import(pathToFileURL(out).href);

const ROAST = "2026-06-01";
const NOW = new Date("2026-06-16T08:00:00Z").getTime();

// "50 – 180 – 320 – 500" @210s → bloom@0(50), pour@45(180), pour@93(320), final@141(500).
const PERC = buildBrewTimeline(
  { doseGrams: 15, waterGrams: 500, waterTempC: 94, grindSize: "medium", targetTimeSec: 210, pourSequence: "50 – 180 – 320 – 500" },
  ROAST,
  NOW,
);
const IMMERSION = buildBrewTimeline(
  {
    doseGrams: 15, waterGrams: 250, waterTempC: 94, grindSize: "medium", targetTimeSec: 150,
    pourSteps: [
      { label: "Add water", action: "pour", waterGramsAtEnd: 200, durationSec: 15 },
      { label: "Steep", action: "wait", durationSec: 90 },
      { label: "Press", action: "press", durationSec: 25 },
    ],
  },
  ROAST,
  NOW,
);

// Samples that encode a given pour rate (g/s) over a 1.4s window.
function ramp(rateGPS) {
  const out = [];
  for (let i = 0; i < 8; i++) out.push({ atMs: 100000 + i * 200, grams: 50 + i * 0.2 * rateGPS });
  return out;
}

test("flowRateGPS = least-squares slope of the sample window", () => {
  assert.ok(Math.abs(flowRateGPS(ramp(8)) - 8) < 0.01);
  assert.ok(Math.abs(flowRateGPS(ramp(4)) - 4) < 0.01);
  assert.equal(flowRateGPS([{ atMs: 1, grams: 5 }]), null); // need ≥2
});

// Mid-pour on step 1 (target 180g): elapsed in [45,93), plenty remaining.
const ELAPSED_MID = 60;

test("too fast → pour-slower", () => {
  const c = coachFlow(PERC, ELAPSED_MID, true, 90, ramp(8));
  assert.equal(c.cue, "pour-slower");
  assert.equal(c.state, "ahead");
});

test("stalled mid-pour → keep-flow", () => {
  const c = coachFlow(PERC, ELAPSED_MID, true, 90, ramp(0));
  assert.equal(c.cue, "keep-flow");
  assert.equal(c.state, "behind");
});

test("too slow (but moving) → pour-faster", () => {
  const c = coachFlow(PERC, ELAPSED_MID, true, 90, ramp(1));
  assert.equal(c.cue, "pour-faster");
  assert.equal(c.state, "behind");
});

test("good rate → steady", () => {
  const c = coachFlow(PERC, ELAPSED_MID, true, 90, ramp(4));
  assert.equal(c.cue, "steady");
  assert.equal(c.state, "on-track");
});

test("near the target → ease-off", () => {
  // target 180, live 172 → 8g remaining (≤15) at a fine rate.
  const c = coachFlow(PERC, ELAPSED_MID, true, 172, ramp(4));
  assert.equal(c.cue, "ease-off");
});

test("reached the target → hold", () => {
  const c = coachFlow(PERC, ELAPSED_MID, true, 180, ramp(0));
  assert.equal(c.cue, "hold");
  assert.match(c.message, /hold/i);
});

test("past the target → overshot with +Xg", () => {
  const c = coachFlow(PERC, ELAPSED_MID, true, 192, ramp(0));
  assert.equal(c.cue, "overshot");
  assert.equal(c.detail, "+12g");
  assert.equal(c.state, "ahead");
});

test("detail shows grams-to-go and rate", () => {
  const c = coachFlow(PERC, ELAPSED_MID, true, 90, ramp(4));
  assert.match(c.detail, /90g to go · 4\.0 g\/s/);
});

test("immersion: steep step (no grams target) → no-data, no cue", () => {
  // At t=30 the active step is the 90s steep (no cumulative grams) → time-only.
  assert.equal(coachFlow(IMMERSION, 30, true, 100, ramp(4)).cue, "none");
  assert.equal(coachFlow(IMMERSION, 30, true, 100, ramp(4)).state, "no-data");
  assert.equal(coachFlow(PERC, 60, true, null, []).cue, "none"); // no weight yet
  assert.equal(coachFlow(PERC, 60, false, 90, ramp(4)).cue, "none"); // not started
});

test("immersion: the water-POUR step gets scale coaching (AeroPress fix)", () => {
  // At t=8 the active step is "Add water → 200g" (start 0, 15s). The scale must
  // coach the pour just like a pour-over, not stay silent.
  const c = coachFlow(IMMERSION, 8, true, 100, ramp(4));
  assert.notEqual(c.cue, "none");
  assert.equal(c.liveGrams, 100);
  assert.equal(c.currentStepTargetG, 200);
  // Past the target on that pour → the "Overshot +Xg" cue from the screenshot.
  const over = coachFlow(IMMERSION, 8, true, 215, ramp(4));
  assert.equal(over.cue, "overshot");
  assert.equal(over.detail, "+15g");
});
