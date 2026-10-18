/**
 * The Context step's free-text field — "Wishes for this brew" (2026-10-18).
 *
 * The owner wants to steer a single recommendation in his own words: a recipe
 * ("Ten Pour Recipe by Kasuya"), an exclusion ("KEIN Clever Dripper"), a fixed
 * number ("92°"), or anything else. A sentence handed to the model as prose is
 * a wish it may ignore, so the parts that CAN be enforced are pulled out first
 * and enforced in code:
 *
 *   1. ONE small Haiku call turns the text into structure (recipe mentions,
 *      excluded / required brewers from a fixed vocabulary, explicit numbers,
 *      everything else as an instruction). Any failure → the raw text goes on
 *      as the instruction; a brew is never blocked by this.
 *   2. Recipe mentions are resolved DETERMINISTICALLY against the corpus
 *      (resolveRecipeMention) — the model never decides which published recipe
 *      a name means. Unresolved → "Own recipe in the spirit of X", unverified.
 *   3. recommend.ts applies it: excluded brewers leave the menu and are
 *      repaired/dropped if the model uses them anyway; a resolved recipe is
 *      put on the menu (scaled) and candidate 1 must adapt it; explicit numbers
 *      are written onto both candidates after the guard chain.
 */
import Anthropic from "@anthropic-ai/sdk";
import { ALL_RECIPES, normName, type Recipe } from "../knowledge/recipes";
import { brewersFromMethod } from "../knowledge/recipes/helpers";
import type { BrewerType } from "../knowledge/recipes";
import type { BrewRecipe } from "../types/session";
import { batchWithinWindow } from "../recipe/batchWindow";

import { USER_REQUEST_MAX_CHARS } from "../flow/userRequestLimit";

export { USER_REQUEST_MAX_CHARS };

/** The brewer vocabulary the parser may answer with → the method string the
 * rest of the engine understands (brewersFromMethod resolves each). */
export const USER_BREWER_METHODS: Record<string, string> = {
  "V60": "V60",
  "Orea": "Orea",
  "Orea Fast": "Orea Fast",
  "Orea Apex": "Orea Apex",
  "Orea Classic": "Orea Classic",
  "Orea Open": "Orea Open",
  "Origami": "Origami",
  "Kalita Wave": "Kalita Wave",
  "Clever Dripper": "Clever Dripper",
  "AeroPress": "AeroPress",
  "Moccamaster": "Moccamaster",
  "Chemex": "Chemex",
};

export interface UserRequestParams {
  tempC?: number;
  /** Grind as the owner wrote it ("420°", "30 clicks") — unit-normalised later. */
  grind?: string;
  doseG?: number;
  /** Total brew water in grams — applied BEFORE generation as the target. */
  waterG?: number;
  /** Brew ratio 1:N → N. */
  ratio?: number;
}

export interface ParsedUserRequest {
  raw: string;
  recipeMentions: string[];
  excludeBrewers: string[];
  requireBrewer?: string;
  params: UserRequestParams;
  otherInstructions: string;
  /** false when the parser failed and the raw text is passed on as-is. */
  parsed: boolean;
}

export interface ResolvedUserRequest extends ParsedUserRequest {
  recipe: Recipe | null;
  unresolvedMentions: string[];
  excludedBrewerTypes: Set<BrewerType>;
}

/** What the recipe screen shows ("Taken into account: …"). Stored on the
 * Recommendation, so a saved session also records how the text was read. */
export interface UserRequestApplied {
  text: string;
  recipe?: string;
  excluded: string[];
  required?: string;
  params: UserRequestParams;
  unresolved: string[];
}

export function cleanUserRequest(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/\s+/g, " ").trim().slice(0, USER_REQUEST_MAX_CHARS);
}

function num(x: unknown, min: number, max: number): number | undefined {
  const n = typeof x === "number" ? x : typeof x === "string" ? Number(x.replace(",", ".")) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
}

/** Validate the parser's JSON. Unknown brewers are dropped, numbers range-
 * checked; anything malformed returns null (→ raw-text fallback). */
export function validateParsed(raw: string, json: unknown): ParsedUserRequest | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const strs = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()) : [];
  const known = (b: string) => Object.keys(USER_BREWER_METHODS).find((k) => k.toLowerCase() === b.toLowerCase());
  const p = (o.params && typeof o.params === "object" ? o.params : {}) as Record<string, unknown>;
  const params: UserRequestParams = {};
  const tempC = num(p.tempC, 70, 100);
  if (tempC !== undefined) params.tempC = tempC;
  if (typeof p.grind === "string" && p.grind.trim()) params.grind = p.grind.trim().slice(0, 20);
  else if (typeof p.grind === "number" && Number.isFinite(p.grind)) params.grind = String(p.grind);
  const doseG = num(p.doseG, 5, 120);
  if (doseG !== undefined) params.doseG = doseG;
  const waterG = num(p.waterG, 50, 1500);
  if (waterG !== undefined) params.waterG = waterG;
  const ratio = num(p.ratio, 5, 25);
  if (ratio !== undefined) params.ratio = ratio;
  const require = typeof o.requireBrewer === "string" ? known(o.requireBrewer) : undefined;
  return {
    raw,
    recipeMentions: strs(o.recipeMentions).slice(0, 3),
    excludeBrewers: Array.from(new Set(strs(o.excludeBrewers).map(known).filter((x): x is string => !!x))),
    ...(require ? { requireBrewer: require } : {}),
    params,
    otherInstructions: typeof o.otherInstructions === "string" ? o.otherInstructions.trim().slice(0, 400) : "",
    parsed: true,
  };
}

export function fallbackRequest(raw: string): ParsedUserRequest {
  return { raw, recipeMentions: [], excludeBrewers: [], params: {}, otherInstructions: raw, parsed: false };
}

const PARSER_PROMPT = (text: string) => `A coffee brewer typed a wish for ONE brew recommendation. Turn it into JSON. The text may be German or English.

Brewer vocabulary (use EXACTLY these strings): ${Object.keys(USER_BREWER_METHODS).join(", ")}.

Return ONLY this JSON object:
{
  "recipeMentions": [names of specific published recipes or recipe authors' methods the user wants, written as the user wrote them, e.g. "Ten Pour Recipe by Kasuya", "Hoffmann V60"],
  "excludeBrewers": [brewers from the vocabulary the user does NOT want],
  "requireBrewer": brewer from the vocabulary the user insists on for BOTH candidates, or null,
  "params": { "tempC": number|null, "grind": string|null (as written, e.g. "420°" or "30 clicks"), "doseG": number|null, "waterG": number|null (total brew water), "ratio": number|null (1:N → N) },
  "otherInstructions": everything else the user asked for, in English, short; "" if nothing
}

Rules: only extract what the text actually says — never add a value it does not state. A recipe named after a brewer ("Hoffmann V60") is a recipeMention, not requireBrewer. "kein"/"no"/"without"/"nicht" before a brewer → excludeBrewers.

Text: ${JSON.stringify(text)}`;

let client: Anthropic | null = null;

/** ONE Haiku call. Never throws: any failure → the raw text as the instruction. */
export async function parseUserRequest(text: string): Promise<ParsedUserRequest> {
  const raw = cleanUserRequest(text);
  if (!raw) return fallbackRequest("");
  try {
    client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const resp = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 400,
      messages: [{ role: "user", content: PARSER_PROMPT(raw) }],
    });
    const out = resp.content[0]?.type === "text" ? resp.content[0].text : "";
    const match = out.match(/\{[\s\S]*\}/);
    if (!match) return fallbackRequest(raw);
    return validateParsed(raw, JSON.parse(match[0])) ?? fallbackRequest(raw);
  } catch (err) {
    console.warn(`[recommend] user-request parse failed — raw text passed on: ${String((err as Error)?.message ?? err).slice(0, 120)}`);
    return fallbackRequest(raw);
  }
}

// ── Deterministic recipe resolution ─────────────────────────────────────────

const NUMBER_WORDS: Record<string, string> = {
  one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
  eleven: "11", twelve: "12",
  eins: "1", ein: "1", zwei: "2", drei: "3", vier: "4", fuenf: "5", funf: "5", sechs: "6", sieben: "7", acht: "8",
  neun: "9", zehn: "10", elf: "11", zwoelf: "12",
};

const STOP_WORDS = new Set([
  "recipe", "recipes", "rezept", "method", "methode", "by", "von", "the", "der", "die", "das", "nach", "style",
  "a", "an", "with", "mit", "please", "bitte", "s", "his", "sein", "like", "wie", "und", "and", "technique",
]);

function tokens(s: string): string[] {
  return normName(s.replace(/ü/g, "ue").replace(/ö/g, "oe").replace(/ä/g, "ae"))
    .split(" ")
    .map((t) => NUMBER_WORDS[t] ?? t)
    .filter((t) => t && !STOP_WORDS.has(t));
}

/**
 * The corpus recipe a free-text mention names, or null. Exact name/shortName
 * first; otherwise every meaningful token of the mention is looked up in the
 * recipe's name, shortName, id, author and brewer — at least 3/4 of them must
 * hit, and at least one hit must be in the recipe's own name/id (an author
 * alone is a family of recipes, not one). Ties → the entry published for this
 * batch (owner rule 2026-10-10: use the 2-cup, don't stretch the 1-cup), then
 * verified, then the shorter name (the plainer, canonical entry).
 */
export function resolveRecipeMention(
  mention: string,
  recipes: Recipe[] = ALL_RECIPES,
  targetWaterGrams?: number,
): Recipe | null {
  const q = normName(mention);
  if (!q) return null;
  const exact = recipes.filter((r) => normName(r.name) === q || normName(r.shortName ?? "") === q || r.id === mention.trim());
  if (exact.length) return exact.find((r) => r.verified) ?? exact[0];

  const qt = Array.from(new Set(tokens(mention)));
  if (!qt.length) return null;
  let best: { r: Recipe; score: number } | null = null;
  for (const r of recipes) {
    const own = new Set([...tokens(r.name), ...tokens(r.shortName ?? ""), ...r.id.split("-")]);
    const meta = new Set([...tokens(r.attribution?.person ?? ""), ...r.brewer.split("-")]);
    const ownHits = qt.filter((t) => own.has(t)).length;
    const hits = qt.filter((t) => own.has(t) || meta.has(t)).length;
    const coverage = hits / qt.length;
    if (ownHits === 0 || coverage < 0.75) continue;
    const fitsBatch = targetWaterGrams ? batchWithinWindow(r.water?.grams ?? 0, targetWaterGrams) : false;
    const score = coverage * 100 + ownHits * 2 + (fitsBatch ? 1 : 0) + (r.verified ? 0.5 : 0) - r.name.length / 1000;
    if (!best || score > best.score) best = { r, score };
  }
  return best?.r ?? null;
}

export function resolveUserRequest(p: ParsedUserRequest, targetWaterGrams?: number): ResolvedUserRequest {
  let recipe: Recipe | null = null;
  const unresolved: string[] = [];
  for (const m of p.recipeMentions) {
    const r = resolveRecipeMention(m, ALL_RECIPES, targetWaterGrams);
    if (r && !recipe) recipe = r;
    else if (!r) unresolved.push(m);
  }
  const excludedBrewerTypes = new Set<BrewerType>();
  for (const b of p.excludeBrewers) {
    brewersFromMethod(USER_BREWER_METHODS[b] ?? b).forEach((t) => excludedBrewerTypes.add(t));
  }
  return { ...p, recipe, unresolvedMentions: unresolved, excludedBrewerTypes };
}

/** True when a candidate's method is on a brewer the user excluded. */
export function usesExcludedBrewer(method: string | undefined, excluded: Set<BrewerType>): boolean {
  if (!excluded.size) return false;
  return Array.from(brewersFromMethod(method)).some((b) => excluded.has(b));
}

/** The user-message block. "" when there is nothing to say. */
export function formatUserRequestBlock(r: ResolvedUserRequest, scaledFromNote?: string): string {
  if (!r.raw) return "";
  const lines: string[] = [
    `\nUSER REQUEST FOR THIS BREW — the user typed: ${JSON.stringify(r.raw)}. This is a direct instruction and has the HIGHEST priority: it overrides the library order, the method-freshness notes, the convergence rule and the exploration habit wherever they conflict. It never overrides vessel capacity or brewing physics.`,
  ];
  if (r.recipe) {
    lines.push(
      `- REQUESTED RECIPE: "${r.recipe.name}" (${r.recipe.attribution?.person ?? "unknown"}). It is entry 1 of RELEVANT REFERENCE RECIPES below${scaledFromNote ? ` (${scaledFromNote})` : ""}. The FIRST candidate MUST adapt exactly this recipe: basedOn "${r.recipe.name}", its pour structure, ratio and temperature. The SECOND candidate stays the exploration slot.`,
    );
  }
  for (const m of r.unresolvedMentions) {
    lines.push(
      `- "${m}" is NOT in the recipe library. Do not reconstruct its published parameters from memory. If you honour it, set basedOn "Own recipe (in the spirit of ${m})" and say in whyChosen that it is unverified.`,
    );
  }
  if (r.excludeBrewers.length) {
    lines.push(`- EXCLUDED BY THE USER: ${r.excludeBrewers.join(", ")}. Neither candidate may use ${r.excludeBrewers.length > 1 ? "these brewers" : "this brewer"}.`);
  }
  const p = r.params;
  const fixed = [
    p.tempC !== undefined ? `water temperature ${p.tempC}°C` : "",
    p.grind ? `grind ${p.grind}` : "",
    p.doseG !== undefined ? `dose ${p.doseG} g` : "",
    p.waterG !== undefined ? `total water ${p.waterG} g` : "",
    p.ratio !== undefined ? `ratio 1:${p.ratio}` : "",
  ].filter(Boolean);
  if (fixed.length) {
    lines.push(`- FIXED BY THE USER (both candidates; the app writes these onto the recipe): ${fixed.join(", ")}. Build the rest of the recipe around them.`);
  }
  if (r.otherInstructions && (r.parsed ? true : !r.recipe)) {
    lines.push(`- Also: ${r.otherInstructions}`);
  }
  return lines.join("\n");
}

/**
 * Write the user's explicit numbers onto a finished recipe. Runs AFTER the
 * guard chain, so a fidelity snap cannot undo what the user typed. Water is not
 * here — it becomes the generation target before the model is called.
 */
export function applyUserParams(recipe: BrewRecipe, p: UserRequestParams): { recipe: BrewRecipe; changes: string[] } {
  const changes: string[] = [];
  let out = recipe;
  if (p.tempC !== undefined && out.waterTempC !== p.tempC) {
    changes.push(`temp ${out.waterTempC}°C → ${p.tempC}°C`);
    out = { ...out, waterTempC: p.tempC };
  }
  if (p.grind) {
    const g = /^\d+(\.\d+)?$/.test(p.grind) ? `${p.grind}°` : p.grind;
    if (out.grindSize !== g) {
      changes.push(`grind ${out.grindSize} → ${g}`);
      out = { ...out, grindSize: g };
    }
  }
  const dose =
    p.doseG !== undefined
      ? p.doseG
      : p.ratio !== undefined && out.waterGrams > 0
        ? Math.round((out.waterGrams / p.ratio) * 2) / 2
        : undefined;
  if (dose !== undefined && out.doseGrams !== dose) {
    changes.push(`dose ${out.doseGrams} g → ${dose} g`);
    out = { ...out, doseGrams: dose };
  }
  return { recipe: out, changes };
}

export function toApplied(r: ResolvedUserRequest): UserRequestApplied {
  return {
    text: r.raw,
    ...(r.recipe ? { recipe: r.recipe.shortName || r.recipe.name } : {}),
    excluded: r.excludeBrewers,
    ...(r.requireBrewer ? { required: r.requireBrewer } : {}),
    params: r.params,
    unresolved: r.unresolvedMentions,
  };
}
