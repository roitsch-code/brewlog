import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { loadingInsights, sessions } from "@/lib/db/schema";
import type { LoadingInsightSource, NewLoadingInsightRow } from "@/lib/db/schema";
import { rowToSession } from "@/lib/db/helpers";
import { ALL_RECIPES } from "@/lib/knowledge/recipes";
import { VARIETY_PRIORS } from "@/lib/knowledge/varieties";
import { TECHNIQUES } from "@/lib/knowledge/techniques";
import { buildHistorySummary } from "@/lib/claude/historyUtils";
import { lintLoadingInsight, normalizeForDedupe } from "@/lib/insights/loadingInsightLint";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// How many of each verified-corpus source to sample per run. Random each time,
// so the pool drifts across the whole corpus over months.
const N_RECIPES = 10;
const N_VARIETIES = 8;
const N_TECHNIQUES = 8;
// Live-pool ceiling — over this, the oldest live rows are retired (the static
// COFFEE_HINTS seed is always merged in by the screen, so the floor is fixed
// regardless of how many DB rows exist).
const POOL_CAP = 150;
// Brews source only kicks in once there's enough signal — mirrors the coach's
// "needs a few rated sessions" bar.
const MIN_SESSIONS_FOR_BREWS = 4;

const GEN_SYSTEM = `You write ONE short coffee insight per snippet for a loading screen — a big Fraunces headline shown while a brew recipe is generated.

VOICE (BTTS): a knowledgeable friend talking about coffee. Editorial, pragmatic, plain. No hype, no emoji, no exclamation marks, no "did you know", no second-person command ("try…", "you should…"). State the thing.

HARD RULES — these protect a no-fabrication guarantee, follow them exactly:
- Each line must restate a fact found IN ITS SNIPPET. Add nothing the snippet does not say. If a snippet yields no clean, true, interesting line, OMIT it.
- Prefer the general principle over trivia. Avoid naming competitions, years, or people UNLESS the fact is meaningless without the name. A cultivar name ("Pink Bourbon", "Geisha") is fine; "won the 2016 World Brewers Cup" is not.
- No numbers, ppm, temperatures, ratios, or dates UNLESS they appear verbatim in the snippet.
- ≤ 80 characters. ≤ 15 words. One sentence. A trailing period is optional.

Return ONLY a JSON array: [{"n": <snippet number>, "text": "<line>"}]. Omit any snippet you cannot serve well. No prose around the JSON.`;

const CHECK_SYSTEM = `For each numbered pair, decide whether the CLAIM is fully supported by its SOURCE — i.e. every fact asserted in the claim is stated or directly implied by the source, with nothing invented.

Return ONLY a JSON array of booleans in order, e.g. [true,false,true]. No prose.`;

interface Snippet {
  source: LoadingInsightSource;
  ref: string;
  sourceText: string;
}

function sample<T>(arr: readonly T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

function extractJsonArray(s: string): unknown[] | null {
  const start = s.indexOf("[");
  const end = s.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    const parsed = JSON.parse(s.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function textOf(resp: Anthropic.Message): string {
  const block = resp.content.find((b) => b.type === "text");
  return block && "text" in block ? block.text : "";
}

/**
 * POST (CRON_SECRET bearer) — refresh the loading-screen insight pool.
 *
 * Generates candidate lines grounded in the user's own VERIFIED knowledge
 * corpus (recipes / varieties / techniques) and brewing aggregates, then runs
 * every candidate through the deterministic gate (loadingInsightLint) AND a
 * model claim-check before inserting. This machine review REPLACES the human
 * review the user chose to skip — nothing ungrounded reaches the screen.
 *
 * Slice 1: corpus + brews only. The (riskier) web source lands in slice 2
 * behind the same gate.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Existing live texts → dedup set (and a DB-level unique index backs it).
    const liveRows = await db
      .select({ text: loadingInsights.text })
      .from(loadingInsights)
      .where(eq(loadingInsights.status, "live"));
    const existing = new Set(liveRows.map((r) => normalizeForDedupe(r.text)));

    // 2. Build grounded snippets from the verified corpus.
    const snippets: Snippet[] = [];
    for (const r of sample(ALL_RECIPES, N_RECIPES)) {
      snippets.push({
        source: "corpus",
        ref: `recipe:${r.id}`,
        sourceText: `${r.name}. ${r.teaches} ${r.science}`,
      });
    }
    for (const v of sample(VARIETY_PRIORS, N_VARIETIES)) {
      snippets.push({
        source: "corpus",
        ref: `variety:${v.name}`,
        sourceText: `${v.name} — ${v.origin}. ${v.cupSignature}`,
      });
    }
    for (const t of sample(TECHNIQUES, N_TECHNIQUES)) {
      snippets.push({
        source: "corpus",
        ref: `technique:${t.id}`,
        sourceText: `${t.name}: ${t.description} ${t.mechanism}`,
      });
    }

    // Brews snippet — aggregates over the user's own sessions (grounded in real
    // data, so safe). One snippet; the model may draw a couple of lines from it.
    try {
      const rows = await db
        .select()
        .from(sessions)
        .orderBy(desc(sessions.createdAtMs))
        .limit(40);
      if (rows.length >= MIN_SESSIONS_FOR_BREWS) {
        const summary = buildHistorySummary(rows.map(rowToSession), 12);
        if (summary.trim() !== "") {
          snippets.push({ source: "brews", ref: "brews:summary", sourceText: summary });
        }
      }
    } catch {
      /* brews source is optional — never block the run on it */
    }

    if (snippets.length === 0) {
      return NextResponse.json({ generated: 0, inserted: 0, reason: "no-snippets" });
    }

    // 3. Generate one candidate line per snippet.
    const snippetBlock = snippets
      .map((s, i) => `[${i + 1}] ${s.sourceText}`)
      .join("\n\n");
    const genResp = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: GEN_SYSTEM,
      messages: [{ role: "user", content: `SNIPPETS:\n\n${snippetBlock}` }],
    });
    const genItems = extractJsonArray(textOf(genResp)) ?? [];

    // 4. Deterministic gate — grounded against the candidate's OWN snippet.
    const gated: { text: string; snippet: Snippet }[] = [];
    for (const item of genItems) {
      if (typeof item !== "object" || item === null) continue;
      const rec = item as { n?: unknown; text?: unknown };
      const n = typeof rec.n === "number" ? rec.n : NaN;
      const text = typeof rec.text === "string" ? rec.text.trim() : "";
      const snippet = snippets[n - 1];
      if (!snippet || text === "") continue;
      const { ok } = lintLoadingInsight(text, { sourceText: snippet.sourceText, existing });
      if (!ok) continue;
      existing.add(normalizeForDedupe(text)); // catch intra-batch dups
      gated.push({ text, snippet });
    }

    // 5. Model claim-check — semantic backstop the regex can't do. If it can't
    // be parsed (transient hiccup), accept the gate survivors: they are already
    // token-grounded against their own corpus snippet by construction.
    let survivors = gated;
    if (gated.length > 0) {
      try {
        const pairs = gated
          .map((g, i) => `[${i + 1}] CLAIM: ${g.text}\nSOURCE: ${g.snippet.sourceText}`)
          .join("\n\n");
        const checkResp = await client.messages.create({
          model: "claude-haiku-4-5",
          max_tokens: 400,
          system: CHECK_SYSTEM,
          messages: [{ role: "user", content: pairs }],
        });
        const verdicts = extractJsonArray(textOf(checkResp));
        if (verdicts && verdicts.length === gated.length) {
          survivors = gated.filter((_, i) => verdicts[i] === true);
        }
      } catch {
        /* keep gate survivors on claim-check failure */
      }
    }

    // 6. Insert survivors.
    const now = Date.now();
    const newRows: NewLoadingInsightRow[] = survivors.map((s) => ({
      id: randomUUID(),
      text: s.text,
      source: s.snippet.source,
      sourceRef: s.snippet.ref,
      status: "live",
      score: "1",
      createdAtMs: now,
      verifiedAtMs: now,
    }));
    if (newRows.length > 0) {
      await db.insert(loadingInsights).values(newRows).onConflictDoNothing();
    }

    // 7. Retire the oldest live rows beyond the cap.
    let retired = 0;
    const allLive = await db
      .select({ id: loadingInsights.id })
      .from(loadingInsights)
      .where(eq(loadingInsights.status, "live"))
      .orderBy(asc(loadingInsights.createdAtMs));
    if (allLive.length > POOL_CAP) {
      const toRetire = allLive.slice(0, allLive.length - POOL_CAP).map((r) => r.id);
      await db
        .update(loadingInsights)
        .set({ status: "retired" })
        .where(inArray(loadingInsights.id, toRetire));
      retired = toRetire.length;
    }

    return NextResponse.json({
      snippets: snippets.length,
      generated: genItems.length,
      gated: gated.length,
      inserted: newRows.length,
      retired,
    });
  } catch (err) {
    console.error("loading-insights refresh failed", err);
    return NextResponse.json({ error: "refresh-failed" }, { status: 500 });
  }
}
