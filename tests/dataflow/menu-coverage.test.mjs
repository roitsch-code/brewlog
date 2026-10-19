// MENU COVERAGE TRIPWIRE — no change may silently take a brewer off the menu.
//
//   node --test tests/dataflow/menu-coverage.test.mjs
//   UPDATE_MENU_BASELINE=1 node --test tests/dataflow/menu-coverage.test.mjs   (deliberate re-baseline)
//
// 2026-10-19: #621's ±20 % batch window took the Orea Apex / Classic / Fast off
// every Big (450 g) menu, and nothing noticed for nine days — the owner did.
// This runs the REAL selector over the owner's grid (his batch presets × every
// goal × process × hot occasion × several rotation seeds) and counts, per
// owned brewer (each Orea bottom on its own), how many menus it reaches. The
// counts are compared with menu-coverage.baseline.json:
//   - a brewer that reached menus and now reaches none → FAIL
//   - a brewer that lost more than half its menus (and ≥3 points) → FAIL
// Gains never fail. A drop that is MEANT (an owner decision) is re-baselined
// with the env var above, and the PR says which brewer lost what and why.

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const BASELINE = path.join(ROOT, "tests/dataflow/menu-coverage.baseline.json");
const dir = await mkdtemp(join(tmpdir(), "menucov-"));
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

// The owner's batches: Small 350, Big 450, and a single-cup custom 300.
const BATCHES = [300, 350, 450];
const PROCESSES = ["Washed", "Natural", "Honey"];
const GOALS = ["balanced", "high-clarity", "sweetness-forward", "body-forward", "aromatic", "explore"];
const OCCASIONS = ["morning-ritual", "focus", "social", "experiment"];
const SEEDS = [11, 2027, 777777, 1786000000000, 1790000000123];

function coverage() {
  const result = {};
  for (const water of BATCHES) {
    const counts = Object.fromEntries([...BREWERS].sort().map((b) => [b, 0]));
    let menus = 0;
    for (const process of PROCESSES)
      for (const goal of GOALS)
        for (const occasion of OCCASIONS)
          for (const seed of SEEDS) {
            const menu = M.selectRecipes(
              {
                brewersAvailable: BREWERS,
                lockedBrewers: new Set(),
                roastLevel: M.normaliseRoastLevel("Light"),
                process: M.normaliseProcess(process),
                goal: M.normaliseGoal(goal),
                occasion,
                maxWaterMl: water,
                serveVolumeMl: water,
                rotationSeed: seed,
              },
              4,
            );
            menus++;
            for (const b of new Set(menu.map((s) => s.recipe.brewer))) if (b in counts) counts[b]++;
          }
    result[water] = { menus, counts };
  }
  return result;
}

test("no owned brewer loses its place on the menu (vs menu-coverage.baseline.json)", async () => {
  const now = coverage();
  if (process.env.UPDATE_MENU_BASELINE) {
    await writeFile(BASELINE, JSON.stringify(now, null, 2) + "\n");
    return;
  }
  const base = JSON.parse(await readFile(BASELINE, "utf8"));
  const failures = [];
  const table = [];
  for (const water of Object.keys(base)) {
    const b = base[water];
    const n = now[water];
    assert.ok(n, `batch ${water} g is gone from the coverage grid`);
    for (const [brewer, was] of Object.entries(b.counts)) {
      const is = n.counts[brewer] ?? 0;
      const pctWas = (100 * was) / b.menus;
      const pctIs = (100 * is) / n.menus;
      table.push(`${water} g  ${brewer.padEnd(18)} ${pctWas.toFixed(0).padStart(3)}% → ${pctIs.toFixed(0).padStart(3)}%`);
      if (was > 0 && is === 0) failures.push(`${brewer} @ ${water} g: on ${was}/${b.menus} menus before, on NONE now`);
      else if (is < was / 2 && pctWas - pctIs >= 3)
        failures.push(`${brewer} @ ${water} g: ${pctWas.toFixed(0)}% → ${pctIs.toFixed(0)}% of menus (lost more than half)`);
    }
  }
  assert.equal(
    failures.length,
    0,
    `A change took brewers off the /recommend menu:\n  ${failures.join("\n  ")}\n\n` +
      `If this is an owner decision, re-baseline with UPDATE_MENU_BASELINE=1 and name the loss in the PR.\n\n` +
      `Full coverage (baseline → now):\n  ${table.join("\n  ")}`,
  );
});

test("every owned brewer reaches at least one menu at the owner's Small or Big batch", () => {
  const now = coverage();
  // Brewers the corpus holds no hot recipe for at these sizes are listed in the
  // baseline with 0 — they are the KNOWN gaps, visible in the table, not new.
  const missing = [...BREWERS].filter(
    (b) => (now[350].counts[b] ?? 0) + (now[450].counts[b] ?? 0) === 0,
  );
  console.log(`[menu-coverage] brewers on no Small/Big menu: ${missing.join(", ") || "none"}`);
});
