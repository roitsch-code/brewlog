// Drip-Assist drawdown / finish-time tests. Bundles the REAL pourSequence.ts
// (render side) and recommend.ts (the recommend-time finish shrink) and proves
// the two compose: a locked "V60 + Drip Assist" brew keeps the bare recipe's
// pour cadence but drops the fictional ~33% drawdown tail, so the timer finishes
// when the cup is actually through instead of ~a minute later.
//
//   node --test tests/dataflow/drip-assist-drawdown.test.mjs
//
// The bug it fixes (owner-observed, Aug 2026): the disc distributes water across
// the whole bed, so it drains almost as fast as it's poured — but every recipe
// budgeted 33% of total time for a drawdown that doesn't happen, so the recipe
// "finished a minute early". Non-disc brews are unchanged (the golden
// brew-timeline test guards byte-identity); this file proves the disc case.

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
  minDrawdownSec,
  pourStepsFromStructured,
  pourScheduleFor,
  MIN_DRAWDOWN_SEC,
} from ${JSON.stringify(path.join(ROOT, "src/lib/utils/pourSequence.ts"))};
export { calibrateDripAssistFinish, DRIP_ASSIST_DRAWDOWN_KEEP, DRIP_ASSIST_DRAWDOWN_FLOOR_SEC } from ${JSON.stringify(
  path.join(ROOT, "src/lib/claude/recommend.ts"),
)};
export {
  selectRecipes,
  brewersFromMethod,
  hasLongDesignedWait,
  longestDesignedWaitSec,
  LONG_DESIGNED_WAIT_SEC,
  ALL_RECIPES,
} from ${JSON.stringify(path.join(ROOT, "src/lib/knowledge/recipes/helpers.ts"))};
`;
const dir = await mkdtemp(join(tmpdir(), "dripdd-"));
const out = join(dir, "dd.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const {
  minDrawdownSec,
  pourStepsFromStructured,
  pourScheduleFor,
  MIN_DRAWDOWN_SEC,
  calibrateDripAssistFinish,
  DRIP_ASSIST_DRAWDOWN_KEEP,
  DRIP_ASSIST_DRAWDOWN_FLOOR_SEC,
  selectRecipes,
  brewersFromMethod,
  hasLongDesignedWait,
  longestDesignedWaitSec,
  LONG_DESIGNED_WAIT_SEC,
  ALL_RECIPES,
} = await import(pathToFileURL(out).href);

const DISC = "V60 + Drip Assist";
const isPercolation = (m) => /v60|orea|origami|kalita|chemex/i.test(m ?? "");

// A fixed clock so getBloomDuration is deterministic (>22 days old → 30s bloom
// is irrelevant here; we pass no roastDate → 45s peak bloom).
const NOW = 1_000_000_000_000;

/** bloom + 3 pours, cumulative 45 → 150 → 250 → 350. */
function recipe(targetTimeSec) {
  return {
    doseGrams: 22,
    waterGrams: 350,
    waterTempC: 94,
    grindSize: "385",
    targetTimeSec,
    pourSteps: [
      { action: "bloom", label: "Bloom", waterGramsAtEnd: 45, durationSec: 45 },
      { action: "pour", label: "Pour 2", waterGramsAtEnd: 150, durationSec: 20 },
      { action: "pour", label: "Pour 3", waterGramsAtEnd: 250, durationSec: 20 },
      { action: "final", label: "Final pour", waterGramsAtEnd: 350, durationSec: 20 },
    ],
  };
}

const starts = (steps) => steps.map((s) => s.startTimeSec);

test("the drawdown floor is a physics floor, not a per-method reserve", () => {
  // Until Sep 2026 the disc was modelled as a SMALLER SHARE of the clock (7% vs
  // 33%), which is what let the renderer re-derive the cadence from the clock.
  // Cadence-first there is no share: the pours take their own time and the disc
  // is handled by shortening the TAIL at recommend time (below).
  assert.equal(minDrawdownSec(DISC), MIN_DRAWDOWN_SEC);
  assert.equal(minDrawdownSec("V60"), MIN_DRAWDOWN_SEC);
  assert.equal(minDrawdownSec(undefined), MIN_DRAWDOWN_SEC);
  assert.ok(DRIP_ASSIST_DRAWDOWN_KEEP < 1, "the disc keeps only part of the bare tail");
});

test("render: the disc and the bare brew pour identically — only the tail differs", () => {
  const r = recipe(200);
  const bare = pourStepsFromStructured(r, undefined, NOW);
  const disc = pourStepsFromStructured(r, undefined, NOW, DISC);

  // Same recipe, same pours: the disc changes how fast the bed DRAINS, not how
  // the user pours, so the cadence is identical and the method never re-times it.
  assert.deepEqual(starts(disc), starts(bare), "the disc must not move a pour");

  // This fixture authors no rests, so the fallback spaces the pours to leave a
  // drawdown near the corpus median: bloom 45s, pours 20s each, 12s rests.
  assert.deepEqual(starts(bare), [0, 45, 77, 109]);
  const schedule = pourScheduleFor(r, undefined, NOW);
  assert.equal(schedule.pourPhaseEndSec, 129);
  assert.equal(schedule.drawdownSec, 200 - 129, "the clock's leftover IS the drawdown");
});

test("compose: the recommend-time shrink removes the tail and nothing else", () => {
  const bareRecipe = recipe(200);
  const bareSteps = pourStepsFromStructured(bareRecipe, undefined, NOW);
  const discSteps = (t) => pourStepsFromStructured({ ...bareRecipe, targetTimeSec: t }, undefined, NOW, DISC);

  // The real recommend-side function decides the shrunk clock for a locked disc.
  const candidate = { method: DISC, recipe: bareRecipe, role: "anchor", title: "T", whyChosen: "", confidence: "high" };
  const [out] = calibrateDripAssistFinish([candidate], true, isPercolation);
  const TD = out.recipe.targetTimeSec;

  // Bare drawdown is 200 − 129 = 71s; the disc keeps ~21% of it (floored at 10s),
  // so the clock loses the difference and nothing else.
  const bareTail = 71;
  const expectedDiscTail = Math.max(
    DRIP_ASSIST_DRAWDOWN_FLOOR_SEC,
    Math.round(bareTail * DRIP_ASSIST_DRAWDOWN_KEEP),
  );
  assert.equal(TD, 200 - (bareTail - expectedDiscTail));
  assert.ok(TD >= 130 && TD <= 160, `shrunk total ${TD} ≈ 0.72*200`);
  assert.ok(TD < 200, `shrunk total ${TD} should be shorter than 200`);

  // The shortened clock still ends after the last pour is poured.
  const discSchedule = pourScheduleFor({ ...bareRecipe, targetTimeSec: TD }, undefined, NOW, DISC);
  assert.ok(TD >= discSchedule.pourPhaseEndSec, "the shrunk clock must not cut a pour");
  // This fixture authors no rests, so the fallback re-spaces them for the shorter
  // clock — the pours move a little. A recipe that states its own cadence does
  // not, which is the case that matters and is asserted next.
  assert.ok(Math.abs(starts(discSteps(TD))[3] - starts(bareSteps)[3]) <= 5);
});

test("compose: a recipe with its OWN rests keeps its cadence exactly when the disc shortens the clock", () => {
  // The real case once a recipe times itself: pours at 0 / 45 / 110 / 175
  // whatever the clock says, because the recipe says so.
  const authored = {
    doseGrams: 22,
    waterGrams: 350,
    waterTempC: 94,
    grindSize: "385",
    // Pours run to 3:15; a bare cone then drains for ~70s, which is the tail the
    // disc does not need.
    targetTimeSec: 265,
    pourSteps: [
      { action: "bloom", label: "Bloom", waterGramsAtEnd: 45, durationSec: 10 },
      { action: "wait", label: "Rest", durationSec: 35 },
      { action: "pour", label: "Pour 2", waterGramsAtEnd: 150, durationSec: 20 },
      { action: "wait", label: "Rest", durationSec: 45 },
      { action: "pour", label: "Pour 3", waterGramsAtEnd: 250, durationSec: 20 },
      { action: "wait", label: "Rest", durationSec: 45 },
      { action: "final", label: "Final pour", waterGramsAtEnd: 350, durationSec: 20 },
    ],
  };
  const bare = pourStepsFromStructured(authored, undefined, NOW);
  const candidate = { method: DISC, recipe: authored, role: "anchor", title: "T", whyChosen: "", confidence: "high" };
  const [out] = calibrateDripAssistFinish([candidate], true, isPercolation);
  const TD = out.recipe.targetTimeSec;
  assert.ok(TD < 265, "the fictional tail is removed");
  const disc = pourStepsFromStructured({ ...authored, targetTimeSec: TD }, undefined, NOW, DISC);
  assert.deepEqual(starts(disc), starts(bare), "an authored cadence is clock-independent");
  assert.deepEqual(starts(bare), [0, 45, 110, 175]);
});

test("recommend-side guards: only a locked, percolation, hot disc candidate is shrunk", () => {
  const mk = (over = {}) => ({
    method: DISC,
    recipe: recipe(200),
    role: "anchor",
    title: "T",
    whyChosen: "",
    confidence: "high",
    ...over,
  });

  // not locked → untouched
  assert.equal(calibrateDripAssistFinish([mk()], false, isPercolation)[0].recipe.targetTimeSec, 200);
  // locked but NOT a disc candidate → untouched
  assert.equal(
    calibrateDripAssistFinish([mk({ method: "V60" })], true, isPercolation)[0].recipe.targetTimeSec,
    200,
  );
  // iced disc → untouched (its time isn't a drawdown)
  assert.equal(
    calibrateDripAssistFinish([mk({ recipe: { ...recipe(200), iceGrams: 120 } })], true, isPercolation)[0]
      .recipe.targetTimeSec,
    200,
  );
  // cold-brew steep (>=3600s) → untouched
  assert.equal(
    calibrateDripAssistFinish([mk({ recipe: recipe(43200) })], true, isPercolation)[0].recipe.targetTimeSec,
    43200,
  );
  // the real case → shrunk
  assert.ok(calibrateDripAssistFinish([mk()], true, isPercolation)[0].recipe.targetTimeSec < 200);
});

// ── Long-designed-wait exclusion for the disc ────────────────────────────────
// The owner's rule: don't rewrite recipes, just don't OFFER steep-/rest-heavy
// ones for the Drip Assist (the disc drains as fast as it's poured). Researched
// from the corpus: the genuine long-wait V60 designs are Kasuya Mugen (105s draw),
// Hedrick bypass (100s gap) and Rao's Rule-of-Thirds (80s rest); normal pulse
// recipes top out ~55s.
const byId = (id) => ALL_RECIPES.find((r) => r.id === id);

test("longestDesignedWaitSec reads the recipe's own authored waits", () => {
  assert.equal(longestDesignedWaitSec(byId("kasuya-mugen-flat")), 105);
  assert.equal(longestDesignedWaitSec(byId("hoffmann-v60-better-one-cup")), 45);
  assert.ok(LONG_DESIGNED_WAIT_SEC > 60 && LONG_DESIGNED_WAIT_SEC < 80, "threshold sits in the corpus gap");
});

test("hasLongDesignedWait flags the steep-heavy designs, not normal pulse recipes", () => {
  for (const id of ["kasuya-mugen-flat", "hedrick-bypass-v60", "rao-rule-of-thirds"]) {
    assert.ok(hasLongDesignedWait(byId(id)), `${id} should be flagged long-wait`);
  }
  for (const id of ["kasuya-4-6-standard", "hoffmann-v60-better-one-cup", "rolf-april-v60"]) {
    assert.ok(!hasLongDesignedWait(byId(id)), `${id} should NOT be flagged`);
  }
});

test("disc selection excludes long-wait recipes; a normal lock keeps them", () => {
  const v60 = brewersFromMethod("V60 + Drip Assist");
  assert.ok(v60.has("v60"), "the disc method resolves to the v60 brewer");
  const base = { brewersAvailable: v60, lockedBrewers: v60, goal: "balanced", rotationSeed: 0 };

  const withWaits = selectRecipes({ ...base, excludeLongWaits: false }, 50).map((s) => s.recipe.id);
  const noWaits = selectRecipes({ ...base, excludeLongWaits: true }, 50).map((s) => s.recipe.id);

  // Present when NOT excluding (proves the flag is what removes them)...
  assert.ok(withWaits.includes("kasuya-mugen-flat"));
  // ...and gone when the disc is locked.
  for (const id of ["kasuya-mugen-flat", "hedrick-bypass-v60", "rao-rule-of-thirds"]) {
    assert.ok(!noWaits.includes(id), `${id} must not be offered for the disc`);
  }
  // Plenty of ordinary V60 recipes remain, and a normal one survives.
  assert.ok(noWaits.length >= 20, `only ${noWaits.length} left — over-pruned`);
  assert.ok(noWaits.includes("kasuya-4-6-standard"));
  assert.equal(withWaits.length - noWaits.length, 3, "exactly the 3 long-wait designs are removed");
});
