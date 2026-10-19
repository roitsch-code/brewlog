// The physics a recipe has to satisfy before it reaches the brew timer.
//
//   node --test tests/dataflow/recipe-physics.test.mjs
//
// THE GATE: `/recommend` repairs a model's recipe in place, and until Sep 2026
// nothing in that chain checked whether its arithmetic held together — it could
// not, because the renderer threw the authored timings away and re-derived every
// pour from `targetTimeSec`. These tests pin the repairs AND the wiring: a guard
// that is written but never called is the failure mode this repo has shipped
// twice (#530, #535), so the last test reads recommend.ts and proves it runs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const entry = `
export { enforceRecipePhysics } from ${JSON.stringify(path.join(ROOT, "src/lib/recipe/enforceRecipePhysics.ts"))};
export { pourScheduleFor, MAX_POUR_RATE_GPS } from ${JSON.stringify(path.join(ROOT, "src/lib/utils/pourSequence.ts"))};
`;
const dir = await mkdtemp(join(tmpdir(), "physics-"));
const out = join(dir, "p.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
  external: ["pg", "pg-native", "drizzle-orm", "drizzle-orm/*"],
});
const { enforceRecipePhysics, pourScheduleFor, MAX_POUR_RATE_GPS } =
  await import(pathToFileURL(out).href);

const NOW = Date.UTC(2026, 8, 29);
const base = (over = {}) => ({
  doseGrams: 28,
  waterGrams: 450,
  waterTempC: 94,
  grindSize: "400°",
  targetTimeSec: 270,
  pourSequence: "",
  pourSteps: [
    { label: "Bloom", action: "bloom", waterGramsAtEnd: 60, durationSec: 15 },
    { label: "Rest", action: "wait", durationSec: 30 },
    { label: "Pour 2", action: "pour", waterGramsAtEnd: 190, durationSec: 30 },
    { label: "Rest", action: "wait", durationSec: 20 },
    { label: "Pour 3", action: "pour", waterGramsAtEnd: 320, durationSec: 30 },
    { label: "Rest", action: "wait", durationSec: 20 },
    { label: "Final pour", action: "final", waterGramsAtEnd: 450, durationSec: 30 },
  ],
  ...over,
});

test("a sound recipe is returned untouched", () => {
  const recipe = base();
  const res = enforceRecipePhysics(recipe, { method: "V60", now: NOW });
  assert.equal(res.dropped, false);
  assert.deepEqual(res.changes, []);
  assert.equal(res.recipe, recipe, "no repair means no new object");
});

test("a pour plan that goes backwards is dropped, not silently repaired", () => {
  // There is no honest fix: guessing which of the two numbers the model meant
  // would invent a parameter, which this repo does not do.
  const res = enforceRecipePhysics(
    base({
      pourSteps: [
        { label: "Bloom", action: "bloom", waterGramsAtEnd: 60, durationSec: 15 },
        { label: "Pour 2", action: "pour", waterGramsAtEnd: 320, durationSec: 30 },
        { label: "Final pour", action: "final", waterGramsAtEnd: 190, durationSec: 30 },
      ],
    }),
    { method: "V60", now: NOW },
  );
  assert.equal(res.dropped, true);
  assert.match(res.changes[0], /does not increase/);
});

test("the headline water is corrected to what the plan actually pours", () => {
  const res = enforceRecipePhysics(base({ waterGrams: 500 }), { method: "V60", now: NOW });
  assert.equal(res.recipe.waterGrams, 450, "the pour plan is the truth");
  assert.match(res.changes.join(" "), /waterGrams/);
});

test("an impossible pour rate is stretched to something a person can pour", () => {
  // 225g in 10s is 22.5 g/s. The repair gives it the time it needs, and says so.
  const res = enforceRecipePhysics(
    base({
      pourSteps: [
        { label: "Bloom", action: "bloom", waterGramsAtEnd: 90, durationSec: 20 },
        { label: "Rest", action: "wait", durationSec: 25 },
        { label: "Pour 2", action: "pour", waterGramsAtEnd: 225, durationSec: 30 },
        { label: "Rest", action: "wait", durationSec: 20 },
        { label: "Final pour", action: "final", waterGramsAtEnd: 450, durationSec: 10 },
      ],
    }),
    { method: "V60", now: NOW },
  );
  const final = res.recipe.pourSteps.at(-1);
  assert.equal(final.durationSec, Math.ceil(225 / MAX_POUR_RATE_GPS));
  assert.match(res.changes.join(" "), /22\.5 g\/s/);
  // …and every pour in the repaired recipe is now pourable.
  const schedule = pourScheduleFor(res.recipe, undefined, NOW, "V60");
  for (const s of schedule.steps.filter((x) => x.pourGrams > 0)) {
    assert.ok(s.pourGrams / s.timingDurationSec <= MAX_POUR_RATE_GPS + 0.001);
  }
});

// The clock checks that lived here as steps 4–6 (raise a short clock, trim a
// padded one, immersion = Σ steps) moved to src/lib/brew/composeTimeline.ts on
// 2026-10-19 — tests/dataflow/compose-timeline.test.mjs covers them.

test("a cold steep and an iced build are left alone", () => {
  const cold = base({ targetTimeSec: 43200 });
  assert.equal(enforceRecipePhysics(cold, { now: NOW }).recipe, cold);
  const iced = base({ iceGrams: 150, targetTimeSec: 120 });
  assert.equal(enforceRecipePhysics(iced, { now: NOW }).recipe, iced);
});

test("WIRING: recommend.ts runs the guard and uses its output", async () => {
  const src = await readFile(path.join(ROOT, "src/lib/claude/recommend.ts"), "utf8");
  assert.match(src, /enforceRecipePhysics/, "recommend.ts must import the guard");
  assert.match(
    src,
    /const physicsChecked\s*=\s*batchChecked\.map/,
    "every candidate must go through the guard",
  );
  assert.match(
    src,
    /guardVesselCapacity\(\s*deSwirledSafe/,
    "the guarded candidates — not the raw ones — must flow on, or the guard is dead code",
  );
});
