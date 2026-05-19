import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { eq, sql } from "drizzle-orm";
import { parseClaudeJson, z } from "@/lib/claude/parseJson";
import { assertSafeHttpsUrl } from "@/lib/utils/safeFetch";
import { getRoasterPrior, canonicalRoasterSlug } from "@/lib/roasters/priors";
import { db } from "@/lib/db/client";
import { roasters } from "@/lib/db/schema";
import type { RoasterPrior } from "@/lib/roasters/priors";

export const dynamic = "force-dynamic";

const UrlExtractSchema = z.object({
  extracted: z
    .object({
      roaster: z.string().optional(),
      name: z.string().optional(),
      origin: z.string().optional(),
      region: z.string().optional(),
      farm: z.string().optional(),
      variety: z.string().optional(),
      process: z.string().optional(),
      fermentationStyle: z.string().optional(),
      roastLevel: z.string().optional(),
      roastDate: z.string().optional(),
      altitudeMeters: z.number().optional(),
      cuppingScore: z.number().optional(),
      tastingNotesFromBag: z.array(z.string()).optional(),
    })
    .passthrough(),
  clarifications: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  try {
    const { url } = await req.json() as { url: string };

    if (!url) {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    const safety = await assertSafeHttpsUrl(url);
    if (!safety.ok) {
      return NextResponse.json({ error: safety.error ?? "Invalid URL" }, { status: 400 });
    }

    // Fetch the page
    let html = "";
    try {
      const pageRes = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!pageRes.ok) {
        return NextResponse.json(
          { error: `Could not fetch URL (HTTP ${pageRes.status})` },
          { status: 400 }
        );
      }
      html = await pageRes.text();
    } catch {
      return NextResponse.json(
        { error: "Could not reach that URL. Check the address and try again." },
        { status: 400 }
      );
    }

    // Strip scripts, styles, and HTML tags — keep readable text
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 7000);

    if (text.length < 50) {
      return NextResponse.json(
        { error: "Page has no readable text. Try entering details manually." },
        { status: 400 }
      );
    }

    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 768,
      messages: [
        {
          role: "user",
          content: `Extract coffee product details from this webpage text. Return ONLY a valid JSON object with this exact shape:

{
  "extracted": {
    "roaster": string,
    "name": string,
    "origin": string,
    "region": string,
    "farm": string,
    "variety": string,
    "process": "Natural" | "Washed" | "Honey" | "Anaerobic" | "Other",
    "fermentationStyle": string,
    "roastLevel": "Light" | "Medium-Light" | "Medium" | "Dark",
    "roastDate": "YYYY-MM-DD",
    "altitudeMeters": number,
    "cuppingScore": number,
    "tastingNotesFromBag": string[]
  },
  "clarifications": string[]
}

Inside "extracted": omit any field you cannot find with confidence (do not return null — just omit). fermentationStyle is the specific sub-style or protocol, e.g. "Spontaneous Anaerobic", "Starter-culture Natural", "Thermal-shock Washed", "Carbonic Maceration 72h" — only include when the page names a specific protocol. cuppingScore is the SCA / Q-grade if printed (e.g. 87.5). altitudeMeters is the grow elevation in metres (e.g. 1750).

"clarifications": list up to 2 natural-language questions about the most important remaining unknowns, prioritising in this order: (1) variety if unknown, (2) tasting notes if the array is empty, (3) altitude if unknown, (4) region/farm if unclear. Examples:
- "I couldn't spot a variety on the page — is it listed anywhere, or do you know it?"
- "No tasting notes were visible — what flavour descriptors does the roaster use?"
- "The page doesn't mention altitude — do you know the elevation at \${farm or origin}?"

NEVER ask about roast date (the user enters this via a dedicated date picker in the UI) or cupping score (optional, often unavailable — leave the field omitted if not printed). Return [] if every important field is already known.

Return ONLY valid JSON, no markdown.

Webpage text:
${text}`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      return NextResponse.json({ error: "AI did not return text" }, { status: 500 });
    }

    const parsed = parseClaudeJson(content.text, UrlExtractSchema);
    if (!parsed) {
      return NextResponse.json(
        { error: "Could not extract coffee details from that page. Try entering manually." },
        { status: 422 }
      );
    }

    // Roaster prior lookup — mirror analyze-bag so the URL path benefits
    // from the same DB + built-in priors. Without this every URL scan
    // triggered the "I don't know X yet" Q&A even for well-known roasters
    // like Hoppenworth & Ploch.
    let roasterPrior: ReturnType<typeof toPriorSummary> | null = null;
    if (parsed.extracted.roaster) {
      let prior: RoasterPrior | null = null;
      try {
        const slug = canonicalRoasterSlug(parsed.extracted.roaster);
        const direct = await db.select().from(roasters).where(eq(roasters.slug, slug)).limit(1);
        if (direct.length > 0) {
          prior = direct[0].data as RoasterPrior;
        } else {
          const viaAlias = await db
            .select()
            .from(roasters)
            .where(sql`${roasters.aliases} @> ${JSON.stringify([slug])}::jsonb`)
            .limit(1);
          if (viaAlias.length > 0) prior = viaAlias[0].data as RoasterPrior;
        }
      } catch {}

      if (!prior) {
        const builtIn = getRoasterPrior(parsed.extracted.roaster);
        if (builtIn.confidence !== "fallback") prior = builtIn;
      }

      if (prior) roasterPrior = toPriorSummary(prior);
    }

    return NextResponse.json({
      extracted: parsed.extracted,
      clarifications: parsed.clarifications ?? [],
      roasterPrior,
    });
  } catch (err) {
    console.error("[analyze-url]", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

function toPriorSummary(prior: RoasterPrior) {
  return {
    name: prior.name,
    region: prior.region,
    styleSummary: prior.styleSummary,
    roastTendency: prior.roastTendency,
    clarityVsSweetnessBias: prior.clarityVsSweetnessBias,
    tempBias: prior.tempBias,
    ratioBias: prior.ratioBias,
    methodAffinities: prior.methodAffinities,
    extractionRisks: prior.extractionRisks,
    notes: prior.notes,
    confidence: prior.confidence,
  };
}
