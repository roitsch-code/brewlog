// The owner's MEASURED pour pace and the pauses it must not eat (2026-10-10).
//
//   node --test tests/dataflow/pour-pace.test.mjs
//
// "Who says my pace is 4 g/s?" — nobody measured it. POUR_RATE_GPS = 4 was set
// by hand in June 2026; the Acaia record (recommend-logs run 38057995770, 24
// scale brews) puts his median delivered rate at 2.35 g/s. And a pour timed at
// the house pace used to eat the rest after it (clamped at 0): Hoffmann's
// "10 s pour, 10 s pause" became a 20 s pour and no pause, three pulses one
// continuous pour. Owner decision: pours take his pace, pauses stay.

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const dir = await mkdtemp(join(tmpdir(), "pourpace-"));
const out = join(dir, "t.mjs");
await build({
  stdin: {
    contents: `
export { measuredPourPace, measuredPaceSamples, MIN_PACE_SAMPLES_BREWER, MIN_PACE_SAMPLES_ALL } from ${JSON.stringify(path.join(ROOT, "src/lib/brew/pourPace.ts"))};
export { applyPourDurations } from ${JSON.stringify(path.join(ROOT, "src/lib/recipe/pourDurations.ts"))};
export { housePourSec, POUR_RATE_GPS } from ${JSON.stringify(path.join(ROOT, "src/lib/utils/pourSequence.ts"))};
export { buildChatMeasuredBlock } from ${JSON.stringify(path.join(ROOT, "src/lib/chat/measuredContext.ts"))};
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
const M = await import(pathToFileURL(out).href);

// Every scale brew up to 2026-10-10 carries ONLY avgFlowRateGPS — grams ÷
// (reach − previous reach), rest INCLUDED. The first version of this module
// read that as the owner's pace (2.35 g/s median) and planned every pour
// nearly twice as long as he pours. Those sessions are the OLD record below
// and must be ignored; only avgPourRateGPS (the hand's rate, written since
// 2026-10-10) counts.
const OLD = [
  ["V60", 4], ["V60", 1.9], ["Orea Classic", 2.3], ["V60", 2.2], ["V60", 2.2], ["V60", 1.4], ["V60", 3.2],
  ["Origami (wave)", 2.5], ["V60", 4.4], ["Origami (wave)", 3.7], ["Orea Classic", 2.1], ["V60", 2.7],
];
const fa = (extra) => ({ perPour: [], samples: [], totalTimeSec: 0, targetTimeSec: 0, finalGrams: null, avgFlowRateGPS: null, peakFlowRateGPS: null, pourSteadiness: null, overshootG: null, derivedFlow: "perfect", ...extra });
const session = (method, flow, i) => ({
  id: `s${i}`, type: "brew", mode: "home", createdAt: "2026-10-01T08:00:00Z", createdAtMs: 1 + i,
  coffee: { roaster: "r", name: "n", origin: "", process: "Washed", roastLevel: "Light" },
  context: {}, brew: { methodUsed: method, flowAnalysis: fa(flow) },
  result: { rating: 4, flavorNotes: [] },
});
const OLD_SESSIONS = OLD.map(([m, g], i) => session(m, { avgFlowRateGPS: g }, i));
// The hand's rates the real reach times imply (bloom 90 g at 17.9 s ≈ 5 g/s,
// 72 g at 18 s ≈ 4, 70 g in ~14 s ≈ 5) — the shape of what the new field holds.
const NEW = [
  ["V60", 5], ["V60", 4], ["V60", 5.1], ["V60", 4.4], ["Orea Classic", 3.7], ["Origami (wave)", 4.6],
];
const SESSIONS = NEW.map(([m, g], i) => session(m, { avgPourRateGPS: g, avgFlowRateGPS: g / 2 }, 100 + i));

test("ANCHOR: the old rest-inclusive record is IGNORED — with no hand-rate data the pace is the house 4 g/s", () => {
  const p = M.measuredPourPace(OLD_SESSIONS, "V60");
  assert.deepEqual([p.source, p.gps, p.count], ["house", 4, 0]);
  assert.equal(M.measuredPaceSamples(OLD_SESSIONS).length, 0, "avgFlowRateGPS is never a pace sample");
});

test("the hand's rate (avgPourRateGPS) is what the pace reads: V60 median 4.7 g/s, all 4.5", () => {
  const p = M.measuredPourPace(SESSIONS, "V60");
  assert.equal(p.source, "measured-brewer");
  assert.equal(p.count, 4);
  assert.equal(p.gps, 4.7);
  const all = M.measuredPourPace(SESSIONS);
  assert.equal(all.source, "measured-all");
  assert.equal(all.gps, 4.5);
});

test("fewer than 3 brews on a brewer → the overall median; fewer than 5 overall → the house 4 g/s", () => {
  assert.equal(M.measuredPourPace(SESSIONS, "Orea Classic").source, "measured-all");
  const few = M.measuredPourPace(SESSIONS.slice(0, 2), "V60");
  assert.deepEqual([few.source, few.gps], ["house", M.POUR_RATE_GPS]);
  assert.equal(M.measuredPourPace([], "V60").gps, 4);
});

test("housePourSec takes the pace: 70 g at 2.7 g/s is 25 s, at 4 g/s 20 s (whole 5-second steps)", () => {
  assert.equal(M.housePourSec(70, 2.7), 25);
  assert.equal(M.housePourSec(70, 4), 20);
  assert.equal(M.housePourSec(70), 20, "no pace given = the house fallback");
});

// Hoffmann-shaped pulses at 350 g, as a chat writes them: 10 s pours, 10 s pauses.
const PULSES = {
  doseGrams: 21, waterGrams: 350, waterTempC: 94, grindSize: "380°", targetTimeSec: 200,
  pourSteps: [
    { label: "Bloom", action: "bloom", waterGramsAtEnd: 70, durationSec: 10 },
    { label: "Swirl", action: "swirl", durationSec: 5 },
    { label: "Rest", action: "wait", durationSec: 30 },
    { label: "Pulse 1", action: "pour", waterGramsAtEnd: 140, durationSec: 10 },
    { label: "Pause", action: "wait", durationSec: 10 },
    { label: "Pulse 2", action: "pour", waterGramsAtEnd: 210, durationSec: 10 },
    { label: "Pause", action: "wait", durationSec: 10 },
    { label: "Pulse 3", action: "pour", waterGramsAtEnd: 280, durationSec: 10 },
    { label: "Pause", action: "wait", durationSec: 10 },
    { label: "Pulse 4", action: "pour", waterGramsAtEnd: 350, durationSec: 10 },
  ],
};
const steps = (r) => r.pourSteps.map((s) => `${s.action}${s.waterGramsAtEnd ? ":" + s.waterGramsAtEnd : ""}@${s.durationSec}`).join(" ");

test("ANCHOR: pauses are never eaten — a longer pour pushes the next pour later", () => {
  const r = M.applyPourDurations(PULSES, { basedOn: "Own recipe", method: "V60", pourRateGPS: 2.7 }).recipe;
  assert.equal(steps(r), "bloom:70@25 swirl@5 wait@30 pour:140@25 wait@10 pour:210@25 wait@10 pour:280@25 wait@10 pour:350@25");
  const waits = r.pourSteps.filter((s) => s.action === "wait").map((s) => s.durationSec);
  assert.deepEqual(waits, [30, 10, 10, 10], "every authored pause survives at its own length");
});

test("a SHORTER pour hands its spare seconds to the rest, so the next pour starts where the recipe put it", () => {
  const slow = { ...PULSES, pourSteps: PULSES.pourSteps.map((s) => (s.action === "pour" ? { ...s, durationSec: 40 } : s)) };
  const r = M.applyPourDurations(slow, { basedOn: "Own recipe", method: "V60", pourRateGPS: 4 }).recipe;
  const waits = r.pourSteps.filter((s) => s.action === "wait").map((s) => s.durationSec);
  assert.deepEqual(waits, [30, 30, 30, 30], "40 s → 20 s pours give 20 s each to the following pause");
});

test("the chat's measured block carries the pace once it is measured, never the house fallback", () => {
  const block = M.buildChatMeasuredBlock(SESSIONS, []);
  assert.match(block, /MEASURED POUR PACE — the user delivers water at ~4\.5 g\/s/);
  assert.doesNotMatch(M.buildChatMeasuredBlock(SESSIONS.slice(0, 3), []), /MEASURED POUR PACE/);
  assert.doesNotMatch(M.buildChatMeasuredBlock(OLD_SESSIONS, []), /MEASURED POUR PACE/, "the old record never produces a pace line");
});

test("WIRING: /recommend and the chat time pours at the measured pace", async () => {
  const rec = await readFile(path.join(ROOT, "src/lib/claude/recommend.ts"), "utf8");
  assert.match(rec, /const pace = measuredPourPace\(pastSessions, c\.method\)/);
  assert.match(rec, /applyPourDurations\(c\.recipe, \{ basedOn: c\.basedOn, method: c\.method, pourRateGPS: pace\.gps \}\)/);
  const route = await readFile(path.join(ROOT, "src/app/api/explore-agent/route.ts"), "utf8");
  assert.match(route, /const pace = measuredPourPace\(sessions, action\.method\)/);
  assert.match(route, /cleanStartBrewRecipe\(action, pace\.gps\)/);
  const ctx = await readFile(path.join(ROOT, "src/lib/chat/agentContext.ts"), "utf8");
  assert.match(ctx, /applyPourDurations\(reconcileWaterToPourPlan\(out\), ctx\)/, "the chat cleaner passes its ctx (incl. pourRateGPS) through");
});
