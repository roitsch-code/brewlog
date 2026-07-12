// Method fit-and-freshness tests — the fix for "always V60 and Clever
// water-first". NO bans (owner's design rule: best fit always decides).
// Bundles the REAL methodRotation.ts + helpers.ts (+ the real recipe corpus)
// with esbuild and asserts:
//   1. brewer families that dominated recent recommendation sets are named in
//      the prompt note (earn-your-slot + equal-fit-ties-go-to-freshest) and
//      returned as recentBrewers for the menu tie-break
//   2. the rails: locked method / cold brew / thin history → inactive
//   3. selectRecipes demotes dominant brewers WITHIN equal-score groups only —
//      never excludes them, and a genuinely higher-scoring recipe still leads
//   4. demoteRecentWithinTies matches short basedOn strings by containment
//      (the exact-match no-op bug)
//
//   node --test tests/dataflow/method-rotation.test.mjs

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
export { buildMethodRecency, familyFromMethod } from ${JSON.stringify(
  path.join(ROOT, "src/lib/claude/methodRotation.ts"),
)};
export { selectRecipes, brewersAvailableFromEquipment, CANONICAL_EQUIPMENT } from ${JSON.stringify(
  path.join(ROOT, "src/lib/knowledge/recipes/helpers.ts"),
)};
`;
const dir = await mkdtemp(join(tmpdir(), "methodrot-"));
const out = join(dir, "b.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const {
  buildMethodRecency,
  familyFromMethod,
  selectRecipes,
  brewersAvailableFromEquipment,
  CANONICAL_EQUIPMENT,
} = await import(pathToFileURL(out).href);

/** Build a fake session whose recommendation carried the given methods. */
function session(methods) {
  return {
    recommendation: { candidates: methods.map((m) => ({ method: m })) },
  };
}

/** Six sessions, every one showing V60 + Clever — the reported reality. */
const V60_CLEVER_HISTORY = Array.from({ length: 6 }, () =>
  session(["V60", "Clever Dripper"]),
);

test("familyFromMethod resolves the method vocabulary", () => {
  assert.equal(familyFromMethod("V60"), "v60");
  assert.equal(familyFromMethod("V60 + Drip Assist"), "v60");
  assert.equal(familyFromMethod("Clever Dripper"), "clever");
  assert.equal(familyFromMethod("Origami (cone)"), "origami");
  assert.equal(familyFromMethod("Orea Fast"), "orea");
  assert.equal(familyFromMethod("Kalita Wave 155"), "kalita");
  assert.equal(familyFromMethod("Moccamaster"), "moccamaster");
  assert.equal(familyFromMethod(undefined), null);
  assert.equal(familyFromMethod("Cold Brew Jar"), null);
});

test("V60 + Clever dominating recent sets → named in the note, no ban language", () => {
  const r = buildMethodRecency(V60_CLEVER_HISTORY, {});
  assert.match(r.note, /V60 \(in 6 of your last 6/);
  assert.match(r.note, /Clever Dripper \(in 6 of your last 6/);
  // The design rule: nothing is banned, best fit decides.
  assert.match(r.note, /nothing is banned/i);
  assert.doesNotMatch(r.note, /FORBIDDEN/);
  // Earn-your-slot + equal-fit tie-break direction present.
  assert.match(r.note, /EARN its slot/);
  assert.match(r.note, /LEAST recently recommended/);
  // Menu tie-break input carries the dominant families' brewers.
  assert.ok(r.recentBrewers.has("v60"));
  assert.ok(r.recentBrewers.has("clever"));
  assert.ok(!r.recentBrewers.has("kalita-wave"));
});

test("locked method disables the signal entirely", () => {
  const r = buildMethodRecency(V60_CLEVER_HISTORY, { lockedMethod: "V60" });
  assert.equal(r.note, "");
  assert.equal(r.recentBrewers.size, 0);
});

test("cold brew disables the signal entirely", () => {
  const r = buildMethodRecency(V60_CLEVER_HISTORY, { occasion: "cold-brew" });
  assert.equal(r.note, "");
});

test("fewer than 3 recent sessions → inactive", () => {
  const r = buildMethodRecency(V60_CLEVER_HISTORY.slice(0, 2), {});
  assert.equal(r.note, "");
});

test("a family below the dominance threshold is not flagged", () => {
  const history = [
    session(["V60", "Clever Dripper"]),
    session(["V60", "Kalita Wave"]),
    session(["V60", "Chemex"]),
    session(["Orea Fast", "Origami (cone)"]),
    session(["Kalita Wave", "Chemex"]),
    session(["Origami (wave)", "Orea Classic"]),
  ];
  const r = buildMethodRecency(history, {});
  // V60 appeared 3× → flagged; Clever only 1× → not mentioned.
  assert.match(r.note, /V60/);
  assert.doesNotMatch(r.note, /Clever/);
  assert.ok(r.recentBrewers.has("v60"));
  assert.ok(!r.recentBrewers.has("clever"));
});

test("selectRecipes DEMOTES dominant brewers within ties — never excludes them", () => {
  const brewersAvailable = brewersAvailableFromEquipment(CANONICAL_EQUIPMENT);
  const base = {
    brewersAvailable,
    roastLevel: "light",
    process: "washed",
    goal: "balanced",
    occasion: "morning-ritual",
    maxWaterMl: 330,
    serveVolumeMl: 330,
    rotationSeed: 1234567,
  };
  const before = selectRecipes(base, 4);
  const after = selectRecipes(
    { ...base, demoteBrewers: new Set(["v60", "clever"]) },
    4,
  );
  assert.ok(after.length > 0, "menu still fills");
  const beforeBrewers = before.map((s) => s.recipe.brewer);
  const afterBrewers = after.map((s) => s.recipe.brewer);
  assert.ok(
    beforeBrewers.includes("v60") || beforeBrewers.includes("clever"),
    "precondition: without demotion the menu carries v60/clever",
  );
  // Fresh equal-scored brewers take the LEADING slots (order is the signal
  // the prompt tells the model to read)…
  assert.ok(
    !["v60", "clever"].includes(afterBrewers[0]),
    `a fresh brewer should lead the menu, got: ${afterBrewers.join(", ")}`,
  );
  const idxOf = (b) => afterBrewers.indexOf(b);
  for (const dominated of ["v60", "clever"]) {
    if (idxOf(dominated) === -1) continue;
    for (let i = 0; i < idxOf(dominated); i++) {
      assert.ok(
        after[i].score >= after[idxOf(dominated)].score,
        "a demoted brewer may only trail equal-or-higher scores",
      );
    }
  }
  // …but nothing is excluded and scores never regress: the demotion is
  // tie-scoped, so the menu's score profile is identical (only reordered).
  assert.deepEqual(
    after.map((s) => s.score),
    before.map((s) => s.score),
    "tie-scoped demotion must not change the score profile",
  );
});

test("a genuinely higher-scoring recipe on a dominant brewer STILL leads (no ban)", () => {
  const brewersAvailable = brewersAvailableFromEquipment(CANONICAL_EQUIPMENT);
  // Method lock hard-filters to clever — demoteBrewers must not interfere
  // with a locked method (and even unlocked, demotion is tie-scoped only,
  // proven by the score-profile assertion above).
  const sel = selectRecipes(
    {
      brewersAvailable,
      goal: "balanced",
      lockedBrewers: new Set(["clever"]),
      demoteBrewers: new Set(["clever"]),
    },
    4,
  );
  assert.ok(sel.length > 0, "locked method still returns recipes");
  for (const s of sel) assert.equal(s.recipe.brewer, "clever");
});

test("demoteRecentWithinTies matches SHORT basedOn strings (containment fix)", () => {
  const brewersAvailable = brewersAvailableFromEquipment(CANONICAL_EQUIPMENT);
  const base = {
    brewersAvailable,
    roastLevel: "light",
    process: "washed",
    goal: "balanced",
    occasion: "morning-ritual",
    maxWaterMl: 330,
    serveVolumeMl: 330,
    rotationSeed: 7,
  };
  const before = selectRecipes(base, 4);
  const leader = before[0];
  // Demote via the SHORT name form the model actually writes (e.g. the
  // shortName, which differs from the full corpus name) — pre-fix this was a
  // silent no-op because only exact full-string matches counted.
  const after = selectRecipes(
    { ...base, recentReferenceNames: [leader.recipe.shortName] },
    4,
  );
  const stillLeads = after[0].recipe.id === leader.recipe.id;
  assert.ok(!stillLeads, `recently-seen "${leader.recipe.shortName}" still leads the menu`);
});
