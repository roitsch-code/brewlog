import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "@/lib/auth/requireAuth";
import { loadCoffeeLibraryCompact, formatLibraryForPrompt } from "@/lib/claude/coffeeLibrary";
import { loadUserProfile } from "@/lib/claude/userProfile";
import { db } from "@/lib/db/client";
import { sessions } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { rowToSession } from "@/lib/db/helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * BTTS Conversation Starter (specs/home.md §8) — daily editorial line.
 *
 * Generates a single warm sentence that makes ONE science-grounded
 * brewing suggestion from the user's active rotation: a specific bag +
 * a method + a short reason (origin/process fit, time of day, an
 * expert/championship reference). One call per (date, time-bucket);
 * cached client-side in localStorage.
 *
 * Returns `{ text }` on success. Errors surface as 500; the client
 * keeps the previous cached text rather than rendering nothing.
 */

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Fetch today's weather for the user's location via Open-Meteo (free,
 * keyless). Coordinates come from WEATHER_LATITUDE / WEATHER_LONGITUDE
 * env vars, defaulting to Cologne (the app's home region). Returns a
 * short prompt-ready line, or null on any failure / timeout — weather
 * is strictly optional context and must never block the greeting.
 */
async function fetchWeather(): Promise<string | null> {
  const lat = process.env.WEATHER_LATITUDE ?? "50.9375";
  const lon = process.env.WEATHER_LONGITUDE ?? "6.9603";
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min` +
      `&timezone=auto&forecast_days=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const data = await res.json();
    const nowC = data?.current?.temperature_2m;
    const maxC = data?.daily?.temperature_2m_max?.[0];
    const code = data?.current?.weather_code;
    if (nowC == null) return null;
    const cond = describeWeatherCode(code);
    const parts = [`currently ${Math.round(nowC)}°C${cond ? `, ${cond}` : ""}`];
    if (maxC != null) parts.push(`today's high ${Math.round(maxC)}°C`);
    return parts.join(", ");
  } catch {
    return null;
  }
}

/** Coarse WMO weather-code → label. Only what's useful for a coffee line. */
function describeWeatherCode(code: unknown): string {
  const c = typeof code === "number" ? code : -1;
  if (c === 0) return "clear";
  if (c <= 3) return "partly cloudy";
  if (c <= 48) return "foggy";
  if (c <= 67) return "rainy";
  if (c <= 77) return "snowy";
  if (c <= 82) return "showers";
  if (c <= 99) return "stormy";
  return "";
}

const SYSTEM_PROMPT = `You are writing the opening line of a personal coffee app each morning. ONE short, warm sentence that makes a smart, specific brewing suggestion for today — a real recommendation a knowledgeable barista friend would text you, grounded in coffee science. Not a status report, not a generic greeting.

THE SHAPE (this is the whole point)
Pair a specific bag from the user's rotation with a brewing method, and give a one-clause reason. Examples of the target voice (style only — never copy):
- "Burundi in the Clever Dripper — that'd be a smart next move for its body."
- "Warm afternoon — why not take the La Coipa over ice with a Japanese iced V60?"
- "Hoffmann swears by the V60 for Ethiopians; worth trying yours that way today."
- "The washed Kenya is built for clarity — bare V60, gentle pours, let it sing."

RULES
- One sentence, 10 to 22 words. A trailing question mark is fine; never an exclamation mark.
- Name ONE specific bag from the rotation AND ONE brewing method the user actually owns (see Equipment). The pairing must be defensible by the science below.
- Give a short reason — origin/process fit, time of day, or an expert/championship reference. Keep it to one clause.
- No emojis, no markdown, no second sentence, no preamble like "Here's your greeting:". Return the sentence only.

BREWING SCIENCE — pair intelligently (this is what makes it smart, not random):
- Washed light African (Ethiopia, Kenya, Burundi, Rwanda): clarity-forward. Bare V60, Origami cone, or Chemex. Hoffmann's V60 is the canonical move for Ethiopians. High temp, gentle agitation.
- Naturals & honeys: sweetness/body-forward. Clever Dripper (immersion sweetness), Origami wave, or Kalita. Lower-ish temp, fewer pours.
- Dense high-grown or competition lots: Kasuya 4:6 to tune acidity vs sweetness across the pour, or a high-extraction V60.
- Experimental/anaerobic: short bed-contact + turbulence keeps it clean — Orea Fast (Wölfl 2024 WAC method).
- Hot weather / warm afternoon or midday: suggest iced — Japanese iced V60/Kalita (brew hot onto ice, keeps aromatics) or an iced AeroPress concentrate. Best on fruit-forward naturals/honeys.
- Body-forward mood or a chocolatey/nutty bag: immersion (Clever) or Origami wave.
Only suggest a method the user owns. Only suggest a bag in the rotation. Never invent a brewer or a bean.

TIME-OF-DAY DISCIPLINE
- The context block tells you the current time of day. Use that label or omit time entirely — never invent a different one.
  • "morning" → "Good morning", "Morning", "Early start"
  • "midday" / "afternoon" → "Quiet afternoon", "Midday lull", "Warm afternoon"
  • "evening" → "Evening already", "End of the day"
  • "late-night" → "Late night", "Past midnight"
- NEVER say "late night" when the context says evening, etc.

COFFEE-HISTORY DISCIPLINE
- Each library line shows session count and average rating ("3.8★ over 5") or "unbrewed".
- A coffee with session count > 0 HAS been brewed — never call it "untried". You may still recommend brewing it a new way.
- "unbrewed" entries are the only ones you may frame as a first try.

ROTATION DISCIPLINE
- Library lines prefixed with "★ IN ROTATION" are the bags the user currently has access to. The suggestion MUST name a rotation bag. NEVER reference a non-rotation bag — it's out of reach.
- Only when the library shows ZERO rotation entries may you reference a non-rotation bag, or fall back to a quiet welcome if the library is empty.
- "★ IN ROTATION" is a prefix marker, not part of the name — never echo it back.

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

    const [library, recentRows, profile, weather] = await Promise.all([
      // Only the last few bags in active rotation — the line biases
      // toward what the user is brewing right now, not their full
      // historical library.
      loadCoffeeLibraryCompact(4).catch(() => []),
      db
        .select()
        .from(sessions)
        .orderBy(desc(sessions.createdAtMs))
        .limit(5)
        .catch(() => []),
      loadUserProfile().catch(() => null),
      fetchWeather(),
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

    const equipment = profile?.equipment?.length
      ? profile.equipment.join(", ")
      : "V60, Orea V4, Origami Dripper, Clever Dripper, Kalita Wave, AeroPress, Moccamaster, Chemex";

    const userBlock = [
      `Time of day: ${timeOfDay} (local clock ${localHHMM}). Use this label exactly, or omit time entirely.`,
      weather
        ? `Weather (${weather}). OPTIONAL — use only if it genuinely changes the smart call (notably warm ≥26°C → iced is the move; otherwise ignore weather entirely and don't mention it).`
        : "Weather: unavailable — recommend on bean/method/science alone.",
      `Brewers the user owns (only suggest from these): ${equipment}.`,
      recentLines.length > 0
        ? `Recent brews:\n${recentLines.join("\n")}`
        : "Recent brews: none in the last few days.",
      libraryBlock.length > 0
        ? `Library snapshot (★ IN ROTATION = available now; lines show ORIGIN PROCESS so you can pair a method):\n${libraryBlock}`
        : "Library snapshot: empty.",
    ].join("\n\n");

    const completion = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 120,
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
