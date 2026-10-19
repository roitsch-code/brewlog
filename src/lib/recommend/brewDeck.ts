/**
 * The per-brew insight deck — what the recipe screen shows WHILE Opus writes
 * the recipe, about THIS brew (2026-10-19, owner: "Immer wieder Neues … die
 * Insights während das Rezept generiert wird sind voll untergegangen").
 *
 * Until now the wait showed 12 random lines from a global pool with no memory
 * and nothing about the coffee on the counter. This builds six short lines
 * from the material the recipe itself is built from — the bag's variety
 * prior, the coffee's own brew memory, the roles and lessons of the brewers
 * leading today's menu, one or two of the techniques those recipes teach —
 * through one Haiku call, and lets a line through only when the deterministic
 * loading-insight gate finds every checkable token of it in its own source
 * (src/lib/insights/loadingInsightLint.ts: no number, name or year the source
 * does not state). Never throws: the recipe never waits for the deck, and an
 * empty deck means the screen shows the pool as before.
 */
import Anthropic from "@anthropic-ai/sdk";
import { getTechniquesForRecipe } from "@/lib/knowledge/techniques";
import { getVarietyPriorsForBag, formatVarietyPriorForPrompt } from "@/lib/knowledge/varieties";
import type { BrewerMenu, MenuEntry } from "@/lib/knowledge/recipes/menu";
import { COFFEE_HINTS } from "@/lib/coffeeHints";
import { lintLoadingInsight, normalizeForDedupe } from "@/lib/insights/loadingInsightLint";
import type { CoffeeIdentity, Session } from "@/lib/types/session";
import { sameCoffee } from "@/lib/brew/previousBrew";

export type DeckAbout = "coffee" | "history" | { brewer: string } | { technique: string };

export interface DeckLine {
  text: string;
  about: DeckAbout;
}

export interface BrewDeckInput {
  coffee: CoffeeIdentity;
  menu: BrewerMenu;
  pastSessions: Session[];
  coffeeHistory?: { writtenSummary?: string; commonNotes?: string[] };
  /** Injected in tests; the real client otherwise. */
  client?: Pick<Anthropic, "messages">;
}

/** How many lines a deck carries at most — a 60-second wait shows about five. */
export const DECK_MAX_LINES = 6;
/** How many of the menu's leading brewers get a line. */
const DECK_BREWERS = 3;
/** How many techniques of those brewers' recipes get a line. */
const DECK_TECHNIQUES = 2;

interface Snippet {
  about: DeckAbout;
  sourceText: string;
}

const DECK_SYSTEM = `You write ONE short line per snippet for a loading screen — a big 40px headline shown to a coffee brewer while his recipe for THIS bag is being written. Each snippet is a fact about this brew: the bag's variety, his own history with this coffee, a brewer on today's menu and what its recipe teaches, or a technique behind it. Pick the single most interesting fact in the snippet and state it crisply.

VOICE (BTTS): a knowledgeable friend talking about coffee. Editorial, pragmatic, plain. No hype, no emoji, no exclamation marks, no "did you know", no second-person command ("try…", "you should…"). State the thing.

LENGTH: at most 80 characters and 15 words — one clause.

GROUNDING — a no-fabrication guarantee depends on this: restate a fact found IN ITS SNIPPET. Add nothing the snippet does not say. No number, name, year or place that is not in the snippet verbatim. If a snippet yields no clean, true, SHORT line, OMIT it.

Return ONLY a JSON array: [{"n": <snippet number>, "text": "<line>"}]. No prose around the JSON.`;

function historySnippet(coffee: CoffeeIdentity, pastSessions: Session[], history?: BrewDeckInput["coffeeHistory"]): Snippet | null {
  const mine = pastSessions.filter((s) => s.mode === "home" && sameCoffee(s, { coffeeId: coffee.coffeeId, roaster: coffee.roaster, name: coffee.name }));
  const parts: string[] = [];
  if (mine.length > 0) {
    const rated = mine.map((s) => s.result?.rating).filter((r): r is number => typeof r === "number");
    const avg = rated.length ? (rated.reduce((a, b) => a + b, 0) / rated.length).toFixed(1) : null;
    const best = mine
      .filter((s) => typeof s.result?.rating === "number")
      .sort((a, b) => (b.result?.rating ?? 0) - (a.result?.rating ?? 0))[0];
    parts.push(`He has brewed ${coffee.name} ${mine.length} time${mine.length === 1 ? "" : "s"} at home${avg ? `, average rating ${avg} of 5` : ""}.`);
    if (best?.brew?.methodUsed && typeof best.result?.rating === "number") {
      parts.push(`His best cup so far was ${best.result.rating} of 5 on the ${best.brew.methodUsed}.`);
    }
  }
  if (history?.writtenSummary) parts.push(history.writtenSummary);
  if (history?.commonNotes?.length) parts.push(`Notes he keeps tasting in it: ${history.commonNotes.slice(0, 5).join(", ")}.`);
  if (parts.length === 0) return null;
  return { about: "history", sourceText: parts.join(" ") };
}

function coffeeSnippet(coffee: CoffeeIdentity): Snippet | null {
  const priors = getVarietyPriorsForBag(coffee.variety);
  const parts: string[] = [];
  const idLine = [coffee.name, coffee.roaster ? `by ${coffee.roaster}` : "", coffee.origin ? `from ${coffee.origin}` : "", coffee.process ? `${coffee.process} process` : "", coffee.variety ? `variety ${coffee.variety}` : ""]
    .filter(Boolean)
    .join(", ");
  if (idLine) parts.push(idLine + ".");
  for (const p of priors.slice(0, 2)) parts.push(formatVarietyPriorForPrompt(p));
  if (parts.length === 0) return null;
  return { about: "coffee", sourceText: parts.join("\n") };
}

function brewerSnippet(e: MenuEntry): Snippet | null {
  const best = e.best?.recipe;
  const parts = [`${e.brewer.method}: ${e.brewer.role}`];
  if (best) {
    parts.push(`Today's recipe on it: ${best.name}${best.attribution?.person ? ` by ${best.attribution.person}` : ""}.`);
    if (best.teaches) parts.push(`What it teaches: ${best.teaches}`);
  }
  return { about: { brewer: e.brewer.method }, sourceText: parts.join(" ") };
}

export function deckSnippets(input: BrewDeckInput): Snippet[] {
  const out: Snippet[] = [];
  const c = coffeeSnippet(input.coffee);
  if (c) out.push(c);
  const h = historySnippet(input.coffee, input.pastSessions, input.coffeeHistory);
  if (h) out.push(h);
  const leads = (input.menu.leads.length ? input.menu.leads : input.menu.entries).filter((e) => e.best).slice(0, DECK_BREWERS);
  for (const e of leads) {
    const s = brewerSnippet(e);
    if (s) out.push(s);
  }
  const seenTech = new Set<string>();
  for (const e of leads) {
    if (!e.best) continue;
    for (const t of getTechniquesForRecipe(e.best.recipe.id)) {
      if (seenTech.size >= DECK_TECHNIQUES || seenTech.has(t.id)) continue;
      seenTech.add(t.id);
      out.push({
        about: { technique: t.name },
        sourceText: `${t.name} — ${t.attribution.person}${t.attribution.year ? ` (${t.attribution.year})` : ""}. ${t.description} Mechanism: ${t.mechanism} When to use: ${t.whenToUse}`,
      });
    }
  }
  return out;
}

function textOf(resp: Anthropic.Messages.Message): string {
  return resp.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

function extractJsonArray(text: string): unknown[] | null {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  try {
    const v: unknown = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

/** The gate: the model's line against its own snippet, and against the static pool. */
export function gateDeckLines(items: unknown[], snippets: Snippet[]): DeckLine[] {
  const existing = new Set(COFFEE_HINTS.map(normalizeForDedupe));
  const out: DeckLine[] = [];
  for (const item of items) {
    if (typeof item !== "object" || item === null) continue;
    const rec = item as { n?: unknown; text?: unknown };
    const n = typeof rec.n === "number" ? rec.n : NaN;
    const text = typeof rec.text === "string" ? rec.text.trim() : "";
    const snippet = snippets[n - 1];
    if (!snippet || text === "") continue;
    const { ok } = lintLoadingInsight(text, { sourceText: snippet.sourceText, existing });
    if (!ok) continue;
    existing.add(normalizeForDedupe(text));
    out.push({ text, about: snippet.about });
    if (out.length >= DECK_MAX_LINES) break;
  }
  return out;
}

/**
 * Six lines about this brew, or fewer, or none — never a throw and never a
 * wait the recipe has to share: the caller runs it beside the Opus call.
 */
export async function generateBrewDeck(input: BrewDeckInput): Promise<DeckLine[]> {
  const snippets = deckSnippets(input);
  if (snippets.length === 0) return [];
  const client = input.client ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const block = snippets.map((s, i) => `[${i + 1}] ${s.sourceText}`).join("\n\n");
  const resp = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 700,
    system: DECK_SYSTEM,
    messages: [{ role: "user", content: `SNIPPETS:\n\n${block}` }],
  });
  const items = extractJsonArray(textOf(resp)) ?? [];
  return gateDeckLines(items, snippets);
}
