import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Coerce a numeric value that Haiku may re-emit as a quoted string (e.g.
// "89" instead of 89) back to a number; drop empty/garbage to undefined so
// it doesn't reach the save schema as a bad type. This is the root-cause
// guard for the "coffee: expected number, received string" save failure —
// the clarify round-trip previously returned Haiku's JSON verbatim with no
// type validation at all.
const numeric = z.preprocess((v) => {
  if (v == null || v === "") return undefined;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return v;
}, z.number().optional());

// Only the numeric coffee fields need coercing; everything else passes
// through untouched. Unknown keys are preserved (.passthrough()) so this
// never silently drops a field Haiku added.
const ClarifiedCoffeeSchema = z
  .object({
    cuppingScore: numeric,
  })
  .passthrough();

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

    let updated = parsed;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      // Coerce the numeric fields (Haiku sometimes quotes them) before
      // stripping nulls, so the returned object carries correct types.
      const coerced = ClarifiedCoffeeSchema.safeParse(parsed);
      const base = coerced.success ? coerced.data : parsed;
      updated = Object.fromEntries(
        Object.entries(base).filter(([, v]) => v !== null && v !== undefined)
      );
    }

    return NextResponse.json({ updated });
  } catch (err) {
    console.error("clarify error:", err);
    return NextResponse.json({ error: "Clarification failed" }, { status: 500 });
  }
}
