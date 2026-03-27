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

clarifications: list up to 2 natural-language questions about remaining unknowns. Examples:
- "I can see it's from Ethiopia but couldn't read the region — Yirgacheffe, Guji, or Sidama?"
- "No roast date visible — do you remember roughly when you bought it?"

Return ONLY valid JSON with no markdown or explanation.`;

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
}

export async function analyzeBagImage(imageBase64: string, mimeType: string): Promise<BagAnalysisResult> {
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
    return JSON.parse(text) as BagAnalysisResult;
  } catch {
    // Try to extract JSON from text
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as BagAnalysisResult;
    return {
      extracted: {},
      confidence: {},
      clarifications: [],
      isCoffeeBag: false,
    };
  }
}
