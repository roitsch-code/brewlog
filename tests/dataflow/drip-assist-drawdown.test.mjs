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
  drawdownReserveFrac,
  pourStepsFromStructured,
  DRAWDOWN_RESERVE_FRAC,
  DRIP_ASSIST_DRAWDOWN_FRAC,
} from ${JSON.stringify(path.join(ROOT, "src/lib/utils/pourSequence.ts"))};
export { calibrateDripAssistFinish } from ${JSON.stringify(
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
  drawdownReserveFrac,
  pourStepsFromStructured,
  DRAWDOWN_RESERVE_FRAC,
  DRIP_ASSIST_DRAWDOWN_FRAC,
  calibrateDripAssistFinish,
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

test("drawdownReserveFrac: thin for the disc, standard otherwise", () => {
  assert.equal(drawdownReserveFrac(DISC), DRIP_ASSIST_DRAWDOWN_FRAC);
  assert.equal(drawdownReserveFrac("Orea Classic + Drip Assist"), DRIP_ASSIST_DRAWDOWN_FRAC);
  assert.equal(drawdownReserveFrac("V60"), DRAWDOWN_RESERVE_FRAC);
  assert.equal(drawdownReserveFrac("Orea Classic"), DRAWDOWN_RESERVE_FRAC);
  assert.equal(drawdownReserveFrac(undefined), DRAWDOWN_RESERVE_FRAC);
  assert.ok(DRIP_ASSIST_DRAWDOWN_FRAC < DRAWDOWN_RESERVE_FRAC);
});

test("render: the disc's final pour lands near the finish, the bare brew leaves a long tail", () => {
  const r = recipe(200);
  const bare = pourStepsFromStructured(r, undefined, NOW); // no method → 0.33
  const disc = pourStepsFromStructured(r, undefined, NOW, DISC); // → 0.07

  const bareLast = bare[bare.length - 1].startTimeSec;
  const discLast = disc[disc.length - 1].startTimeSec;

  // Bare: final pour at ~target*(1-0.33) → a ~66s dead drawdown tail.
  assert.ok(Math.abs(bareLast - Math.round(200 * (1 - 0.33))) <= 2, `bareLast=${bareLast}`);
  const bareTail = 200 - bareLast;
  // Disc: final pour at ~target*(1-0.07) → a thin ~14s drainage margin.
  assert.ok(Math.abs(discLast - Math.round(200 * (1 - 0.07))) <= 2, `discLast=${discLast}`);
  const discTail = 200 - discLast;

  assert.ok(discTail < bareTail, `disc tail ${discTail} should be < bare tail ${bareTail}`);
  assert.ok(discTail <= 20, `disc drawdown tail ${discTail}s should be thin`);
  assert.ok(bareTail >= 55, `bare drawdown tail ${bareTail}s should be the full reserve`);
});

test("compose: the recommend-time shrink + render reserve reproduce the bare cadence, shorter", () => {
  const bareRecipe = recipe(200);
  const bareSteps = pourStepsFromStructured(bareRecipe, undefined, NOW); // method undefined

  // The real recommend-side function decides the shrunk clock for a locked disc.
  const candidate = { method: DISC, recipe: bareRecipe, role: "anchor", title: "T", whyChosen: "", confidence: "high" };
  const [out] = calibrateDripAssistFinish([candidate], true, isPercolation);
  const TD = out.recipe.targetTimeSec;

  assert.ok(TD < 200, `shrunk total ${TD} should be shorter than 200`);
  assert.ok(TD >= 130 && TD <= 160, `shrunk total ${TD} ≈ 0.72*200`);

  // Render that shorter clock as a disc brew → the pour START times must match
  // the bare brew's exactly (same cadence), only the total is shorter.
  const discSteps = pourStepsFromStructured({ ...bareRecipe, targetTimeSec: TD }, undefined, NOW, DISC);
  assert.deepEqual(starts(discSteps), starts(bareSteps), "disc cadence must equal the bare cadence");
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
