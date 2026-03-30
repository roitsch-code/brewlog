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

    const prompt = `You are writing a personal taste profile summary for a specialty coffee enthusiast. Based on their actual brew data, return valid JSON with two keys: "summary" and "suggestions".

DATA:
- Total rated brews: ${stats.totalSessions}
- Overall average rating: ${stats.avgRating}★
- Top origins by avg rating: ${stats.topOrigins.map((o: {name:string;avg:number;count:number}) => `${o.name} (${o.avg}★, ${o.count} brews)`).join(", ") || "none yet"}
- Top processes by avg rating: ${stats.topProcesses.map((p: {name:string;avg:number;count:number}) => `${p.name} (${p.avg}★, ${p.count} brews)`).join(", ") || "none yet"}
- Top flavors in best sessions: ${stats.topFlavors.slice(0, 5).map((f: {name:string;count:number}) => f.name).join(", ") || "none yet"}
- Top brew methods: ${stats.topMethods.map((m: {name:string;avg:number;count:number}) => `${m.name} (${m.avg}★)`).join(", ") || "none yet"}
- Body preference: ${JSON.stringify(stats.bodyDist)}
- Acidity preference: ${JSON.stringify(stats.acidityDist)}
- Rating trend (oldest→newest): ${stats.ratingTrend.map((t: {label:string;avg:number}) => `${t.label}: ${t.avg}★`).join(", ") || "not enough data"}

"summary": 3–4 sentences in a direct, personal, insightful tone — like a knowledgeable friend who has studied their log. No fluff, no generic coffee facts. Reference actual numbers. Spot real patterns and name them. No title, no bullet points, no intro phrase like "Based on your data". Just the paragraph text.

"suggestions": an array of 2–3 objects identifying what to explore next. For each suggestion:
- Spot the dominant origin/process pattern in the data
- Identify what has been MISSING or underexplored (origins not tried, processes tried only once, etc.)
- Suggest specific things to seek out next, each with a short explanation and a short tag label
- Each object must have: "type" (either "origin" or "process"), "text" (1–2 sentence explanation referencing the data), "tag" (short label like "Try: Brazil" or "Explore: Honey")

Return ONLY valid JSON in this exact structure, no other text:
{ "summary": "...", "suggestions": [{ "type": "origin", "text": "...", "tag": "..." }] }`;

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : null;
    // Strip markdown code fences if present
    const cleaned = text?.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim() ?? null;
    try {
      const parsed = JSON.parse(cleaned?.match(/\{[\s\S]*\}/)?.[0] || cleaned || "{}");
      return NextResponse.json({ summary: parsed.summary ?? null, suggestions: parsed.suggestions ?? [] });
    } catch {
      return NextResponse.json({ summary: null, suggestions: [] });
    }
  } catch (err) {
    console.error("taste-summary error:", err);
    return NextResponse.json({ summary: null, suggestions: [] });
  }
}
