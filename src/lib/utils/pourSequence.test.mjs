// Unit tests for the pour-over timing formula. Pure math, zero dependencies —
// run with:  node --test src/lib/utils/pourSequence.test.mjs
//
// The tests duplicate the logic instead of importing from the .ts module so
// this file runs under plain Node with no TypeScript loader. If the math in
// pourSequence.ts ever changes, update this file too — the point of the tests
// is that the formula keeps producing the exact milestones documented below.

import { test } from "node:test";
import assert from "node:assert/strict";

// ── Re-declared pure logic (MUST stay in sync with src/lib/utils/pourSequence.ts) ──

function getBloomDuration(roastDate, now = Date.now()) {
  if (roastDate) {
    const daysOld = Math.floor((now - new Date(roastDate).getTime()) / 86_400_000);
    if (daysOld < 7) return 50;
    if (daysOld < 22) return 45;
    return 30;
  }
  return 45;
}

function leadingGrams(token) {
  const m = token.match(/^\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

function tokenTemperature(token) {
  const t = token.match(/[@(]\s*@?\s*(\d{2,3})\s*°?\s*[cC]?/);
  return t ? Number(t[1]) : undefined;
}

function tokenNote(token) {
  const s = token
    .replace(/^\s*\d+\s*/, "")
    .replace(/[@(]\s*@?\s*\d{2,3}\s*°?\s*[cC]?\s*\)?/g, "")
    .replace(/[()]/g, "")
    .trim();
  return s.length > 0 ? s : undefined;
}

function buildPourOver(milestones, targetTimeSec, roastDate, now = Date.now()) {
  const n = milestones.length;
  if (n < 2) return null;
  const bloomDur = getBloomDuration(roastDate, now);
  const drawdownReserve = Math.round(targetTimeSec * 0.33);
  const remaining = targetTimeSec - bloomDur - drawdownReserve;
  const interval = n > 2 ? remaining / (n - 2) : 0;
  return milestones.map((m, i) => ({
    index: i,
    label: i === 0 ? "Bloom" : i === n - 1 ? "Final pour" : `Pour ${i + 1}`,
    cumulativeGrams: m.grams,
    pourGrams: i === 0 ? m.grams : m.grams - milestones[i - 1].grams,
    startTimeSec: i === 0 ? 0 : Math.round(bloomDur + (i - 1) * interval),
    action: i === 0 ? "bloom" : i === n - 1 ? "final" : "pour",
    temperatureC: m.temperatureC,
    notes: m.notes,
    agitation: m.agitation,
  }));
}

function parsePourSteps(sequence, targetTimeSec, roastDate, now = Date.now()) {
  const parts = sequence.split(/\s*[–—\-]\s*/).map((s) => s.trim());
  const grams = parts.map(leadingGrams);
  if (parts.length < 2 || grams.some((g) => g === null)) return null;
  const milestones = parts.map((p, i) => ({
    grams: grams[i],
    temperatureC: tokenTemperature(p),
    notes: tokenNote(p),
  }));
  return buildPourOver(milestones, targetTimeSec, roastDate, now);
}

function defaultDuration(action) {
  switch (action) {
    case "press": return 25;
    case "wait": return 60;
    case "stir":
    case "swirl":
    case "agitate-bed": return 10;
    case "drain": return 30;
    case "bypass": return 5;
    case "invert":
    case "flip": return 0;
    default: return 10;
  }
}

function isSetupAction(action, label) {
  if (action === "invert") return true;
  return /^\s*(assemble|position|set.?up|load|rinse|place)\b/i.test(label);
}

function buildGuideSteps(recipe) {
  const src = recipe.pourSteps;
  if (!src || src.length === 0) return null;
  let clock = 0;
  return src.map((step, i) => {
    const action = step.action;
    const isSetup = isSetupAction(action, step.label);
    const durationSec = step.durationSec ?? defaultDuration(action);
    const startTimeSec = isSetup ? 0 : clock;
    if (!isSetup) clock += durationSec;
    return {
      index: i,
      label: step.label,
      action,
      startTimeSec,
      durationSec,
      temperatureC: step.temperatureC,
      notes: step.notes,
      cumulativeGrams: step.waterGramsAtEnd,
      isSetup,
    };
  });
}

const isAgitationStep = (a) => a === "swirl" || a === "stir" || a === "agitate-bed";

function pourStepsFromStructured(recipe, roastDate, now = Date.now()) {
  const src = recipe.pourSteps;
  if (!src || src.length === 0) return null;
  const milestones = [];
  let last = -1;
  for (const s of src) {
    if (s.waterGramsAtEnd != null) {
      milestones.push({ grams: s.waterGramsAtEnd, temperatureC: s.temperatureC, notes: s.notes, agitation: null });
      last = milestones.length - 1;
    } else if (isAgitationStep(s.action) && last >= 0) {
      milestones[last].agitation = s.action === "swirl" ? "swirl" : "stir";
    }
  }
  return buildPourOver(milestones, recipe.targetTimeSec, roastDate, now);
}

function hasImmersionShape(recipe) {
  const src = recipe.pourSteps;
  if (!src || src.length === 0) return false;
  return src.some(
    (s) =>
      s.action === "invert" ||
      s.action === "flip" ||
      s.action === "press" ||
      s.action === "bypass" ||
      (s.action === "wait" && (s.durationSec ?? 0) >= 45),
  );
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

// ── parsePourSteps: tolerant annotation parsing (the staged-temp fix) ───────

test("parsePourSteps: tolerates inline temperature annotations", () => {
  // The bug: "70 (@70°C) – …" used to fail /^\d+$/ and collapse to one step.
  const steps = parsePourSteps("70 (@70°C) – 220 – 370 – 520", 200, peakRoast, NOW);
  assert.ok(steps, "annotated sequence should parse");
  assert.equal(steps.length, 4);
  assert.deepEqual(steps.map((s) => s.cumulativeGrams), [70, 220, 370, 520]);
  assert.equal(steps[0].temperatureC, 70);
});

test("parsePourSteps: staged per-pour temps carry to each step", () => {
  const steps = parsePourSteps("50 @96C – 180 @92C – 320 @88C", 210, peakRoast, NOW);
  assert.ok(steps);
  assert.deepEqual(
    steps.map((s) => s.temperatureC),
    [96, 92, 88],
  );
  // Grams unaffected by the temp annotation
  assert.deepEqual(steps.map((s) => s.cumulativeGrams), [50, 180, 320]);
});

test("parsePourSteps: trailing note text becomes the step note", () => {
  const steps = parsePourSteps("50 (gentle bloom) – 250", 210, peakRoast, NOW);
  assert.ok(steps);
  assert.equal(steps[0].notes, "gentle bloom");
});

test("parsePourSteps: plain numeric milestones carry no temp/note", () => {
  const steps = parsePourSteps("50 – 180 – 320", 210, peakRoast, NOW);
  assert.ok(steps);
  assert.ok(steps.every((s) => s.temperatureC === undefined));
  assert.ok(steps.every((s) => s.notes === undefined));
});

// ── pourStepsFromStructured: structured percolation ────────────────────────

test("pourStepsFromStructured: structured V60 times identically to its string", () => {
  const recipe = {
    targetTimeSec: 270,
    pourSteps: [
      { label: "Bloom", action: "bloom", waterGramsAtEnd: 50, temperatureC: 94 },
      { label: "Rest", action: "wait", durationSec: 30 },
      { label: "Pour 2", action: "pour", waterGramsAtEnd: 180, temperatureC: 92 },
      { label: "Pour 3", action: "pour", waterGramsAtEnd: 320 },
      { label: "Final", action: "final", waterGramsAtEnd: 500 },
      { label: "Drawdown", action: "drain", durationSec: 40 },
    ],
  };
  const fromStruct = pourStepsFromStructured(recipe, peakRoast, NOW);
  const fromString = parsePourSteps("50 – 180 – 320 – 500", 270, peakRoast, NOW);
  assert.ok(fromStruct && fromString);
  assert.deepEqual(
    fromStruct.map((s) => s.startTimeSec),
    fromString.map((s) => s.startTimeSec),
  );
  assert.deepEqual(
    fromStruct.map((s) => s.cumulativeGrams),
    fromString.map((s) => s.cumulativeGrams),
  );
  // …but structured carries the per-pour temperatures the string lacks
  assert.equal(fromStruct[0].temperatureC, 94);
  assert.equal(fromStruct[1].temperatureC, 92);
});

// ── buildGuideSteps + hasImmersionShape: immersion routing ─────────────────

test("hasImmersionShape: true for steep/flip/press/bypass, false for percolation", () => {
  const percolation = { pourSteps: [
    { label: "Bloom", action: "bloom", waterGramsAtEnd: 50 },
    { label: "Rest", action: "wait", durationSec: 30 }, // short rest, not a steep
    { label: "Final", action: "final", waterGramsAtEnd: 300 },
  ] };
  const immersion = { pourSteps: [
    { label: "Steep", action: "wait", durationSec: 120 },
    { label: "Press", action: "press", durationSec: 30 },
  ] };
  assert.equal(hasImmersionShape(percolation), false);
  assert.equal(hasImmersionShape(immersion), true);
});

test("buildGuideSteps: inverted AeroPress lays out setup + timed flip/press", () => {
  const recipe = { pourSteps: [
    { label: "Invert and load", action: "invert", durationSec: 0 },
    { label: "Pour", action: "pour", waterGramsAtEnd: 120, durationSec: 15, temperatureC: 96 },
    { label: "Stir 2–3×", action: "stir", durationSec: 10 },
    { label: "Steep", action: "wait", durationSec: 60 },
    { label: "Cap, flip, press", action: "press", durationSec: 30 },
    { label: "Bypass", action: "bypass", waterGramsAtEnd: 200, durationSec: 5 },
  ] };
  const steps = buildGuideSteps(recipe);
  assert.ok(steps);
  // The invert is a setup step (excluded from the timeline)
  assert.equal(steps[0].isSetup, true);
  assert.equal(steps[0].startTimeSec, 0);
  const timed = steps.filter((s) => !s.isSetup);
  // Pour @0, stir @15, steep @25, press @85, bypass @115
  assert.deepEqual(timed.map((s) => s.startTimeSec), [0, 15, 25, 85, 115]);
  // The press (flip) cue lands exactly when the 60s steep ends
  const press = timed.find((s) => s.action === "press");
  assert.equal(press.startTimeSec, 85);
});

test("buildGuideSteps: missing durations fall back to action defaults", () => {
  const recipe = { pourSteps: [
    { label: "Pour", action: "pour", waterGramsAtEnd: 200 },
    { label: "Steep", action: "wait" },
    { label: "Press", action: "press" },
  ] };
  const steps = buildGuideSteps(recipe);
  assert.ok(steps);
  assert.deepEqual(steps.map((s) => s.durationSec), [10, 60, 25]);
  assert.deepEqual(steps.map((s) => s.startTimeSec), [0, 10, 70]);
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

// ── pourStepsFromStructured: agitation is recipe-driven ─────────────────────

test("pourStepsFromStructured: attaches swirl/stir only where the recipe agitates", () => {
  const recipe = {
    targetTimeSec: 240,
    pourSteps: [
      { label: "Bloom", action: "bloom", waterGramsAtEnd: 50 },
      { label: "Stir", action: "stir", durationSec: 5 },
      { label: "Pour 2", action: "pour", waterGramsAtEnd: 200 },
      { label: "Final", action: "final", waterGramsAtEnd: 300 },
      { label: "Swirl", action: "swirl", durationSec: 5 },
      { label: "Drawdown", action: "drain", durationSec: 40 },
    ],
  };
  const steps = pourStepsFromStructured(recipe, peakRoast, NOW);
  assert.ok(steps);
  assert.deepEqual(steps.map((s) => s.agitation), ["stir", null, "swirl"]);
});

test("pourStepsFromStructured: reduced-agitation recipe shows NO agitation", () => {
  // The screenshot bug: a recipe with no swirl/stir steps must yield agitation
  // null everywhere — no stray Swirl button on the final pour / drawdown.
  const recipe = {
    targetTimeSec: 270,
    pourSteps: [
      { label: "Bloom", action: "bloom", waterGramsAtEnd: 60, notes: "no swirl, minimal agitation" },
      { label: "Pour 2", action: "pour", waterGramsAtEnd: 250 },
      { label: "Final", action: "final", waterGramsAtEnd: 450 },
      { label: "Drawdown", action: "drain", durationSec: 60 },
    ],
  };
  const steps = pourStepsFromStructured(recipe, peakRoast, NOW);
  assert.ok(steps);
  assert.ok(steps.every((s) => s.agitation === null), "every milestone agitation is null");
});

// ── resolveBrewedRecipe: read the SELECTED candidate, not primary ───────────
// Re-declared logic (MUST stay in sync with src/lib/utils/resolveRecipe.ts).

function resolveBrewedRecipe(session) {
  const rec = session.recommendation;
  const idx = session.brew?.selectedCandidateIdx;
  const candidate =
    (idx != null ? rec?.candidates?.[idx] : undefined) ??
    (session.brew?.methodUsed
      ? rec?.candidates?.find((c) => c.method === session.brew?.methodUsed)
      : undefined);
  const recipe = candidate?.recipe ?? rec?.primaryRecipe;
  const method = candidate?.method || session.brew?.methodUsed || rec?.primaryMethod || "Brew";
  return { recipe, candidate, method };
}

test("resolveBrewedRecipe: returns the selected candidate's recipe, not primary", () => {
  // The no-go: primary grind 398, but the user brewed candidate[1] at 405.
  const session = {
    recommendation: {
      primaryMethod: "Orea Fast",
      primaryRecipe: { grindSize: "398°", doseGrams: 30 },
      candidates: [
        { method: "Orea Fast", title: "Primary", recipe: { grindSize: "398°", doseGrams: 30 } },
        { method: "Orea Apex", title: "Reduced agitation Orea Apex", basedOn: "April 1-2-3", recipe: { grindSize: "405°", doseGrams: 30 } },
      ],
    },
    brew: { selectedCandidateIdx: 1, methodUsed: "Orea Apex" },
  };
  const { recipe, candidate, method } = resolveBrewedRecipe(session);
  assert.equal(recipe.grindSize, "405°"); // not the primary's 398
  assert.equal(candidate.title, "Reduced agitation Orea Apex");
  assert.equal(method, "Orea Apex");
});

test("resolveBrewedRecipe: legacy session without idx falls back to primary", () => {
  const session = {
    recommendation: {
      primaryMethod: "V60",
      primaryRecipe: { grindSize: "388°" },
      candidates: [{ method: "V60", title: "X", recipe: { grindSize: "388°" } }],
    },
    brew: {},
  };
  const { recipe, method } = resolveBrewedRecipe(session);
  assert.equal(recipe.grindSize, "388°");
  assert.equal(method, "V60");
});
