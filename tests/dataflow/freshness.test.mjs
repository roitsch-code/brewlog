// One freshness table for the whole app, and a stale bean's finer grind is not
// silently reversed.
//
//   node --test tests/dataflow/freshness.test.mjs
//
// Before 2026-09-30 bean age was classified in four places with slightly
// different edges (recommend.ts, the bloom in pourSequence.ts, brewSignature,
// the prompt), and the /recommend prompt contradicted itself: ">22 days →
// grind FINER" in one line, ">35 days → may need finer" in another. Worse, the
// fidelity guard's large-batch branch re-coarsened ANY grind more than 4°
// under the batch target — with no idea how old the beans were — so a model
// that correctly ground a 6-week-old bean finer on a big batch got it undone.

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const dir = await mkdtemp(join(tmpdir(), "fresh-"));
const out = join(dir, "f.mjs");
await build({
  stdin: {
    contents: `
      export { freshnessBucket, daysSinceRoast, freshnessNote } from ${JSON.stringify(path.join(ROOT, "src/lib/coffee/freshness.ts"))};
      export { getBloomDuration } from ${JSON.stringify(path.join(ROOT, "src/lib/utils/pourSequence.ts"))};
      export { reconcileToReference } from ${JSON.stringify(path.join(ROOT, "src/lib/claude/recipeFidelity.ts"))};
    `,
    resolveDir: ROOT,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const F = await import(pathToFileURL(out).href);

const DAY = 86_400_000;
const NOW = Date.parse("2026-09-30T08:00:00Z");
const roastedDaysAgo = (d) => new Date(NOW - d * DAY).toISOString().slice(0, 10);

test("freshnessBucket: one set of edges", () => {
  const expect = [
    [-3, "too-fresh"], [0, "too-fresh"], [4, "too-fresh"],
    [5, "very-fresh"], [6, "very-fresh"],
    [7, "peak"], [21, "peak"],
    [22, "past-peak"], [34, "past-peak"],
    [35, "softening"], [59, "softening"],
    [60, "stale"], [200, "stale"],
  ];
  for (const [days, bucket] of expect) assert.equal(F.freshnessBucket(days), bucket, `day ${days}`);
  assert.equal(F.freshnessBucket(null), "unknown");
  assert.equal(F.daysSinceRoast(roastedDaysAgo(22), NOW), 22);
  assert.equal(F.daysSinceRoast(undefined, NOW), null);
});

test("the bloom keeps its edges (50 / 45 / 30 s) and now reads the shared table", async () => {
  for (const [d, s] of [[4, 50], [6, 50], [7, 45], [21, 45], [22, 30], [60, 30]]) {
    assert.equal(F.getBloomDuration(roastedDaysAgo(d), NOW), s, `day ${d}`);
  }
  assert.equal(F.getBloomDuration(undefined, NOW), 45);
  const src = await readFile(path.join(ROOT, "src/lib/utils/pourSequence.ts"), "utf8");
  assert.match(src, /freshnessBucket\(/, "pourSequence must classify through the shared table");
});

test("recommend.ts and brewSignature classify through the shared table (wiring)", async () => {
  const rec = await readFile(path.join(ROOT, "src/lib/claude/recommend.ts"), "utf8");
  assert.match(rec, /freshnessNote\(/);
  assert.doesNotMatch(rec, /"slightly past peak"/, "the local ladder must be gone");
  const sig = await readFile(path.join(ROOT, "src/lib/claude/brewSignature.ts"), "utf8");
  assert.match(sig, /freshnessBucket\(/);
  assert.match(rec, /reconcileToReference\([^)]*daysOld/s, "the fidelity guard must be told the bean's age");
});

function kasuyaBatch({ dose, water, grind, time = 210 }) {
  return {
    doseGrams: dose,
    waterGrams: water,
    waterTempC: 93,
    grindSize: grind,
    targetTimeSec: time,
    pourSequence: "60 – 180 – 300 – 450",
    pourSteps: [
      { label: "Bloom", action: "bloom", waterGramsAtEnd: 60, durationSec: 45 },
      { label: "Pour 2", action: "pour", waterGramsAtEnd: 180, durationSec: 30 },
      { label: "Pour 3", action: "pour", waterGramsAtEnd: 300, durationSec: 30 },
      { label: "Final pour", action: "final", waterGramsAtEnd: 450, durationSec: 30 },
    ],
  };
}

test("a stale bean's finer grind on a big batch is not reversed (within the 15° grind tolerance)", () => {
  // Kasuya 4:6 ×1.5: the batch target is 407°. 395° is 12° finer.
  const fresh = F.reconcileToReference(kasuyaBatch({ dose: 30, water: 450, grind: "395°" }), "Kasuya 4:6", undefined, { daysOld: 10 });
  assert.equal(fresh.recipe.grindSize, "407°", "a peak-window bean still gets the batch coarsening");
  const stale = F.reconcileToReference(kasuyaBatch({ dose: 30, water: 450, grind: "395°" }), "Kasuya 4:6", undefined, { daysOld: 45 });
  assert.equal(stale.changed, false, "a 45-day bean ground finer on purpose must be left alone");
  const tooFine = F.reconcileToReference(kasuyaBatch({ dose: 30, water: 450, grind: "388°" }), "Kasuya 4:6", undefined, { daysOld: 45 });
  assert.equal(tooFine.recipe.grindSize, "407°", "beyond the tolerance it is still a single-cup grind on a big bed");
});
