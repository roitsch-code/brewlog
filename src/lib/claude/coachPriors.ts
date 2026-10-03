/**
 * What the coach is told about its OWN earlier insights before it writes new
 * ones (2026-10-03). Until this module the regeneration prompt carried only
 * the brews and the structured analysis: a row the user had marked "Doesn't
 * apply" was hidden from /taste but never from the model, so a rephrasing of
 * it came straight back as `new` (only an exact 80-character text match was
 * caught), and a confirmed row was neither built on nor kept out of the way.
 *
 * Pure formatter so it can be tested without the DB.
 */

export interface PriorInsightRow {
  observation: string;
  suggestion: string;
  status: string;
  source?: string;
  createdAt?: Date | string | null;
}

const ORDER = ["confirmed", "trying", "doesnt-apply", "snoozed", "new"];

function dateOf(d: Date | string | null | undefined): string {
  if (!d) return "";
  const t = typeof d === "string" ? new Date(d) : d;
  return Number.isNaN(t.getTime()) ? "" : t.toISOString().slice(0, 10);
}

export function formatPriorInsightsForCoach(rows: PriorInsightRow[], max = 40): string {
  const kept = rows.filter((r) => ORDER.includes(r.status)).slice(0, max);
  if (kept.length === 0) return "";
  const groups = ORDER.map((status) => ({
    status,
    rows: kept.filter((r) => r.status === status),
  })).filter((g) => g.rows.length > 0);

  const heading: Record<string, string> = {
    confirmed: "CONFIRMED by the user (verified on their palate — do NOT re-emit these; you may build a NEW insight on top of one, citing it)",
    trying: "TRYING (the user saved these to test — do NOT re-emit them; if the brews since show the result, write THAT as the new insight: did it help or not, with counts)",
    "doesnt-apply": "REJECTED by the user as \"doesn't apply\" (do NOT re-emit these or any rephrasing of them — the user has already judged the claim)",
    snoozed: "snoozed (the user deferred these — do not re-emit)",
    new: "still new / unjudged (you may replace these with better ones; do not duplicate them)",
  };

  const sections = groups.map((g) => {
    const lines = g.rows.map((r) => {
      const d = dateOf(r.createdAt);
      return `  - ${d ? `${d} · ` : ""}${r.observation} ${r.suggestion}`.trimEnd();
    });
    return `${heading[g.status]}:\n${lines.join("\n")}`;
  });

  return ["── Your earlier insights and the user's verdicts ──", ...sections].join("\n");
}
