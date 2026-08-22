// The chat's anti-repetition + exploration context must reach the MODEL.
//
//   node --test tests/dataflow/chat-variety-context.test.mjs
//
// WHY BOTH HALVES: this repo has been bitten twice by a function that was
// written, tested and documented as feeding a prompt while nothing actually
// called it — the coach answer (#530) and the measured pour (#535), each
// "pinned" by a test that only exercised the producer. So this file tests the
// function AND asserts, at source level, that the route imports it and pushes
// its output into the context the model receives. A function-only test is
// exactly what hid the original gaps.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const entry = `export { recentReferenceNames } from ${JSON.stringify(
  path.join(ROOT, "src/lib/claude/historyUtils.ts"),
)};
export { formatLibraryForAgent } from ${JSON.stringify(
  path.join(ROOT, "src/lib/chat/agentContext.ts"),
)};`;
const dir = await mkdtemp(join(tmpdir(), "chatvar-"));
const out = join(dir, "b.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { recentReferenceNames, formatLibraryForAgent } = await import(pathToFileURL(out).href);

const ROUTE = await readFile(path.join(ROOT, "src/app/api/explore-agent/route.ts"), "utf8");
// Prompt text moved to its own Next-free module so the live harness can import
// the REAL prompt; the route keeps the wiring.
const PROMPT = await readFile(path.join(ROOT, "src/lib/chat/agentPrompt.ts"), "utf8");

const session = (basedOns) => ({
  recommendation: { candidates: basedOns.map((b) => ({ basedOn: b, method: "V60" })) },
});

// ── The producer ───────────────────────────────────────────────────────────

test("collects the reference names from recent sessions", () => {
  const names = recentReferenceNames([
    session(["Kasuya 4:6", "Hoffmann V60"]),
    session(["Clever Extended"]),
  ]);
  assert.deepEqual(names.sort(), ["Clever Extended", "Hoffmann V60", "Kasuya 4:6"]);
});

test("self-authored sentinels are skipped — they name nothing to vary from", () => {
  const names = recentReferenceNames([session(["Own recipe", "Own experiment", "Kasuya 4:6"])]);
  assert.deepEqual(names, ["Kasuya 4:6"]);
});

test("duplicates collapse and the window is bounded", () => {
  const many = Array.from({ length: 12 }, (_, i) => session([`Recipe ${i}`]));
  assert.equal(recentReferenceNames([session(["A"]), session(["A"])]).length, 1);
  assert.equal(recentReferenceNames(many).length, 6, "default window is the last 6 sessions");
  assert.equal(recentReferenceNames(many, 3).length, 3);
});

test("sessions without recommendations are ignored, not crashed on", () => {
  assert.deepEqual(recentReferenceNames([{}, { recommendation: {} }, session([])]), []);
});

// ── The consumer ───────────────────────────────────────────────────────────
// Source-level, because the model side can't be unit-tested and a block that
// is built but never pushed is indistinguishable from one that doesn't exist.

test("the chat route imports and pushes the recently-used-references block", () => {
  assert.match(ROUTE, /import\s*{[^}]*recentReferenceNames[^}]*}\s*from\s*"@\/lib\/claude\/historyUtils"/);
  assert.match(ROUTE, /recentReferenceNames\(corpusSessions\)/);
  assert.match(ROUTE, /Recently used references/);
});

test("the chat route imports and pushes today's angles", () => {
  assert.match(ROUTE, /import\s*{[^}]*buildTodaysAngles[^}]*}\s*from\s*"@\/lib\/chat\/todaysAngles"/);
  assert.match(ROUTE, /buildTodaysAngles\(rotationCoffees,/);
  assert.match(ROUTE, /contextParts\.push\(anglesBlock\)/);
});

test("the chat route loads and pushes coach insights", () => {
  // The prompt claimed for months that insights were injected; nothing was.
  assert.match(ROUTE, /insightsTable/);
  assert.match(ROUTE, /Coach insights/);
});

test("the library lines carry each bag's whatToExplore", () => {
  const line = formatLibraryForAgent([
    {
      id: "dak__lush_lemons", roaster: "DAK", name: "Lush Lemons",
      origin: "Colombia", process: "Washed", variety: "Pink Bourbon",
      sessionCount: 3, avgRating: 4.2, inRotation: true,
      whatToExplore: "try the Classic bottom at 93C",
    },
  ]);
  assert.match(line, /\[id:dak__lush_lemons\]/, "the id the model needs for start_brew");
  assert.match(line, /Explore next: try the Classic bottom at 93C/);
  // And the route must still push that rendering into the model's context.
  assert.match(ROUTE, /formatLibraryForAgent\(/);
});

test("the exploration posture is in the system prompt, not just intended", () => {
  assert.match(PROMPT, /Exploration posture/);
  assert.match(PROMPT, /PARAMETER-LEVEL EXPLORATION IS ALWAYS OPEN/);
  // The old blanket ban is what made the chat a recipe jukebox; it must stay
  // scoped to arithmetic rather than forbidding a self-authored recipe.
  assert.ok(
    !/Don't free-hand a new milestone list/.test(PROMPT),
    "the blanket 'never invent a breakdown' instruction must be gone",
  );
  assert.match(PROMPT, /A recipe of your own is allowed/);
});
