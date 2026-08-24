// The owner's stated flavour dislike must actually reach the home chat.
//
//   node --test tests/dataflow/taste-preference-reaches-chat.test.mjs
//
// Why this exists: the corpus of logged brews is SELECTION-BIASED — the owner
// filters coffees at the shop, so a flavour he avoids never enters the log as
// a negative example and no amount of data will teach the app about it. The
// only place a dislike like that can live in a single-user project is the
// canonical profile, stated in words.
//
// Two halves, because this repo has twice shipped a block that was built and
// never consumed (#530, #535):
//   1. formatProfileForPrompt() carries the constraint, its SELECTION-only
//      scope, and the "silence is not a dislike" caveat.
//   2. explore-agent/route.ts imports the formatter AND pushes its output into
//      the system array. Half 2 is a source-level assertion because the route
//      pulls in the DB client and the Anthropic SDK.
//
// NOTE ON SCOPE: formatProfileForPrompt has exactly one production consumer,
// the chat. /recommend receives taste preferences only as body=/acidity= from
// the DB row, and /greeting reads just profile.equipment. That is the correct
// target anyway — this is a preference about WHICH BAG, and /recommend picks a
// recipe for a bag the owner already owns.

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();

// The bundle must live INSIDE the project so Node can still resolve the
// externals below at runtime; a /tmp bundle cannot (CLAUDE.md, 2026-08-23).
const outDir = path.join(ROOT, "node_modules/.cache/brewlog-tests");
await mkdir(outDir, { recursive: true });
const out = path.join(outDir, "taste-profile.mjs");
await build({
  stdin: {
    contents: `export { formatProfileForPrompt } from ${JSON.stringify(
      path.join(ROOT, "src/lib/claude/userProfile.ts"),
    )};`,
    resolveDir: ROOT,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  outfile: out,
  platform: "node",
  external: ["pg", "pg-native", "drizzle-orm", "drizzle-orm/*"],
  logLevel: "silent",
});
const { formatProfileForPrompt } = await import(pathToFileURL(out).href);

const block = formatProfileForPrompt(null);

test("the profile states the pineapple dislike and scopes it to home", () => {
  assert.match(block, /pineapple/i, "the stated dislike must appear verbatim");
  assert.match(
    block,
    /home/i,
    "the dislike is context-bound to home brewing, not absolute",
  );
  assert.match(
    block,
    /cafe|café/i,
    "the cafe exception must survive — a flat ban would misstate the preference",
  );
});

test("it is marked soft, not a ban", () => {
  assert.match(
    block,
    /soft, not a ban/i,
    "a hard ban is a fence the owner explicitly did not ask for",
  );
});

test("the dislike is scoped to SELECTION, never to brewing", () => {
  assert.match(block, /governs SELECTION/,
    "the scope clause must survive: this steers which bag, not how to brew it");
  assert.match(
    block,
    /never brewing/i,
    "a bag already owned must still be brewed as well as it can be",
  );
});

test("silence in the log is explicitly not evidence of a dislike", () => {
  assert.match(
    block,
    /NOT evidence/,
    "the selection-bias caveat is the reason this line has to be stated at all",
  );
  assert.match(block, /pre-filtered/i, "the caveat must name why the log is biased");
});

test("the flavour dislike is distinguished from the process/roast Avoids line", () => {
  // A washed or honey coffee can be loudly pineapple and pass the existing
  // Avoids filter, which is about processing and roast. If the two lines ever
  // collapse into one, that distinction is what gets lost.
  assert.match(block, /Avoids: extreme fermentation/, "the original process filter stays");
  assert.match(
    block,
    /FLAVOUR/,
    "the new line must announce itself as a flavour filter, not a process one",
  );
});

test("the pre-existing profile is intact (this is additive)", () => {
  assert.match(block, /Niche Zero/);
  assert.match(block, /silky, balanced, floral\/fruity light roasts/);
  assert.match(block, /Ethiopia Washed, Kenya AA Washed/);
});

test("WIRING: explore-agent imports formatProfileForPrompt and puts it in the system array", async () => {
  const src = await readFile(path.join(ROOT, "src/app/api/explore-agent/route.ts"), "utf8");
  assert.match(
    src,
    /import\s*\{[^}]*formatProfileForPrompt[^}]*\}\s*from\s*"@\/lib\/claude\/userProfile"/,
    "the route must import the formatter",
  );
  assert.match(
    src,
    /const\s+profileBlock\s*=\s*formatProfileForPrompt\(\s*userPrefs\s*\)/,
    "the route must build the block from the loaded preferences",
  );
  assert.match(
    src,
    /text:\s*profileBlock/,
    "the block must be pushed into the model call, not merely computed",
  );
});
