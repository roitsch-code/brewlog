// "Try the one you skipped" (src/lib/flow/skippedCandidate.ts, 2026-10-19):
// the second candidate of the last brew of a bag, brought back for the next.
//
//   node --test tests/dataflow/skipped-candidate.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const out = path.join(ROOT, "node_modules/.cache/skipped-candidate/bundle.mjs");
await build({
  stdin: {
    contents: `
export { skippedCandidateOf } from ${JSON.stringify(path.join(ROOT, "src/lib/flow/skippedCandidate.ts"))};
export { pickPreviousBrew } from ${JSON.stringify(path.join(ROOT, "src/lib/brew/previousBrew.ts"))};
`,
    resolveDir: ROOT,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const M = await import(pathToFileURL(out).href);

const recipe = (water) => ({ doseGrams: water / 16, waterGrams: water, waterTempC: 93, grindSize: "390°", targetTimeSec: 200, pourSteps: [{ label: "Pour", action: "pour", waterGramsAtEnd: water, durationSec: 30 }] });
const A = { method: "V60", title: "Kasuya at 350", basedOn: "Kasuya 4:6 (standard)", recipe: recipe(350), role: "anchor", whyChosen: "", confidence: "high" };
const B = { method: "Orea Classic", title: "Flat-bed sweetness", recipe: recipe(350), role: "contrast", whyChosen: "", confidence: "moderate" };
const session = (over) => ({
  id: "s1",
  createdAt: "2026-10-18T07:00:00Z",
  createdAtMs: Date.parse("2026-10-18T07:00:00Z"),
  mode: "home",
  coffee: { roaster: "SEY", name: "Susan", coffeeId: "sey__susan", aiExtracted: false },
  recommendation: { candidates: [A, B] },
  brew: { selectedCandidateIdx: 0, methodUsed: "V60", actualTimeSec: 210 },
  result: { rating: 4, flavorNotes: [] },
  ...over,
});

test("the candidate beside the brewed one, by selectedCandidateIdx", () => {
  const s = M.skippedCandidateOf(session({}));
  assert.equal(s.method, "Orea Classic");
  assert.equal(s.title, "Flat-bed sweetness");
  assert.equal(s.basedOn, undefined);
  assert.equal(s.recipe.waterGrams, 350);
  assert.equal(s.sessionId, "s1");
  const other = M.skippedCandidateOf(session({ brew: { selectedCandidateIdx: 1, methodUsed: "Orea Classic", actualTimeSec: 200 } }));
  assert.equal(other.method, "V60");
  assert.equal(other.basedOn, "Kasuya 4:6 (standard)");
});

test("an old session without selectedCandidateIdx resolves by methodUsed; no match → null", () => {
  assert.equal(M.skippedCandidateOf(session({ brew: { methodUsed: "Orea Classic", actualTimeSec: 200 } })).method, "V60");
  assert.equal(M.skippedCandidateOf(session({ brew: { methodUsed: "Chemex", actualTimeSec: 200 } })), null);
});

test("one candidate, or a second one without a pour plan, is nothing to bring back", () => {
  assert.equal(M.skippedCandidateOf(session({ recommendation: { candidates: [A] } })), null);
  assert.equal(M.skippedCandidateOf(session({ recommendation: { candidates: [A, { ...B, recipe: { ...B.recipe, pourSteps: [] } }] } })), null);
  assert.equal(M.skippedCandidateOf(session({ recommendation: undefined })), null);
});

test("the previous-brew summary carries it for the route — of the LAST home brew of that bag", () => {
  const older = session({ id: "s0", createdAt: "2026-10-10T07:00:00Z", createdAtMs: Date.parse("2026-10-10T07:00:00Z"), brew: { selectedCandidateIdx: 1, methodUsed: "Orea Classic", actualTimeSec: 200 } });
  const r = M.pickPreviousBrew([older, session({})], { coffeeId: "sey__susan" });
  assert.equal(r.previous.id, "s1");
  assert.equal(r.skipped.method, "Orea Classic", "the newest brew's other candidate");
  assert.equal(M.pickPreviousBrew([], { coffeeId: "x" }).skipped, null);
});

test("WIRING: the chat's Brew-again row and the coffee page carry the pill, and it starts the exact recipe on the timer", async () => {
  const thread = await readFile(path.join(ROOT, "src/components/ui/light/ChatThread.tsx"), "utf8");
  assert.match(thread, /a\.destination === "brew_again" && a\.id \? <SkippedCandidatePill key=\{`skipped-\$\{j\}`\} coffeeId=\{a\.id\} \/> : null/);
  const page = await readFile(path.join(ROOT, "src/app/(light)/coffees/[id]/page.tsx"), "utf8");
  assert.match(page, /<SkippedCandidatePill coffeeId=\{coffee\.id\} identity=\{brewIdentity\(\)\}/);
  const pill = await readFile(path.join(ROOT, "src/components/ui/light/SkippedCandidatePill.tsx"), "utf8");
  assert.match(pill, /fetch\(`\/api\/sessions\/previous\?coffeeId=\$\{encodeURIComponent\(coffeeId\)\}`/);
  assert.match(pill, /startBrewFromChat\(target\.identity, target\.fieldZones, skipped\.recipe, skipped\.method, skipped\.title, skipped\.basedOn\)/, "the recipe as composed, nothing regenerated");
  assert.match(pill, /if \(!skipped\) return null;/, "nothing to show, nothing shown");
});
