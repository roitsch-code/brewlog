// The shareable brew card (2026-11-08): the data a stranger with the same bag
// needs, built from a saved session — every number the brew's own, the grind
// described off the owner's MEASURED V60 anchor or the reference author's own
// words, the steps from the composed timeline. Also pins that the Field's
// structured layers (what the canvas paints) serialise to the exact CSS the
// app's background has always had.
//
//   node --test tests/dataflow/brew-card.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = process.cwd();
const entry = `
export { buildBrewCardData, buildCardGrind, describeGrindFromAnchor } from ${JSON.stringify(path.join(ROOT, "src/lib/share/brewCard.ts"))};
export { composeFieldGradient, composeFieldLayers } from ${JSON.stringify(path.join(ROOT, "src/lib/field/composeGradient.ts"))};
export { DEFAULT_FIELD_ZONES } from ${JSON.stringify(path.join(ROOT, "src/lib/field/defaultZones.ts"))};
export { CURATED_FIELDS } from ${JSON.stringify(path.join(ROOT, "src/lib/field/curatedFields.ts"))};
export { ALL_RECIPES } from ${JSON.stringify(path.join(ROOT, "src/lib/knowledge/recipes/index.ts"))};
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
        { method: "V60", title: "Three pours, open", basedOn: "Own recipe", recipe: { doseGrams: 20, waterGrams: 320, waterTempC: 93, grindSize: "392°", targetTimeSec: 200, timeline: TIMELINE }, role: "adjacent", whyChosen: "", confidence: "high" },
      ],
      reasoning: "",
    },
    brew: { selectedCandidateIdx: 1, methodUsed: "V60", actualTimeSec: 212, grindSettingUsed: "392°" },
    result: { rating: 4.5, flavorNotes: ["peach"], body: "medium", acidity: "bright" },
    ...over,
  };
}

test("the card carries the BREWED candidate's numbers, not the primary recipe or the other candidate", () => {
  const card = M.buildBrewCardData(session(), Date.parse("2026-11-08T07:00:00Z"));
  assert.ok(card);
  assert.equal(card.method, "V60");
  assert.equal(card.recipeName, "Three pours, open");
  assert.equal(card.doseG, 20);
  assert.equal(card.waterG, 320);
  assert.equal(card.tempC, 93);
  assert.equal(card.ratio, "1:16");
  assert.equal(card.roaster, "SEY");
  assert.equal(card.name, "Susan Meneses");
  assert.equal(card.originLine, "Colombia · Washed · Light roast");
  assert.equal(card.rating, 4.5);
  assert.equal(card.actualTime, "3:32");
  assert.equal(card.finish, "3:20");
});

test("the steps come from the composed timeline, with the clock and a drawdown row", () => {
  const card = M.buildBrewCardData(session(), Date.parse("2026-11-08T07:00:00Z"));
  assert.deepEqual(
    card.steps.map((s) => [s.at, s.label, s.detail]),
    [
      ["0:00", "Bloom", "+60 g → 60 g"],
      ["0:45", "Pour 2", "+140 g → 200 g"],
      ["1:35", "Final", "+120 g → 320 g"],
      ["2:00", "Drawdown", ""],
    ],
  );
});

test("grind: Niche degrees, clicks only inside the measured 23–29 span, description off the measured V60 anchor", () => {
  // 392° at 320 g: the anchor at 320 g is 380 + round(20·log2(320/250)) = 387 → +5 → "a touch coarser".
  const g = M.buildCardGrind({ grindSize: "392°", grinder: "Niche Zero", waterG: 320, method: "V60", basedOn: "Own recipe" });
  assert.equal(g.value, "392°");
  assert.equal(g.grinder, "Niche Zero");
  assert.equal(g.alsoOn, "27 clicks on a Comandante C40");
  assert.equal(g.description, "a touch coarser than a V60 pour-over grind");
  assert.equal(g.descriptionSource, "measured-anchor");

  // 380° at 250 g IS the anchor.
  assert.equal(M.describeGrindFromAnchor(380, 250), "a standard V60 pour-over grind");
  // 400° at 500 g is the owner's second measured point — the law lands on it.
  assert.equal(M.describeGrindFromAnchor(400, 500), "a standard V60 pour-over grind");
  assert.equal(M.describeGrindFromAnchor(420, 250), "clearly coarser than a V60 pour-over grind");
  assert.equal(M.describeGrindFromAnchor(362, 250), "clearly finer than a V60 pour-over grind");

  // 420° → 35 clicks: outside the measured span → no clicks line, never extrapolated.
  const far = M.buildCardGrind({ grindSize: "420°", grinder: "Niche Zero", waterG: 250, method: "V60", basedOn: undefined });
  assert.equal(far.alsoOn, undefined);

  // Comandante brew: clicks are the value; inside the span the Niche° is given.
  const c = M.buildCardGrind({ grindSize: "25 clicks", grinder: "Comandante C40", waterG: 250, method: "V60", basedOn: undefined });
  assert.equal(c.value, "25 clicks");
  assert.equal(c.grinder, "Comandante C40");
  assert.match(c.alsoOn, /° on a Niche Zero$/);
  const c30 = M.buildCardGrind({ grindSize: "30 clicks", grinder: "Comandante C40", waterG: 230, method: "AeroPress", basedOn: undefined });
  assert.equal(c30.alsoOn, undefined);
  assert.equal(c30.description, undefined, "no Niche° → no anchor-relative line");
});

test("grind: a reference's own published description wins when the brew is that recipe on that brewer at that size", () => {
  const ref = M.ALL_RECIPES.find((r) => r.grind?.description && r.verified && r.water?.grams && /v60/i.test(r.brewer));
  assert.ok(ref, "corpus has a verified V60 recipe with a grind description");
  const g = M.buildCardGrind({ grindSize: "385°", grinder: "Niche Zero", waterG: ref.water.grams, method: "V60", basedOn: ref.name });
  assert.equal(g.description, ref.grind.description.trim());
  assert.equal(g.descriptionSource, "author");
  // Same reference, far outside its batch window → the author's words no longer apply.
  const off = M.buildCardGrind({ grindSize: "385°", grinder: "Niche Zero", waterG: ref.water.grams * 2.5, method: "V60", basedOn: ref.name });
  assert.equal(off.descriptionSource, "measured-anchor");
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
  assert.equal(card.actualTime, undefined);

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
    // Every radial colour carries an alpha the painter can fade from.
    for (const r of layers.radials) assert.match(r.color, /^hsl\(.+ \/ [\d.]+\)$/);
  }
  assert.equal(M.composeFieldLayers({ version: 1, zones: [], modifiers: { saturation: 0, lightness: 0 }, source: "default", computedAt: "" }, 0), null);
});
