// The user's own well-rated brews offered to /recommend as references.
//
//   node --test tests/dataflow/own-reference-recipes.test.mjs
//
// What must hold: only brews worth repeating get promoted, a brew without a
// reproducible pour plan is not a recipe, the same bag+brewer isn't listed
// three times, and the entry most relevant to the coffee in hand wins the
// scarce slots. Plus the names must stay quotable — `basedOn` has to echo them.

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const dir = await mkdtemp(join(tmpdir(), "ownref-"));
const out = join(dir, "o.mjs");
await build({
  stdin: {
    contents: `export { buildOwnReferences, formatOwnReferencesForPrompt, MIN_RATING, MAX_REFERENCES } from ${JSON.stringify(path.join(ROOT, "src/lib/claude/ownReferenceRecipes.ts"))};
export { resolveReference } from ${JSON.stringify(path.join(ROOT, "src/lib/claude/recipeFidelity.ts"))};`,
    resolveDir: ROOT,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  outfile: out,
  platform: "neutral",
  logLevel: "silent",
});
const {
  buildOwnReferences,
  formatOwnReferencesForPrompt,
  MIN_RATING,
  MAX_REFERENCES,
  resolveReference,
} = await import(pathToFileURL(out).href);

let seq = 0;
function brew({
  rating,
  method = "Orea V4 Classic",
  roaster = "DAK",
  name = "Berry Swirl",
  origin = "Bolivia",
  process = "Natural",
  coffeeId,
  pourSteps = [
    { action: "bloom", label: "Bloom", waterGramsAtEnd: 55 },
    { action: "pour", label: "Pour 2", waterGramsAtEnd: 150 },
    { action: "final", label: "Pour 3", waterGramsAtEnd: 300 },
  ],
  dose = 20,
  water = 300,
}) {
  seq += 1;
  return {
    id: `s${seq}`,
    createdAt: new Date(1735689600000 + seq * 86400000).toISOString(),
    coffee: { roaster, name, origin, process, ...(coffeeId ? { coffeeId } : {}) },
    brew: { methodUsed: method, actualTimeSec: 245 },
    result: { rating, flavorNotes: [] },
    recommendation: {
      primaryMethod: method,
      primaryRecipe: {
        doseGrams: dose,
        waterGrams: water,
        waterTempC: 94,
        grindSize: "390°",
        targetTimeSec: 240,
        pourSteps,
      },
    },
  };
}
const TARGET = { roaster: "DAK", name: "Berry Swirl", origin: "Bolivia", process: "Natural" };

test("only brews worth repeating are promoted", () => {
  const refs = buildOwnReferences(
    [
      brew({ rating: MIN_RATING - 1, name: "Meh Lot" }),
      brew({ rating: MIN_RATING, name: "Good Lot" }),
    ],
    TARGET,
  );
  assert.equal(refs.length, 1);
  assert.match(refs[0].name, /Good Lot/);
});

test("a brew with no reproducible pour plan is a note, not a recipe", () => {
  const refs = buildOwnReferences([brew({ rating: 5, pourSteps: [] })], TARGET);
  assert.deepEqual(refs, []);
});

test("the same bag on the same brewer appears once, at its best rating", () => {
  const refs = buildOwnReferences(
    [brew({ rating: 4 }), brew({ rating: 5 }), brew({ rating: 4.5 })],
    TARGET,
  );
  assert.equal(refs.length, 1);
  assert.equal(refs[0].rating, 5);
});

test("the entry that says most about THIS coffee wins the scarce slots", () => {
  const refs = buildOwnReferences(
    [
      // Same brewer, unrelated coffee — weakest evidence, and rated highest so
      // a naive sort by rating would wrongly put it first.
      brew({ rating: 5, roaster: "Other", name: "Kenya Thing", origin: "Kenya", process: "Washed" }),
      // Same origin + process, different bag.
      brew({ rating: 4, roaster: "Other", name: "Bolivia Sibling", method: "V60" }),
      // The bag itself.
      brew({ rating: 4, method: "Chemex" }),
    ],
    TARGET,
  );
  assert.equal(refs[0].relevance, 3, "this bag should lead");
  assert.match(refs[0].name, /Berry Swirl/);
  assert.equal(refs[1].relevance, 2);
  assert.ok(refs.length <= MAX_REFERENCES);
});

test("a locked method hides brews on brewers this session can't use", () => {
  const sessions = [
    brew({ rating: 5, method: "Chemex" }),
    brew({ rating: 4, method: "Orea Classic" }),
  ];
  // "Orea V4 Classic" and "Orea Classic" are one brewer — the key handles the
  // label drift, so locking the Orea must keep the Orea brew and drop Chemex.
  const refs = buildOwnReferences(sessions, TARGET, new Set(["orea"]));
  assert.equal(refs.length, 1);
  assert.match(refs[0].method, /Orea/);
});

test("names are quotable and the block states what these are", () => {
  const refs = buildOwnReferences([brew({ rating: 4.5 })], TARGET);
  const block = formatOwnReferencesForPrompt(refs);
  // basedOn has to echo the name, so it must appear verbatim in the block.
  assert.ok(block.includes(refs[0].name));
  assert.match(refs[0].name, /^Your /);
  assert.match(block, /THIS BAG/);
  assert.match(block, /20g : 300g/);
  assert.match(block, /55 – 150 – 300/);
  assert.equal(formatOwnReferencesForPrompt([]), "");
});

// ── Baseline to build on, not a recipe to re-serve ─────────────────────────
// This block used to tell the model "repeating a result they already loved is
// usually the right answer" — with the user's exact numbers attached, on every
// brew, never rotating. In the same user message, RECENTLY RECOMMENDED asked
// for DIFFERENT references. Two contradictory instructions, and the concrete
// one with numbers wins: today's 4★ brew became tomorrow's guaranteed repeat.

test("the block frames a well-rated brew as a baseline, not a repeat", () => {
  const refs = buildOwnReferences([brew({ rating: 4.5 })], TARGET);
  const block = formatOwnReferencesForPrompt(refs);
  assert.match(block, /BASELINE TO BUILD ON/);
  assert.ok(
    !/repeating a result they already loved is usually the right answer/i.test(block),
    "the old repeat-by-default instruction must be gone",
  );
  // Repeating verbatim stays possible — it just needs a reason now.
  assert.match(block, /asked to repeat it/);
});

test("an own reference just recommended is marked as one to vary from", () => {
  const refs = buildOwnReferences([brew({ rating: 4.5 })], TARGET);
  const fresh = formatOwnReferencesForPrompt(refs, []);
  const stale = formatOwnReferencesForPrompt(refs, [refs[0].name]);
  assert.ok(!/ALREADY RECOMMENDED RECENTLY/.test(fresh));
  assert.match(stale, /ALREADY RECOMMENDED RECENTLY/);
  // The entry itself survives — nothing is ever excluded (owner's rule).
  assert.ok(stale.includes(refs[0].name));
});

test("the recently-recommended match tolerates the short form the model writes", () => {
  const refs = buildOwnReferences([brew({ rating: 4.5 })], TARGET);
  // The model echoes a shortened basedOn; an exact-only compare would miss it
  // and the marker would silently never appear.
  const shortForm = refs[0].name.slice(0, 20);
  const marked = formatOwnReferencesForPrompt(refs, [shortForm]);
  assert.match(marked, /ALREADY RECOMMENDED RECENTLY/);
});

test("an own-reference name never binds to a published recipe", () => {
  // The fidelity guard snaps a candidate's mechanics back to whatever
  // resolveReference() matches on basedOn. These entries have no published
  // source to snap to, so a match would silently rewrite the user's own
  // numbers into someone else's recipe. resolveReference matches by
  // containment, so a corpus rename could create a collision later — this
  // pins the behaviour rather than trusting today's names.
  const brewers = [
    "Orea V4 Classic",
    "V60",
    "Clever Dripper",
    "AeroPress",
    "Origami Air M",
    "Kalita Wave",
    "Chemex",
    "Moccamaster",
  ];
  for (const method of brewers) {
    const refs = buildOwnReferences([brew({ rating: 5, method })], TARGET);
    assert.equal(refs.length, 1, `expected a reference for ${method}`);
    assert.equal(
      resolveReference(refs[0].name),
      null,
      `"${refs[0].name}" bound to a published recipe — the fidelity guard would overwrite the user's own numbers`,
    );
  }
});
