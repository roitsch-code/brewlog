#!/usr/bin/env node
// The Gota import (2026-10-19, owner: "Ja, gefiltert").
//
//   node scripts/gota-import.mjs [--dry-run] [--limit N]
//
// gota.cafe is a recipe-timer app whose web pages carry ~1,059 recipes as
// schema.org JSON-LD plus a step clock in the HTML. Measured on 2026-10-19
// (docs/recipe-sources.md §10): 953 name the originator, 122 of those are
// YouTube videos (numbers that exist nowhere else as text); six recipes
// checked against originators we had read ourselves matched on every number.
// What Gota ADDS is its own: per-pour seconds ("6 g/s · 10 s"), silent
// scalings, 66 "Gota Team" recipes, 91 without an originator, cross-brewer
// clones of one recipe, and "competition" templates without a source.
//
// So this script is deterministic (no model call) and strict about what it
// keeps:
//   1. only the owner's brewers (CATEGORY_MAP), water inside the vessel cap;
//   2. a named author that is not "Gota Team" and an originator host that is
//      not gota.cafe;
//   3. milestones that rise and reach the water, temperature 60–100 °C;
//   4. one copy per clone family (same author + name + dose + water + steps);
//   5. nothing the corpus already has (same name, or same person + brewer +
//      water ±10 %).
// Gota's pour seconds are read and DROPPED: a pour step's durationSec is the
// window until the next step (the corpus's "pour + rest in one step"
// convention), so the published clock survives and no Gota number enters.
// Entries are `verified: false`, attributed "<author> (via Gota)", with NO
// `addedAt` — a bulk import must not wear "[NEW this month]" for a month and
// crowd the Fresh strip; the weekly scout keeps that label.
//
// Writes src/lib/knowledge/recipes/gota.ts, then runs the corpus validator
// and tsc; red → the previous file is restored. Nothing is committed here.
// The pure parts are exported for tests/dataflow/gota-import.test.mjs.

import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
export const GOTA_PATH = "src/lib/knowledge/recipes/gota.ts";
const SITEMAP = "https://gota.cafe/sitemap-en.xml";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36 (BTTS gota import)";
const WORKERS = 3;

/** Gota recipeCategory → corpus brewer. Anything else is not his kit. */
export const CATEGORY_MAP = {
  "V60 02": { brewer: "v60", brewerNotes: "V60 02" },
  "V60 01": { brewer: "v60", brewerNotes: "V60 01 (small cone)" },
  "V60 03": { brewer: "v60", brewerNotes: "V60 03 (large cone)" },
  AeroPress: { brewer: "aeropress" },
  "AeroPress Go": { brewer: "aeropress", brewerNotes: "AeroPress Go" },
  "AeroPress XL": { brewer: "aeropress", brewerNotes: "AeroPress XL" },
  "Clever Dripper S": { brewer: "clever", brewerNotes: "Clever S" },
  "Clever Dripper L": { brewer: "clever", brewerNotes: "Clever L" },
  "Kalita Wave 185": { brewer: "kalita-wave", brewerNotes: "Kalita Wave 185" },
  "Kalita Wave 155": { brewer: "kalita-wave", brewerNotes: "Kalita Wave 155" },
  "Chemex 3 Cup": { brewer: "chemex", brewerNotes: "Chemex 3-cup" },
  "Chemex 6 Cup": { brewer: "chemex", brewerNotes: "Chemex 6-cup" },
  "Chemex 8 Cup": { brewer: "chemex", brewerNotes: "Chemex 8-cup" },
  "Chemex 10 Cup": { brewer: "chemex", brewerNotes: "Chemex 10-cup" },
  "Orea V4 Wide": { brewer: "orea-v4-wide", brewerNotes: "Orea V4 Wide — bottom not stated by Gota" },
  "Origami Air S": { brewer: "origami", brewerNotes: "Origami Air S" }, // filter decided from the text
};

/** Clone priority inside one family: the first category listed wins. */
const CATEGORY_PRIORITY = Object.keys(CATEGORY_MAP);

/** Vessel caps — the single source is src/lib/utils/vesselCapacity.ts; mirrored by the test. */
export const CAPS = { v60: 550, aeropress: 230, clever: 450, "kalita-wave": 450, chemex: 750, "orea-v4-wide": 450, "origami-cone": 350, "origami-wave": 350 };
/** Batch-brewer floors (VESSEL_CAPS minMl): below this the vessel does not brew well. */
export const FLOORS = { chemex: 350 };
/** validateRecipe's dead-gap rule (src/lib/knowledge/recipes/helpers.ts LONG_DESIGNED_WAIT_SEC). */
export const LONG_DESIGNED_WAIT_SEC = 75;

export const ALLOWED_ACTIONS = new Set(["pour", "stir", "swirl", "wait", "press", "invert", "flip", "drain", "bypass", "melodrip", "agitate-bed"]);
const TECHNIQUE_IDS_USED = ["bloom", "pulse-pouring", "continuous-pour", "spiral-pour", "central-pour", "immersion-steep", "aeropress-inversion", "concentrate-and-bypass", "swirl-not-stir"];

// ── 1. Parse one Gota page ───────────────────────────────────────────────────

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", deg: "°", rarr: "→", middot: "·", hellip: "…", ndash: "–", mdash: "—" };
function decode(s) {
  return String(s ?? "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}
function text(html) {
  return decode(html.replace(/<svg[\s\S]*?<\/svg>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .trim();
}
export function clockToSec(s) {
  const m = /^(\d+):(\d\d)$/.exec(String(s ?? "").trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
/** "40s" | "1m34s" | "2m" → seconds. */
export function windowToSec(s) {
  const m = /^(?:(\d+)m)?\s*(?:(\d+)s)?$/.exec(String(s ?? "").trim());
  if (!m || (!m[1] && !m[2])) return null;
  return Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0);
}

/**
 * One recipe page → a plain object. Returns null when the page carries no
 * schema.org Recipe (category pages, errors).
 */
export function parseGotaPage(html, url = "") {
  const out = { url, authorLinks: [], tags: [], steps: [] };
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let j;
    try {
      j = JSON.parse(m[1]);
    } catch {
      continue;
    }
    for (const g of j["@graph"] ?? []) {
      if (g["@type"] !== "Recipe") continue;
      out.name = String(g.name ?? "").trim();
      out.category = String(g.recipeCategory ?? "").trim();
      out.description = String(g.description ?? "").trim();
      const a = g.author ?? {};
      out.author = String(a.name ?? "").trim();
      out.authorLinks = Array.isArray(a.sameAs) ? a.sameAs.filter((s) => typeof s === "string") : [];
      out.stepTexts = (g.recipeInstructions ?? []).map((s) => String(s.text ?? "").trim());
    }
  }
  if (!out.name || !out.category) return null;

  const t = text(html);
  let m = /(\d+(?:\.\d+)?)\s*g\s*Coffee\s*(\d+(?:\.\d+)?)\s*g\s*Water/.exec(t);
  if (m) {
    out.dose = Number(m[1]);
    out.water = Number(m[2]);
  }
  m = /(\d+)\s*°C\s*Temp/.exec(t);
  out.tempC = m ? Number(m[1]) : null;
  m = /(\d+:\d\d)\s*Total/.exec(t);
  out.totalSec = m ? clockToSec(m[1]) : null;
  m = /\d+\s+([a-z-]+(?:\s[a-z-]+)?)\s+Grind\s/.exec(t);
  out.grindWord = m ? m[1].trim() : "";
  for (const tag of html.matchAll(/search\?(?:flavor|roast|body)%5B%5D=([a-z-]+)/g)) out.tags.push(tag[1]);
  out.tags = [...new Set(out.tags)];

  // Steps: one <li> per step inside the Method <ol>.
  const section = /<h2 class="slabel">Method<\/h2>([\s\S]*?)(?:<h2 class="slabel">|<\/section>)/.exec(html);
  if (section) {
    for (const li of section[1].matchAll(/<li>([\s\S]*?)<\/li>/g)) {
      const block = li[1];
      if (!block.includes("step-band")) continue; // "Before you brew" items have no band
      const label = /class="font-mono[^"]*truncate[^"]*">\s*([^<]+?)\s*<\/span>/.exec(block);
      const start = /tabular-nums[^"]*shrink-0">\s*(\d+:\d\d)\s*<\/span>/.exec(block);
      const gap = /class="step-gap[^"]*">\s*([^<]+?)\s*<\/span>/.exec(block);
      const note = /<div class="step-note">([\s\S]*?)<\/div>/.exec(block);
      const measure = /dchip-b">\s*\+?(\d+(?:\.\d+)?)\s*<\/span>[\s\S]*?→\s*(\d+(?:\.\d+)?)g/.exec(block);
      const noteText = note ? text(note[1]) : "";
      const chipText = text(block.replace(/<div class="step-note">[\s\S]*?<\/div>/, " "));
      const chipTemps = [...chipText.matchAll(/(\d+)°C/g)].map((m) => Number(m[1]));
      out.steps.push({
        label: label ? decode(label[1]).trim() : "",
        startSec: start ? clockToSec(start[1]) : null,
        windowSec: gap ? windowToSec(gap[1]) : null,
        text: noteText,
        addGrams: measure ? Number(measure[1]) : null,
        cumGrams: measure ? Number(measure[2]) : null,
        tempC: chipTemps.length ? chipTemps[0] : null,
      });
    }
  }

  m = /Original source\s*<\/p>\s*<p[^>]*>\s*Recipe by\s*([^,<]+?),\s*published at\s*<a href="([^"]+)"[^>]*>([^<]+)<\/a>/.exec(html);
  out.originator = m ? { by: decode(m[1]).trim(), url: m[2], host: m[3].trim().replace(/^www\./, "") } : null;
  return out;
}

// ── 2. Map and filter ────────────────────────────────────────────────────────

export function mapCategory(p) {
  const row = CATEGORY_MAP[p.category];
  if (!row) return null;
  if (row.brewer !== "origami") return row;
  const body = [p.description, ...p.steps.map((s) => s.text)].join(" ").toLowerCase();
  const cone = /\b(cone|conical)\b/.test(body);
  const wave = /\b(wave|flat-bottom|flat bottom)\b/.test(body);
  if (cone === wave) return null; // both or neither: the filter is not stated
  return { brewer: cone ? "origami-cone" : "origami-wave", brewerNotes: `${row.brewerNotes}, ${cone ? "cone" : "wave"} filter` };
}

/** The reason a parsed page is dropped, or null when it may enter. */
export function dropReason(p, map) {
  if (!map) return "not his brewer";
  if (!p.author || /^gota\b/i.test(p.author)) return "author is Gota Team / missing";
  if (!p.originator || /gota\.cafe/.test(p.originator.host)) return "no originator named";
  if (!(p.dose > 0) || !(p.water > 0)) return "dose or water missing";
  if (!(p.tempC >= 60 && p.tempC <= 100)) return "temperature outside 60–100 °C";
  if (!(p.totalSec > 0)) return "no total time";
  const steps = p.steps.filter((s) => s.startSec != null);
  if (steps.length < 2) return "no step clock";
  let cum = 0;
  let inVessel = 0;
  for (const s of steps) {
    if (s.cumGrams == null) continue;
    if (s.cumGrams <= cum) return "milestones do not increase";
    if (stepKind(s) !== "bypass") inVessel += s.addGrams ?? s.cumGrams - cum;
    cum = s.cumGrams;
  }
  if (Math.abs(cum - p.water) > 0.5) return "pour plan does not reach the water";
  if (steps.some((s) => s.tempC != null && s.tempC !== p.tempC)) return "staged temperature (single-temperature rule)";
  if (!["aeropress", "clever"].includes(map.brewer)) {
    // A rest over LONG_DESIGNED_WAIT_SEC between two pours is a stalled brew on
    // a percolation brewer (validateRecipe's dead-gap rule); such a transcription
    // would be dropped by the app's own guard, so it does not enter.
    let rest = 0;
    let sawPour = false;
    for (const s of steps) {
      const kind = stepKind(s);
      if (kind === "pour" && s.cumGrams != null) {
        if (sawPour && rest > LONG_DESIGNED_WAIT_SEC) return `rest over ${LONG_DESIGNED_WAIT_SEC} s between pours (dead gap)`;
        sawPour = true;
        rest = 0;
      } else if (sawPour && kind !== "done" && s.windowSec != null) rest += s.windowSec;
    }
  }
  const cap = CAPS[map.brewer];
  if (cap && inVessel > cap) return `water over the ${map.brewer} cap (${cap} ml)`;
  const floor = FLOORS[map.brewer];
  if (floor && p.water < floor) return `water under the ${map.brewer} floor (${floor} ml)`;
  return null;
}

export function stepKind(s) {
  const l = (s.label ?? "").toLowerCase();
  const t = (s.text ?? "").toLowerCase();
  if (l === "done") return "done";
  if (l === "bypass" || /bypass water/.test(t)) return "bypass";
  if (l === "bloom" || l === "pour" || l === "fill") return "pour";
  if (l === "swirl") return /\bstir\b/.test(t) && !/swirl/.test(t) ? "stir" : "swirl";
  if (l === "stir") return "stir";
  if (l === "press") return "press";
  if (l === "flip" || l === "invert" || /\bflip\b/.test(t)) return "flip";
  if (/\blift\b|remove the dripper|pull up/.test(t)) return "drain";
  if (l === "steep" || l === "wait" || l === "prepare" || l === "rest") return "wait";
  return s.cumGrams != null ? "pour" : "wait";
}

/** Signature of a clone family: author + name + dose + water + milestones. */
export function cloneKey(p) {
  return [p.author, p.name, p.dose, p.water, p.steps.map((s) => `${s.startSec}:${s.cumGrams ?? ""}`).join("|")].join("#").toLowerCase();
}
export function dedupeClones(list) {
  const best = new Map();
  for (const p of list) {
    const k = cloneKey(p);
    const prev = best.get(k);
    if (!prev || CATEGORY_PRIORITY.indexOf(p.category) < CATEGORY_PRIORITY.indexOf(prev.category)) best.set(k, p);
  }
  return [...best.values()];
}

export function normalizeText(s) {
  return String(s ?? "").toLowerCase().replace(/[’‘`´]/g, "'").replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
}
export function slug(s) {
  return String(s).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Already in the corpus: same name, or same person + brewer + water ±10 %. */
export function corpusDuplicate(p, brewer, existing) {
  const name = normalizeText(p.name);
  const person = normalizeText(p.author);
  for (const r of existing) {
    if (normalizeText(r.name) === name && normalizeText(r.attribution?.person ?? "") === person) return r.id;
    if (normalizeText(r.attribution?.person ?? "") === person && r.brewer === brewer && Math.abs(r.water.grams - p.water) <= p.water * 0.1) return r.id;
  }
  return null;
}

// ── 3. A corpus entry ────────────────────────────────────────────────────────

const BREWER_LABEL = { v60: "V60", aeropress: "AeroPress", clever: "Clever", "kalita-wave": "Kalita", chemex: "Chemex", "orea-v4-wide": "Orea Wide", "origami-cone": "Origami cone", "origami-wave": "Origami wave" };
const GOAL_BY_TAG = { balanced: "balanced", sweet: "sweetness-forward", bright: "high-clarity", clean: "high-clarity", juicy: "high-clarity", "full-bodied": "body-forward", heavy: "body-forward", floral: "aromatic", aromatic: "aromatic" };
const ROAST_BY_TAG = { light: "light", medium: "medium", dark: "dark", "medium-light": "medium-light", "medium-dark": "medium-dark" };

export function toGotaRecipe(p, map, nowIso) {
  const steps = p.steps.filter((s) => s.startSec != null);
  const isImmersion = map.brewer === "aeropress" || map.brewer === "clever";
  const kinds = steps.map(stepKind);
  const lastPour = kinds.map((k, i) => (k === "pour" && steps[i].cumGrams != null ? i : -1)).reduce((a, b) => Math.max(a, b), -1);
  const seq = [];
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const kind = kinds[i];
    if (kind === "done") continue;
    const next = steps[i + 1];
    const windowSec = next && next.startSec != null ? next.startSec - s.startSec : null;
    const step = { label: s.label || (kind === "pour" ? "Pour" : kind), action: kind };
    if ((kind === "pour" || kind === "bypass") && s.cumGrams == null) step.action = "wait"; // a "pour" without a measure chip is narration, not water
    if (step.action === "pour" || step.action === "bypass") step.waterGramsAtEnd = s.cumGrams;
    // Pour + rest in one step (the corpus convention): a pour's duration is
    // the published window to the next step. The LAST pour of a percolation
    // recipe stays untimed — its window runs into the drawdown and Gota's own
    // pour seconds are not used — and what follows it is the published drain.
    const timed = isImmersion || i < lastPour || (kind !== "pour" && i < lastPour);
    if (timed && windowSec != null && windowSec > 0) step.durationSec = windowSec;
    if (!isImmersion && i > lastPour && kind !== "pour") delete step.durationSec;
    if (s.text) step.notes = s.text;
    seq.push(step);
  }
  if (!isImmersion && lastPour >= 0) {
    const lp = steps[lastPour];
    const after = steps[lastPour + 1];
    const pourEnd = after && after.startSec != null ? after.startSec : lp.startSec;
    const drainSec = p.totalSec - pourEnd;
    if (drainSec > 0) seq.push({ label: "Drawdown", action: "drain", durationSec: drainSec, notes: "Finish when the coffee stops dripping (the published total)." });
  }

  const pours = seq.filter((s) => s.action === "pour");
  const body = [p.description, ...steps.map((s) => s.text)].join(" ").toLowerCase();
  const techniques = [];
  if (pours.length && /bloom/i.test(pours[0].label) && pours[0].waterGramsAtEnd <= p.water * 0.3) techniques.push("bloom");
  if (pours.length >= 3) techniques.push("pulse-pouring");
  if (pours.length === 2 && techniques.includes("bloom")) techniques.push("continuous-pour");
  if (/spiral/.test(body)) techniques.push("spiral-pour");
  if (/\bcent(re|er)\b/.test(body)) techniques.push("central-pour");
  if (isImmersion) techniques.push("immersion-steep");
  if (map.brewer === "aeropress" && /invert/.test(body)) techniques.push("aeropress-inversion");
  if (seq.some((s) => s.action === "bypass")) techniques.push("concentrate-and-bypass");
  if (seq.some((s) => s.action === "swirl") && !seq.some((s) => s.action === "stir")) techniques.push("swirl-not-stir");

  const bestFor = {};
  const roasts = [...new Set(p.tags.map((t) => ROAST_BY_TAG[t]).filter(Boolean))];
  const goals = [...new Set(p.tags.map((t) => GOAL_BY_TAG[t]).filter(Boolean))];
  if (roasts.length) bestFor.roastLevels = roasts;
  if (goals.length) bestFor.goals = goals;

  const ratio = `1:${(p.water / p.dose).toFixed(1).replace(/\.0$/, "")}`;
  const lastName = p.author.split(/\s+/).pop();
  const brewerLabel = BREWER_LABEL[map.brewer] ?? map.brewer;
  const catSlug = slug(p.url.split("/en/recipes/")[1] ?? p.category + "-" + p.name);
  const sources = [{ type: "article", citation: `Gota (gota.cafe) — "${p.name}" for ${p.category} by ${p.author}, transcribed by Gota from ${p.originator.host}`, url: p.url }];
  if (p.originator.url && !/gota\.cafe/.test(p.originator.url)) {
    sources.push({ type: /youtu/.test(p.originator.url) ? "video" : "article", citation: `${p.author} — the originator page Gota names (${p.originator.host}); not cross-checked by a session`, url: p.originator.url });
  }
  return {
    id: slug(`gota-${catSlug}`),
    name: `${p.name} (${p.author}, ${p.category})`,
    shortName: lastName.toLowerCase() === brewerLabel.split(" ")[0].toLowerCase() ? `${brewerLabel} "${p.name}" (Gota)` : `${lastName} ${brewerLabel} (Gota)`,
    attribution: { person: p.author, affiliation: "via Gota" },
    category: "reference",
    brewer: map.brewer,
    ...(map.brewerNotes ? { brewerNotes: map.brewerNotes } : {}),
    dose: { grams: p.dose },
    water: { grams: p.water, ratio },
    temperature: { celsius: p.tempC },
    grind: { description: p.grindWord ? `${p.grindWord} (Gota's word; no grinder setting published)` : "not stated — a measurement brew" },
    pourSequence: seq,
    totalTimeSec: p.totalSec,
    techniques: techniques.filter((t) => TECHNIQUE_IDS_USED.includes(t)),
    bestFor,
    teaches: p.description || `${p.author}'s ${brewerLabel} recipe at ${p.water} g, as Gota transcribed it.`,
    science: "Mechanism not stated by Gota; the originator's own page may say more.",
    whenToUse: `${/^[aeiou]/i.test(brewerLabel) ? "An" : "A"} ${brewerLabel} recipe near ${p.water} g, transcribed by Gota from ${p.originator.host}.`,
    sources,
    verified: false,
    notes: `Imported from gota.cafe on ${nowIso.slice(0, 10)} by scripts/gota-import.mjs. Gota names ${p.originator.host} as the originator; NOT cross-checked against it by a session. Gota's own pour seconds were dropped; each step's duration is the published window to the next step, so the clock is the published one.`,
  };
}

export function renderGotaFile(entries) {
  const header = `// GENERATED by scripts/gota-import.mjs — do not hand-edit.
//
// Recipes transcribed by gota.cafe (a recipe-timer app) from named
// originators, imported deterministically (no model call) with the filters
// described in the script: only the owner's brewers inside their vessel caps,
// a named author, a named originator host, one copy per clone family, nothing
// the corpus already had. Every entry is \`verified: false\` and says so: Gota
// is an aggregator (CLAUDE.md "never fabricate" — an aggregator is an index
// pointer); the attribution reads "<author> (via Gota)". Gota's own per-pour
// seconds were dropped; the published clock is kept as step windows. No
// \`addedAt\` on purpose — a bulk import must not wear "[NEW this month]".
import type { Recipe } from "./types";

export const GOTA_RECIPES: Recipe[] = `;
  return header + JSON.stringify(entries, null, 2) + ";\n";
}

// ── 4. Main ──────────────────────────────────────────────────────────────────

const failures = new Map();
const CACHE_DIR = process.env.GOTA_CACHE || "";
async function fetchText(url, tries = 5) {
  const cacheFile = CACHE_DIR ? path.join(CACHE_DIR, slug(url) + ".html") : "";
  if (cacheFile) {
    const hit = await readFile(cacheFile, "utf8").catch(() => null);
    if (hit) return hit;
  }
  let last = "network";
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": UA }, redirect: "follow" });
      if (res.ok) {
        const body = await res.text();
        if (cacheFile) await writeFile(cacheFile, body, "utf8").catch(() => {});
        return body;
      }
      last = String(res.status);
      if (res.status !== 429 && res.status < 500) break;
    } catch {
      last = "network";
    }
    await new Promise((r) => setTimeout(r, 4000 * (i + 1)));
  }
  failures.set(last, (failures.get(last) ?? 0) + 1);
  return null;
}

async function loadCorpus() {
  const dir = await mkdtemp(path.join(tmpdir(), "gota-"));
  const out = path.join(dir, "bundle.mjs");
  await build({
    stdin: {
      contents: `export { ALL_RECIPES } from ${JSON.stringify(path.join(ROOT, "src/lib/knowledge/recipes/index.ts"))};`,
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
  const K = await import(pathToFileURL(out).href);
  // The corpus WITHOUT the previous Gota file: the import is idempotent.
  return K.ALL_RECIPES.filter((r) => !r.id.startsWith("gota-"));
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity;
  const nowIso = new Date().toISOString();

  const sm = await fetchText(SITEMAP);
  if (!sm) throw new Error("sitemap unreachable");
  const urls = [...sm.matchAll(/<loc>(https:\/\/gota\.cafe\/en\/recipes\/[^/<]+\/[^/<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => !u.includes("/recipes/category/")).slice(0, limit);
  console.log(`Gota sitemap: ${urls.length} recipe pages`);

  const parsed = [];
  let failed = 0;
  let next = 0;
  await Promise.all(
    Array.from({ length: WORKERS }, async () => {
      while (next < urls.length) {
        const u = urls[next++];
        const html = await fetchText(u);
        const p = html ? parseGotaPage(html, u) : null;
        if (p) parsed.push(p);
        else failed++;
        await new Promise((r) => setTimeout(r, 200));
      }
    }),
  );
  console.log(`parsed ${parsed.length}, unreadable ${failed}${failed ? ` (${[...failures.entries()].map(([k, n]) => `${k}: ${n}`).join(", ")})` : ""}`);

  const existing = await loadCorpus();
  const drops = new Map();
  const drop = (why) => drops.set(why, (drops.get(why) ?? 0) + 1);
  const kept = [];
  for (const p of parsed) {
    const map = mapCategory(p);
    const why = dropReason(p, map);
    if (why) {
      drop(why);
      continue;
    }
    kept.push({ p, map });
  }
  const before = kept.length;
  const unique = dedupeClones(kept.map((k) => k.p));
  const uniqueSet = new Set(unique);
  const afterClones = kept.filter((k) => uniqueSet.has(k.p));
  if (before - afterClones.length) drops.set("clone of another kept entry", before - afterClones.length);

  const entries = [];
  const ids = new Set();
  for (const { p, map } of afterClones) {
    const dup = corpusDuplicate(p, map.brewer, existing);
    if (dup) {
      drop("already in the corpus");
      continue;
    }
    const r = toGotaRecipe(p, map, nowIso);
    if (ids.has(r.id)) {
      drop("duplicate id");
      continue;
    }
    ids.add(r.id);
    entries.push(r);
  }
  entries.sort((a, b) => a.id.localeCompare(b.id));

  console.log("\nDROPPED:");
  for (const [why, n] of [...drops.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${why}`);
  console.log(`\nKEPT ${entries.length}:`);
  const cells = new Map();
  for (const r of entries) {
    for (const a of [250, 350, 450, 500, 750]) if (Math.abs(r.water.grams - a) <= a * 0.2) cells.set(`${r.brewer} ${a}`, (cells.get(`${r.brewer} ${a}`) ?? 0) + 1);
  }
  for (const [k, n] of [...cells.entries()].sort()) console.log(`  ${k.padEnd(22)} ${n}`);

  if (dryRun) {
    console.log("\n--dry-run: nothing written");
    return;
  }
  const file = path.join(ROOT, GOTA_PATH);
  const previous = await readFile(file, "utf8").catch(() => null);
  await writeFile(file, renderGotaFile(entries), "utf8");
  const run = (cmd, a) => {
    try {
      execFileSync(cmd, a, { cwd: ROOT, stdio: "pipe" });
      return null;
    } catch (e) {
      return `${e.stdout ?? ""}\n${e.stderr ?? ""}`;
    }
  };
  const validatorErr = run("node", ["tests/recipes/validate.mjs"]);
  const tscErr = validatorErr ? null : run("npx", ["tsc", "--noEmit"]);
  if (validatorErr || tscErr) {
    if (previous != null) await writeFile(file, previous, "utf8");
    console.log(`\nthe written entries failed ${validatorErr ? "the corpus validator" : "tsc"} — file restored`);
    console.log((validatorErr ?? tscErr).slice(-4000));
    process.exitCode = 1;
    return;
  }
  console.log(`\nValidator + tsc green; ${GOTA_PATH} written with ${entries.length} entries.`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
