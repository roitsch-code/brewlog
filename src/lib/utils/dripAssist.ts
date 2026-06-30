// Deterministic Drip-Assist backstop for /recommend.
//
// The Hario Drip Assist disc is the owner's emergency / travel-only brewer
// (used when no gooseneck kettle is around). Per CLAUDE.md it is NEVER
// surfaced as a proactive recommendation — only when the user explicitly locks
// "V60 + Drip Assist" as their method. The /recommend system prompt already
// forbids it, but a soft negative instruction is exactly the kind of thing a
// weaker model honours less reliably than Opus did (the Opus→Mistral swap,
// issue #453). This pure guard enforces the rule deterministically, the same
// way vesselCapacity.ts enforces the vessel-size rule.

/** True when a brewer label is the Hario Drip Assist disc (any spelling). */
export function isDripAssistMethod(method?: string): boolean {
  return !!method && /drip\s*-?\s*assist/i.test(method);
}

/**
 * Drop any candidate that proactively uses Drip Assist when the user did NOT
 * lock it. If that would empty the list (every candidate was Drip Assist —
 * shouldn't happen), relabel them to plain "V60" instead so a recipe still
 * returns, mirroring the prompt's own fallback ("pick a plain V60 instead").
 * No-op when the user explicitly locked Drip Assist as their method.
 */
export function stripProactiveDripAssist<T extends { method?: string }>(
  candidates: T[],
  locked: boolean,
): T[] {
  if (locked) return candidates;
  const clean = candidates.filter((c) => !isDripAssistMethod(c.method));
  if (clean.length) return clean;
  return candidates.map((c) =>
    isDripAssistMethod(c.method) ? { ...c, method: "V60" } : c,
  );
}
