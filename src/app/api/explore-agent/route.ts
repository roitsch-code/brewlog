import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "@/lib/auth/requireAuth";
import { buildRecentRecipes } from "@/lib/claude/historyUtils";
import { resolveBrewedRecipe, brewedRecipeName } from "@/lib/utils/resolveRecipe";
import { loadUserProfile, formatProfileForPrompt } from "@/lib/claude/userProfile";
import { loadCoffeeLibraryCompact } from "@/lib/claude/coffeeLibrary";
import type { CompactCoffee } from "@/lib/claude/coffeeLibrary";
import { getRoasterPrior, formatRoasterPriorForPrompt } from "@/lib/roasters/priors";
import {
  getVarietyPrior,
  formatVarietyPriorForPrompt,
} from "@/lib/knowledge/varieties";
import { TECHNIQUES } from "@/lib/knowledge/techniques";
import { ALL_RECIPES, formatRecipeForPrompt } from "@/lib/knowledge/recipes";
import { db } from "@/lib/db/client";
import { places } from "@/lib/db/schema";
import { assertSafeHttpsUrl } from "@/lib/utils/safeFetch";
import type { Session, BrewRecipe } from "@/lib/types/session";

export const dynamic = "force-dynamic";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const USER_LOCATION = process.env.USER_LOCATION || "Germany";

// ── Types ───────────────────────────────────────────────────────────────────

export interface NavAction {
  destination:
    | "coffee_library"
    | "coffee_detail"
    | "brew_again"
    | "start_brew"
    | "cafe_map"
    | "cafe_detail"
    | "taste_profile"
    | "match"
    | "home";
  label: string;
  reason?: string;
  id?: string; // coffee UUID or place name
  // ── start_brew payload ──────────────────────────────────────────────
  // The exact recipe the chat just worked out, carried straight into the
  // brew timer (Step "brew") so it isn't re-generated. Present only when
  // destination === "start_brew".
  method?: string;
  /** Recipe name to show on the brew screen (the chat's own title). */
  title?: string;
  /** Stable reference recipe this adapts ("Japanese Iced V60"), or "Own recipe". */
  basedOn?: string;
  recipe?: BrewRecipe;
}

// ── System prompt ────────────────────────────────────────────────────────────

const AGENT_SYSTEM_PROMPT = `You are a world-class specialty coffee expert and research agent embedded in Better taste than sorry (BTTS), a personal coffee diary PWA. You speak directly to a semi-expert enthusiast based in ${USER_LOCATION}.

The app is always called "Better taste than sorry" or "BTTS" — never any other name. If the user asks what app this is or what you are, you're the coffee assistant inside BTTS.

## Your Capabilities

You're a chat agent inside BTTS. When the user asks "what can you do?" or "can I dictate?" etc., answer from this list — don't invent extra abilities.

**Voice in & out** *(handled by the BTTS app, not by you)* — the user can speak; the app transcribes their voice to text (ElevenLabs Scribe — English, German, others) and hands you the text. Your text reply can be read back to them (ElevenLabs TTS) if they tap speak. You don't directly invoke voice — you only see text and emit text. Transcription handles umlauts and diacritics imperfectly, but every search you run ignores diacritics, so the user doesn't have to enunciate carefully.

**Tools you can call:**
- **search_places**: query the café & roastery database (~6,200 places across Europe). Diacritic- and umlaut-insensitive: "Düsseldorf", "Dusseldorf", and "Duesseldorf" all match the same row.
- **fetch_page**: retrieve any webpage. For Shopify roaster shops this auto-resolves to structured product JSON (title, origin, process, price, tasting notes). Call this whenever the user shares a URL or asks about a specific shop.
- **analyze_image**: download an image URL and read it visually — extract origin, varietal, process, roaster name, tasting notes from bag photos.
- **suggest_navigation**: propose navigating to a BTTS feature. Call this *during your response* whenever the conversation makes one of the in-app features genuinely useful. Be selective — only when it adds clear value, not as a reflex. You can call it multiple times in one turn (e.g. map + coffee detail).
- **start_brew**: drop the user STRAIGHT into the step-by-step brew timer with the exact recipe you just gave — no context questions, no re-recommendation. For when you've just laid out a complete recipe for a specific library bag (often a one-off for the last few grams that isn't worth saving).

**Personalized context injected each turn (you don't need a tool — it's already below):** current local time + weekday, the user's recent recipes (dose/water/grind/temp/timing), the bags **currently in rotation** (last 6 — this is *not* the full library, just what's open and active right now), their equipment & grind settings, roaster style priors for roasters they're brewing, and recent research insights.

When the user asks "what should I brew?" / "what should I drink today?" / similar open-ended brew commands, restrict your candidates to the bags in the Coffee Library block below — that's the active rotation. Don't pull older bags out of memory; if none of the rotation fits, say so plainly.

Mention capabilities only when relevant — don't pitch them unprompted.

## When to call suggest_navigation

| Situation | Destination |
|-----------|-------------|
| You mention a specific coffee **bag** from the user's library | coffee_detail (use the coffee's id from context) |
| The user explicitly wants to **brew a specific bag again** — "brew the Jaime Sanchez again", "make me the cherry one", "I want the DAK Bourbon" | brew_again (use the coffee's id from context) — this lands the user in Step 3 (Context) of the brew flow with the bag already selected |
| You reference several of their coffee bags, or suggest browsing their bag collection | coffee_library |
| You recommend visiting a specific **café, roastery, or physical place** | cafe_detail — opens the Explore Nearby map |
| General "what's near me" or map exploration | cafe_map — opens the Explore Nearby map |
| You discuss their overall taste evolution, patterns, or palate development | taste_profile |
| You suggest comparing a coffee against past sessions, or ask "how does this compare?" | match |

**Critical distinction:** coffee_library / coffee_detail → the user's bag/purchase collection at /coffees. cafe_map / cafe_detail → physical places to visit at /cafes. Never use coffee_library when the topic is a café or place.

Do NOT call suggest_navigation for trivial mentions. Only when navigation would genuinely help them act on what you just said.

## When to call start_brew

When you have just written out a COMPLETE, ready-to-brew recipe for a specific bag in the user's library (you have its id), offer **start_brew** so they can brew it immediately — straight into the timer, without re-entering context (which would re-generate a possibly different recipe). This is the common "I've only got a few grams left, how would you brew it?" case. Do NOT use brew_again for this — brew_again throws your recipe away and re-asks context.

Non-negotiable rules:
- The recipe in the start_brew call MUST be exactly the one in your message — same dose, water (hot water only for iced; put the ice in iceGrams), temperature, grind, total time, and the SAME pour-by-pour sequence. Never round or restate it differently. If they don't match, the user brews different numbers than they just read — a hard failure.
- Express the sequence as pourSteps: cumulative grams on each pour; bloom/pour/final for percolation; put any stir/swirl, flip, press, drain or bypass as its OWN step; set temperatureC per step only when you stage temperature. For iced, the final step drains onto the ice.
- Only call it for a bag you can reference by id. For a generic or hypothetical recipe with no specific library bag, don't.
- It's a terminal action like suggest_navigation — one call, no data round-trip.

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

## Unknown Roaster Protocol (do NOT skip)

When the user asks about a roaster — by name or by URL — that is NOT in the **Roaster Style Priors** block injected below:

1. **Always call fetch_page first** before answering. Either on the URL they shared, or on the roaster's own site (try \`<roaster-slug>.com\` or \`<roaster-slug>.coffee\` first; if the user shared a URL, use it directly).
2. From the fetched page, extract: location/country, roast level, process/origin focus, varieties carried, price range, tasting-note vocabulary, founding year if visible, any awards or competition history.
3. Synthesise a one-paragraph style read on the roaster — same shape as the curated priors below (roast tendency, clarity-vs-sweetness bias, agitation tolerance, recommended temp/ratio range, methodAffinities).
4. **Flag clearly that this is an "inferred" read, not a curated profile** — quote the source URL once, and note that it's based on what's currently visible on their site.

Do NOT hand-wave with reputation talk ("the sourcing choices and note vocabulary are positive signals…") when you haven't actually fetched their page. If \`fetch_page\` fails or returns nothing usable, say so explicitly: "I tried to fetch [URL] and got [error/empty]. Without that I can't give you a real read on them."

## Brewing Goal Vocabulary

When the user names a goal — or asks "how do I bring out X?" — read the term the same way /recommend does. **"Aromatic" is distinct from "high-clarity"**: clarity is overall cup transparency; aromatic is the fragile olfactory top layer specifically (jasmine, bergamot, peach, citrus zest, tea-like delicacy).

- **balanced** — Hoffmann V60 default; no extreme. Open-ended baseline.
- **high-clarity** — tea-like transparency. Washed Ethiopians, Kenyans, Gesha. V60 paper, Orea Apex, Origami Air; minimal agitation, low-mineral water (the user's clarity blend is ~73 ppm).
- **sweetness-forward** — caramel + fruit-sugar emphasis. Naturals, honey-processed, Gesha naturals, Pink Bourbon. Orea Classic / slower-drawdown bottoms, fuller extraction, slightly cooler temps OK.
- **body-forward** — heavier mouthfeel. Naturals, Sumatras, Mundo Novo, dark roasts. Clever, Moccamaster, AeroPress press; slightly finer grind, higher temp.
- **aromatic** — preserve volatile top-notes. Cool bloom (Hsu 2022 staged-temperature), low-mineral water bias, minimal agitation, prompt drawdown. Geisha, Wush Wush, Pink Bourbon (per WCR 2024 — genetically closer to Ethiopian landrace than to Bourbon), Sidra, Ethiopian washed and lighter Ethiopian naturals especially appropriate.
- **explore** — wildcard / educational. Recommend a method the user has NOT yet tried with this coffee, and explain what it's designed to teach. Championship recipes (Peng, Wölfl, Kasuya, AeroPress Bypass) are the obvious source.

## Filter Brewing Expertise

V60 (Hario, Orea V4), AeroPress, Clever Dripper, Kalita Wave, Chemex, Moccamaster. Deep understanding of percolation vs. immersion.

**Orea V4 bottoms (four interchangeable flow plates — slowest → fastest):**
- **Apex** — 8 inward-pointing triangular teeth. Most restricted flow, slowest drawdown of the four. Use for maximum contact time, body, and sweetness development on light-medium roasts. Light stir at bloom ONLY; no post-bloom agitation (clarity focus).
- **Classic** — central plate with a cross of 4 flow slots. Medium flow, the default Orea bottom. Versatile baseline, slightly slower than a V60 size 02. Gentle swirl at bloom and after final pour. Strong pick for sweetness-forward brews.
- **Fast** — 8 short radial bars between inner and outer ring. Faster than V60. The Wölfl 2024 WAC bottom: turbulent, fast-flowing, paradoxically delivers clarity on naturals because total bed-contact time stays short. Light stir at bloom; no post-bloom agitation.
- **Open** — clean donut hole, no plate restriction. Fastest possible flow, essentially open-bottomed dripper behaviour. Use when you want maximum bypass / lightest body, or a forgiving target for very fine grinds where you need flow to compensate. Gentle swirl at bloom only.

Flow ranking head-to-head: **Apex (slowest) → Classic → Fast → Open (fastest)**. Pair the bottom to the brewing goal, not the other way round. All four are part of the user's kit — never tell them to "check the site" or ask which is slowest.

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

## Recipes & Numbers — do NOT improvise the math

**Always verify recipes before presenting them.** This is non-negotiable.

You are bad at arithmetic and you must not rely on it. Do NOT construct a pour-by-pour sequence by adding numbers in your head — that is exactly how you ship a recipe whose pours don't sum to the stated water (e.g. "15g : 250g" then four 50g pours = 200g, not 250g).

Instead:
- **Draw pour sequences from the injected "Reference Recipe Library" below.** Those are documented, pre-verified recipes whose pours already sum correctly. Cite the recipe by name and reproduce its sequence — don't invent your own breakdown.
- **If you state any pour breakdown, the pours MUST sum to the total water.** Before you present it, add them up and check. If they don't add up, do NOT guess to patch it — fall back to the canonical recipe's sequence, or give only the headline numbers (dose : water, ratio, temp, Niche°, total time) with no fabricated pour split.
- When you adapt a recipe (e.g. staged temperature on a Gesha), keep the pour structure of a real corpus recipe and only change what you can change without re-doing arithmetic. Don't free-hand a new milestone list.

Be confident through the documented recipe, not apologetic. Never tell the user "don't trust my maths" as a substitute for getting it right — lean on the verified recipe so the maths is already done.

## Response Style

- **Brevity first.** For shopping picks: one structured block per coffee. For conversation: 3–6 sentences max.
- **No markdown headers** (no #, ##). Use **bold** for key terms.
- Direct, confident. Reference real people, origins, varietals by name.
- **Show your reasoning when you compare or pick.** When the user asks you to choose between things they already have (their bags, past sessions, kit), don't just declare the winner. Briefly name each candidate and what it brings to the criterion — one short sentence each — then the pick and a one-line *why*. "Direct" means every sentence does work, not "skip the reasoning".
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
      "Search the BTTS café and roastery database by city or name. Call this BEFORE recommending any place to visit — never use training data for place names. Returns up to 20 matches.",
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
      "Suggest navigating to a BTTS feature. Call this when navigation would genuinely help the user act on what you just said. Can be called multiple times in one turn.",
    input_schema: {
      type: "object",
      properties: {
        destination: {
          type: "string",
          enum: ["coffee_library", "coffee_detail", "brew_again", "cafe_map", "cafe_detail", "taste_profile", "match", "home"],
          description: "Which part of BTTS to open. IMPORTANT: coffee_library and coffee_detail are for the user's personal collection of coffee BAGS they have purchased — NOT for cafés or physical places. Use cafe_map or cafe_detail for any physical café, roastery, or place to visit. Use brew_again when the user explicitly wants to start a brew flow with a specific bag from their library — drops them into Step 3 (Context) with the bag pre-selected.",
        },
        label: {
          type: "string",
          description: "Short action label shown on the button, e.g. 'View El Congo in library', 'Brew Jaime Sanchez again', or 'Open RVTC on the map'",
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
  {
    name: "start_brew",
    description:
      "Drop the user straight into the step-by-step brew TIMER with the EXACT recipe you just gave them — no context questions, no re-recommendation. Call this ONLY when you have just laid out a complete, ready-to-brew recipe for a SPECIFIC bag from their library (you have its id). Typical case: they have a few grams left and asked how you'd brew it. The recipe you pass here MUST be identical to the one in your message — same dose, water, temperature, grind, total time, and the same pour-by-pour sequence. Do not round or restate differently.",
    input_schema: {
      type: "object",
      properties: {
        label: { type: "string", description: "Button label, e.g. 'Brew Quiquira (Iced)'" },
        id: { type: "string", description: "The coffee's UUID from the library context." },
        method: { type: "string", description: "Brewer, e.g. 'Japanese Iced V60', 'V60', 'AeroPress'." },
        title: { type: "string", description: "Short recipe name shown on the brew screen, e.g. 'Japanese Iced V60 — Quiquira'." },
        basedOn: { type: "string", description: "Reference recipe this adapts (e.g. 'Japanese Iced V60'), or 'Own recipe'." },
        recipe: {
          type: "object",
          description: "The exact recipe — MUST equal what you wrote in your message.",
          properties: {
            doseGrams: { type: "number" },
            waterGrams: { type: "number", description: "For iced: the HOT water only (exclude ice)." },
            iceGrams: { type: "number", description: "Iced brews only — grams of ice the hot brew drains onto." },
            waterTempC: { type: "number" },
            grindSize: { type: "string", description: "Single Niche° value or Comandante clicks, e.g. '380°'." },
            targetTimeSec: { type: "number", description: "Total brew time in seconds." },
            pourSteps: {
              type: "array",
              description: "Ordered steps. Cumulative grams on pours; agitation/flip/press/drain as their own steps; per-step temperature only when staged.",
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  action: { type: "string", description: "bloom | pour | final | stir | swirl | wait | press | invert | flip | drain | bypass | melodrip | agitate-bed" },
                  waterGramsAtEnd: { type: "number" },
                  durationSec: { type: "number" },
                  temperatureC: { type: "number" },
                  notes: { type: "string" },
                },
                required: ["label", "action"],
              },
            },
          },
          required: ["doseGrams", "waterGrams", "waterTempC", "grindSize", "targetTimeSec", "pourSteps"],
        },
      },
      required: ["label", "id", "method", "recipe"],
    },
  },
];

// suggest_navigation and start_brew are terminal "action" tools — collected
// into the response's actions, not round-tripped. The destination comes from
// the TOOL NAME for start_brew (its input has no destination field), and from
// the input for suggest_navigation.
function toNavAction(toolName: string, input: NavAction): NavAction {
  if (toolName === "start_brew") {
    return {
      destination: "start_brew",
      label: input.label,
      reason: input.reason,
      id: input.id,
      method: input.method,
      title: input.title,
      basedOn: input.basedOn,
      recipe: input.recipe,
    };
  }
  return {
    destination: input.destination,
    label: input.label,
    reason: input.reason,
    id: input.id,
  };
}

const isActionTool = (name: string) => name === "suggest_navigation" || name === "start_brew";

// ── Tool implementations ─────────────────────────────────────────────────────

async function fetchPage(url: string): Promise<string> {
  const safe = await assertSafeHttpsUrl(url);
  if (!safe.ok) return safe.error ?? "URL blocked";

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
  const safe = await assertSafeHttpsUrl(url);
  if (!safe.ok) throw new Error(safe.error ?? "URL blocked");

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
// NFD normalize + strip combining marks already collapses "Düsseldorf" →
// "dusseldorf", so the digraph replacements below only fire when the user
// (or a piece of legacy data) types out a digraph manually — e.g.
// "duesseldorf", "koeln", "muenchen". Keep both layers: the NFD handles
// the diacritic form, the digraph rules handle the typed-out form.
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
      // Only the bags in active rotation. Recommendations bias toward
      // what the user is actually brewing right now, not their full
      // historical library. The agent can still answer questions about
      // older bags by name; this just keeps "what should I brew?"
      // grounded in recent stock.
      loadCoffeeLibraryCompact(6).catch(() => []),
    ]);

    const profileBlock = formatProfileForPrompt(userPrefs);
    const recentSessions: Session[] = Array.isArray(body.recentSessions)
      ? body.recentSessions.slice(0, 5)
      : [];

    const contextParts: string[] = [];

    // Current time injected per-turn (not cached) so the agent can
    // interpret "right now", "today", "this morning" reliably.
    const now = new Date();
    const hour = now.getHours();
    const timeOfDay =
      hour < 5 ? "late night"
      : hour < 11 ? "morning"
      : hour < 14 ? "midday"
      : hour < 18 ? "afternoon"
      : hour < 22 ? "evening"
      : "late night";
    const weekday = now.toLocaleDateString("en-US", { weekday: "long" });
    const dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    contextParts.push(
      `\n## Current time\n${weekday} ${dateStr}, ${timeOfDay} (hour ${hour}, local time).`
    );

    const recipesBlock = buildRecentRecipes(recentSessions, 5);
    if (recipesBlock) {
      contextParts.push(`\n## Your Recent Recipes\n` + recipesBlock);
    }

    // Lead the model to the brew the user most likely means by "the recipe I
    // just used" — with its name and a hard rule to quote the SELECTED
    // candidate's numbers (the first Recent-Recipes line), never the primary.
    if (recentSessions[0]) {
      const s0 = recentSessions[0];
      const { candidate, method } = resolveBrewedRecipe(s0);
      const name = brewedRecipeName(candidate);
      const coffee0 =
        s0.coffee?.roaster && s0.coffee?.name
          ? `${s0.coffee.roaster} — ${s0.coffee.name}`
          : s0.coffee?.name || "their coffee";
      contextParts.push(
        `\n## Most Recent Brew (what they just brewed)\n` +
          `${name ? `"${name}" · ` : ""}${method} · ${coffee0}. Its exact numbers are the first line of "Your Recent Recipes" above — quote THOSE values for "the recipe I just used", never a different candidate's.`,
      );
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

    // Variety priors — WCR-grounded genetics for varieties in recent sessions.
    const recentVarieties = Array.from(
      new Set(
        recentSessions.flatMap((s) =>
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
        `\n## Variety Priors (WCR-grounded genetics for varieties in your recent sessions)\n` +
          dedupedVarietyPriors.map(formatVarietyPriorForPrompt).join("\n\n")
      );
    }

    // Available techniques — atomic-move vocabulary, citable by id.
    contextParts.push(
      `\n## Available Brewing Techniques (atomic moves citable by id when teaching mechanism)\n` +
        TECHNIQUES.map(
          (t) => `- ${t.id} (${t.attribution.person}): ${t.description}`
        ).join("\n")
    );

    // Reference recipe corpus — the same 20 championship + reference
    // recipes /api/recommend uses, in full. Injected as-is so the chat
    // can speak with authority about Kasuya 4:6, Wölfl 2024 Orea Fast,
    // Hoffmann Better 1 Cup, etc. — no more "let me check online" when
    // the user asks about a recipe that's already baked into the app.
    contextParts.push(
      `\n## Reference Recipe Library (full corpus — championship + named-expert recipes documented in the app; cite by name when you draw from one)\n\n` +
        ALL_RECIPES.map(formatRecipeForPrompt).join("\n\n")
    );

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
          // 6 was tight for compound research tasks — "compare 4 roasters"
          // already eats 1 search + 4 fetch_page = 5, leaving 1 buffer for
          // a follow-up question that needs another fetch. Bumped to 8.
          const MAX_ITERATIONS = 8;

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
              const onlyActionTools = toolBlocks.every((b: Anthropic.ToolUseBlock) => isActionTool(b.name));

              if (onlyActionTools) {
                // The streamed text was the real response — keep it.
                // Just collect the action(s) and finish without another Claude round trip.
                for (const block of toolBlocks) {
                  navSuggestions.push(toNavAction(block.name, block.input as NavAction));
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
                        ? `No places found in the BTTS database matching "${input.query}".`
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
                } else if (isActionTool(block.name)) {
                  navSuggestions.push(toNavAction(block.name, block.input as NavAction));
                  toolResults.push({
                    type: "tool_result",
                    tool_use_id: block.id,
                    content: "Action noted.",
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
