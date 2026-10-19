// The per-brew insight deck (src/lib/recommend/brewDeck.ts, 2026-10-19).
//
// Owner: "Die Infos/Insights während das Rezept generiert wird — ist voll
// untergegangen." The deck is six lines about THIS brew, written by Haiku
// beside the Opus call from the material the recipe is built from, and let
// through only by the deterministic loading-insight gate: every checkable
// token of a line must be in its own snippet.
//
//   node --test tests/dataflow/brew-deck.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const entry = `
export { generateBrewDeck, deckSnippets, gateDeckLines, DECK_MAX_LINES } from ${JSON.stringify(path.join(ROOT, "src/lib/recommend/brewDeck.ts"))};
export { buildBrewerMenu } from ${JSON.stringify(path.join(ROOT, "src/lib/knowledge/recipes/menu.ts"))};
export { CANONICAL_EQUIPMENT, brewersAvailableFromEquipment } from ${JSON.stringify(path.join(ROOT, "src/lib/knowledge/recipes/helpers.ts"))};
export { COFFEE_HINTS } from ${JSON.stringify(path.join(ROOT, "src/lib/coffeeHints.ts"))};
`;
const out = path.join(ROOT, "node_modules/.cache/brew-deck/bundle.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
  external: ["pg", "pg-native", "drizzle-orm", "drizzle-orm/*", "@anthropic-ai/sdk"],
});
const M = await import(pathToFileURL(out).href);

const COFFEE = { roaster: "SEY", name: "Susan Meneses", origin: "Colombia", process: "Washed", variety: "Pink Bourbon", roastLevel: "Light", coffeeId: "sey__susan_meneses", aiExtracted: false };
const menu = () =>
  M.buildBrewerMenu({
    brewersAvailable: M.brewersAvailableFromEquipment(M.CANONICAL_EQUIPMENT),
    roastLevel: "light",
    process: "washed",
    goal: "clarity",
    occasion: "morning-ritual",
    targetWaterGrams: 350,
  });
const session = (rating, method) => ({
  id: `s-${rating}-${method}`,
  createdAt: "2026-10-10T07:00:00Z",
  mode: "home",
  coffee: { ...COFFEE },
  recommendation: { candidates: [{ method, recipe: { doseGrams: 20, waterGrams: 320, waterTempC: 93, grindSize: "x", targetTimeSec: 200, pourSteps: [] } }] },
  brew: { selectedCandidateIdx: 0, methodUsed: method, actualTimeSec: 200 },
  result: { rating, flavorNotes: [] },
});

/** A scripted Haiku: answers with whatever `reply` says, records the prompt. */
function fakeClient(reply) {
  const calls = [];
  return {
    calls,
    messages: {
      create: async (req) => {
        calls.push(req);
        return { content: [{ type: "text", text: typeof reply === "function" ? reply(req) : reply }] };
      },
    },
  };
}

test("the snippets are about THIS brew: the bag, his history with it, the leading brewers and their techniques", () => {
  const snippets = M.deckSnippets({ coffee: COFFEE, menu: menu(), pastSessions: [session(4, "V60"), session(3, "Orea Fast")], coffeeHistory: { writtenSummary: "Floral and silky when brewed gently." } });
  const kinds = snippets.map((s) => (typeof s.about === "string" ? s.about : Object.keys(s.about)[0]));
  assert.equal(kinds[0], "coffee");
  assert.equal(kinds[1], "history");
  assert.ok(kinds.filter((k) => k === "brewer").length === 3, kinds.join(","));
  assert.ok(kinds.filter((k) => k === "technique").length >= 1, kinds.join(","));
  assert.match(snippets[0].sourceText, /Pink Bourbon/);
  assert.match(snippets[1].sourceText, /brewed Susan Meneses 2 times at home, average rating 3\.5 of 5/);
  assert.match(snippets[1].sourceText, /best cup so far was 4 of 5 on the V60/);
  assert.match(snippets[1].sourceText, /Floral and silky/);
  const brewer = snippets.find((s) => typeof s.about === "object" && "brewer" in s.about);
  assert.match(brewer.sourceText, /Today's recipe on it: .+ What it teaches: /);
});

test("no history, no variety: the deck still has the brewers to talk about", () => {
  const snippets = M.deckSnippets({ coffee: { roaster: "X", name: "Y", aiExtracted: false }, menu: menu(), pastSessions: [] });
  assert.ok(snippets.every((s) => s.about !== "history"));
  assert.ok(snippets.some((s) => typeof s.about === "object" && "brewer" in s.about));
});

test("the gate: a line survives only when its numbers and names are in its own snippet; emoji, '!' and seed duplicates die", () => {
  const snippets = [
    { about: "coffee", sourceText: "Pink Bourbon is a Colombian variety prized for its floral cup." },
    { about: { brewer: "V60" }, sourceText: "V60: a cone among cones. Today's recipe on it: Kasuya 4:6 by Tetsu Kasuya." },
  ];
  const kept = M.gateDeckLines(
    [
      { n: 1, text: "Pink Bourbon is prized for its floral cup." }, // grounded
      { n: 1, text: "Pink Bourbon won the 2016 championship." }, // 2016 not in snippet
      { n: 2, text: "Kasuya's 4:6 is today's V60 recipe." }, // grounded
      { n: 2, text: "Today's V60 recipe is by Hoffmann." }, // Hoffmann not in snippet (a sentence-initial name is the gate's documented under-catch)
      { n: 2, text: "Kasuya pours five times!" }, // exclamation
      { n: 1, text: M.COFFEE_HINTS[0] }, // the seed already says it
      { n: 9, text: "orphan" }, // no such snippet
    ],
    snippets,
  );
  assert.deepEqual(kept.map((l) => l.text), ["Pink Bourbon is prized for its floral cup.", "Kasuya's 4:6 is today's V60 recipe."]);
  assert.deepEqual(kept.map((l) => l.about), ["coffee", { brewer: "V60" }]);
});

test("at most DECK_MAX_LINES lines, in the model's order", () => {
  const snippets = Array.from({ length: 10 }, (_, i) => ({ about: "coffee", sourceText: `fact number ${i} about the cup` }));
  const items = snippets.map((_, i) => ({ n: i + 1, text: `A fact about the cup, number ${i}.` }));
  const kept = M.gateDeckLines(items, snippets);
  assert.equal(kept.length, M.DECK_MAX_LINES);
  assert.equal(M.DECK_MAX_LINES, 6);
});

test("generateBrewDeck: one Haiku call over the numbered snippets, the gated lines back; a broken reply is an empty deck, never a throw", async () => {
  const client = fakeClient((req) => {
    assert.equal(req.model, "claude-haiku-4-5");
    assert.match(req.messages[0].content, /^SNIPPETS:\n\n\[1\] /);
    return 'Here you go: [{"n":1,"text":"Pink Bourbon is a Colombian variety with a floral cup."}]';
  });
  const lines = await M.generateBrewDeck({ coffee: COFFEE, menu: menu(), pastSessions: [], client });
  assert.equal(client.calls.length, 1);
  assert.deepEqual(lines, [{ text: "Pink Bourbon is a Colombian variety with a floral cup.", about: "coffee" }]);
  const broken = await M.generateBrewDeck({ coffee: COFFEE, menu: menu(), pastSessions: [], client: fakeClient("no json here") });
  assert.deepEqual(broken, []);
});

test("WIRING: the deck runs beside the Opus call, reaches the job store while running, the store, the watcher and both screens", async () => {
  const run = await readFile(path.join(ROOT, "src/lib/recommend/run.ts"), "utf8");
  assert.match(run, /const \[\{ recommendation, usage \}, deck\] = await Promise\.all\(\[\s*generateRecommendation\(/, "the recipe never waits for the deck");
  assert.match(run, /hooks\.onInsights\?\.\(lines\)/, "the deck is handed over the moment it exists");
  assert.match(run, /return deck\.length > 0 \? \{ \.\.\.withTerrain, insights: deck \} : withTerrain;/, "and persisted on the recommendation");
  assert.match(run, /catch \(err\) \{\s*console\.warn\("\[recommend\] deck failed \(recipe unaffected\)/, "a deck failure cannot fail the recipe");
  const start = await readFile(path.join(ROOT, "src/app/api/recommend/start/route.ts"), "utf8");
  assert.match(start, /runRecommendation\(body, \{ onInsights: \(lines\) => setInsights\(jobId, lines\) \}\)/);
  const status = await readFile(path.join(ROOT, "src/app/api/recommend/status/route.ts"), "utf8");
  assert.match(status, /NextResponse\.json\(\{ status: "running", insights \}\)/, "the crafting screen gets the deck before the recipe");
  assert.match(status, /NextResponse\.json\(\{ status: "done", recommendation: job\.recommendation, insights \}\)/);
  const watcher = await readFile(path.join(ROOT, "src/components/ui/light/RecommendJobWatcher.tsx"), "utf8");
  assert.match(watcher, /store\.setRecommendInsights\(data\.insights\)/);
  const store = await readFile(path.join(ROOT, "src/store/flowStore.ts"), "utf8");
  assert.match(store, /recommendInsights: DeckLine\[\];/);
  assert.match(store, /recommendInsights: \[\]/, "cleared with the job on reset");
  const screen = await readFile(path.join(ROOT, "src/components/flow/LightStepRecommend.tsx"), "utf8");
  assert.match(screen, /const brewLines = useFlowStore\(\(s\) => s\.recommendInsights\)/);
  assert.match(screen, /buildDeckQueue\(pendingBrew, pool, seen\)/, "brew lines lead the deck");
  assert.match(screen, /While you waited/, "the lines stay readable on the recipe screen");
  const types = await readFile(path.join(ROOT, "src/lib/types/session.ts"), "utf8");
  assert.match(types, /export interface Recommendation[\s\S]*insights\?: \{ text: string; about:/);
});
