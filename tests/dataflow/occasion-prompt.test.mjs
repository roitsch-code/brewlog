// The /recommend prompt must describe the hot occasions the way the selector
// now scores them — and must no longer tell the model to ignore them.
//
//   node --test tests/dataflow/occasion-prompt.test.mjs
//
// Until 2026-09-30 the prompt said "All other occasions are background
// context", so even a menu ordered for an occasion would have been read as
// noise. Pinned so a later prompt edit cannot quietly bring that line back.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const src = await readFile(path.join(process.cwd(), "src/lib/claude/recommendPrompt.ts"), "utf8");

test("the prompt no longer dismisses occasions as background", () => {
  assert.doesNotMatch(src, /All other occasions are background context/);
});

test("each hot occasion carries the meaning its UI footnote promises", () => {
  for (const [id, phrase] of [
    ["morning-ritual", /slower, deliberate pour/],
    ["focus", /clean, mid-strength cup/],
    ["social", /forgiving recipe that holds its character as it cools/],
    ["experiment", /NOT been brewed with yet/],
  ]) {
    assert.match(src, new RegExp(`"${id}"`), `${id} must be named`);
    assert.match(src, phrase, `${id} must carry its meaning`);
  }
});

test("the prompt states the server-side Special ceiling", () => {
  assert.match(src, /drops any candidate over 180 s on a special brew/);
});
