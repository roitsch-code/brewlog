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

// Pull the NICHE block out of the prompt and parse "Label: min–max°" pairs.
function parsePromptRanges(prompt) {
  const start = prompt.indexOf("NICHE° GRIND REFERENCE:");
  assert.ok(start >= 0, "NICHE° GRIND REFERENCE block missing from SYSTEM_PROMPT");
  const end = prompt.indexOf("COMANDANTE C40 MK2", start);
  const block = prompt.slice(start, end > 0 ? end : undefined);
  const map = new Map();
  // Matches "V60: 375–385°" / "Orea Apex (clarity): 382–386°" (en-dash or hyphen)
  const re = /([A-Za-zÖ0-9 .+/()]+?):\s*(\d{3})\s*[–-]\s*(\d{3})°/g;
  let m;
  while ((m = re.exec(block))) {
    const label = m[1].replace(/\s*\([^)]*\)\s*/g, "").trim();
    map.set(label, { min: Number(m[2]), max: Number(m[3]) });
  }
  return map;
}

// grindSettings method name -> the label it appears as in the prompt block.
const LABEL_FOR = {
  "V60": "V60",
  "V60 + Drip Assist": "V60 + Drip Assist",
  "Kalita Wave": "Kalita",
  "Chemex": "Chemex",
  "Clever Dripper": "Clever Dripper",
  "AeroPress": "AeroPress",
  "Moccamaster": "Moccamaster",
  "Orea Apex": "Orea Apex",
  "Orea Classic": "Orea Classic",
  "Orea Open": "Orea Open",
};

test("prompt NICHE block matches grindSettings for every shared method", () => {
  const prompt = parsePromptRanges(SYSTEM_PROMPT);
  let checked = 0;
  for (const s of NICHE_GRIND_SETTINGS) {
    const label = LABEL_FOR[s.method];
    if (!label) continue; // process-specific or recipe-anchored rows aren't in the general table
    const p = prompt.get(label);
    assert.ok(p, `prompt block is missing a row for "${label}"`);
    assert.deepEqual(
      p,
      { min: s.niche.min, max: s.niche.max },
      `grind mismatch for ${s.method}: prompt ${p.min}–${p.max}° vs grindSettings ${s.niche.min}–${s.niche.max}°`,
    );
    checked++;
  }
  assert.ok(checked >= 8, `expected to cross-check ≥8 methods, only did ${checked}`);
});

test("the V60 anchor sits at the measured 380°, not the stale 396°", () => {
  const prompt = parsePromptRanges(SYSTEM_PROMPT);
  const v60 = prompt.get("V60");
  assert.ok(v60, "V60 row missing");
  assert.ok(v60.min <= 380 && v60.max >= 380, `V60 range ${v60.min}–${v60.max}° must span the measured 380° anchor`);
  assert.ok(v60.max <= 388, `V60 must not drift coarse again (got ${v60.max}°, measured anchor is 380°)`);
});
