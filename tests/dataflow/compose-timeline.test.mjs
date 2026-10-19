// ONE timeline per recipe (src/lib/brew/composeTimeline.ts, 2026-10-19).
//
// The owner's report: "Timings stimmen nicht." Three clock writers on the
// server and a fourth on the client had turned Kasuya's 10 s pours into 11 s,
// his 35 s drawdown into 38 s, and shifted his first pour's rest by the roast
// date. These goldens pin what the composer promises instead:
//
//   • a verified reference on its own brewer within ±20 % of its water keeps
//     the AUTHOR's starts, the author's own pour rate (uncapped — Rao's 130 g in
//     15 s is not falsified), and his published drawdown, unscaled;
//   • any other recipe is the model's own steps, verbatim; a pour the model
//     did not time runs at the owner's MEASURED pace (4 g/s when nothing is
//     measured); waits are kept exactly; no roast-age shift, ever;
//   • the drawdown without a reference is the owner's measured median on the
//     EXACT brewer (Orea Fast ≠ Orea Classic), same roast-age bucket when he
//     has three brews there, else pooled; else the corpus median, labelled
//     "estimate" — never a formula.
//
//   node --test tests/dataflow/compose-timeline.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const entry = `
export { composeTimeline, drawdownWithSource, ageBucketOf, HOUSE_REST_SEC, MIN_SAME_AGE_SAMPLES, MIN_MEASURED_SAMPLES } from ${JSON.stringify(path.join(ROOT, "src/lib/brew/composeTimeline.ts"))};
export { scaleRecipe } from ${JSON.stringify(path.join(ROOT, "src/lib/recipe/scaleRecipe.ts"))};
export { ALL_RECIPES } from ${JSON.stringify(path.join(ROOT, "src/lib/knowledge/recipes/index.ts"))};
export { buildBrewTimeline } from ${JSON.stringify(path.join(ROOT, "src/lib/brew/timeline.ts"))};
export { exactBrewerKey } from ${JSON.stringify(path.join(ROOT, "src/lib/utils/brewMethodKey.ts"))};
export { POUR_RATE_GPS, MAX_POUR_RATE_GPS } from ${JSON.stringify(path.join(ROOT, "src/lib/utils/pourSequence.ts"))};
`;
const out = path.join(ROOT, "node_modules/.cache/compose-timeline/bundle.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
  external: ["pg", "pg-native", "drizzle-orm", "drizzle-orm/*"],
});
const M = await import(pathToFileURL(out).href);

const NOW = Date.parse("2026-10-19T10:00:00Z");
const byId = (id) => {
  const r = M.ALL_RECIPES.find((x) => x.id === id);
  assert.ok(r, `corpus has ${id}`);
  return r;
};
/** The recipe the model hands back for a reference: the scaled corpus entry. */
const asRecipe = (ref, water) => {
  const s = M.scaleRecipe(ref, water);
  assert.ok(s, `${ref.id} scales to ${water} g`);
  return { doseGrams: s.doseGrams, waterGrams: s.waterGrams, waterTempC: s.waterTempC ?? 93, grindSize: "x", targetTimeSec: s.totalTimeSec, pourSteps: s.pourSteps };
};
const compose = (recipe, ctx) => {
  const r = M.composeTimeline(recipe, { pastSessions: [], now: NOW, ...ctx });
  assert.ok(r.ok, r.ok ? "" : r.reason);
  return r.timeline;
};
const starts = (t) => t.steps.filter((s) => (s.pourGrams ?? 0) > 0).map((s) => s.startSec);
const pours = (t) => t.steps.filter((s) => (s.pourGrams ?? 0) > 0).map((s) => s.pourSec);

/** A logged brew the way production stores it since the snapshot (brew.timeline). */
function session({ method, water, actual, pourEnd, roastDate = "2026-10-01", createdAt = "2026-10-15T07:00:00Z", id }) {
  return {
    id: id ?? `${method}-${water}-${actual}-${createdAt}`,
    createdAt,
    coffee: { name: "x", roaster: "y", roastDate },
    recommendation: {
      candidates: [{ method, recipe: { doseGrams: water / 16, waterGrams: water, waterTempC: 93, grindSize: "x", targetTimeSec: actual, pourSteps: [{ label: "Pour", action: "pour", waterGramsAtEnd: water, durationSec: 20 }] } }],
    },
    brew: {
      selectedCandidateIdx: 0,
      methodUsed: method,
      actualTimeSec: actual,
      timeline: {
        shape: "percolation",
        steps: [{ label: "Pour", action: "pour", startSec: 0, pourSec: pourEnd, restSec: actual - pourEnd, gramsAtEnd: water, pourGrams: water }],
        pourPhaseEndSec: pourEnd,
        drawdownSec: actual - pourEnd,
        drawdownSource: "estimate",
        drawdownBasis: "test",
        cadenceSource: "model",
        finishSec: actual,
        composedAt: createdAt,
      },
    },
  };
}

// ── (a) The author's cadence ─────────────────────────────────────────────────

test("Kasuya 4:6 at 350 g: his 45 s starts, 60→70 g pours at his own 6 g/s, his 35 s drawdown, 3:32", () => {
  const ref = byId("kasuya-4-6-standard"); // published 20 g : 300 g, 3:30
  const t = compose(asRecipe(ref, 350), { basedOn: ref.name, method: "V60" });
  assert.equal(t.cadenceSource, "author");
  assert.deepEqual(starts(t), [0, 45, 90, 135, 165], "every pour starts when Kasuya starts it");
  assert.deepEqual(pours(t), [12, 12, 12, 12, 12], "70 g at his 6 g/s — not 10 s copied, not 11 s by √k");
  assert.equal(t.drawdownSec, 35, "his published drawdown, unscaled");
  assert.equal(t.drawdownSource, "published");
  assert.equal(t.finishSec, 212);
  assert.equal(t.pourPhaseEndSec, 177);
});

test("Hoffmann 1-Cup at 250 g: 0:45 / 1:10 / 1:30 / 1:50, 55 s drawdown, 3:00 exactly", () => {
  const ref = byId("hoffmann-v60-better-one-cup");
  const t = compose(asRecipe(ref, 250), { basedOn: ref.name, method: "V60" });
  assert.equal(t.cadenceSource, "author");
  assert.deepEqual(starts(t), [0, 45, 70, 90, 110]);
  assert.equal(t.drawdownSec, 55);
  assert.equal(t.drawdownSource, "published");
  assert.equal(t.finishSec, 180, "the published 3:00");
});

test("Rao's 130 g in 15 s stays 15 s — a verified author is not stretched to the 8 g/s cap", () => {
  const ref = byId("rao-rule-of-thirds");
  const t = compose(asRecipe(ref, ref.water.grams), { basedOn: ref.name, method: "V60" });
  assert.equal(t.cadenceSource, "author");
  assert.equal(pours(t).at(-1), 15);
  assert.equal(t.finishSec, ref.totalTimeSec);
});

test("Crema's Chemex final swirl lands DURING the drain, at 3:45 of the 4:00, never counted as pouring", () => {
  const ref = byId("crema-chemex-final-swirl");
  const t = compose(asRecipe(ref, ref.water.grams), { basedOn: ref.name, method: "Chemex" });
  const swirl = t.steps.find((s) => s.action === "swirl" && s.startSec > t.pourPhaseEndSec);
  assert.ok(swirl, JSON.stringify(t.steps));
  assert.equal(swirl.startSec, 225);
  assert.equal(t.pourPhaseEndSec, 180, "the last gram lands at 3:00");
  assert.equal(t.finishSec, 240);
});

test("outside the ±20 % window the author's cadence does NOT apply: Hoffmann's 1-Cup at 450 g is the model's own recipe", () => {
  const ref = byId("hoffmann-v60-better-one-cup");
  const t = compose(asRecipe(ref, 450), { basedOn: ref.name, method: "V60" });
  assert.notEqual(t.cadenceSource, "author");
  assert.notEqual(t.drawdownSource, "published");
  assert.match(t.drawdownBasis, /not measured on your kit yet|placeholder/);
});

test("Wölfl (Orea FAST bottom) on the CLASSIC bottom: not his cadence, not his 10 s drain", () => {
  const ref = byId("wbrc-2024-wolfl");
  assert.equal(ref.brewer, "orea-v4-fast");
  const onFast = compose(asRecipe(ref, ref.water.grams), { basedOn: ref.name, method: "Orea Fast" });
  assert.equal(onFast.cadenceSource, "author");
  assert.equal(onFast.drawdownSource, "published");
  const onClassic = compose(asRecipe(ref, ref.water.grams), { basedOn: ref.name, method: "Orea Classic" });
  assert.notEqual(onClassic.cadenceSource, "author");
  assert.notEqual(onClassic.drawdownSource, "published");
  assert.ok(onClassic.drawdownSec > onFast.drawdownSec, `${onClassic.drawdownSec} vs Wölfl's ${onFast.drawdownSec}`);
});

test("EVERY verified percolation recipe composes at its own water on the author's cadence and lands on its published total", () => {
  const off = [];
  let checked = 0;
  for (const ref of M.ALL_RECIPES) {
    if (!ref.verified) continue;
    const s = M.scaleRecipe(ref, ref.water.grams);
    if (!s || s.shape !== "percolation") continue;
    const r = M.composeTimeline(asRecipe(ref, ref.water.grams), { basedOn: ref.name, method: ref.brewer, pastSessions: [], now: NOW });
    checked++;
    if (!r.ok) { off.push(`${ref.id}: ${r.reason}`); continue; }
    const t = r.timeline;
    if (t.cadenceSource !== "author") off.push(`${ref.id}: cadence ${t.cadenceSource}`);
    // A recipe whose published total ends with the pour (no drain given) gets
    // the measured/corpus drawdown instead, said so — its finish is longer.
    if (t.drawdownSource === "published" && t.finishSec !== ref.totalTimeSec) off.push(`${ref.id}: ${t.finishSec}s vs published ${ref.totalTimeSec}s`);
    if (t.drawdownSource !== "published" && !/publishes no drain/.test(t.drawdownBasis)) off.push(`${ref.id}: ${t.drawdownSource} — ${t.drawdownBasis}`);
  }
  assert.ok(checked >= 25, `only ${checked} verified percolation recipes?`);
  assert.deepEqual(off, [], off.join("\n  "));
});

// ── (b) The model's own recipe ───────────────────────────────────────────────

const MODEL = {
  doseGrams: 22,
  waterGrams: 350,
  waterTempC: 93,
  grindSize: "x",
  targetTimeSec: 999, // the model's clock is replaced by the composed one
  pourSteps: [
    { label: "Bloom", action: "bloom", waterGramsAtEnd: 50, durationSec: 10 },
    { label: "Swirl", action: "swirl", durationSec: 5 },
    { label: "Rest", action: "wait", durationSec: 30 },
    { label: "Pour 2", action: "pour", waterGramsAtEnd: 150, durationSec: 30 }, // 3.3 g/s — plausible, kept
    { label: "Rest", action: "wait", durationSec: 20 },
    { label: "Pour 3", action: "pour", waterGramsAtEnd: 250, durationSec: 5 }, // 20 g/s — nobody pours that
    { label: "Rest", action: "wait", durationSec: 20 },
    { label: "Final", action: "final", waterGramsAtEnd: 350 }, // untimed — the owner's pace
  ],
};

test("no reference: the model's steps verbatim — plausible seconds kept, >8 g/s stretched to 8, untimed at the house 4 g/s, waits exact", () => {
  const t = compose(MODEL, { method: "V60", basedOn: "Own recipe" });
  assert.equal(t.cadenceSource, "model");
  assert.deepEqual(pours(t), [10, 30, 13, 25]);
  assert.deepEqual(starts(t), [0, 45, 95, 128], "bloom 10 + swirl 5 + rest 30 = 0:45; 45+30+20 = 1:35; 95+13+20 = 2:08");
  assert.equal(t.pourPhaseEndSec, 153);
  assert.equal(t.finishSec, 153 + t.drawdownSec);
  const water = t.steps.filter((s) => (s.pourGrams ?? 0) > 0);
  assert.deepEqual(water.map((s) => s.restSec).slice(0, -1).length, 3);
  assert.equal(t.steps.find((s) => s.action === "swirl").restSec, 30, "the rest after the swirl is the authored 30 s");
});

test("the owner's MEASURED pace times an untimed pour; a pour the model timed plausibly is left alone", () => {
  // Five brews whose scale curve says 5 g/s on the V60 (pourPace reads avgPourRateGPS).
  const paced = Array.from({ length: 5 }, (_, i) => ({
    id: `p${i}`,
    createdAt: "2026-10-10T07:00:00Z",
    coffee: { name: "x", roaster: "y" },
    recommendation: { candidates: [{ method: "V60", recipe: { doseGrams: 20, waterGrams: 320, waterTempC: 93, grindSize: "x", targetTimeSec: 200, pourSteps: [] } }] },
    brew: { selectedCandidateIdx: 0, methodUsed: "V60", actualTimeSec: 200, flowAnalysis: { avgPourRateGPS: 5, perPour: [] } },
  }));
  const t = compose(MODEL, { method: "V60", basedOn: "Own recipe", pastSessions: paced });
  assert.equal(t.cadenceSource, "measured");
  assert.equal(pours(t)[3], 20, "100 g at the measured 5 g/s");
  assert.equal(pours(t)[1], 30, "the model's own 30 s stands");
});

test("a recipe with no waits at all gets the stated house rest, and says so", () => {
  const noWaits = { ...MODEL, pourSteps: MODEL.pourSteps.filter((s) => s.action !== "wait" && s.action !== "swirl") };
  const t = compose(noWaits, { method: "V60", basedOn: "Own recipe" });
  assert.equal(t.cadenceSource, "house");
  assert.deepEqual(starts(t), [0, 10 + M.HOUSE_REST_SEC, 10 + M.HOUSE_REST_SEC + 30 + M.HOUSE_REST_SEC, 10 + M.HOUSE_REST_SEC + 30 + M.HOUSE_REST_SEC + 13 + M.HOUSE_REST_SEC]);
});

test("NO roast-age shift: a 3-day-old and a 40-day-old bag get the identical schedule", () => {
  const fresh = compose(MODEL, { method: "V60", basedOn: "Own recipe", roastDate: "2026-10-16" });
  const old = compose(MODEL, { method: "V60", basedOn: "Own recipe", roastDate: "2026-09-09" });
  assert.deepEqual(fresh.steps, old.steps);
  assert.equal(fresh.finishSec, old.finishSec);
});

test("a milestone that goes backwards is unbrewable — ok:false, never a repaired guess", () => {
  const bad = { ...MODEL, pourSteps: [{ label: "A", action: "bloom", waterGramsAtEnd: 200, durationSec: 10 }, { label: "B", action: "pour", waterGramsAtEnd: 150, durationSec: 10 }] };
  const r = M.composeTimeline(bad, { method: "V60", now: NOW });
  assert.equal(r.ok, false);
  assert.match(r.reason, /150 g does not increase/);
});

test("immersion: the steps ARE the clock — fill 40 + steep 120 + drain 40 = 200 s", () => {
  const clever = {
    doseGrams: 18, waterGrams: 250, waterTempC: 94, grindSize: "x", targetTimeSec: 400,
    pourSteps: [
      { label: "Add water", action: "pour", waterGramsAtEnd: 250, durationSec: 40 },
      { label: "Steep", action: "wait", durationSec: 120 },
      { label: "Drain", action: "drain", durationSec: 40 },
    ],
  };
  const t = compose(clever, { method: "Clever Dripper" });
  assert.equal(t.shape, "immersion");
  assert.equal(t.finishSec, 200);
  assert.equal(t.cadenceSource, "author");
});

// ── (c) The drawdown: measured on the EXACT brewer, same age when enough ─────

test("the Orea Classic pool never sees the Orea Fast brews — ~48 s on the Classic, ~10 s on the Fast, both 'measured'", () => {
  const sessions = [
    ...[10, 11, 9].map((dd, i) => session({ method: "Orea Fast", water: 300, actual: 150 + dd, pourEnd: 150, id: `f${i}` })),
    ...[48, 50].map((dd, i) => session({ method: "Orea Classic", water: 300, actual: 150 + dd, pourEnd: 150, id: `c${i}` })),
  ];
  const classic = M.drawdownWithSource("Orea Classic", 300, { pastSessions: sessions, now: NOW });
  assert.equal(classic.source, "measured");
  assert.equal(classic.sec, 49);
  assert.match(classic.basis, /your 2 orea-classic brews at ~300 g/);
  const fast = M.drawdownWithSource("Orea Fast", 300, { pastSessions: sessions, now: NOW });
  assert.equal(fast.source, "measured");
  assert.equal(fast.sec, 10);
  const apex = M.drawdownWithSource("Orea Apex", 300, { pastSessions: sessions, now: NOW });
  assert.equal(apex.source, "estimate", "no Apex brew measured yet — the corpus, said so");
});

test("±20 % water: a 450 g brew's pool ignores his 250 g brews on the same brewer", () => {
  const sessions = [60, 62, 58].map((dd, i) => session({ method: "V60", water: 250, actual: 120 + dd, pourEnd: 120, id: `s${i}` }));
  assert.equal(M.drawdownWithSource("V60", 250, { pastSessions: sessions, now: NOW }).source, "measured");
  assert.equal(M.drawdownWithSource("V60", 450, { pastSessions: sessions, now: NOW }).source, "estimate");
});

test("same roast-age bucket outranks the pool once he has three brews there; two fall back to the pool", () => {
  // Brewed 14 days after roast = peak; brewed 3 days after roast = fresh.
  const peak = [40, 42, 38].map((dd, i) => session({ method: "V60", water: 300, actual: 140 + dd, pourEnd: 140, roastDate: "2026-10-01", createdAt: "2026-10-15T07:00:00Z", id: `p${i}` }));
  const fresh = [70, 72].map((dd, i) => session({ method: "V60", water: 300, actual: 140 + dd, pourEnd: 140, roastDate: "2026-10-12", createdAt: "2026-10-15T07:00:00Z", id: `f${i}` }));
  const all = [...peak, ...fresh];
  // Today's bag is 14 days old → peak → his three peak brews.
  const atPeak = M.drawdownWithSource("V60", 300, { pastSessions: all, roastDate: "2026-10-05", now: NOW });
  assert.equal(atPeak.sec, 40);
  assert.match(atPeak.basis, /3 v60 brews at ~300 g, peak roast age/);
  // Today's bag is 3 days old → fresh, but only two fresh brews → the pooled median of all five.
  const atFresh = M.drawdownWithSource("V60", 300, { pastSessions: all, roastDate: "2026-10-16", now: NOW });
  assert.equal(atFresh.sec, 42);
  assert.match(atFresh.basis, /your 5 v60 brews at ~300 g$/);
  assert.equal(M.MIN_SAME_AGE_SAMPLES, 3);
  assert.equal(M.MIN_MEASURED_SAMPLES, 2);
});

test("age buckets: <7 d fresh, 7–21 d peak, ≥22 d older, no date unknown", () => {
  assert.equal(M.ageBucketOf("2026-10-16", NOW), "fresh");
  assert.equal(M.ageBucketOf("2026-10-05", NOW), "peak");
  assert.equal(M.ageBucketOf("2026-09-20", NOW), "older");
  assert.equal(M.ageBucketOf(undefined, NOW), "unknown");
});

test("the corpus estimate is UNSCALED — the brewer's published recipes within ±20 % water, not a median × √k", () => {
  const dd = M.drawdownWithSource("V60", 300, { pastSessions: [], now: NOW });
  assert.equal(dd.source, "estimate");
  assert.match(dd.basis, /published-recipe median for v60 at ~300 g \(\d+ recipes\) — not measured on your kit yet/);
});

// ── The client shows the composed timeline VERBATIM ──────────────────────────

test("buildBrewTimeline lowers a composed timeline without re-deriving anything: same starts, same pour seconds, same finish", () => {
  const ref = byId("kasuya-4-6-standard");
  const recipe = asRecipe(ref, 350);
  const t = compose(recipe, { basedOn: ref.name, method: "V60" });
  const withTimeline = { ...recipe, targetTimeSec: t.finishSec, timeline: t };
  // A different roast date and render time must change nothing.
  const a = M.buildBrewTimeline(withTimeline, "2026-10-17", Date.parse("2026-10-19T06:00:00Z"), "V60");
  const b = M.buildBrewTimeline(withTimeline, "2026-08-01", Date.parse("2026-12-01T06:00:00Z"), "V60");
  assert.deepEqual(a.pourSteps.map((s) => s.startTimeSec), [0, 45, 90, 135, 165]);
  assert.deepEqual(a.pourSteps.map((s) => s.timingDurationSec), [12, 12, 12, 12, 12]);
  assert.equal(a.finishSec, 212);
  assert.equal(a.pourPhaseEndSec, 177);
  assert.equal(a.drawdownSec, 35);
  assert.deepEqual(a.pourSteps, b.pourSteps);
  assert.equal(a.finishSec, b.finishSec);
});

// ── WIRING: one composer, every consumer ─────────────────────────────────────

test("WIRING: /recommend composes every candidate and sets the clock from it; no other clock writer is left", async () => {
  const rec = await readFile(path.join(ROOT, "src/lib/claude/recommend.ts"), "utf8");
  assert.match(rec, /composeTimeline\(c\.recipe, \{ method: c\.method, basedOn: c\.basedOn, pastSessions, roastDate: coffee\.roastDate \}\)/);
  assert.match(rec, /recipe: \{ \.\.\.c\.recipe, targetTimeSec: t\.finishSec, timeline: t \}/, "the clock IS the composed finish");
  for (const gone of ["calibrateDrawdownClock", "applyPourDurations", "guardSpecialTime", "guardVolumeTarget"]) {
    assert.doesNotMatch(rec, new RegExp(gone), `${gone} must not write the clock any more`);
  }
  const physics = await readFile(path.join(ROOT, "src/lib/recipe/enforceRecipePhysics.ts"), "utf8");
  assert.doesNotMatch(physics, /targetTimeSec:\s*[a-zA-Z]/, "the physics guard no longer sets a clock");
  const chat = await readFile(path.join(ROOT, "src/lib/chat/agentContext.ts"), "utf8");
  assert.match(chat, /composeTimeline\(reconciled, \{ method: ctx\.method, basedOn: ctx\.basedOn, pastSessions: ctx\.pastSessions, roastDate: ctx\.roastDate \}\)/);
  assert.match(chat, /targetTimeSec: t\.finishSec, timeline: t/);
  const client = await readFile(path.join(ROOT, "src/lib/brew/timeline.ts"), "utf8");
  assert.match(client, /recipe\.timeline && recipe\.timeline\.shape === "percolation"/, "the brew screen lowers the composed timeline instead of rebuilding it");
  const screen = await readFile(path.join(ROOT, "src/components/flow/LightStepRecommend.tsx"), "utf8");
  assert.match(screen, /recipe\.timeline/, "the recipe screen shows the composed steps");
  assert.match(screen, /drawdownSource/, "…with the drawdown's provenance");
});

test("WIRING: the prompt tells the model the app composes ONE timeline, and no longer promises √k or a roast shift", async () => {
  const prompt = await readFile(path.join(ROOT, "src/lib/claude/recommendPrompt.ts"), "utf8");
  assert.match(prompt, /composes ONE timeline|composes the timeline|one timeline/i);
  assert.doesNotMatch(prompt, /√k|sqrt\(k\)/, "no batch-scaling law in the prompt");
  const seq = await readFile(path.join(ROOT, "src/lib/utils/pourSequence.ts"), "utf8");
  assert.match(seq, /LEGACY renderer/, "the client schedule builder is marked as the legacy path");
});
