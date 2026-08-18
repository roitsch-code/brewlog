// The Acaia pour curve (pourSteadiness = channeling signal, overshoot) was
// captured, stored, and read by NO prompt — only the coarse three-way
// derivedFlow reached the model. This pins formatMeasuredPour +
// buildHistorySummary carrying it. NOTE (corrected 2026-08-18): this covers
// the FUNCTION only — buildHistorySummary's production consumer is
// loading-insights/refresh, not /recommend. The /recommend route-level wiring
// is pinned separately by measured-feedback-in-recommend.test.mjs.
//
//   node --test tests/dataflow/measured-pour-in-prompts.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
async function load(rel, names) {
  const entry = `export { ${names.join(", ")} } from ${JSON.stringify(path.join(ROOT, rel))};`;
  const dir = await mkdtemp(join(tmpdir(), "mp-"));
  const out = join(dir, "b.mjs");
  await build({ stdin: { contents: entry, resolveDir: ROOT, loader: "ts" }, bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "silent" });
  return import(pathToFileURL(out).href);
}

const { buildHistorySummary } = await load("src/lib/claude/historyUtils.ts", ["buildHistorySummary"]);
const { formatMeasuredPour } = await load("src/lib/brew/flowAnalysis.ts", ["formatMeasuredPour"]);

function session(flowAnalysis) {
  return {
    id: "s1",
    createdAt: "2026-08-18T08:00:00Z",
    coffee: { name: "Quiquira", origin: "Colombia", process: "Washed" },
    brew: { methodUsed: "V60", flow: "perfect", ...(flowAnalysis ? { flowAnalysis } : {}) },
    result: { rating: 4, flavorNotes: ["jasmine"], body: "medium", acidity: "high" },
  };
}

test("formatMeasuredPour labels channeling and stays silent without a curve", () => {
  assert.equal(formatMeasuredPour(undefined), "");
  assert.equal(formatMeasuredPour(null), "");
  assert.match(formatMeasuredPour({ pourSteadiness: 0.42, overshootG: 22 }), /uneven — channeling risk/);
  assert.match(formatMeasuredPour({ pourSteadiness: 0.42, overshootG: 22 }), /ran 22g ahead/);
  assert.match(formatMeasuredPour({ pourSteadiness: 0.08, overshootG: 3 }), /even/);
  // Overshoot below the report threshold is not named; a mid-range CV is unlabelled.
  assert.doesNotMatch(formatMeasuredPour({ pourSteadiness: 0.25, overshootG: 3 }), /ahead|even|uneven/);
});

test("buildHistorySummary carries the measured pour into the /recommend prompt", () => {
  const withCurve = buildHistorySummary([session({ pourSteadiness: 0.42, overshootG: 22 })]);
  assert.match(withCurve, /measured pour: steadiness CV 0\.42 \(uneven — channeling risk\), ran 22g ahead/);

  const noCurve = buildHistorySummary([session(undefined)]);
  assert.doesNotMatch(noCurve, /measured pour/);
});
