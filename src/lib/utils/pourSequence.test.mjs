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
  poursCompleteAtSec, POUR_RATE_GPS,
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

// ── pourStepsFromStructured: agitation is a discrete, flow-rate-timed step ───

test("pourDurationSec / POUR_RATE_GPS: pour time = grams ÷ rate", () => {
  assert.equal(POUR_RATE_GPS, 4);
  assert.equal(pourDurationSec(100), 25); // 100g ÷ 4 g/s
  assert.equal(pourDurationSec(50), 13); // 12.5 → 13
  assert.equal(pourDurationSec(0), 1); // floor of 1s, never 0
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
  // Pours @0/45/161 (peak bloom 45, drawdown reserve 79, one 116s interval).
  // Stir lands at bloom-start 0 + pourDuration(50g)=13. Swirl at final-start
  // 161 + pourDuration(100g)=25 = 186.
  assert.deepEqual(
    steps.map((s) => [s.action, s.startTimeSec]),
    [
      ["bloom", 0],
      ["stir", 13],
      ["pour", 45],
      ["final", 161],
      ["swirl", 186],
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

test("poursCompleteAtSec: a BIG final pour stays active long enough to pour it (not the old 20s cap)", () => {
  // Asser-style 60–120–240 @ 220s: final pour adds 120g, which needs 30s at 4g/s.
  const steps = parsePourSteps("60 – 120 – 240", 220, peakRoast, NOW);
  const last = steps[steps.length - 1];
  assert.equal(last.action, "final");
  assert.equal(last.pourGrams, 120);
  const doneAt = poursCompleteAtSec(steps, 220);
  const grace = doneAt - last.startTimeSec;
  assert.equal(doneAt, 177); // 147 (final start) + 30s pour time
  assert.equal(grace, pourDurationSec(120)); // grace == physical pour time (30s)
  assert.ok(grace > 20, "a big final pour must exceed the old flat 20s cap");
});

test("poursCompleteAtSec: a SMALL final pour keeps the ≤20s grace (unchanged behaviour)", () => {
  const steps = parsePourSteps("50 – 100 – 150 – 200 – 250 – 300", 210, peakRoast, NOW);
  const last = steps[steps.length - 1];
  assert.equal(last.pourGrams, 50);
  const grace = poursCompleteAtSec(steps, 210) - last.startTimeSec;
  assert.equal(grace, 20); // 35%-of-drawdown grace, capped at 20 as before
  assert.ok(grace >= pourDurationSec(50), "still long enough to pour 50g");
});

test("poursCompleteAtSec: a trailing swirl near target uses the short agitation grace", () => {
  const steps = [
    { index: 0, label: "Bloom", cumulativeGrams: 50, pourGrams: 50, startTimeSec: 0, action: "bloom" },
    { index: 1, label: "Final pour", cumulativeGrams: 240, pourGrams: 190, startTimeSec: 120, action: "final" },
    { index: 2, label: "Swirl", cumulativeGrams: 240, pourGrams: 0, startTimeSec: 185, action: "swirl" },
  ];
  assert.ok(isAgitationPourAction(steps[steps.length - 1].action));
  assert.equal(poursCompleteAtSec(steps, 200), 195); // 185 + 10s agitation grace
});

test("poursCompleteAtSec: empty steps → 0 (no crash)", () => {
  assert.equal(poursCompleteAtSec([], 200), 0);
});
