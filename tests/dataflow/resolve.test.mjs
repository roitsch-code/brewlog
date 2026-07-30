// Data-flow correctness for "the recipe the app SHOWS == the recipe the user
// actually brewed". This is the exact bug class that bit twice (PR #193, #198):
// reading primaryRecipe / method-matching instead of the selected candidate,
// so the brew screen / chat / detail page reported the wrong grind & temp.
//
// We bundle the REAL resolveRecipe.ts with esbuild (it's type-only-importing,
// so the bundle is tiny) and assert against it — not a re-declared copy.
//
//   node --test tests/dataflow/resolve.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const entry = `export { resolveBrewedRecipe, brewedRecipeName, basedOnReference } from ${JSON.stringify(
  path.join(ROOT, "src/lib/utils/resolveRecipe.ts")
)};`;
const dir = await mkdtemp(join(tmpdir(), "resolve-"));
const out = join(dir, "b.mjs");
await build({ stdin: { contents: entry, resolveDir: ROOT, loader: "ts" }, bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "silent" });
const { resolveBrewedRecipe, brewedRecipeName, basedOnReference } = await import(pathToFileURL(out).href);

// Two candidates that SHARE a method ("V60") but differ in grind/temp — the
// configuration that broke method-name matching.
function sessionFixture(brew) {
  return {
    id: "s1",
    type: "brew",
    mode: "home",
    recommendation: {
      primaryMethod: "V60",
      primaryRecipe: { grindNicheDegrees: 398, waterTempC: 92, _tag: "PRIMARY" },
      candidates: [
        { method: "V60", title: "Bright V60", basedOn: "Kasuya 4:6", recipe: { grindNicheDegrees: 398, waterTempC: 92, _tag: "CAND0" } },
        { method: "V60", title: "Sweet V60", basedOn: "Own recipe", recipe: { grindNicheDegrees: 405, waterTempC: 90, _tag: "CAND1" } },
      ],
    },
    brew,
  };
}

test("selectedCandidateIdx wins even when candidates share a method", () => {
  const r = resolveBrewedRecipe(sessionFixture({ selectedCandidateIdx: 1, methodUsed: "V60" }));
  assert.equal(r.recipe._tag, "CAND1", "must return the SELECTED candidate, not primary/candidate-0");
  assert.equal(r.recipe.grindNicheDegrees, 405);
  assert.equal(r.candidate.title, "Sweet V60");
});

test("falls back to method match when no index", () => {
  const s = sessionFixture({ methodUsed: "V60" });
  // method match returns the first V60 candidate
  const r = resolveBrewedRecipe(s);
  assert.equal(r.recipe._tag, "CAND0");
});

test("falls back to primaryRecipe when nothing resolves", () => {
  const r = resolveBrewedRecipe(sessionFixture({ methodUsed: "AeroPress" }));
  assert.equal(r.recipe._tag, "PRIMARY");
});

test("index 0 is honoured (not treated as falsy)", () => {
  const r = resolveBrewedRecipe(sessionFixture({ selectedCandidateIdx: 0 }));
  assert.equal(r.recipe._tag, "CAND0");
});

test("brewedRecipeName appends a real reference, drops the 'Own recipe' sentinel", () => {
  assert.equal(brewedRecipeName({ title: "Bright V60", basedOn: "Kasuya 4:6" }), "Bright V60 (based on Kasuya 4:6)");
  assert.equal(brewedRecipeName({ title: "Sweet V60", basedOn: "Own recipe" }), "Sweet V60");
  assert.equal(brewedRecipeName({ title: "Solo", basedOn: "Solo" }), "Solo"); // ref == title → dropped
});

test("basedOnReference sentinel handling", () => {
  assert.equal(basedOnReference("Own recipe"), undefined);
  assert.equal(basedOnReference("  "), undefined);
  assert.equal(basedOnReference("April 1-2-3", "Reduced agitation"), "April 1-2-3");
});

// ── Degenerate stored shapes (the coffee-detail crash, July 2026) ───────────
// `recommendation` is a jsonb column, so a stored row can carry `candidates`
// without the "backward compat" `primaryMethod`/`primaryRecipe` mirrors. The
// session card used to read `recommendation?.primaryRecipe.doseGrams` — the
// optional chain guarded the recommendation but NOT primaryRecipe, so such a
// row threw "Cannot read properties of undefined" and took the whole
// /coffees/[id] page to the error boundary. Every reader must degrade to
// undefined instead. (Types made primaryMethod/primaryRecipe optional so tsc
// catches a new unguarded deref.)

test("candidates-only recommendation resolves without throwing", () => {
  const r = resolveBrewedRecipe({
    id: "s2", type: "brew", mode: "home",
    recommendation: { candidates: [{ method: "V60", title: "T", recipe: { _tag: "CAND0", doseGrams: 15 } }] },
    brew: { methodUsed: "V60" },
  });
  assert.equal(r.recipe._tag, "CAND0");
  assert.equal(r.method, "V60");
});

test("candidates-only with no brew block still resolves (no primaryRecipe to fall back on)", () => {
  const r = resolveBrewedRecipe({
    id: "s3", type: "brew", mode: "home",
    recommendation: { candidates: [{ method: "Clever", recipe: { _tag: "C" } }] },
  });
  // No index and no methodUsed → nothing matches; must be undefined, not a throw.
  assert.equal(r.recipe, undefined);
  assert.equal(r.method, "Brew");
});

test("empty recommendation object degrades to undefined", () => {
  const r = resolveBrewedRecipe({ id: "s4", type: "brew", mode: "home", recommendation: {}, brew: { methodUsed: "V60" } });
  assert.equal(r.recipe, undefined);
  assert.equal(r.method, "V60");
});

test("missing recommendation entirely (café visit) degrades to undefined", () => {
  const r = resolveBrewedRecipe({ id: "s5", type: "brew", mode: "cafe" });
  assert.equal(r.recipe, undefined);
  assert.equal(r.method, "Brew");
});
