// The /recommend rotation seed must never switch rotation OFF.
//
//   node --test tests/dataflow/rotation-seed.test.mjs
//
// #541 mixed a per-request component into the seed with `latest ^ mixSeed(now)`.
// `^` returns a SIGNED 32-bit integer, so the seed came out negative in about
// half of all requests — and `rotateTies` / `pickRepresentative` both returned
// immediately for any seed <= 0. Measured 2026-09-30: 49.8% of seeds were <= 0,
// i.e. every other brew got the menu in plain array order, never rotated. The
// existing variety tests all passed positive seeds by hand, so none could see it.
//
// Pinned three ways: the derivation is always a positive integer; a negative
// seed (from any caller) still rotates; and the route actually uses the helper
// (a function-only test is how #530 / #535 shipped unwired).

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const dir = await mkdtemp(join(tmpdir(), "rotseed-"));
const out = join(dir, "m.mjs");
await build({
  stdin: {
    contents: `export { selectRecipes, deriveRotationSeed, brewersAvailableFromEquipment, CANONICAL_EQUIPMENT, normaliseGoal, normaliseRoastLevel, normaliseProcess } from ${JSON.stringify(path.join(ROOT, "src/lib/knowledge/recipes/index.ts"))};`,
    resolveDir: ROOT,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const M = await import(pathToFileURL(out).href);

const BREWERS = M.brewersAvailableFromEquipment([...M.CANONICAL_EQUIPMENT]);
const CTX = {
  brewersAvailable: BREWERS,
  lockedBrewers: new Set(),
  roastLevel: M.normaliseRoastLevel("Light"),
  process: M.normaliseProcess("Washed"),
  processes: [],
  variety: "Caturra",
  goal: M.normaliseGoal("balanced"),
  occasion: "morning-ritual",
  maxWaterMl: 350,
  serveVolumeMl: 350,
};
const menuKey = (seed) =>
  M.selectRecipes({ ...CTX, rotationSeed: seed }, 4)
    .map((s) => s.recipe.id)
    .join("|");

test("deriveRotationSeed is always a positive integer", () => {
  assert.equal(typeof M.deriveRotationSeed, "function", "deriveRotationSeed must be exported");
  const base = Date.parse("2026-06-01T07:30:00.000Z");
  let x = 12345;
  const rnd = () => ((x = (Math.imul(x, 1103515245) + 12345) >>> 0) / 2 ** 32);
  for (let i = 0; i < 5000; i++) {
    const latest = base + Math.floor(rnd() * 400 * 86_400_000);
    const now = latest + Math.floor(rnd() * 30 * 86_400_000);
    const s = M.deriveRotationSeed(latest, now);
    assert.ok(Number.isInteger(s) && s > 0, `seed must be > 0, got ${s} for latest=${latest} now=${now}`);
  }
  // No history yet (latest = 0) still rotates.
  assert.ok(M.deriveRotationSeed(0, Date.now()) > 0);
  assert.ok(M.deriveRotationSeed(0, 0) > 0);
});

test("a negative seed still rotates the menu (it is not treated as 'no seed')", () => {
  const unrotated = menuKey(0);
  let differs = 0;
  for (let s = 1; s <= 40; s++) if (menuKey(-s * 7919) !== unrotated) differs++;
  assert.ok(differs > 0, "every negative seed produced the unrotated menu — rotation is switched off for them");
});

test("recommend.ts derives its seed through deriveRotationSeed (wiring)", async () => {
  const src = await readFile(path.join(ROOT, "src/lib/claude/recommend.ts"), "utf8");
  assert.match(src, /deriveRotationSeed\(/, "recommend.ts must call deriveRotationSeed");
  assert.doesNotMatch(src, /\^\s*mixSeed\(Date\.now\(\)\)/, "the signed XOR expression must be gone");
});
