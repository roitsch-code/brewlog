// Provider abstraction for the BTTS Coach Opus calls.
//
// Background: /recommend moved off Opus to Mistral Large in June 2026 (≈¼ the
// per-call cost; issue #453). That left two Opus surfaces — the corpus-wide
// coach (src/lib/claude/insights.ts) and the per-coffee coach card
// (src/lib/claude/coffeeInsight.ts). Both are single-shot, structured-JSON
// generations (no tool-use loop), so they port the same way /recommend did.
// This module is the ONLY place that decides which model answers a coach
// generation and how each provider is called. Both prompts stay byte-identical
// across providers — only the transport + model change.
//
// NOT here on purpose: the chat (explore-agent). It runs on Sonnet (not Opus)
// and is an Anthropic-format tool-use agent loop, a different and riskier
// migration — keep it on Claude.
//
// Cost separation: the coach uses its OWN key (MISTRAL_COACH_API_KEY), minted in
// a separate "BrewLog-Coach" Mistral workspace, so its spend is billed apart
// from /recommend's MISTRAL_API_KEY — Mistral isolates usage + billing per
// workspace, so a distinct workspace (not just a distinct key) is what gives the
// clean split.
//
// Selection + safety (identical discipline to recommendProvider):
//   - COACH_PROVIDER=mistral|anthropic forces a provider (instant rollback to
//     Opus via env, no code change).
//   - With no override, Mistral is used when MISTRAL_COACH_API_KEY is present,
//     else Opus — so deploying this code can NEVER break the coach: until the VPS
//     has the key it stays on Opus, and it flips to Mistral the moment the key is
//     added.
//   - A Mistral failure falls back to Opus for THAT request, so a coach
//     generation never goes down even if Mistral is unreachable.

import Anthropic from "@anthropic-ai/sdk";

/** Mistral's flagship, EU-hosted on La Plateforme. */
const MISTRAL_MODEL = "mistral-large-latest";
/** The Opus model both coach surfaces ran on before this migration. */
const COACH_OPUS_MODEL = "claude-opus-4-7";

export type CoachUsage = { input_tokens: number; output_tokens: number };
export type CoachResult = { text: string; usage: CoachUsage; provider: string };

export interface CoachCall {
  /** System prompt — byte-identical across providers. */
  system: string;
  /** The per-turn user message (the serialised evidence). */
  user: string;
  /** Output budget for this generation. */
  maxTokens: number;
}

export function selectCoachProvider(): "mistral" | "anthropic" {
  const forced = process.env.COACH_PROVIDER?.toLowerCase().trim();
  if (forced === "mistral" || forced === "anthropic") return forced;
  return process.env.MISTRAL_COACH_API_KEY ? "mistral" : "anthropic";
}

let anthropicClient: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 120_000 });
  }
  return anthropicClient;
}

async function callAnthropic({ system, user, maxTokens }: CoachCall): Promise<{ text: string; usage: CoachUsage }> {
  const res = await anthropic().messages.create({
    model: COACH_OPUS_MODEL,
    max_tokens: maxTokens,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
  });
  const text = res.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return { text, usage: { input_tokens: res.usage.input_tokens, output_tokens: res.usage.output_tokens } };
}

async function callMistral({ system, user, maxTokens }: CoachCall): Promise<{ text: string; usage: CoachUsage }> {
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MISTRAL_COACH_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MISTRAL_MODEL,
      max_tokens: maxTokens,
      // JSON mode keeps the structured output the Zod parser expects (both coach
      // prompts already instruct "JSON only"). Mistral runs its own caching, so
      // no cache_control on the system block.
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    throw new Error(`Mistral HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const j = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return {
    text: j.choices?.[0]?.message?.content ?? "{}",
    usage: {
      input_tokens: j.usage?.prompt_tokens ?? 0,
      output_tokens: j.usage?.completion_tokens ?? 0,
    },
  };
}

/**
 * Run a coach generation for `call`. Picks the provider per the rules above and
 * falls back to Opus on a Mistral error. The caller parses + validates the
 * returned `text` with its own Zod schema exactly as before (provider-agnostic).
 */
export async function callCoachModel(call: CoachCall): Promise<CoachResult> {
  if (selectCoachProvider() === "anthropic") {
    return { ...(await callAnthropic(call)), provider: "anthropic" };
  }
  try {
    return { ...(await callMistral(call)), provider: "mistral" };
  } catch (err) {
    console.warn(
      `[coach] Mistral call failed, falling back to Opus for this request: ${String(
        (err as Error)?.message ?? err,
      ).slice(0, 160)}`,
    );
    return { ...(await callAnthropic(call)), provider: "anthropic-fallback" };
  }
}
