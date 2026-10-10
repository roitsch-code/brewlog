// Anchor: Costa Rica Adelina Falla, 7 Oct 2026 08:50, pulled from production by
// .github/workflows/recommend-logs.yml. Orea CLASSIC, 22 g : 350 g, basedOn
// "Wölfl 2024 — Orea V4 Fast" — a verified recipe for the FAST bottom.
//
//   log   recipe-fidelity: snapped … total time 215s vs 131s for this batch
//         physics: clock 131s → 180s (pours run to 175s, drawdown needs 5s)
//         (no drawdown-clock line: the verified-reference exemption skipped it)
//   real  last gram at 176 s, cup through at 224 s → a 48 s drawdown
//
// Both guards treated the Fast bottom's clock as the Classic brew's clock.
//
//   node --test tests/dataflow/reference-brewer-mismatch.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const entry = `
export { calibrateDrawdownClock } from ${JSON.stringify(path.join(ROOT, "src/lib/claude/recommend.ts"))};
export { brewerMatchesReference, resolveReference, reconcileToReference } from ${JSON.stringify(path.join(ROOT, "src/lib/claude/recipeFidelity.ts"))};
export { drawdownFor } from ${JSON.stringify(path.join(ROOT, "src/lib/brew/drawdown.ts"))};
export { pourScheduleFor } from ${JSON.stringify(path.join(ROOT, "src/lib/utils/pourSequence.ts"))};
`;
const out = path.join(ROOT, "node_modules/.cache/ref-brewer-mismatch/bundle.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
  external: ["pg", "pg-native", "drizzle-orm", "drizzle-orm/*"],
});
const K = await import(pathToFileURL(out).href);

const NOW = Date.parse("2026-10-07T06:40:00Z");
const ROAST = "2026-09-28";
const WOLFL = "Wölfl 2024 — Orea V4 Fast";
const isPercolation = (m) => /v60|orea|origami|kalita|chemex/i.test(m ?? "");

// The stored recipe, exactly as brewed (after the guard chain).
const ADELINA = {
  doseGrams: 22,
  waterGrams: 350,
  waterTempC: 93,
  grindSize: "388°",
  targetTimeSec: 180,
  pourSteps: [
    { label: "Needle the bed", action: "agitate-bed", durationSec: 0 },
    { label: "Bloom", action: "bloom", waterGramsAtEnd: 65, durationSec: 18 },
    { label: "Stir", action: "stir", durationSec: 5 },
    { label: "Rest", action: "wait", durationSec: 32 },
    { label: "Pour 2", action: "pour", waterGramsAtEnd: 170, durationSec: 14 },
    { label: "Rest", action: "wait", durationSec: 43 },
    { label: "Pour 3", action: "pour", waterGramsAtEnd: 260, durationSec: 12 },
    { label: "Rest", action: "wait", durationSec: 33 },
    { label: "Final pour", action: "final", waterGramsAtEnd: 350, durationSec: 18 },
  ],
};
const cand = (method, recipe = ADELINA) => ({ method, title: "t", basedOn: WOLFL, recipe });

test("the reference really is a verified FAST-bottom recipe", () => {
  const ref = K.resolveReference(WOLFL);
  assert.ok(ref?.verified);
  assert.equal(ref.brewer, "orea-v4-fast");
});

test("brewer match: same bottom yes, other Orea bottom no, other brewer no", () => {
  const ref = K.resolveReference(WOLFL);
  assert.equal(K.brewerMatchesReference("Orea Fast", ref), true);
  assert.equal(K.brewerMatchesReference("Orea V4 Fast", ref), true);
  assert.equal(K.brewerMatchesReference("Orea Classic", ref), false);
  assert.equal(K.brewerMatchesReference("Orea V4 Open", ref), false);
  assert.equal(K.brewerMatchesReference("V60", ref), false);
  assert.equal(K.brewerMatchesReference(undefined, ref), true);
  assert.equal(K.brewerMatchesReference("Orea Fast + Drip Assist", ref), true, "the disc is an accessory");
});

test("Adelina on the CLASSIC bottom: the clock gets a real drawdown, not 4 s", () => {
  const [c] = K.calibrateDrawdownClock([cand("Orea Classic")], [], isPercolation, ROAST, NOW);
  const end = K.pourScheduleFor(ADELINA, ROAST, NOW, "Orea Classic").pourPhaseEndSec;
  const est = K.drawdownFor([], "Orea Classic", 350);
  assert.equal(est.source, "corpus");
  assert.equal(c.recipe.targetTimeSec, end + est.sec);
  assert.ok(c.recipe.targetTimeSec - end >= 20, `drawdown ${c.recipe.targetTimeSec - end}s`);
});

test("on the FAST bottom it was written for, the verified recipe keeps its own clock", () => {
  const [c] = K.calibrateDrawdownClock([cand("Orea Fast")], [], isPercolation, ROAST, NOW);
  assert.equal(c.recipe.targetTimeSec, 180);
});

test("fidelity no longer snaps a Classic clock back to the Fast recipe's time", () => {
  const model = { ...ADELINA, targetTimeSec: 215 };
  const r = K.reconcileToReference(model, WOLFL, "Orea Classic");
  assert.equal(r.recipe.targetTimeSec, 215);
  assert.ok(!(r.reasons ?? []).some((x) => /total time/.test(x)));
});

test("…but on the Fast bottom a drifted clock is still caught (within the ±20 % batch window)", () => {
  // Wölfl publishes 270 g; 350 g is 1.3× and since 2026-10-10 outside the window
  // a reference applies in (src/lib/recipe/batchWindow.ts), so the same recipe
  // at 300 g (1.11×) is the case the clock check still runs on.
  const k = 300 / 350;
  const model = {
    ...ADELINA,
    waterGrams: 300,
    targetTimeSec: 215,
    pourSteps: ADELINA.pourSteps.map((s) =>
      typeof s.waterGramsAtEnd === "number" ? { ...s, waterGramsAtEnd: Math.round(s.waterGramsAtEnd * k) } : s,
    ),
  };
  const r = K.reconcileToReference(model, WOLFL, "Orea Fast");
  assert.ok((r.reasons ?? []).some((x) => /total time/.test(x)), JSON.stringify(r.reasons));
  const outside = K.reconcileToReference({ ...ADELINA, targetTimeSec: 215 }, WOLFL, "Orea Fast");
  assert.equal(outside.changed, false, "at 350 g the 270 g recipe does not apply — nothing to snap to");
});

test("wiring: recommend.ts gates the exemption on the brewer match", async () => {
  const src = await readFile(path.join(ROOT, "src/lib/claude/recommend.ts"), "utf8");
  assert.match(src, /ref\?\.verified && brewerMatchesReference\(c\.method, ref\)/);
});
