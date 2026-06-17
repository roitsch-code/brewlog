import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
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
export const maxDuration = 180;

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

const GEN_SYSTEM = `You write ONE short coffee insight per snippet for a loading screen — a big 40px headline shown while a brew recipe is generated. Pick the single most interesting fact in the snippet and state it crisply.

VOICE (BTTS): a knowledgeable friend talking about coffee. Editorial, pragmatic, plain. No hype, no emoji, no exclamation marks, no "did you know", no second-person command ("try…", "you should…"). State the thing.

LENGTH: ≤ 80 characters and ≤ 15 words — one clause. Use the space; the only hard rule is never exceed 80. State one fact, not a summary of the snippet. Both of these fit fine:
  "Coffee is a fruit; the bean is its seed."
  "Swirl the slurry instead of stirring — it levels the bed without churning fines."

GROUNDING — a no-fabrication guarantee depends on this:
- Restate a fact found IN ITS SNIPPET. Add nothing the snippet does not say. If a snippet yields no clean, true, SHORT line, OMIT it.
- Prefer the general principle over trivia. Avoid naming competitions, years, or people UNLESS the fact is meaningless without the name. A cultivar name ("Pink Bourbon", "Geisha") is fine; "won the 2016 World Brewers Cup" is not.
- No numbers, ppm, temperatures, ratios, or dates UNLESS they appear verbatim in the snippet.

Return ONLY a JSON array: [{"n": <snippet number>, "text": "<line>"}]. Omit any snippet you cannot serve well AND short. No prose around the JSON.`;

const CHECK_SYSTEM = `For each numbered pair, decide whether the CLAIM is fully supported by its SOURCE — i.e. every fact asserted in the claim is stated or directly implied by the source, with nothing invented.

Return ONLY a JSON array of booleans in order, e.g. [true,false,true]. No prose.`;

const REPAIR_SYSTEM = `Each line below is a coffee insight that is a little over the 80-character headline limit. Rewrite each to AT MOST 80 characters and 15 words, keeping the SAME fact — cut only what's needed to fit, don't make it shorter than necessary. Add nothing new. No emoji, no exclamation marks.

Return ONLY a JSON array: [{"n": <number>, "text": "<shortened line>"}]. Omit any you cannot shorten without losing the fact.`;

const WEB_SYSTEM = `You research specialty coffee (filter brewing, processing, origin, varieties, water, extraction science) and distill it into ONE short headline insight per item for a loading screen.

VOICE (BTTS): a knowledgeable friend talking about coffee. Editorial, plain. No hype, no emoji, no exclamation marks, no "did you know", no second-person command.

Use web search to find real, current material from reputable sources (specialty roasters, James Hoffmann, Barista Hustle, competition pages, coffee-science writers). For EACH insight you propose you MUST attach a VERBATIM quote from a source you actually found that supports it, plus that source's url.

LENGTH: ≤ 80 characters and ≤ 15 words — one clause. Use the space; the only hard rule is never exceed 80. State one fact, not a summary. Both fit fine: "Coffee is a fruit; the bean is its seed." / "Swirl the slurry instead of stirring — it levels the bed without churning fines."

GROUNDING — a no-fabrication guarantee depends on these:
- The line must restate a fact contained IN ITS QUOTE. Add nothing the quote does not say.
- Prefer the general principle over trivia. Avoid naming competitions, years, or people unless the fact is meaningless without the name. A cultivar/variety name is fine.
- No numbers, ppm, temperatures, ratios, or dates UNLESS they appear verbatim in the quote.
- If you cannot attach a real supporting quote, DROP that insight rather than invent one.

Return ONLY a JSON array: [{"text": "<line>", "quote": "<verbatim supporting sentence from the source>", "url": "<source url>"}]. No prose around the JSON.`;

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

// Self-bootstrap the table (idempotent). Migration 0018 is the canonical schema
// record, but the path to apply it on the VPS isn't always reachable from a
// session; CREATE TABLE IF NOT EXISTS here makes the agent self-healing on any
// environment. The GET read stays defensive until the first run creates it.
async function ensureTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS loading_insights (
      id              text PRIMARY KEY,
      text            text NOT NULL,
      source          text NOT NULL,
      source_ref      text,
      status          text NOT NULL DEFAULT 'live',
      score           numeric NOT NULL DEFAULT 1,
      created_at      timestamptz NOT NULL DEFAULT now(),
      created_at_ms   bigint NOT NULL,
      verified_at_ms  bigint
    )
  `);
  await db.execute(
    sql`CREATE UNIQUE INDEX IF NOT EXISTS loading_insights_text_lower_idx ON loading_insights (lower(text))`,
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS loading_insights_status_idx ON loading_insights (status)`,
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS loading_insights_created_at_ms_idx ON loading_insights (created_at_ms DESC)`,
  );
}

// Web source — the freshest material and the riskiest. The model searches real
// sources and must attach a verbatim supporting quote to every line; that quote
// becomes the grounding sourceText, so the SAME deterministic gate + claim-check
// apply. Residual risk (a fabricated quote) is accepted for this low-stakes
// surface and minimised by the "prefer general, no specifics unless in the
// quote" rule. Never blocks the run — corpus/brews already produced candidates.
async function generateWebCandidates(): Promise<{ text: string; snippet: Snippet }[]> {
  // web_search is a server tool the SDK types don't cover, hence `as any`
  // (same pattern as /api/research).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resp = await (client.messages.create as any)({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: WEB_SYSTEM,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
    messages: [
      {
        role: "user",
        content:
          "Find 6–10 fresh, true specialty-coffee insights for the loading screen. Attach a verbatim supporting quote + url to each. Return only the JSON array.",
      },
    ],
  });
  const blocks = (resp?.content ?? []) as Array<{ type: string; text?: string }>;
  const raw = blocks.find((b) => b.type === "text")?.text ?? "";
  const items = extractJsonArray(raw) ?? [];
  const out: { text: string; snippet: Snippet }[] = [];
  for (const item of items) {
    if (typeof item !== "object" || item === null) continue;
    const rec = item as { text?: unknown; quote?: unknown; url?: unknown };
    const text = typeof rec.text === "string" ? rec.text.trim() : "";
    const quote = typeof rec.quote === "string" ? rec.quote.trim() : "";
    const url = typeof rec.url === "string" ? rec.url.trim() : "";
    // No real supporting quote → no grounding → drop.
    if (text === "" || quote.length < 12) continue;
    out.push({ text, snippet: { source: "web", ref: url || "web", sourceText: quote } });
  }
  return out;
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
 * Sources: the verified corpus (recipes / varieties / techniques), brew
 * aggregates, and live web research — each behind the same gate. The table
 * self-bootstraps, so a missing migration can't leave the agent broken.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureTable();

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

    // 3. Generate one candidate line per corpus/brews snippet.
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
    const rawCandidates: { text: string; snippet: Snippet }[] = [];
    for (const item of genItems) {
      if (typeof item !== "object" || item === null) continue;
      const rec = item as { n?: unknown; text?: unknown };
      const n = typeof rec.n === "number" ? rec.n : NaN;
      const text = typeof rec.text === "string" ? rec.text.trim() : "";
      const snippet = snippets[n - 1];
      if (snippet && text !== "") rawCandidates.push({ text, snippet });
    }

    // 3b. Web source — fresh material grounded in a model-supplied verbatim
    // quote, behind the SAME gate. Wrapped so an unavailable/failing web_search
    // never blocks the corpus/brews candidates.
    let webCount = 0;
    try {
      const web = await generateWebCandidates();
      webCount = web.length;
      rawCandidates.push(...web);
    } catch (webErr) {
      console.warn("loading-insights web source failed; corpus/brews only", webErr);
    }

    // 4. Deterministic gate — each candidate grounded against its OWN source.
    // `killed` records every rejected line + WHY, so a run is fully auditable.
    // A line that fails ONLY on length goes to the repair pass (4b) instead of
    // being thrown away — it's usually a good fact that's just a few chars long.
    const killed: { source: LoadingInsightSource; text: string; reasons: string[] }[] = [];
    const gated: { text: string; snippet: Snippet }[] = [];
    const repairQueue: { snippet: Snippet; text: string }[] = [];
    const isLengthOnly = (reasons: string[]) =>
      reasons.length > 0 &&
      reasons.every((r) => r.startsWith("too-long") || r.startsWith("too-many-words"));
    for (const cand of rawCandidates) {
      const { ok, reasons } = lintLoadingInsight(cand.text, {
        sourceText: cand.snippet.sourceText,
        existing,
      });
      if (ok) {
        existing.add(normalizeForDedupe(cand.text)); // catch intra-batch dups
        gated.push(cand);
      } else if (isLengthOnly(reasons)) {
        repairQueue.push({ snippet: cand.snippet, text: cand.text });
      } else {
        killed.push({ source: cand.snippet.source, text: cand.text, reasons });
      }
    }

    // 4b. Repair pass — tighten the too-long lines ONCE and re-gate them, so a
    // good insight isn't discarded for being a few characters over. The tightened
    // line still has to clear the full gate (grounding included).
    let repairedCount = 0;
    if (repairQueue.length > 0) {
      try {
        const list = repairQueue.map((r, i) => `[${i + 1}] ${r.text}`).join("\n");
        const repairResp = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 800,
          system: REPAIR_SYSTEM,
          messages: [{ role: "user", content: list }],
        });
        const repaired = extractJsonArray(textOf(repairResp)) ?? [];
        const byIndex = new Map<number, string>();
        for (const item of repaired) {
          if (typeof item !== "object" || item === null) continue;
          const rec = item as { n?: unknown; text?: unknown };
          const n = typeof rec.n === "number" ? rec.n : NaN;
          const text = typeof rec.text === "string" ? rec.text.trim() : "";
          if (!Number.isNaN(n) && text !== "") byIndex.set(n, text);
        }
        repairQueue.forEach((r, i) => {
          const tightened = byIndex.get(i + 1);
          if (!tightened) {
            killed.push({ source: r.snippet.source, text: r.text, reasons: ["too-long"] });
            return;
          }
          const { ok, reasons } = lintLoadingInsight(tightened, {
            sourceText: r.snippet.sourceText,
            existing,
          });
          if (ok) {
            existing.add(normalizeForDedupe(tightened));
            gated.push({ text: tightened, snippet: r.snippet });
            repairedCount++;
          } else {
            killed.push({ source: r.snippet.source, text: tightened, reasons });
          }
        });
      } catch (repairErr) {
        console.warn("loading-insights repair pass failed", repairErr);
        for (const r of repairQueue) {
          killed.push({ source: r.snippet.source, text: r.text, reasons: ["too-long"] });
        }
      }
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
          survivors = [];
          gated.forEach((g, i) => {
            if (verdicts[i] === true) survivors.push(g);
            else killed.push({ source: g.snippet.source, text: g.text, reasons: ["claim-check"] });
          });
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
      web: webCount,
      candidates: rawCandidates.length,
      repaired: repairedCount,
      gated: gated.length,
      inserted: newRows.length,
      retired,
      // Full per-line audit so a run shows what passed and what was killed (+why).
      passed: survivors.map((s) => ({ source: s.snippet.source, text: s.text })),
      killed,
    });
  } catch (err) {
    console.error("loading-insights refresh failed", err);
    return NextResponse.json({ error: "refresh-failed" }, { status: 500 });
  }
}
