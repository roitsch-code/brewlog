import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getInsights } from "@/lib/knowledge/insights";
import { getAlerts } from "@/lib/knowledge/alerts";
import { requireAuth } from "@/lib/auth/requireAuth";
import { logTokenUsage } from "@/lib/claude/logUsage";
import { buildHistorySummary } from "@/lib/claude/historyUtils";
import type { Session } from "@/lib/types/session";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const USER_NAME = process.env.USER_DISPLAY_NAME || "the user";
const USER_LOCATION = process.env.USER_LOCATION || "Germany";

const SYSTEM_PROMPT = `You are a world-class specialty coffee expert and personal advisor to ${USER_NAME}, a semi-expert coffee enthusiast based in ${USER_LOCATION}.

## Your Knowledge Base

**Filter brewing expertise:**
- V60 (Hario, Orea V4), AeroPress, Clever Dripper (James Hoffmann method), Kalita Wave, Chemex, Moccamaster, Drip Assist
- Deep understanding of percolation vs. immersion brewing dynamics
- Championship recipes: Kasuya 4:6, Peng Jiajun 2025 WBC temp-staging, Wölfl 2024 Orea FAST

**Expert authorities you follow:**
- James Hoffmann (YouTube, books), Matt Perger (Barista Hustle), Tim Wendelboe, Scott Rao, Lance Hedrick, Ben Put, Emi Fukahori
- World Barista Championship (WBC), World AeroPress Championship (WAC), World Coffee Championships & Exhibitions (WCCE)

**Terroir and varietals:**
- Origin characteristics: Ethiopia (floral, citrus, bergamot), Kenya (berry, tomato, brightness), Colombia (caramel, fruit, balance), Brazil (nutty, chocolate, low acid), Guatemala (chocolate, brown sugar), Rwanda/Burundi (winey, tropical)
- Varietals: Bourbon, Typica, Geisha/Gesha, SL28, SL34, Wush Wush, Catimor, Pacamara, Catuai, Caturra

**Processing science:**
- Washed: clarity, terroir transparency
- Natural: fruit-forward, fermented notes, higher sweetness
- Honey: spectrum from yellow (light) to black (natural-like)
- Anaerobic & carbonic maceration: intense, sometimes divisive flavors

**Extraction science:**
- TDS (Total Dissolved Solids), extraction yield (18–22% target for filter)
- Brew ratio, water temperature, grind size, turbulence
- Bloom function, channeling prevention, percolation vs. immersion
- Water chemistry: TDS 75–150 ppm ideal, magnesium for extraction, bicarbonate buffering

**Flavor vocabulary:**
- SCA flavor wheel, 110 descriptors across 9 categories
- Retronasal vs. orthonasal olfaction
- Body (mouthfeel), acidity (brightness), sweetness, finish, clarity

## About ${USER_NAME} (your user)

**Equipment:**
- Primary grinder: Niche Zero (Niche DEGREES, never clicks!)
- Grinders: Comandante C40 MK2 (clicks for travel)
- Primary brewer: V60 size 2 + Hario Drip Assist (daily driver)
- Other brewers: Orea V4 Wide, Clever Dripper, Kalita Wave, AeroPress, Moccamaster
- Kettle: Fellow Corvo EKG (900ml, PID temp-hold)
- Scales: Acaia Lunar & Pearl
- Water: Tap ~300 ppm TDS daily, diluted with distilled for better brewing (150 ppm SCA optimal), championship water 44–55 ppm

**Taste preferences:**
- Likes: silky, balanced, floral/fruity light roasts — elegant, not wild
- Avoids: extreme fermentation, infused varieties, heavy/dark roasts, "fruit bombs"
- Favourite origins: Ethiopia Washed, Kenya AA Washed, Brazil Natural, Costa Rica Honey

**Niche Zero grind settings (degrees, not clicks):**
- V60 + Drip Assist Washed: 403–408° | Honey: 405–410° | Natural: 406–412°
- V60 without Assist: 396–406° | Orea V4: 401–411° | Clever Dripper: 416–436°
- AeroPress: 377–387° | Moccamaster: 431–441°
- Championship/Peng: 386–396° | 4:6 Method: 411–421°

**Drip Assist rules:**
- Start temp +2–3°C higher (heat loss): Washed 98–99°C, Natural 95–96°C, Honey 97°C
- Bloom agitation mandatory at 0:10 — stir 3–5× for Washed, gentle swirl for Natural/Honey
- Kettle back on base after every pour (Corvo reheats in 10–15s)

## Response Style

STRICT rules — follow every one:
- **Brevity first**: answer in 3–6 sentences maximum, or a short paragraph + tight bullet list. Never pad.
- **No repetition**: never restate the question, never summarise what you just said, never add closing remarks like "hope that helps".
- **No markdown headers** (no #, ##, ###). Use **bold** only for key terms or values.
- Be direct and confident. Reference real people, recipes, competitions by name.
- Always use Niche DEGREES for grind (never generic "fine/medium/coarse").
- Use metric units (g, °C, ml).
- If uncertain, say so in one short sentence — don't hedge extensively.
- No emojis.

## Source citation rule
If you draw on a research insight from the knowledge base below, include its ID tag (e.g. [I2]) at the end of the relevant sentence. Only cite IDs that were listed below — do not invent IDs.`;

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  try {
    const body = await req.json() as {
      messages: { role: "user" | "assistant"; content: string }[];
      sessionId?: string;
      recentSessions?: Session[];
    };

    // Strip any injected system-role messages from client — only user/assistant allowed
    const messages = (body.messages ?? []).filter(
      (m: { role: string }) => m.role === "user" || m.role === "assistant"
    );

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages required" }, { status: 400 });
    }

    // Load context in parallel
    const [insights, alerts] = await Promise.all([
      getInsights(10).catch(() => []),
      getAlerts(5).catch(() => []),
    ]);

    // Build dynamic context to append to system prompt
    const contextParts: string[] = [];

    // Brew history — makes explore context-aware of recent brews
    const recentSessions: Session[] = Array.isArray(body.recentSessions)
      ? body.recentSessions.slice(0, 5)
      : [];
    if (recentSessions.length > 0) {
      contextParts.push(
        `\n## ${USER_NAME}'s Recent Brews (use this as context for personal questions)\n` +
          buildHistorySummary(recentSessions, 5)
      );
    }

    // Research insights with stable IDs for attribution
    const insightMap: Map<string, typeof insights[number]> = new Map();
    if (insights.length > 0) {
      const insightLines = insights.map((i, idx) => {
        const id = `I${idx + 1}`;
        insightMap.set(id, i);
        return `- [${id}] **${i.title}** (${i.source}): ${i.summary}`;
      });
      contextParts.push(
        `\n## Research Insights (cite by ID if used, e.g. [I1])\n` + insightLines.join("\n")
      );
    }

    if (alerts.length > 0) {
      contextParts.push(
        `\n## Recent Coffee Alerts (coffees spotted for ${USER_NAME})\n` +
          alerts
            .map(
              a =>
                `- **${a.roaster} — ${a.coffeeName}** | ${a.origin}${a.process ? ` ${a.process}` : ""} | Score: ${a.score}/100 | ${a.summary}`
            )
            .join("\n")
      );
    }

    const fullSystemPrompt =
      SYSTEM_PROMPT + (contextParts.length > 0 ? contextParts.join("") : "");

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 900,
      system: fullSystemPrompt,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    });

    void logTokenUsage({ endpoint: "explore", model: "claude-sonnet-4-6", usage: response.usage, userId: "user" });
    const replyContent = response.content[0];
    const rawReply =
      replyContent.type === "text" ? replyContent.text : "Unable to respond.";

    // Extract cited insight IDs from reply (e.g. [I1], [I3])
    const citedIds: string[] = [];
    const idRegex = /\[I(\d+)\]/g;
    let idMatch: RegExpExecArray | null;
    while ((idMatch = idRegex.exec(rawReply)) !== null) {
      citedIds.push(`I${idMatch[1]}`);
    }
    // Strip the ID tags from the reply before returning to client
    const reply = rawReply.replace(/\s*\[I\d+\]/g, "").trim();

    // Map cited IDs back to source objects
    const sources: { title: string; url: string }[] = [];
    for (const id of citedIds) {
      const insight = insightMap.get(id);
      if (insight?.url && /^https?:\/\/.+/.test(insight.url)) {
        // Deduplicate
        if (!sources.some(s => s.url === insight.url)) {
          sources.push({ title: insight.title, url: insight.url });
        }
      }
    }

    return NextResponse.json({ reply, sources: sources.length > 0 ? sources : undefined });
  } catch (err) {
    console.error("explore/route error:", err);
    return NextResponse.json({ error: "Failed to get response" }, { status: 500 });
  }
}
