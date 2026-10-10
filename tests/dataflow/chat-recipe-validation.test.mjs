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
  // Since 2026-10-10 both checks live in ONE gate (vetStartBrew) that both
  // tool branches call — a start_brew beside a lookup_recipe used to skip
  // validation entirely.
  const branch = ROUTE.slice(ROUTE.indexOf("const vetStartBrew = async"));
  assert.ok(branch.length > 0, "the start_brew gate must exist");
  const head = branch.slice(0, 3600);
  assert.ok((ROUTE.match(/await vetStartBrew\(action\)/g) ?? []).length >= 2, "both tool branches call the gate");
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
    /problem:\s*formatProblemsForModel\(problems\)/,
    "the gate must hand the model the formatted problems",
  );
  // Both branches send that text back as an ERROR tool_result.
  assert.ok(
    (ROUTE.match(/content:\s*vet\.problem,?\s*\n?\s*is_error:\s*true/g) ?? []).length >= 2,
    "the tool_result must be flagged as an error so the model treats it as a failure (both branches)",
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
  assert.ok((ROUTE.match(/droppedBrewNotice = droppedNotice\(vet\.kind\)/g) ?? []).length >= 2, "both branches drop a twice-failed pill");
  assert.match(ROUTE, /kind === "target"\s*\?/, "the notice names the kind of failure");
  // And the user is told, rather than the pill silently vanishing.
  assert.match(ROUTE, /if \(droppedBrewNotice\) send\("delta", \{ text: droppedBrewNotice \}\)/, "the user must be told why there's no timer");
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
  // The ceiling is the corpus's own fastest published pour — Hoffmann's
  // Ultimate V60, 240g in 30s. It was 11 g/s (the DISPLAY clamp) until Sep 2026,
  // which waved through pours no expert writes.
  assert.match(PROMPT, /8 \(Hoffmann's Ultimate/, "the physical ceiling must be the published one");
});

test("the chat prompt tells the model the timer follows its own step times", () => {
  // Until Sep 2026 the timer re-derived every pour start from targetTimeSec, so
  // the prompt taught the model to reason about pour COUNT against the clock —
  // floors in a table — because the durations it wrote were discarded. The timer
  // now runs the cadence the model writes, so the rule is the cadence itself.
  assert.match(PROMPT, /the timer follows them/i, "the model must know its durations are used");
  assert.match(PROMPT, /write the PAUSES as their own "wait" steps/i, "rests are steps now");
  assert.match(PROMPT, /do not write a trailing "Drawdown" step/i);
  assert.match(PROMPT, /targetTimeSec is the sum of all of it/i, "the clock must be stated as a sum");
  assert.match(PROMPT, /Never one giant final pour/i);
  assert.doesNotMatch(
    PROMPT,
    /water steps \(bloom \+ pours\)/i,
    "the pour-count floors were a workaround for the renderer inventing gaps — they must not come back",
  );
});

test("the chat prompt carries the scaling model", () => {
  assert.match(PROMPT, /bigger pours, not more of them/i, "pour count holds when scaling");
  assert.match(PROMPT, /per DOUBLING of dose/i, "the grind law must be logarithmic");
  assert.match(PROMPT, /grind finer for less volume|grind finer than if you are brewing more volume/i, "and must cover scaling DOWN");
  assert.match(PROMPT, /square root of the volume factor/i, "the drawdown growth must be stated");
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
    /import\s*\{[^}]*cleanChatRecipeDetailed[^}]*\}\s*from\s*"@\/lib\/chat\/agentContext"/,
    "the route must import cleanChatRecipeDetailed",
  );
  const startBrew = ROUTE.slice(ROUTE.indexOf('toolName === "start_brew"'));
  assert.ok(startBrew.length > 0, "start_brew mapping must exist");
  // Since the measured pour pace (2026-10-10) the cleaning happens inside the
  // start_brew gate, which has the owner's sessions; the raw recipe never
  // reaches a pill because the gate replaces it before accepting.
  assert.match(ROUTE, /const cleaned = cleanStartBrewRecipe\(action, pace\.gps\);\s*\n\s*if \(!cleaned\) return \{ ok: false/, "the gate cleans the recipe and refuses an uncleanable one");
  assert.match(ROUTE, /action\.recipe = cleaned;/, "the pill carries the CLEANED recipe");
  assert.match(
    ROUTE,
    /cleanChatRecipeDetailed\(input\.recipe,\s*\{\s*basedOn:\s*input\.basedOn/,
    "cleanStartBrewRecipe must run the shared cleaner",
  );
});
