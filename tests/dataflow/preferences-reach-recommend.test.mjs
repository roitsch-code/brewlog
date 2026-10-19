// 2026-10-19 — the owner's rewrite: preferences are INFORMATION the model
// weighs, never a filter; every brewer is on the table; the history is
// described, not enforced. Per the hard rule these run the REAL
// generateRecommendation with only the model call stubbed and read the user
// message the model would receive — the value must ARRIVE, not merely be built.
//
//   node --test tests/dataflow/preferences-reach-recommend.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const dir = await mkdtemp(join(tmpdir(), "prefs-"));

const STUB = `
export const calls = [];
export const opts = [];
export const queue = [];
export async function callRecommendModel(userMessage, o) {
  calls.push(userMessage);
  opts.push(o);
  const next = queue.length ? queue.shift() : { candidates: [] };
  return { text: JSON.stringify(next), usage: { input_tokens: 1, output_tokens: 1 }, provider: "anthropic" };
}
`;
const entry = `
export { generateRecommendation } from ${JSON.stringify(path.join(ROOT, "src/lib/claude/recommend.ts"))};
export * as stub from "recommend-stub";
export { SYSTEM_PROMPT } from ${JSON.stringify(path.join(ROOT, "src/lib/claude/recommendPrompt.ts"))};
export { BREWER_ROLES } from ${JSON.stringify(path.join(ROOT, "src/lib/knowledge/brewers.ts"))};
export { formatRecipeIndexBlock } from ${JSON.stringify(path.join(ROOT, "src/lib/knowledge/recipes/index.ts"))};
`;
const out = join(dir, "m.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
  alias: { "@": path.join(ROOT, "src") },
  plugins: [
    {
      name: "stub-model",
      setup(b) {
        b.onResolve({ filter: /recommendProvider$|^recommend-stub$/ }, () => ({ path: "recommend-stub", namespace: "stub" }));
        b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: STUB, loader: "js" }));
      },
    },
  ],
});
const M = await import(pathToFileURL(out).href);

const COFFEE = { roaster: "Sprout", name: "Vizinhos", origin: "Brazil", process: "Natural", roastLevel: "Light", aiExtracted: false };
const PREFS = { equipment: ["V60"], grinder: "Niche Zero", tasteProfile: { preferredBodyLevel: "medium", preferredAcidityLevel: "medium", avoidProcesses: ["Anaerobic"] } };
const ctx = (extra = {}) => ({ occasion: "morning-ritual", amount: "small", timeAvailable: "normal", moodPreference: "balanced", intent: "balanced", grinder: "", ...extra });
const pours = (water) => [
  { label: "Bloom", action: "bloom", waterGramsAtEnd: Math.round(water * 0.15), durationSec: 10 },
  { label: "Wait", action: "wait", durationSec: 30 },
  { label: "Pour 2", action: "pour", waterGramsAtEnd: Math.round(water * 0.6), durationSec: 20 },
  { label: "Wait", action: "wait", durationSec: 20 },
  { label: "Final", action: "final", waterGramsAtEnd: water, durationSec: 20 },
];
const cand = (title, method, basedOn, water = 350, extra = {}) => ({
  method, role: "anchor", title, basedOn, whyChosen: "fit", confidence: "high", experiment: title,
  recipe: { doseGrams: Math.round(water / 15), waterGrams: water, waterTempC: 94, grindSize: "390°", targetTimeSec: 240, pourSteps: pours(water) },
  ...extra,
});
const session = (method, rating, overrides = {}) => ({
  id: "s1", type: "coffee", mode: "home", createdAt: "2026-10-10T06:00:00Z", createdAtMs: Date.parse("2026-10-10T06:00:00Z"),
  coffee: COFFEE, context: ctx(),
  recommendation: { candidates: [cand("Base", method, "Own experiment"), cand("Other", "Clever Dripper", "Own experiment")], primaryMethod: method, reasoning: "", generatedAt: "" },
  brew: { methodUsed: method, selectedCandidateIdx: 0, actualTimeSec: 250, grindSettingUsed: "390°", actualTempC: 94 },
  result: { rating, flavorNotes: [], body: "medium", acidity: "medium" },
  ...overrides,
});

async function run(context, sessions = [], opts = {}, ...answers) {
  M.stub.calls.length = 0;
  M.stub.opts.length = 0;
  M.stub.queue.length = 0;
  M.stub.queue.push(...(answers.length ? answers : [{ candidates: [cand("A", "V60", "Own experiment"), cand("B", "Orea Fast", "Own experiment")] }]));
  const res = await M.generateRecommendation(COFFEE, context, PREFS, sessions, undefined, undefined, undefined, undefined, opts);
  return { rec: res.recommendation, calls: M.stub.calls.slice(), opts: M.stub.opts.slice(), usage: res.usage };
}

test("the user message carries HIS PREFERENCES as a paragraph to weigh, every brewer, and recency as information", async () => {
  const { calls, opts } = await run(ctx(), [session("V60", 4), session("Clever Dripper", 3, { id: "s2", createdAt: "2026-10-09T06:00:00Z", createdAtMs: Date.parse("2026-10-09T06:00:00Z") })]);
  assert.equal(calls.length, 1, "no repair round fires for history, repetition or Chemex");
  const msg = calls[0];
  assert.match(msg, /HIS PREFERENCES — information you weigh, never a rule you enforce/);
  assert.match(msg, /has not enjoyed Anaerobic so far/, "the saved profile's avoid list arrives as a preference");
  assert.match(msg, /YOUR BREWERS TODAY \(12\)/);
  for (const r of M.BREWER_ROLES.filter((x) => !x.coldOnly)) assert.match(msg, new RegExp(`\\n- ${r.method.replace(/[()]/g, "\\$&")} · `), `${r.method} line`);
  assert.match(msg, /- AeroPress · [^\n]*concentrate and add bypass water/);
  assert.match(msg, /- Moccamaster · [^\n]*needs at least 500 ml — not for 350 g/);
  assert.match(msg, /BREWER RECENCY over your last 2 brews — information, not a rule/);
  assert.match(msg, /THIS COFFEE'S LAST BREW WORKED \(4★/);
  assert.match(msg, /Two honest answers/);
  assert.match(msg, /The SECOND candidate is the exploration slot/);
  assert.match(msg, /Equipment available: V60, OreaV4, Origami, Kalita, CleverDripper, AeroPress, Moccamaster, Chemex, ColdBrewJar/, "the kit is the canonical kit, never the DB row's subset");
  assert.match(msg, /This is the default, not his pick — you may propose the Comandante with a reason/);
  // The cached index rides as a second system block, byte-identical to the module's.
  assert.deepEqual(opts[0], { cachedBlocks: [M.formatRecipeIndexBlock()] });
});

test("no rule language is left: neither the user message nor the system prompt forbids a brewer or a taste", async () => {
  const { calls } = await run(ctx({ amount: "big", timeAvailable: "special" }), [session("V60", 3)]);
  const msg = calls[0];
  for (const src of [msg, M.SYSTEM_PROMPT]) {
    assert.doesNotMatch(src, /FORBIDDEN|BANNED|NEVER recommend|avoid entirely|the only user-stated bias|must EARN|EXACTLY ONE CHANGE|RECENTLY RECOMMENDED|PORTFOLIO DIVERSITY|METHOD FIT & FRESHNESS|Repetition rule|server drops/);
    assert.doesNotMatch(src, /[Pp]rimary brewer: V60|travel grinder|emergency\/travel/);
  }
  assert.match(msg, /TIME: he picked the fast shot — about 3 minutes/);
  assert.match(msg, /THIS COFFEE'S LAST BREW MISSED \(3★/);
  assert.match(M.SYSTEM_PROMPT, /YOUR BREWERS — every one of them is on the table, equally/);
  assert.match(M.SYSTEM_PROMPT, /Origami \(cone\) — percolation; Origami Air S/);
  assert.match(M.SYSTEM_PROMPT, /COMANDANTE C40 MK2 — a real option at home, not only for the road/);
  assert.match(M.SYSTEM_PROMPT, /PROPOSING IT: you may add "grinderSuggestion"/);
});

test("a grinder the owner picked himself is said to be his pick; an excluded brewer still gets its repair; a locked brewer gets its own menu", async () => {
  const picked = await run(ctx({ grinder: "Comandante C40" }), [], {}, { candidates: [cand("A", "V60", "Own experiment", 350, { recipe: { doseGrams: 23, waterGrams: 350, waterTempC: 94, grindSize: "25 clicks", targetTimeSec: 240, pourSteps: pours(350) } })] });
  assert.match(picked.calls[0], /He picked this grinder himself for this brew — propose the other one \(grinderSuggestion\) only if you have a specific reason/);
  assert.doesNotMatch(picked.calls[0].slice(picked.calls[0].indexOf("YOUR BREWERS TODAY")), /Niche \d+°/, "the menu's reference grinds come in clicks on the Comandante");
  const locked = await run(ctx({ preferredMethod: "Orea Apex" }), [], {}, { candidates: [cand("A", "Orea Apex", "Own experiment"), cand("B", "Orea Apex", "Own experiment")] });
  assert.match(locked.calls[0], /YOUR BREWER TODAY — you locked Orea Apex/);
  assert.match(locked.calls[0], /LOCKED METHOD: "Orea Apex"/);
  assert.doesNotMatch(locked.calls[0], /\n- V60 · /, "a locked menu carries only the locked brewer");
});

test("the guard chain keeps physics and the owner's own rules only: over-capacity is dropped, an unlocked disc is stripped, nothing else", async () => {
  const { rec, calls } = await run(ctx({ amount: "big" }), [], {}, {
    candidates: [
      cand("Overflow", "AeroPress", "Own experiment", 450),
      cand("Disc", "V60 + Drip Assist", "Own experiment", 450),
      cand("Fine", "Kalita Wave", "Own experiment", 450),
    ],
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(rec.candidates.map((c) => c.method), ["Kalita Wave"], "the 450 g AeroPress overflows (physics); the unlocked disc candidate is dropped (owner rule, kept); the Kalita stays");
  const src = await readFile(path.join(ROOT, "src/lib/claude/recommend.ts"), "utf8");
  for (const gone of ["guardVolumeTarget", "findRepeatOffenders", "checkConvergence", "findReshown", "findTooFineChemex", "guardSpecialTime", "buildDiversityNote", "buildRecentRecipesNote", "capacityConstraint", "demoteBrewers", "serveVolumeMl", "vesselCannotServe"]) {
    assert.doesNotMatch(src, new RegExp(gone), `${gone} must be gone from the orchestrator`);
  }
  for (const kept of ["guardVesselCapacity", "stripProactiveDripAssist", "guardRecipeFidelity", "applyUserParams", "normalizeGrindToGrinder", "attachGrinderSuggestion"]) {
    assert.match(src, new RegExp(kept), `${kept} must stay`);
  }
});
