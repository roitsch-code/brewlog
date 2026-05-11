import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { inArray, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { coffees, sessions } from "@/lib/db/schema";
import { rowToCoffee, rowToSession } from "@/lib/db/helpers";
import type { Coffee } from "@/lib/types/coffee";
import type { Session } from "@/lib/types/session";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are generating two short paragraphs for a personal brew memory.

Given all brew sessions for one coffee, output exactly this JSON shape (no markdown, no commentary):

{
  "writtenSummary": "Exactly 2 sentences. Capture overall quality, which method worked best, recurring flavor notes, and trend if any. Reference actual numbers (e.g. \\"4 of 6 brews rated 4★+\\"). Direct, specific, personal. Metric units only. No emojis.",
  "whatToExplore": "Exactly 2 sentences suggesting a specific unexplored angle for the next brew of this coffee. Could be: an untested method, a temperature shift, a different ratio, a championship recipe that fits the variety/process, or a technique to test (e.g. Hsu staged-temp, Rao spin, sieving fines). Be concrete. No emojis. No generic 'try different things'."
}

Both fields are required strings. Total response budget: ~120 words.`;

function topNotes(sessionList: Session[], n = 5): string[] {
  const counts: Record<string, number> = {};
  for (const s of sessionList) {
    for (const note of s.result?.flavorNotes || []) {
      counts[note] = (counts[note] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([note]) => note);
}

function bestMethod(sessionList: Session[]): string | null {
  const data: Record<string, { sum: number; count: number }> = {};
  for (const s of sessionList) {
    const method = (s.brew as { methodUsed?: string } | undefined)?.methodUsed
      || (s.recommendation as { primaryMethod?: string } | undefined)?.primaryMethod;
    const rating = s.result?.rating;
    if (method && typeof rating === "number") {
      data[method] = data[method] || { sum: 0, count: 0 };
      data[method].sum += rating;
      data[method].count += 1;
    }
  }
  const ranked = Object.entries(data).sort((a, b) => b[1].sum / b[1].count - a[1].sum / a[1].count);
  return ranked[0]?.[0] ?? null;
}

function buildUserMessage(coffee: Coffee, sessionList: Session[]): string {
  const rated = sessionList.filter(s => s.result?.rating != null);
  const avgRating = rated.length > 0
    ? Math.round((rated.reduce((sum, sess) => sum + sess.result!.rating, 0) / rated.length) * 10) / 10
    : null;
  const best = bestMethod(sessionList);
  const notes = topNotes(sessionList, 5);

  const lines = sessionList
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map(s => {
      const d = new Date(s.createdAt);
      const date = d.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
      const method = (s.brew as { methodUsed?: string } | undefined)?.methodUsed
        || (s.recommendation as { primaryMethod?: string } | undefined)?.primaryMethod
        || "unknown";
      const rating = s.result?.rating ?? "–";
      const topThree = (s.result?.flavorNotes || []).slice(0, 3).join(", ") || "no notes";
      return `- ${date}: ${method} · ${rating}★ · ${topThree}`;
    });

  return `Coffee: ${coffee.name} by ${coffee.roaster}
Origin: ${coffee.origin || "unknown"} | Process: ${coffee.process || "unknown"}
Sessions (${sessionList.length} total):
${lines.join("\n")}
${avgRating != null ? `Avg rating: ${avgRating}` : ""}${best ? ` | Best method: ${best}` : ""}${notes.length > 0 ? ` | Most common notes: ${notes.join(", ")}` : ""}`;
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  try {
    const coffeeRows = await db.select().from(coffees);
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    for (const row of coffeeRows) {
      const coffee = rowToCoffee(row);

      if (!coffee.sessionIds || coffee.sessionIds.length < 2) {
        skipped++;
        continue;
      }

      if (coffee.lastSummarizedAt) {
        const lastMs = new Date(coffee.lastSummarizedAt).getTime();
        if (now - lastMs < sevenDaysMs) {
          skipped++;
          continue;
        }
      }

      try {
        const sessionRows = await db.select().from(sessions).where(inArray(sessions.id, coffee.sessionIds));
        const sessionList: Session[] = sessionRows.map(rowToSession);

        if (sessionList.length < 2) {
          skipped++;
          continue;
        }

        const userMessage = buildUserMessage(coffee, sessionList);

        const msg = await client.messages.create({
          model: "claude-haiku-4-5",
          max_tokens: 350,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userMessage }],
        });

        const rawText = (msg.content[0] as { type: string; text: string })?.text?.trim();
        if (!rawText) {
          errors++;
          continue;
        }

        // Parse the structured JSON output. Be defensive — if the model
        // emits anything that doesn't have both fields, fall back to
        // treating the whole response as writtenSummary (preserves
        // pre-PR behaviour for this coffee).
        let writtenSummary: string;
        let whatToExplore: string | null;
        try {
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
          writtenSummary = typeof parsed.writtenSummary === "string"
            ? parsed.writtenSummary.trim()
            : rawText;
          whatToExplore = typeof parsed.whatToExplore === "string"
            ? parsed.whatToExplore.trim()
            : null;
        } catch {
          writtenSummary = rawText;
          whatToExplore = null;
        }

        if (!writtenSummary) {
          errors++;
          continue;
        }

        const commonNotes = topNotes(sessionList, 5);
        const lastSummarizedAt = new Date().toISOString();

        await db.update(coffees)
          .set({ writtenSummary, whatToExplore, lastSummarizedAt, commonNotes })
          .where(eq(coffees.id, coffee.id));

        processed++;
      } catch (err) {
        console.error(`compact error for coffee ${coffee.id}:`, err);
        errors++;
      }
    }

    return NextResponse.json({ processed, skipped, errors });
  } catch (err) {
    console.error("compact route error:", err);
    return NextResponse.json({ error: "Internal error", processed, skipped, errors }, { status: 500 });
  }
}
