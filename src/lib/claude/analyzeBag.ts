import Anthropic from "@anthropic-ai/sdk";
import { parseClaudeJson, z } from "./parseJson";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BagAnalysisSchema = z.object({
  extracted: z
    .object({
      roaster: z.string().nullable().optional(),
      name: z.string().nullable().optional(),
      origin: z.string().nullable().optional(),
      region: z.string().nullable().optional(),
      variety: z.string().nullable().optional(),
      process: z.string().nullable().optional(),
      fermentationStyle: z.string().nullable().optional(),
      roastLevel: z.string().nullable().optional(),
      roastDate: z.string().nullable().optional(),
      cuppingScore: z.number().nullable().optional(),
      tastingNotesFromBag: z.array(z.string()).optional(),
      // Blend components — present ONLY when the bag is a blend (2+ origins).
      components: z
        .array(
          z.object({
            origin: z.string(),
            region: z.string().nullable().optional(),
            variety: z.string().nullable().optional(),
            process: z.string().nullable().optional(),
            ratio: z.number().nullable().optional(),
          }),
        )
        .optional(),
    })
    .passthrough(),
  confidence: z.record(z.string(), z.string()).optional(),
  clarifications: z.array(z.string()).optional(),
  isCoffeeBag: z.boolean().optional(),
});

const SYSTEM_PROMPT = `You are an expert specialty coffee analyst with deep knowledge of coffee producers, origins, processing methods, and roasters worldwide. When given a photo of a coffee bag or label, extract all visible information AND supplement with your knowledge to fill in gaps the bag doesn't explicitly state. Return structured JSON only.`;

function buildUserPrompt(): string {
  // Today's date is injected so the model can resolve ambiguous roast
  // dates (e.g. "Mar 4" with no year) against reality — every bag the
  // user scans is roasted in the recent past, never the future, and
  // almost always in the current calendar year. Without this anchor,
  // Claude consistently defaulted to the previous year on
  // month-and-day-only stamps.
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const currentYear = today.getUTCFullYear();
  const previousYear = currentYear - 1;

  return `Analyze this coffee bag photo and return a JSON object. Extract what's visible on the bag, then use your knowledge to supplement missing details (mark these as "researched"). For completely unknown fields, use null.

TODAY IS ${todayIso}.

ROAST DATE RULES (non-negotiable):
- If the bag shows a FULL date (month + day + year), use it verbatim.
- If the bag shows ONLY month + day (e.g. "Roasted 03/04", "Roasted Mar 4", "EU 04.03"), assume the CURRENT year (${currentYear}). The only exception: that combination of month + day would put the date in the FUTURE relative to today — only then drop back to ${previousYear}. Specialty coffee is roasted in the recent past, never tomorrow.
- If the bag shows a "best before" or "consume by" date (typically 6–12 months after roast), DO NOT use it as roastDate. Set roastDate to null in that case.
- If no date is visible at all, set roastDate to null.
- Always return ISO format: YYYY-MM-DD. Never DD/MM/YY or MM-DD.

Return this exact JSON structure:
{
  "extracted": {
    "roaster": string | null,
    "name": string | null,
    "origin": string | null,
    "region": string | null,
    "variety": string | null,
    "process": "Natural" | "Washed" | "Honey" | "Anaerobic" | "Other" | null,
    "fermentationStyle": string | null,
    "roastLevel": "Light" | "Medium-Light" | "Medium" | "Dark" | null,
    "roastDate": string | null,
    "cuppingScore": number | null,
    "tastingNotesFromBag": string[],
    "components": [ { "origin": string, "region": string | null, "variety": string | null, "process": "Natural" | "Washed" | "Honey" | "Anaerobic" | "Other" | null, "ratio": number | null } ] | null
  },
  "confidence": {
    "roaster": "bag" | "researched" | "unknown",
    "name": "bag" | "researched" | "unknown",
    "origin": "bag" | "researched" | "unknown",
    "region": "bag" | "researched" | "unknown",
    "process": "bag" | "researched" | "unknown",
    "roastLevel": "bag" | "researched" | "unknown"
  },
  "isCoffeeBag": boolean
}

components: ONLY for a BLEND — a bag that names 2+ origins (e.g. "Brazil + Ethiopia") and/or 2+ processes. Return one entry per origin, each with its own origin, region, variety, process, and ratio (percentage) if the bag prints one. Also fill the top-level "origin" and "process" with a comma-joined summary (e.g. origin "Brazil, Ethiopia", process "Natural, Washed"). For a SINGLE-ORIGIN coffee, set components to null and fill the scalar fields as usual — do NOT invent a blend.
fermentationStyle: for modern/experimental coffees the sub-style is the real differentiator. Examples: "Spontaneous Anaerobic", "Starter-culture Natural (Lalcafé Cima)", "Thermal-shock Washed", "Carbonic Maceration 72h", "Co-fermented with cascara". Only fill this if the bag names a specific sub-style or fermentation protocol — don't guess from the broad process category alone.
cuppingScore: numeric SCA / Q-grade if printed on the bag (e.g. 87.5, 89). Null if not shown.
tastingNotesFromBag: ALWAYS return these in English. If the bag prints the flavour notes in another language, translate each one to its standard English specialty-coffee descriptor — e.g. "Groseille" → "Redcurrant", "Cassis" → "Blackcurrant", "Rhabarbe"/"Rhabarber" → "Rhubarb", "Agrumes" → "Citrus", "Myrtille" → "Blueberry", "Pfirsich" → "Peach", "Honig" → "Honey", "Noisette" → "Hazelnut". Keep each note short; don't invent notes that aren't on the bag.

Extract only — do NOT write any follow-up questions. The app builds its own field-targeted follow-ups from whatever you leave null, so just return your best extraction and set unknown fields to null.

Return ONLY valid JSON with no markdown or explanation.`;
}

export interface RoasterPriorSummary {
  name: string;
  region?: string;
  styleSummary: string;
  roastTendency: string;
  clarityVsSweetnessBias: string;
  tempBias: string;
  ratioBias: string;
  methodAffinities: string[];
  extractionRisks: string[];
  notes: string;
  confidence: "curated" | "inferred" | "fallback" | "user";
}

export interface BagAnalysisResult {
  extracted: {
    roaster?: string;
    name?: string;
    origin?: string;
    region?: string;
    variety?: string;
    process?: string;
    fermentationStyle?: string;
    roastLevel?: string;
    roastDate?: string;
    cuppingScore?: number;
    tastingNotesFromBag?: string[];
    components?: {
      origin: string;
      region?: string;
      variety?: string;
      process?: string;
      ratio?: number;
    }[];
  };
  confidence: Record<string, "bag" | "researched" | "unknown">;
  clarifications: string[];
  isCoffeeBag: boolean;
  roasterPrior?: RoasterPriorSummary; // populated server-side after roaster lookup
  fieldZones?: import("@/lib/field/types").FieldZones | null; // v1.1 Generative Field — server-computed from tastingNotesFromBag; null when notes are empty
}

export async function analyzeBagImage(imageBase64: string, mimeType: string): Promise<{ result: BagAnalysisResult; usage: { input_tokens: number; output_tokens: number } }> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: [
      { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    ],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mimeType as "image/jpeg" | "image/png" | "image/webp", data: imageBase64 },
          },
          { type: "text", text: buildUserPrompt() },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const parsed = parseClaudeJson(text, BagAnalysisSchema);
  if (parsed) {
    // Strip nulls — downstream code + TS expect `string | undefined`, not `string | null`
    const cleanExtracted = Object.fromEntries(
      Object.entries(parsed.extracted).filter(([, v]) => v !== null && v !== undefined)
    );

    // Defensive year guard: even with the prompt instruction, Claude
    // occasionally returns last year's date for an ambiguous "Mar 4"
    // stamp. If the date sits more than 11 months in the past AND
    // bumping the year by one lands within the last 11 months, take
    // the bump — that's the path the prompt was already asking for.
    // Don't touch dates that are within 11 months (legit fresh bag)
    // or further than 23 months back (clearly wasn't extracted from a
    // YY-stamp).
    const rd = (cleanExtracted as { roastDate?: string }).roastDate;
    if (typeof rd === "string" && /^\d{4}-\d{2}-\d{2}/.test(rd)) {
      const cleaned = guardRoastYear(rd);
      if (cleaned !== rd) (cleanExtracted as { roastDate?: string }).roastDate = cleaned;
    }

    // Blend components: drop nested nulls (the schema allows them) → undefined,
    // and drop entries with no origin, so the downstream write schema (which
    // wants string | undefined, not null) accepts them. A blend needs 2+
    // components; anything less collapses back to single-origin.
    const rawComponents = (cleanExtracted as { components?: unknown }).components;
    if (Array.isArray(rawComponents)) {
      const cleaned = rawComponents
        .map((c) => {
          const comp = c as Record<string, unknown>;
          const str = (k: string) =>
            typeof comp[k] === "string" && (comp[k] as string).trim()
              ? (comp[k] as string).trim()
              : undefined;
          const ratio =
            typeof comp.ratio === "number" && Number.isFinite(comp.ratio)
              ? (comp.ratio as number)
              : undefined;
          return {
            origin: str("origin") ?? "",
            region: str("region"),
            variety: str("variety"),
            process: str("process"),
            ratio,
          };
        })
        .filter((c) => c.origin);
      if (cleaned.length >= 2) {
        (cleanExtracted as { components?: unknown }).components = cleaned;
      } else {
        delete (cleanExtracted as { components?: unknown }).components;
      }
    }

    return {
      result: {
        extracted: cleanExtracted as BagAnalysisResult["extracted"],
        confidence: (parsed.confidence ?? {}) as BagAnalysisResult["confidence"],
        clarifications: parsed.clarifications ?? [],
        isCoffeeBag: parsed.isCoffeeBag ?? true,
      },
      usage: response.usage,
    };
  }
  return {
    result: { extracted: {}, confidence: {}, clarifications: [], isCoffeeBag: false },
    usage: response.usage,
  };
}

/**
 * Defensive year adjustment for ambiguous month+day-only roast dates.
 * If the parsed date is >11 months in the past AND shifting it forward
 * by one year lands within the "fresh bag" window (i.e. not in the
 * future), use that. Otherwise return the original.
 */
function guardRoastYear(iso: string): string {
  const parsed = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (isNaN(parsed.getTime())) return iso;
  const now = new Date();
  const elevenMonthsMs = 11 * 30 * 24 * 60 * 60 * 1000;
  const ageMs = now.getTime() - parsed.getTime();
  if (ageMs < elevenMonthsMs) return iso;

  const bumped = new Date(parsed);
  bumped.setUTCFullYear(bumped.getUTCFullYear() + 1);
  // Bumped must not be in the future and must be more reasonable.
  if (bumped.getTime() > now.getTime()) return iso;
  const newAgeMs = now.getTime() - bumped.getTime();
  if (newAgeMs >= elevenMonthsMs) return iso;
  return bumped.toISOString().slice(0, 10);
}
