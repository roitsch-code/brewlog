import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { parseClaudeJson } from "@/lib/claude/parseJson";

/**
 * Coach micro-dialogue. Called by LightStepLog AFTER the user has rated
 * and is about to save, but ONLY when a deterministic ambiguity
 * heuristic fires. The endpoint never decides whether to ask — the
 * client does that locally (see shouldAskCoach in LightStepLog).
 *
 * Sonnet (lightweight, fast). Returns one short question + 3 prefab
 * answer chips. The user picks a chip or types in "Other…", and the
 * answer is stored as tasteResult.coachAnswer on the session — read
 * downstream by /recommend and /api/insights to ground next-step
 * suggestions in the user's own words.
 *
 * Latency budget: ≤ 3s. The user is at the save screen waiting.
 */

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const RequestSchema = z.object({
  // The signals that fired the ambiguity heuristic. The endpoint sees
  // ALL of them and picks the single most useful question to ask.
  signals: z.object({
    ratingDropVsAvg: z.number().optional(),
    timingOverrunPct: z.number().optional(),
    bitterAndLowRating: z.boolean().optional(),
    muddyAndHighRating: z.boolean().optional(),
    firstBrewOfBag: z.boolean().optional(),
    coolingChangedTaste: z.boolean().optional(),
  }),
  // Context the question can reference inline.
  context: z.object({
    coffeeName: z.string().max(200).optional(),
    methodUsed: z.string().max(100).optional(),
    rating: z.number().optional(),
    bitterness: z.string().max(30).optional(),
    clarity: z.string().max(30).optional(),
    finish: z.string().max(30).optional(),
    actualTimeSec: z.number().optional(),
    targetTimeSec: z.number().optional(),
    flavorNotes: z.array(z.string().max(60)).max(20).optional(),
    freeNotes: z.string().max(2000).optional(),
  }),
});

const ResponseSchema = z.object({
  question: z.string().min(5).max(200),
  chips: z.array(z.string().min(1).max(40)).min(2).max(4),
});

const SYSTEM_PROMPT = `You are the BrewLog Coach. The user has just rated a brew that carries a SPECIFIC ambiguity (timing drift, conflicting taste markers, first brew of a bag). Ask ONE short clarifying question that, when answered, will sharpen the next recommendation.

Rules
- One sentence. ≤140 characters. End with a question mark.
- 3 chip-style answer options — each ≤30 chars, mutually distinct, plain English. Add a "not sure" or "didn't notice" as one chip when the user might reasonably not know.
- The question must cite the actual signal: if the timing ran 45s long, say "Drawdown ran 45s long" — don't ask abstract questions.
- No emoji. No labels ("Q:"). No followups.
- Reasonable questions: bed state at end of drawdown, where in the cup the off-note sat (front / mid / finish), whether the dose felt low/high, whether agitation was different than expected.

Output ONLY JSON: { "question": "...", "chips": ["...", "...", "..."] }`;

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { signals, context } = parsed.data;
    const signalLines: string[] = [];
    if (signals.ratingDropVsAvg != null && signals.ratingDropVsAvg <= -1) {
      signalLines.push(`Rating ${context.rating}★ vs recent avg ~${(context.rating! - signals.ratingDropVsAvg).toFixed(1)}★ — a real drop.`);
    }
    if (signals.timingOverrunPct != null && Math.abs(signals.timingOverrunPct) >= 20 && context.actualTimeSec && context.targetTimeSec) {
      const delta = context.actualTimeSec - context.targetTimeSec;
      const sign = delta >= 0 ? "long" : "short";
      signalLines.push(`Brew time ran ${Math.abs(delta)}s ${sign} (target ${context.targetTimeSec}s, actual ${context.actualTimeSec}s).`);
    }
    if (signals.bitterAndLowRating) {
      signalLines.push(`Bitter+low-rating combo: bitterness=${context.bitterness}, rating ${context.rating}★.`);
    }
    if (signals.muddyAndHighRating) {
      signalLines.push(`Muddy clarity but a high rating (${context.rating}★) — usually they don't co-occur.`);
    }
    if (signals.firstBrewOfBag) {
      signalLines.push(`First brew of this bag.`);
    }
    if (signals.coolingChangedTaste) {
      signalLines.push(`Marked "improved while cooling".`);
    }

    const userMessage = [
      `Coffee: ${context.coffeeName ?? "unknown"}`,
      context.methodUsed ? `Method: ${context.methodUsed}` : "",
      `Rating: ${context.rating ?? "?"}★`,
      "",
      "Signals that fired the question:",
      ...signalLines.map((l) => `- ${l}`),
      "",
      context.flavorNotes?.length ? `Flavors logged: ${context.flavorNotes.join(", ")}` : "",
      context.freeNotes ? `Notes: "${context.freeNotes.slice(0, 200)}"` : "",
      "",
      "Write the question now via JSON.",
    ].filter(Boolean).join("\n");

    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const text = msg.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const result = parseClaudeJson(text, ResponseSchema);
    if (!result) {
      return NextResponse.json({ error: "Coach declined to ask" }, { status: 204 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("coach-question error:", err);
    return NextResponse.json({ error: "Failed to generate question" }, { status: 500 });
  }
}
