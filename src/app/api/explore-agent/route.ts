import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "@/lib/auth/requireAuth";
import { buildRecentRecipes } from "@/lib/claude/historyUtils";
import { loadUserProfile, formatProfileForPrompt } from "@/lib/claude/userProfile";
import { loadCoffeeLibraryCompact, formatLibraryForPrompt } from "@/lib/claude/coffeeLibrary";
import { getRoasterPrior, formatRoasterPriorForPrompt } from "@/lib/roasters/priors";
import type { Session } from "@/lib/types/session";

export const dynamic = "force-dynamic";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const USER_LOCATION = process.env.USER_LOCATION || "Germany";

const AGENT_SYSTEM_PROMPT = `You are a world-class specialty coffee expert and research agent. You are speaking directly with a semi-expert coffee enthusiast based in ${USER_LOCATION}. Address them as "you" throughout.

## Your Research Capabilities

You have access to two tools:
- **fetch_page**: Retrieve the content of any webpage. For Shopify-based roaster stores, this automatically pulls structured product data (names, descriptions, origins, processing methods, tasting notes, prices). Use this whenever the user asks you to browse a URL or research coffees from a specific shop.
- **analyze_image**: Download a coffee bag or product image and examine it visually — extract origin, varietal, processing method, roaster, and any tasting descriptors printed on it.

When the user asks you to research coffees from a URL: fetch it, read the product listing carefully, then apply the user's taste profile (injected below) to select and rank options. Think like a buyer selecting for them.

## Coffee Research Protocol

When browsing a roaster's product listing and recommending coffees:
1. Read the full product listing first
2. For each candidate, note: origin, varietal, process, roast level, tasting notes, price
3. Score against the user's taste profile: light roast preference, affinity for washed/honey/natural processes, floral and fruity notes, avoiding anaerobic/infused/dark
4. Select the requested number of picks with clear reasoning
5. For an "exploration" pick: choose something that gently stretches their palate — a different origin or process they haven't explored, not a flavour bomb they explicitly dislike

## Filter Brewing Expertise

V60 (Hario, Orea V4), AeroPress, Clever Dripper, Kalita Wave, Chemex, Moccamaster, Drip Assist. Deep understanding of percolation vs. immersion brewing dynamics.

Championship recipes: Kasuya 4:6, Peng Jiajun 2025 WBC temp-staging, Wölfl 2024 Orea FAST.

**Expert canon — attribute ideas to these people by name when relevant:**
Science: Jonathan Gagné (extraction physics), Christopher Hendon (water chemistry), Emma Sage (brewing science), Samo Smrke (aroma compounds), Chahan Yeretzian (volatiles).
Brewing: Matt Perger, Scott Rao, Patrik Rolf, Tetsu Kasuya, Lance Hedrick, Matt Winton, Brian Quan, Kyle Rowsell.
Roasting: Scott Rao, Rob Hoos. Origin/Sourcing: Tim Wendelboe, George Howell. Processing: Lucia Solis, Saša Šestić, Jamison Savage.
Sensory: Erin McCarthy, Agnieszka Rojewska. Education: James Hoffmann, Lani Kingston.

**Terroir:** Ethiopia (floral, citrus, bergamot), Kenya (berry, brightness), Colombia (caramel, balance), Rwanda/Burundi (winey, tropical), Guatemala (chocolate, brown sugar).

**Varietals:** Bourbon, Typica, Geisha/Gesha, SL28, SL34, Wush Wush, Pacamara, Catuai, Caturra.

**Processing:** Washed = clarity/terroir; Natural = fruit-forward; Honey = spectrum; Anaerobic/CM = intense, divisive.

## About BrewLog

You are part of BrewLog, a personal brew advisor PWA. When the user's question would be better answered by another feature, name it: Match, Taste profile, Cafés map, coffee library.

## Response Style

- **Brevity first**: for shopping recommendations, use a tight structured format (one block per pick). For conversation, 3–6 sentences max.
- **No markdown headers** (no #, ##). Use **bold** for key terms.
- Be direct. Reference real people, origins, varietals by name.
- Always use Niche DEGREES for grind (never generic terms). Use metric units.
- No emojis. No closing remarks.

## Coffee Recommendation Format

For shopping picks, use this format for each recommendation:

**[Roaster] — [Coffee name]** ([Origin], [Process])
[2–3 sentences: what it is, why it fits (or stretches) the taste profile, what to expect in the cup. Cite the expert or processing science when relevant.]
Niche start: [range]° · Ratio: [g:g] · Temp: [°C]`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "fetch_page",
    description:
      "Fetch the text content of a webpage. For Shopify-based coffee stores, automatically retrieves structured product JSON (titles, descriptions, tasting notes, origins, prices). Always try this before asking the user for more info about a URL they shared.",
    input_schema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The full URL to fetch (must start with http:// or https://)",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "analyze_image",
    description:
      "Download an image from a URL and analyze it visually. Use for coffee bag photos or product images to extract origin, process, varietal, tasting notes, roaster, and other details printed on the packaging.",
    input_schema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Image URL to analyze (must be a direct image URL ending in .jpg, .jpeg, .png, .webp, etc.)",
        },
        question: {
          type: "string",
          description: "What to look for or extract from the image",
        },
      },
      required: ["url", "question"],
    },
  },
];

// ── Tool implementations ────────────────────────────────────────────────────

async function fetchPage(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    // For Shopify collections, try the products JSON endpoint first
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
          return `Products from ${url} (${products.length} items):\n\n${lines.join("\n\n---\n\n")}`.slice(
            0,
            18000
          );
        }
      } catch {
        // Fall through to HTML
      }
    }

    // For Shopify product pages, try the .json suffix
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
      } catch {
        // Fall through to HTML
      }
    }

    // General HTML fetch
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 BrewLog-Agent/1.0" },
      signal: controller.signal,
    });
    if (!res.ok) {
      return `HTTP ${res.status} error fetching ${url}`;
    }
    const html = await res.text();
    const text = html
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
      .slice(0, 15000);
    return text || "(Page returned no readable text)";
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
      raw === "image/png"
        ? "image/png"
        : raw === "image/gif"
        ? "image/gif"
        : raw === "image/webp"
        ? "image/webp"
        : "image/jpeg";
    return { data, mediaType };
  } finally {
    clearTimeout(timeout);
  }
}

// ── Route ───────────────────────────────────────────────────────────────────

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

    const libraryBlock = formatLibraryForPrompt(library);
    if (libraryBlock) {
      contextParts.push(`\n## Your Coffee Library\n` + libraryBlock);
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
            role: m.role,
            content: m.content,
          }));

          const MAX_ITERATIONS = 6;

          for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
            const response = await client.messages.create({
              model: "claude-sonnet-4-6",
              max_tokens: 2000,
              system: systemBlocks,
              tools: TOOLS,
              messages: agentMessages,
            });

            // Any text blocks before a tool call — surface as status
            const textBlocks = response.content.filter(
              (b: Anthropic.ContentBlock): b is Anthropic.TextBlock => b.type === "text"
            );

            if (response.stop_reason === "end_turn") {
              const text = textBlocks.map((b: Anthropic.TextBlock) => b.text).join("");
              if (text) send("delta", { text });
              send("done", {});
              return;
            }

            if (response.stop_reason === "tool_use") {
              agentMessages.push({ role: "assistant", content: response.content });

              // Surface any explanatory text as agent status
              for (const tb of textBlocks) {
                if (tb.text.trim()) send("status", { message: tb.text.trim() });
              }

              const toolResults: Anthropic.ToolResultBlockParam[] = [];

              for (const block of response.content) {
                if (block.type !== "tool_use") continue;

                if (block.name === "fetch_page") {
                  const input = block.input as { url: string };
                  let hostname = input.url;
                  try { hostname = new URL(input.url).hostname; } catch { /* use raw url */ }
                  send("status", { message: `Fetching ${hostname}...` });

                  try {
                    const content = await fetchPage(input.url);
                    toolResults.push({
                      type: "tool_result",
                      tool_use_id: block.id,
                      content,
                    });
                  } catch (err) {
                    toolResults.push({
                      type: "tool_result",
                      tool_use_id: block.id,
                      content: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
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
                        {
                          type: "image",
                          source: { type: "base64", media_type: mediaType, data },
                        },
                        { type: "text", text: `Analyze this image: ${input.question}` },
                      ],
                    });
                  } catch (err) {
                    toolResults.push({
                      type: "tool_result",
                      tool_use_id: block.id,
                      content: `Error fetching image: ${err instanceof Error ? err.message : "Unknown error"}`,
                      is_error: true,
                    });
                  }
                }
              }

              agentMessages.push({ role: "user", content: toolResults });
              continue;
            }

            // Unexpected stop reason (e.g. max_tokens)
            send("error", { error: `Agent stopped: ${response.stop_reason}` });
            return;
          }

          send("error", { error: "Agent reached maximum steps without finishing." });
        } catch (err) {
          console.error("explore-agent stream error:", err);
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
