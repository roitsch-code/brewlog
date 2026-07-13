// Deterministic backstop: minimal-agitation brewers (Origami/Chemex/Moccamaster,
// Orea Apex/Open) must never carry a model-added swirl/stir step — this is the
// code net under the prompt's soft "no trailing swirl such a recipe doesn't
// want" rule, which Mistral leaked on an Origami-wave (a settle swirl the
// flat-bottom brew never wanted, sequenced AFTER the drawdown).
//
//   node --test tests/dataflow/minimal-agitation-guard.test.mjs
//
// Bundles the REAL recommend.ts exports (SDK deps left external — never called).

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const entry = `export { stripMinimalAgitationSwirls, isMinimalAgitationMethod } from ${JSON.stringify(
  path.join(ROOT, "src/lib/utils/agitationGuard.ts"),
)};`;
const dir = await mkdtemp(join(tmpdir(), "agit-"));
const out = join(dir, "g.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { stripMinimalAgitationSwirls, isMinimalAgitationMethod } = await import(
  pathToFileURL(out).href
);

const candidate = (method, pourSteps) => ({
  method,
  title: `test-${method}`,
  recipe: {
    doseGrams: 23,
    waterGrams: 350,
    waterTempC: 92,
    grindSize: "medium",
    targetTimeSec: 180,
    pourSteps,
  },
});

// The exact reported shape: Origami-wave with a settle swirl AFTER the drawdown.
const origamiWave = () => [
  { label: "Bloom", action: "bloom", waterGramsAtEnd: 115 },
  { label: "Bloom Rest", action: "wait", durationSec: 90 },
  { label: "Final Pour", action: "final", waterGramsAtEnd: 350, durationSec: 30 },
  { label: "Drawdown", action: "wait", durationSec: 60 },
  { label: "Settle Swirl", action: "swirl" },
];

test("Origami drops the swirl; pour milestones survive untouched", () => {
  const [c] = stripMinimalAgitationSwirls([candidate("Origami (wave)", origamiWave())]);
  const actions = c.recipe.pourSteps.map((s) => s.action);
  assert.ok(!actions.includes("swirl"), "swirl must be gone");
  assert.deepEqual(
    c.recipe.pourSteps.filter((s) => s.waterGramsAtEnd != null).map((s) => s.waterGramsAtEnd),
    [115, 350],
    "water milestones must be preserved exactly",
  );
});

test("classifies the flat-bottom / low-turbulence brewers", () => {
  for (const m of ["Origami", "Origami (wave)", "Origami Air M", "Chemex", "Moccamaster", "Orea Apex", "Orea V4 Open"]) {
    assert.equal(isMinimalAgitationMethod(m), true, `${m} should be minimal-agitation`);
  }
});

test("turbulent brewers keep their agitation (V60, Orea Fast, Kalita)", () => {
  for (const m of ["V60", "Orea Fast", "Orea Classic", "Kalita Wave"]) {
    assert.equal(isMinimalAgitationMethod(m), false, `${m} should NOT be minimal-agitation`);
    const steps = [
      { label: "Bloom", action: "bloom", waterGramsAtEnd: 50 },
      { label: "Pour", action: "pour", waterGramsAtEnd: 200 },
      { label: "Settle Swirl", action: "swirl" },
    ];
    const [c] = stripMinimalAgitationSwirls([candidate(m, steps)]);
    assert.ok(
      c.recipe.pourSteps.some((s) => s.action === "swirl"),
      `${m} settle swirl must be kept`,
    );
  }
});

test("no-op when a minimal-agitation brewer already has no agitation", () => {
  const clean = [
    { label: "Bloom", action: "bloom", waterGramsAtEnd: 60 },
    { label: "Pour 2", action: "pour", waterGramsAtEnd: 200 },
    { label: "Final pour", action: "final", waterGramsAtEnd: 350 },
  ];
  const input = [candidate("Chemex", clean)];
  const [c] = stripMinimalAgitationSwirls(input);
  assert.deepEqual(c.recipe.pourSteps, clean);
});
