// The MEASURED BREW FEEDBACK block must actually reach /recommend.
//
//   node --test tests/dataflow/measured-feedback-in-recommend.test.mjs
//
// History: the post-rating clarification answer (coachAnswer) and the Acaia
// pour measurement (flowAnalysis) were both wired into buildHistorySummary in
// Aug 2026 and DOCUMENTED as reaching /recommend — but buildHistorySummary's
// only production consumer is loading-insights/refresh, so neither signal ever
// reached the recipe generator (found in the 2026-08-18 review). This suite
// pins BOTH halves so that failure class can't silently recur:
//   1. buildMeasuredFeedback() carries both signals, current-coffee-first.
//   2. recommend.ts imports it AND interpolates it into the user message.
// Half 2 is a source-level assertion on recommend.ts, because the module
// itself pulls in the DB client and the Anthropic SDK and can't be bundled
// here — a function-only test is exactly what hid the original gap.

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const dir = await mkdtemp(join(tmpdir(), "measfb-"));
const out = join(dir, "m.mjs");
await build({
  stdin: {
    contents: `export { buildMeasuredFeedback } from ${JSON.stringify(path.join(ROOT, "src/lib/claude/historyUtils.ts"))};`,
    resolveDir: ROOT,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  outfile: out,
  platform: "neutral",
  logLevel: "silent",
});
const { buildMeasuredFeedback } = await import(pathToFileURL(out).href);

const CURRENT = { name: "Berry Swirl", roaster: "DAK" };

function session({ name = "Berry Swirl", roaster = "DAK", coachAnswer, flowAnalysis, rating = 3 } = {}) {
  return {
    id: "s",
    coffee: { name, roaster, origin: "Bolivia", process: "Natural" },
    brew: { methodUsed: "V60", actualTimeSec: 200, ...(flowAnalysis ? { flowAnalysis } : {}) },
    result: { rating, ...(coachAnswer ? { coachAnswer } : {}) },
  };
}

const ASKED = { question: "Was it sour-sharp, or just weak?", answer: "Just weak" };
const UNEVEN = { pourSteadiness: 0.42, overshootG: 31 };

test("no qualifying session → empty string (prompt unchanged)", () => {
  assert.equal(buildMeasuredFeedback([session(), session()], CURRENT), "");
  assert.equal(buildMeasuredFeedback([], CURRENT), "");
});

test("coachAnswer session appears with the verbatim Q→A", () => {
  const block = buildMeasuredFeedback([session({ coachAnswer: ASKED })], CURRENT);
  assert.match(block, /MEASURED BREW FEEDBACK/);
  assert.ok(block.includes(`asked "${ASKED.question}" → "${ASKED.answer}"`));
});

test("flowAnalysis session appears with steadiness + overshoot", () => {
  const block = buildMeasuredFeedback([session({ flowAnalysis: UNEVEN })], CURRENT);
  assert.match(block, /measured pour: steadiness CV 0\.42 \(uneven — channeling risk\), ran 31g ahead of plan/);
});

test("current coffee's sessions come first, other bags after", () => {
  const other = session({ name: "Currant Mood", coachAnswer: ASKED });
  const mine = session({ flowAnalysis: UNEVEN });
  const block = buildMeasuredFeedback([other, mine], CURRENT);
  assert.ok(
    block.indexOf("Berry Swirl") < block.indexOf("Currant Mood"),
    "same-bag evidence must be listed before other bags",
  );
});

test("cap: at most `limit` lines survive", () => {
  const many = Array.from({ length: 20 }, () => session({ coachAnswer: ASKED }));
  const block = buildMeasuredFeedback(many, CURRENT, 8);
  assert.equal(block.split("\n").filter((l) => l.startsWith("- ")).length, 8);
});

test("WIRING: recommend.ts imports buildMeasuredFeedback and interpolates the block into the user message", async () => {
  const src = await readFile(path.join(ROOT, "src/lib/claude/recommend.ts"), "utf8");
  assert.match(
    src,
    /import\s*\{[^}]*buildMeasuredFeedback[^}]*\}\s*from\s*"\.\/historyUtils"/,
    "recommend.ts must import buildMeasuredFeedback from historyUtils",
  );
  assert.match(
    src,
    /buildMeasuredFeedback\(\s*pastSessions\s*,\s*coffee\s*\)/,
    "recommend.ts must call buildMeasuredFeedback(pastSessions, coffee)",
  );
  assert.match(
    src,
    /\$\{insightsBlock\}\$\{measuredFeedbackBlock\}/,
    "the measured-feedback block must be interpolated into the user message next to insightsBlock",
  );
});
