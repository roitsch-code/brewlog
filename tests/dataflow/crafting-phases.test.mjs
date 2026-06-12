// Crafting-status phase tests. Bundles the REAL buildCraftingPhases() with
// esbuild so the asserted walk is the one the recipe screen actually shows.
//
//   node --test tests/dataflow/crafting-phases.test.mjs
//
// What's locked down: the loading walk narrates the coffee's OWN stored values
// when present (origin / process / variety / roast / mood / method), falls back
// to generic phrasing on empty / "Unknown" / "Other" so NO placeholder leaks
// and nothing is fabricated (the no-fabrication Hard Rule), and always ends on
// the four build steps holding at "Adapting it to your beans".

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const entry = `export { buildCraftingPhases } from ${JSON.stringify(
  path.join(ROOT, "src/lib/craftingPhases.ts"),
)};`;
const dir = await mkdtemp(join(tmpdir(), "craftphases-"));
const out = join(dir, "c.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { buildCraftingPhases } = await import(pathToFileURL(out).href);

const TAIL = [
  "Pulling the reference recipes",
  "Dialing grind and temperature",
  "Shaping the pour sequence",
  "Adapting it to your beans",
];

test("personalizes with the bag's real values", () => {
  const phases = buildCraftingPhases(
    { origin: "Ethiopia", region: "Yirgacheffe", variety: "Heirloom", process: "Washed", roastLevel: "Light" },
    { moodPreference: "balanced", timeAvailable: "normal", preferredMethod: "V60" },
  );
  assert.ok(phases.includes("Analyzing Yirgacheffe, Ethiopia"));
  assert.ok(phases.includes("Reading the Washed process"));
  assert.ok(phases.includes("Balancing the Heirloom variety"));
  assert.ok(phases.includes("Factoring the Light roast"));
  assert.ok(phases.includes("Processing your balanced mood"));
  assert.ok(phases.includes("Building it for your V60"));
});

test("always ends with the four build steps, holding on 'Adapting it to your beans'", () => {
  const phases = buildCraftingPhases();
  assert.deepEqual(phases.slice(-4), TAIL);
  assert.equal(phases.at(-1), "Adapting it to your beans");
});

test("falls back generically on empty / placeholder values (no fabrication)", () => {
  const phases = buildCraftingPhases(
    { origin: "", variety: "Unknown", process: "Other", roastLevel: "" },
    { moodPreference: "" },
  );
  assert.ok(phases.includes("Analyzing the bean's origin"));
  assert.ok(phases.includes("Reading the process")); // "Other" → generic, not "the Other process"
  assert.ok(phases.includes("Processing your mood"));
  assert.ok(!phases.some((p) => p.includes("Unknown")));
  assert.ok(!phases.some((p) => p.includes("Other")));
  assert.ok(!phases.some((p) => /variety/i.test(p))); // unknown variety → line skipped
  assert.ok(!phases.some((p) => /roast/i.test(p))); // empty roast → line skipped
});

test("freshness line derives from roastDate, and a future date shows nothing", () => {
  const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);
  const fresh = buildCraftingPhases({ origin: "Kenya", process: "Washed", roastLevel: "Light", roastDate: tenDaysAgo });
  assert.ok(fresh.some((p) => /rested bag/.test(p)));

  const future = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const phases = buildCraftingPhases({ origin: "Kenya", process: "Washed", roastLevel: "Light", roastDate: future });
  assert.ok(!phases.some((p) => /rested bag|fresh bag/.test(p)));
});
