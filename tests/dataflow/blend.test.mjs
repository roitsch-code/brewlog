// Blend helpers + recipe process-union tests — bundles the REAL
// src/lib/coffee/blend.ts and src/lib/knowledge/recipes/helpers.ts so the test
// tracks the actual logic. Covers migration 0021: a coffee with 2+ components
// is a blend, its scalar origin/process are a comma-joined summary, and a
// recipe scores the process match against ANY component's process.
//
//   node --test tests/dataflow/blend.test.mjs

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
export { isBlend, componentsOf, deriveIdentitySummary, describeBlend } from ${JSON.stringify(
  path.join(ROOT, "src/lib/coffee/blend.ts"),
)};
export { selectRecipes, normaliseProcess } from ${JSON.stringify(
  path.join(ROOT, "src/lib/knowledge/recipes/index.ts"),
)};
`;
const dir = await mkdtemp(join(tmpdir(), "blend-"));
const out = join(dir, "b.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { isBlend, componentsOf, deriveIdentitySummary, describeBlend, selectRecipes, normaliseProcess } =
  await import(pathToFileURL(out).href);

const BRAZIL = { origin: "Brazil", process: "Natural" };
const ETHIOPIA = { origin: "Ethiopia", process: "Washed", variety: "Heirloom" };

test("a single-origin bag is not a blend", () => {
  assert.equal(isBlend({ origin: "Kenya", process: "Washed" }), false);
  assert.equal(isBlend({ origin: "Kenya", process: "Washed", components: [] }), false);
  // One component still counts as single-origin.
  assert.equal(isBlend({ origin: "Kenya", process: "Washed", components: [BRAZIL] }), false);
});

test("2+ components is a blend", () => {
  assert.equal(isBlend({ components: [BRAZIL, ETHIOPIA] }), true);
});

test("componentsOf synthesises a single component from scalars for a non-blend", () => {
  const comps = componentsOf({ origin: "Kenya", region: "Nyeri", process: "Washed" });
  assert.equal(comps.length, 1);
  assert.equal(comps[0].origin, "Kenya");
  assert.equal(comps[0].region, "Nyeri");
});

test("componentsOf returns the real components for a blend", () => {
  const comps = componentsOf({ components: [BRAZIL, ETHIOPIA] });
  assert.equal(comps.length, 2);
  assert.equal(comps[1].variety, "Heirloom");
});

test("deriveIdentitySummary joins distinct origins + processes", () => {
  const s = deriveIdentitySummary([BRAZIL, ETHIOPIA]);
  assert.equal(s.origin, "Brazil, Ethiopia");
  assert.equal(s.process, "Natural, Washed");
  assert.equal(s.variety, "Heirloom");
});

test("deriveIdentitySummary dedupes a shared process", () => {
  const s = deriveIdentitySummary([
    { origin: "Brazil", process: "Natural" },
    { origin: "Ethiopia", process: "Natural" },
  ]);
  assert.equal(s.origin, "Brazil, Ethiopia");
  assert.equal(s.process, "Natural"); // not "Natural, Natural"
});

test("describeBlend renders a human line with ratios + processes", () => {
  const line = describeBlend({
    components: [
      { origin: "Brazil", process: "Natural", ratio: 60 },
      { origin: "Ethiopia", process: "Washed", ratio: 40 },
    ],
  });
  assert.equal(line, "60% Brazil (Natural) + 40% Ethiopia (Washed)");
  // non-blend → empty
  assert.equal(describeBlend({ origin: "Kenya", process: "Washed" }), "");
});

test("normaliseProcess collapses a blend summary to ONE process (the bug the union fixes)", () => {
  // "Natural, Washed" keyword-matches natural first → washed is lost. This is
  // exactly why selectRecipes takes a `processes` array, verified below.
  assert.equal(normaliseProcess("Natural, Washed"), "natural");
});

test("selectRecipes scores the process union so a washed-suited recipe surfaces for a Natural+Washed blend", () => {
  const brewers = new Set(["v60"]);
  const base = {
    brewersAvailable: brewers,
    roastLevel: "light",
    goal: "balanced",
  };
  // Single process collapsed to "natural" (the summary) — a washed component
  // gets no credit.
  const collapsed = selectRecipes({ ...base, process: "natural" }, 6);
  // Same brew, but passing BOTH component processes.
  const union = selectRecipes(
    { ...base, process: "natural", processes: ["natural", "washed"] },
    6,
  );
  // The union must never surface FEWER recipes than the collapsed single —
  // crediting an extra process can only add matches, never remove them.
  assert.ok(union.length >= collapsed.length);
  // And at least one returned recipe should list "washed" among its processes,
  // proving the washed half now scores.
  const anyWashed = union.some(
    (r) => r.recipe?.bestFor?.processes?.includes("washed"),
  );
  assert.ok(anyWashed, "expected a washed-suited recipe in the union selection");
});
