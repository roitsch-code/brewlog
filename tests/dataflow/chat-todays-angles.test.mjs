// The home chat's per-turn recipe context has to actually move.
//
//   node --test tests/dataflow/chat-todays-angles.test.mjs
//
// WHY: the chat receives the ENTIRE recipe corpus — 135 recipes, full pour
// sequences, ~39k tokens — cached and byte-identical on every turn of every
// conversation. No scoring, no rotation, no per-brewer cap: /recommend's whole
// selection machinery is wired to /recommend only. Handed an undifferentiated
// wall, a model reaches for the most salient entries, and those don't change
// between Tuesday and Friday. That is the chat half of the repetition report.
//
// buildTodaysAngles adds the piece that moves. These tests pin the two things
// that make it safe as well as useful: it ROTATES (or it is pointless), and
// every recipe it names is a REAL corpus recipe (or it is a fabrication
// surface).

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
export { buildTodaysAngles, daySeedFor } from ${JSON.stringify(path.join(ROOT, "src/lib/chat/todaysAngles.ts"))};
export { ALL_RECIPES } from ${JSON.stringify(path.join(ROOT, "src/lib/knowledge/recipes/index.ts"))};
`;
const dir = await mkdtemp(join(tmpdir(), "angles-"));
const out = join(dir, "b.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { buildTodaysAngles, daySeedFor, ALL_RECIPES } = await import(pathToFileURL(out).href);

const ROTATION = [
  {
    id: "friedhats__guji",
    roaster: "Friedhats",
    name: "Guji",
    origin: "Ethiopia",
    process: "Natural",
    variety: "Heirloom",
    firstSeenAt: "2026-08-01",
    sessionCount: 4,
    inRotation: true,
  },
  {
    id: "cloudpicker__kiriga",
    roaster: "Cloud Picker",
    name: "Kiriga",
    origin: "Kenya",
    process: "Washed",
    variety: "SL28",
    firstSeenAt: "2026-08-05",
    sessionCount: 2,
    inRotation: true,
  },
];

test("returns nothing when there is nothing on the counter", () => {
  assert.equal(buildTodaysAngles([], 20_000), "");
});

test("names each rotation bag with concrete angles", () => {
  const block = buildTodaysAngles(ROTATION, 20_000);
  assert.match(block, /Today's angles/);
  assert.match(block, /Friedhats — Guji/);
  assert.match(block, /Cloud Picker — Kiriga/);
});

test("the angles rotate from day to day", () => {
  // If this block were static it would just be a second wall — the whole point
  // is that what comes to mind first differs across days.
  const blocks = new Set();
  for (let d = 0; d < 14; d++) blocks.add(buildTodaysAngles(ROTATION, 20_000 + d));
  assert.ok(blocks.size >= 3, `only ${blocks.size} distinct angle blocks across 14 days`);
});

test("the same day gives the same angles", () => {
  // Stability within a day matters: the block must not contradict itself
  // between two turns of one conversation.
  assert.equal(buildTodaysAngles(ROTATION, 20_123), buildTodaysAngles(ROTATION, 20_123));
});

test("every recipe named is a real corpus recipe", () => {
  // The load-bearing safety property. This block changes which real recipes are
  // salient — it must never introduce a name the corpus doesn't have.
  const names = new Set(ALL_RECIPES.map((r) => r.name));
  for (let d = 0; d < 30; d++) {
    const block = buildTodaysAngles(ROTATION, 20_000 + d);
    for (const line of block.split("\n")) {
      if (!line.startsWith("- ")) continue;
      const after = line.slice(line.indexOf(":") + 1);
      for (const angle of after.split(" · ")) {
        // "<recipe name> [<brewer>] — <teaches>". Brackets, because recipe
        // names themselves contain parentheses.
        const recipeName = angle.split(" [")[0].trim();
        if (!recipeName) continue;
        assert.ok(
          names.has(recipeName),
          `"${recipeName}" is not a corpus recipe name (day ${d})`,
        );
      }
    }
  }
});

test("a bag's own whatToExplore note is carried through verbatim", () => {
  // The column is written weekly by /api/coffees/compact from that bag's own
  // brew history, and the chat never saw it until now.
  const withNote = [{ ...ROTATION[0], whatToExplore: "try a coarser grind and a longer bloom" }];
  const block = buildTodaysAngles(withNote, 20_000);
  assert.match(block, /try a coarser grind and a longer bloom/);
});

test("the block says it is a suggestion, not a shortlist", () => {
  // It must not read as a replacement for the full library, or it becomes the
  // new thing the model always reaches for — the failure being fixed.
  const block = buildTodaysAngles(ROTATION, 20_000);
  assert.match(block, /SUGGESTIONS, not a shortlist/);
  assert.match(block, /still available/);
});

test("daySeedFor advances once per day, not per request", () => {
  const t = Date.parse("2026-08-21T09:00:00Z");
  assert.equal(daySeedFor(t), daySeedFor(t + 3_600_000), "same day → same seed");
  assert.notEqual(daySeedFor(t), daySeedFor(t + 86_400_000), "next day → new seed");
});
