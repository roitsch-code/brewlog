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

// ── Recipe fidelity (owner decision 2026-09-30) ───────────────────────────────
// The guard used to strip EVERY stir/swirl on these brewers — including the
// bloom stir the /recommend prompt itself asks for on Origami / Orea Apex, and
// the published agitation in 12 of the 36 corpus recipes on these brewers
// (Hoffmann Chemex, Hedrick Origami, three verified Moccamaster recipes …).
// That rewrote published recipes, which the owner's rule forbids. Now it only
// removes agitation the MODEL added: a step whose position (bloom / mid /
// after the final pour / after the drawdown) does not occur in the `basedOn`
// reference. With no resolvable reference, only bloom agitation stays.

const fidelityEntry = `export { stripMinimalAgitationSwirls } from ${JSON.stringify(
  path.join(ROOT, "src/lib/utils/agitationGuard.ts"),
)}; export { resolveReference } from ${JSON.stringify(path.join(ROOT, "src/lib/claude/recipeFidelity.ts"))};`;
const out2 = join(dir, "g2.mjs");
await build({
  stdin: { contents: fidelityEntry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out2,
  logLevel: "silent",
});
const F = await import(pathToFileURL(out2).href);
const withRef = (method, basedOn, pourSteps) => ({ ...candidate(method, pourSteps), basedOn });
const actionsOf = (c) => c.recipe.pourSteps.map((s) => s.action);

test("Hoffmann Chemex keeps its published bloom swirl AND its post-final swirl", () => {
  const steps = [
    { label: "Bloom", action: "bloom", waterGramsAtEnd: 90 },
    { label: "Swirl", action: "swirl" },
    { label: "Pour 1", action: "pour", waterGramsAtEnd: 300 },
    { label: "Pour 2", action: "final", waterGramsAtEnd: 500 },
    { label: "Swirl gently", action: "swirl" },
  ];
  const [c] = F.stripMinimalAgitationSwirls([withRef("Chemex", "Hoffmann Chemex", steps)], F.resolveReference);
  assert.deepEqual(actionsOf(c), ["bloom", "swirl", "pour", "final", "swirl"], "a published recipe must not be rewritten");
});

test("a reference with no post-final agitation (Medina 2023) still loses a model-added settle swirl", () => {
  const steps = [
    { label: "Bloom", action: "bloom", waterGramsAtEnd: 50 },
    { label: "Pour 2", action: "pour", waterGramsAtEnd: 150 },
    { label: "Pour 3", action: "final", waterGramsAtEnd: 248 },
    { label: "Settle swirl", action: "swirl" },
  ];
  const [c] = F.stripMinimalAgitationSwirls([withRef("Origami (cone)", "Medina 2023", steps)], F.resolveReference);
  assert.deepEqual(actionsOf(c), ["bloom", "pour", "final"]);
});

test("Own experiment on Origami keeps the bloom stir the prompt asks for, drops later agitation", () => {
  const steps = [
    { label: "Bloom", action: "bloom", waterGramsAtEnd: 50 },
    { label: "Bloom stir", action: "stir" },
    { label: "Pour 2", action: "pour", waterGramsAtEnd: 180 },
    { label: "Mid swirl", action: "swirl" },
    { label: "Final", action: "final", waterGramsAtEnd: 300 },
    { label: "Settle swirl", action: "swirl" },
  ];
  const [c] = F.stripMinimalAgitationSwirls([withRef("Origami (cone)", "Own experiment", steps)], F.resolveReference);
  assert.deepEqual(actionsOf(c), ["bloom", "stir", "pour", "final"]);
});

test("a serving swirl after the drawdown survives only when the reference has one (Crema Chemex)", () => {
  const steps = [
    { label: "Bloom", action: "bloom", waterGramsAtEnd: 50 },
    { label: "Main pour", action: "final", waterGramsAtEnd: 400 },
    { label: "Drawdown", action: "drain", durationSec: 45 },
    { label: "Swirl Chemex", action: "swirl" },
  ];
  const [kept] = F.stripMinimalAgitationSwirls([withRef("Chemex", "Crema Chemex", steps)], F.resolveReference);
  assert.ok(actionsOf(kept).includes("swirl"), "Crema's published final swirl must stay");
  const [dropped] = F.stripMinimalAgitationSwirls([withRef("Chemex", "Hoffmann Chemex", steps)], F.resolveReference);
  assert.ok(!actionsOf(dropped).includes("swirl"), "Hoffmann's Chemex has no after-drawdown swirl");
});

test("recommend.ts hands the guard the reference resolver (wiring)", async () => {
  const { readFile } = await import("node:fs/promises");
  const src = await readFile(path.join(ROOT, "src/lib/claude/recommend.ts"), "utf8");
  assert.match(src, /stripMinimalAgitationSwirls\(\s*mapped\s*,\s*resolveReference\s*\)/);
});
