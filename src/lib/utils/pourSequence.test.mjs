// Unit tests for the pour-over timing + step model.
// Run with:  node --test src/lib/utils/pourSequence.test.mjs
//
// These bundle the REAL src/lib/utils/pourSequence.ts with esbuild (same harness
// as brew-notifications.test.mjs) so they assert the actual shipped logic — no
// duplicated copy to drift out of sync. (The resolveBrewedRecipe section lower
// down still re-declares its logic — that's a different module, unchanged here.)

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
export {
  getBloomDuration, parsePourSteps, pourStepsFromStructured, buildGuideSteps,
  hasImmersionShape, getActiveIdx, isAgitationPourAction, pourDurationSec,
  poursCompleteAtSec, POUR_RATE_GPS, pourPace, pourTargetRateGPS,
  PACE_RATE_MIN_GPS, PACE_RATE_MAX_GPS,
  MAX_POUR_RATE_GPS, MIN_DRAWDOWN_SEC, pourPhaseEndSec, pourScheduleFor,
  FALLBACK_REST_MIN_SEC, FALLBACK_REST_MAX_SEC, pourTimingDurationSec,
} from ${JSON.stringify(path.join(ROOT, "src/lib/utils/pourSequence.ts"))};
`;
const dir = await mkdtemp(join(tmpdir(), "pourseq-"));
const out = join(dir, "p.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const {
  getBloomDuration,
  parsePourSteps,
  pourStepsFromStructured,
  buildGuideSteps,
  hasImmersionShape,
  getActiveIdx,
  isAgitationPourAction,
  pourDurationSec,
  poursCompleteAtSec,
  POUR_RATE_GPS,
  pourPace,
  pourTargetRateGPS,
  MAX_POUR_RATE_GPS,
  MIN_DRAWDOWN_SEC,
  pourPhaseEndSec,
  pourScheduleFor,
  FALLBACK_REST_MIN_SEC,
  FALLBACK_REST_MAX_SEC,
  pourTimingDurationSec,
  PACE_RATE_MIN_GPS,
  PACE_RATE_MAX_GPS,
} = await import(pathToFileURL(out).href);

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

test("parsePourSteps: a string recipe times its pours, then drains what's left", () => {
  // No authored durations, so each pour takes the house time (grams ÷ 4 g/s in
  // whole 5 s steps) and the rests are spread over what is left once a
  // corpus-median drawdown is set aside. 270s, 4 pours, peak roast: pours
  // 15/35/35/45s, drawdown target 97s, so the two gaps get the 10s minimum.
  const steps = parsePourSteps("50 – 180 – 320 – 500", 270, peakRoast, NOW);
  assert.ok(steps, "should parse");
  assert.deepEqual(
    steps.map((s) => s.startTimeSec),
    [0, 45, 90, 135],
  );
  const last = steps.at(-1);
  assert.equal(last.action, "final");
  // The final pour gets the time it physically needs, whatever the clock says.
  assert.equal(last.timingDurationSec, 45);
});

test("parsePourSteps: classic 4-pour schedule at peak roast", () => {
  const steps = parsePourSteps("50 – 180 – 320 – 500", 270, peakRoast, NOW);
  assert.ok(steps);
  assert.equal(steps.length, 4);
  assert.deepEqual(
    steps.map((s) => s.pourGrams),
    [50, 130, 140, 180],
  );
  assert.deepEqual(
    steps.map((s) => s.label),
    ["Bloom", "Pour 2", "Pour 3", "Final pour"],
  );
  // Every pour is scheduled at a rate a human can actually pour.
  for (const st of steps) {
    assert.ok(
      st.pourGrams / st.timingDurationSec <= MAX_POUR_RATE_GPS + 0.001,
      `${st.label} pours ${st.pourGrams}g in ${st.timingDurationSec}s`,
    );
  }
});

test("parsePourSteps: a shorter clock tightens the rests, never the pours", () => {
  const long = parsePourSteps("40 – 140 – 240 – 340", 300, peakRoast, NOW);
  const short = parsePourSteps("40 – 140 – 240 – 340", 210, peakRoast, NOW);
  assert.ok(long && short);
  // Same water, same pour times — only the gaps between them move.
  assert.deepEqual(
    long.map((s) => s.timingDurationSec),
    short.map((s) => s.timingDurationSec),
  );
  assert.ok(short[2].startTimeSec < long[2].startTimeSec);
  // 210s: pours 10/25/25/25, drawdown target 76s → 10s gaps.
  assert.deepEqual(
    short.map((s) => s.startTimeSec),
    [0, 45, 80, 115],
  );
});

test("parsePourSteps: very fresh bean (50s bloom) shifts the schedule", () => {
  const peak = parsePourSteps("50 – 180 – 320 – 500", 270, peakRoast, NOW);
  const fresh = parsePourSteps("50 – 180 – 320 – 500", 270, freshRoast, NOW);
  assert.ok(peak && fresh);
  assert.equal(fresh[0].startTimeSec, 0);
  assert.equal(fresh[1].startTimeSec, 50); // bloom done at 50s, not 45s
  // Everything after the bloom shifts by the same 5s — the cadence is intact.
  for (let i = 1; i < peak.length; i++) {
    assert.equal(fresh[i].startTimeSec - peak[i].startTimeSec, 5);
  }
});

test("parsePourSteps: 3-pour schedule has one rest between pour 2 and the final", () => {
  const steps = parsePourSteps("60 – 250 – 450", 240, peakRoast, NOW);
  assert.ok(steps);
  assert.equal(steps.length, 3);
  // pours 15/50/50s; one gap gets the 10s minimum once an 86s drawdown is set aside.
  assert.deepEqual(
    steps.map((s) => s.startTimeSec),
    [0, 45, 105],
  );
});

test("parsePourSteps: 2-pour (bloom + single pour) edge case", () => {
  // n=2 means interval=0 (no middle pours); final equals bloom end
  const steps = parsePourSteps("40 – 300", 210, peakRoast, NOW);
  assert.ok(steps);
  assert.equal(steps.length, 2);
  assert.equal(steps[0].startTimeSec, 0);
  // With n=2 there are no gaps to fill: the single pour starts when the bloom
  // is done and takes the time its 260g needs (65s at 4 g/s), leaving the rest
  // of the clock as drawdown.
  assert.equal(steps[1].startTimeSec, 45);
  assert.equal(steps[1].timingDurationSec, 65);
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

test("parsePourSteps: the pour cadence does not stretch with the clock", () => {
  // Under the old reserve model a longer clock pushed every pour later in
  // proportion. Cadence-first, the pours take the time their water needs and a
  // longer clock only buys more drawdown.
  const short = parsePourSteps("50 – 180 – 320 – 500", 180, peakRoast, NOW);
  const long = parsePourSteps("50 – 180 – 320 – 500", 300, peakRoast, NOW);
  assert.ok(short && long);
  assert.deepEqual(
    short.map((s) => s.timingDurationSec),
    long.map((s) => s.timingDurationSec),
  );
  // The short clock can't hold its own pours, so it ends when they do.
  const shortSchedule = pourScheduleFor(
    { pourSequence: "50 – 180 – 320 – 500", targetTimeSec: 180, doseGrams: 30, waterGrams: 500, waterTempC: 94, grindSize: "x" },
    peakRoast,
    NOW,
  );
  assert.ok(shortSchedule.extended, "180s cannot hold four pours plus a drawdown");
  assert.ok(shortSchedule.finishSec >= shortSchedule.pourPhaseEndSec + MIN_DRAWDOWN_SEC);
});

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

test("pourStepsFromStructured: a structured recipe follows its OWN authored rests", () => {
  // The string form has no rests to follow, so it spreads them over the clock.
  // The structured form authors a 30s bloom rest and nothing between the later
  // pours — so those pour back-to-back, exactly as written. Before Sep 2026 both
  // produced the same schedule, because both were re-derived from targetTimeSec
  // and the authored rests were discarded.
  const recipe = {
    doseGrams: 30,
    waterGrams: 500,
    waterTempC: 94,
    grindSize: "x",
    targetTimeSec: 270,
    pourSequence: "",
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
  assert.ok(fromStruct);
  // Bloom block = its 15s pour + the authored 30s rest; then the three pours run
  // back-to-back at the house time (35s, 35s, 45s).
  assert.deepEqual(
    fromStruct.map((s) => s.startTimeSec),
    [0, 45, 80, 115],
  );
  assert.deepEqual(
    fromStruct.map((s) => s.cumulativeGrams),
    [50, 180, 320, 500],
  );
  // The trailing "Drawdown" step is not cadence — it is what the clock has left.
  const schedule = pourScheduleFor(recipe, peakRoast, NOW);
  assert.equal(schedule.pourPhaseEndSec, 160);
  assert.equal(schedule.drawdownSec, 270 - 160);
  // …and structured carries the per-pour temperatures the string lacks
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
  // Steps at [0, 45, 90, 135] — see the cadence test above.
  assert.equal(getActiveIdx(45, steps), 1);
  assert.equal(getActiveIdx(89, steps), 1);
  assert.equal(getActiveIdx(90, steps), 2);
  assert.equal(getActiveIdx(134, steps), 2);
  assert.equal(getActiveIdx(135, steps), 3);
  assert.equal(getActiveIdx(500, steps), 3); // stays on final after target time
});

// ── pourStepsFromStructured: agitation is a discrete, flow-rate-timed step ───

test("pourDurationSec / POUR_RATE_GPS: grams ÷ rate, in whole 5-second steps", () => {
  assert.equal(POUR_RATE_GPS, 4);
  assert.equal(pourDurationSec(100), 25); // 100g ÷ 4 g/s
  assert.equal(pourDurationSec(50), 15); // 12.5 → nearest 5 s step
  assert.equal(pourDurationSec(85), 20); // 21.25 → 20
  assert.equal(pourDurationSec(0), 5); // never under one 5 s step
});

test("pourStepsFromStructured: swirl/stir become their own steps, timed AFTER the pour", () => {
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
  // No authored rests → the fallback spreads them. Bloom 45s (roast age, since
  // the recipe timed no bloom block); stir lands the instant the bloom pour is
  // done (15s); pour 2 takes 40s plus a rest, and the final pour's swirl lands
  // when it finishes pouring.
  assert.deepEqual(
    steps.map((s) => [s.action, s.startTimeSec]),
    [
      ["bloom", 0],
      ["stir", 15],
      ["pour", 45],
      ["final", 124],
      ["swirl", 149],
    ],
  );
  // Agitation steps carry no grams and inherit the preceding pour's total.
  const stir = steps.find((s) => s.action === "stir");
  const swirl = steps.find((s) => s.action === "swirl");
  assert.equal(stir.pourGrams, 0);
  assert.equal(stir.cumulativeGrams, 50);
  assert.equal(swirl.pourGrams, 0);
  assert.equal(swirl.cumulativeGrams, 300);
});

test("pourStepsFromStructured: agitate-bed maps to a 'tap' step", () => {
  const recipe = {
    targetTimeSec: 210,
    pourSteps: [
      { label: "Bloom", action: "bloom", waterGramsAtEnd: 40 },
      { label: "Pour", action: "pour", waterGramsAtEnd: 250 },
      { label: "Tap to level", action: "agitate-bed" },
      { label: "Drawdown", action: "drain", durationSec: 40 },
    ],
  };
  const steps = pourStepsFromStructured(recipe, peakRoast, NOW);
  assert.ok(steps);
  const tap = steps.find((s) => s.action === "tap");
  assert.ok(tap, "agitate-bed → tap step");
  assert.ok(isAgitationPourAction(tap.action));
  assert.equal(tap.label, "Tap to level");
});

test("pourStepsFromStructured: reduced-agitation recipe yields NO agitation steps", () => {
  // A recipe with no swirl/stir/tap steps must produce zero agitation steps —
  // no stray Swirl on the final pour / drawdown.
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
  assert.equal(steps.length, 3, "bloom + pour + final, nothing inserted");
  assert.ok(steps.every((s) => !isAgitationPourAction(s.action)), "no agitation steps");
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

// ── basedOnReference / brewedRecipeName: suppress the "Own recipe" sentinel ──
// Re-declared logic (MUST stay in sync with src/lib/utils/resolveRecipe.ts).

function basedOnReference(basedOn, title) {
  const ref = basedOn?.trim();
  if (!ref) return undefined;
  if (ref.toLowerCase() === "own recipe") return undefined;
  if (title && ref.toLowerCase() === title.trim().toLowerCase()) return undefined;
  return ref;
}

function brewedRecipeName(candidate) {
  if (!candidate) return undefined;
  const title = candidate.title?.trim();
  const ref = basedOnReference(candidate.basedOn, candidate.title);
  if (title && ref) return `${title} (based on ${ref})`;
  return title || candidate.basedOn?.trim() || undefined;
}

test("basedOnReference: 'Own recipe' placeholder is suppressed", () => {
  assert.equal(basedOnReference("Own recipe", "Orea Classic, sweetness floor"), undefined);
  assert.equal(basedOnReference("own recipe", "X"), undefined);
});

test("basedOnReference: a real reference passes through", () => {
  assert.equal(basedOnReference("Kasuya 4:6", "My morning V60"), "Kasuya 4:6");
});

test("basedOnReference: a reference that just repeats the title is suppressed", () => {
  assert.equal(basedOnReference("Kasuya 4:6", "Kasuya 4:6"), undefined);
});

test("brewedRecipeName: 'Own recipe' gives the bare title, no (based on …)", () => {
  const name = brewedRecipeName({ title: "Orea Classic, sweetness floor", basedOn: "Own recipe" });
  assert.equal(name, "Orea Classic, sweetness floor");
});

test("brewedRecipeName: a real reference is appended", () => {
  const name = brewedRecipeName({ title: "My morning V60", basedOn: "Kasuya 4:6" });
  assert.equal(name, "My morning V60 (based on Kasuya 4:6)");
});

// ── poursCompleteAtSec (the "last pour disappears too fast" fix) ─────────────

test("poursCompleteAtSec: the pour phase ends when the last pour is poured", () => {
  // Asser-style 60–120–240 @ 220s: the final pour adds 120g, which needs 30s.
  const steps = parsePourSteps("60 – 120 – 240", 220, peakRoast, NOW);
  const last = steps[steps.length - 1];
  assert.equal(last.action, "final");
  assert.equal(last.pourGrams, 120);
  assert.equal(last.timingDurationSec, pourDurationSec(120)); // 30s
  // No invented grace: the phase is over when the step it occupies is over.
  assert.equal(poursCompleteAtSec(steps), last.startTimeSec + 30);
  assert.equal(poursCompleteAtSec(steps), 135);
});

test("poursCompleteAtSec: a small final pour ends the phase sooner", () => {
  const steps = parsePourSteps("50 – 100 – 150 – 200 – 250 – 300", 210, peakRoast, NOW);
  const last = steps[steps.length - 1];
  assert.equal(last.pourGrams, 50);
  assert.equal(poursCompleteAtSec(steps) - last.startTimeSec, pourDurationSec(50));
});

test("poursCompleteAtSec: a trailing swirl extends the phase by its own duration", () => {
  const steps = [
    { index: 0, label: "Bloom", cumulativeGrams: 50, pourGrams: 50, startTimeSec: 0, action: "bloom", timingDurationSec: 13 },
    { index: 1, label: "Final pour", cumulativeGrams: 240, pourGrams: 190, startTimeSec: 120, action: "final", timingDurationSec: 48 },
    { index: 2, label: "Swirl", cumulativeGrams: 240, pourGrams: 0, startTimeSec: 185, action: "swirl", timingDurationSec: 5 },
  ];
  assert.ok(isAgitationPourAction(steps[steps.length - 1].action));
  assert.equal(poursCompleteAtSec(steps), 190);
  // A step saved before `timingDurationSec` existed still measures sensibly:
  // an agitation falls back to the 5s default, a pour to its grams ÷ 4 g/s.
  const legacy = steps.map(({ timingDurationSec, ...rest }) => rest);
  assert.equal(poursCompleteAtSec(legacy), 190);
});

test("poursCompleteAtSec: empty steps → 0 (no crash)", () => {
  assert.equal(poursCompleteAtSec([], 200), 0);
});

// ── proportional pour spacing (time follows water) ───────────────────────────

test("a big pour occupies more of the clock than a small one", () => {
  const steps = parsePourSteps("40 – 240 – 280", 240, peakRoast, NOW);
  assert.ok(steps);
  // 200g takes 50s to pour, 40g takes 10s — the time each pour owns follows its
  // water, because it IS the time that water takes.
  assert.equal(steps[1].timingDurationSec, 50);
  assert.equal(steps[2].timingDurationSec, 10);
});

test("equal pours produce an even schedule", () => {
  const steps = parsePourSteps("50 – 150 – 250 – 350", 270, peakRoast, NOW);
  assert.ok(steps);
  const gaps = [];
  for (let i = 1; i < steps.length - 1; i++) {
    gaps.push(steps[i + 1].startTimeSec - steps[i].startTimeSec);
  }
  assert.equal(new Set(gaps).size, 1, `equal pours should be evenly spaced, got ${gaps}`);
});

test("the final pour gets the time its water needs, never the clock's leftovers", () => {
  // The reported defect: a 225g final pour squeezed into the 15s a fixed
  // reserve left it (15 g/s). Whatever the clock says, the pour is scheduled at
  // a rate a person can pour.
  const steps = parsePourSteps("50 – 180 – 320 – 500", 270, peakRoast, NOW);
  assert.ok(steps);
  const last = steps.at(-1);
  assert.equal(last.pourGrams, 180);
  assert.ok(
    last.pourGrams / last.timingDurationSec <= MAX_POUR_RATE_GPS,
    `final pour is ${(last.pourGrams / last.timingDurationSec).toFixed(1)} g/s`,
  );
});
test("pourTargetRateGPS: authored pour time drives the rate (Kasuya 60g/10s = 6 g/s)", () => {
  assert.ok(Math.abs(pourTargetRateGPS(60, 10) - 6) < 1e-9);
});

test("pourTargetRateGPS: no authored time → the ~4 g/s house fallback", () => {
  // 180g / pourDurationSec(180)=round(180/4)=45s → 4.0 g/s.
  assert.ok(Math.abs(pourTargetRateGPS(180) - 4) < 1e-9);
});

test("pourTargetRateGPS: an absurd authored time is clamped to the ceiling", () => {
  // "pour 200g in 1s" = 200 g/s → clamped to the 11 g/s ceiling.
  assert.equal(pourTargetRateGPS(200, 1), PACE_RATE_MAX_GPS);
});

test("pourTargetRateGPS: an implausibly SLOW authored time is ignored (falls to the house time)", () => {
  // 40g authored at 60s = 0.67 g/s < MIN_POUR_RATE_GPS → not a real pour time, so
  // intendedPourDurationSec drops back to the house time (40g → 10s = 4 g/s),
  // never a near-zero rate.
  const r = pourTargetRateGPS(40, 60);
  assert.equal(r, 4);
});

test("pourPace: descriptor bands (house 4 g/s reads 'slow', Kasuya 6 'brisk')", () => {
  assert.equal(pourPace(180).descriptor, "slow"); // 4.0 g/s house fallback
  assert.equal(pourPace(20, 10).descriptor, "very slow"); // 2.0 g/s
  assert.equal(pourPace(40, 10).descriptor, "slow"); // 4.0 g/s
  assert.equal(pourPace(50, 10).descriptor, "steady"); // 5.0 g/s
  assert.equal(pourPace(60, 10).descriptor, "brisk"); // 6.0 g/s (band boundary: <6 = steady)
  assert.equal(pourPace(70, 10).descriptor, "brisk"); // 7.0 g/s
  assert.equal(pourPace(90, 10).descriptor, "fast"); // 9.0 g/s
});

test("pourPace: seconds stay consistent with a clamped rate", () => {
  // 200g authored at 1s → rate clamps to 11 g/s; the shown seconds must re-derive
  // from the clamp (≈18s), never the impossible 1s.
  const p = pourPace(200, 1);
  assert.equal(p.rateGPS, PACE_RATE_MAX_GPS);
  assert.equal(p.seconds, Math.round(200 / PACE_RATE_MAX_GPS)); // 18
  // And an un-clamped pace keeps its authored seconds exactly.
  assert.equal(pourPace(60, 10).seconds, 10);
});

test("pourPace: zero-gram step (agitation / steep) has no pace", () => {
  assert.equal(pourPace(0), null);
  assert.equal(pourPace(undefined), null);
});
