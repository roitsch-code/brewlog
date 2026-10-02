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
export { DRIP_ASSIST_DRAWDOWN_KEEP, DRIP_ASSIST_DRAWDOWN_FLOOR_SEC } from ${JSON.stringify(
  path.join(ROOT, "src/lib/brew/drawdown.ts"),
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

// The recommend-time disc tail now lives in src/lib/brew/drawdown.ts and is
// tested with the rest of the clock in tests/dataflow/drawdown-clock.test.mjs.

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
