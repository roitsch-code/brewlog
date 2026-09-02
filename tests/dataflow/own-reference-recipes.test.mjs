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
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const dir = await mkdtemp(join(tmpdir(), "ownref-"));
const out = join(dir, "o.mjs");
await build({
  stdin: {
    contents: `export { buildOwnReferences, formatOwnReferencesForPrompt, ownRefCategory, MIN_RATING, MAX_REFERENCES } from ${JSON.stringify(path.join(ROOT, "src/lib/claude/ownReferenceRecipes.ts"))};
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
  ownRefCategory,
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

// ── Immersion vs pour-over are separate categories, never mixed ─────────────
// The owner's Clever (immersion) was crowding out every recommendation because
// his Clever-heavy ≥4★ history filled all three own-reference slots with one
// approach, framed as "build on it". The fix varies WITHIN a category and never
// treats a pour-over as an interchangeable swap for an immersion brew.

test("brewers are tagged with the right category", () => {
  assert.equal(ownRefCategory("Clever Dripper"), "immersion");
  assert.equal(ownRefCategory("AeroPress"), "immersion");
  assert.equal(ownRefCategory("AeroPress (Prismo)"), "immersion");
  assert.equal(ownRefCategory("V60"), "pour-over");
  assert.equal(ownRefCategory("Orea V4 Classic"), "pour-over");
  assert.equal(ownRefCategory("Chemex"), "pour-over");
  assert.equal(ownRefCategory("Kalita Wave"), "pour-over");
});

test("near-identical approaches don't crowd out the slots (no 3× Clever)", () => {
  // Four well-rated Clever brews on four different bags + a V60 + an Orea. A
  // naive top-3-by-rating would return three Clevers. Within-category variety
  // must collapse the Clevers to one immersion slot and show the real pour-overs.
  const sessions = [
    brew({ rating: 5.0, method: "Clever Dripper", roaster: "A", name: "C1", origin: "X", process: "Washed" }),
    brew({ rating: 4.9, method: "Clever Dripper", roaster: "B", name: "C2", origin: "X", process: "Washed" }),
    brew({ rating: 4.8, method: "Clever Dripper", roaster: "C", name: "C3", origin: "X", process: "Washed" }),
    brew({ rating: 4.7, method: "Clever Dripper", roaster: "D", name: "C4", origin: "X", process: "Washed" }),
    brew({ rating: 4.6, method: "V60", roaster: "E", name: "P1", origin: "X", process: "Washed" }),
    brew({ rating: 4.5, method: "Orea Classic", roaster: "F", name: "P2", origin: "X", process: "Washed" }),
  ];
  const refs = buildOwnReferences(sessions, {
    roaster: "Z",
    name: "Unrelated",
    origin: "Y",
    process: "Natural",
  });
  assert.equal(refs.length, MAX_REFERENCES);
  assert.equal(
    refs.filter((r) => r.category === "immersion").length,
    1,
    "the four Clever brews collapse to one immersion slot, not three",
  );
  assert.ok(
    refs.some((r) => r.category === "pour-over"),
    "the user's real pour-over brews are shown, not squeezed out by Clever",
  );
});

test("a Clever-only owner still gets his varied Clever brews (backfill, nothing invented)", () => {
  const sessions = [
    brew({ rating: 5.0, method: "Clever Dripper", roaster: "A", name: "C1", origin: "X", process: "Washed" }),
    brew({ rating: 4.8, method: "Clever Dripper", roaster: "B", name: "C2", origin: "X", process: "Washed" }),
    brew({ rating: 4.6, method: "Clever Dripper", roaster: "C", name: "C3", origin: "X", process: "Washed" }),
  ];
  const refs = buildOwnReferences(sessions, { roaster: "Z", name: "Unrelated", origin: "Y", process: "Natural" });
  // No fabrication, no cross-category swap: distinct bags carry different
  // numbers, so it's varied immersion — and only the user's own brews appear.
  assert.equal(refs.length, MAX_REFERENCES);
  assert.ok(refs.every((r) => r.category === "immersion"));
  assert.equal(new Set(refs.map((r) => r.name)).size, MAX_REFERENCES);
});

test("a same-bag reference is never dropped, even when it's outranked", () => {
  const sessions = [
    // Unrelated coffee, higher rating, pour-over.
    brew({ rating: 5, method: "V60", roaster: "Other", name: "Other Bag", origin: "Kenya", process: "Washed" }),
    // The bag in hand, lower rating, immersion → relevance 3, must survive.
    brew({ rating: 4, method: "Clever Dripper" }),
  ];
  const refs = buildOwnReferences(sessions, TARGET);
  assert.ok(
    refs.some((r) => r.relevance === 3 && r.category === "immersion"),
    "the same-bag immersion brew must survive despite a higher-rated pour-over",
  );
});

test("a dominant brewer family gets a within-category vary nudge, never a cross-category one", () => {
  const refs = buildOwnReferences([brew({ rating: 4.5, method: "Clever Dripper" })], TARGET);
  const nudged = formatOwnReferencesForPrompt(refs, [], new Set(["clever"]));
  assert.match(nudged, /IMMERSION APPROACH A LOT LATELY/);
  assert.match(nudged, /Do NOT switch to a pour-over/);
  assert.ok(!/POUR-OVER A LOT LATELY/.test(nudged), "must not use the opposite-category wording");
  // Not dominant → no nudge, but the entry still appears (nothing excluded).
  const plain = formatOwnReferencesForPrompt(refs, [], new Set());
  assert.ok(!/A LOT LATELY/.test(plain));
  assert.ok(plain.includes(refs[0].name));
});

test("a dominant pour-over family gets the pour-over nudge, not the immersion one", () => {
  const refs = buildOwnReferences([brew({ rating: 4.5, method: "V60" })], TARGET);
  const nudged = formatOwnReferencesForPrompt(refs, [], new Set(["v60"]));
  assert.match(nudged, /POUR-OVER A LOT LATELY/);
  assert.match(nudged, /Do NOT switch to immersion/);
  assert.ok(!/IMMERSION APPROACH/.test(nudged));
});

test("recommend.ts wires the brewer-freshness set into the own-reference block", async () => {
  // Consumer wiring, not just the producer: this repo has twice shipped a
  // function documented as feeding a prompt while the route never called it.
  const src = await readFile(path.join(ROOT, "src/lib/claude/recommend.ts"), "utf8");
  assert.match(
    src,
    /formatOwnReferencesForPrompt\([\s\S]*?methodRecency\.recentBrewers[\s\S]*?brewMethodKey[\s\S]*?\)/,
    "the dominant-family set (methodRecency.recentBrewers via brewMethodKey) must reach formatOwnReferencesForPrompt",
  );
});
