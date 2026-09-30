// The /recommend prompt states bean age with the app's ONE freshness table
// (src/lib/coffee/freshness.ts) — no second set of edges.
//
//   node --test tests/dataflow/freshness-prompt.test.mjs
//
// Before 2026-09-30 it said ">22 days → grind FINER" in the extraction budget
// and ">35 days → may need finer" twelve lines later, and day 22 fell between
// "7–21" and ">22". The conflict rule also raised temperature for an old
// natural while the process rule — which outranks freshness — says naturals
// brew cooler; it now stays within the process's own range.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const src = await readFile(path.join(process.cwd(), "src/lib/claude/recommendPrompt.ts"), "utf8");

test("no stale freshness edges remain", () => {
  assert.doesNotMatch(src, />22 days/);
  assert.doesNotMatch(src, />35 days/);
});

test("the prompt names the shared buckets", () => {
  assert.match(src, /22–34 days/);
  assert.match(src, /35 days and older/);
  assert.match(src, /5–6 days = very fresh/);
});

test("the old-natural conflict rule stays inside the process's range", () => {
  assert.match(src, /WITHIN that process's own range/);
});
