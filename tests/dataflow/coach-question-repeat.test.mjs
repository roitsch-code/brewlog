// The coach must not ask the same thing twice.
//
//   node --test tests/dataflow/coach-question-repeat.test.mjs
//
// The report: "the app ALWAYS asks me the same thing — when did the brew
// improve, at the start, the middle, the end. Every time." Two faults produced
// that, and this covers the second one: even a genuine signal recurs across
// brews, so without memory the same question comes back every time it fires,
// and a coach turns into a form field. The prompt states the rule; this is the
// deterministic backstop, because a buried negative is exactly what a model
// leaks (same reason the Drip-Assist guard exists).

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const dir = await mkdtemp(join(tmpdir(), "coachq-"));
const out = join(dir, "q.mjs");
await build({
  stdin: {
    contents: `export { isRepeatQuestion } from ${JSON.stringify(path.join(ROOT, "src/lib/coach/questionRepeat.ts"))};`,
    resolveDir: ROOT,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  outfile: out,
  platform: "neutral",
  logLevel: "silent",
});
const { isRepeatQuestion: isRepeat } = await import(pathToFileURL(out).href);

const ASKED = [
  "When did the brew improve — at the start, the middle, or the end?",
  "Drawdown ran 45s long — how did the bed look at the end?",
];

test("the exact question is refused", () => {
  assert.equal(isRepeat(ASKED[0], ASKED), true);
});

test("punctuation and casing drift does not smuggle a repeat through", () => {
  assert.equal(
    isRepeat("when did the brew improve, at the start the middle or the end", ASKED),
    true,
  );
});

test("a genuinely new question is allowed", () => {
  assert.equal(
    isRepeat("Did the grind feel coarser than usual on this bag?", ASKED),
    false,
  );
});

test("nothing asked before means nothing to block", () => {
  assert.equal(isRepeat("Anything at all?", []), false);
  assert.equal(isRepeat("", ASKED), false);
});
