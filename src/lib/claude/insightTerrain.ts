import type { Session } from "@/lib/types/session";

/**
 * Which terrain the post-brew insight shows (2026-10-03, speed round).
 *
 * The Escher terrain depends on the session corpus and the coffee — NOT on the
 * brew being logged — and /recommend already computed it for this very brew
 * and parked it on the recommendation (`Recommendation.terrain`). Reusing it
 * removes the second Sonnet call from the Summary screen; the builder runs only
 * for a brew whose recommendation carries none (a chat-started brew, a session
 * from before the field existed).
 *
 * Pure apart from the injected `build`, so the short-circuit is testable.
 */
export async function resolveTerrain(
  input: {
    precomputed?: string | null;
    isExternal: boolean;
    sessions: Session[];
    coffee: { name: string; roaster: string; origin: string; process: string };
  },
  build: (
    sessions: Session[],
    coffee: { name: string; roaster: string; origin: string; process: string },
  ) => Promise<string | null>,
): Promise<string | null> {
  if (input.isExternal) return null;
  const pre = input.precomputed?.trim();
  if (pre) return pre;
  if (input.sessions.length < 3) return null;
  try {
    return (await build(input.sessions, input.coffee)) || null;
  } catch {
    return null;
  }
}

/**
 * Deterministic length cap for the post-brew insight card (2026-10-05).
 *
 * The Escher terrain is up to three paragraphs of background written for the
 * /recommend prompt. Once #604 started reusing it on the Summary card, the card
 * grew to a wall of text. The card now always carries the short Haiku line, and
 * this clip is the backstop if the model runs long: at most `max` sentences.
 */
export function clipToSentences(text: string | null | undefined, max = 2): string | null {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  // A boundary is end punctuation followed by whitespace — so "4.5★" and
  // "3:30" never split a sentence.
  const parts = t.split(/(?<=[.!?])\s+/);
  return parts.slice(0, max).join(" ").trim() || null;
}
