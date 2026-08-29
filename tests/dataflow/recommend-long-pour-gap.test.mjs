// Long-pour-gap guard — the owner's "3–4 pours and pour 2 was somehow 2 minutes"
// report. buildPourOver spreads a recipe's pours evenly across its targetTimeSec
// and reserves the drawdown tail, so FEW pours over a LONG clock render a big
// hole between two pours even when every AUTHORED pour is short. That derived
// gap is the dead time the owner brews from (a stalled, over-extracted, bad cup).
//
// Two halves, both required (the producer-consumer lesson — a function documented
// as feeding /recommend while nothing calls it has shipped here twice):
//   1. maxRenderedPourGapSec reads the RENDERED schedule and flags the hole.
//   2. recommend.ts actually imports it AND feeds the guarded set to `candidates`,
//      and recommendPrompt.ts carries the pour-vs-clock FLOOR that stops the
//      model authoring the hole in the first place.
//
//   node --test tests/dataflow/recommend-long-pour-gap.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const entry = `export { maxRenderedPourGapSec } from ${JSON.stringify(
  path.join(ROOT, "src/lib/utils/pourSequence.ts"),
)};`;
const dir = await mkdtemp(join(tmpdir(), "pourgap-"));
const out = join(dir, "b.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { maxRenderedPourGapSec } = await import(pathToFileURL(out).href);

// Fixed clock so getBloomDuration is deterministic (an old bag → shortest bloom,
// which only shifts the FIRST gap; the derived middle/late gaps don't depend on it).
const NOW = Date.UTC(2026, 7, 1);
const OLD_ROAST = "2026-06-01"; // >3 weeks → past-peak bloom

const water = (grams, action, durationSec = 10) => ({
  action,
  waterGramsAtEnd: grams,
  durationSec,
});

test("bloom + 2 pours over a 5:00 clock renders a >2-minute hole (the report)", () => {
  const recipe = {
    targetTimeSec: 300,
    pourSteps: [water(50, "bloom"), water(175, "pour"), water(300, "final")],
  };
  const gap = maxRenderedPourGapSec(recipe, OLD_ROAST, NOW);
  assert.ok(gap > 75, `expected a long derived gap, got ${gap}s`);
  assert.ok(gap > 100, `expected roughly the ~2-minute hole the owner saw, got ${gap}s`);
});

test("bloom + 4 pours over a 3:30 clock stays under the threshold", () => {
  const recipe = {
    targetTimeSec: 210,
    pourSteps: [
      water(45, "bloom"),
      water(120, "pour"),
      water(200, "pour"),
      water(275, "pour"),
      water(350, "final"),
    ],
  };
  const gap = maxRenderedPourGapSec(recipe, OLD_ROAST, NOW);
  assert.ok(gap <= 75, `a well-paced pulse recipe should not trip, got ${gap}s`);
});

test("immersion-shaped recipes are exempt (a steep is intentional)", () => {
  const recipe = {
    targetTimeSec: 240,
    pourSteps: [water(50, "bloom"), water(250, "pour"), { action: "press", durationSec: 30 }],
  };
  assert.equal(maxRenderedPourGapSec(recipe, OLD_ROAST, NOW), 0);
});

test("a recipe with no pour schedule returns 0, never throws", () => {
  assert.equal(maxRenderedPourGapSec({ targetTimeSec: 180 }, OLD_ROAST, NOW), 0);
  assert.equal(maxRenderedPourGapSec({ targetTimeSec: 180, pourSteps: [] }, OLD_ROAST, NOW), 0);
});

// --- Wiring: the guard must be imported AND feed the final candidate set ---

test("recommend.ts imports the gap metric and feeds the guarded set to candidates", async () => {
  const src = await readFile(path.join(ROOT, "src/lib/claude/recommend.ts"), "utf8");
  assert.match(src, /maxRenderedPourGapSec/, "recommend.ts must import the gap metric");
  assert.match(src, /LONG_DESIGNED_WAIT_SEC/, "recommend.ts must compare against the shared threshold");
  // The guarded set — not the raw discTimed — must be what the final candidates map over.
  assert.match(src, /gapGuarded/, "recommend.ts must build a gap-guarded candidate set");
  assert.match(
    src,
    /candidates\s*=\s*gapGuarded\.map/,
    "the final candidates MUST derive from gapGuarded, or the guard is dead code",
  );
});

test("recommendPrompt.ts carries the pour-vs-clock FLOOR rule", async () => {
  const src = await readFile(path.join(ROOT, "src/lib/claude/recommendPrompt.ts"), "utf8");
  assert.match(src, /COUNT YOUR POURS AGAINST THE CLOCK/, "the floor rule must be present");
  assert.match(src, /FLOORS, not targets/, "must state it as a floor, not a target");
  assert.match(src, /water steps \(bloom \+ pours\)/, "must count water steps incl. the bloom");
});
