import { SCA_FOUNDATIONS } from "./data";
import type { ScaTopic } from "./types";

/** Fetch a single topic by id. */
export function getScaTopicById(id: string): ScaTopic | undefined {
  return SCA_FOUNDATIONS.find((t) => t.id === id);
}

/** All SCA topics — exposed for callers that need the full corpus
 * (e.g. an "everything BTTS knows" debug view). */
export function getAllScaTopics(): ScaTopic[] {
  return SCA_FOUNDATIONS;
}

/**
 * Format the entire SCA foundations corpus as a compact prompt block
 * — used by the lesson distiller (always-injected per user direction
 * — see CLAUDE.md "Lessons" section and the partnership decision to
 * treat SCA fundamentals as foundational context every distill turn).
 *
 * Output shape per topic:
 *
 *   [SCA] <title>
 *     <body>
 *     - <label>: <value>
 *     - …
 *
 * Verified topics are not visually tagged in the prompt — the lesson
 * distiller is told "this is the SCA standard" in the system prompt,
 * and the few unverified instructor-pedagogy topics are still useful
 * coaching language. If we ever surface this block in user-visible UI
 * we can re-introduce the [SCA / AST] split.
 */
export function formatScaFoundationsForPrompt(): string {
  const blocks = SCA_FOUNDATIONS.map((t) => {
    const factLines = t.facts.length
      ? "\n" + t.facts.map((f) => `    - ${f.label}: ${f.value}`).join("\n")
      : "";
    return `[SCA] ${t.title}\n  ${t.body}${factLines}`;
  });
  return (
    "SCA BREWING FOUNDATIONS (canonical ground truth — quote these numbers and frames when relevant, never contradict them):\n\n" +
    blocks.join("\n\n")
  );
}
