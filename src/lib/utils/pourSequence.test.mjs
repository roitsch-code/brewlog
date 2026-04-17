// Unit tests for the pour-over timing formula. Pure math, zero dependencies —
// run with:  node --test src/lib/utils/pourSequence.test.mjs
//
// The tests duplicate the logic instead of importing from the .ts module so
// this file runs under plain Node with no TypeScript loader. If the math in
// pourSequence.ts ever changes, update this file too — the point of the tests
// is that the formula keeps producing the exact milestones documented below.

import { test } from "node:test";
import assert from "node:assert/strict";

// ── Re-declared pure math (MUST stay in sync with src/lib/utils/pourSequence.ts) ──

function getBloomDuration(roastDate, now = Date.now()) {
  if (roastDate) {
    const daysOld = Math.floor((now - new Date(roastDate).getTime()) / 86_400_000);
    if (daysOld < 7) return 50;
    if (daysOld < 22) return 45;
    return 30;
  }
  return 45;
}

function parsePourSteps(sequence, targetTimeSec, roastDate, now = Date.now()) {
  const parts = sequence.split(/\s*[–—\-]\s*/).map((s) => s.trim());
  if (parts.length < 2 || !parts.every((p) => /^\d+$/.test(p))) return null;

  const milestones = parts.map(Number);
  const n = milestones.length;
  const bloomDur = getBloomDuration(roastDate, now);
  const drawdownReserve = Math.round(targetTimeSec * 0.33);
  const remaining = targetTimeSec - bloomDur - drawdownReserve;
  const interval = n > 2 ? remaining / (n - 2) : 0;

  return milestones.map((grams, i) => ({
    index: i,
    label: i === 0 ? "Bloom" : i === n - 1 ? "Final pour" : `Pour ${i + 1}`,
    cumulativeGrams: grams,
    pourGrams: i === 0 ? grams : grams - milestones[i - 1],
    startTimeSec: i === 0 ? 0 : Math.round(bloomDur + (i - 1) * interval),
    action: i === 0 ? "bloom" : i === n - 1 ? "final" : "pour",
  }));
}

function getActiveIdx(elapsed, steps) {
  let idx = 0;
  for (let i = 0; i < steps.length; i++) {
    if (elapsed >= steps[i].startTimeSec) idx = i;
  }
  return idx;
}

// Fixed clock: Apr 17 2026. Lets roast-date branches be exercised deterministically.
const NOW = new Date("2026-04-17T00:00:00Z").getTime();
const freshRoast = new Date(NOW - 2 * 86_400_000).toISOString();   // 2 days old
const peakRoast = new Date(NOW - 14 * 86_400_000).toISOString();   // 14 days old
const pastPeakRoast = new Date(NOW - 40 * 86_400_000).toISOString(); // 40 days old

// ── getBloomDuration ───────────────────────────────────────────────────────

test("getBloomDuration: no date → 45s default (peak)", () => {
  assert.equal(getBloomDuration(undefined, NOW), 45);
});

test("getBloomDuration: < 7 days old → 50s (very fresh, heavy CO2)", () => {
  assert.equal(getBloomDuration(freshRoast, NOW), 50);
});

test("getBloomDuration: 7–21 days → 45s (peak window)", () => {
  assert.equal(getBloomDuration(peakRoast, NOW), 45);
});

test("getBloomDuration: > 21 days → 30s (past peak)", () => {
  assert.equal(getBloomDuration(pastPeakRoast, NOW), 30);
});

test("getBloomDuration: exactly 22 days old → 30s (boundary)", () => {
  const twentyTwo = new Date(NOW - 22 * 86_400_000).toISOString();
  assert.equal(getBloomDuration(twentyTwo, NOW), 30);
});

// ── parsePourSteps: core invariant ─────────────────────────────────────────

test("parsePourSteps: last pour lands at targetTime − drawdownReserve", () => {
  // 270s target, 4 pours, peak roast (45s bloom): last pour must be at 181s
  const steps = parsePourSteps("50 – 180 – 320 – 500", 270, peakRoast, NOW);
  assert.ok(steps, "should parse");
  const last = steps.at(-1);
  assert.equal(last.startTimeSec, 270 - Math.round(270 * 0.33)); // 270 − 89 = 181
  assert.equal(last.startTimeSec, 181);
  assert.equal(last.action, "final");
});

test("parsePourSteps: classic 4-pour Kasuya-style schedule at peak roast", () => {
  const steps = parsePourSteps("50 – 180 – 320 – 500", 270, peakRoast, NOW);
  assert.ok(steps);
  assert.equal(steps.length, 4);
  assert.deepEqual(
    steps.map((s) => s.startTimeSec),
    [0, 45, 113, 181], // bloom, interval of (270 − 45 − 89)/2 ≈ 68s between pours
  );
  assert.deepEqual(
    steps.map((s) => s.pourGrams),
    [50, 130, 140, 180],
  );
  assert.deepEqual(
    steps.map((s) => s.label),
    ["Bloom", "Pour 2", "Pour 3", "Final pour"],
  );
});

test("parsePourSteps: 210s total with peak roast, 4 pours", () => {
  const steps = parsePourSteps("40 – 140 – 240 – 340", 210, peakRoast, NOW);
  assert.ok(steps);
  const last = steps.at(-1);
  // 210 × 0.33 = 69.3 → 69s reserve. Last pour at 210 − 69 = 141s.
  assert.equal(last.startTimeSec, 141);
});

test("parsePourSteps: very fresh bean (50s bloom) shifts schedule", () => {
  const steps = parsePourSteps("50 – 180 – 320 – 500", 270, freshRoast, NOW);
  assert.ok(steps);
  assert.equal(steps[0].startTimeSec, 0);
  assert.equal(steps[1].startTimeSec, 50); // bloom done at 50s, not 45s
  // Final still lands at drawdown-reserve boundary
  assert.equal(steps.at(-1).startTimeSec, 270 - Math.round(270 * 0.33));
});

test("parsePourSteps: 3-pour schedule has one interval between pour 1 and final", () => {
  // n=3 means n-2=1 interval
  const steps = parsePourSteps("60 – 250 – 450", 240, peakRoast, NOW);
  assert.ok(steps);
  assert.equal(steps.length, 3);
  // bloom at 0, pour 2 at 45, final at 240 − round(240×0.33)=240−79=161
  assert.equal(steps[0].startTimeSec, 0);
  assert.equal(steps[1].startTimeSec, 45);
  assert.equal(steps[2].startTimeSec, 161);
});

test("parsePourSteps: 2-pour (bloom + single pour) edge case", () => {
  // n=2 means interval=0 (no middle pours); final equals bloom end
  const steps = parsePourSteps("40 – 300", 210, peakRoast, NOW);
  assert.ok(steps);
  assert.equal(steps.length, 2);
  assert.equal(steps[0].startTimeSec, 0);
  // With n=2, the "final" pour starts at bloomDur (45s) — the formula's
  // defined behaviour for the trivial case.
  assert.equal(steps[1].startTimeSec, 45);
});

test("parsePourSteps: pourGrams are derived from cumulative milestones", () => {
  const steps = parsePourSteps("50 – 180 – 320 – 500", 270, peakRoast, NOW);
  assert.ok(steps);
  // Sum of pour increments must equal the last cumulative milestone
  const total = steps.reduce((acc, s) => acc + s.pourGrams, 0);
  assert.equal(total, 500);
});

test("parsePourSteps: accepts en-dash, em-dash, and hyphen separators", () => {
  for (const sep of [" – ", " — ", " - "]) {
    const steps = parsePourSteps(`50${sep}180${sep}320${sep}500`, 270, peakRoast, NOW);
    assert.ok(steps, `separator "${sep}" should parse`);
    assert.equal(steps.length, 4);
  }
});

test("parsePourSteps: rejects non-numeric sequences", () => {
  assert.equal(parsePourSteps("bloom then pour", 270, peakRoast, NOW), null);
  assert.equal(parsePourSteps("50", 270, peakRoast, NOW), null);
  assert.equal(parsePourSteps("", 270, peakRoast, NOW), null);
});

test("parsePourSteps: drawdown reserve scales proportionally (not fixed)", () => {
  // Short brew (180s) and long brew (300s) should each reserve 33% for drawdown
  const short = parsePourSteps("30 – 120 – 210 – 300", 180, peakRoast, NOW);
  const long = parsePourSteps("60 – 200 – 360 – 500", 300, peakRoast, NOW);
  assert.ok(short && long);
  assert.equal(short.at(-1).startTimeSec, 180 - Math.round(180 * 0.33)); // 180−59=121
  assert.equal(long.at(-1).startTimeSec, 300 - Math.round(300 * 0.33));  // 300−99=201
});

// ── getActiveIdx ───────────────────────────────────────────────────────────

test("getActiveIdx: returns bloom before first pour", () => {
  const steps = parsePourSteps("50 – 180 – 320 – 500", 270, peakRoast, NOW);
  assert.equal(getActiveIdx(0, steps), 0);
  assert.equal(getActiveIdx(44, steps), 0); // still in bloom at 44s
});

test("getActiveIdx: advances exactly at each step's startTime", () => {
  const steps = parsePourSteps("50 – 180 – 320 – 500", 270, peakRoast, NOW);
  // Steps at [0, 45, 113, 181]
  assert.equal(getActiveIdx(45, steps), 1);
  assert.equal(getActiveIdx(112, steps), 1);
  assert.equal(getActiveIdx(113, steps), 2);
  assert.equal(getActiveIdx(180, steps), 2);
  assert.equal(getActiveIdx(181, steps), 3);
  assert.equal(getActiveIdx(500, steps), 3); // stays on final after target time
});
