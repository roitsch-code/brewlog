// Three /recommend leftovers from the 2026-10-10 Hoffmann V60 analysis.
//
//   node --test tests/dataflow/recommend-leftovers.test.mjs
//
// 1. A full fidelity snap against a verified reference that publishes NO Niche
//    number wrote the scaled-grind PROSE "medium-fine (≈+10° coarser …)" into
//    grindSize, and normalizeGrindToGrinder read the "10" as 10 Comandante
//    clicks → 337° (both bugs verified in-session on #579's code).
// 2. Temperature was compared against `celsius` alone (100 for Hoffmann's
//    1-Cup) with ±6 °C, so a 93 °C brew of a medium roast was "drift" and
//    snapped to 100 °C although the entry carries rangeC [90, 100].
// 3. The verified-reference branch of calibrateDrawdownClock kept the MODEL's
//    clock untouched — with house-paced pours that left as little as the 5 s
//    physics floor of drawdown on a verified Hoffmann.

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const dir = await mkdtemp(join(tmpdir(), "leftovers-"));
const out = join(dir, "t.mjs");
await build({
  stdin: {
    contents: `
export { normalizeGrindToGrinder } from ${JSON.stringify(path.join(ROOT, "src/lib/utils/grindUnit.ts"))};
export { reconcileToReference, refTempTarget, resolveReference } from ${JSON.stringify(path.join(ROOT, "src/lib/claude/recipeFidelity.ts"))};
export { calibrateDrawdownClock } from ${JSON.stringify(path.join(ROOT, "src/lib/claude/recommend.ts"))};
export { scaleRecipe } from ${JSON.stringify(path.join(ROOT, "src/lib/recipe/scaleRecipe.ts"))};
export { pourScheduleFor } from ${JSON.stringify(path.join(ROOT, "src/lib/utils/pourSequence.ts"))};
export { ALL_RECIPES } from ${JSON.stringify(path.join(ROOT, "src/lib/knowledge/recipes/index.ts"))};
`,
    resolveDir: ROOT,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
  external: ["pg", "pg-native", "drizzle-orm", "drizzle-orm/*"],
});
const M = await import(pathToFileURL(out).href);
const ONE_CUP = M.ALL_RECIPES.find((r) => r.id === "hoffmann-v60-better-one-cup");
const ROLF = M.ALL_RECIPES.find((r) => r.id === "rolf-april-v60");
assert.ok(ONE_CUP?.verified && ROLF?.verified, "fixtures must be verified corpus entries");

const stepsFrom = (ref, k = 1) =>
  (ref.pourSequence ?? []).map((s) => ({
    label: s.label,
    action: s.action,
    waterGramsAtEnd: typeof s.waterGramsAtEnd === "number" ? Math.round(s.waterGramsAtEnd * k) : undefined,
    durationSec: s.durationSec,
  }));

// ---------- 1. the 337° bug ----------

test("a number buried in prose is not a grind setting", () => {
  const prose = "medium-fine (≈+10° coarser than the published single-cup setting)";
  assert.equal(M.normalizeGrindToGrinder(prose, "Niche Zero"), prose, "left alone, not converted to 337°");
  assert.equal(M.normalizeGrindToGrinder(prose, "Comandante C40"), prose);
  // Leading settings still convert.
  assert.equal(M.normalizeGrindToGrinder("26 clicks", "Niche Zero"), "390°");
  assert.equal(M.normalizeGrindToGrinder("~400", "Comandante C40"), "29 clicks");
  assert.equal(M.normalizeGrindToGrinder("406° (Niche Zero)", "Comandante C40"), "31 clicks");
});

test("a full snap onto a verified reference with no Niche number keeps the candidate's own grind", () => {
  // Rolf's April V60 publishes no degree number. Drift two dials (time + temp)
  // so the whole signature snaps — the grind must stay the candidate's number,
  // not the prose note.
  const recipe = {
    doseGrams: 20,
    waterGrams: 300,
    waterTempC: 80,
    grindSize: "392°",
    targetTimeSec: 420,
    pourSteps: stepsFrom(ROLF),
  };
  const r = M.reconcileToReference(recipe, ROLF.name, "V60");
  assert.equal(r.changed, true);
  assert.ok(r.reasons.length >= 2, `expected a full snap, got ${JSON.stringify(r.reasons)}`);
  assert.equal(r.recipe.grindSize, "392°", "prose must never become the grind setting");
  assert.equal(M.normalizeGrindToGrinder(r.recipe.grindSize, "Niche Zero"), "392°");
});

// ---------- 2. temperature inside the published range ----------

test("a temperature inside the reference's rangeC is not drift", () => {
  assert.deepEqual(M.refTempTarget(ONE_CUP, 93), { ok: true, target: null });
  assert.deepEqual(M.refTempTarget(ONE_CUP, 90), { ok: true, target: null });
  assert.deepEqual(M.refTempTarget(ONE_CUP, 85), { ok: false, target: 90 }, "below the range → the nearest bound, not 100");
  // Single published value keeps the ±6 °C band.
  assert.deepEqual(M.refTempTarget(ROLF, 96), { ok: true, target: null });
  assert.deepEqual(M.refTempTarget(ROLF, 80), { ok: false, target: 92 });
});

test("a 93 °C Hoffmann 1-Cup is accepted; an 85 °C one snaps to 90, never to 100", () => {
  const base = {
    doseGrams: 15,
    waterGrams: 250,
    grindSize: "380°",
    targetTimeSec: ONE_CUP.totalTimeSec,
    pourSteps: stepsFrom(ONE_CUP),
  };
  const ok = M.reconcileToReference({ ...base, waterTempC: 93 }, ONE_CUP.name, "V60");
  assert.equal(ok.changed, false, `93 °C must not be drift: ${JSON.stringify(ok.reasons)}`);
  assert.equal(ok.recipe.waterTempC, 93);

  const low = M.reconcileToReference({ ...base, waterTempC: 85 }, ONE_CUP.name, "V60");
  assert.equal(low.changed, true);
  assert.equal(low.recipe.waterTempC, 90, "nearest allowed value, not the headline 100");
});

// ---------- 3. the verified clock = pours end + published drawdown ----------

test("calibrateDrawdownClock on a verified reference sets pours end + the scaled published drawdown", () => {
  const recipe = {
    doseGrams: 15,
    waterGrams: 250,
    waterTempC: 100,
    grindSize: "380°",
    // The model's clock: far too short for Hoffmann's drawdown.
    targetTimeSec: 150,
    pourSteps: stepsFrom(ONE_CUP),
  };
  const cand = { title: "t", method: "V60", basedOn: ONE_CUP.name, recipe };
  // No measured V60 drawdowns → the estimate's source is "corpus", which is
  // exactly the branch that used to keep the model's number.
  const now = Date.UTC(2026, 9, 10, 8, 0, 0);
  const [out] = M.calibrateDrawdownClock([cand], [], (m) => /v60/i.test(m ?? ""), undefined, now);
  const schedule = M.pourScheduleFor(recipe, undefined, now, "V60");
  const scaled = M.scaleRecipe(ONE_CUP, 250, { method: "V60" });
  assert.ok(schedule && scaled);
  const expected = schedule.pourPhaseEndSec + Math.round(scaled.drawdownSec);
  assert.equal(out.recipe.targetTimeSec, expected, "pours end + Hoffmann's drawdown");
  assert.notEqual(out.recipe.targetTimeSec, 150, "the model's clock is not kept");
  assert.ok(out.recipe.targetTimeSec - schedule.pourPhaseEndSec >= 30, "a real drawdown, not the 5 s physics floor");
});
