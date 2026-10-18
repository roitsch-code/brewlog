// PR C of the grind audit (2026-10-18): the owner's OWN grind slope from brews
// where he tapped Done at a dry bed, and the provenance label on every grind.
//
//   node --test tests/dataflow/grind-slope-provenance.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const dir = await mkdtemp(join(tmpdir(), "slope-"));
const out = join(dir, "m.mjs");
await build({
  stdin: {
    contents: `
export * from ${JSON.stringify(path.join(ROOT, "src/lib/claude/grindSlope.ts"))};
export { grindProvenanceOf } from ${JSON.stringify(path.join(ROOT, "src/lib/claude/grindProvenance.ts"))};
`,
    resolveDir: ROOT,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
  alias: { "@": path.join(ROOT, "src") },
});
const M = await import(pathToFileURL(out).href);

let n = 0;
const brew = ({ grind, total, water = 750, method = "Chemex", dry = true, coffee = "Vizinhos", date }) => ({
  id: `s${++n}`,
  createdAt: date ?? `2026-10-${String(18 + n).padStart(2, "0")}T08:00:00Z`,
  createdAtMs: n,
  mode: "home",
  type: "coffee",
  coffee: { roaster: "Sprout", name: coffee },
  context: {},
  recommendation: {
    candidates: [{ method, title: "t", role: "anchor", confidence: "high", whyChosen: "", recipe: { doseGrams: water / 15, waterGrams: water, waterTempC: 94, grindSize: grind, targetTimeSec: 300 } }],
    reasoning: "",
    generatedAt: "",
  },
  brew: { selectedCandidateIdx: 0, methodUsed: method, grindSettingUsed: grind, actualTimeSec: total, ...(dry ? { doneAtDryBed: true } : {}) },
  result: { rating: 4 },
});

test("only Done-at-dry-bed brews are measurements; older brews are never reinterpreted", () => {
  const ms = M.measuredBrews([brew({ grind: "400°", total: 440, dry: false }), brew({ grind: "410°", total: 380 })]);
  assert.equal(ms.length, 1);
  assert.equal(ms[0].deg, 410);
});

test("pairs: same coffee + brewer + batch, grinds ≥3° apart → s/° ; fewer than 2 pairs → no slope", () => {
  const a = brew({ grind: "400°", total: 440 });
  const b = brew({ grind: "412°", total: 344 });
  assert.equal(M.grindSlopeFor([a, b], "Chemex", 750), null, "one pair is not a slope");
  const c = brew({ grind: "420°", total: 280 });
  const slope = M.grindSlopeFor([a, b, c], "Chemex", 750);
  assert.ok(slope && slope.pairs.length === 3);
  // pairs: (400→412) -8 s/°, (400→420) -8 s/°, (412→420) -8 s/°
  assert.equal(slope.secPerDeg, -8);
  // a near-identical grind or another coffee is not a pair
  assert.equal(M.slopePairs(M.measuredBrews([brew({ grind: "400°", total: 440 }), brew({ grind: "401°", total: 430 })])).length, 0);
  assert.equal(M.slopePairs(M.measuredBrews([brew({ grind: "400°", total: 440 }), brew({ grind: "410°", total: 380, coffee: "Other" })])).length, 0);
});

test("interpolation to a target total from the newest measured brew", () => {
  const brews = [brew({ grind: "400°", total: 440 }), brew({ grind: "412°", total: 344 }), brew({ grind: "420°", total: 280 })];
  // newest = 420° → 280 s; target 300 s at -8 s/° → 420 + (300-280)/-8 = 417.5 → 418 (Math.round)
  const r = M.interpolateGrind(brews, "Chemex", 750, 300);
  assert.equal(r.deg, 418);
  assert.match(M.formatGrindSlopeBlock(brews, 750), /chemex at ~750 g: -8\.0 s per degree \(median of 3 pairs/);
  assert.equal(M.formatGrindSlopeBlock(brews.slice(0, 2), 750), "", "no block below 2 pairs");
});

test("grind provenance on a candidate", () => {
  const cand = (method, grindSize, waterGrams, basedOn) => ({ method, basedOn, recipe: { doseGrams: 20, waterGrams, waterTempC: 94, grindSize, targetTimeSec: 240 } });
  assert.equal(M.grindProvenanceOf(cand("V60", "380°", 250), { sessions: [] }), "v60-anchor");
  assert.equal(M.grindProvenanceOf(cand("V60", "400°", 500), { sessions: [] }), "v60-anchor");
  assert.equal(M.grindProvenanceOf(cand("Chemex", "415°", 750), { sessions: [] }), "measurement-brew");
  assert.equal(M.grindProvenanceOf(cand("Chemex", "415°", 750), { sessions: [], userGrind: "415" }), "user");
  assert.equal(
    M.grindProvenanceOf(cand("Chemex", "415°", 750), { sessions: [], computedWindows: [{ methodKey: "chemex", min: 410, max: 418 }] }),
    "measured",
  );
  // Stanica WAC 2024: the published 25 clicks → 387° at its own 225 g batch.
  assert.equal(M.grindProvenanceOf(cand("AeroPress", "387°", 225, "Stanica"), { sessions: [] }), "published");
});

test("WIRING: Done sets doneAtDryBed, the POST schema keeps it, recommend.ts prints the slope and labels the grind", async () => {
  const brewSrc = await readFile(path.join(ROOT, "src/components/flow/LightStepBrew.tsx"), "utf8");
  assert.match(brewSrc, /doneAtDryBed: true/);
  const route = await readFile(path.join(ROOT, "src/app/api/sessions/route.ts"), "utf8");
  assert.match(route, /doneAtDryBed: z\.boolean\(\)\.optional\(\)/);
  const rec = await readFile(path.join(ROOT, "src/lib/claude/recommend.ts"), "utf8");
  assert.match(rec, /\$\{measuredGrindBlock\}\$\{grindSlopeBlock\}/);
  assert.match(rec, /grindProvenance: grindProvenanceOf\(/);
  const ui = await readFile(path.join(ROOT, "src/components/flow/LightStepRecommend.tsx"), "utf8");
  assert.match(ui, /GRIND_PROVENANCE_LABEL\[active\.grindProvenance\]/);
});
