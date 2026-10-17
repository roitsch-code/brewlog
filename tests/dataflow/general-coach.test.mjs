// The Taste Profile coach is a GENERAL coach (2026-10-17): technique, habits
// and taste preferences across the whole log, never advice about one bag.
//
//   node --test tests/dataflow/general-coach.test.mjs
//
// Three things are pinned: the prompt's substance (the model is told to coach
// the person and forbidden to write about a single coffee), the evidence block
// (every number counted from sessions, and a preference bucket can never be
// one bag in disguise), and the wiring (the block is interpolated into the
// coach's user message, and rows written under the old prompt force one
// regeneration instead of being served until the next brew).

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const CACHE = join(ROOT, "node_modules", ".cache", "brewlog-tests");
await mkdir(CACHE, { recursive: true });

async function load(rel, names) {
  const entry = `export { ${names.join(", ")} } from ${JSON.stringify(path.join(ROOT, rel))};`;
  const dir = await mkdtemp(join(CACHE, "gcoach-"));
  const out = join(dir, "b.mjs");
  await build({
    stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
    bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "silent",
    external: ["pg", "pg-native", "drizzle-orm", "drizzle-orm/*"],
  });
  return import(pathToFileURL(out).href);
}

const { formatTechniqueSummary } = await load("src/lib/claude/techniqueSummary.ts", ["formatTechniqueSummary"]);
const insightsSrc = await readFile(path.join(ROOT, "src/lib/claude/insights.ts"), "utf8");
const promptStart = insightsSrc.indexOf("const SYSTEM_PROMPT = `");
const promptEnd = insightsSrc.indexOf("`;", promptStart);
const PROMPT = insightsSrc.slice(promptStart, promptEnd);

let seq = 0;
function session({
  rating = 4, roaster = "Friedhats", name = "Guji", origin = "Ethiopia", process = "Washed",
  method = "V60", cv, rate, overshoot, timing, followed, attribution, actual, target, water,
} = {}) {
  seq += 1;
  const flowAnalysis = cv != null || rate != null || overshoot != null
    ? { totalTimeSec: 200, targetTimeSec: 210, finalGrams: 250, perPour: [], avgFlowRateGPS: 2.4,
        avgPourRateGPS: rate ?? null, peakFlowRateGPS: 6, pourSteadiness: cv ?? null,
        overshootG: overshoot ?? null, derivedFlow: "perfect", samples: [] }
    : undefined;
  return {
    id: `s${seq}`,
    createdAt: new Date(1735689600000 + seq * 86400000).toISOString(),
    coffee: { roaster, name, origin, process, roastLevel: "Light" },
    context: { occasion: "morning-ritual", waterSource: water },
    recommendation: { primaryMethod: method, primaryRecipe: { targetTimeSec: target ?? 210 } },
    brew: { methodUsed: method, actualTimeSec: actual ?? 205, timing, followedRecipe: followed, flowAnalysis },
    result: { rating, flavorNotes: ["citrus"], attribution },
  };
}

test("prompt — coaches the person, forbids single-coffee insights, drops the old multivariate rule", () => {
  assert.ok(promptStart > 0 && promptEnd > promptStart, "SYSTEM_PROMPT not found");
  for (const needle of [
    "You coach the person, not a bag of coffee",
    "An insight is never about a single bag, roaster or coffee",
    "Technique: how they pour",
    "Taste preferences: what kinds of coffee they keep rating high or low",
    "selection-biased",
    "Every observation cites at least one real count",
  ]) {
    assert.ok(PROMPT.includes(needle), `prompt lost: ${needle}`);
  }
  for (const gone of ["Single-axis observations", "Open the Hoppenworth Geisha", "Would the Tegu", "TWO OR MORE axes"]) {
    assert.ok(!PROMPT.includes(gone), `old per-coffee prompt text still present: ${gone}`);
  }
  assert.match(insightsSrc, /none about a single coffee\. JSON only\./, "the closing instruction must repeat the rule");
});

test("evidence — pour steadiness, pace, overshoot, timing, adherence and blame are COUNTED from sessions", () => {
  const list = [
    session({ cv: 0.1, rate: 4.2, rating: 5, timing: "as-expected", followed: true }),
    session({ cv: 0.12, rate: 4.5, rating: 4, timing: "as-expected", followed: true }),
    session({ cv: 0.4, rate: 6.1, rating: 3, timing: "faster", followed: false, attribution: "brew", overshoot: 22 }),
    session({ cv: 0.5, rate: 6.8, rating: 3, timing: "faster", followed: false, attribution: "brew", overshoot: 30 }),
    session({ cv: 0.2, rate: 5.0, rating: 4, timing: "slower", followed: true, attribution: "recipe" }),
  ];
  const block = formatTechniqueSummary(list);
  assert.match(block, /^── Measured technique, habits and preferences \(counted from the log\) ──/);
  assert.match(block, /Scale-measured brews: 5 of 5\./);
  assert.match(block, /2 even, 1 in between, 2 uneven; median CV 0\.20\./);
  assert.match(block, /Rating when the pour was even: 4\.5★ over 2; when uneven: 3\.0★ over 2\./);
  assert.match(block, /median 5\.0 g\/s, range 4\.2–6\.8 g\/s over 5 brews/);
  assert.match(block, /Ran more than 15 g ahead of the plan in 2 of 5 measured brews \(those average 3\.0★, the rest 4\.3★\)/);
  assert.match(block, /Own timing verdicts over 5 brews: 2 as expected \(4\.5★\), 2 faster than planned \(3\.0★\), 1 slower than planned \(4\.0★\)\./);
  assert.match(block, /Recipe adherence: 3 followed as written \(4\.3★\), 2 changed something \(3\.0★\)\./);
  assert.match(block, /What held a low-rated cup back \(his own verdict, 3 cups\): own execution 2, the recipe 1\./);
  assert.match(block, /Actual minus planned brew time, median per brewer: .*-5 s \(n=5\)/);
});

test("evidence — a preference bucket needs ≥2 different bags; one bag brewed often is NOT a preference", () => {
  // Five washed brews of ONE bag + three natural brews of one other bag: the
  // process line must not appear (each bucket is a single bag).
  const oneBagEach = [
    ...[5, 4, 4, 5, 4].map((rating) => session({ rating, process: "Washed" })),
    ...[3, 3, 4].map((rating) => session({ rating, process: "Natural", name: "Berry Swirl", roaster: "DAK" })),
  ];
  assert.ok(!/By process/.test(formatTechniqueSummary(oneBagEach)), "a single-bag bucket leaked into the preference lines");

  // Washed across two Central American bags vs natural across two bags.
  const spread = [
    session({ rating: 5, process: "Washed", origin: "Colombia", name: "Finca A", roaster: "R1" }),
    session({ rating: 4, process: "Washed", origin: "Colombia", name: "Finca A", roaster: "R1" }),
    session({ rating: 4, process: "Washed", origin: "Guatemala", name: "Finca B", roaster: "R2" }),
    session({ rating: 5, process: "Washed", origin: "Guatemala", name: "Finca B", roaster: "R2" }),
    session({ rating: 3, process: "Natural", origin: "Ethiopia", name: "Guji", roaster: "R3" }),
    session({ rating: 3, process: "Natural", origin: "Ethiopia", name: "Sidamo", roaster: "R3" }),
    session({ rating: 4, process: "Natural", origin: "Ethiopia", name: "Sidamo", roaster: "R3" }),
  ];
  const block = formatTechniqueSummary(spread);
  assert.match(block, /every bucket spans at least two different bags/);
  assert.match(block, /By process: washed 4\.5★ \(4 of 4 brews 4★\+, 2 bags\); natural 3\.3★ \(1 of 3 brews 4★\+, 2 bags\)/);
  // Origin: Colombia and Guatemala are one bag each → dropped; Ethiopia alone is one bucket → no line.
  assert.ok(!/By origin/.test(block), "origin buckets with one bag each must not be reported");
});

test("evidence — nothing measurable → empty string, never a header over nothing", () => {
  assert.equal(formatTechniqueSummary([]), "");
  assert.equal(formatTechniqueSummary([{ id: "x", createdAt: new Date().toISOString(), coffee: { name: "A" }, result: { rating: 4 } }]), "");
});

test("WIRING — the evidence block is in the coach's user message; old-prompt rows force one regeneration", () => {
  assert.match(insightsSrc, /import \{ formatTechniqueSummary \} from "\.\/techniqueSummary"/);
  const promptSections = insightsSrc.slice(insightsSrc.indexOf("const promptSections = ["), insightsSrc.indexOf("const userMessage"));
  assert.match(promptSections, /formatTechniqueSummary\(sessionList\),/, "the block must be interpolated into promptSections");
  assert.match(insightsSrc, /export const COACH_PROMPT_CHANGED_AT_MS = Date\.parse\("2026-10-17T00:00:00Z"\)/);
  assert.match(
    insightsSrc,
    /r\.source === "opus" && r\.status === "new" && r\.createdAt\.getTime\(\) < COACH_PROMPT_CHANGED_AT_MS/,
    "replaceable rows older than the prompt change must mark the cache stale",
  );
  assert.match(insightsSrc, /&& !writtenByOldPrompt\) \{/, "the cache short-circuit must honour the staleness flag");
});
