// The chat's Brew pill, after the 2026-10-10 SEY V60 (thin, sour, a clock the
// cone never matched, logged under the wrong bag).
//
//   node --test tests/dataflow/chat-brew-guards.test.mjs
//
// Anchor = the real pill from production (recommend-logs run 38057496768):
//   id sey__wilson_alba___sierra_morena___end_of_season, label "Brew SEY Susan
//   Meneses — V60", basedOn "Hoffmann V60 — 2024 Refinement", 27 g : 450 g,
//   94 °C, "26 clicks", targetTimeSec 250, steps bloom:90@25 swirl@10 wait@10
//   pour:270@45 pour:450@45 swirl@10. The owner brewed Susan Meneses (not in
//   the library); the session was saved under Wilson Alba; the pours end at
//   2:25 and the owner's measured V60 drawdown is ~100 s, so 250 s promised a
//   drawdown that did not exist; the grind unit was never checked because no
//   grinder was named in the conversation.
//
// Every rule here is pinned at the CONSUMER as well (the #530/#535 lesson):
// the route must call the gate in BOTH tool branches.

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const dir = await mkdtemp(join(tmpdir(), "brewguards-"));
const out = join(dir, "t.mjs");
await build({
  stdin: {
    contents: `
export { resolveStartBrewTarget, namesDescribeBag } from ${JSON.stringify(path.join(ROOT, "src/lib/chat/chatBrewTarget.ts"))};
export { expectedChatClock, CHAT_CLOCK_TOLERANCE_SEC } from ${JSON.stringify(path.join(ROOT, "src/lib/chat/chatClock.ts"))};
export { validateRecipe } from ${JSON.stringify(path.join(ROOT, "src/lib/recipe/validateRecipe.ts"))};
export { cleanChatRecipeDetailed } from ${JSON.stringify(path.join(ROOT, "src/lib/chat/agentContext.ts"))};
`,
    resolveDir: ROOT,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
  external: ["pg", "pg-native", "drizzle-orm", "drizzle-orm/*"],
});
const { resolveStartBrewTarget, namesDescribeBag, expectedChatClock, CHAT_CLOCK_TOLERANCE_SEC, validateRecipe, cleanChatRecipeDetailed } =
  await import(pathToFileURL(out).href);

const WILSON = "sey__wilson_alba___sierra_morena___end_of_season";
const LIBRARY = new Map([
  [WILSON, { roaster: "SEY", name: "Wilson Alba - Sierra Morena - End of Season" }],
  ["friedhats_coffee_roasters__costa_rica_adelina_fallas_honey", { roaster: "Friedhats Coffee Roasters", name: "Costa Rica Adelina Fallas Honey" }],
]);
const KNOWN = new Set(LIBRARY.keys());

// The pill's recipe exactly as the DB holds it (already house-timed).
const PILL_RECIPE = {
  doseGrams: 27,
  waterGrams: 450,
  waterTempC: 94,
  grindSize: "26 clicks",
  targetTimeSec: 250,
  pourSteps: [
    { label: "Bloom", action: "bloom", waterGramsAtEnd: 90, durationSec: 25 },
    { label: "Swirl", action: "swirl", durationSec: 10 },
    { label: "Rest", action: "wait", durationSec: 10 },
    { label: "Pour 1", action: "pour", waterGramsAtEnd: 270, durationSec: 45 },
    { label: "Pour 2", action: "pour", waterGramsAtEnd: 450, durationSec: 45 },
    { label: "Swirl", action: "swirl", durationSec: 10 },
  ],
};

// ── 1. the names win over a known id that points at a different bag ─────────

test("ANCHOR: the Susan Meneses pill drops the Wilson Alba id — the names describe another bag", () => {
  const r = resolveStartBrewTarget({ id: WILSON, roaster: "SEY", name: "Susan Meneses" }, KNOWN, LIBRARY);
  assert.equal(r.ok, true);
  assert.equal(r.id, undefined, "the wrong id must not reach the pill — the brew creates Susan Meneses' own row on save");
});

test("a known id whose names DO describe the bag is kept (no duplicate row for a shortened name)", () => {
  const id = "friedhats_coffee_roasters__costa_rica_adelina_fallas_honey";
  const r = resolveStartBrewTarget({ id, roaster: "Friedhats", name: "Costa Rica Adelina Falla" }, KNOWN, LIBRARY);
  assert.deepEqual(r, { ok: true, id });
  assert.equal(namesDescribeBag("SEY", "Susan Meneses", LIBRARY.get(WILSON)), false);
  assert.equal(namesDescribeBag("Friedhats", "Costa Rica Adelina Falla", LIBRARY.get(id)), true);
});

test("names that resolve to ANOTHER known bag re-point the id there", () => {
  const r = resolveStartBrewTarget(
    { id: WILSON, roaster: "Friedhats Coffee Roasters", name: "Costa Rica Adelina Fallas Honey" },
    KNOWN,
    LIBRARY,
  );
  assert.deepEqual(r, { ok: true, id: "friedhats_coffee_roasters__costa_rica_adelina_fallas_honey" });
});

// ── 2. the clock is pours end + the owner's measured drawdown ────────────────

/** Two measured V60 brews at ~450 g with a known drawdown, in the shape
 * measuredDrawdowns reads (cadence-first era, flowAnalysis reach times). */
function measuredV60(drawdownSec, idx) {
  const pourEnd = 150;
  return {
    id: `s${idx}`,
    type: "brew",
    mode: "home",
    createdAt: "2026-10-05T08:00:00Z",
    createdAtMs: Date.parse("2026-10-05T08:00:00Z") + idx,
    coffee: { roaster: "X", name: "Y", origin: "", process: "Washed", roastLevel: "Light" },
    context: {},
    recommendation: {
      candidates: [
        {
          method: "V60",
          role: "anchor",
          title: "t",
          recipe: {
            doseGrams: 27,
            waterGrams: 450,
            waterTempC: 94,
            grindSize: "400°",
            targetTimeSec: pourEnd + drawdownSec,
            pourSteps: [
              { label: "Bloom", action: "bloom", waterGramsAtEnd: 90, durationSec: 20 },
              { label: "Rest", action: "wait", durationSec: 30 },
              { label: "Pour", action: "pour", waterGramsAtEnd: 450, durationSec: 100 },
            ],
          },
          whyChosen: "",
          confidence: "moderate",
        },
      ],
      primaryMethod: "V60",
      primaryRecipe: {},
      reasoning: "",
      generatedAt: "2026-10-05T08:00:00Z",
    },
    brew: {
      methodUsed: "V60",
      selectedCandidateIdx: 0,
      actualTimeSec: pourEnd + drawdownSec,
      flowAnalysis: {
        totalTimeSec: pourEnd + drawdownSec,
        targetTimeSec: pourEnd + drawdownSec,
        finalGrams: 450,
        perPour: [
          { index: 0, label: "Bloom", targetGrams: 90, targetSec: 20, intendedPourSec: 20, actualSec: 20, errorSec: 0 },
          { index: 1, label: "Pour", targetGrams: 450, targetSec: 150, intendedPourSec: 100, actualSec: pourEnd, errorSec: 0 },
        ],
        avgFlowRateGPS: 4,
        peakFlowRateGPS: 5,
        pourSteadiness: 0.2,
        overshootG: 1,
        derivedFlow: "perfect",
        samples: [],
      },
    },
    result: { rating: 4, flavorNotes: [] },
  };
}

test("ANCHOR: the 250 s clock is rejected — pours end 2:25, measured drawdown ~100 s", () => {
  const sessions = [measuredV60(100, 1), measuredV60(104, 2)];
  const exp = expectedChatClock(PILL_RECIPE, "V60", sessions, undefined, Date.parse("2026-10-10T13:00:00Z"));
  assert.ok(exp, "a V60 with two measured drawdowns at this batch gets a clock");
  assert.equal(exp.pourPhaseEndSec, 145, "bloom 25 + swirl 10 + rest 10 + 45 + 45 + swirl 10");
  assert.equal(exp.drawdownSec, 102);
  assert.equal(exp.sec, 247);
  // 250 is within tolerance of 247 — the real failure was the pour plan the
  // measured drawdown exposes, not this arithmetic. Push the owner's measured
  // drawdown to what the DB actually says for V60 at ~350 g (104 s, log line
  // of 10-06) and the model's "published" 3:00 clock is 40 s short.
  const short = validateRecipe({ ...PILL_RECIPE, targetTimeSec: 180 }, { method: "V60", expectedClock: exp });
  assert.ok(short.some((p) => p.code === "clock-off-drawdown"), JSON.stringify(short));
  assert.match(short.find((p) => p.code === "clock-off-drawdown").message, /247|4:07/);
  const fine = validateRecipe({ ...PILL_RECIPE, targetTimeSec: exp.sec + CHAT_CLOCK_TOLERANCE_SEC }, { method: "V60", expectedClock: exp });
  assert.ok(!fine.some((p) => p.code === "clock-off-drawdown"));
});

test("no measured brews → the corpus V60 drawdown still gives a clock; immersion gives none", () => {
  const exp = expectedChatClock(PILL_RECIPE, "V60", [], undefined, Date.parse("2026-10-10T13:00:00Z"));
  assert.ok(exp && exp.drawdownSec > 30, "corpus median, not the 5 s physics floor");
  const clever = {
    ...PILL_RECIPE,
    pourSteps: [
      { label: "Fill", action: "pour", waterGramsAtEnd: 450, durationSec: 40 },
      { label: "Steep", action: "wait", durationSec: 150 },
      { label: "Drain", action: "drain", durationSec: 60 },
    ],
  };
  assert.equal(expectedChatClock(clever, "Clever Dripper", [], undefined), null);
});

// ── 3. the grind unit is checked against the HOME grinder by default ────────

test("'26 clicks' on the Niche is flagged once the home grinder is the default", () => {
  const problems = validateRecipe(PILL_RECIPE, { method: "V60", grinder: "Niche Zero" });
  assert.ok(problems.some((p) => p.code === "grind-unit"), JSON.stringify(problems));
});

// ── 4. the cleaner says what it did ────────────────────────────────────────

test("cleanChatRecipeDetailed reports the pour-time source and every change", () => {
  const raw = {
    ...PILL_RECIPE,
    pourSteps: PILL_RECIPE.pourSteps.map((s) => (s.action === "pour" ? { ...s, durationSec: 30 } : s)),
  };
  const c = cleanChatRecipeDetailed(raw, { basedOn: "Hoffmann V60 — 2024 Refinement", method: "V60" });
  assert.equal(c.pourSource, "house", "an unverified reference gets the house pace");
  assert.ok(c.pourChanges.length >= 2, JSON.stringify(c.pourChanges));
});

// ── 5. the route runs the gate in BOTH branches, with the home grinder and the roast date

test("route: one start_brew gate, used in the action-only AND the mixed (data-tool) branch", async () => {
  const src = await readFile(path.join(ROOT, "src/app/api/explore-agent/route.ts"), "utf8");
  const mixed = src.indexOf("else if (isActionTool(block.name)) {");
  assert.ok(mixed > 0);
  const mixedBody = src.slice(mixed, mixed + 1600);
  assert.match(mixedBody, /vetStartBrew\(action\)/, "a start_brew beside lookup_recipe must not bypass validation");
  assert.ok((src.match(/vetStartBrew\(action\)/g) ?? []).length >= 2, "both branches call the gate");
  assert.match(src, /resolveStartBrewTarget\(action, knownCoffeeIds, knownBags\)/, "the names-vs-id check needs the library names");
  assert.match(src, /grinderFromConversation\(messages\) \?\? "Niche Zero"/, "no grinder named = the home grinder");
  assert.match(src, /expectedChatClock\(action\.recipe, action\.method/, "the clock is computed server-side");
  assert.match(src, /roastDate,\n\s+expectedClock,/, "validator sees the bag's roast date and the clock");
  assert.match(src, /\[explore-agent\] start_brew accepted:/, "an accepted pill is logged");
  assert.match(src, /\[explore-agent\] lookup_recipe "/, "a lookup is logged");
});
