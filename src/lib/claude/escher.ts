import Anthropic from "@anthropic-ai/sdk";
import type { Session } from "../types/session";
import type { CoffeeIdentity } from "../types/session";
import { buildSignatures } from "./brewSignature";
import { extract, serialiseForEscher } from "./extractor";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Escher transformer prompt ────────────────────────────────────────────────

const ESCHER_SYSTEM = `You are interpreting structured brewing pattern observations and translating them into teaching prose for the brewer who keeps the log.

Your role: teach this person about their own brewing. Help them understand what they're tasting and why, how to dial in better, what the patterns in their log reveal about their palate and process. When it adds real insight, connect observations to WHY — extraction physics, CO₂ release, mineral buffering, agitation mechanics, process characteristics. Speak in what the brewer tasted, then explain what caused it.

STRICT RULES:
1. NEVER output any number of any kind — no ratings, no degrees, no grams, no ppm values, no percentages, no minutes. Quantities become "repeatedly", "consistently", "a couple of times", "often."
2. NEVER output bullet lists, tables, or markdown. Prose only.
3. NEVER describe a single session event — speak in sustained patterns only.
4. Only claim a pattern exists if the observations explicitly say it has recurrence. If they say "not enough data", say so briefly and move on.
5. If a variable shows no pattern, say so honestly: "X hasn't emerged as a distinguishing factor here."
6. If data is missing (bloom duration, agitation not yet captured), acknowledge it without making it the focus.
7. Voice: direct, observational, teaching — not prescriptive. Prefer "keeps appearing", "tends toward", "the pattern suggests" over "you should" or "always do X."
8. Length: one paragraph per meaningful observation, maximum three paragraphs total. If there's nothing meaningful to say, say so in one sentence.
9. No emojis. No closing remarks. No "I hope this helps."
10. Do NOT tell the brewer what grind setting, temperature, or ppm to use. Describe the direction and pattern only.

OUTPUT FORMAT: Return valid JSON only. No markdown outside the JSON.
{ "terrain": "prose string" }`;

// ─── Main export ──────────────────────────────────────────────────────────────

export async function buildEscherTerrain(
  sessions: Session[],
  currentCoffee?: Pick<CoffeeIdentity, "name" | "roaster" | "origin" | "process">
): Promise<string> {
  const signatures = buildSignatures(sessions);

  const coffeeKey = currentCoffee
    ? [currentCoffee.name, currentCoffee.roaster].filter(Boolean).join(" (") +
      (currentCoffee.roaster ? ")" : "")
    : undefined;

  const typeCluster = currentCoffee
    ? buildTypeCluster(currentCoffee.origin ?? "", currentCoffee.process ?? "", "")
    : undefined;

  const output = extract(signatures, {
    currentCoffeeKey: coffeeKey,
    currentTypeCluster: typeCluster,
    currentCoffeeName: currentCoffee?.name,
  });

  const serialised = serialiseForEscher(output);

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: ESCHER_SYSTEM,
      messages: [{ role: "user", content: serialised }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    const raw = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || "{}") as { terrain?: string };
    return raw.terrain ?? "";
  } catch {
    return "";
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EAST_AFRICA = ["ethiopia", "kenya", "rwanda", "burundi", "tanzania", "uganda", "malawi", "yirgacheffe", "sidama"];
const CENTRAL_AMERICA = ["guatemala", "costa rica", "honduras", "el salvador", "mexico", "nicaragua", "panama"];
const SOUTH_AMERICA = ["colombia", "brazil", "peru", "bolivia", "ecuador"];
const INDONESIA = ["indonesia", "sumatra", "java", "sulawesi", "bali", "flores", "timor"];

function classifyOriginRegion(origin: string): string {
  const o = (origin || "").toLowerCase();
  if (EAST_AFRICA.some(r => o.includes(r))) return "east-africa";
  if (CENTRAL_AMERICA.some(r => o.includes(r))) return "central-america";
  if (SOUTH_AMERICA.some(r => o.includes(r))) return "south-america";
  if (INDONESIA.some(r => o.includes(r))) return "indonesia";
  return "other";
}

function normalizeProcess(process: string): string {
  const p = (process || "").toLowerCase();
  if (p.includes("washed") || p.includes("wet")) return "washed";
  if (p.includes("natural") || p.includes("dry")) return "natural";
  if (p.includes("honey")) return "honey";
  if (p.includes("anaerobic")) return "anaerobic";
  return "other";
}

function buildTypeCluster(origin: string, process: string, method: string): string {
  return `${classifyOriginRegion(origin)}-${normalizeProcess(process)}-${method || "v60"}`;
}
