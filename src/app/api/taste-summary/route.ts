import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const stats = await req.json();

    if (!stats || stats.totalSessions < 3) {
      return NextResponse.json({ summary: null });
    }

    const prompt = `You are analysing a specialty coffee brew log. Respond with ONLY a raw JSON object — no markdown, no code fences, no explanation before or after. Start your response with { and end with }.

BREW DATA:
- Total rated brews: ${stats.totalSessions}
- Overall average rating: ${stats.avgRating}★
- Top origins: ${stats.topOrigins.map((o: {name:string;avg:number;count:number}) => `${o.name} (${o.avg}★, ${o.count} brews)`).join(", ") || "none yet"}
- Top processes: ${stats.topProcesses.map((p: {name:string;avg:number;count:number}) => `${p.name} (${p.avg}★, ${p.count} brews)`).join(", ") || "none yet"}
- Top flavors: ${stats.topFlavors.slice(0, 5).map((f: {name:string;count:number}) => f.name).join(", ") || "none yet"}
- Top methods: ${stats.topMethods.map((m: {name:string;avg:number;count:number}) => `${m.name} (${m.avg}★)`).join(", ") || "none yet"}
- Body: ${JSON.stringify(stats.bodyDist)}
- Acidity: ${JSON.stringify(stats.acidityDist)}
- Rating trend: ${stats.ratingTrend.map((t: {label:string;avg:number}) => `${t.label}: ${t.avg}★`).join(", ") || "not enough data"}

Required JSON structure:
{
  "summary": "3-4 sentence plain text paragraph. Direct and personal tone. Reference actual numbers. No intro phrase like Based on your data. No bullet points. No markdown.",
  "suggestions": [
    { "type": "origin", "text": "1-2 sentence plain text explanation.", "tag": "Try: Ethiopia" }
  ]
}

Rules:
- summary must be plain prose text, nothing else
- suggestions array must have 2-3 items
- type is either origin or process
- tag is a short label like Try: Kenya or Explore: Washed
- NO markdown anywhere in the values
- Start response with { immediately`;

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : null;
    const stripped = text?.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim() ?? null;
    try {
      const jsonStr = stripped?.match(/\{[\s\S]*\}/)?.[0] ?? stripped ?? "{}";
      const parsed = JSON.parse(jsonStr);
      // Safety: if summary itself contains code fences or looks like JSON, discard it
      let summary = parsed.summary ?? null;
      if (typeof summary === "string" && (summary.includes("```") || summary.trimStart().startsWith("{"))) {
        summary = null;
      }
      return NextResponse.json({ summary, suggestions: parsed.suggestions ?? [] });
    } catch {
      return NextResponse.json({ summary: null, suggestions: [] });
    }
  } catch (err) {
    console.error("taste-summary error:", err);
    return NextResponse.json({ summary: null, suggestions: [] });
  }
}
