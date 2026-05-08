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

## Your Capabilities

You're a chat agent inside BrewLog. When the user asks "what can you do?" or "can I dictate?" etc., answer from this list — don't invent extra abilities.

**Voice in & out** — the user may speak to you (ElevenLabs Scribe transcribes English, German, and other languages) and you can speak back (ElevenLabs TTS). Transcription handles umlauts and diacritics imperfectly, but every search you run ignores diacritics, so the user doesn't have to enunciate carefully.

**Tools you can call:**
- **search_places**: query the café & roastery database (~6,200 places across Europe). Diacritic- and umlaut-insensitive: "Düsseldorf", "Dusseldorf", and "Duesseldorf" all match the same row.
- **fetch_page**: retrieve any webpage. For Shopify roaster shops this auto-resolves to structured product JSON (title, origin, process, price, tasting notes). Call this whenever the user shares a URL or asks about a specific shop.
- **analyze_image**: download an image URL and read it visually — extract origin, varietal, process, roaster name, tasting notes from bag photos.
- **suggest_navigation**: propose navigating to a BrewLog feature. Call this *during your response* whenever the conversation makes one of the in-app features genuinely useful. Be selective — only when it adds clear value, not as a reflex. You can call it multiple times in one turn (e.g. map + coffee detail).

**Personalized context injected each turn (you don't need a tool — it's already below):** the user's recent recipes (dose/water/grind/temp/timing), their coffee library (bags currently in rotation), their equipment & grind settings, roaster style priors for roasters they're brewing, and recent research insights.

Mention capabilities only when relevant — don't pitch them unprompted.

## When to call suggest_navigation

| Situation | Destination |
|-----------|-------------|
| You mention a specific coffee **bag** from the user's library | coffee_detail (use the coffee's id from context) |
| You reference several of their coffee bags, or suggest browsing their bag collection | coffee_library |
| You recommend visiting a specific **café, roastery, or physical place** | cafe_detail — opens the Explore Nearby map |
| General "what's near me" or map exploration | cafe_map — opens the Explore Nearby map |
| You discuss their overall taste evolution, patterns, or palate development | taste_profile |
| You suggest comparing a coffee against past sessions, or ask "how does this compare?" | match |

**Critical distinction:** coffee_library / coffee_detail → the user's bag/purchase collection at /coffees. cafe_map / cafe_detail → physical places to visit at /cafes. Never use coffee_library when the topic is a café or place.

Do NOT call suggest_navigation for trivial mentions. Only when navigation would genuinely help them act on what you just said.

## STRICT RULE: Physical place recommendations

**Never invent, guess, or hallucinate café or roastery names.** Your training data about coffee shops is unreliable — names change, places close, and you will fabricate details with false confidence.

When the user asks for a place to visit (city, neighbourhood, etc.):
1. **Always call search_places first.** Never skip this step.
2. The database stores city names in **English/ASCII**: "Cologne" (not "Köln"), "Munich" (not "München"), "Dusseldorf", "Vienna" (not "Wien"), "Prague" (not "Praha"), "Warsaw" (not "Warszawa"), "Bucharest" (not "București"), "Lisbon" (not "Lisboa"), "Hamburg", "Berlin", etc. Always search using the English/ASCII city name. If the user says "Köln" search "Cologne"; if they say "München" search "Munich". Don't worry about umlauts — the search ignores diacritics.
3. Results include street addresses — use your geographic knowledge to comment on which returned places are nearest to the user's specific neighbourhood or area.
4. Recommend only from the results returned by search_places. The place name must appear in the results verbatim.
5. If search_places returns no results: say so clearly. Tell the user the map doesn't cover that city yet. Do not fall back to training data.

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

## Timing & Grind Calibration

When the user asks how to speed up or slow down a brew, or when you analyse a session that ran long or short, change ONLY the grind:

- **Drawdown too slow / brew ran long** → grind **COARSER** (less surface area, faster flow)
- **Drawdown too fast / brew ran short** → grind **FINER** (more surface area, more resistance)
- **Never** suggest temperature changes to fix flow speed. Temperature controls extraction chemistry only.

This rule is non-negotiable. Saying "go finer to speed up" is a factual error — finer always means slower drawdown.

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
          description: "City name in English/ASCII (e.g. 'Cologne', 'Munich', 'Dusseldorf', 'Prague', 'Vienna'), or a café/roastery name. NOT a neighbourhood — use 'Berlin' not 'Neukölln', 'Hamburg' not 'St. Pauli', 'Paris' not 'Le Marais'.",
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
          description: "Which part of BrewLog to open. IMPORTANT: coffee_library and coffee_detail are for the user's personal collection of coffee BAGS they have purchased — NOT for cafés or physical places. Use cafe_map or cafe_detail for any physical café, roastery, or place to visit.",
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

// Strip diacritics + lowercase + collapse German digraphs so "Düsseldorf",
// "Dusseldorf", "Duesseldorf", and "düsseldorf" all collapse to "dusseldorf".
// Applied to BOTH the user's query and each row before substring matching,
// so search is accent- and umlaut-insensitive without any DB extension.
function fold(s: string): string {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/ue/g, "u").replace(/oe/g, "o").replace(/ae/g, "a");
}

// In-memory cache of all places. Table is small (~6k rows × ~150 bytes ≈ 1MB)
// and the chat hits searchPlaces frequently — caching avoids one DB round-trip
// per call. 5-minute TTL means newly added places appear within 5 min.
type CachedPlace = { name: string; city: string; address: string | null };
let placesCache: CachedPlace[] | null = null;
let placesCacheAt = 0;
const PLACES_CACHE_TTL_MS = 5 * 60_000;

async function getPlacesCached(): Promise<CachedPlace[]> {
  if (placesCache && Date.now() - placesCacheAt < PLACES_CACHE_TTL_MS) {
    return placesCache;
  }
  const rows = await db
    .select({ name: places.name, city: places.city, address: places.address })
    .from(places);
  placesCache = rows;
  placesCacheAt = Date.now();
  return rows;
}

async function searchPlaces(query: string): Promise<CachedPlace[]> {
  try {
    const f = fold(query);
    if (!f) return [];
    const all = await getPlacesCached();
    const matches: CachedPlace[] = [];
    for (const p of all) {
      if (
        fold(p.name).includes(f) ||
        fold(p.city).includes(f) ||
        (p.address ? fold(p.address).includes(f) : false)
      ) {
        matches.push(p);
        if (matches.length >= 30) break;
      }
    }
    return matches;
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
      attachedImageUrl?: string;
    };

    const messages = (body.messages ?? []).filter(
      (m: { role: string }) => m.role === "user" || m.role === "assistant"
    );
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages required" }, { status: 400 });
    }

    // Optional image attached to the most recent user turn (chat photo upload).
    // We fetch+base64 it once here so Claude sees the image natively in the
    // user message — no analyze_image tool round-trip needed.
    const attachedImageUrl =
      typeof body.attachedImageUrl === "string" && body.attachedImageUrl.startsWith("http")
        ? body.attachedImageUrl
        : null;
    let attachedImage: { data: string; mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" } | null = null;
    if (attachedImageUrl) {
      try {
        attachedImage = await fetchImageAsBase64(attachedImageUrl);
      } catch (err) {
        console.error("attached image fetch failed:", err);
        attachedImage = null;
      }
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
          const agentMessages: Anthropic.MessageParam[] = messages.map((m, idx) => {
            // If an image is attached to this turn AND it's the last user
            // message, build a mixed-content turn so Claude sees the image.
            const isLastUser =
              attachedImage !== null &&
              m.role === "user" &&
              idx === messages.length - 1;
            if (isLastUser && attachedImage) {
              return {
                role: "user" as const,
                content: [
                  {
                    type: "image" as const,
                    source: {
                      type: "base64" as const,
                      media_type: attachedImage.mediaType,
                      data: attachedImage.data,
                    },
                  },
                  { type: "text" as const, text: m.content || "What can you tell me about this?" },
                ],
              };
            }
            return {
              role: m.role as "user" | "assistant",
              content: m.content,
            };
          });

          const navSuggestions: NavAction[] = [];
          const MAX_ITERATIONS = 6;

          for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
            const stream = client.messages.stream({
              model: "claude-sonnet-4-6",
              max_tokens: 2000,
              system: systemBlocks,
              tools: TOOLS,
              messages: agentMessages,
            });

            // Stream text tokens as they arrive so simple questions feel fast.
            // We track what was streamed; if stop_reason turns out to be tool_use
            // (Claude spoke before calling a tool), we retract it from the bubble.
            let streamedText = "";
            for await (const event of stream) {
              if (
                event.type === "content_block_delta" &&
                event.delta.type === "text_delta"
              ) {
                streamedText += event.delta.text;
                send("delta", { text: event.delta.text });
              }
            }

            const response = await stream.finalMessage();

            if (response.stop_reason === "end_turn") {
              send("done", {
                actions: navSuggestions.length > 0 ? navSuggestions : undefined,
              });
              return;
            }

            if (response.stop_reason === "tool_use") {
              const toolBlocks = response.content.filter(
                (b: Anthropic.ContentBlock): b is Anthropic.ToolUseBlock => b.type === "tool_use"
              );
              const onlyNavSuggestions = toolBlocks.every((b: Anthropic.ToolUseBlock) => b.name === "suggest_navigation");

              if (onlyNavSuggestions) {
                // The streamed text was the real response — keep it.
                // Just collect the nav suggestions and finish without another Claude round trip.
                for (const block of toolBlocks) {
                  const input = block.input as NavAction;
                  navSuggestions.push({
                    destination: input.destination,
                    label: input.label,
                    reason: input.reason,
                    id: input.id,
                  });
                }
                send("done", {
                  actions: navSuggestions.length > 0 ? navSuggestions : undefined,
                });
                return;
              }

              // Data-fetching tools — retract any transitional text and continue the loop.
              if (streamedText) {
                send("retract", {});
                if (streamedText.trim()) send("status", { message: streamedText.trim() });
              }

              agentMessages.push({ role: "assistant", content: response.content });

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
