// The shareable brew card (2026-11-08): the little a stranger with the same bag
// needs, built from a saved session — every number the brew's own, the grind
// as ONE of five words with the chart's comparison (anchored on the owner's
// MEASURED V60 setting), the steps from the composed timeline. No grinder
// numbers, no footnotes, no rating (owner, 2026-11-08). Also pins that the
// Field's structured layers (what the canvas paints) serialise to the exact
// CSS the app's background has always had.
//
//   node --test tests/dataflow/brew-card.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = process.cwd();
const entry = `
export { buildBrewCardData, buildCardGrind, grindWordsFromAnchor, nicheDegreesOf } from ${JSON.stringify(path.join(ROOT, "src/lib/share/brewCard.ts"))};
export { composeFieldGradient, composeFieldLayers } from ${JSON.stringify(path.join(ROOT, "src/lib/field/composeGradient.ts"))};
export { DEFAULT_FIELD_ZONES } from ${JSON.stringify(path.join(ROOT, "src/lib/field/defaultZones.ts"))};
export { CURATED_FIELDS } from ${JSON.stringify(path.join(ROOT, "src/lib/field/curatedFields.ts"))};
`;
const out = path.join(ROOT, "node_modules/.cache/brew-card/bundle.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
  external: ["pg", "pg-native", "drizzle-orm", "drizzle-orm/*"],
});
const M = await import(pathToFileURL(out).href);

const TIMELINE = {
  shape: "percolation",
  steps: [
    { label: "Bloom", action: "bloom", startSec: 0, pourSec: 10, restSec: 35, gramsAtEnd: 60, pourGrams: 60 },
    { label: "Pour 2", action: "pour", startSec: 45, pourSec: 30, restSec: 20, gramsAtEnd: 200, pourGrams: 140 },
    { label: "Final", action: "final", startSec: 95, pourSec: 25, restSec: 80, gramsAtEnd: 320, pourGrams: 120 },
  ],
  pourPhaseEndSec: 120,
  drawdownSec: 80,
  drawdownSource: "measured",
  drawdownBasis: "his brews",
  cadenceSource: "model",
  finishSec: 200,
  composedAt: "2026-11-08T07:00:00.000Z",
};

function session(over = {}) {
  return {
    id: "s1",
    createdAt: "2026-11-07T06:30:00.000Z",
    createdAtMs: 1,
    mode: "home",
    coffee: { roaster: "SEY", name: "Susan Meneses", origin: "Colombia", process: "Washed", roastLevel: "Light", aiExtracted: false, coffeeId: "sey__susan_meneses" },
    context: { occasion: "morning-ritual", amount: "small", timeAvailable: "normal", moodPreference: "balanced", grinder: "Niche Zero" },
    recommendation: {
      primaryMethod: "V60",
      primaryRecipe: { doseGrams: 20, waterGrams: 320, waterTempC: 93, grindSize: "392°", targetTimeSec: 200, timeline: TIMELINE },
      candidates: [
        { method: "Orea Fast", title: "Wrong one", recipe: { doseGrams: 15, waterGrams: 250, waterTempC: 90, grindSize: "380°", targetTimeSec: 150 }, role: "anchor", whyChosen: "", confidence: "high" },
        { method: "V60", title: "Three pours, open", basedOn: "Kasuya 4:6", recipe: { doseGrams: 20, waterGrams: 320, waterTempC: 93, grindSize: "392°", targetTimeSec: 200, timeline: TIMELINE }, role: "adjacent", whyChosen: "", confidence: "high" },
      ],
      reasoning: "",
    },
    brew: { selectedCandidateIdx: 1, methodUsed: "V60", actualTimeSec: 212, grindSettingUsed: "392°" },
    result: { rating: 4.5, flavorNotes: ["peach"], body: "medium", acidity: "bright" },
    ...over,
  };
}

test("the card carries the BREWED candidate's numbers, not the primary recipe or the other candidate — and nothing else", () => {
  const card = M.buildBrewCardData(session(), Date.parse("2026-11-08T07:00:00Z"));
  assert.ok(card);
  assert.equal(card.method, "V60");
  assert.equal(card.subtitle, "After Kasuya 4:6");
  assert.equal(card.doseG, 20);
  assert.equal(card.waterG, 320);
  assert.equal(card.tempC, 93);
  assert.equal(card.ratio, "1:16");
  assert.equal(card.roaster, "SEY");
  assert.equal(card.name, "Susan Meneses");
  assert.equal(card.finish, "3:20");
  // Owner, 2026-11-08: no rating, no actual time, no origin line, no date, no footnotes.
  for (const gone of ["rating", "actualTime", "originLine", "recipeName", "date"]) assert.ok(!(gone in card), `${gone} is back on the card`);
  assert.deepEqual(Object.keys(card.grind).sort(), ["like", "word"]);
  // "Own recipe" is not a reference → the subtitle is the brew's own name, so the line is always there.
  const own = M.buildBrewCardData(session({ recommendation: { ...session().recommendation, candidates: [session().recommendation.candidates[0], { ...session().recommendation.candidates[1], basedOn: "Own recipe" }] } }));
  assert.equal(own.subtitle, "Three pours, open");
});

test("the steps come from the composed timeline, with the clock and a drawdown row", () => {
  const card = M.buildBrewCardData(session(), Date.parse("2026-11-08T07:00:00Z"));
  assert.deepEqual(
    card.steps.map((s) => [s.at, s.label, s.detail]),
    [
      ["0:00", "Bloom", "+60g → 60g"],
      ["0:45", "Pour 2", "+140g → 200g"],
      ["1:35", "Final", "+120g → 320g"],
      ["2:00", "Drawdown", ""],
    ],
  );
});

test("a corpus label's own \"(→ 50g)\" tail is dropped when the grams column shows it", () => {
  const rec = session().recommendation;
  const tl = { ...TIMELINE, steps: [{ ...TIMELINE.steps[0], label: "Bloom (→ 60g)" }, ...TIMELINE.steps.slice(1)] };
  const s = session({ recommendation: { ...rec, candidates: [rec.candidates[0], { ...rec.candidates[1], recipe: { ...rec.candidates[1].recipe, timeline: tl } }] } });
  const card = M.buildBrewCardData(s, Date.parse("2026-11-08T07:00:00Z"));
  assert.deepEqual([card.steps[0].label, card.steps[0].detail], ["Bloom", "+60g → 60g"]);
});

test("a swirl or stir is its own row at its clock position, without grams", () => {
  const withSwirl = {
    ...TIMELINE,
    steps: [
      TIMELINE.steps[0],
      { label: "Swirl", action: "swirl", startSec: 10, pourSec: 5, restSec: 30 },
      ...TIMELINE.steps.slice(1),
    ],
  };
  const rec = session().recommendation;
  const s = session({ recommendation: { ...rec, candidates: [rec.candidates[0], { ...rec.candidates[1], recipe: { ...rec.candidates[1].recipe, timeline: withSwirl } }] } });
  const card = M.buildBrewCardData(s, Date.parse("2026-11-08T07:00:00Z"));
  const swirl = card.steps.find((st) => st.label === "Swirl");
  assert.ok(swirl, `no swirl row: ${JSON.stringify(card.steps)}`);
  assert.equal(swirl.at, "0:10");
  assert.equal(swirl.detail, "");
  // Immersion: the Clever's stir is a row too.
  const clever = M.buildBrewCardData(session({
    recommendation: { primaryMethod: "Clever", primaryRecipe: { doseGrams: 18, waterGrams: 300, waterTempC: 92, grindSize: "410°", targetTimeSec: 240, pourSteps: [
      { label: "Pour all", action: "pour", waterGramsAtEnd: 300, durationSec: 30 },
      { label: "Add the coffee, stir", action: "stir", durationSec: 10 },
      { label: "Steep", action: "wait", durationSec: 150 },
      { label: "Drain", action: "drain", durationSec: 60 },
    ] }, candidates: [], reasoning: "" },
    brew: { methodUsed: "Clever Dripper" },
  }), Date.parse("2026-11-08T07:00:00Z"));
  assert.ok(clever.steps.some((st) => /stir/i.test(st.label) && st.at === "0:30"), JSON.stringify(clever.steps));
});

test("grind: one of five words with the chart's comparison, anchored on the measured V60 setting", () => {
  // The measured points themselves are a V60 pour-over grind: Medium, like sand.
  assert.deepEqual(M.grindWordsFromAnchor(380, 250), { word: "Medium", like: "like sand" });
  assert.deepEqual(M.grindWordsFromAnchor(400, 500), { word: "Medium", like: "like sand" });
  // 392° at 320 g: the anchor there is 387° → +5 → still Medium.
  assert.equal(M.buildCardGrind({ grindSize: "392°", grinder: "Niche Zero", waterG: 320 }).word, "Medium");
  assert.deepEqual(M.grindWordsFromAnchor(395, 250), { word: "Coarse", like: "like sea salt" });
  assert.deepEqual(M.grindWordsFromAnchor(430, 250), { word: "Very coarse", like: "like crushed peppercorns" });
  assert.deepEqual(M.grindWordsFromAnchor(365, 250), { word: "Fine", like: "like table salt" });
  assert.deepEqual(M.grindWordsFromAnchor(330, 250), { word: "Very fine", like: "like flour" });

  // Comandante clicks: placed only inside the measured 23–29 span.
  assert.equal(M.nicheDegreesOf("25 clicks", "Comandante C40"), 387);
  assert.equal(M.nicheDegreesOf("30 clicks", "Comandante C40"), null);
  assert.equal(M.buildCardGrind({ grindSize: "30 clicks", grinder: "Comandante C40", waterG: 230 }), undefined);
  assert.equal(M.buildCardGrind({ grindSize: "", grinder: "Niche Zero", waterG: 250 }), undefined);
});

test("an immersion brew lists its setup and steps; a session without a recipe yields no card", () => {
  const s = session({
    recommendation: {
      primaryMethod: "Clever",
      primaryRecipe: {
        doseGrams: 18, waterGrams: 300, waterTempC: 92, grindSize: "410°", targetTimeSec: 240,
        pourSteps: [
          { label: "Pour all", action: "pour", waterGramsAtEnd: 300, durationSec: 30 },
          { label: "Steep", action: "wait", durationSec: 150 },
          { label: "Drain", action: "drain", durationSec: 60 },
        ],
      },
      candidates: [],
      reasoning: "",
    },
    brew: { methodUsed: "Clever Dripper" },
  });
  const card = M.buildBrewCardData(s, Date.parse("2026-11-08T07:00:00Z"));
  assert.ok(card);
  assert.ok(card.steps.length >= 3, `steps: ${JSON.stringify(card.steps)}`);
  assert.ok(card.steps.some((st) => /steep/i.test(st.label)));
  assert.equal(card.grind.word, "Coarse");

  assert.equal(M.buildBrewCardData(session({ recommendation: undefined, brew: undefined })), null);
});

test("Field layers serialise to the exact CSS string the app's background has always had", () => {
  // The canvas painter draws composeFieldLayers; the app paints composeFieldGradient.
  // Pinned against the string captured on main before the refactor.
  assert.equal(
    M.composeFieldGradient(M.DEFAULT_FIELD_ZONES, 0),
    "radial-gradient(ellipse 78% 50% at 58% 20%, hsl(338 38% 90% / 0.55) 0%, transparent 60%), radial-gradient(circle at 88% 24%, hsl(40 94% 72% / 0.88) 0%, transparent 66%), radial-gradient(circle at 16% 86%, hsl(338 90% 79% / 0.97) 0%, transparent 72%), linear-gradient(118deg, hsl(338 86% 76%) 0%, hsl(40 91% 69%) 58%, hsl(15 94% 79%) 100%)",
  );
  for (const z of [M.DEFAULT_FIELD_ZONES, ...M.CURATED_FIELDS]) {
    const layers = M.composeFieldLayers(z, 25);
    assert.equal(layers.radials.length, 3);
    assert.equal(layers.base.stops.length, 3);
    for (const r of layers.radials) assert.match(r.color, /^hsl\(.+ \/ [\d.]+\)$/);
  }
  assert.equal(M.composeFieldLayers({ version: 1, zones: [], modifiers: { saturation: 0, lightness: 0 }, source: "default", computedAt: "" }, 0), null);
});
