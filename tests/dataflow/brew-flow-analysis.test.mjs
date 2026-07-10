// Post-brew flow-analysis tests. Bundles the REAL flowAnalysis.ts + timeline.ts
// and asserts the measured grade, per-pour timing, overshoot, steadiness, and
// the sample cap on synthetic weight curves.
//
//   node --test tests/dataflow/brew-flow-analysis.test.mjs

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
export { analyzeFlow } from ${JSON.stringify(path.join(ROOT, "src/lib/brew/flowAnalysis.ts"))};
export { buildBrewTimeline } from ${JSON.stringify(path.join(ROOT, "src/lib/brew/timeline.ts"))};
`;
const dir = await mkdtemp(join(tmpdir(), "flowan-"));
const out = join(dir, "fa.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { analyzeFlow, buildBrewTimeline } = await import(pathToFileURL(out).href);

const ROAST = "2026-06-01";
const NOW = new Date("2026-06-16T08:00:00Z").getTime();

// "50 – 180 – 320 – 500" @210 → milestones at 50/180/320/500g.
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

// A curve that hits each cumulative target at the given times.
const CURVE = [
  { tSec: 0, grams: 0 },
  { tSec: 10, grams: 50 },
  { tSec: 70, grams: 180 },
  { tSec: 120, grams: 320 },
  { tSec: 180, grams: 500 },
];

test("derivedFlow grades total time vs target", () => {
  assert.equal(analyzeFlow(PERC, CURVE, 210).derivedFlow, "perfect");
  assert.equal(analyzeFlow(PERC, CURVE, 160).derivedFlow, "too-fast");
  assert.equal(analyzeFlow(PERC, CURVE, 260).derivedFlow, "too-slow");
});

test("per-pour timing: target reach times + error", () => {
  const a = analyzeFlow(PERC, CURVE, 210);
  assert.equal(a.perPour.length, 4);
  assert.equal(a.perPour[0].targetGrams, 50);
  assert.equal(a.perPour[0].actualSec, 10);
  assert.equal(a.perPour[3].targetGrams, 500);
  assert.equal(a.perPour[3].actualSec, 180);
  // Each errorSec is a finite number (late/early offset).
  for (const p of a.perPour) assert.equal(typeof p.errorSec, "number");
});

test("flow-rate + steadiness are computed", () => {
  const a = analyzeFlow(PERC, CURVE, 210);
  assert.ok(a.avgFlowRateGPS > 0);
  assert.ok(a.peakFlowRateGPS >= a.avgFlowRateGPS);
  assert.ok(a.pourSteadiness != null && a.pourSteadiness >= 0);
  assert.equal(a.finalGrams, 500);
});

test("overshoot is positive when the pour runs ahead of plan", () => {
  // CURVE reaches each milestone earlier than the intended schedule → ahead.
  const a = analyzeFlow(PERC, CURVE, 210);
  assert.ok(a.overshootG > 0, `expected positive overshoot, got ${a.overshootG}`);
});

test("samples are capped at 80", () => {
  const big = Array.from({ length: 500 }, (_, i) => ({ tSec: i * 0.4, grams: i }));
  const a = analyzeFlow(PERC, big, 200);
  assert.ok(a.samples.length <= 80);
  assert.equal(a.samples[0].tSec, 0); // keeps first
  assert.equal(a.samples[a.samples.length - 1].grams, 499); // keeps last
});

test("un-tared scale: a constant vessel offset is normalized out", () => {
  // Same brew as CURVE, but the scale was never tared — every reading carries a
  // 583g vessel/coffee baseline. The analysis must read the SAME water-poured
  // numbers as the tared curve, not treat the vessel weight as a +583g overshoot
  // that reaches every target at t≈0 (the "56 g/s / +583.5g / 133s early" bug).
  const OFFSET = 583;
  const untared = CURVE.map((p) => ({ tSec: p.tSec, grams: p.grams + OFFSET }));
  const a = analyzeFlow(PERC, untared, 210);
  const tared = analyzeFlow(PERC, CURVE, 210);
  assert.equal(a.finalGrams, tared.finalGrams); // 500, not ~1083
  assert.equal(a.overshootG, tared.overshootG); // sane, not +583
  assert.equal(a.avgFlowRateGPS, tared.avgFlowRateGPS); // ~5 g/s, not 56
  assert.equal(a.perPour[0].actualSec, 10); // reaches 50g at 10s, not t≈0
  assert.ok(a.overshootG < 100, `overshoot should be sane, got ${a.overshootG}`);
});

test("a lone spike (bump / lift) is NOT judged as overshoot or an early reach", () => {
  // A clean gradual pour…
  const clean = [
    { tSec: 0, grams: 0 },
    { tSec: 30, grams: 50 },
    { tSec: 60, grams: 90 },
    { tSec: 95, grams: 180 },
    { tSec: 120, grams: 260 },
    { tSec: 150, grams: 320 },
    { tSec: 175, grams: 420 },
    { tSec: 200, grams: 500 },
  ];
  // …the same pour, but the scale was bumped once (a single sample spikes to
  // 330g at t=65, then drops right back). It must not manufacture a phantom
  // overshoot, and must not mark the 320g target as reached at t=65.
  const spiked = [
    { tSec: 0, grams: 0 },
    { tSec: 30, grams: 50 },
    { tSec: 60, grams: 90 },
    { tSec: 65, grams: 330 }, // ← the bump
    { tSec: 70, grams: 100 },
    { tSec: 95, grams: 180 },
    { tSec: 120, grams: 260 },
    { tSec: 150, grams: 320 },
    { tSec: 175, grams: 420 },
    { tSec: 200, grams: 500 },
  ];
  const a = analyzeFlow(PERC, clean, 210);
  const b = analyzeFlow(PERC, spiked, 210);
  // The spike doesn't inflate overshoot (without the guard b would be ~+150 more).
  assert.ok(Math.abs(b.overshootG - a.overshootG) < 5, `spike leaked into overshoot: ${a.overshootG} vs ${b.overshootG}`);
  // The 320g pour is still reached at 150s, not at the 65s bump.
  assert.equal(b.perPour[2].targetGrams, 320);
  assert.equal(b.perPour[2].actualSec, 150);
});

test("a carafe placed on the scale MID-BREW is a baseline shift, not poured water", () => {
  // The owner's report: brew started (tare baseline captured), then the carafe
  // was set onto the scale to brew into → every raw reading from then on
  // carries +300g the start-baseline can't see. Analysis read "+296.7g
  // overshoot / 66 g/s / Pour 3 hit 300g 106s early". The +300g step HOLDS
  // (unlike a bump), so it must fold into the baseline.
  const carafe = [
    { tSec: 0, grams: 0 },
    { tSec: 10, grams: 50 }, // bloom poured
    { tSec: 30, grams: 50 },
    { tSec: 42, grams: 50 },
    { tSec: 44, grams: 350 }, // ← carafe lands (+300) and STAYS
    { tSec: 46, grams: 350 },
    { tSec: 70, grams: 480 }, // pour 2 → 180g real water
    { tSec: 120, grams: 620 }, // pour 3 → 320g
    { tSec: 180, grams: 800 }, // final → 500g
  ];
  const a = analyzeFlow(PERC, carafe, 210);
  assert.equal(a.finalGrams, 500, "final water must be 500g, not 800g");
  assert.equal(a.perPour[3].targetGrams, 500);
  assert.equal(a.perPour[3].actualSec, 180, "final pour reached at 180s, not early");
  assert.ok(a.overshootG == null || a.overshootG < 100, `phantom overshoot: +${a.overshootG}g`);
  assert.ok(a.avgFlowRateGPS != null && a.avgFlowRateGPS < 15, `absurd flow rate: ${a.avgFlowRateGPS} g/s`);
});

test("a vessel lifted OFF the scale mid-brew (or a mid-brew Tare) also folds into the baseline", () => {
  const lifted = [
    { tSec: 0, grams: 0 },
    { tSec: 10, grams: 50 },
    { tSec: 70, grams: 180 },
    { tSec: 90, grams: 180 },
    { tSec: 92, grams: 0 }, // ← user hit Tare on the Acaia mid-brew; level HOLDS
    { tSec: 94, grams: 0 },
    { tSec: 120, grams: 140 }, // pour 3 continues → 320g cumulative real water
    { tSec: 180, grams: 320 }, // final → 500g cumulative real water
  ];
  const a = analyzeFlow(PERC, lifted, 210);
  assert.equal(a.finalGrams, 500, "cumulative water must survive a mid-brew tare");
  assert.equal(a.perPour[3].actualSec, 180);
});

test("immersion / too-few-points → null", () => {
  assert.equal(analyzeFlow(IMMERSION, CURVE, 150), null);
  assert.equal(analyzeFlow(PERC, [{ tSec: 0, grams: 0 }], 210), null);
  assert.equal(analyzeFlow(null, CURVE, 210), null);
});
