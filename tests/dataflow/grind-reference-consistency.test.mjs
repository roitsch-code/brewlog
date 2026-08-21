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

// ── The half of #527 that was missed ────────────────────────────────────────
// #527 recalibrated the NICHE° table and pinned it — but the SAME prompt kept a
// dozen fully-numbered recipes carrying the OLD baseline, so it contradicted
// itself: "Kasuya 4:6: 390–400°" in the table, "Kasuya 4:6 … 411–421°" thirty
// lines below. Same for Clever (395–415 vs 421–431), Orea Classic (385–390 vs
// 406–411), Origami cone (378–388 vs 398–408). A candidate written off the
// stale copy is ~20° coarse, which then trips the fidelity guard's grind window
// and gets its whole mechanical signature snapped onto the published recipe.
// Those literal recipe blocks are gone (concrete recipes now come only from the
// per-turn library); these tests keep them from coming back.

test("no grind number anywhere in the prompt contradicts the measured table", () => {
  // Every "NNN–NNN°" in the whole prompt must fall inside the union of the
  // measured ranges, widened by the ±20°/doubling dose-scaling rule. A stale
  // pre-#527 number (398–431°) lands outside it; a legitimate batch-scaled one
  // does not.
  const lo = Math.min(...NICHE_GRIND_SETTINGS.map((s) => s.niche.min));
  const hi = Math.max(...NICHE_GRIND_SETTINGS.map((s) => s.niche.max));
  const offenders = [];
  for (const line of SYSTEM_PROMPT.split("\n")) {
    // A value DERIVED in place from a published click count is sourced, not
    // drifted — e.g. Kasuya Super Coarse is genuinely Comandante 40–45 clicks
    // (≈ 435–455°), far outside the everyday table and correctly so.
    if (/clicks\s*≈/.test(line)) continue;
    const re = /(\d{3})\s*[–-]\s*(\d{3})°/g;
    let m;
    while ((m = re.exec(line))) {
      const min = Number(m[1]);
      const max = Number(m[2]);
      if (min < lo - 25 || max > hi + 25) {
        offenders.push(`${min}–${max}° (measured span is ${lo}–${hi}°)`);
      }
    }
  }
  assert.deepEqual(offenders, [], `grind ranges outside the measured span: ${offenders.join(", ")}`);
});

test("the hardcoded recipe blocks that drifted are gone", () => {
  // Concrete recipes must arrive per turn (scored + rotated for the coffee), not
  // from a byte-identical block in the cached prefix — that block is why the
  // same recipes came back brew after brew even once the menu rotated.
  for (const gone of [
    "CHAMPIONSHIP / REFERENCE RECIPES",
    "Bloom 46g",           // Chemex fill-in-the-blank template
    "Bloom 35g",           // Origami milestone template
    "411–421°",            // stale Kasuya grind
    "421–431°",            // stale Clever grind
    "Japanese Iced V60 (small ~350g)",
    "Hoffmann Fine + Finings (ready-to-drink):",
  ]) {
    assert.ok(
      !SYSTEM_PROMPT.includes(gone),
      `SYSTEM_PROMPT still carries the hardcoded recipe fragment "${gone}"`,
    );
  }
  // The RULES those blocks lived in must survive — only the numbers left.
  for (const kept of ["ICED COFFEE RECIPES", "COLD BREW RECIPES", "VESSEL BY VOLUME", "Hot-Bloom variant"]) {
    assert.ok(SYSTEM_PROMPT.includes(kept), `SYSTEM_PROMPT lost the rules block "${kept}"`);
  }
});

test("Comandante clicks are generated from the same table, not hand-copied", () => {
  // The hand-written block read "Chemex Washed 24" and "AeroPress 19" while the
  // measured map puts them at 28–32 and 16–18 — drift in the other unit.
  const start = SYSTEM_PROMPT.indexOf("COMANDANTE C40 MK2");
  assert.ok(start >= 0, "COMANDANTE block missing");
  const block = SYSTEM_PROMPT.slice(start, start + 1200);
  for (const s of NICHE_GRIND_SETTINGS) {
    const head = s.process ? `${s.method} (${s.process})` : s.method;
    // Same documented map the prompt uses: clicks ≈ 23 + (° − 380) × 0.3.
    const clicks = Math.round(23 + ((s.niche.min + s.niche.max) / 2 - 380) * 0.3);
    assert.ok(
      block.includes(`${head} ${clicks}`),
      `COMANDANTE block is missing "${head} ${clicks}" (derived from ${s.niche.min}–${s.niche.max}°)`,
    );
    // …and the derived value must land inside that method's own measured click
    // range, or the two halves of grindSettings disagree with each other.
    assert.ok(
      clicks >= s.comandante.min - 1 && clicks <= s.comandante.max + 1,
      `${head}: derived ${clicks} clicks falls outside its own table range ${s.comandante.min}–${s.comandante.max}`,
    );
  }
  assert.ok(block.includes("V60 23"), "the measured V60 anchor (23 clicks) must survive the derivation");
});
