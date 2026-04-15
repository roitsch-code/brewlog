import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an expert specialty coffee analyst with deep knowledge of coffee producers, origins, processing methods, and roasters worldwide. When given a photo of a coffee bag or label, extract all visible information AND supplement with your knowledge to fill in gaps the bag doesn't explicitly state. Return structured JSON only.`;

const USER_PROMPT = `Analyze this coffee bag photo and return a JSON object. Extract what's visible on the bag, then use your knowledge to supplement missing details (mark these as "researched"). For completely unknown fields, use null.

Return this exact JSON structure:
{
  "extracted": {
    "roaster": string | null,
    "name": string | null,
    "origin": string | null,
    "region": string | null,
    "farm": string | null,
    "variety": string | null,
    "process": "Natural" | "Washed" | "Honey" | "Anaerobic" | "Other" | null,
    "roastLevel": "Light" | "Medium-Light" | "Medium" | "Dark" | null,
    "roastDate": string | null,
    "altitudeMeters": number | null,
    "tastingNotesFromBag": string[]
  },
  "confidence": {
    "roaster": "bag" | "researched" | "unknown",
    "name": "bag" | "researched" | "unknown",
    "origin": "bag" | "researched" | "unknown",
    "region": "bag" | "researched" | "unknown",
    "process": "bag" | "researched" | "unknown",
    "roastLevel": "bag" | "researched" | "unknown"
  },
  "clarifications": string[],
  "isCoffeeBag": boolean
}

clarifications: list up to 2 natural-language questions about the most important remaining unknowns, prioritising in this order: (1) roast date if unknown, (2) variety if unknown, (3) tasting notes if the array is empty, (4) region/process if unclear. Examples:
- "I can see it's from Ethiopia but couldn't read the region — Yirgacheffe, Guji, or Sidama?"
- "No roast date visible — do you remember roughly when you bought it?"
- "I didn't spot a variety — is it listed anywhere on the bag, or do you know it?"
- "No tasting notes were visible — what flavour descriptors does the roaster use?"

Return ONLY valid JSON with no markdown or explanation.`;

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
    farm?: string;
    variety?: string;
    process?: string;
    roastLevel?: string;
    roastDate?: string;
    altitudeMeters?: number;
    tastingNotesFromBag?: string[];
  };
  confidence: Record<string, "bag" | "researched" | "unknown">;
  clarifications: string[];
  isCoffeeBag: boolean;
  roasterPrior?: RoasterPriorSummary; // populated server-side after roaster lookup
}

export async function analyzeBagImage(imageBase64: string, mimeType: string): Promise<{ result: BagAnalysisResult; usage: { input_tokens: number; output_tokens: number } }> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mimeType as "image/jpeg" | "image/png" | "image/webp", data: imageBase64 },
          },
          { type: "text", text: USER_PROMPT },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  try {
    return { result: JSON.parse(text) as BagAnalysisResult, usage: response.usage };
  } catch {
    // Try to extract JSON from text
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return { result: JSON.parse(match[0]) as BagAnalysisResult, usage: response.usage };
    return {
      result: { extracted: {}, confidence: {}, clarifications: [], isCoffeeBag: false },
      usage: response.usage,
    };
  }
}
