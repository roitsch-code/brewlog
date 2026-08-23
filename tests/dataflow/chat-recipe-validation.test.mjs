// The chat's start_brew path must actually RUN the shared recipe validator.
//
//   node --test tests/dataflow/chat-recipe-validation.test.mjs
//
// This asserts the WIRING, at source level, on purpose. Twice now this repo has
// shipped a function that was written, unit-tested and documented as feeding a
// prompt while nothing ever called it (#530, #535) — both "pinned" by tests that
// only exercised the producer. A validator nothing invokes is exactly that bug
// with worse consequences, because the failure is silent and reaches the timer.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ROUTE = readFileSync("src/app/api/explore-agent/route.ts", "utf8");
// The prompt lives in its own Next-free module so the live harness can import
// it (scripts/chat-agent-sim.mjs). Content assertions read it there; wiring
// assertions stay on the route.
const PROMPT = readFileSync("src/lib/chat/agentPrompt.ts", "utf8");

test("the route imports the shared validator", () => {
  assert.match(
    ROUTE,
    /import\s*\{[^}]*validateRecipe[^}]*\}\s*from\s*"@\/lib\/recipe\/validateRecipe"/,
    "explore-agent must import validateRecipe from the shared module",
  );
  assert.match(
    ROUTE,
    /import\s*\{[^}]*formatProblemsForModel[^}]*\}\s*from\s*"@\/lib\/recipe\/validateRecipe"/,
  );
});

test("start_brew is validated before it becomes an action", () => {
  // The call must sit inside the start_brew branch, not somewhere decorative.
  // Since 2026-08-23 the branch checks the TARGET first (an invented id — the
  // dead DAK Cassis pill — is bounced before the recipe is even looked at),
  // so the window covers both checks and asserts their order.
  const branch = ROUTE.slice(ROUTE.indexOf('block.name === "start_brew"'));
  assert.ok(branch.length > 0, "start_brew branch must exist");
  const head = branch.slice(0, 3600);
  const targetIdx = head.indexOf("resolveStartBrewTarget(");
  const recipeIdx = head.indexOf("validateRecipe(");
  assert.ok(targetIdx > 0, "start_brew must resolve its target");
  assert.ok(recipeIdx > 0, "start_brew must call validateRecipe");
  assert.ok(targetIdx < recipeIdx, "target check runs first — a perfect recipe on a dead pill is still a dead button");
  assert.match(head, /problems\.length > 0/, "it must act on the problems it finds");
});

test("a failed recipe goes back to the model as an error tool_result", () => {
  assert.match(
    ROUTE,
    /content:\s*formatProblemsForModel\(problems\)/,
    "the model must receive the formatted problems",
  );
  const idx = ROUTE.indexOf("formatProblemsForModel(problems)");
  assert.match(
    ROUTE.slice(idx, idx + 200),
    /is_error:\s*true/,
    "the tool_result must be flagged as an error so the model treats it as a failure",
  );
});

test("the repair budget is exactly one round per turn", () => {
  assert.match(ROUTE, /let brewRepairSpent = false/, "the budget must be declared once per turn");
  assert.match(ROUTE, /brewRepairSpent = true/, "it must be spent when a repair is issued");
  // Declared OUTSIDE the iteration loop, or it would reset every round and the
  // model could bounce forever.
  const declIdx = ROUTE.indexOf("let brewRepairSpent = false");
  const loopIdx = ROUTE.indexOf("for (let iteration = 0; iteration < MAX_ITERATIONS");
  assert.ok(declIdx < loopIdx, "brewRepairSpent must be declared before the iteration loop");
});

test("a recipe that fails twice yields no brew button", () => {
  // droppedBrew carries WHICH kind of failure dropped the pill, so the user
  // hears the right explanation — both drop sites must exist.
  assert.match(ROUTE, /droppedBrew = "recipe"/, "a twice-failed recipe must drop the action");
  assert.match(ROUTE, /droppedBrew = "target"/, "a twice-failed target must drop the action");
  // And the user is told, rather than the pill silently vanishing.
  const idx = ROUTE.indexOf("droppedBrew) {");
  assert.ok(idx > 0);
  assert.match(ROUTE.slice(idx, idx + 400), /send\("delta"/, "the user must be told why there's no timer");
});

test("accepted actions still reach the user when a sibling action is rejected", () => {
  // A rejected start_brew must not swallow an add_coffee emitted in the same turn.
  assert.match(ROUTE, /navSuggestions\.push\(\.\.\.acceptedActions\)/);
});

// ── The prompt rules that keep the validator from firing constantly ──────────
// The validator is a net, not a teacher. If the prompt doesn't carry these, the
// model writes an unbrewable recipe, gets it bounced, and the user waits through
// a repair round on every single request. Each of these was absent while the
// equivalent rule sat in /recommend's prompt the whole time.

test("the chat prompt carries the pourability rule", () => {
  assert.match(PROMPT, /4 g\/s/, "the gentle-pour rate must be stated");
  assert.match(PROMPT, /11 g\/s/, "the physical ceiling must be stated");
});

test("the chat prompt carries the percolation shape rule", () => {
  assert.match(PROMPT, /Never one giant final pour/i);
  // The rule is stated as pour-count floors against the clock, because that is
  // the lever the model actually controls: the timer DERIVES the gaps from
  // targetTimeSec and the pour count, so "no dead air" alone asks the model to
  // reason about an output it never writes. Measured 2026-08-22: dead-gap was
  // the only failure mode that survived a repair round.
  assert.match(PROMPT, /water steps \(bloom \+ pours\)/i, "the floors table must be present");
  assert.match(PROMPT, /up to 5:00/, "floor row: normal brews");
  assert.match(PROMPT, /over 5:00/, "floor row: long brews");
  // The disc column is load-bearing, not decoration. With the Drip Assist the
  // drawdown reserve is 7% instead of 33%, so the pour phase is ~40% longer and
  // the bare-brewer count leaves a hole. Measured 2026-08-23 (run 3): all six
  // remaining first-try failures were dead-gap, and every gooseneck-less one
  // had followed the bare count.
  assert.match(PROMPT, /with the Drip Assist/i, "the disc column must exist");
  assert.match(PROMPT, /always needs one more pour/i, "and say plainly that the disc needs one more");
  assert.match(PROMPT, /FLOORS, not targets/i, "one more pour must read as safe");
  assert.match(PROMPT, /Do not pad the clock/i, "stretching the clock is the other half of the failure");
});

test("the disc is described as replacing the stream, not the hand", () => {
  assert.match(
    PROMPT,
    /replaces the STREAM, not the HAND/,
    "without this the model proposes patient-pour recipes to someone with no gooseneck",
  );
});

test("a user-stated constraint outranks the rest of the prompt, including narrowing", () => {
  assert.match(PROMPT, /outranks every other section of this prompt/i);
  assert.match(PROMPT, /narrowing/i, "narrowing a set they own must be covered, not just the profile");
});

test("the chat is told to decide rather than interview", () => {
  assert.match(PROMPT, /Make the call\. Do not interview\./);
});

test("the voice ban covers more than emoji", () => {
  assert.match(PROMPT, /No emoji\. No exclamation marks\./);
  assert.match(PROMPT, /No opening interjections/);
});

test("the route actually uses that prompt module", () => {
  // Splitting the prompt out is only safe if the route still imports it —
  // otherwise these content assertions would pass against a dead file.
  assert.match(
    ROUTE,
    /import\s*\{[^}]*AGENT_SYSTEM_PROMPT[^}]*\}\s*from\s*"@\/lib\/chat\/agentPrompt"/,
    "explore-agent must import the prompt it is tested on",
  );
  assert.match(ROUTE, /system:\s*systemBlocks/, "and pass it to the model");
});

test("start_brew's recipe is sanitized through cleanChatRecipe before anything reads it", () => {
  // Unwiring cleanChatRecipe from toNavAction would keep every other test
  // green (the validator still runs — on the RAW recipe) while silently
  // re-opening the #410 blank-pour-guide bug: drifted step actions
  // ("Steep"/"Plunge") never match the renderer's vocabulary and the timer
  // shows nothing. Pin the wiring, not just the function.
  assert.match(
    ROUTE,
    /import\s*\{[^}]*cleanChatRecipe[^}]*\}\s*from\s*"@\/lib\/chat\/agentContext"/,
    "the route must import cleanChatRecipe",
  );
  const startBrew = ROUTE.slice(ROUTE.indexOf('toolName === "start_brew"'));
  assert.ok(startBrew.length > 0, "start_brew mapping must exist");
  assert.match(
    startBrew.slice(0, 600),
    /recipe:\s*cleanChatRecipe\(input\.recipe\)/,
    "the start_brew action's recipe must be the CLEANED recipe",
  );
});
