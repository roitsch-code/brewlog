// Method-rotation tests — the deterministic fix for "always V60 and Clever".
// Bundles the REAL methodRotation.ts + helpers.ts (+ the real recipe corpus)
// with esbuild and asserts:
//   1. brewer families that dominated recent recommendation sets are banned
//      (note + excludeBrewers + bannedFamilies)
//   2. the safety rails: locked method / cold brew / thin history → inactive,
//      the eligible-pool floor is never violated, capacity-forbidden families
//      never consume a ban slot
//   3. selectRecipes honours excludeBrewers (banned brewers get no menu slot)
//   4. demoteRecentWithinTies now matches short basedOn strings by containment
//      (the exact-match no-op bug)
//   5. stripRotationViolations drops banned-method candidates but never
//      empties the list
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
export { buildMethodRotation, stripRotationViolations, familyFromMethod } from ${JSON.stringify(
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
  buildMethodRotation,
  stripRotationViolations,
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

test("V60 + Clever in every recent session → both banned, note names them", () => {
  const r = buildMethodRotation(V60_CLEVER_HISTORY, { targetWaterMl: 350 });
  assert.ok(r.bannedFamilies.has("v60"), "v60 banned");
  assert.ok(r.bannedFamilies.has("clever"), "clever banned");
  assert.ok(r.excludeBrewers.has("v60"));
  assert.ok(r.excludeBrewers.has("clever"));
  assert.match(r.note, /FORBIDDEN/);
  assert.match(r.note, /V60 \(in 6 of your last 6/);
  assert.match(r.note, /Clever Dripper \(in 6 of your last 6/);
  // The allowed list must offer the remaining eligible kit.
  assert.match(r.note, /Orea/);
  assert.match(r.note, /Origami/);
  assert.match(r.note, /Kalita/);
  // Immersion escape hatch present (no immersion brewer may survive the ban).
  assert.match(r.note, /PERCOLATION candidates/);
});

test("locked method disables rotation entirely", () => {
  const r = buildMethodRotation(V60_CLEVER_HISTORY, {
    lockedMethod: "V60",
    targetWaterMl: 350,
  });
  assert.equal(r.note, "");
  assert.equal(r.excludeBrewers.size, 0);
  assert.equal(r.bannedFamilies.size, 0);
});

test("cold brew disables rotation entirely", () => {
  const r = buildMethodRotation(V60_CLEVER_HISTORY, {
    occasion: "cold-brew",
    targetWaterMl: 900,
  });
  assert.equal(r.note, "");
});

test("fewer than 3 recent sessions → inactive", () => {
  const r = buildMethodRotation(V60_CLEVER_HISTORY.slice(0, 2), { targetWaterMl: 350 });
  assert.equal(r.note, "");
});

test("a family below the overuse threshold is not banned", () => {
  const history = [
    session(["V60", "Clever Dripper"]),
    session(["V60", "Kalita Wave"]),
    session(["V60", "Chemex"]),
    session(["Orea Fast", "Origami (cone)"]),
    session(["Kalita Wave", "Chemex"]),
    session(["Origami (wave)", "Orea Classic"]),
  ];
  const r = buildMethodRotation(history, { targetWaterMl: 350 });
  // V60 appeared 3× → banned; Clever only 1× → free.
  assert.ok(r.bannedFamilies.has("v60"));
  assert.ok(!r.bannedFamilies.has("clever"));
});

test("capacity-forbidden families never consume a ban slot", () => {
  // At 520ml Clever/Origami/AeroPress are already capacity-forbidden — even if
  // Clever dominated history, the ban list should target eligible families only.
  const r = buildMethodRotation(V60_CLEVER_HISTORY, { targetWaterMl: 520 });
  assert.ok(r.bannedFamilies.has("v60"), "v60 (eligible + overused) banned");
  assert.ok(!r.bannedFamilies.has("clever"), "clever already capacity-forbidden — no slot wasted");
  assert.doesNotMatch(r.note, /Clever/);
});

test("the eligible-pool floor is never violated", () => {
  // Every eligible family at 350ml overused → pool of 6, floor 3 → max 3 bans.
  const history = Array.from({ length: 6 }, () =>
    session(["V60", "Clever Dripper", "Kalita Wave", "Chemex", "Orea Fast", "Origami (cone)"]),
  );
  const r = buildMethodRotation(history, { targetWaterMl: 350 });
  assert.ok(r.bannedFamilies.size <= 3, `banned ${r.bannedFamilies.size} > 3`);
  assert.ok(r.bannedFamilies.size >= 1, "still bans the worst offenders");
});

test("summer-time uses the iced pool and keeps its floor", () => {
  const r = buildMethodRotation(V60_CLEVER_HISTORY, {
    occasion: "summer-time",
    targetWaterMl: 350,
  });
  // Iced pool = v60, kalita, aeropress, clever (4 → floor 2). V60 + Clever
  // both overused → max 2 bans, leaving kalita + aeropress.
  assert.ok(r.bannedFamilies.size <= 2);
  for (const fam of r.bannedFamilies) {
    assert.ok(["v60", "clever"].includes(fam));
  }
});

test("selectRecipes excludes rotation-banned brewers from the menu", () => {
  const brewersAvailable = brewersAvailableFromEquipment(CANONICAL_EQUIPMENT);
  const input = {
    brewersAvailable,
    roastLevel: "light",
    process: "washed",
    goal: "balanced",
    occasion: "morning-ritual",
    maxWaterMl: 330,
    serveVolumeMl: 330,
    rotationSeed: 1234567,
    excludeBrewers: new Set(["v60", "clever"]),
  };
  const sel = selectRecipes(input, 4);
  assert.ok(sel.length > 0, "menu still fills");
  for (const s of sel) {
    assert.notEqual(s.recipe.brewer, "v60", `menu leaked a v60 recipe: ${s.recipe.name}`);
    assert.notEqual(s.recipe.brewer, "clever", `menu leaked a clever recipe: ${s.recipe.name}`);
  }
});

test("excludeBrewers is ignored when a method is locked (user override)", () => {
  const brewersAvailable = brewersAvailableFromEquipment(CANONICAL_EQUIPMENT);
  const sel = selectRecipes(
    {
      brewersAvailable,
      goal: "balanced",
      lockedBrewers: new Set(["v60"]),
      excludeBrewers: new Set(["v60"]),
    },
    4,
  );
  assert.ok(sel.length > 0, "locked method still returns recipes");
  for (const s of sel) assert.equal(s.recipe.brewer, "v60");
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

test("stripRotationViolations drops banned methods but never empties the list", () => {
  const banned = new Set(["v60", "clever"]);
  const cands = [
    { method: "V60", title: "a" },
    { method: "Kalita Wave", title: "b" },
    { method: "Clever Dripper", title: "c" },
  ];
  const kept = stripRotationViolations(cands, banned);
  assert.deepEqual(kept.map((c) => c.title), ["b"]);
  // All candidates banned → pass through untouched (never break /recommend).
  const allBanned = [
    { method: "V60", title: "a" },
    { method: "Clever Dripper", title: "c" },
  ];
  assert.deepEqual(stripRotationViolations(allBanned, banned), allBanned);
  // No bans → untouched.
  assert.deepEqual(stripRotationViolations(cands, new Set()), cands);
});
