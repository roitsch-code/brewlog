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
 * fall-back when nothing would be left) and they are named up front. The
 * repair round for a repeated candidate was dropped 2026-10-19 with the other
 * orchestration guards — the model reads the list. A recipe the owner
 * explicitly asked for in the free-text field is exempt. Pure.
 */
import type { Recipe } from "../knowledge/recipes";

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

/** Up-front rule in the user message, so the first answer can already honour it. */
export function formatShownUpfront(shown: ShownCandidate[]): string {
  if (!shown.length) return "";
  const list = shown
    .map((s) => `  - "${s.title}" (${s.method}${s.basedOn ? `, basedOn "${s.basedOn}"` : ""})`)
    .join("\n");
  return `\nALREADY SHOWN IN THIS SESSION — the user saw these candidates a moment ago, went back and asked again (often after changing the context). Do NOT offer any of them again, neither the same reference recipe on the same brewer nor the same recipe under a new title. Both candidates must be genuinely different recipes:\n${list}`;
}
