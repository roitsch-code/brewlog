// The timeline a brew ran against is SNAPSHOTTED on Done (brew.timeline,
// 2026-10-19) and read back as the pour-phase end of that brew — so a later
// change to the renderer can never move the owner's historical drawdowns, and
// a session saved before the snapshot still reads through the legacy render.
//
//   node --test tests/dataflow/timeline-snapshot.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const entry = `
export { pourPhaseEndOf, measuredDrawdownSamples } from ${JSON.stringify(path.join(ROOT, "src/lib/brew/drawdown.ts"))};
`;
const out = path.join(ROOT, "node_modules/.cache/timeline-snapshot/bundle.mjs");
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

const RECIPE = {
  doseGrams: 20, waterGrams: 320, waterTempC: 93, grindSize: "x", targetTimeSec: 200,
  pourSteps: [
    { label: "Bloom", action: "bloom", waterGramsAtEnd: 60, durationSec: 10 },
    { label: "Rest", action: "wait", durationSec: 35 },
    { label: "Pour 2", action: "pour", waterGramsAtEnd: 200, durationSec: 30 },
    { label: "Rest", action: "wait", durationSec: 20 },
    { label: "Final", action: "final", waterGramsAtEnd: 320, durationSec: 25 },
  ],
};
const SNAPSHOT = {
  shape: "percolation",
  steps: [
    { label: "Bloom", action: "bloom", startSec: 0, pourSec: 10, restSec: 35, gramsAtEnd: 60, pourGrams: 60 },
    { label: "Pour 2", action: "pour", startSec: 45, pourSec: 30, restSec: 20, gramsAtEnd: 200, pourGrams: 140 },
    { label: "Final", action: "final", startSec: 95, pourSec: 25, restSec: 70, gramsAtEnd: 320, pourGrams: 120 },
  ],
  pourPhaseEndSec: 120,
  drawdownSec: 70,
  drawdownSource: "estimate",
  drawdownBasis: "test",
  cadenceSource: "model",
  finishSec: 190,
  composedAt: "2026-10-19T07:00:00Z",
};
const session = (brew, createdAt = "2026-10-19T07:10:00Z") => ({
  id: `s-${createdAt}`,
  createdAt,
  coffee: { name: "x", roaster: "y", roastDate: "2026-10-05" },
  recommendation: { candidates: [{ method: "V60", recipe: RECIPE }] },
  brew: { selectedCandidateIdx: 0, methodUsed: "V60", actualTimeSec: 205, ...brew },
});

test("the snapshot decides the pour-phase end — not a re-render with today's renderer", () => {
  const withSnap = session({ timeline: SNAPSHOT });
  assert.equal(M.pourPhaseEndOf(withSnap, RECIPE, "V60"), 120);
  // The same recipe, with a snapshot that says the pours ended later: the
  // snapshot wins, whatever the renderer would say now.
  const later = session({ timeline: { ...SNAPSHOT, pourPhaseEndSec: 140 } });
  assert.equal(M.pourPhaseEndOf(later, RECIPE, "V60"), 140);
});

test("a measured drawdown is actualTimeSec minus the SNAPSHOTTED pour end", () => {
  const s = session({ timeline: SNAPSHOT });
  const samples = M.measuredDrawdownSamples([s], "V60", 320);
  assert.equal(samples.length, 1);
  assert.equal(samples[0].drawdownSec, 205 - 120);
  assert.equal(samples[0].ageBucket, "peak", "brewed 14 days after roast");
});

test("the scale's last-gram reach still beats the snapshot (the bed, not the plan), plus any trailing swirl the snapshot has", () => {
  const s = session({ timeline: SNAPSHOT, flowAnalysis: { avgPourRateGPS: 4.5, perPour: [{ label: "Final", actualSec: 131 }] } });
  assert.equal(M.pourPhaseEndOf(s, RECIPE, "V60"), 131);
  const withSwirl = session({
    timeline: { ...SNAPSHOT, pourPhaseEndSec: 125, steps: [...SNAPSHOT.steps, { label: "Swirl", action: "swirl", startSec: 120, pourSec: 5, restSec: 65 }] },
    flowAnalysis: { avgPourRateGPS: 4.5, perPour: [{ label: "Final", actualSec: 131 }] },
  });
  assert.equal(M.pourPhaseEndOf(withSwirl, RECIPE, "V60"), 136, "131 + the 5 s swirl after the last gram");
});

test("a session from before the snapshot reads through the LEGACY render; one from before the cadence-first renderer is not used", () => {
  const legacy = session({}, "2026-10-10T07:00:00Z");
  const end = M.pourPhaseEndOf(legacy, RECIPE, "V60");
  assert.ok(typeof end === "number" && end > 0, "a cadence-first session still measures");
  const ancient = session({}, "2026-09-01T07:00:00Z");
  assert.equal(M.pourPhaseEndOf(ancient, RECIPE, "V60"), null);
});

test("WIRING: the sessions POST keeps brew.timeline, the brew screen snapshots it on Done, and the parity guard covers the type", async () => {
  const route = await readFile(path.join(ROOT, "src/app/api/sessions/route.ts"), "utf8");
  assert.match(route, /timeline: z\s*\n?\s*\.custom<RecipeTimeline>/, "zod would otherwise strip the field silently");
  assert.match(route, /MissingKeys<BrewLog, NonNullable<SessionPost\["brew"\]>>/, "tsc names a BrewLog key the schema forgets");
  const types = await readFile(path.join(ROOT, "src/lib/types/session.ts"), "utf8");
  assert.match(types, /export interface BrewLog[\s\S]*timeline\?: RecipeTimeline/);
  assert.match(types, /export interface BrewRecipe[\s\S]*timeline\?: RecipeTimeline/);
  const brew = await readFile(path.join(ROOT, "src/components/flow/LightStepBrew.tsx"), "utf8");
  assert.match(brew, /recipe\?\.timeline \? \{ timeline: recipe\.timeline \} : \{\}/, "Done writes the timeline the brew ran against");
  const dd = await readFile(path.join(ROOT, "src/lib/brew/drawdown.ts"), "utf8");
  assert.match(dd, /const snap = s\.brew\?\.timeline \?\? recipe\?\.timeline/);
  assert.match(dd, /exactBrewerKey\(m\) !== key/, "the pool is keyed on the EXACT brewer");
});
