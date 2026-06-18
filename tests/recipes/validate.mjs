// Recipe-corpus validator. Bundles the REAL TypeScript corpus with esbuild
// (so we validate the actual data, not a re-declared copy) and asserts the
// invariants that make a recipe "valid in itself" and consistent with the
// rest of the system.
//
//   node tests/recipes/validate.mjs
//
// Exit 0 = all hard invariants hold. Exit 1 = at least one hard error.
// Warnings never fail the run — they're surfaced for a human to judge.

import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const abs = (p) => path.join(ROOT, p);

// ── Bundle the corpus + technique ids into a temp ESM module ───────────────
const entry = `
export { ALL_RECIPES } from ${JSON.stringify(abs("src/lib/knowledge/recipes/index.ts"))};
export { TECHNIQUES } from ${JSON.stringify(abs("src/lib/knowledge/techniques/data.ts"))};
`;
const dir = await mkdtemp(join(tmpdir(), "recipe-validate-"));
const out = join(dir, "bundle.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { ALL_RECIPES, TECHNIQUES } = await import(pathToFileURL(out).href);
const techniqueIds = new Set(TECHNIQUES.map((t) => t.id));

// ── Canonical enums (mirror types.ts) ──────────────────────────────────────
const BREWERS = new Set([
  "v60", "orea-v4-fast", "orea-v4-wide", "orea-apex", "orea-classic", "orea-open",
  "origami-cone", "origami-wave", "origami-air-m", "clever", "kalita-wave",
  "aeropress", "aeropress-prismo", "moccamaster", "chemex", "solo-dripper",
  "cafec-flower", "conical-paper", "cold-brew-jar",
]);
const ROASTS = new Set(["very-light", "light", "medium-light", "medium", "medium-dark", "dark"]);
const PROCESSES = new Set(["washed", "natural", "honey", "anaerobic", "experimental", "any"]);
const GOALS = new Set(["balanced", "high-clarity", "sweetness-forward", "body-forward", "aromatic", "explore"]);
const ACTIONS = new Set(["pour", "stir", "swirl", "wait", "press", "invert", "flip", "drain", "bypass", "melodrip", "agitate-bed"]);
const IMMERSION = new Set(["clever", "aeropress", "aeropress-prismo"]);

const errors = [];
const warns = [];
const E = (id, m) => errors.push(`[${id}] ${m}`);
const W = (id, m) => warns.push(`[${id}] ${m}`);

// Known, deliberately-unfixed inconsistencies. Each entry is matched as a
// substring against an error line; matches are reported as "known/pending"
// and do NOT fail the gate, so the validator still catches NEW regressions.
// Remove an entry once its underlying issue is resolved.
const KNOWN_ISSUES = [
  // (empty) — list any deliberately-unfixed inconsistency here as a substring
  // match against an error line so the gate still catches NEW regressions.
];

// ── Per-recipe checks ───────────────────────────────────────────────────────
const seen = new Map();
for (const r of ALL_RECIPES) {
  const id = r.id || "(no-id)";

  // Identity
  if (!r.id) E(id, "missing id");
  if (seen.has(r.id)) E(id, `duplicate id (also: ${seen.get(r.id)})`);
  else seen.set(r.id, r.name);
  if (!r.name) E(id, "missing name");
  if (!r.shortName) E(id, "missing shortName");
  if (!["championship", "reference", "experimental"].includes(r.category)) E(id, `bad category "${r.category}"`);
  if (!BREWERS.has(r.brewer)) E(id, `unknown brewer "${r.brewer}"`);
  if (!r.attribution?.person) E(id, "missing attribution.person");

  // Dose / water / ratio
  const dose = r.dose?.grams, water = r.water?.grams;
  if (!(dose > 0)) E(id, `bad dose ${dose}`);
  if (!(water > 0)) E(id, `bad water ${water}`);
  if (dose > 0 && water > 0) {
    const computed = water / dose;
    // Ratio strings may carry an annotation for bypass/iced/concentrate
    // recipes (e.g. "1:11.1 (extraction) + bypass"). Validate the LEADING
    // 1:N against water/dose; the annotation is display-only.
    const m = /^1:\s*([\d.]+)/.exec((r.water?.ratio || "").trim());
    if (!m) E(id, `ratio "${r.water?.ratio}" has no leading "1:N"`);
    else {
      const stated = parseFloat(m[1]);
      const diff = Math.abs(stated - computed);
      const annotated = /[a-z(]/i.test(r.water.ratio);
      // Annotated (bypass/iced) ratios describe a different basis than
      // raw water/dose, so only flag a wild mismatch there.
      if (!annotated && diff > 1.0) E(id, `ratio ${r.water.ratio} ≠ water/dose ${computed.toFixed(2)} (${dose}g:${water}g)`);
      else if (!annotated && diff > 0.35) W(id, `ratio ${r.water.ratio} vs computed ${computed.toFixed(2)} (off by ${diff.toFixed(2)})`);
    }
  }

  // Temperature — incl. the post-June-2026 "NO STAGED TEMPERATURE" rule
  const t = r.temperature || {};
  const temps = [];
  if (typeof t.celsius === "number") temps.push(t.celsius);
  if (Array.isArray(t.rangeC)) temps.push(...t.rangeC);
  if (Array.isArray(t.staged) && t.staged.length) {
    E(id, `STAGED TEMPERATURE present (${t.staged.length} entries) — violates the single-temperature rule`);
    temps.push(...t.staged.map((s) => s.celsius));
  }
  if (!temps.length) E(id, "no temperature specified");
  // Cold brew is allowed — it's a single CONSTANT temperature, just a cold one.
  // What's banned is TWO temperatures in one recipe (staged), caught below.
  // So only flag physically-impossible (>100) or the lukewarm 35–70 no-man's-
  // land that usually means a typo (e.g. 9 vs 90). Cold (<35) and hot (70–100)
  // both pass silently.
  for (const c of temps) {
    if (c > 100) W(id, `temperature ${c}°C above boiling`);
    else if (c >= 35 && c < 70) W(id, `temperature ${c}°C is lukewarm (typo?) — hot brew is 70–100, cold brew <35`);
  }

  // Grind
  const g = r.grind || {};
  const nz = g.nicheZeroDegrees;
  if (nz === undefined && !g.description && !g.referenceSetting) {
    W(id, "no grind info at all");
  } else if (nz !== undefined) {
    const vals = Array.isArray(nz) ? nz : [nz];
    if (Array.isArray(nz) && nz[0] > nz[1]) E(id, `niche degrees range reversed [${nz}]`);
    for (const v of vals) if (v < 300 || v > 470) W(id, `niche degrees ${v} outside 300–470`);
  }

  // Pour sequence
  const seq = r.pourSequence || [];
  if (!seq.length) E(id, "empty pourSequence");
  const baseTemp = typeof t.celsius === "number" ? t.celsius : (Array.isArray(t.rangeC) ? t.rangeC[1] : undefined);
  // Brew time starts at first water contact; leading prep steps (rinse
  // filter, level bed) carry durations but aren't brew time.
  const firstWaterIdx = seq.findIndex((s) => s.action === "pour" || typeof s.waterGramsAtEnd === "number");
  let prevCum = -Infinity, maxCum = 0, durSum = 0;
  const stepTemps = new Set();
  for (const [i, s] of seq.entries()) {
    if (!ACTIONS.has(s.action)) E(id, `step ${i} bad action "${s.action}"`);
    if (typeof s.temperatureC === "number") stepTemps.add(s.temperatureC);
    if (typeof s.waterGramsAtEnd === "number") {
      if (s.waterGramsAtEnd < prevCum - 0.001) E(id, `step ${i} cumulative water ${s.waterGramsAtEnd} < previous ${prevCum}`);
      prevCum = s.waterGramsAtEnd;
      // A bypass step adds water in the SERVER, beyond the extraction water,
      // so it may legitimately exceed recipe.water. Any OTHER step exceeding
      // the recipe water is a genuine error.
      if (s.waterGramsAtEnd > water + 1 && s.action !== "bypass") {
        E(id, `step ${i} (${s.action}) water ${s.waterGramsAtEnd}g > recipe water ${water}g`);
      }
      maxCum = Math.max(maxCum, s.waterGramsAtEnd);
    }
    if (typeof s.durationSec === "number") {
      if (s.durationSec < 0) E(id, `step ${i} negative duration`);
      if (firstWaterIdx >= 0 && i >= firstWaterIdx) durSum += s.durationSec;
    }
  }
  // Staged temperature = a step temperature that DIFFERS from the base temp,
  // or more than one distinct step temperature → violates the single-temp rule.
  const distinct = [...stepTemps].filter((c) => baseTemp === undefined || c !== baseTemp);
  if (stepTemps.size > 1 || distinct.length) {
    E(id, `staged temperature in steps (${[...stepTemps].join(", ")}°C vs base ${baseTemp}°C)`);
  } else if (stepTemps.size === 1) {
    W(id, `pour step restates base temp as temperatureC — convention says omit it`);
  }
  if (!(r.totalTimeSec > 0)) E(id, `bad totalTimeSec ${r.totalTimeSec}`);
  else {
    if (durSum > r.totalTimeSec + 5) E(id, `brew-step durations sum ${durSum}s > totalTimeSec ${r.totalTimeSec}s (timer ends before steps do)`);
    // Long brews are expected for cold brew (single cold temp, hours of steep);
    // only flag implausibly-long HOT brews (base temp ≥ 40°C).
    if (r.totalTimeSec > 960 && (baseTemp === undefined || baseTemp >= 40)) W(id, `totalTimeSec ${r.totalTimeSec}s (>16 min) for a hot brew`);
  }

  // Cross-refs + enums
  for (const tech of r.techniques || []) if (!techniqueIds.has(tech)) W(id, `technique "${tech}" not in techniques corpus`);
  for (const x of r.bestFor?.roastLevels || []) if (!ROASTS.has(x)) E(id, `bad roastLevel "${x}"`);
  for (const x of r.bestFor?.processes || []) if (!PROCESSES.has(x)) E(id, `bad process "${x}"`);
  for (const x of r.bestFor?.goals || []) if (!GOALS.has(x)) E(id, `bad goal "${x}"`);

  // Narrative + provenance
  if (!r.teaches) W(id, "missing teaches");
  if (!r.science) W(id, "missing science");
  if (!r.whenToUse) W(id, "missing whenToUse");
  if (!r.sources?.length) W(id, "no sources");
  else for (const [i, s] of r.sources.entries()) if (!s.citation) W(id, `source ${i} missing citation`);
  if (typeof r.verified !== "boolean") E(id, "verified is not a boolean");
}

// ── Technique → recipe reverse check ────────────────────────────────────────
// Recipes referencing techniques is checked above; this is the OTHER
// direction: every technique's exemplifiedBy id must point at a recipe
// that still exists. Catches the dangling-exemplar class (a recipe gets
// removed/renamed and the technique keeps citing it — happened with the
// staged-temperature purge and the June 2026 inversion-exemplar fix).
const recipeIds = new Set(ALL_RECIPES.map((r) => r.id));
for (const t of TECHNIQUES) {
  for (const rid of t.exemplifiedBy || []) {
    if (!recipeIds.has(rid)) E(`technique:${t.id}`, `exemplifiedBy "${rid}" not in recipe corpus`);
  }
}

// ── Corpus-level summary ────────────────────────────────────────────────────
const byCat = {};
const byBrewer = {};
let verified = 0;
for (const r of ALL_RECIPES) {
  byCat[r.category] = (byCat[r.category] || 0) + 1;
  byBrewer[r.brewer] = (byBrewer[r.brewer] || 0) + 1;
  if (r.verified) verified++;
}

console.log(`\n=== Recipe corpus validation ===`);
console.log(`Total recipes: ${ALL_RECIPES.length}`);
console.log(`By category:`, byCat);
console.log(`Verified: ${verified}/${ALL_RECIPES.length}`);
console.log(`Brewers covered: ${Object.keys(byBrewer).length} →`, byBrewer);
console.log(`Techniques in corpus: ${techniqueIds.size}`);

const known = [];
const real = errors.filter((e) => {
  if (KNOWN_ISSUES.some((k) => e.includes(k))) { known.push(e); return false; }
  return true;
});

console.log(`\n--- HARD ERRORS: ${real.length} ---`);
for (const e of real) console.log("  ✗ " + e);
console.log(`\n--- KNOWN / PENDING (not failing the gate): ${known.length} ---`);
for (const e of known) console.log("  ~ " + e);
console.log(`\n--- WARNINGS: ${warns.length} ---`);
for (const w of warns) console.log("  ! " + w);

process.exit(real.length ? 1 : 0);
