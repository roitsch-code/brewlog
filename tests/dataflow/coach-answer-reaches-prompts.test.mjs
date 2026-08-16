// The post-rating micro-dialogue has to reach the models that shape the next brew.
//
//   node --test tests/dataflow/coach-answer-reaches-prompts.test.mjs
//
// When a rating is ambiguous the app asks ONE targeted question and the user
// answers it mid-log. That answer is the most direct statement of what they
// actually tasted anywhere in the corpus — and it was written to the session
// and then read by nobody, while the route's own comment claimed otherwise.
// Spending the user's attention and discarding the reply is worse than not
// asking, so this pins that both consumers carry it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const dir = await mkdtemp(join(tmpdir(), "coachans-"));
const out = join(dir, "c.mjs");
await build({
  stdin: {
    // historyUtils only: the coach's own formatter lives in insights.ts, which
    // pulls in the DB client and can't be bundled here. That side is the same
    // one-line addition to the same kind of formatter, covered by tsc — this
    // suite deliberately claims nothing about it rather than faking a pass.
    contents: `export { buildHistorySummary } from ${JSON.stringify(path.join(ROOT, "src/lib/claude/historyUtils.ts"))};`,
    resolveDir: ROOT,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  outfile: out,
  platform: "neutral",
  logLevel: "silent",
});
const mod = await import(pathToFileURL(out).href);

const QUESTION = "Was it sour-sharp, or just weak?";
const ANSWER = "Just weak — no sourness at all";

function session(withAnswer) {
  return {
    id: "s1",
    createdAt: "2026-08-10T08:00:00.000Z",
    coffee: { roaster: "DAK", name: "Berry Swirl", origin: "Bolivia", process: "Natural" },
    brew: { methodUsed: "V60", actualTimeSec: 200 },
    context: { occasion: "morning-ritual" },
    result: {
      rating: 3,
      flavorNotes: ["Thin"],
      ...(withAnswer ? { coachAnswer: { question: QUESTION, answer: ANSWER } } : {}),
    },
    recommendation: {
      primaryMethod: "V60",
      primaryRecipe: {
        doseGrams: 15,
        waterGrams: 250,
        waterTempC: 93,
        grindSize: "390°",
        targetTimeSec: 210,
      },
    },
  };
}

test("the recipe history carries the clarification", () => {
  const withIt = mod.buildHistorySummary([session(true)]);
  const without = mod.buildHistorySummary([session(false)]);
  assert.ok(withIt.includes(ANSWER), "the answer never reached the recommend history");
  assert.ok(withIt.includes(QUESTION), "the question is needed to read the answer");
  // The answer resolves precisely the ambiguity the rest of the line leaves
  // open: "Thin" at 3 stars could be sour or weak, and they call for opposite
  // corrections.
  assert.ok(without.includes("Thin"), "sanity: the ambiguous note is there either way");
  assert.ok(!without.includes(ANSWER));
});
