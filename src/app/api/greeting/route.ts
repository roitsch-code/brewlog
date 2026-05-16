import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "@/lib/auth/requireAuth";
import { loadCoffeeLibraryCompact, formatLibraryForPrompt } from "@/lib/claude/coffeeLibrary";
import { db } from "@/lib/db/client";
import { sessions } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { rowToSession } from "@/lib/db/helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * BTTS Conversation Starter (specs/home.md §8) — daily editorial Haiku.
 *
 * Generates a single 8–16 word sentence based on the user's recent
 * brew context: roaster they brewed yesterday, library snapshot, time
 * of day. One call per calendar day; the client caches the result in
 * localStorage keyed by date and only re-fetches at midnight.
 *
 * Returns `{ text }` on success. Errors surface as 500; the client
 * keeps the previous day's cached text rather than rendering nothing.
 */

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are writing the opening line of a personal coffee app each morning. One short editorial sentence — 8 to 16 words. Direct, warm, specific. You speak to the user as a writer would open a letter, not as a chatbot.

RULES
- Exactly one sentence. A trailing question mark is fine when natural; never an exclamation mark.
- 8 to 16 words.
- Reference one concrete signal from the context if it's there — a specific roaster from yesterday's brew, a coffee they haven't touched in a while, the time of day — and turn it into an invitation, not a report.
- If the user has no recent brews and an empty library, fall back to a quiet welcome.
- No emojis, no markdown, no second sentence, no preamble like "Here's your greeting:".

TIME-OF-DAY DISCIPLINE
- The context block tells you the current time of day. Use that label or omit time entirely — never invent a different one.
  • "morning" → "Good morning", "Morning", "Early start"
  • "midday" / "afternoon" → "Quiet afternoon", "Midday lull"
  • "evening" → "Evening already", "End of the day"
  • "late-night" → "Late night", "Past midnight"
- NEVER say "late night" when the context says evening. NEVER say "morning" when the context says afternoon. Etc.

COFFEE-HISTORY DISCIPLINE
- Each library line shows session count and average rating ("3.8★ over 5") or "unbrewed" when the bag has never been brewed.
- A coffee with session count > 0 HAS been brewed. Never say "haven't brewed yet" or "untried" for those.
- "unbrewed" entries are the only ones you may describe as untouched.
- For a brewed coffee you may invite a return ("worth revisiting", "ready for another round") — not a first try.

ROTATION DISCIPLINE
- Library lines prefixed with "★ IN ROTATION" are the user's active rotation — bags they consider current. Treat these as the primary candidates for the day's invitation.
- If the library has ANY rotation entries, prefer one of them over a non-rotation entry, unless a recent brew makes a non-rotation reference more natural.
- "★ IN ROTATION" is a prefix marker, not part of the coffee name — never echo it back in the sentence.

EXAMPLES (style only — do not copy)
- Good morning. DAK Coffee Roasters yesterday — try Process or anything new today?
- Quiet afternoon. The Friedhats Wush Wush hasn't moved in a week.
- Evening already — the Pacas you brewed at lunch is calling for a second round.

Return the sentence only.`;

interface RequestBody {
  // Reserved for future client-side overrides (timezone, etc.). For now
  // we use the server clock + Europe/Berlin assumption mirrored from
  // CLAUDE.md.
}

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  try {
    // Body is currently unused but parse defensively in case of stray
    // payloads, so a malformed body doesn't 400 here.
    await req.json().catch(() => ({} as RequestBody));

    const [library, recentRows] = await Promise.all([
      // Only the last few bags in active rotation — the Haiku biases
      // toward what the user is brewing right now, not their full
      // historical library.
      loadCoffeeLibraryCompact(4).catch(() => []),
      db
        .select()
        .from(sessions)
        .orderBy(desc(sessions.createdAtMs))
        .limit(5)
        .catch(() => []),
    ]);
    const recentSessions = (recentRows as unknown[]).map((row) =>
      rowToSession(row as Parameters<typeof rowToSession>[0])
    );

    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const timeOfDay =
      hour < 5 ? "late-night"
      : hour < 11 ? "morning"
      : hour < 14 ? "midday"
      : hour < 18 ? "afternoon"
      : hour < 22 ? "evening"
      : "late-night";
    const localHHMM = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

    const recentLines = recentSessions
      .slice(0, 3)
      .map((s) => {
        const roaster = s.coffee?.roaster?.trim() ?? "";
        const name = s.coffee?.name?.trim() ?? "";
        const star = s.result?.rating ? `${s.result.rating}★` : "";
        return `- ${roaster} ${name} ${star}`.trim();
      })
      .filter(Boolean);

    // formatLibraryForPrompt renders each line as
    //   - ROASTER — NAME | ORIGIN PROCESS | roasted Xd ago | X.X★ over N
    // so Haiku sees session counts + ratings and won't claim a brewed
    // coffee is "untried" — the earlier bare roaster+name line gave
    // Haiku no signal, so it hallucinated "haven't brewed yet" on a
    // bag that had 1+ saved sessions.
    const libraryBlock = formatLibraryForPrompt(library);

    const userBlock = [
      `Time of day: ${timeOfDay} (local clock ${localHHMM}). Use this label exactly, or omit time entirely.`,
      recentLines.length > 0
        ? `Recent brews:\n${recentLines.join("\n")}`
        : "Recent brews: none in the last few days.",
      libraryBlock.length > 0
        ? `Library snapshot (with usage):\n${libraryBlock}`
        : "Library snapshot: empty.",
    ].join("\n\n");

    const completion = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 80,
      temperature: 0.7,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userBlock }],
    });

    const textBlock = completion.content.find((b) => b.type === "text");
    const text = (textBlock && "text" in textBlock ? textBlock.text : "").trim();

    if (!text) {
      return NextResponse.json({ error: "empty response" }, { status: 500 });
    }

    return NextResponse.json({ text });
  } catch (err) {
    console.error("greeting error:", err);
    return NextResponse.json({ error: "generation failed" }, { status: 500 });
  }
}
