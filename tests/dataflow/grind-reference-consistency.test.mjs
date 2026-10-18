// Binds the /recommend prompt's NICHE° GRIND REFERENCE block to the measured
// single source of truth (src/lib/constants/grindSettings.ts).
//
// WHY THIS EXISTS: the prompt block was a hand-maintained copy that silently
// fell a full re-calibration behind — it read V60 396–406° while the owner's
// measured anchor (and grindUnit.ts, and the corpus recipes) had moved to 380°.
// That is ~+21°, about 6 Comandante clicks coarser than the owner grinds, on
// every recipe the model wrote off the general table. The block also
// contradicted itself: "V60 396–406°" next to "V60 … 23 clicks", when 396° is
// 28 clicks by the app's own conversion. This test fails CI the moment the two
// disagree again, so the drift cannot recur.
//
//   node --test tests/dataflow/grind-reference-consistency.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
async function load(rel, names) {
  const entry = `export { ${names.join(", ")} } from ${JSON.stringify(path.join(ROOT, rel))};`;
  const dir = await mkdtemp(join(tmpdir(), "grind-"));
  const out = join(dir, "b.mjs");
  await build({ stdin: { contents: entry, resolveDir: ROOT, loader: "ts" }, bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "silent" });
  return import(pathToFileURL(out).href);
}

const { SYSTEM_PROMPT } = await load("src/lib/claude/recommendPrompt.ts", ["SYSTEM_PROMPT"]);
const { NICHE_GRIND_SETTINGS } = await load("src/lib/constants/grindSettings.ts", ["NICHE_GRIND_SETTINGS"]);

function nicheBlock(prompt) {
  const start = prompt.indexOf("NICHE° GRIND REFERENCE:");
  assert.ok(start >= 0, "NICHE° GRIND REFERENCE block missing from SYSTEM_PROMPT");
  const end = prompt.indexOf("COMANDANTE C40 MK2", start);
  return prompt.slice(start, end > 0 ? end : undefined);
}

// Grind audit (owner, 2026-10-18: "never estimate — research, calculate,
// prove"): the table holds ONLY the owner's measurements and the one value he
// stated himself. Every estimated per-brewer row is gone, and the prompt says
// so instead of carrying a number.
test("the grind table holds only measured / owner-stated rows", () => {
  for (const s of NICHE_GRIND_SETTINGS) {
    assert.ok(["measured", "owner-stated"].includes(s.confidence), `${s.method}: ${s.confidence}`);
  }
  const v60 = NICHE_GRIND_SETTINGS.find((s) => s.method === "V60");
  assert.deepEqual([v60.niche.min, v60.niche.max, v60.comandante.min], [380, 380, 23]);
});

test("the prompt NICHE block carries the measured V60 anchors and no other brewer's number", () => {
  const block = nicheBlock(SYSTEM_PROMPT);
  assert.match(block, /V60: 380° at 15 g \/ 250 ml and 400° at 30 g \/ 500 ml/);
  assert.match(block, /Every other brewer .*NO measured or published Niche value exists/);
  assert.match(block, /MEASUREMENT BREW/);
  // No range for any brewer, and no degree value but the measured / owner-stated ones.
  assert.doesNotMatch(block, /\d{3}\s*[–-]\s*\d{3}°/);
  const degrees = Array.from(block.matchAll(/(\d{3})°/g)).map((m) => Number(m[1]));
  for (const d of degrees) assert.ok([380, 400].includes(d), `unsourced ${d}° in the NICHE block`);
});

test("no grind degree anywhere in the prompt beyond the measured anchors", () => {
  const degrees = Array.from(SYSTEM_PROMPT.matchAll(/(\d{3})\s*°/g)).map((m) => Number(m[1]));
  const odd = degrees.filter((d) => d >= 300 && d <= 500 && ![380, 385, 400].includes(d));
  assert.deepEqual(odd, [], `unsourced Niche degrees in SYSTEM_PROMPT: ${odd.join(", ")}`);
});

test("the hardcoded recipe blocks that drifted are gone", () => {
  for (const gone of [
    "CHAMPIONSHIP / REFERENCE RECIPES",
    "Bloom 46g",
    "Bloom 35g",
    "411–421°",
    "421–431°",
    "435–455°",
    "Japanese Iced V60 (small ~350g)",
    "Hoffmann Fine + Finings (ready-to-drink):",
  ]) {
    assert.ok(!SYSTEM_PROMPT.includes(gone), `SYSTEM_PROMPT still carries "${gone}"`);
  }
  for (const kept of ["ICED COFFEE RECIPES", "COLD BREW RECIPES", "VESSEL BY VOLUME", "Hot-Bloom variant"]) {
    assert.ok(SYSTEM_PROMPT.includes(kept), `SYSTEM_PROMPT lost the rules block "${kept}"`);
  }
});

test("Comandante clicks are generated from the same table, not hand-copied", () => {
  const start = SYSTEM_PROMPT.indexOf("COMANDANTE C40 MK2");
  assert.ok(start >= 0, "COMANDANTE block missing");
  const block = SYSTEM_PROMPT.slice(start, start + 1200);
  for (const s of NICHE_GRIND_SETTINGS) {
    const head = s.process ? `${s.method} (${s.process})` : s.method;
    const clicks = Math.round(23 + ((s.niche.min + s.niche.max) / 2 - 380) * 0.3);
    assert.ok(block.includes(`${head} ${clicks}`), `COMANDANTE block is missing "${head} ${clicks}"`);
  }
  assert.ok(block.includes("V60 23"), "the measured V60 anchor (23 clicks) must survive");
  assert.ok(block.includes("29 (measured)"), "the measured 500 ml anchor (29 clicks)");
  assert.match(block, /every other brewer: no measured value — a measurement brew/);
});
