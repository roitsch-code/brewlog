// The coach's statuses reach the prompts (2026-10-03). Until this change the
// Confirmed / Save to try / Didn't help workflow on /taste changed nothing a
// model could see: run.ts dropped `status` before the /recommend prompt (an
// unordered LIMIT 20 at that), recommend.ts sorted only on citation overlap
// while a comment claimed "confirmed ranked higher", the coach's regeneration
// never saw its own earlier rows (a rejected insight came back reworded), the
// per-coffee card never reached /recommend, and regeneration ran only when
// /taste was opened.
//
// Asserts the two pure formatters AND, source-level, that each consumer is
// wired — a producer-only test is what let #530/#535 ship unwired.
//
//   node --test tests/dataflow/coach-status-reaches-prompt.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const dir = await mkdtemp(join(tmpdir(), "coachstatus-"));
const out = join(dir, "b.mjs");
await build({
  stdin: {
    contents: `export * as IB from ${JSON.stringify(path.join(ROOT, "src/lib/claude/insightsBlock.ts"))};
export * as CP from ${JSON.stringify(path.join(ROOT, "src/lib/claude/coachPriors.ts"))};`,
    resolveDir: ROOT,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { IB, CP } = await import(pathToFileURL(out).href);

const coffee = { variety: "SL28", process: "Washed", roastLevel: "Light", origin: "Kenya" };
const rows = [
  { observation: "NEW-A relevant", suggestion: "s", citationFields: ["variety", "process"], status: "new" },
  { observation: "TRYING-B", suggestion: "s", citationFields: [], status: "trying", createdAt: "2026-09-20T10:00:00Z" },
  { observation: "CONFIRMED-C", suggestion: "s", citationFields: [], status: "confirmed", source: "user-confirmed" },
  { observation: "REJECTED-D", suggestion: "s", citationFields: ["variety"], status: "doesnt-apply" },
  { observation: "NEW-E unrelated", suggestion: "s", citationFields: ["method"], status: "new" },
];

test("rankInsights: confirmed → trying → new, then citation overlap; doesnt-apply never reaches the prompt", () => {
  const order = IB.rankInsights(rows, coffee, {}).map((r) => r.observation);
  assert.deepEqual(order, ["CONFIRMED-C", "TRYING-B", "NEW-A relevant", "NEW-E unrelated"]);
});

test("formatInsightsBlock labels each line with the user's verdict and explains what the labels mean", () => {
  const block = IB.formatInsightsBlock(rows, coffee, {});
  assert.match(block, /^\nCOACH INSIGHTS/);
  assert.match(block, /\[CONFIRMED by the user\] CONFIRMED-C/);
  assert.match(block, /\[TRYING — the user chose to test this since 2026-09-20\] TRYING-B/);
  assert.match(block, /\[new — unverified\] NEW-A relevant/);
  assert.doesNotMatch(block, /REJECTED-D/);
  assert.match(block, /standing rule for this user/);
  assert.match(block, /FIRST candidate should honour it/);
  // A row without a status is treated as new, and an empty list is silent.
  assert.match(IB.formatInsightsBlock([{ observation: "X", suggestion: "y", citationFields: [] }], coffee, {}), /\[new — unverified\] X/);
  assert.equal(IB.formatInsightsBlock([], coffee, {}), "");
  assert.equal(IB.formatInsightsBlock(undefined, coffee, {}), "");
});

test("formatPriorInsightsForCoach: rejected and confirmed rows are named as such; new rows are the only replaceable ones", () => {
  const txt = CP.formatPriorInsightsForCoach([
    { observation: "C1", suggestion: "s", status: "confirmed", createdAt: new Date("2026-08-22T00:00:00Z") },
    { observation: "T1", suggestion: "s", status: "trying" },
    { observation: "R1", suggestion: "s", status: "doesnt-apply" },
    { observation: "N1", suggestion: "s", status: "new" },
  ]);
  assert.match(txt, /Your earlier insights and the user's verdicts/);
  assert.match(txt, /CONFIRMED by the user[^\n]*\n  - 2026-08-22 · C1 s/);
  assert.match(txt, /TRYING[^\n]*do NOT re-emit[^\n]*\n  - T1 s/);
  assert.match(txt, /REJECTED by the user[^\n]*any rephrasing[^\n]*\n  - R1 s/);
  assert.match(txt, /still new[^\n]*\n  - N1 s/);
  assert.equal(CP.formatPriorInsightsForCoach([]), "");
});

test("WIRING — run.ts orders by status before the limit and carries status/source/createdAt into the prompt shape", async () => {
  const src = await readFile(path.join(ROOT, "src/lib/recommend/run.ts"), "utf8");
  assert.match(src, /CASE \$\{insightsTable\.status\} WHEN 'confirmed' THEN 0 WHEN 'trying' THEN 1 WHEN 'new' THEN 2/);
  assert.match(src, /status: row\.status,\s*source: row\.source,/);
  assert.match(src, /coachInsight: coffees\.coachInsight,/, "the per-coffee card must be read for /recommend");
  assert.match(src, /card\.status !== "doesnt-apply"/, "a rejected card must not reach the prompt");
  assert.doesNotMatch(src, /with confirmed ranked higher by the recommend prompt block builder/, "the false comment is gone");
});

test("WIRING — recommend.ts builds the block from insightsBlock.ts and interpolates the coffee's own coach card", async () => {
  const src = await readFile(path.join(ROOT, "src/lib/claude/recommend.ts"), "utf8");
  assert.match(src, /const insightsBlock = formatInsightsBlock\(insights, coffee, context\)/);
  assert.match(src, /THIS COFFEE'S COACH CARD \[/);
  assert.match(src, /\$\{historyBlock\}\$\{coachCardBlock\}\$\{insightsBlock\}/, "the card must sit in the user message");
});

test("WIRING — the coach's regeneration sees its own rows + which recipe each brew followed; a save triggers it", async () => {
  const ins = await readFile(path.join(ROOT, "src/lib/claude/insights.ts"), "utf8");
  assert.match(ins, /formatPriorInsightsForCoach\(\s*existing\.map/, "existing rows with statuses must be in the coach prompt");
  assert.match(ins, /recipe\.push\(`rec="\$\{ref\.slice\(0, 60\)\}"`\)/, "each brew line must carry the followed reference");
  const route = await readFile(path.join(ROOT, "src/app/api/sessions/route.ts"), "utf8");
  assert.match(route, /void getOrGenerateInsights\(\)\.catch/, "a rated home save must kick the cache-aware regeneration");
});
