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
 * Niche degrees the disc adds on top of the SAME recipe brewed bare: the disc
 * smooths distribution but cuts free flow area, so the bed has to run coarser
 * to finish on the same clock.
 *
 * +5° is the delta both in-repo tables agree on — docs/grind-settings.md
 * ("V60 + Drip Assist ... ~+5° coarser than the standard V60") and the
 * NICHE° GRIND REFERENCE block in recommendPrompt.ts (V60 375–385 vs
 * V60 + Drip Assist 380–390, post-#527 measured baseline). The OFFSET is
 * what's consistent, so the offset is what's enforced here. Direction is
 * owner-confirmed; the exact magnitude is an estimate, which is why this only
 * ever nudges a grind that clearly isn't carrying the disc at all.
 */
export const DRIP_ASSIST_GRIND_OFFSET_DEG = 5;

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
