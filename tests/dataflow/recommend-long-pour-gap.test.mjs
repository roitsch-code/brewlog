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

test("bloom + 2 pours over a 5:00 clock no longer renders a hole (the report, fixed)", () => {
  // THE REPORT: "3–4 pours and pour 2 was somehow 2 minutes". This exact recipe
  // used to render a ~105s hole — not because of anything it said, but because
  // the renderer reserved a third of the clock for drawdown and then spread two
  // pours across what was left. Cadence-first (Sep 2026) the pours take the time
  // their water needs and the leftover becomes drawdown, so the hole is gone.
  const recipe = {
    targetTimeSec: 300,
    pourSteps: [water(50, "bloom"), water(175, "pour"), water(300, "final")],
  };
  const gap = maxRenderedPourGapSec(recipe, OLD_ROAST, NOW);
  assert.ok(gap <= 75, `the renderer must not invent a hole, got ${gap}s`);
});

test("a recipe that AUTHORS a two-minute wait still trips the guard", () => {
  // What the guard is for now: a recipe whose own plan parks the brew. Kasuya's
  // Mugen draw (105s) is a real, published example of this shape.
  const recipe = {
    targetTimeSec: 300,
    pourSteps: [
      water(50, "bloom"),
      { action: "wait", durationSec: 30 },
      water(175, "pour"),
      { action: "wait", durationSec: 120 },
      water(300, "final"),
    ],
  };
  const gap = maxRenderedPourGapSec(recipe, OLD_ROAST, NOW);
  assert.ok(gap > 75, `an authored 2-minute park must be caught, got ${gap}s`);
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
  // Since 2026-09-30 the Special (fast-shot) ceiling runs after the gap guard,
  // so the chain is gapGuarded → guardSpecialTime → candidates.
  assert.match(
    src,
    /timeGuarded\s*=\s*guardSpecialTime\(\s*gapGuarded/,
    "the gap-guarded set MUST feed the Special guard, or the gap guard is dead code",
  );
  // … → normalizeGrindToGrinder (grindGuarded) → the pour-sequence re-derive
  // that yields `candidates` (2026-10-03). Every link must chain.
  assert.match(src, /grindGuarded\s*=\s*timeGuarded\.map/, "the grind-unit pass must read the time-guarded set");
  assert.match(
    src,
    /candidates\s*=\s*grindGuarded\.map/,
    "the final candidates MUST derive from the guarded chain",
  );
});

test("the gap guard passes the method, so a disc recipe is judged as it renders", async () => {
  const src = await readFile(path.join(ROOT, "src/lib/claude/recommend.ts"), "utf8");
  assert.match(
    src,
    /maxRenderedPourGapSec\(c\.recipe,\s*coffee\.roastDate,\s*undefined,\s*c\.method\)/,
    "the guard must render with the candidate's own method, or a disc brew is checked as a bare one",
  );
});
