import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { logTokenUsage } from "@/lib/claude/logUsage";

export const dynamic = "force-dynamic";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { draft, recentSessions } = await req.json();

    const coffee = draft?.coffee;
    const result = draft?.result;
    const brew = draft?.brew;
    const rec = draft?.recommendation;

    if (!coffee?.name || result?.rating == null) {
      return NextResponse.json({ insight: null });
    }

    // Build a compact history summary for context
    const historyLines = (recentSessions || [])
      .slice(0, 8)
      .map((s: { coffee?: { name?: string; process?: string }; result?: { rating?: number; flavorNotes?: string[] }; brew?: { methodUsed?: string } }) =>
        `${s.coffee?.name} (${s.coffee?.process || "?"}) → ${s.result?.rating ?? "?"}★ via ${s.brew?.methodUsed || "?"}`
      )
      .join("\n");

    const userName = process.env.USER_DISPLAY_NAME || "the user";
    const prompt = `You are reviewing a brew session for ${userName}, a specialty coffee enthusiast.

This session:
- Coffee: ${coffee.name} by ${coffee.roaster || "?"}
- Origin: ${[coffee.origin, coffee.region].filter(Boolean).join(", ") || "unknown"} | Process: ${coffee.process || "unknown"}
- Method: ${brew?.methodUsed || rec?.primaryMethod || "unknown"}
- Rating: ${result.rating}/5
- Flavor notes: ${result.flavorNotes?.join(", ") || "none"}
- Free notes: ${result.freeNotes || "none"}
${rec ? `- Recipe: ${rec.primaryRecipe?.doseGrams}g / ${rec.primaryRecipe?.waterGrams}g / ${rec.primaryRecipe?.waterTempC}°C` : ""}

Recent history (for pattern context):
${historyLines || "No history yet"}

Write 1–2 sentences (max 35 words) of personal, specific insight about this session.
Ideas: a notable pattern vs history, what the rating suggests, one concrete next-time tweak, or what's interesting about this coffee+method combo.
Be direct. No generic praise. No "great choice". No emojis. Speak like a knowledgeable coffee friend.`;

    const msg = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 120,
      messages: [{ role: "user", content: prompt }],
    });

    void logTokenUsage({ endpoint: "brew-insight", model: "claude-haiku-4-5", usage: msg.usage, userId: "user" });
    const insight = (msg.content[0] as { type: string; text: string })?.text?.trim() || null;
    return NextResponse.json({ insight });
  } catch (err) {
    console.error("brew-insight error:", err);
    return NextResponse.json({ insight: null });
  }
}
