import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: Request) {
  try {
    const { url } = await req.json() as { url: string };

    if (!url || !url.startsWith("http")) {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
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
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `Extract coffee product details from this webpage text. Return ONLY a valid JSON object with these fields (omit any fields you cannot find with confidence): roaster (string), name (string), origin (string), region (string), variety (string), process (string — Natural/Washed/Honey/Anaerobic), roastLevel (string — Light/Medium-Light/Medium/Dark), roastDate (ISO date string YYYY-MM-DD if found), tastingNotesFromBag (array of short flavor note strings).\n\nWebpage text:\n${text}`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      return NextResponse.json({ error: "AI did not return text" }, { status: 500 });
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Could not extract coffee details from that page. Try entering manually." },
        { status: 422 }
      );
    }

    let extracted: Record<string, unknown> = {};
    try {
      extracted = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json(
        { error: "Could not parse coffee details. Try entering manually." },
        { status: 422 }
      );
    }

    // Return same shape as analyze-bag
    return NextResponse.json({
      extracted,
      clarifications: [],
      roasterPrior: null,
    });
  } catch (err) {
    console.error("[analyze-url]", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
