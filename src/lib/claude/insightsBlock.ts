/**
 * The COACH INSIGHTS block of the /recommend user message, with the user's
 * verdicts carried through (2026-10-03).
 *
 * Until this module the rows reached the prompt stripped of their status: a
 * row the user had CONFIRMED on /taste read exactly like a fresh, unverified
 * one, and a comment in run.ts claimed "confirmed ranked higher" while the
 * block sorted only on citation-field overlap. The Confirmed / Save to try
 * workflow changed nothing the recommender could see. Now a confirmed row is a
 * standing rule for this user, a `trying` row is an experiment the user chose
 * to run (honour it in candidate 1 when it applies), and `new` is a hypothesis.
 */

import type { CoffeeIdentity, SessionContext } from "../types/session";

export type InsightVerdict = "confirmed" | "trying" | "new" | "snoozed" | "doesnt-apply";

export interface RecommendInsight {
  observation: string;
  suggestion: string;
  citationFields: string[];
  /** The user's verdict on /taste. Absent = treated as `new`. */
  status?: InsightVerdict | string;
  /** 'user-confirmed' rows were written or endorsed by the user. */
  source?: string;
  /** ISO date the row was created (for "trying since …"). */
  createdAt?: string;
}

const STATUS_RANK: Record<string, number> = { confirmed: 0, trying: 1, new: 2, snoozed: 3 };

/** Status first (confirmed → trying → new), then citation overlap with this brew. Exported for tests. */
export function rankInsights(
  insights: RecommendInsight[],
  coffee: Pick<CoffeeIdentity, "variety" | "process" | "roastLevel" | "origin">,
  context: Pick<SessionContext, "preferredMethod">,
): RecommendInsight[] {
  const currentSig = new Set<string>(
    [
      coffee.variety && "variety",
      coffee.process && "process",
      coffee.roastLevel && "roast",
      coffee.origin && "origin",
      context.preferredMethod && "method",
    ].filter(Boolean) as string[],
  );
  const relevance = (i: RecommendInsight) =>
    (i.citationFields ?? []).reduce((acc, f) => acc + (currentSig.has(String(f).toLowerCase()) ? 1 : 0), 0);
  const rank = (i: RecommendInsight) => STATUS_RANK[(i.status ?? "new").toLowerCase()] ?? 2;
  return [...insights]
    .filter((i) => (i.status ?? "new").toLowerCase() !== "doesnt-apply")
    .sort((a, b) => rank(a) - rank(b) || relevance(b) - relevance(a));
}

function label(i: RecommendInsight): string {
  const s = (i.status ?? "new").toLowerCase();
  if (s === "confirmed") return "[CONFIRMED by the user]";
  if (s === "trying") {
    const since = i.createdAt ? ` since ${i.createdAt.slice(0, 10)}` : "";
    return `[TRYING — the user chose to test this${since}]`;
  }
  if (s === "snoozed") return "[snoozed — unverified]";
  return "[new — unverified]";
}

export function formatInsightsBlock(
  insights: RecommendInsight[] | undefined,
  coffee: Pick<CoffeeIdentity, "variety" | "process" | "roastLevel" | "origin">,
  context: Pick<SessionContext, "preferredMethod">,
  max = 8,
): string {
  if (!insights || insights.length === 0) return "";
  const ordered = rankInsights(insights, coffee, context);
  if (ordered.length === 0) return "";
  const lines = ordered.slice(0, max).map((i) => `- ${label(i)} ${i.observation} ${i.suggestion}`);
  return (
    "\nCOACH INSIGHTS — multivariate observations across your full log, each tagged with the user's own verdict. [CONFIRMED] = the user verified it on their palate: treat it as a standing rule for this user and do not contradict it without naming why. [TRYING] = the user chose to test it: when it applies to this coffee and context, the FIRST candidate should honour it (it is the experiment they are running). [new] = an unverified hypothesis — a prior, not an instruction. Insights are listed confirmed → trying → new, then by overlap with this brew (variety, process, roast, origin, locked method). They are NOT recipe instructions: if one conflicts with what this coffee needs, name the conflict in the reasoning field and choose the better path.\n" +
    lines.join("\n")
  );
}
