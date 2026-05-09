import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { currentCoffeeData, question, answer } = await req.json();

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `I'm documenting a coffee. Here's what we know so far:
<coffee_data>${JSON.stringify(currentCoffeeData)}</coffee_data>

You asked: <question>${question}</question>
I answered: <user_answer>${answer}</user_answer>

Update the coffee data with this new information and return the updated JSON object with the same structure. Return only valid JSON.`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : currentCoffeeData;
    const updated = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? Object.fromEntries(
          Object.entries(parsed).filter(([, v]) => v !== null && v !== undefined)
        )
      : parsed;

    return NextResponse.json({ updated });
  } catch (err) {
    console.error("clarify error:", err);
    return NextResponse.json({ error: "Clarification failed" }, { status: 500 });
  }
}
