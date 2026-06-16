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

test("immersion / too-few-points → null", () => {
  assert.equal(analyzeFlow(IMMERSION, CURVE, 150), null);
  assert.equal(analyzeFlow(PERC, [{ tSec: 0, grams: 0 }], 210), null);
  assert.equal(analyzeFlow(null, CURVE, 210), null);
});
