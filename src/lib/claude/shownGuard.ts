/**
 * "Shown in this session" guard for /recommend (2026-10-18).
 *
 * WHY THIS EXISTS: the owner went Back from the recipe screen, changed three
 * context settings, asked again — and got the same recipes. Every freshness
 * lever in this engine (recentReferenceNames, recentlyOfferedFamilies, the
 * convergence base) reads `pastSessions`, i.e. BREWED recipes. Candidates that
 * were shown and discarded were invisible to all of them, and the per-request
 * rotation seed only reorders equal-score ties, so a similar context re-elects
 * the same best fit.
 *
 * The client now keeps every candidate it was shown in this flow (flowStore
 * `shownCandidates`, cleared on a new session) and sends it with the request.
 * Here: their references are taken OFF the menu (a hard filter, with the usual
 * fall-back when nothing would be left), they are named up front, and a
 * candidate that still repeats one goes into the existing single repair round.
 * A recipe the owner explicitly asked for in the free-text field is exempt.
 * Pure; the model call lives in recommend.ts.
 */
import type { Recipe } from "../knowledge/recipes";
import { brewMethodKey } from "../utils/brewMethodKey";

export interface ShownCandidate {
  title: string;
  method: string;
  basedOn?: string;
}

/** Cap what the client may send — a flow never legitimately shows more. */
export const MAX_SHOWN = 20;

/** Defensive parse of the request body field (no zod on this route). */
export function parseShownCandidates(raw: unknown): ShownCandidate[] {
  if (!Array.isArray(raw)) return [];
  const out: ShownCandidate[] = [];
  for (const x of raw.slice(-MAX_SHOWN)) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title.slice(0, 120) : "";
    const method = typeof o.method === "string" ? o.method.slice(0, 60) : "";
    if (!title && !method) continue;
    const basedOn = typeof o.basedOn === "string" && o.basedOn.trim() ? o.basedOn.slice(0, 160) : undefined;
    out.push({ title, method, ...(basedOn ? { basedOn } : {}) });
  }
  return out;
}

function norm(s: string | undefined): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Corpus ids of the references the shown candidates adapted. */
export function shownReferenceIds(
  shown: ShownCandidate[],
  resolve: (basedOn: string | undefined) => Recipe | null,
): Set<string> {
  const ids = new Set<string>();
  for (const s of shown) {
    const r = resolve(s.basedOn);
    if (r) ids.add(r.id);
  }
  return ids;
}

export interface ReshownOffender {
  index: number;
  title: string;
  method: string;
  basedOn: string;
  matched: string;
}

/**
 * Candidates that repeat something already shown in this flow:
 *  - its basedOn resolves to a reference a shown candidate adapted, or
 *  - same brewer key AND (same title, or same non-empty basedOn text).
 * `allowIds` = references the owner explicitly asked for (never offenders).
 */
export function findReshown(
  candidates: { title?: string; method: string; basedOn?: string }[],
  shown: ShownCandidate[],
  resolve: (basedOn: string | undefined) => Recipe | null,
  allowIds: Set<string> = new Set(),
): ReshownOffender[] {
  if (!shown.length) return [];
  const shownIds = shownReferenceIds(shown, resolve);
  const out: ReshownOffender[] = [];
  candidates.forEach((c, index) => {
    const ref = resolve(c.basedOn);
    if (ref && allowIds.has(ref.id)) return;
    let matched: string | null = null;
    if (ref && shownIds.has(ref.id)) matched = ref.shortName || ref.name;
    if (!matched) {
      const key = brewMethodKey(c.method);
      const hit = shown.find(
        (s) =>
          brewMethodKey(s.method) === key &&
          ((norm(s.title) && norm(s.title) === norm(c.title)) ||
            (norm(s.basedOn) && norm(s.basedOn) === norm(c.basedOn) &&
              !/^own (recipe|experiment)$/.test(norm(c.basedOn)))),
      );
      if (hit) matched = hit.title || hit.basedOn || hit.method;
    }
    if (matched) {
      out.push({ index, title: c.title ?? "", method: c.method, basedOn: c.basedOn ?? "", matched });
    }
  });
  return out;
}

/** Up-front rule in the user message, so the first answer can already honour it. */
export function formatShownUpfront(shown: ShownCandidate[]): string {
  if (!shown.length) return "";
  const list = shown
    .map((s) => `  - "${s.title}" (${s.method}${s.basedOn ? `, basedOn "${s.basedOn}"` : ""})`)
    .join("\n");
  return `\nALREADY SHOWN IN THIS SESSION — the user saw these candidates a moment ago, went back and asked again (often after changing the context). Do NOT offer any of them again, neither the same reference recipe on the same brewer nor the same recipe under a new title. Both candidates must be genuinely different recipes:\n${list}`;
}

export function formatReshownRepair(offenders: ReshownOffender[]): string {
  const lines = offenders
    .map((o) => `- Candidate ${o.index + 1} "${o.title}" (${o.method}, basedOn "${o.basedOn || "none"}") repeats "${o.matched}", which the user was already shown in this session.`)
    .join("\n");
  return `\n\nREPAIR — ALREADY SHOWN. The user went back and asked again; they must not get the same recipe twice:\n${lines}\nReplace ONLY the candidate(s) above with a genuinely different recipe (a different reference from RELEVANT REFERENCE RECIPES, or an Own experiment); keep any other candidate exactly as it was.`;
}
