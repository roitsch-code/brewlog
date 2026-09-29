// Scaling a published recipe to the batch the user is actually brewing.
//
//   node --test tests/dataflow/recipe-scaling.test.mjs
//
// THE GATE: before Sep 2026 there was no scaling model. References were printed
// to the model at their published numbers with a prose "scale the grams", and
// the deterministic guard then scaled the milestones while copying every step
// DURATION verbatim — so a 50g pulse over 10s became an 80g pulse over 10s
// (8 g/s) — and snapped the clock back to the single-cup total. The owner's
// report: "nicht einfach die Zeiten verlängern, sondern alle Parameter checken".
//
// The anchors below come from the experts' own published pairs, not from the
// code: Hoffmann publishes the same V60 at 15:250 and 30:500, Kasuya's 4:6 is
// documented at 20:300 and scales by pour SIZE, Rao pours twice at any batch,
// and the grind law is the owner's own measured +20°-per-doubling.
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
export { scaleRecipe, scaleGrind, formatScaledForPrompt, DRAWDOWN_SCALE_EXP, GRIND_DEG_PER_DOUBLING } from ${JSON.stringify(path.join(ROOT, "src/lib/recipe/scaleRecipe.ts"))};
export { MAX_POUR_RATE_GPS } from ${JSON.stringify(path.join(ROOT, "src/lib/utils/pourSequence.ts"))};
export { ALL_RECIPES } from ${JSON.stringify(path.join(ROOT, "src/lib/knowledge/recipes/index.ts"))};
`;
const dir = await mkdtemp(join(tmpdir(), "scaling-"));
const out = join(dir, "s.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { scaleRecipe, scaleGrind, MAX_POUR_RATE_GPS, GRIND_DEG_PER_DOUBLING, ALL_RECIPES } =
  await import(pathToFileURL(out).href);

const byId = (id) => {
  const r = ALL_RECIPES.find((x) => x.id === id);
  assert.ok(r, `${id} missing from the corpus`);
  return r;
};
const waterSteps = (s) => s.pourSteps.filter((x) => typeof x.waterGramsAtEnd === "number");

test("the ratio holds, so the dose follows the water", () => {
  const ref = byId("hoffmann-v60-better-one-cup"); // 15 : 250
  const s = scaleRecipe(ref, 500);
  assert.equal(s.doseGrams, 30);
  assert.equal(s.waterGrams, 500);
  const k = scaleRecipe(ref, 400);
  assert.equal(k.doseGrams, 24);
  assert.equal(k.waterGrams, 400);
});

test("the pour COUNT is unchanged — only the pours get bigger", () => {
  // Kasuya's 4:6 at 30g/450g is five 90g pours on the same 45s intervals, not a
  // different number of pours. (philocoffea.com; the method IS the interval.)
  const ref = byId("kasuya-4-6-standard");
  const s = scaleRecipe(ref, 450);
  const pours = waterSteps(s);
  assert.equal(pours.length, waterSteps({ pourSteps: ref.pourSequence }).length);
  assert.equal(pours.length, 5);
  const increments = pours.map((p, i) => p.waterGramsAtEnd - (i ? pours[i - 1].waterGramsAtEnd : 0));
  assert.deepEqual(increments, [90, 90, 90, 90, 90]);
});

test("the rests are the recipe's cadence and do not scale", () => {
  const ref = byId("kasuya-4-6-standard");
  const s = scaleRecipe(ref, 450);
  const rests = s.pourSteps.filter((x) => x.action === "wait").map((x) => x.durationSec);
  const refRests = ref.pourSequence.filter((x) => x.action === "wait").map((x) => x.durationSec);
  assert.deepEqual(rests, refRests, "a 45s interval is 45s at any batch size");
});

test("a bigger pour takes LONGER in seconds — it does not keep the reference's seconds", () => {
  // The old guard copied `durationSec` verbatim, so Hoffmann's 50g/10s pulse
  // became an 80g/10s pulse = 8 g/s. The pour is derived from a rate instead.
  const ref = byId("kasuya-4-6-standard"); // 60g in 10s = 6 g/s
  const s = scaleRecipe(ref, 450); // 90g pours, k = 1.5
  const pours = waterSteps(s);
  for (const p of pours) {
    // 90g at 6 g/s would be 15s; the batch lifts the rate by sqrt(1.5) to
    // ~7.3 g/s, so 13s. Longer than the 10s it was authored at either way —
    // that is the whole point — and never the verbatim copy.
    assert.equal(p.durationSec, 13);
    assert.ok(p.durationSec > 10, "a 50% bigger pour cannot take the reference's seconds");
  }
  // And nothing is ever scheduled past what a person can pour.
  for (const p of pours) {
    const grams = p.waterGramsAtEnd - (waterSteps(s)[pours.indexOf(p) - 1]?.waterGramsAtEnd ?? 0);
    assert.ok(grams / p.durationSec <= MAX_POUR_RATE_GPS + 0.001);
  }
});

test("the grind follows the owner's measured law: +20° per DOUBLING, both ways", () => {
  const ref = byId("kasuya-4-6-standard"); // Niche 390–400
  assert.equal(scaleGrind(ref, 2).deltaDeg, GRIND_DEG_PER_DOUBLING);
  assert.equal(scaleGrind(ref, 0.5).deltaDeg, -GRIND_DEG_PER_DOUBLING);
  assert.equal(scaleGrind(ref, 1).deltaDeg, 0);
  // 1.5× is NOT +10 — the law is logarithmic, which the old linear
  // `20 × (ratio − 1)` only got right at exactly 2×.
  assert.equal(scaleGrind(ref, 1.5).deltaDeg, Math.round(20 * Math.log2(1.5)));
  assert.equal(scaleGrind(ref, 1.5).text, "402–412°");
});

test("the Drip Assist offset rides on top of the batch adjustment", () => {
  const ref = byId("kasuya-4-6-standard");
  const bare = scaleGrind(ref, 1.5);
  const disc = scaleGrind(ref, 1.5, "V60 + Drip Assist");
  assert.equal(disc.deltaDeg - bare.deltaDeg, 5);
});

test("a reference with no published Niche number keeps its prose and states the delta", () => {
  // Hoffmann publishes no grinder setting, so inventing a number would fabricate
  // a parameter. The prose is kept and the shift is named beside it.
  const ref = byId("hoffmann-v60-better-one-cup");
  const g = scaleGrind(ref, 2);
  assert.equal(g.prose, true);
  assert.equal(g.nicheRange, null);
  assert.match(g.text, /\+20° coarser/);
  assert.equal(scaleGrind(ref, 0.5).text.includes("-20° finer"), true);
});

test("scaling DOWN shortens the brew and grinds finer", () => {
  // Wendelboe, on his own guide: "for less volumes grind finer than if you are
  // brewing more volume."
  const ref = byId("hoffmann-v60-better-one-cup");
  const half = scaleRecipe(ref, 125);
  const full = scaleRecipe(ref, 250);
  assert.ok(half.grind.deltaDeg < 0, "a smaller batch grinds finer");
  assert.ok(half.totalTimeSec < full.totalTimeSec, "and finishes sooner");
  assert.ok(half.drawdownSec < full.drawdownSec);
});

test("the total time is the SUM of the scaled steps, never a multiple of the original", () => {
  const ref = byId("hoffmann-v60-better-one-cup"); // 3:00 at 250g
  const s = scaleRecipe(ref, 500);
  // Hoffmann publishes BOTH ends of this scale: 3:00 at 15:250 and 3:30 at
  // 30:500. A doubled batch must land near his answer, nowhere near the 6:00 a
  // linear stretch of the clock gives. We land at 3:53 — 23s over, and the 23s
  // are structural, not arithmetic: he redesigns four pulses into two
  // back-to-back pours, and the scaler deliberately never restructures a pour
  // plan it was given. The prompt carries "fewer, larger pours at a bigger
  // batch" so the model can make that call; this function only does the maths.
  assert.ok(s.totalTimeSec >= 195 && s.totalTimeSec <= 250, `${s.totalTimeSec}s`);
  assert.equal(s.totalTimeSec, Math.max(s.pourPhaseEndSec + s.drawdownSec, s.totalTimeSec));
});

test("a bigger batch is poured faster, not only for longer — and never past 8 g/s", () => {
  const ref = byId("hoffmann-v60-better-one-cup");
  const pourRates = (scaled) => {
    let prev = 0;
    const out = [];
    for (const step of scaled.pourSteps) {
      if (typeof step.waterGramsAtEnd !== "number") continue;
      const grams = step.waterGramsAtEnd - prev;
      prev = step.waterGramsAtEnd;
      if (grams > 0 && step.durationSec > 0) out.push(grams / step.durationSec);
    }
    return out;
  };
  const refRates = pourRates(scaleRecipe(ref, 250));
  const bigRates = pourRates(scaleRecipe(ref, 500));
  assert.equal(refRates.length, bigRates.length);
  for (const [i, rate] of bigRates.entries()) {
    // Hoffmann roughly DOUBLES the rate for a doubled batch (3.3-5 -> 6.7-8 g/s);
    // we move by sqrt(k), so every pour must be faster than the reference's and
    // still inside what an expert actually publishes.
    assert.ok(rate > refRates[i], `pour ${i}: ${rate.toFixed(2)} not faster than ${refRates[i].toFixed(2)} g/s`);
    assert.ok(rate <= 8 + 1e-9, `pour ${i} pours at ${rate.toFixed(2)} g/s — past the published ceiling`);
  }
  // Scaling DOWN keeps the reference's rate: no source says a smaller batch
  // should be poured more gently, and inventing that would be a brewing
  // decision wearing an arithmetic costume.
  for (const [i, rate] of pourRates(scaleRecipe(ref, 150)).entries()) {
    assert.ok(Math.abs(rate - refRates[i]) < 0.9, `pour ${i}: ${rate.toFixed(2)} vs ${refRates[i].toFixed(2)} g/s`);
  }
});

test("the temperature does not move with the batch", () => {
  const ref = byId("kasuya-4-6-standard");
  assert.equal(scaleRecipe(ref, 450).waterTempC, ref.temperature.celsius);
  assert.equal(scaleRecipe(ref, 150).waterTempC, ref.temperature.celsius);
});

test("a label that restates its milestone is rewritten, never left contradicting the number", () => {
  const ref = byId("rao-rule-of-thirds"); // "Pour to 200 g"
  const s = scaleRecipe(ref, 450);
  for (const p of waterSteps(s)) {
    const stale = /\b(\d{2,4})\s*g\b/.exec(p.label ?? "");
    if (!stale) continue;
    assert.equal(Number(stale[1]), p.waterGramsAtEnd, `label "${p.label}" contradicts its own milestone`);
  }
});

test("an immersion steep keeps its steep, and a split build is flagged not re-timed", () => {
  const clever = ALL_RECIPES.find((r) => r.brewer === "clever" && r.totalTimeSec < 3600);
  if (clever) {
    const s = scaleRecipe(clever, clever.water.grams * 1.5);
    assert.equal(s.shape, "immersion");
    const steeps = s.pourSteps.filter((x) => x.action === "wait").map((x) => x.durationSec);
    const refSteeps = clever.pourSequence.filter((x) => x.action === "wait").map((x) => x.durationSec);
    assert.deepEqual(steeps, refSteeps, "a steep is a steep at any volume");
  }
  const iced = ALL_RECIPES.find((r) => /iced|japanese/i.test(r.id) && r.totalTimeSec < 3600);
  if (iced) assert.equal(scaleRecipe(iced, iced.water.grams * 1.5).shape, "split-build");
});

test("every percolation recipe scales to 450ml without an unpourable step", () => {
  const broken = [];
  for (const r of ALL_RECIPES) {
    const s = scaleRecipe(r, 450);
    if (!s || s.shape !== "percolation") continue;
    let prev = 0;
    for (const p of waterSteps(s)) {
      const grams = p.waterGramsAtEnd - prev;
      prev = p.waterGramsAtEnd;
      if (grams / (p.durationSec ?? 1) > MAX_POUR_RATE_GPS + 0.001) {
        broken.push(`${r.id}: ${p.label} ${grams}g in ${p.durationSec}s`);
      }
    }
    if (s.waterGrams !== 450) broken.push(`${r.id}: scaled to ${s.waterGrams}g, not 450g`);
  }
  assert.deepEqual(broken, [], broken.join("\n  "));
});

// --- Wiring: a model that never sees the scaled numbers cannot use them ------

test("WIRING: /recommend hands the model each reference already scaled", async () => {
  const { readFile } = await import("node:fs/promises");
  const src = await readFile(path.join(ROOT, "src/lib/claude/recommend.ts"), "utf8");
  assert.match(src, /scaleTo:\s*\{\s*targetWaterGrams:\s*targetWaterMl/, "the target batch must reach the formatter");
  const fidelity = await readFile(path.join(ROOT, "src/lib/claude/recipeFidelity.ts"), "utf8");
  assert.match(fidelity, /scaleRecipe|scaledReference/, "the guard must snap to the SCALED reference");
  assert.match(fidelity, /scaleGrind/, "the grind window must use the shared scaling law");
  assert.doesNotMatch(
    fidelity,
    /20\s*\*\s*\(doseRatio\s*-\s*1\)/,
    "the linear grind law was only right at exactly 2× — it must not come back",
  );
});

test("WIRING: the chat's cached library block is deliberately unscaled", async () => {
  const { readFile } = await import("node:fs/promises");
  const src = await readFile(path.join(ROOT, "src/lib/chat/agentContext.ts"), "utf8");
  // It is memoized once per process and prompt-cached, so it cannot carry a
  // per-turn batch. Passing it through `.map` unguarded would hand
  // formatRecipeForPrompt the ARRAY INDEX as its options object.
  assert.match(src, /rs\.map\(\(r\)\s*=>\s*formatRecipeForPrompt\(r\)\)/);
});
