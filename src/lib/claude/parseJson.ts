import { z, ZodSchema } from "zod";

/**
 * Extract the first JSON object from a Claude text response and validate it
 * against a schema. Handles a few common shapes Claude drifts into:
 *   - raw JSON ("{ ... }")
 *   - JSON wrapped in a ```json fenced block
 *   - JSON with a preamble ("Here's your answer: { ... }")
 *
 * Returns the parsed + validated object, or null if nothing usable is found.
 */
export function parseClaudeJson<T>(text: string, schema: ZodSchema<T>): T | null {
  if (!text) return null;

  const candidates: string[] = [];

  // 1. Fenced ```json block (most robust when Claude ignores "no markdown")
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) candidates.push(fence[1].trim());

  // 2. Greedy outermost {...}
  const greedy = text.match(/\{[\s\S]*\}/);
  if (greedy?.[0]) candidates.push(greedy[0]);

  // 3. Raw trimmed text (in case Claude obeyed and only returned JSON)
  candidates.push(text.trim());

  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c);
      const result = schema.safeParse(parsed);
      if (result.success) return result.data;
    } catch {
      // try next candidate
    }
  }
  return null;
}

/** Re-export z so callers don't need a separate import. */
export { z };
