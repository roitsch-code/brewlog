import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { currentCoffeeData, question, answer } = await req.json();

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `I'm documenting a coffee. Here's what we know so far: ${JSON.stringify(currentCoffeeData)}.

You asked: "${question}"
I answered: "${answer}"

Please update the coffee data with this new information and return the updated JSON object with the same structure. Return only valid JSON.`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    const match = text.match(/\{[\s\S]*\}/);
    const updated = match ? JSON.parse(match[0]) : currentCoffeeData;

    return NextResponse.json({ updated });
  } catch (err) {
    console.error("clarify error:", err);
    return NextResponse.json({ error: "Clarification failed" }, { status: 500 });
  }
}
