// Provider abstraction for the /recommend model call.
//
// Background: the AI bill is ~60% Opus, almost all of it /recommend. A 3-round
// spike (scripts/recommend-model-spike.mjs; results in docs/recommend-spike-run*.md
// + issue #453) showed Mistral Large 3 matches Opus on the no-fabrication discipline
// across 24 samples at ~¼ the per-call cost, with one fixable weak spot (vessel
// capacity at large volumes — guarded deterministically in recommend.ts).
//
// This module is the ONLY place that decides which model answers /recommend and
// how each provider is called. The recommend prompt itself (SYSTEM_PROMPT) is
// unchanged — both providers receive byte-identical input.
//
// STATUS (Aug 2026): back on OPUS by default. See selectProvider() for why and
// for what that decision does NOT rest on. Mistral is opt-in now.
//
// Selection + safety:
//   - RECOMMEND_PROVIDER=mistral|anthropic forces a provider, either direction,
//     via env — no code change, no deploy.
//   - With no override the default is Opus. The MISTRAL_API_KEY no longer
//     selects anything on its own; it stays in the environment so flipping back
//     is a single env var rather than a re-key.
//   - A Mistral failure still falls back to Opus for THAT request, so the opt-in
//     path can't take /recommend down either.

import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, RECOMMEND_MODEL } from "../claude/recommendPrompt";

/** Mistral's flagship, EU-hosted on La Plateforme. */
const MISTRAL_MODEL = "mistral-large-latest";
const MAX_TOKENS = 5000;

export type RecommendUsage = { input_tokens: number; output_tokens: number };
export type RecommendResult = { text: string; usage: RecommendUsage; provider: string };

/** Exported for the selection test — mirrors coachProvider's selectCoachProvider. */
export function selectProvider(): "mistral" | "anthropic" {
  const forced = process.env.RECOMMEND_PROVIDER?.toLowerCase().trim();
  if (forced === "mistral" || forced === "anthropic") return forced;
  // Default is OPUS as of Aug 2026 — Mistral is now opt-in, the reverse of the
  // PR #455 arrangement. Owner's call after three prompt instructions leaked in
  // two days on recipes he was actually brewing: the banned brewer (guarded in
  // #458), the Drip Assist grind offset (#517), and the grinder UNIT — a
  // Comandante recipe coming back in Niche degrees (#518). Each is now enforced
  // deterministically, but the pattern is what decided it: recipes are the core
  // of this app, every leak costs a real brew, and the guards can only catch the
  // rules someone already thought to write.
  //
  // Honest scope: the #453 spike that justified Mistral measured FABRICATION
  // (0 drift over 24 samples) — it never measured instruction-following or
  // repetition, so this reverses a decision whose evidence never covered the
  // failures being reversed for. It is a judgement, not a measurement.
  //
  // Repetition is NOT expected to improve: the injected menu ties on a coarse
  // integer score and the tie-break is input-side (PRs #480/#483/#486),
  // i.e. model-independent.
  //
  // Flip back with RECOMMEND_PROVIDER=mistral — no code change, no deploy.
  return "anthropic";
}

let anthropicClient: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 120_000 });
  }
  return anthropicClient;
}

async function callAnthropic(userMessage: string): Promise<{ text: string; usage: RecommendUsage }> {
  const res = await anthropic().messages.create({
    model: RECOMMEND_MODEL,
    max_tokens: MAX_TOKENS,
    // Sampling temperature, stated rather than inherited. The Mistral path
    // below sets 0.5 with a written rationale; the Anthropic path set nothing,
    // so it silently ran at the SDK default (1.0) and the reasoning behind the
    // number was lost in the #519 rollback to Opus.
    //
    // 0.8 is deliberate: below the default, because this call emits recipe
    // NUMBERS and numeric discipline is the thing worth protecting; well above
    // Mistral's 0.5, because Opus follows instructions faithfully enough that
    // low temperature makes it converge on the single most-likely pick — which
    // is the repetition being fixed. The deterministic guards (capacity,
    // volume, fidelity, grind-unit, drip-assist) are the net underneath.
    temperature: 0.8,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userMessage }],
  });
  const text = res.content[0]?.type === "text" ? res.content[0].text : "{}";
  return { text, usage: { input_tokens: res.usage.input_tokens, output_tokens: res.usage.output_tokens } };
}

async function callMistral(userMessage: string): Promise<{ text: string; usage: RecommendUsage }> {
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MISTRAL_MODEL,
      max_tokens: MAX_TOKENS,
      // Moderate sampling temperature: the recommend menu is near-deterministic
      // per coffee, so on top of the rotating recipe menu + the "recently
      // recommended, vary" note this loosens the model off its single most-
      // likely phrasing/pick and widens the portfolio. Kept moderate (0.5) so
      // the no-fabrication discipline holds; the deterministic guards
      // (vessel/volume/drip/fidelity) are the safety net either way.
      temperature: 0.5,
      // System block carries no cache_control (Mistral has its own caching model);
      // JSON mode keeps the structured output the parser expects.
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
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
 * Generate the raw recommendation JSON for `userMessage`. Picks the provider per
 * the rules above and falls back to Opus on a Mistral error. The caller parses +
 * validates the returned text exactly as before (provider-agnostic).
 */
export async function callRecommendModel(userMessage: string): Promise<RecommendResult> {
  if (selectProvider() === "anthropic") {
    return { ...(await callAnthropic(userMessage)), provider: "anthropic" };
  }
  try {
    return { ...(await callMistral(userMessage)), provider: "mistral" };
  } catch (err) {
    console.warn(
      `[recommend] Mistral call failed, falling back to Opus for this request: ${String(
        (err as Error)?.message ?? err,
      ).slice(0, 160)}`,
    );
    return { ...(await callAnthropic(userMessage)), provider: "anthropic-fallback" };
  }
}
