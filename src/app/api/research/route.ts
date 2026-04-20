import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getInsights, saveInsights } from "@/lib/knowledge/insights";
import { getHints, saveHints, FALLBACK_HINTS } from "@/lib/knowledge/hints";
import { addNewsItems } from "@/lib/knowledge/news";
import { getQuestions, saveQuestions } from "@/lib/knowledge/questions";
import type { InsightItem } from "@/lib/knowledge/insights";
import type { NewsItemType } from "@/lib/knowledge/news";

export const dynamic = "force-dynamic";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const RESEARCH_SYSTEM = `You are a specialty coffee research assistant for a filter-coffee-focused home brewer.

Focus on:
1. Recent specialty coffee news (last 7 days): filter brewing, processing, origin, green coffee, water science
2. Championship techniques: WBC filter recipes, World Brewers Cup, WAC — cite competitor + year
3. Insights from: Jonathan Gagné, Christopher Hendon, Emma Sage, Samo Smrke, Chahan Yeretzian, Matt Perger, Scott Rao, Patrik Rolf, Tetsu Kasuya, Lance Hedrick, Matt Winton, Tim Wendelboe, George Howell, Lucia Solis, Saša Šestić, James Hoffmann, Erin McCarthy, Denis Basaric, Rob Hoos
4. Coffee science: water chemistry, extraction physics, processing microbiology, aroma compounds
5. Notable new varietals, origins, or producers gaining attention

EXCLUDE: espresso machines, portafilter, tamping, 9-bar pressure, milk steaming, latte art, commercial café equipment.

Always attribute insights to the relevant expert or source.`;

const HINTS_SYSTEM = `You are a specialty coffee expert generating educational coffee hints. Generate 5 unique, interesting coffee facts or tips suitable for display to a semi-expert home brewer during a loading screen.

Each hint should be:
- One to two sentences maximum
- Specific and actionable or genuinely interesting
- About brewing science, origin terroir, processing, equipment, or history
- Different from common generic tips
- Do NOT include espresso machine, portafilter, tamping, pressure profiling, milk steaming, or latte art content.

Return a JSON array of exactly 5 strings. No other text.`;

interface ResearchResult {
  insights: Array<{
    title: string;
    summary: string;
    source: string;
    url?: string;
    tags: string[];
  }>;
  news?: Array<{
    title: string;
    excerpt: string;
    url: string;
    type: NewsItemType;
    source: string;
  }>;
}

async function runResearchWithWebSearch(): Promise<ResearchResult> {
  const queries = [
    "specialty coffee filter brewing technique 2025 site:jameshoffmann.co.uk OR site:baristaHustle.com OR site:worldaeropresschampionship.com",
    "coffee processing fermentation origin 2025 specialty",
    "coffee water chemistry extraction science research 2025",
  ];

  const toolInput = { query: queries[0] };

  // Use web_search tool with haiku for cost efficiency
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await (client.messages.create as any)({
    model: "claude-haiku-4-5",
    max_tokens: 4096,
    system: RESEARCH_SYSTEM,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 5,
      },
    ],
    messages: [
      {
        role: "user",
        content: `Please search for the latest specialty coffee news and insights using multiple searches. Search for:
1. "${queries[0]}"
2. "${queries[1]}"
3. "${queries[2]}"

After searching, compile results. Return a JSON object with this structure:
{
  "insights": [
    {
      "title": "Short descriptive title",
      "summary": "2-3 sentence summary of the insight",
      "source": "Source name (e.g., James Hoffmann, World AeroPress Championship, etc.)",
      "url": "URL if available, otherwise omit",
      "tags": ["brewing", "technique"]
    }
  ],
  "news": [
    {
      "title": "Article or video title",
      "excerpt": "One sentence description",
      "url": "Full URL — must be a real, specific URL",
      "type": "article | video | instagram | podcast | research | social",
      "source": "Publication or creator name"
    }
  ]
}

Include 3–5 insights and 5–8 news items with real URLs (YouTube videos, blog posts, Instagram posts, articles). Only include items where you have a real, verifiable URL.
Return only valid JSON.`,
      },
    ],
  });

  // Extract the final text response
  const textContent = response.content.find(
    (c: { type: string }) => c.type === "text"
  );
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from research agent");
  }

  const jsonMatch = (textContent as { type: "text"; text: string }).text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON in research response");
  }

  return JSON.parse(jsonMatch[0]) as ResearchResult;
}

async function runResearchWithoutWebSearch(): Promise<ResearchResult> {
  // Fallback: use Claude's training knowledge for general insights
  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 2048,
    system: RESEARCH_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Based on your knowledge of specialty coffee up to your training cutoff, generate 3–5 valuable insights about:
1. Recent championship brewing techniques (WBC 2024/2025, WAC, World Brewers Cup)
2. Notable filter brewing method innovations (V60, AeroPress, Clever, Orea)
3. Coffee science: water chemistry, extraction physics, processing microbiology, aroma compounds
4. Expert insights from: Jonathan Gagné, Christopher Hendon, Matt Perger, Scott Rao, Patrik Rolf, Tetsu Kasuya, Tim Wendelboe, Lucia Solis, James Hoffmann, Erin McCarthy

Exclude espresso machine content. Focus only on filter brewing, processing, water chemistry, and origin.

Return a JSON object:
{
  "insights": [
    {
      "title": "Short descriptive title",
      "summary": "2-3 sentence summary",
      "source": "Source name",
      "url": "URL if known, otherwise omit",
      "tags": ["relevant", "tags"]
    }
  ]
}

Return only valid JSON.`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in fallback research response");
  return JSON.parse(jsonMatch[0]) as ResearchResult;
}

async function generateNewQuestions(): Promise<string[]> {
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `Generate 5 diverse, specific starter questions a specialty coffee enthusiast might ask an AI coffee advisor. Cover a mix of: filter brewing technique, origin/terroir, processing, water science, equipment, or championship methods. Keep each under 10 words. Exclude espresso machine questions. Focus on filter brewing, processing, origin, water, and equipment for home filter brewers. Return a JSON array of 5 strings only.`,
        },
      ],
    });
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const qs = JSON.parse(jsonMatch[0]) as string[];
    return Array.isArray(qs) ? qs.filter(q => typeof q === "string") : [];
  } catch (err) {
    console.error("generateNewQuestions error:", err);
    return [];
  }
}

async function generateNewHints(): Promise<string[]> {
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: HINTS_SYSTEM,
      messages: [
        {
          role: "user",
          content:
            "Generate 5 unique specialty coffee hints for a semi-expert home brewer. Focus on brewing science, equipment, origin terroir, processing, or history. Return a JSON array of 5 strings only.",
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const hints = JSON.parse(jsonMatch[0]) as string[];
    return Array.isArray(hints) ? hints.filter(h => typeof h === "string") : [];
  } catch (err) {
    console.error("generateNewHints error:", err);
    return [];
  }
}

async function runResearch(req: NextRequest) {
  // Verify CRON_SECRET
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Try with web_search tool, fall back to training knowledge
    let researchResult: ResearchResult;
    let usedWebSearch = false;

    try {
      researchResult = await runResearchWithWebSearch();
      usedWebSearch = true;
    } catch (webSearchErr) {
      console.warn(
        "web_search not available or failed, using training knowledge:",
        webSearchErr
      );
      researchResult = await runResearchWithoutWebSearch();
    }

    // Save insights to Firestore
    const existing = await getInsights();
    const existingTitles = new Set(existing.map(i => i.title.toLowerCase()));

    const newInsights: InsightItem[] = [];
    for (const item of researchResult.insights) {
      if (!existingTitles.has(item.title.toLowerCase())) {
        newInsights.push({
          ...item,
          id: `insight_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          savedAt: new Date().toISOString(),
        });
      }
    }

    if (newInsights.length > 0) {
      const combined = [...newInsights, ...existing].slice(0, 50); // Keep max 50
      await saveInsights(combined);
    }

    // Generate and merge new hints
    const newHints = await generateNewHints();
    let hintsAdded = 0;

    if (newHints.length > 0) {
      const currentHints = await getHints();
      const hintSet = new Set(currentHints.map(h => h.toLowerCase().trim()));
      const dedupedNew = newHints.filter(
        h => !hintSet.has(h.toLowerCase().trim())
      );
      if (dedupedNew.length > 0) {
        const merged = [...currentHints, ...dedupedNew];
        // Don't let hints list grow unbounded
        const capped =
          merged.length > 200
            ? [...dedupedNew, ...FALLBACK_HINTS].slice(0, 150)
            : merged;
        await saveHints(capped);
        hintsAdded = dedupedNew.length;
      }
    }

    // Generate and merge new starter questions
    const newQuestions = await generateNewQuestions();
    let questionsAdded = 0;

    if (newQuestions.length > 0) {
      const currentQuestions = await getQuestions();
      const qSet = new Set(currentQuestions.map(q => q.toLowerCase().trim()));
      const dedupedQs = newQuestions.filter(q => !qSet.has(q.toLowerCase().trim()));
      if (dedupedQs.length > 0) {
        const merged = [...currentQuestions, ...dedupedQs];
        await saveQuestions(merged.length > 100 ? merged.slice(-100) : merged);
        questionsAdded = dedupedQs.length;
      }
    }

    // Save news items
    let newsAdded = 0;
    if (researchResult.news && researchResult.news.length > 0) {
      newsAdded = await addNewsItems(researchResult.news);
    }

    return NextResponse.json({
      added: newInsights.length,
      hints: hintsAdded,
      questions: questionsAdded,
      news: newsAdded,
      usedWebSearch,
    });
  } catch (err) {
    console.error("research/route error:", err);
    return NextResponse.json(
      { error: "Research agent failed" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) { return runResearch(req); }
export async function POST(req: NextRequest) { return runResearch(req); }
