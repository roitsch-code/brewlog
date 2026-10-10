// "What held it back most? → The recipe" must reach the surfaces that write
// the next recipe (2026-10-10).
//
//   node --test tests/dataflow/recipe-blame-reaches-prompts.test.mjs
//
// Before this, the attribution answer (brew / bean / roaster) reached only
// buildHistorySummary — whose sole consumer is the loading-screen insight pool.
// Neither the coach nor /recommend ever saw it. This pins the consumers:
//   1. buildMeasuredFeedback (→ /recommend's MEASURED BREW FEEDBACK block)
//      names the blamed recipe and says not to re-serve it.
//   2. the coach's per-session line carries held=recipe.
//   3. the sessions POST schema accepts "recipe" (zod strips unknown values).

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const outDir = join(ROOT, "node_modules/.cache/recipe-blame");
const out = join(outDir, "b.mjs");
await build({
  stdin: {
    contents: `
export { buildMeasuredFeedback } from ${JSON.stringify(path.join(ROOT, "src/lib/claude/historyUtils.ts"))};
export { serialiseSessionForCoach } from ${JSON.stringify(path.join(ROOT, "src/lib/claude/insights.ts"))};
`,
    resolveDir: ROOT,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  external: ["pg", "pg-native", "drizzle-orm", "drizzle-orm/*", "@anthropic-ai/sdk"],
  logLevel: "silent",
});
const { buildMeasuredFeedback, serialiseSessionForCoach } = await import(pathToFileURL(out).href);

const blamed = {
  id: "s1",
  createdAt: "2026-10-10T07:14:00Z",
  coffee: { name: "Beshasha", roaster: "DAK", process: "Washed" },
  brew: { methodUsed: "Clever Dripper", selectedCandidateIdx: 0 },
  recommendation: {
    primaryMethod: "Clever Dripper",
    candidates: [{ method: "Clever Dripper", title: "Water-First Clever", basedOn: "Hoffmann Ultimate Clever", recipe: {} }],
  },
  result: { rating: 3, attribution: "recipe" },
};

test("/recommend's feedback block names the blamed recipe", () => {
  const block = buildMeasuredFeedback([blamed], { name: "Beshasha", roaster: "DAK" });
  assert.match(block, /blamed THE RECIPE/);
  assert.match(block, /Hoffmann Ultimate Clever/);
  assert.match(block, /do not re-serve it/);
});

test("the coach line carries held=recipe", () => {
  assert.match(serialiseSessionForCoach(blamed), /held=recipe/);
});

test("the sessions schema accepts the recipe verdict and the form offers it", async () => {
  const route = await readFile(join(ROOT, "src/app/api/sessions/route.ts"), "utf8");
  assert.match(route, /attribution: z\.enum\(\[[^\]]*"recipe"/);
  const log = await readFile(join(ROOT, "src/components/flow/LightStepLog.tsx"), "utf8");
  assert.match(log, /id: "recipe", label: "The recipe"/);
});
