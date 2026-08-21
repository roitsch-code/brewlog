// The injected recipe menu has to actually change between brews.
//
//   node --test tests/dataflow/recipe-menu-variety.test.mjs
//
// Reported repeatedly — "die Rezepte sind zu wiederholend" — and addressed
// three times (PRs #480, #483, #486) without ever being measured end to end.
// It was still broken. Measuring the real selector across 20 consecutive brews
// gave ONE distinct menu, twice over, for two completely different coffees.
//
// Two causes, both pinned below.
//
// 1. Rotating ties could not possibly help. It reorders equal-scoring recipes,
//    but the diversity loop then takes each brewer's BEST recipe — which is the
//    same recipe whatever the order. The menu is a SET, and the set never moved.
//    The fix rotates WHICH recipe stands in for each brewer.
//
// 2. The seed is a millisecond timestamp used as `seed % groupSize`, and
//    86,400,000 is divisible by 2,3,4,5,6,8,9,10 — so brews a day apart landed
//    on the same offset. Hashing the seed decorrelates it from the calendar.
//
// The contract these tests defend: FIT still decides (a clear winner keeps
// winning, and the menu stays in best-fit order), freshness only varies what is
// genuinely interchangeable.

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const dir = await mkdtemp(join(tmpdir(), "menuvar-"));
const out = join(dir, "m.mjs");
await build({
  stdin: {
    contents: `export { selectRecipes, brewersAvailableFromEquipment, CANONICAL_EQUIPMENT, normaliseGoal, normaliseRoastLevel, normaliseProcess } from ${JSON.stringify(path.join(ROOT, "src/lib/knowledge/recipes/index.ts"))};`,
    resolveDir: ROOT,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  outfile: out,
  platform: "neutral",
  logLevel: "silent",
});
const M = await import(pathToFileURL(out).href);
const BREWERS = M.brewersAvailableFromEquipment(M.CANONICAL_EQUIPMENT);

// Successive brews one day apart — deliberately the degenerate spacing that
// froze the old modulo, so a regression to a raw seed fails here.
const SEEDS = Array.from({ length: 20 }, (_, i) => 1786000000000 + i * 86400000);

const CONTEXTS = [
  {
    label: "washed SL28, balanced, morning, 300ml",
    ctx: {
      roastLevel: M.normaliseRoastLevel("Light"),
      process: M.normaliseProcess("Washed"),
      variety: "SL28",
      goal: M.normaliseGoal("balanced"),
      occasion: "morning-ritual",
      maxWaterMl: 300,
      serveVolumeMl: 300,
    },
  },
  {
    label: "natural heirloom, clarity, deep focus, 250ml",
    ctx: {
      roastLevel: M.normaliseRoastLevel("Light"),
      process: M.normaliseProcess("Natural"),
      variety: "Heirloom",
      goal: M.normaliseGoal("clarity"),
      occasion: "deep-focus",
      maxWaterMl: 250,
      serveVolumeMl: 250,
    },
  },
];

const menuOf = (sel) => sel.map((s) => s.recipe.id).join("|");
const select = (ctx, rotationSeed) =>
  M.selectRecipes({ brewersAvailable: BREWERS, rotationSeed, ...ctx }, 4);

for (const { label, ctx } of CONTEXTS) {
  test(`the menu varies across 20 brews — ${label}`, () => {
    const menus = new Set(SEEDS.map((s) => menuOf(select(ctx, s))));
    // Before the fix this was exactly 1. Ten is far below what was measured
    // (15–19) but far above a frozen selector, so it catches a regression
    // without pinning the exact corpus contents.
    assert.ok(
      menus.size >= 10,
      `only ${menus.size} distinct menus across 20 brews — the rotation is frozen again`,
    );
  });

  test(`the menu stays in best-fit order — ${label}`, () => {
    for (const seed of SEEDS) {
      const scores = select(ctx, seed).map((s) => s.score);
      for (let i = 1; i < scores.length; i++) {
        assert.ok(
          scores[i] <= scores[i - 1],
          `menu out of score order (${scores.join(",")}) at seed ${seed}`,
        );
      }
    }
  });

  test(`no brewer appears twice — ${label}`, () => {
    for (const seed of SEEDS) {
      const brewers = select(ctx, seed).map((s) => s.recipe.brewer);
      assert.equal(new Set(brewers).size, brewers.length, "duplicate brewer in the portfolio");
    }
  });
}

test("a clear winner keeps winning — fit decides, freshness only breaks ties", () => {
  // This context has a standout at score 9 with the runners-up at 7 and below.
  // If variety ever started outranking fit, this is what would break.
  const ctx = CONTEXTS[1].ctx;
  const leaders = new Set(SEEDS.map((s) => select(ctx, s)[0].recipe.id));
  assert.equal(
    leaders.size,
    1,
    `the top pick moved (${[...leaders].join(", ")}) — variety must never outrank a clearly better fit`,
  );
});

test("selection stays deterministic for a given seed", () => {
  // Same brew, same menu: the variety is per-brew, not per-call. Two calls
  // inside one request must not disagree.
  for (const { ctx } of CONTEXTS) {
    assert.equal(menuOf(select(ctx, SEEDS[3])), menuOf(select(ctx, SEEDS[3])));
  }
});

test("seed 0 (no history yet) still returns a sensible menu", () => {
  for (const { ctx } of CONTEXTS) {
    const sel = select(ctx, 0);
    assert.ok(sel.length > 0, "a first-ever brew must still get recipes");
    const scores = sel.map((s) => s.score);
    for (let i = 1; i < scores.length; i++) assert.ok(scores[i] <= scores[i - 1]);
  }
});

// ── The shape production actually runs ─────────────────────────────────────
// Everything above calls selectRecipes with ONLY {brewersAvailable, seed, ctx}.
// Production always passes two more inputs, and both are derived from what the
// previous brews produced: `recentReferenceNames` (demote what was just seen)
// and `demoteBrewers` (from buildMethodRecency). So the real selector runs in a
// FEEDBACK LOOP, and the tests measured a shape it never runs in — which is how
// a demotion lever that systematically exiled the deepest recipe pools stayed
// invisible. These run the loop: each iteration's picks become the next
// iteration's history.

const feedbackLoop = (ctx, seeds, buildRecency) => {
  const history = []; // newest first, like pastSessions
  const menus = new Set();
  const leaders = new Set();
  const seconds = new Set();
  for (const seed of seeds) {
    const recentReferenceNames = history
      .slice(0, 6)
      .flatMap((h) => h.names)
      .filter((v, i, a) => a.indexOf(v) === i);
    const demoteBrewers = buildRecency ? buildRecency(history, seed) : undefined;
    const sel = M.selectRecipes(
      { brewersAvailable: BREWERS, rotationSeed: seed, recentReferenceNames, demoteBrewers, ...ctx },
      4,
    );
    menus.add(menuOf(sel));
    if (sel[0]) leaders.add(sel[0].recipe.id);
    if (sel[1]) seconds.add(sel[1].recipe.id);
    // The user brews the first two candidates — what production feeds back.
    history.unshift({
      names: sel.slice(0, 2).map((s) => s.recipe.name),
      brewers: sel.slice(0, 2).map((s) => s.recipe.brewer),
    });
  }
  return { menus, leaders, seconds };
};

// Stands in for buildMethodRecency: the dominant brewer family across the recent
// window, capped at one and rotated by the seed (the production contract, pinned
// in method-rotation.test.mjs).
const recencyFromHistory = (history, seed) => {
  const window = history.slice(0, 6);
  if (window.length < 3) return undefined;
  const presence = new Map();
  for (const h of window) {
    for (const b of new Set(h.brewers)) presence.set(b, (presence.get(b) ?? 0) + 1);
  }
  const dominant = [...presence.entries()]
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
  if (!dominant.length) return undefined;
  // Same one-family cap + seed rotation as buildMethodRecency.
  const pick = dominant[Math.abs(seed >>> 3) % dominant.length][0];
  return new Set([pick]);
};

for (const { label, ctx } of CONTEXTS) {
  test(`the menu still varies with the production feedback loop — ${label}`, () => {
    const { menus } = feedbackLoop(ctx, SEEDS, recencyFromHistory);
    assert.ok(
      menus.size >= 10,
      `only ${menus.size} distinct menus across 20 fed-back brews — the loop has frozen the rotation`,
    );
  });

  test(`the second slot varies across fed-back brews — ${label}`, () => {
    // Slot 2 is where variety has to live, and this is the number that matches
    // the complaint. Slot 1 may legitimately be identical every time: on the
    // natural-heirloom context one recipe scores 9 against 7s, and the owner's
    // rule is that best fit always decides — demoting a clearly better recipe
    // to manufacture variety is exactly what must NOT happen (pinned by "a
    // clear winner keeps winning" above). So the portfolio's second candidate —
    // the exploration slot from the third brew of a bag onward — carries it.
    const { seconds } = feedbackLoop(ctx, SEEDS, recencyFromHistory);
    assert.ok(
      seconds.size >= 2,
      `the second candidate never changed across 20 fed-back brews (${[...seconds].join(", ")})`,
    );
  });
}
