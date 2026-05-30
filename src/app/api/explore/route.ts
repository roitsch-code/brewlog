import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getInsights } from "@/lib/knowledge/insights";
import { getAlerts } from "@/lib/knowledge/alerts";
import { requireAuth } from "@/lib/auth/requireAuth";
import { buildHistorySummary, buildRecentRecipes } from "@/lib/claude/historyUtils";
import { buildEscherTerrain } from "@/lib/claude/escher";
import { loadUserProfile, formatProfileForPrompt } from "@/lib/claude/userProfile";
import { loadCoffeeLibraryCompact, formatLibraryForPrompt } from "@/lib/claude/coffeeLibrary";
import { getRoasterPrior, formatRoasterPriorForPrompt } from "@/lib/roasters/priors";
import {
  getVarietyPrior,
  formatVarietyPriorForPrompt,
} from "@/lib/knowledge/varieties";
import { TECHNIQUES } from "@/lib/knowledge/techniques";
import type { Session } from "@/lib/types/session";

export const dynamic = "force-dynamic";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const USER_LOCATION = process.env.USER_LOCATION || "Germany";

const SYSTEM_PROMPT = `You are a world-class specialty coffee expert. You are speaking directly with a semi-expert coffee enthusiast based in ${USER_LOCATION}. Address them as "you" throughout — never refer to them in the third person.

## Your Knowledge Base

**Filter brewing expertise:**
- V60 (Hario, Orea V4), AeroPress, Clever Dripper (James Hoffmann method), Kalita Wave, Chemex, Moccamaster
- Deep understanding of percolation vs. immersion brewing dynamics
- Championship recipes: Kasuya 4:6, Peng Jiajun 2025 WBC temp-staging, Wölfl 2024 Orea FAST

**Expert canon — attribute ideas to these people by name when relevant:**
Science: Jonathan Gagné (extraction physics), Christopher Hendon (water chemistry), Emma Sage (brewing science), Samo Smrke (aroma compounds), Chahan Yeretzian (volatiles).
Brewing: Matt Perger (extraction/agitation theory), Scott Rao (brewing control, roasting), Patrik Rolf (minimalist/clarity systems), Tetsu Kasuya (4:6 method), Lance Hedrick (dialling-in), Matt Winton (precision brewing), Brian Quan (experimentation), Kyle Rowsell (grinder workflow).
Roasting: Scott Rao, Rob Hoos (sensory-based profiling).
Origin/Sourcing: Tim Wendelboe (direct trade, light roast, terroir), George Howell (origin quality), Kim Elena Ionescu (sustainability).
Processing: Lucia Solis (fermentation science), Saša Šestić (experimental processing), Jamison Savage (advanced fermentation).
Sensory: Erin McCarthy (cupping systems), Agnieszka Rojewska (precision evaluation).
Education: James Hoffmann (global coffee systems), Lani Kingston (science communication).
Tools: Denis Basaric (water systems), Doug Weber (espresso tools).
Competitions: WBC, WAC, WCCE — cite by competitor name and year.

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

## About Better taste than sorry / BTTS (the app you're inside)

You are part of Better taste than sorry (BTTS), a personal brew advisor PWA. The app is always called "Better taste than sorry" or "BTTS" — never any other name. The user can: log home or café brews, scan a coffee bag photo (you'll see extracted bag data), follow guided multi-step brew flows with a circular pour timer, browse their coffee library and roaster profiles, view a Taste profile with an AI-written summary, run a Match flow to score the current coffee against past sessions, and explore cafés on a map. When the user's question would be better answered by another part of BTTS, name the feature: e.g. "open Match to score this", "your Taste profile shows…", "log it as a café brew under Cafés".

The user's equipment, grind settings, taste preferences, recent recipes, and current coffee library are injected dynamically below. Use them as the personal source of truth; do not invent details that aren't shown.

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
- **Attribute ideas to experts** — cite who is behind a claim when it adds value, e.g. "Gagné's extraction model" or "Rolf's minimal-variable philosophy". Only cite experts from the canon above. Don't force attribution into every sentence.
- **Distinguish evidence levels** when the distinction matters — label as (scientific), (applied), or (anecdotal). Scientific = peer-reviewed / chemistry / physics. Applied = competition / field-tested. Anecdotal = experience-based.
- **Surface trade-offs and expert disagreements** when relevant — e.g. high extraction (Perger) vs simplicity (Rolf), or competing explanations for a problem.
- **In exploratory questions, suggest experiments** — e.g. "Try X → this tests Gagné vs Rolf assumption". Offer comparisons ("Rao vs Hedrick approach to dialling in") and hypotheses ("Your bitterness may come from uneven extraction per Perger, or roast development per Rao").

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
    const [insights, alerts, userPrefs, library] = await Promise.all([
      getInsights(10).catch(() => []),
      getAlerts(5).catch(() => []),
      loadUserProfile().catch(() => null),
      loadCoffeeLibraryCompact(30).catch(() => []),
    ]);

    // Cached "About you" block — built from preferences table, falls back to canonical defaults.
    const profileBlock = formatProfileForPrompt(userPrefs);

    // Build dynamic context to append to system prompt
    const contextParts: string[] = [];

    // Brew history — makes explore context-aware of recent brews
    const recentSessions: Session[] = Array.isArray(body.recentSessions)
      ? body.recentSessions.slice(0, 10)
      : [];

    // Compact recipe block: actual dose/water/grind/temp/timing for the last 5 brews.
    const recipesBlock = buildRecentRecipes(recentSessions, 5);
    if (recipesBlock) {
      contextParts.push(
        `\n## Your Recent Recipes (actual numbers from the last brews — reference these directly when relevant)\n` +
          recipesBlock
      );
    }

    if (recentSessions.length > 0) {
      if (recentSessions.length >= 5) {
        // Escher terrain: teaching prose about what keeps happening in the log
        try {
          const terrain = await buildEscherTerrain(recentSessions);
          if (terrain) {
            contextParts.push(
              `\n## Your Brew Pattern Context (use as background — do not repeat verbatim)\n` + terrain
            );
          } else {
            contextParts.push(
              `\n## Your Recent Brews\n` + buildHistorySummary(recentSessions, 5)
            );
          }
        } catch {
          contextParts.push(
            `\n## Your Recent Brews\n` + buildHistorySummary(recentSessions, 5)
          );
        }
      } else {
        contextParts.push(
          `\n## Your Recent Brews (use this as context for personal questions)\n` +
            buildHistorySummary(recentSessions, 5)
        );
      }
    }

    // Coffee library — bags currently in rotation (most recently added first).
    const libraryBlock = formatLibraryForPrompt(library);
    if (libraryBlock) {
      contextParts.push(
        `\n## Your Coffee Library (bags you have logged — use to answer "what should I open next" questions)\n` +
          libraryBlock
      );
    }

    // Roaster style priors — for the unique roasters appearing in the recent sessions.
    const recentRoasters = Array.from(
      new Set(
        recentSessions
          .map((s) => s.coffee?.roaster?.trim())
          .filter((r): r is string => !!r && r.length > 0)
      )
    ).slice(0, 5);
    if (recentRoasters.length > 0) {
      const priorBlocks = recentRoasters.map((name) =>
        formatRoasterPriorForPrompt(getRoasterPrior(name))
      );
      contextParts.push(
        `\n## Roaster Style Priors (for roasters in your recent sessions — user brew history overrides these)\n` +
          priorBlocks.join("\n\n")
      );
    }

    // Variety priors — for the unique varieties appearing in recent sessions.
    // WCR-grounded genetic / cup-character context for the coffees in rotation.
    const recentVarieties = Array.from(
      new Set(
        recentSessions
          .flatMap((s) =>
            (s.coffee?.variety ?? "")
              .split(/\s*(?:[,/+&]|\band\b)\s*/i)
              .map((v) => v.trim())
              .filter(Boolean)
          )
      )
    );
    const matchedVarietyPriors = recentVarieties
      .map((v) => getVarietyPrior(v))
      .filter((p): p is NonNullable<typeof p> => !!p);
    const dedupedVarietyPriors = Array.from(
      new Map(matchedVarietyPriors.map((p) => [p.name, p])).values()
    ).slice(0, 6);
    if (dedupedVarietyPriors.length > 0) {
      contextParts.push(
        `\n## Variety Priors (genetics + cup signature for varieties in your recent sessions — WCR-grounded)\n` +
          dedupedVarietyPriors
            .map(formatVarietyPriorForPrompt)
            .join("\n\n")
      );
    }

    // Available techniques — atomic-move vocabulary for composing answers.
    // Compact form (id + one-line description) — full mechanism is in the
    // techniques data module, not duplicated here.
    contextParts.push(
      `\n## Available Brewing Techniques (atomic moves you can cite by id when teaching)\n` +
        TECHNIQUES.map((t) => `- ${t.id} (${t.attribution.person}): ${t.description}`).join("\n")
    );

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
        `\n## Recent Coffee Alerts\n` +
          alerts
            .map(
              a =>
                `- **${a.roaster} — ${a.coffeeName}** | ${a.origin}${a.process ? ` ${a.process}` : ""} | Score: ${a.score}/100 | ${a.summary}`
            )
            .join("\n")
      );
    }

    const dynamicContext = contextParts.length > 0 ? contextParts.join("") : "";

    const stream = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 900,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
        { type: "text", text: profileBlock, cache_control: { type: "ephemeral" } },
        ...(dynamicContext ? [{ type: "text" as const, text: dynamicContext }] : []),
      ],
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    });

    const encoder = new TextEncoder();
    const sse = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        };

        let buffer = "";
        // Emit visible text in chunks, withholding any unclosed "[Ix]" tag so it
        // never flashes to the client before we strip it at the end.
        const flushVisible = (incoming: string) => {
          buffer += incoming;
          const openIdx = buffer.lastIndexOf("[");
          let emit = buffer;
          let hold = "";
          if (openIdx !== -1 && buffer.indexOf("]", openIdx) === -1) {
            emit = buffer.slice(0, openIdx);
            hold = buffer.slice(openIdx);
          }
          if (emit) {
            const cleaned = emit.replace(/\s*\[I\d+\]/g, "");
            if (cleaned) send("delta", { text: cleaned });
          }
          buffer = hold;
        };

        try {
          let full = "";
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              full += event.delta.text;
              flushVisible(event.delta.text);
            }
          }
          // Flush anything still held back (usually a stray "[")
          if (buffer) {
            const cleaned = buffer.replace(/\s*\[I\d+\]/g, "");
            if (cleaned) send("delta", { text: cleaned });
            buffer = "";
          }

          const citedIds: string[] = [];
          const idRegex = /\[I(\d+)\]/g;
          let idMatch: RegExpExecArray | null;
          while ((idMatch = idRegex.exec(full)) !== null) {
            citedIds.push(`I${idMatch[1]}`);
          }
          const sources: { title: string; url: string }[] = [];
          for (const id of citedIds) {
            const insight = insightMap.get(id);
            if (insight?.url && /^https?:\/\/.+/.test(insight.url)) {
              if (!sources.some(s => s.url === insight.url)) {
                sources.push({ title: insight.title, url: insight.url });
              }
            }
          }

          send("done", { sources: sources.length > 0 ? sources : undefined });
        } catch (err) {
          console.error("explore stream error:", err);
          send("error", { error: "Stream failed" });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(sse, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    console.error("explore/route error:", err);
    return NextResponse.json({ error: "Failed to get response" }, { status: 500 });
  }
}
