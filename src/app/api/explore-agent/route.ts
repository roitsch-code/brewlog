import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "@/lib/auth/requireAuth";
import { buildRecentRecipes, recentReferenceNames } from "@/lib/claude/historyUtils";
import { resolveBrewedRecipe, brewedRecipeName } from "@/lib/utils/resolveRecipe";
import { loadUserProfile, formatProfileForPrompt } from "@/lib/claude/userProfile";
import { loadRotationCoffees, loadCoffeeLibraryCompact } from "@/lib/claude/coffeeLibrary";
import { buildTodaysAngles, daySeedFor } from "@/lib/chat/todaysAngles";
import { loadRecentSessions } from "@/lib/claude/sessionCorpus";
import type { CompactCoffee } from "@/lib/claude/coffeeLibrary";
import { getRoasterPrior, formatRoasterPriorForPrompt } from "@/lib/roasters/priors";
import {
  getVarietyPrior,
  formatVarietyPriorForPrompt,
} from "@/lib/knowledge/varieties";
import { TECHNIQUES } from "@/lib/knowledge/techniques";
import { ALL_RECIPES, formatRecipeForPrompt } from "@/lib/knowledge/recipes";
import { db } from "@/lib/db/client";
import { places, insights as insightsTable } from "@/lib/db/schema";
import { and, or, ne, isNull, lte } from "drizzle-orm";
import { assertSafeHttpsUrl } from "@/lib/utils/safeFetch";
import { sanitizePourSteps, pourSequenceFromSteps } from "@/lib/utils/pourSteps";
import { reconcileWaterToPourPlan } from "@/lib/claude/recipeFidelity";
import { validateRecipe, formatProblemsForModel } from "@/lib/recipe/validateRecipe";
import { resolveStartBrewTarget } from "@/lib/chat/chatBrewTarget";
import { createEmojiStripper } from "@/lib/chat/stripEmoji";
import { AGENT_SYSTEM_PROMPT, TOOLS } from "@/lib/chat/agentPrompt";
import {
  cleanChatRecipe,
  formatLibraryForAgent,
  grinderFromConversation,
  recipeLibraryBlock,
} from "@/lib/chat/agentContext";
import type { Session, BrewRecipe } from "@/lib/types/session";
import type { NewCoffeePayload } from "@/lib/types/chatActions";
import { buildNewCoffeePayload, coachNoteFrom } from "@/lib/chat/addCoffee";
import type { AddCoffeeToolInput } from "@/lib/chat/addCoffee";

export const dynamic = "force-dynamic";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });



// ── Types ───────────────────────────────────────────────────────────────────

export interface NavAction {
  destination:
    | "coffee_library"
    | "coffee_detail"
    | "brew_again"
    | "start_brew"
    | "remember_advice"
    | "add_coffee"
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
  // Identity for a bag NOT in the library yet (2026-08-23): a brand-new bag
  // has no id, and the model used to invent one — a plausible slug for a row
  // that doesn't exist, so the pill fetched nothing and the tap went nowhere.
  // With roaster+name the pill brews via chatBrewIdentity and the coffee row
  // is created on the derived slug when the brew is saved.
  roaster?: string;
  name?: string;
  origin?: string;
  process?: string;
  // ── remember_advice payload ─────────────────────────────────────────
  // A durable coach note the chat worked out for a specific bag. The
  // button is tap-to-save: nothing is written until the user taps it,
  // at which point ActionPill POSTs these to /api/insights, which writes
  // an insight row (status='trying') that /recommend reads on the next
  // recipe for a matching coffee. Present only when
  // destination === "remember_advice".
  observation?: string;
  suggestion?: string;
  /** Field names the advice keys off (variety/process/roast/origin/method) — drives /recommend ranking. */
  citationFields?: string[];
  // ── add_coffee payload ──────────────────────────────────────────────
  // A bag the chat read that isn't in the library yet. Tap-to-add: nothing
  // is written until the user taps, at which point ActionPill POSTs this to
  // /api/coffees. When observation + suggestion are also present they are
  // saved as that coffee's coach note by the SAME tap (the new bag has no id
  // until it exists, so remember_advice cannot target it separately).
  // Present only when destination === "add_coffee".
  coffee?: NewCoffeePayload;
}

// ── System prompt ────────────────────────────────────────────────────────────



// suggest_navigation, start_brew, remember_advice and add_coffee are terminal
// "action" tools — collected into the response's actions, not round-tripped.
// The destination comes from the TOOL NAME for those three (their inputs have
// no destination field), and from the input for suggest_navigation.
//
// `attachedImageUrl` is the photo the user attached THIS turn. add_coffee uses
// it as the new bag's photo, so the model never has to echo a URL back (it
// can't be trusted to reproduce one exactly, and a wrong URL would put someone
// else's picture on the coffee).
function toNavAction(toolName: string, input: NavAction, attachedImageUrl?: string | null): NavAction {
  if (toolName === "add_coffee") {
    const a = input as NavAction & AddCoffeeToolInput;
    // Saved as this coffee's coach note by the same tap — but only when the
    // model supplied BOTH halves (see coachNoteFrom).
    const note = coachNoteFrom(a.observation, a.suggestion, a.citationFields);
    return {
      destination: "add_coffee",
      label: input.label,
      reason: input.reason,
      coffee: buildNewCoffeePayload(a, attachedImageUrl),
      observation: note?.observation,
      suggestion: note?.suggestion,
      citationFields: note?.citationFields,
    };
  }
  if (toolName === "start_brew") {
    return {
      destination: "start_brew",
      label: input.label,
      reason: input.reason,
      id: input.id,
      method: input.method,
      title: input.title,
      basedOn: input.basedOn,
      recipe: cleanChatRecipe(input.recipe),
      roaster: input.roaster,
      name: input.name,
      origin: input.origin,
      process: input.process,
    };
  }
  if (toolName === "remember_advice") {
    return {
      destination: "remember_advice",
      label: input.label,
      reason: input.reason,
      id: input.id,
      observation: input.observation,
      suggestion: input.suggestion,
      citationFields: input.citationFields,
    };
  }
  return {
    destination: input.destination,
    label: input.label,
    reason: input.reason,
    id: input.id,
  };
}


const isActionTool = (name: string) =>
  name === "suggest_navigation" ||
  name === "start_brew" ||
  name === "remember_advice" ||
  name === "add_coffee";

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

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  try {
    const body = (await req.json()) as {
      messages: { role: "user" | "assistant"; content: string }[];
      recentSessions?: Session[];
      attachedImageUrl?: string;
      /** The greeting haiku currently shown on the home screen (above this
       * chat). Lets the user say "give me the recipe to the welcome haiku". */
      welcomeHaiku?: string;
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

    const [userPrefs, rotationCoffees, recentLibrary, corpusSessions, coachInsights] = await Promise.all([
      loadUserProfile().catch(() => null),
      // The bags the user has explicitly marked ★ in rotation — the real
      // "what's on the counter right now" set, NOT a recency proxy. Using the
      // actual flag means an older-but-still-open bag (e.g. a coffee roasted
      // weeks ago with many brews) is never dropped just because newer bags
      // were added after it.
      loadRotationCoffees().catch(() => []),
      // ALSO load the recent library so the model has an id for ANY bag the
      // user names — not just rotation ones. start_brew / coffee_detail need an
      // id; without this, asking to brew a bag that isn't starred in rotation
      // left the model unable to link the recipe (it fell back to a generic
      // library link or brew_again). The ★ flag still marks rotation for the
      // "what should I brew?" discipline.
      // 200, not 50: the cap has to clear the whole library or older unstarred
      // bags carry no id and the model falls back to a "view in library" link
      // instead of opening the recipe — the exact regression #413 fixed, which
      // came back silently the moment the library passed 50 bags. One compact
      // line per bag is ~30 tokens, so covering the lot costs ~2k tokens a turn.
      loadCoffeeLibraryCompact(200).catch(() => []),
      // Recent brews, read here rather than trusted from the request body — see
      // loadRecentSessions for why the client's array can't just be enlarged.
      loadRecentSessions(20).catch(() => []),
      // Coach observations over the whole session corpus — the same rows
      // /recommend reads (see src/lib/recommend/run.ts). The chat's own prompt
      // has claimed for months that "recent research insights" are injected
      // each turn; nothing ever was. These are the app's actual cross-session
      // findings, so the chat can build on what the coach already worked out
      // instead of re-deriving it or contradicting it.
      db
        .select()
        .from(insightsTable)
        .where(
          and(
            ne(insightsTable.status, "doesnt-apply"),
            or(
              ne(insightsTable.status, "snoozed"),
              isNull(insightsTable.snoozedUntil),
              lte(insightsTable.snoozedUntil, new Date()),
            ),
          ),
        )
        .limit(5)
        .catch(() => []),
    ]);

    // Merge: rotation first (★, possibly older bags), then recent bags not
    // already included — deduped by id. Every entry is brewable/linkable by id.
    const library = (() => {
      const seen = new Set(rotationCoffees.map((c) => c.id));
      return [...rotationCoffees, ...recentLibrary.filter((c) => !seen.has(c.id))];
    })();
    // The only ids the model can honestly know are the ones this turn's
    // context offers — resolveStartBrewTarget checks a start_brew against
    // exactly this set, so an invented id can never reach a pill.
    const knownCoffeeIds: ReadonlySet<string> = new Set(library.map((c) => c.id));

    const profileBlock = formatProfileForPrompt(userPrefs);
    // Server read wins; the client's array is the fallback for a failed query.
    // The recipes block below still shows only the last 5 in full — the wider
    // window is what the roaster / variety priors and "what have I learned"
    // questions read from, and those were starved at 5.
    const recentSessions: Session[] =
      corpusSessions.length > 0
        ? corpusSessions
        : Array.isArray(body.recentSessions)
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

    // The welcome haiku shown on the home screen, right above this chat. Inject
    // it verbatim so the user can refer to it ("give me the recipe to the
    // welcome haiku", "the bag you mentioned up top", "that idea in the
    // greeting") and you know exactly what they mean.
    const welcomeHaiku =
      typeof body.welcomeHaiku === "string" ? body.welcomeHaiku.trim().slice(0, 600) : "";
    if (welcomeHaiku) {
      contextParts.push(
        `\n## Today's Welcome Greeting (the haiku currently on the home screen, directly above this chat)\n` +
          `"${welcomeHaiku}"\n` +
          `When the user refers to "the welcome haiku" / "the greeting" / "your idea up there" / "the one you mentioned", THIS is what they mean. Read the coffee it names and the idea it floats (e.g. a ★ rotation bag, a tweak like "try it cooler today"), and answer from it. If it points at a library bag and the user wants to brew it, lay out a real recipe and hand it to the timer with start_brew per the rules above.`
      );
    }

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
        `\n## Your Coffee Library — your owned bags, each with its [id:…]\n` +
          `Every bag here is brewable and linkable by its id: pass that id to start_brew (to brew a recipe you wrote), coffee_detail, or remember_advice. ` +
          `★ IN ROTATION = open on the counter right now; use ONLY those for open-ended "what should I brew?". For a bag the user names explicitly, use its id from this list whether or not it's starred.\n` +
          libraryBlock
      );
    }

    // The corpus block above is cached and byte-identical on every turn of
    // every conversation — 135 recipes with no scoring, rotation or cap, since
    // the whole selection machinery is wired to /recommend only. Handed that
    // wall, the model reaches for the same salient entries every day. This is
    // the small piece that MOVES: the same scorer, seeded per day and per bag.
    const anglesBlock = buildTodaysAngles(rotationCoffees, daySeedFor(Date.now()));
    if (anglesBlock) contextParts.push(anglesBlock);

    // What the user has just been served. The chat had no anti-repetition
    // signal of any kind: the recent-brews block exists so it can QUOTE the
    // last recipe accurately ("quote THOSE values"), which if anything
    // increases anchoring on it. This is the counterweight — the same signal
    // /recommend has had all along.
    const recentRefs = recentReferenceNames(corpusSessions);
    if (recentRefs.length > 0) {
      contextParts.push(
        `\n## Recently used references — steer away unless asked to repeat\n` +
          `These reference recipes have already come up in the user's recent brews: ${recentRefs.join(", ")}. ` +
          `Reach for a different one unless this coffee genuinely calls for the same recipe again — and if it does, say why it is still the right answer.`,
      );
    }

    // What the coach has already worked out across the whole corpus. Without
    // it the chat re-derives — or contradicts — findings the app has made and
    // the user has already acted on.
    if (Array.isArray(coachInsights) && coachInsights.length > 0) {
      contextParts.push(
        `\n## Coach insights — cross-session patterns the app has found in your brews\n` +
          `Treat these as established for this user: build on them, don't re-derive them, and never contradict one without saying why.\n` +
          coachInsights
            .map((r) => `- ${r.observation}${r.suggestion ? ` → ${r.suggestion}` : ""}`)
            .join("\n"),
      );
    }

    const recentRoasters = Array.from(
      new Set(
        recentSessions
          .map((s) => s.coffee?.roaster?.trim())
          .filter((r): r is string => !!r && r.length > 0)
      )
      // 8, up from 5: the recent-session window is wider now, and with 29
      // roasters in the corpus a 5-cap dropped priors the model could have used.
    ).slice(0, 8);
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
    ).slice(0, 8);
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

    const dynamicContext = contextParts.join("");

    const systemBlocks: Anthropic.TextBlockParam[] = [
      { type: "text", text: AGENT_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      { type: "text", text: profileBlock, cache_control: { type: "ephemeral" } },
      // The corpus is STATIC — same ~39k tokens on every turn of every
      // conversation. It was riding inside dynamicContext, which changes each
      // turn and so could never be cached; its own block can be.
      { type: "text", text: recipeLibraryBlock(), cache_control: { type: "ephemeral" } },
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

          // One repair round per turn. A model that can't produce a brewable
          // recipe in two attempts won't get there on the third, and each
          // attempt is a full round trip the user waits through.
          let brewRepairSpent = false;

          for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
            const stream = client.messages.stream({
              model: "claude-sonnet-4-6",
              // 2500, up from 2000: the exploration posture asks for one
              // variation line beside a recipe, and an own experiment has to
              // show its running total rather than hide the arithmetic. Both
              // are worth a few hundred tokens; a truncated recipe is not.
              max_tokens: 2500,
              system: systemBlocks,
              tools: TOOLS,
              messages: agentMessages,
            });

            // Stream text tokens as they arrive so simple questions feel fast.
            // We track what was streamed; if stop_reason turns out to be tool_use
            // (Claude spoke before calling a tool), we retract it from the bubble.
            let streamedText = "";
            // The prompt forbids emoji and one still reached the user. Every
            // other AI surface here is checked in code; this one never was.
            const emoji = createEmojiStripper();
            for await (const event of stream) {
              if (
                event.type === "content_block_delta" &&
                event.delta.type === "text_delta"
              ) {
                const text = emoji.push(event.delta.text);
                if (!text) continue;
                streamedText += text;
                send("delta", { text });
              }
            }
            emoji.flush();

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
                // The streamed text was the real response — keep it, UNLESS a
                // start_brew recipe turns out to be unbrewable, in which case
                // the model has to rewrite both the recipe and the message.
                //
                // This is the one place the chat gets the scrutiny /recommend
                // has always had. /recommend corrects a bad recipe in place and
                // the user never sees the draft; here the recipe was already
                // spelled out in prose, so a silent correction would leave the
                // message and the timer disagreeing. Bouncing it back fixes both.
                const okResults: Anthropic.ToolResultBlockParam[] = [];
                const rejections: Anthropic.ToolResultBlockParam[] = [];
                const acceptedActions: NavAction[] = [];
                let droppedBrew: false | "target" | "recipe" = false;

                for (const block of toolBlocks) {
                  const action = toNavAction(block.name, block.input as NavAction, attachedImageUrl);

                  if (block.name === "start_brew") {
                    // Target first, recipe second — a perfect recipe on a pill
                    // that points at nothing is still a dead button. The model
                    // once invented a plausible id for a bag not yet in the
                    // library (ids are derived slugs, so a guess can look
                    // exactly right — the DAK Cassis pill of 2026-08-23), and
                    // the tap fetched a non-existent coffee and discarded the
                    // recipe. knownCoffeeIds is what this turn's context
                    // actually offered; anything else is bounced back through
                    // the same repair round the recipe checks use.
                    const target = resolveStartBrewTarget(action, knownCoffeeIds);
                    if (!target.ok) {
                      console.warn(
                        `[explore-agent] start_brew target rejected (${brewRepairSpent ? "final" : "first"}): ` +
                          `id=${action.id ?? "(none)"} roaster=${action.roaster ? "y" : "n"} name=${action.name ? "y" : "n"}`,
                      );
                      if (!brewRepairSpent) {
                        rejections.push({
                          type: "tool_result",
                          tool_use_id: block.id,
                          content: target.problem,
                          is_error: true,
                        });
                        continue;
                      }
                      droppedBrew = "target";
                      okResults.push({ type: "tool_result", tool_use_id: block.id, content: "Action noted." });
                      continue;
                    }
                    // Keep only an id the tap can actually fetch (or the
                    // library row the names resolve to); a guessed id is
                    // stripped so the pill brews from roaster+name instead of
                    // 404ing first.
                    if (target.id) action.id = target.id;
                    else delete action.id;
                  }

                  if (block.name === "start_brew" && action.recipe) {
                    const problems = validateRecipe(action.recipe, {
                      method: action.method,
                      basedOn: action.basedOn,
                      grinder: grinderFromConversation(messages),
                    });
                    if (problems.length > 0) {
                      console.warn(
                        `[explore-agent] start_brew rejected (${brewRepairSpent ? "final" : "first"}): ` +
                          problems.map((pr) => pr.code).join(", "),
                      );
                      if (!brewRepairSpent) {
                        rejections.push({
                          type: "tool_result",
                          tool_use_id: block.id,
                          content: formatProblemsForModel(problems),
                          is_error: true,
                        });
                        continue;
                      }
                      // Second attempt still not brewable — the pill is dropped
                      // rather than handing the timer a recipe that can't be poured.
                      droppedBrew = "recipe";
                      okResults.push({ type: "tool_result", tool_use_id: block.id, content: "Action noted." });
                      continue;
                    }
                  }

                  acceptedActions.push(action);
                  okResults.push({ type: "tool_result", tool_use_id: block.id, content: "Action noted." });
                }

                if (rejections.length > 0) {
                  brewRepairSpent = true;
                  // The model is about to restate the recipe, so the bubble it
                  // already streamed is stale — pull it before it double-prints.
                  if (streamedText) send("retract", {});
                  navSuggestions.push(...acceptedActions);
                  agentMessages.push({ role: "assistant", content: response.content });
                  agentMessages.push({ role: "user", content: [...okResults, ...rejections] });
                  continue;
                }

                navSuggestions.push(...acceptedActions);
                if (droppedBrew) {
                  send("delta", {
                    text:
                      droppedBrew === "target"
                        ? "\n\nI couldn't pin down which bag that Brew button should start, so I've left it off. Name the bag (or add it to your library) and I'll wire it up."
                        : "\n\nI couldn't get that recipe to hold together, so there's no brew timer for it. Tell me what to change and I'll rework it.",
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
                  navSuggestions.push(toNavAction(block.name, block.input as NavAction, attachedImageUrl));
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
