// Speed round, 2026-10-03: the post-brew insight no longer starts from zero on
// the Summary screen. (1) The Escher terrain /recommend already computed rides
// on the recommendation and the brew-insight route REUSES it — the same Sonnet
// call used to run twice per brew. (2) The Log screen fires the request the
// moment Save is tapped, in parallel with the coach question, keyed to the
// draft it describes; the Summary consumes it when the key matches, else it
// falls back to its own request.
//
//   node --test tests/dataflow/early-brew-insight.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const entry = `
export { insightRequestKey } from ${JSON.stringify(path.join(ROOT, "src/lib/brew/insightKey.ts"))};
export { resolveTerrain } from ${JSON.stringify(path.join(ROOT, "src/lib/claude/insightTerrain.ts"))};
`;
const dir = await mkdtemp(join(tmpdir(), "ebi-"));
const out = join(dir, "m.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
  alias: { "@": path.join(ROOT, "src") },
});
const M = await import(pathToFileURL(out).href);

const result = { rating: 4, flavorNotes: ["citrus"], body: "medium", acidity: "high", clarity: "clean", freeNotes: "" };
const brew = { flow: "perfect", timing: "as-expected", grindSettingUsed: "380°" };
const coffee = { name: "Beshasha", roaster: "Friedhats", origin: "Ethiopia", process: "Washed" };
const sessions = [{}, {}, {}];

test("insightRequestKey: stable for the fields the route reads, blind to the coach answer and the vs-previous tap", () => {
  const k = M.insightRequestKey(result, brew);
  assert.equal(M.insightRequestKey({ ...result }, { ...brew }), k);
  assert.notEqual(M.insightRequestKey({ ...result, rating: 3 }, brew), k);
  assert.notEqual(M.insightRequestKey(result, { ...brew, flow: "too-slow" }), k);
  assert.equal(
    M.insightRequestKey(
      { ...result, coachAnswer: { question: "q", answer: "a" }, vsPrevious: "better", previousRating: 4 },
      brew,
    ),
    k,
    "an answer given AFTER the prefetch fired must not invalidate it",
  );
  assert.equal(M.insightRequestKey(undefined, brew), "");
});

test("resolveTerrain: a precomputed terrain short-circuits the builder; without one it builds (≥3 sessions); café brews get none", async () => {
  let calls = 0;
  const build = async () => {
    calls += 1;
    return "built terrain";
  };
  assert.equal(await M.resolveTerrain({ precomputed: "  from recommend  ", isExternal: false, sessions, coffee }, build), "from recommend");
  assert.equal(calls, 0, "the builder must NOT run when the terrain is already known");
  assert.equal(await M.resolveTerrain({ precomputed: "", isExternal: false, sessions, coffee }, build), "built terrain");
  assert.equal(calls, 1);
  assert.equal(await M.resolveTerrain({ isExternal: false, sessions: [{}], coffee }, build), null, "too little history");
  assert.equal(await M.resolveTerrain({ precomputed: "x", isExternal: true, sessions, coffee }, build), null, "café: no terrain");
  assert.equal(await M.resolveTerrain({ isExternal: false, sessions, coffee }, async () => { throw new Error("boom"); }), null);
  assert.equal(calls, 1);
});

test("CONSUMERS: run.ts attaches the terrain, the route reads it through resolveTerrain and keeps the server-side history read as fallback", async () => {
  const run = await readFile(path.join(ROOT, "src/lib/recommend/run.ts"), "utf8");
  assert.match(run, /return terrain \? \{ \.\.\.recommendation, terrain \} : recommendation;/);
  const types = await readFile(path.join(ROOT, "src/lib/types/session.ts"), "utf8");
  const rec = types.slice(types.indexOf("export interface Recommendation"), types.indexOf("export interface BrewLog"));
  assert.match(rec, /terrain\?: string;/);
  const route = await readFile(path.join(ROOT, "src/app/api/brew-insight/route.ts"), "utf8");
  assert.match(route, /const precomputed = isExternal \? undefined : rec\?\.terrain;/);
  assert.match(route, /const terrain = await resolveTerrain\(/);
  assert.match(route, /buildEscherTerrain,\n\s*\);/, "the real builder is injected");
  assert.match(route, /await loadRecentSessions\(60\)/, "the fallback history read stays (vs-previous pin)");
  assert.doesNotMatch(route, /await buildEscherTerrain\(/, "no direct terrain call left in the route");
});

test("CONSUMERS: the Log screen prefetches on Save under the key; the Summary consumes a matching prefetch and still owns the fallback request", async () => {
  const log = await readFile(path.join(ROOT, "src/components/flow/LightStepLog.tsx"), "utf8");
  assert.match(log, /const key = insightRequestKey\(provisional, committedBrew\)/);
  assert.match(log, /fetch\("\/api\/brew-insight"/);
  assert.match(log, /setPendingInsight\(\{ key, status: "loading"/);
  assert.match(log, /commitBrew\(\);\n\s*prefetchInsight\(buildResult\(\)\);/, "fired right after the brew is committed, before the coach question");
  const summary = await readFile(path.join(ROOT, "src/components/flow/LightStepSummary.tsx"), "utf8");
  assert.match(summary, /const insightKey = insightRequestKey\(draft\.result, draft\.brew\)/);
  assert.match(summary, /pending && pending\.key === insightKey/);
  assert.match(summary, /fetch\("\/api\/brew-insight"/, "the fallback request stays");
  assert.match(summary, /setPendingInsight\(null\);\n\s*setSavedOffline\(offline\);/, "cleared once the brew is saved");
  const store = await readFile(path.join(ROOT, "src/store/flowStore.ts"), "utf8");
  assert.equal((store.match(/pendingInsight: null/g) ?? []).length, 3, "initial state + reset + resumeColdBrew all clear it");
});
