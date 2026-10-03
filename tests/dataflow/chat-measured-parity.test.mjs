// Chat parity for measured data (2026-10-03). /recommend read the user's own
// grind settings, measured drawdowns and "what works for you" for weeks; the
// chat got none of them, read 5 coach rows in arbitrary order with no status,
// and nothing pinned that its validator rejects a batch under a vessel's minimum.
// Also pins the extractor fix (`poorSlow - goodFast`, the wrong group) and
// the previously dead brew fields reaching the coach line.
//
//   node --test tests/dataflow/chat-measured-parity.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const dir = await mkdtemp(join(tmpdir(), "chatparity-"));
const out = join(dir, "b.mjs");
await build({
  stdin: {
    contents: `export * as M from ${JSON.stringify(path.join(ROOT, "src/lib/chat/measuredContext.ts"))};
export * as V from ${JSON.stringify(path.join(ROOT, "src/lib/recipe/validateRecipe.ts"))};`,
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
const { M, V } = await import(pathToFileURL(out).href);

const recipe = (water, extra = {}) => ({
  doseGrams: Math.round(water / 16), waterGrams: water, waterTempC: 94, grindSize: "395°", targetTimeSec: 240,
  pourSteps: [
    { label: "Bloom", action: "bloom", waterGramsAtEnd: Math.round(water * 0.15), durationSec: 15 },
    { label: "Rest", action: "wait", durationSec: 30 },
    { label: "Pour 2", action: "pour", waterGramsAtEnd: Math.round(water * 0.6), durationSec: 40 },
    { label: "Rest", action: "wait", durationSec: 20 },
    { label: "Final", action: "final", waterGramsAtEnd: water, durationSec: 35 },
  ],
  ...extra,
});
const session = (i, method, water, grind, actualSec, pourEndSec) => ({
  id: `s${i}`, type: "coffee", mode: "home",
  createdAt: new Date(Date.UTC(2026, 8, 1 + i)).toISOString(), createdAtMs: Date.UTC(2026, 8, 1 + i),
  coffee: { roaster: "R", name: "C", origin: "Kenya", process: "Washed", roastLevel: "Light", aiExtracted: false },
  context: { occasion: "morning-ritual", amount: "big", timeAvailable: "normal", moodPreference: "balanced", waterSource: "tap" },
  recommendation: { primaryMethod: method, primaryRecipe: recipe(water), candidates: [{ method, role: "anchor", title: "t", recipe: recipe(water), whyChosen: "", confidence: "high" }], reasoning: "" },
  brew: { methodUsed: method, selectedCandidateIdx: 0, actualTimeSec: actualSec, grindSettingUsed: grind,
    flowAnalysis: { perPour: [{ label: "Final", targetGrams: water, targetSec: 110, actualSec: pourEndSec }] } },
  result: { rating: 4 + (i % 2) * 0.5, flavorNotes: [], body: "medium", acidity: "bright" },
});

test("buildChatMeasuredBlock: measured grind + measured drawdown from the user's own brews, in one block", () => {
  const sessions = [0, 1, 2, 3].map((i) => session(i, "V60", 450, `${395 + i}°`, 230 + i, 150));
  const block = M.buildChatMeasuredBlock(sessions, [], "Niche Zero");
  assert.match(block, /## Your measured brewing/);
  assert.match(block, /MEASURED GRIND/);
  assert.match(block, /MEASURED DRAWDOWN/);
  assert.match(block, /- V60 at ~450 g: drawdown ~\d+ s after the last pour \(median of 4 measured brews\)/);
  assert.equal(M.buildChatMeasuredBlock([], []), "");
});

test("validateRecipe flags a batch the vessel cannot serve, in both directions (vesselOverflow covers the batch minimum too)", () => {
  const under = V.validateRecipe(recipe(250), { method: "Chemex" });
  assert.ok(under.some((p) => p.code === "vessel-overflow" && /≥350/.test(p.message)), JSON.stringify(under));
  const over = V.validateRecipe(recipe(600), { method: "Clever Dripper" });
  assert.ok(over.some((p) => p.code === "vessel-overflow"), JSON.stringify(over));
  const fine = V.validateRecipe(recipe(450), { method: "Chemex" });
  assert.ok(!fine.some((p) => p.code.startsWith("vessel")), JSON.stringify(fine));
});

test("WIRING — the chat route pushes the measured block and status-ordered, labelled coach rows", async () => {
  const src = await readFile(path.join(ROOT, "src/app/api/explore-agent/route.ts"), "utf8");
  assert.match(src, /buildChatMeasuredBlock\(corpusSessions, rotationCoffees, grinderFromConversation\(messages\)\)/);
  assert.match(src, /if \(measuredBlock\) contextParts\.push\(measuredBlock\)/);
  assert.match(src, /CASE \$\{insightsTable\.status\} WHEN 'confirmed' THEN 0 WHEN 'trying' THEN 1/);
  assert.match(src, /\$\{verdict\(r\.status\)\} \$\{r\.observation\}/);
});

test("extractor compares slow-drawdown shares of the SAME group; dead brew fields reach the coach line", async () => {
  const ex = await readFile(path.join(ROOT, "src/lib/claude/extractor.ts"), "utf8");
  assert.match(ex, /if \(poorSlow - goodSlow > 0\.4\)/);
  assert.doesNotMatch(ex, /poorSlow - goodFast/);
  const ins = await readFile(path.join(ROOT, "src/lib/claude/insights.ts"), "utf8");
  for (const needle of ["timing=${b.timing}", 'recipe.push("followed=y")', "did=\"${b.modifications", "agit=\"${b.agitationNote", "balance=${r.balance}"]) {
    assert.ok(ins.includes(needle), `coach line must carry ${needle}`);
  }
});
