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
  const branch = ROUTE.slice(ROUTE.indexOf('block.name === "start_brew"'));
  assert.ok(branch.length > 0, "start_brew branch must exist");
  const head = branch.slice(0, 1200);
  assert.match(head, /validateRecipe\(/, "start_brew must call validateRecipe");
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
  assert.match(ROUTE, /droppedBrew = true/, "the second failure must drop the action");
  // And the user is told, rather than the pill silently vanishing.
  const idx = ROUTE.indexOf("droppedBrew) {");
  assert.ok(idx > 0);
  assert.match(ROUTE.slice(idx, idx + 400), /send\("delta"/, "the user must be told why there's no timer");
});

test("accepted actions still reach the user when a sibling action is rejected", () => {
  // A rejected start_brew must not swallow an add_coffee emitted in the same turn.
  assert.match(ROUTE, /navSuggestions\.push\(\.\.\.acceptedActions\)/);
});
