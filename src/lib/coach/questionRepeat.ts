/**
 * Keeps the post-rating coach from asking the same thing twice.
 *
 * The signals that trigger a question RECUR — "bitter at a low rating" can be
 * true on ten different brews. Without memory the same question comes back
 * every one of those times, and a coach that repeats itself is not a coach, it
 * is a form field the user has to dismiss. The prompt states the rule; this is
 * the deterministic half, because a buried negative instruction is exactly the
 * kind a model leaks past (the Drip-Assist guard exists for the same reason)
 * and the cost of a leak here is precisely the complaint.
 */

/** Punctuation and casing drift between two askings; the question is the same. */
function normaliseQuestion(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when `question` is one the user has already answered, or a near-copy.
 * Containment counts in both directions: a model rephrasing usually keeps the
 * whole of the old question and adds or drops a clause.
 */
export function isRepeatQuestion(question: string, asked: string[]): boolean {
  const q = normaliseQuestion(question);
  if (!q) return false;
  return asked.some((a) => {
    const prev = normaliseQuestion(a);
    if (!prev) return false;
    return prev === q || prev.includes(q) || q.includes(prev);
  });
}
