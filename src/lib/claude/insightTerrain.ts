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
