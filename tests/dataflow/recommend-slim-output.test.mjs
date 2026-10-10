// Speed round, 2026-10-03: the model no longer writes `pourSequence` or per-step
// `notes` — the string is DERIVED from the structured steps on the server, and
// the timer has action-based default hints. Output writing IS the /recommend
// latency (~70 tok/s on Opus), so every field the model does not write is time
// the user does not wait.
//
//   node --test tests/dataflow/recommend-slim-output.test.mjs
//
// Covers the derivation itself, the prompt (nothing asks for the two fields any
// more), and — per the hard rule — the CONSUMERS: sanitizeRecipe derives after
// sanitation, the guard chain re-derives at the end, the chat does the same,
// and run.ts logs the usage line the production readout depends on.

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
export { sanitizePourSteps, pourSequenceFromSteps, immersionProseFromSteps, derivePourSequence } from ${JSON.stringify(
  path.join(ROOT, "src/lib/utils/pourSteps.ts"),
)};
`;
const dir = await mkdtemp(join(tmpdir(), "slim-"));
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
const P = await import(pathToFileURL(out).href);

const aeroPress = P.sanitizePourSteps([
  { label: "Invert", action: "invert", durationSec: 0 },
  { label: "Add water", action: "pour", waterGramsAtEnd: 200, durationSec: 10 },
  { label: "Stir", action: "stir", durationSec: 10 },
  { label: "Steep", action: "wait", durationSec: 90 },
  { label: "Stir", action: "stir", durationSec: 10 },
  { label: "Press", action: "press", durationSec: 30 },
]);

test("immersion prose: labels + durations, setup steps without a time, m:ss from 60 s", () => {
  assert.equal(
    P.immersionProseFromSteps(aeroPress),
    "Invert · Add water 10s · Stir 10s · Steep 1:30 · Stir 10s · Press 30s",
  );
  assert.equal(P.immersionProseFromSteps(undefined), undefined);
  assert.equal(P.immersionProseFromSteps(aeroPress.slice(0, 1)), undefined, "one step is not a sequence");
});

test("derivePourSequence: cumulative grams for percolation, prose for immersion", () => {
  const pourOver = P.sanitizePourSteps([
    { label: "Bloom", action: "bloom", waterGramsAtEnd: 50, durationSec: 15 },
    { label: "Pause", action: "wait", durationSec: 30 },
    { label: "Pour 2", action: "pour", waterGramsAtEnd: 180, durationSec: 30 },
    { label: "Final pour", action: "final", waterGramsAtEnd: 320, durationSec: 35 },
  ]);
  assert.equal(P.derivePourSequence(pourOver), "50 – 180 – 320");
  assert.equal(P.pourSequenceFromSteps(aeroPress), undefined, "one water milestone → no grams string");
  assert.match(P.derivePourSequence(aeroPress), /Steep 1:30/);
  assert.equal(P.derivePourSequence(undefined), undefined);
});

test("the prompt no longer asks for pourSequence or per-step notes", async () => {
  const prompt = await readFile(path.join(ROOT, "src/lib/claude/recommendPrompt.ts"), "utf8");
  const skeleton = prompt.slice(prompt.indexOf("OUTPUT FORMAT"), prompt.indexOf("THE TWO experiment LINES"));
  assert.ok(skeleton.length > 1000, "found the OUTPUT FORMAT slice");
  assert.doesNotMatch(skeleton, /"pourSequence":/);
  assert.doesNotMatch(skeleton, /"notes":/);
  assert.doesNotMatch(prompt, /Pour sequence format for percolation/);
  assert.match(prompt, /STEP DURATIONS/, "the immersion arithmetic tutorial is written against pourSteps now");
  assert.match(prompt, /TIME IN PROSE: the app shows the real clock/, "the pinned rule survives");
  const rec = await readFile(path.join(ROOT, "src/lib/claude/recommend.ts"), "utf8");
  assert.doesNotMatch(rec, /notes: one short, step-relevant hint/);
  assert.doesNotMatch(rec, /These MUST match pourSequence/);
  assert.match(rec, /Do NOT emit notes on steps/);
  assert.match(rec, /do not write a separate pour-sequence string; the app derives it/);
});

test("CONSUMERS: /recommend derives after sanitation AND after the guard chain; the chat derives too; run.ts logs usage", async () => {
  const rec = await readFile(path.join(ROOT, "src/lib/claude/recommend.ts"), "utf8");
  assert.match(rec, /import \{ derivePourSequence, reconcileWaterToPourPlan, sanitizePourSteps \}|import \{ derivePourSequence, sanitizePourSteps \}/);
  assert.match(rec, /out\.pourSequence = derivePourSequence\(clean\) \?\? out\.pourSequence/, "sanitizeRecipe derives");
  assert.match(
    rec,
    /pourSequence: derivePourSequence\(c\.recipe\.pourSteps\) \?\? c\.recipe\.pourSequence/,
    "the final map re-derives after the guards rewrote the steps",
  );
  const chat = await readFile(path.join(ROOT, "src/lib/chat/agentContext.ts"), "utf8");
  assert.match(chat, /pourSequence: recipe\.pourSequence \?\? derivePourSequence\(pourSteps\)/);
  assert.match(chat, /pourSequence: derivePourSequence\(r\.pourSteps\) \?\? r\.pourSequence/);
  const run = await readFile(path.join(ROOT, "src/lib/recommend/run.ts"), "utf8");
  assert.match(run, /const \{ recommendation, usage \} = await generateRecommendation\(/);
  assert.match(run, /\[recommend\] usage in=\$\{usage\.input_tokens\} out=\$\{usage\.output_tokens\} calls=\$\{usage\.calls\}/);
});
