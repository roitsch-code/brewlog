/**
 * Hero question variants — each flow surface shows one, alternating between
 * visits so the flow doesn't feel canned. BTTS voice: a knowledgeable friend,
 * pragmatic, never coachy; no exclamation marks.
 *
 * `nextHeroQuestion` rotates a per-key index in localStorage (deterministic
 * alternation, wraps around), so consecutive visits to a step show different
 * phrasings in order. Call it from a client effect (it reads localStorage) —
 * see the step components. Falls back to a random pick when storage is
 * unavailable, and to the first variant on the server.
 */

export const SCAN_QUESTIONS = [
  "What are you brewing today?",
  "What's in the cup today?",
  "Which beans are we brewing?",
  "A new bag to dial in?",
] as const;

export const CONTEXT_QUESTIONS = [
  "What's the vibe?",
  "What are you in the mood for?",
  "How should it taste today?",
  "What are you after?",
] as const;

export const LOG_QUESTIONS = [
  "How was it?",
  "What did you taste?",
  "How did it land?",
  "Worth brewing again?",
] as const;

export function nextHeroQuestion(key: string, variants: readonly string[]): string {
  if (variants.length === 0) return "";
  if (variants.length === 1 || typeof window === "undefined") return variants[0];
  try {
    const storeKey = `btts.hero.${key}`;
    const prev = Number.parseInt(window.localStorage.getItem(storeKey) ?? "-1", 10);
    const next = Number.isFinite(prev) ? (prev + 1) % variants.length : 0;
    window.localStorage.setItem(storeKey, String(next));
    return variants[next];
  } catch {
    return variants[Math.floor(Math.random() * variants.length)] ?? variants[0];
  }
}
