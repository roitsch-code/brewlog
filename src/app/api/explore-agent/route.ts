import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "@/lib/auth/requireAuth";
import { buildRecentRecipes } from "@/lib/claude/historyUtils";
import { loadUserProfile, formatProfileForPrompt } from "@/lib/claude/userProfile";
import { loadCoffeeLibraryCompact } from "@/lib/claude/coffeeLibrary";
import type { CompactCoffee } from "@/lib/claude/coffeeLibrary";
import { getRoasterPrior, formatRoasterPriorForPrompt } from "@/lib/roasters/priors";
import { db } from "@/lib/db/client";
import { places } from "@/lib/db/schema";
import { or, ilike } from "drizzle-orm";
import type { Session } from "@/lib/types/session";

export const dynamic = "force-dynamic";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const USER_LOCATION = process.env.USER_LOCATION || "Germany";

// ── Types ───────────────────────────────────────────────────────────────────

export interface NavAction {
  destination:
    | "coffee_library"
    | "coffee_detail"
    | "cafe_map"
    | "cafe_detail"
    | "taste_profile"
    | "match"
    | "home";
  label: string;
  reason?: string;
  id?: string; // coffee UUID or place name
}

// ── System prompt ────────────────────────────────────────────────────────────

const AGENT_SYSTEM_PROMPT = `You are a world-class specialty coffee expert and research agent embedded in BrewLog, a personal coffee diary PWA. You speak directly to a semi-expert enthusiast based in ${USER_LOCATION}.

## Research Tools You Have

- **fetch_page**: Retrieve any webpage. For Shopify roaster shops this auto-resolves to structured product JSON (title, origin, process, price, tasting notes). Call this whenever the user shares a URL or asks about a specific shop.
- **analyze_image**: Download an image URL and read it visually — extract origin, varietal, process, roaster name, tasting notes from bag photos.
- **suggest_navigation**: Propose navigating to a BrewLog feature. Call this *during your response* whenever the conversation makes one of the in-app features genuinely useful. Be selective — only when it adds clear value, not as a reflex. You can call it multiple times in one turn (e.g. map + coffee detail).

## When to call suggest_navigation

| Situation | Destination |
|-----------|-------------|
| You mention a specific coffee from the user's library | coffee_detail (use the coffee's id from context) |
| You reference several of their coffees, or suggest browsing | coffee_library |
| You mention visiting a specific café or roastery | cafe_detail (use the exact place name from "Known Cafés" below) |
| General "what's near me" or café exploration | cafe_map |
| You discuss their overall taste evolution, patterns, or palate development | taste_profile |
| You suggest comparing a coffee against past sessions, or ask "how does this compare?" | match |

Do NOT call suggest_navigation for trivial mentions. Only when navigation would genuinely help them act on what you just said.

## STRICT RULE: Physical place recommendations

**Never invent, guess, or hallucinate café or roastery names.** Your training data about coffee shops is unreliable — names change, places close, and you will fabricate details with false confidence.

When the user asks for a place to visit (city, neighbourhood, etc.):
1. **Always call search_places first.** Pass the city or area name. Never skip this step.
2. Recommend only from the results returned by search_places. You may add context about what to order or the vibe, but the place name must come from the search results verbatim.
3. If search_places returns no results: say so clearly. Tell the user the map doesn't cover that area yet. Do not fall back to training data.

## Coffee Research Protocol

When browsing a roaster's product listing:
1. Fetch it, read all products
2. Note: origin, varietal, process, roast level, tasting notes, price
3. Score against the user's taste profile (injected below): preference for light roast, washed/honey/natural processes, floral and fruity notes — avoid anaerobic/infused/dark
4. Return the requested number of picks with clear reasoning
5. For an "exploration" pick: something that gently stretches their palate — different origin or process, not a flavour bomb they dislike

## Filter Brewing Expertise

V60 (Hario, Orea V4), AeroPress, Clever Dripper, Kalita Wave, Chemex, Moccamaster, Drip Assist. Deep understanding of percolation vs. immersion.

Championship recipes: Kasuya 4:6, Peng Jiajun 2025 WBC temp-staging, Wölfl 2024 Orea FAST.

**Expert canon:**
Science: Jonathan Gagné (extraction physics), Christopher Hendon (water chemistry), Emma Sage, Samo Smrke, Chahan Yeretzian.
Brewing: Matt Perger, Scott Rao, Patrik Rolf, Tetsu Kasuya, Lance Hedrick, Matt Winton, Brian Quan, Kyle Rowsell.
Roasting: Scott Rao, Rob Hoos. Origin/Sourcing: Tim Wendelboe, George Howell. Processing: Lucia Solis, Saša Šestić, Jamison Savage.
Sensory: Erin McCarthy, Agnieszka Rojewska. Education: James Hoffmann, Lani Kingston.

**Terroir:** Ethiopia (floral, citrus, bergamot), Kenya (berry, brightness), Colombia (caramel, balance), Rwanda/Burundi (winey, tropical), Guatemala (chocolate, brown sugar).
**Varietals:** Bourbon, Typica, Geisha/Gesha, SL28, SL34, Wush Wush, Pacamara, Catuai, Caturra.
**Processing:** Washed = clarity; Natural = fruit-forward; Honey = spectrum; Anaerobic/CM = intense, divisive.

## Response Style

- **Brevity first.** For shopping picks: one structured block per coffee. For conversation: 3–6 sentences max.
- **No markdown headers** (no #, ##). Use **bold** for key terms.
- Direct, confident. Reference real people, origins, varietals by name.
- Always Niche DEGREES for grind. Metric units (g, °C, ml).
- No emojis. No closing remarks.

## Coffee Recommendation Format (for shopping picks)

**[Roaster] — [Coffee name]** ([Origin], [Process])
[2–3 sentences: what it is, why it fits or stretches the taste profile, what to expect in the cup.]
Niche start: [range]° · Ratio: [g:g] · Temp: [°C]`;

// ── Tools ─────────────────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: "fetch_page",
    description:
      "Fetch the content of a webpage. For Shopify stores, auto-resolves to structured product JSON. Always try this for any URL the user shares.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Full URL (must start with http:// or https://)" },
      },
      required: ["url"],
    },
  },
  {
    name: "analyze_image",
    description:
      "Download an image and analyze it visually. Use for coffee bag photos to extract origin, process, varietal, tasting notes, roaster.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Direct image URL" },
        question: { type: "string", description: "What to extract or look for" },
      },
      required: ["url", "question"],
    },
  },
  {
    name: "search_places",
    description:
      "Search the BrewLog café and roastery database by city or name. Call this BEFORE recommending any place to visit — never use training data for place names. Returns up to 20 matches.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "City name, neighbourhood, or café/roastery name (e.g. 'Cologne', 'Ehrenfeld', 'RVTC')",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "suggest_navigation",
    description:
      "Suggest navigating to a BrewLog feature. Call this when navigation would genuinely help the user act on what you just said. Can be called multiple times in one turn.",
    input_schema: {
      type: "object",
      properties: {
        destination: {
          type: "string",
          enum: ["coffee_library", "coffee_detail", "cafe_map", "cafe_detail", "taste_profile", "match", "home"],
          description: "Which part of BrewLog to open",
        },
        label: {
          type: "string",
          description: "Short action label shown on the button, e.g. 'View El Congo in library' or 'Open RVTC on the map'",
        },
        reason: {
          type: "string",
          description: "One short sentence explaining why this is useful right now",
        },
        id: {
          type: "string",
          description: "For coffee_detail: the coffee's UUID from context. For cafe_detail: the exact place name from the Known Cafés list.",
        },
      },
      required: ["destination", "label"],
    },
  },
];

// ── Tool implementations ─────────────────────────────────────────────────────

async function fetchPage(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    // Shopify collection → products.json
    const shopifyCollection = url.match(/^(https?:\/\/[^/]+)\/collections\/([^/?#]+)/);
    if (shopifyCollection) {
      const [, base, handle] = shopifyCollection;
      const jsonUrl = `${base}/collections/${handle}/products.json?limit=250`;
      try {
        const res = await fetch(jsonUrl, {
          headers: { "User-Agent": "Mozilla/5.0 BrewLog-Agent/1.0" },
          signal: controller.signal,
        });
        if (res.ok) {
          const data = (await res.json()) as { products?: Record<string, unknown>[] };
          const products = data.products ?? [];
          const lines = products.map((p) => {
            const title = String(p.title ?? "");
            const vendor = String(p.vendor ?? "");
            const tags = Array.isArray(p.tags) ? (p.tags as string[]).join(", ") : "";
            const bodyHtml =
              typeof p.body_html === "string"
                ? p.body_html
                    .replace(/<[^>]+>/g, " ")
                    .replace(/&nbsp;/g, " ")
                    .replace(/&amp;/g, "&")
                    .replace(/\s+/g, " ")
                    .trim()
                    .slice(0, 400)
                : "";
            const price =
              Array.isArray(p.variants) && p.variants.length > 0
                ? `${(p.variants as Record<string, unknown>[])[0].price}€`
                : "";
            return `### ${vendor} — ${title} ${price}\nTags: ${tags}\n${bodyHtml}`;
          });
          return `Products from ${url} (${products.length} items):\n\n${lines.join("\n\n---\n\n")}`.slice(0, 18000);
        }
      } catch { /* fall through */ }
    }

    // Shopify product page → .json
    const shopifyProduct = url.match(/^(https?:\/\/[^/]+\/products\/[^/?#]+)/);
    if (shopifyProduct) {
      try {
        const jsonUrl = `${shopifyProduct[1]}.json`;
        const res = await fetch(jsonUrl, {
          headers: { "User-Agent": "Mozilla/5.0 BrewLog-Agent/1.0" },
          signal: controller.signal,
        });
        if (res.ok) {
          const data = (await res.json()) as { product?: Record<string, unknown> };
          return JSON.stringify(data.product ?? {}, null, 2).slice(0, 10000);
        }
      } catch { /* fall through */ }
    }

    // General HTML
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 BrewLog-Agent/1.0" },
      signal: controller.signal,
    });
    if (!res.ok) return `HTTP ${res.status} fetching ${url}`;
    const html = await res.text();
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 15000) || "(no readable text)";
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchImageAsBase64(
  url: string
): Promise<{ data: string; mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 BrewLog-Agent/1.0" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = await res.arrayBuffer();
    const data = Buffer.from(buffer).toString("base64");
    const ct = res.headers.get("content-type") ?? "image/jpeg";
    const raw = ct.split(";")[0].trim().toLowerCase();
    const mediaType =
      raw === "image/png" ? "image/png"
      : raw === "image/gif" ? "image/gif"
      : raw === "image/webp" ? "image/webp"
      : "image/jpeg";
    return { data, mediaType };
  } finally {
    clearTimeout(timeout);
  }
}

async function searchPlaces(query: string): Promise<{ name: string; city: string; address: string | null }[]> {
  try {
    return await db
      .select({ name: places.name, city: places.city, address: places.address })
      .from(places)
      .where(or(ilike(places.city, `%${query}%`), ilike(places.name, `%${query}%`)))
      .limit(20);
  } catch {
    return [];
  }
}

// ── Context helpers ───────────────────────────────────────────────────────────

// Includes IDs so Claude can reference them in suggest_navigation
function formatLibraryForAgent(library: CompactCoffee[]): string {
  if (library.length === 0) return "";
  return library
    .map((c) => {
      const usage =
        c.avgRating != null
          ? `${c.avgRating.toFixed(1)}★ · ${c.sessionCount} sessions`
          : `${c.sessionCount} sessions`;
      return `- [id:${c.id}] ${c.roaster} — ${c.name} | ${c.origin} ${c.process} | ${usage}`;
    })
    .join("\n");
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  try {
    const body = (await req.json()) as {
      messages: { role: "user" | "assistant"; content: string }[];
      recentSessions?: Session[];
    };

    const messages = (body.messages ?? []).filter(
      (m: { role: string }) => m.role === "user" || m.role === "assistant"
    );
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages required" }, { status: 400 });
    }

    const [userPrefs, library] = await Promise.all([
      loadUserProfile().catch(() => null),
      loadCoffeeLibraryCompact(30).catch(() => []),
    ]);

    const profileBlock = formatProfileForPrompt(userPrefs);
    const recentSessions: Session[] = Array.isArray(body.recentSessions)
      ? body.recentSessions.slice(0, 5)
      : [];

    const contextParts: string[] = [];

    const recipesBlock = buildRecentRecipes(recentSessions, 5);
    if (recipesBlock) {
      contextParts.push(`\n## Your Recent Recipes\n` + recipesBlock);
    }

    const libraryBlock = formatLibraryForAgent(library);
    if (libraryBlock) {
      contextParts.push(
        `\n## Your Coffee Library (use id: values when calling suggest_navigation for coffee_detail)\n` + libraryBlock
      );
    }


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
      contextParts.push(`\n## Roaster Style Priors\n` + priorBlocks.join("\n\n"));
    }

    const dynamicContext = contextParts.join("");

    const systemBlocks: Anthropic.TextBlockParam[] = [
      { type: "text", text: AGENT_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      { type: "text", text: profileBlock, cache_control: { type: "ephemeral" } },
      ...(dynamicContext ? [{ type: "text" as const, text: dynamicContext }] : []),
    ];

    const encoder = new TextEncoder();
    const sse = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        };

        try {
          const agentMessages: Anthropic.MessageParam[] = messages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }));

          const navSuggestions: NavAction[] = [];
          const MAX_ITERATIONS = 6;

          for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
            const response = await client.messages.create({
              model: "claude-sonnet-4-6",
              max_tokens: 2000,
              system: systemBlocks,
              tools: TOOLS,
              messages: agentMessages,
            });

            const textBlocks = response.content.filter(
              (b: Anthropic.ContentBlock): b is Anthropic.TextBlock => b.type === "text"
            );

            if (response.stop_reason === "end_turn") {
              const text = textBlocks.map((b: Anthropic.TextBlock) => b.text).join("");
              if (text) send("delta", { text });
              send("done", {
                actions: navSuggestions.length > 0 ? navSuggestions : undefined,
              });
              return;
            }

            if (response.stop_reason === "tool_use") {
              agentMessages.push({ role: "assistant", content: response.content });

              // Surface any thinking/text before tool calls as status
              for (const tb of textBlocks) {
                if (tb.text.trim()) send("status", { message: tb.text.trim() });
              }

              const toolResults: Anthropic.ToolResultBlockParam[] = [];

              for (const block of response.content) {
                if (block.type !== "tool_use") continue;

                if (block.name === "search_places") {
                  const input = block.input as { query: string };
                  send("status", { message: `Searching map for "${input.query}"...` });
                  try {
                    const results = await searchPlaces(input.query);
                    const content =
                      results.length === 0
                        ? `No places found in the BrewLog database matching "${input.query}".`
                        : `Found ${results.length} place(s) matching "${input.query}":\n\n` +
                          results
                            .map((p) => `- ${p.name} | ${p.city}${p.address ? ` | ${p.address}` : ""}`)
                            .join("\n");
                    toolResults.push({ type: "tool_result", tool_use_id: block.id, content });
                  } catch (err) {
                    toolResults.push({
                      type: "tool_result",
                      tool_use_id: block.id,
                      content: `Search error: ${err instanceof Error ? err.message : "failed"}`,
                      is_error: true,
                    });
                  }
                } else if (block.name === "fetch_page") {
                  const input = block.input as { url: string };
                  let hostname = input.url;
                  try { hostname = new URL(input.url).hostname; } catch { /* use raw */ }
                  send("status", { message: `Fetching ${hostname}...` });
                  try {
                    toolResults.push({
                      type: "tool_result",
                      tool_use_id: block.id,
                      content: await fetchPage(input.url),
                    });
                  } catch (err) {
                    toolResults.push({
                      type: "tool_result",
                      tool_use_id: block.id,
                      content: `Error: ${err instanceof Error ? err.message : "fetch failed"}`,
                      is_error: true,
                    });
                  }
                } else if (block.name === "analyze_image") {
                  const input = block.input as { url: string; question: string };
                  send("status", { message: "Analyzing image..." });
                  try {
                    const { data, mediaType } = await fetchImageAsBase64(input.url);
                    toolResults.push({
                      type: "tool_result",
                      tool_use_id: block.id,
                      content: [
                        { type: "image", source: { type: "base64", media_type: mediaType, data } },
                        { type: "text", text: `Analyze: ${input.question}` },
                      ],
                    });
                  } catch (err) {
                    toolResults.push({
                      type: "tool_result",
                      tool_use_id: block.id,
                      content: `Error fetching image: ${err instanceof Error ? err.message : "failed"}`,
                      is_error: true,
                    });
                  }
                } else if (block.name === "suggest_navigation") {
                  const input = block.input as NavAction;
                  navSuggestions.push({
                    destination: input.destination,
                    label: input.label,
                    reason: input.reason,
                    id: input.id,
                  });
                  toolResults.push({
                    type: "tool_result",
                    tool_use_id: block.id,
                    content: "Navigation suggestion noted.",
                  });
                }
              }

              agentMessages.push({ role: "user", content: toolResults });
              continue;
            }

            send("error", { error: `Unexpected stop: ${response.stop_reason}` });
            return;
          }

          send("error", { error: "Agent reached maximum steps." });
        } catch (err) {
          console.error("explore-agent error:", err);
          send("error", { error: "Agent failed" });
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
    console.error("explore-agent/route error:", err);
    return NextResponse.json({ error: "Failed to start agent" }, { status: 500 });
  }
}
