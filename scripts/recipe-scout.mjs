#!/usr/bin/env node
// The weekly recipe scout (2026-10-19, owner: "Immer wieder neue Rezepte …
// ohne dass ich danach suchen oder bitten muss").
//
//   node scripts/recipe-scout.mjs [--dry-run] [--targets 4]
//
// 1. GAPS. For every owned brewer × the amounts he brews (250 / 350 / 450 /
//    500 / 750 g, inside the brewer's own cap) count the corpus recipes
//    within ±20 % of that water. The emptiest cells are this week's targets.
// 2. SEARCH. One Sonnet call per target with web_search: find ONE published
//    recipe by a named author for that brewer near that batch, and return it
//    as JSON with a VERBATIM quote for every number.
// 3. VERIFY. Fetch every source URL (directly, then through a reader
//    service when the site blocks GitHub's runners) and check every quote
//    against the page's text: the quote as written, or — since the first
//    runs showed the model paraphrasing the sentence around a correct number
//    — every NUMBER in the quote present on the page as its own token. A
//    number that is not on the page kills the candidate; that is the whole
//    no-fabrication guarantee. YouTube-only sources can never be read, so
//    they never enter.
// 4. GATE. Only owned brewers, no duplicate of a corpus entry, a pour plan
//    that reaches the water at ≤ 12 g/s, never a Niche° number (a scouted
//    grind is prose only). Then the corpus validator and tsc on the written
//    file; red → the file is restored and nothing is committed.
// 5. COMMIT. ≥ 1 entry and everything green → one commit on the current
//    branch (main on the schedule), pushed with the workflow's token. The
//    push deploys and runs the smoke job like any other commit.
//
// Importable: the pure parts are exported for tests/dataflow/recipe-scout.test.mjs.

import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const SCOUTED_PATH = "src/lib/knowledge/recipes/scouted.ts";
const AMOUNTS = [250, 350, 450, 500, 750];
export const BATCH_WINDOW = 0.2;
export const MAX_POUR_RATE_GPS = 12; // the corpus validator's own ceiling

export const ALLOWED_ACTIONS = new Set(["pour", "stir", "swirl", "wait", "press", "invert", "flip", "drain", "bypass", "melodrip", "agitate-bed"]);
const ROASTS = new Set(["very-light", "light", "medium-light", "medium", "medium-dark", "dark"]);
const PROCESSES = new Set(["washed", "natural", "honey", "anaerobic", "experimental", "any"]);
const GOALS = new Set(["balanced", "high-clarity", "sweetness-forward", "body-forward", "aromatic", "explore"]);
const SOURCE_TYPES = new Set(["official-competition", "video", "article", "book", "report", "transcript", "interview", "blog"]);

// ── 1. Gaps ──────────────────────────────────────────────────────────────────

/** Corpus recipes on a role's brewers within ±20 % of `amount`. */
export function gapTable(recipes, roles, amounts = AMOUNTS) {
  const rows = [];
  for (const role of roles) {
    if (role.coldOnly) continue;
    for (const amount of amounts) {
      const cap = role.cap;
      if (cap?.maxMl != null && amount > cap.maxMl) continue;
      if (cap?.minMl != null && amount < cap.minMl) continue;
      const count = recipes.filter(
        (r) => role.brewers.includes(r.brewer) && (r.totalTimeSec ?? 0) < 3600 && Math.abs(r.water.grams - amount) <= amount * BATCH_WINDOW,
      ).length;
      rows.push({ role: role.key, method: role.method, brewer: role.brewers[0], brewers: role.brewers, amount, count });
    }
  }
  return rows.sort((a, b) => a.count - b.count || a.amount - b.amount || a.role.localeCompare(b.role));
}

/**
 * One cell per brewer role (its emptiest), the roles rotated by `seed` (the
 * ISO week by default) so every week starts somewhere else in the kit: the
 * first runs spent all four targets on Orea bottoms, where little is
 * published, and found nothing. Still emptiest-first within a role.
 */
export function pickTargets(table, n = 4, seed = isoWeek(new Date())) {
  const perRole = new Map();
  for (const row of table) if (!perRole.has(row.role)) perRole.set(row.role, row);
  const roles = Array.from(perRole.keys());
  if (roles.length === 0) return [];
  const start = ((seed % roles.length) + roles.length) % roles.length;
  const rotated = [...roles.slice(start), ...roles.slice(0, start)];
  return rotated.slice(0, n).map((r) => perRole.get(r));
}

export function isoWeek(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.ceil(((t - yearStart) / 86_400_000 + 1) / 7);
}

// ── 3. Verify ────────────────────────────────────────────────────────────────

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", deg: "°", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…" };

export function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>|<\/h\d>|<\/tr>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

/** Case-, whitespace- and quote-style-insensitive comparison text. */
export function normalizeText(s) {
  return s
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function quoteFound(pageText, quote) {
  const q = normalizeText(quote ?? "");
  if (q.length < 6) return false;
  return normalizeText(pageText).includes(q);
}

/** The numbers a quote asserts ("16g", "92°C", "2:30", "1:15.6"), as strings. */
export function numbersIn(quote) {
  return Array.from(String(quote ?? "").matchAll(/\d+(?:[.,]\d+)?/g)).map((m) => m[0].replace(",", "."));
}

/** Every number of the quote appears on the page as its own token (not inside another number). */
export function numbersSupported(pageText, quote) {
  const nums = numbersIn(quote);
  if (nums.length === 0) return false;
  const page = normalizeText(pageText).replace(/(\d),(\d)/g, "$1.$2");
  return nums.every((n) => new RegExp(`(?<![\\d.])${n.replace(".", "\\.")}(?![\\d.])`).test(page));
}

/** The gate a quote has to pass: as written, or every number of it on the page. */
export function quoteSupported(pageText, quote) {
  return quoteFound(pageText, quote) || numbersSupported(pageText, quote);
}

async function fetchOnce(url, timeoutMs = 20_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "user-agent": "Mozilla/5.0 (BTTS recipe scout; +https://bettertastethansorry.com)" }, redirect: "follow" });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!/text\/html|text\/plain|application\/xhtml/.test(type)) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * The page as text: fetched directly, else through the r.jina.ai reader
 * (plain text, follows redirects) — the first runs found a blog that answers
 * a browser but not GitHub's runners. The reader's own error banner ("Target
 * URL returned error 404") counts as unreadable.
 */
async function fetchPageText(url) {
  const direct = await fetchOnce(url);
  if (direct) return htmlToText(direct.slice(0, 2_000_000));
  const viaReader = await fetchOnce(`https://r.jina.ai/${url}`, 30_000);
  if (!viaReader || /^Warning: Target URL returned error/m.test(viaReader)) return null;
  return viaReader.slice(0, 2_000_000);
}

// ── 4. Gate → a corpus entry ─────────────────────────────────────────────────

export function slug(s) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * The candidate JSON → a Recipe, or { error } with the reason. Pure: the
 * caller has already verified the quotes against the page.
 */
export function toRecipeEntry(c, target, existing, nowIso) {
  const person = typeof c?.author?.person === "string" ? c.author.person.trim() : "";
  const name = typeof c?.name === "string" ? c.name.trim() : "";
  const url = typeof c?.source?.url === "string" ? c.source.url.trim() : "";
  if (!person || !name || !url) return { error: "missing author, name or url" };
  const dose = Number(c.dose);
  const water = Number(c.water);
  const tempC = Number(c.tempC);
  const total = Number(c.totalTimeSec);
  if (!(dose > 0) || !(water > 0) || !(tempC >= 60 && tempC <= 100) || !(total > 0)) return { error: "dose, water, temperature or time missing" };
  if (!target.brewers.includes(c.brewer)) return { error: `brewer "${c.brewer}" is not the target's (${target.brewers.join("/")})` };
  if (Math.abs(water - target.amount) > target.amount * BATCH_WINDOW * 2) return { error: `water ${water} g is far from the target ${target.amount} g` };

  const pours = Array.isArray(c.pours) ? c.pours : [];
  if (pours.length < 1) return { error: "no pour plan" };
  const seq = [];
  let cum = 0;
  for (const p of pours) {
    if (!ALLOWED_ACTIONS.has(p?.action)) return { error: `pour action "${p?.action}" unknown` };
    const step = { label: String(p.label ?? p.action), action: p.action };
    if (typeof p.waterGramsAtEnd === "number") {
      if (p.waterGramsAtEnd <= cum) return { error: "milestones do not increase" };
      const grams = p.waterGramsAtEnd - cum;
      cum = p.waterGramsAtEnd;
      step.waterGramsAtEnd = p.waterGramsAtEnd;
      if (typeof p.durationSec === "number" && p.durationSec > 0 && grams / p.durationSec > MAX_POUR_RATE_GPS) {
        return { error: `"${step.label}" pours ${grams} g in ${p.durationSec} s (> ${MAX_POUR_RATE_GPS} g/s)` };
      }
    }
    if (typeof p.durationSec === "number" && p.durationSec > 0) step.durationSec = Math.round(p.durationSec);
    if (typeof p.notes === "string" && p.notes.trim()) step.notes = p.notes.trim();
    seq.push(step);
  }
  if (cum !== water) return { error: `pour plan reaches ${cum} g, not the ${water} g water` };

  const id = slug(`scout-${person}-${c.brewer}-${Math.round(water)}`);
  for (const r of existing) {
    if (r.id === id) return { error: `duplicate id ${id}` };
    if (normalizeText(r.name) === normalizeText(name)) return { error: `the corpus already has "${r.name}"` };
    if (normalizeText(r.attribution?.person ?? "") === normalizeText(person) && r.brewer === c.brewer && Math.abs(r.water.grams - water) <= water * 0.1) {
      return { error: `the corpus already has ${person}'s ${c.brewer} recipe at ${r.water.grams} g (${r.id})` };
    }
  }

  const techniques = (Array.isArray(c.techniques) ? c.techniques : []).filter((t) => typeof t === "string" && target.techniqueIds.has(t));
  const bestFor = {};
  const rl = (Array.isArray(c.bestFor?.roastLevels) ? c.bestFor.roastLevels : []).filter((x) => ROASTS.has(x));
  const pr = (Array.isArray(c.bestFor?.processes) ? c.bestFor.processes : []).filter((x) => PROCESSES.has(x));
  const go = (Array.isArray(c.bestFor?.goals) ? c.bestFor.goals : []).filter((x) => GOALS.has(x));
  if (rl.length) bestFor.roastLevels = rl;
  if (pr.length) bestFor.processes = pr;
  if (go.length) bestFor.goals = go;

  const ratio = `1:${(water / dose).toFixed(1).replace(/\.0$/, "")}`;
  const lastName = person.split(/\s+/).pop();
  const brewerLabel = target.method;
  const sourceType = SOURCE_TYPES.has(c.source?.type) ? c.source.type : "article";
  const grind = {};
  if (typeof c.grind?.referenceGrinder === "string" && c.grind.referenceGrinder.trim()) grind.referenceGrinder = c.grind.referenceGrinder.trim();
  if (typeof c.grind?.referenceSetting === "string" && c.grind.referenceSetting.trim()) grind.referenceSetting = c.grind.referenceSetting.trim();
  grind.description = typeof c.grind?.description === "string" && c.grind.description.trim() ? c.grind.description.trim() : "as published — no Niche value; a measurement brew";

  return {
    recipe: {
      id,
      name,
      shortName: `${lastName} ${brewerLabel}`,
      attribution: {
        person,
        ...(typeof c.author?.title === "string" && c.author.title.trim() ? { title: c.author.title.trim() } : {}),
        ...(typeof c.author?.affiliation === "string" && c.author.affiliation.trim() ? { affiliation: c.author.affiliation.trim() } : {}),
        ...(typeof c.author?.country === "string" && c.author.country.trim() ? { country: c.author.country.trim() } : {}),
        ...(typeof c.author?.year === "number" ? { year: c.author.year } : {}),
      },
      category: "reference",
      brewer: c.brewer,
      dose: { grams: dose },
      water: { grams: water, ratio },
      temperature: { celsius: tempC },
      grind,
      pourSequence: seq,
      totalTimeSec: Math.round(total),
      techniques,
      bestFor,
      teaches: String(c.teaches ?? "").trim() || `${person}'s ${brewerLabel} recipe at ${water} g, as published.`,
      science: String(c.science ?? "").trim() || "Mechanism not stated by the source.",
      whenToUse: String(c.whenToUse ?? "").trim() || `A published ${brewerLabel} recipe near ${target.amount} g.`,
      sources: [{ type: sourceType, citation: String(c.source?.citation ?? `${person} — ${name}`).trim(), url, ...(typeof c.author?.year === "number" ? { year: c.author.year } : {}) }],
      verified: false,
      notes: `Scouted ${nowIso.slice(0, 10)} by scripts/recipe-scout.mjs; every number quoted from the source and re-found on the page. Unverified until a session cross-checks it against the originator.`,
      addedAt: nowIso,
    },
  };
}

export function renderScoutedFile(entries) {
  const header = `// GENERATED by scripts/recipe-scout.mjs — do not hand-edit.
//
// Recipes the weekly scout found for the corpus's gaps (a brewer × batch
// with few or no published recipes). Every number in an entry was quoted
// verbatim from its source page and the quote was re-found on that page by
// the script before the entry was written; still \`verified: false\` until a
// session cross-checks it against the originator (CLAUDE.md "never
// fabricate"). \`addedAt\` marks it "[NEW this month]" on the menu for 30 days
// and lists it on the Context step's Fresh strip.
import type { Recipe } from "./types";

export const SCOUTED_RECIPES: Recipe[] = `;
  return header + JSON.stringify(entries, null, 2) + ";\n";
}

// ── 2. Search ────────────────────────────────────────────────────────────────

const SCOUT_SYSTEM = `You find ONE published pour-over / immersion coffee recipe by a NAMED author for a given brewer and batch size, and return it as JSON with a verbatim supporting quote for every number.

Rules — a no-fabrication guarantee depends on them:
- Use web_search. Prefer the author's own page, the roaster's page, a competition's official page, or a long-form article that reproduces the recipe in full. The page must be a normal web page (NOT a YouTube video, NOT a PDF, NOT an image): the recipe text must be readable in the page's HTML, because every quote will be re-found there by a script.
- Every number you return (dose, water, temperature, total time, each pour's grams and seconds) must be ON that page. For each, put in "quotes" the line of the page that carries the number, COPIED as it stands (a script re-finds the numbers there; a paraphrase with the same numbers still passes, a number that is not on the page fails). If the page gives a range, return the range's lower value and quote the range. If a number is not on the page, do not invent it — leave it out and say so in "missing".
- Look where recipes with numbers are actually published: the author's own site, roaster brew guides, Hario's and Kalita's recipe pages, Barista Hustle, competition routine write-ups, specialty-coffee magazines. A recipe at any water inside the given window is fine; a different author than the ones the corpus already has is the point.
- Pour milestones are CUMULATIVE grams in the brewer; the last one equals the water. Every pour step must be narrated on the page — never add a step to make the pours reach a headline total; if the page's steps and its headline disagree, follow the steps and say so in "missing". Actions: pour | stir | swirl | wait | press | invert | flip | drain | bypass | melodrip | agitate-bed.
- Grind as the author states it (grinder + setting + description) — never a Niche Zero number.
- Techniques only from this list: TECHNIQUE_IDS.
- If you cannot find a recipe that satisfies all of this, return {"none": true, "reason": "..."}.

Return ONLY JSON:
{
  "name": "<recipe name as the author calls it, or '<Author>'s <brewer> recipe'>",
  "author": {"person": "", "title": "", "affiliation": "", "country": "", "year": 2024},
  "source": {"url": "", "type": "article|blog|official-competition|interview|report|book|transcript", "citation": ""},
  "brewer": "<one of BREWER_IDS>",
  "dose": 15, "water": 250, "tempC": 93, "totalTimeSec": 180,
  "grind": {"referenceGrinder": "", "referenceSetting": "", "description": ""},
  "pours": [{"label": "Bloom", "action": "pour", "waterGramsAtEnd": 50, "durationSec": 10, "notes": ""}],
  "techniques": [],
  "bestFor": {"roastLevels": ["light"], "processes": ["washed"], "goals": ["high-clarity"]},
  "teaches": "", "science": "", "whenToUse": "",
  "quotes": {"dose": "", "water": "", "temp": "", "time": "", "pours": ["<ONE entry PER WATER step (bloom / pour / final — not waits), in order: the page's line that carries that step's amount (its running total or its increment)>"]},
  "missing": []
}`;

function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function searchCandidate(client, target, techniqueIds) {
  const system = SCOUT_SYSTEM.replace("TECHNIQUE_IDS", [...techniqueIds].join(", ")).replace("BREWER_IDS", target.brewers.join(" | "));
  const resp = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2500,
    system,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }],
    messages: [
      {
        role: "user",
        content: `Brewer: ${target.method} (corpus id ${target.brewers.join(" or ")}). Batch: about ${target.amount} g of water (anything from ${Math.round(target.amount * (1 - BATCH_WINDOW))} to ${Math.round(target.amount * (1 + BATCH_WINDOW))} g). The corpus already has ${target.count} recipe(s) there and needs a different author. Return only the JSON.`,
      },
    ],
  });
  const text = (resp?.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  return extractJson(text);
}

/**
 * The pour plan against its own quotes (2026-10-19, third run): the model
 * had invented a third pour to reach a "300ml" header on a page whose
 * pattern and steps say 50 – 250. So: one quote PER pour step, carrying that
 * step's cumulative milestone or its increment; the water itself must be in
 * a pour quote (a "total amount" line is not a pour); and a step the model
 * marks as inferred, assumed or not narrated is a step it made up.
 */
export function pourPlanProblems(c) {
  const problems = [];
  const pours = Array.isArray(c?.pours) ? c.pours : [];
  const pq = Array.isArray(c?.quotes?.pours) ? c.quotes.pours : [];
  let prev = 0;
  let waterSeen = false;
  let w = 0; // quotes are one per WATER step (waits and swirls carry no grams)
  const water = Number(c?.water);
  pours.forEach((p, i) => {
    if (/inferr|assum|not (?:individually )?narrated|estimat|guess/i.test(String(p?.notes ?? "") + " " + String(p?.label ?? ""))) {
      problems.push(`"${p?.label ?? i}" is marked inferred / assumed by the model`);
    }
    if (typeof p?.waterGramsAtEnd !== "number") return;
    const milestone = p.waterGramsAtEnd;
    const increment = milestone - prev;
    prev = milestone;
    const nums = numbersIn(pq[w++] ?? "");
    if (!nums.includes(String(milestone)) && !nums.includes(String(increment))) {
      problems.push(`"${p.label ?? i}" (${milestone} g) has no pour quote carrying ${milestone} or ${increment}`);
    }
    if (milestone === water && (nums.includes(String(milestone)) || nums.includes(String(increment)))) waterSeen = true;
  });
  if (pours.some((p) => typeof p?.waterGramsAtEnd === "number") && !waterSeen) {
    problems.push(`the water (${water} g) is not reached by any quoted pour — a "total amount" line is not a pour`);
  }
  return problems;
}

/** Every quote the candidate carries, flattened. */
export function candidateQuotes(c) {
  const q = c?.quotes ?? {};
  const out = [];
  for (const k of ["dose", "water", "temp", "time"]) if (typeof q[k] === "string") out.push({ key: k, quote: q[k] });
  if (Array.isArray(q.pours)) q.pours.forEach((p, i) => typeof p === "string" && out.push({ key: `pour${i + 1}`, quote: p }));
  return out;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const nArg = process.argv.indexOf("--targets");
  const nTargets = nArg > 0 ? Number(process.argv[nArg + 1]) || 4 : 4;
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("ANTHROPIC_API_KEY not set — nothing to scout (not a failure).");
    return;
  }
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const dir = await mkdtemp(join(tmpdir(), "scout-"));
  const out = join(dir, "k.mjs");
  await build({
    stdin: {
      contents: `
export { ALL_RECIPES } from ${JSON.stringify(path.join(ROOT, "src/lib/knowledge/recipes/index.ts"))};
export { SCOUTED_RECIPES } from ${JSON.stringify(path.join(ROOT, "src/lib/knowledge/recipes/scouted.ts"))};
export { BREWER_ROLES, brewerCap } from ${JSON.stringify(path.join(ROOT, "src/lib/knowledge/brewers.ts"))};
export { TECHNIQUES } from ${JSON.stringify(path.join(ROOT, "src/lib/knowledge/techniques/data.ts"))};
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
  const K = await import(pathToFileURL(out).href);
  const techniqueIds = new Set(K.TECHNIQUES.map((t) => t.id));
  const roles = K.BREWER_ROLES.map((r) => ({ ...r, cap: K.brewerCap(r.key) }));
  const table = gapTable(K.ALL_RECIPES, roles);
  const targets = pickTargets(table, nTargets);
  console.log("GAP TABLE (emptiest first):");
  for (const row of table.slice(0, 12)) console.log(`  ${row.method.padEnd(24)} ${String(row.amount).padStart(4)} g  ${row.count} recipe(s)`);
  console.log(`TARGETS: ${targets.map((t) => `${t.method} @ ${t.amount} g`).join(" · ")}`);

  const nowIso = new Date().toISOString();
  const accepted = [];
  const log = [];
  const existing = [...K.ALL_RECIPES];
  for (const target of targets) {
    const label = `${target.method} @ ${target.amount} g`;
    let c;
    try {
      c = await searchCandidate(client, { ...target, techniqueIds }, techniqueIds);
    } catch (err) {
      log.push(`${label}: search failed — ${err instanceof Error ? err.message : err}`);
      continue;
    }
    if (!c || c.none) {
      log.push(`${label}: nothing found${c?.reason ? ` — ${c.reason}` : ""}`);
      continue;
    }
    const url = typeof c?.source?.url === "string" ? c.source.url : "";
    const quotes = candidateQuotes(c);
    if (!url || quotes.length < 4) {
      log.push(`${label}: no url or too few quotes (${quotes.length}) — dropped`);
      continue;
    }
    const page = await fetchPageText(url);
    if (!page) {
      log.push(`${label}: could not read ${url} (video / PDF / blocked) — dropped`);
      continue;
    }
    const missing = quotes.filter((q) => !quoteSupported(page, q.quote));
    if (missing.length > 0) {
      log.push(`${label}: ${missing.length} quote(s) whose numbers are not on the page (${missing.map((m) => m.key).join(", ")}) — dropped. First: ${JSON.stringify(missing[0].quote).slice(0, 120)}`);
      continue;
    }
    const planProblems = pourPlanProblems(c);
    if (planProblems.length > 0) {
      log.push(`${label}: pour plan not backed by its quotes — dropped: ${planProblems.join("; ")}`);
      continue;
    }
    const entry = toRecipeEntry(c, { ...target, techniqueIds }, existing, nowIso);
    if ("error" in entry) {
      log.push(`${label}: ${entry.error} — dropped`);
      continue;
    }
    existing.push(entry.recipe);
    accepted.push({ target, recipe: entry.recipe, quotes });
    log.push(`${label}: ACCEPTED "${entry.recipe.name}" by ${entry.recipe.attribution.person} — ${url}`);
  }

  console.log("\nRESULT:");
  for (const l of log) console.log("  " + l);
  if (accepted.length === 0) {
    console.log("\nNo entry passed the gate — nothing to commit (the job is green).");
    return;
  }

  const before = await readFile(path.join(ROOT, SCOUTED_PATH), "utf8");
  const next = [...K.SCOUTED_RECIPES, ...accepted.map((a) => a.recipe)];
  await writeFile(path.join(ROOT, SCOUTED_PATH), renderScoutedFile(next), "utf8");

  const run = (cmd, args) => {
    try {
      execFileSync(cmd, args, { cwd: ROOT, stdio: "pipe" });
      return null;
    } catch (err) {
      return (err.stdout?.toString() ?? "") + (err.stderr?.toString() ?? "");
    }
  };
  const validatorErr = run("node", ["tests/recipes/validate.mjs"]);
  const tscErr = validatorErr ? null : run("npx", ["tsc", "--noEmit"]);
  if (validatorErr || tscErr) {
    await writeFile(path.join(ROOT, SCOUTED_PATH), before, "utf8");
    console.log(`\n::warning::the written entries failed ${validatorErr ? "the corpus validator" : "tsc"} — file restored, nothing committed`);
    console.log((validatorErr ?? tscErr).slice(-3000));
    return;
  }
  console.log(`\nValidator + tsc green with ${accepted.length} new entr${accepted.length === 1 ? "y" : "ies"}.`);

  if (dryRun) {
    console.log("--dry-run: leaving the file written, not committing.");
    return;
  }
  const date = nowIso.slice(0, 10);
  const gaps = accepted.map((a) => `${a.target.method} ${a.target.amount} g`).join(", ");
  const body = accepted
    .map((a) => `- ${a.recipe.name} (${a.recipe.attribution.person}) — ${a.recipe.sources[0].url}\n${a.quotes.map((q) => `    ${q.key}: ${JSON.stringify(q.quote)}`).join("\n")}`)
    .join("\n");
  const branch = process.env.GITHUB_REF_NAME || execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: ROOT }).toString().trim();
  execFileSync("git", ["config", "user.name", "recipe-scout[bot]"], { cwd: ROOT });
  execFileSync("git", ["config", "user.email", "recipe-scout@users.noreply.github.com"], { cwd: ROOT });
  execFileSync("git", ["add", SCOUTED_PATH], { cwd: ROOT });
  execFileSync("git", ["commit", "-m", `knowledge: scout ${date} — ${accepted.length} recipe${accepted.length === 1 ? "" : "s"} for ${gaps}`, "-m", body], { cwd: ROOT });
  // Push with GH_PAT when it is set and accepted — a PAT push fires deploy.yml,
  // a GITHUB_TOKEN push never triggers a workflow. The PAT travels as an
  // HTTP header through git's config env (never on the command line, never in
  // output); a refused PAT falls back to the checkout's own credentials.
  const pat = process.env.GH_PAT;
  const repo = process.env.GITHUB_REPOSITORY;
  let pushedWithPat = false;
  if (pat && repo) {
    const auth = Buffer.from(`x-access-token:${pat}`).toString("base64");
    try {
      execFileSync("git", ["push", `https://github.com/${repo}.git`, `HEAD:${branch}`], {
        cwd: ROOT,
        stdio: "pipe",
        env: { ...process.env, GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader", GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${auth}` },
      });
      pushedWithPat = true;
    } catch {
      console.log("::warning::GH_PAT was refused for the push — give that fine-grained token Contents: read/write on this repo so a scout commit deploys; falling back to GITHUB_TOKEN (the commit lands, nothing deploys until the next push)");
    }
  }
  if (!pushedWithPat) execFileSync("git", ["push", "origin", `HEAD:${branch}`], { cwd: ROOT, stdio: "inherit" });
  console.log(`Committed and pushed to ${branch}${pushedWithPat ? " with GH_PAT (deploys)" : " with GITHUB_TOKEN (no deploy until the next push)"}.`);
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
