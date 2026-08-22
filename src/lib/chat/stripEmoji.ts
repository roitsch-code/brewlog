/**
 * Emoji stripper for the chat's streamed output.
 *
 * The brand forbids emoji everywhere, including AI replies, and the chat's
 * prompt says so. It reached the user anyway ("Ha, völlig berechtigt! 😄"),
 * which is unsurprising: the chat is the only one of the seven AI surfaces here
 * with no output-side check at all. `loadingInsightLint.ts` has enforced the
 * same rule in code, with a CI test behind it, since the insight agent shipped.
 *
 * This is deliberately narrow, and NARROWER since 2026-08-22 than when it
 * shipped. The first version also matched the Arrows and Dingbats blocks, which
 * ate the arrows out of pour instructions: "Bloom → 60 g" reached the user as
 * "Bloom  60 g", and "= 600g ✓" lost its tick. Caught by the live harness, whose
 * sample replies still had the arrows in them because it reads the model's raw
 * text — the damage only happened downstream, in the stream the user sees.
 *
 * So the rule is now: strip what is unambiguously an emoji, and nothing that
 * could be typography. Every modern emoji lives in the astral planes and
 * therefore arrives as a surrogate PAIR; the variation selector and zero-width
 * joiner glue sequences together. Arrows (→), checkmarks (✓) and mathematical
 * symbols are punctuation in a recipe and carry meaning, so they stay.
 *
 * The trade-off is stated rather than hidden: a legacy BMP emoji such as ☕ now
 * survives. That is a cosmetic brand miss. A recipe missing the arrow between a
 * pour and its target is a damaged instruction, which is worse — over-stripping
 * costs more than under-stripping here.
 *
 * The rest of the voice rules (exclamation marks, interjections, apologies) stay
 * prompt-side for the same reason: a regex for those would mangle real writing —
 * "3:30!" is not an exclamation and "Ah" is a word.
 */

/**
 * A whole astral pair (where every modern emoji lives), or the variation
 * selector / zero-width joiner that glue emoji sequences together.
 *
 * Matching the PAIR rather than the high surrogate alone matters: removing half
 * a pair leaves a lone low surrogate, which renders as a replacement character —
 * visibly worse than the emoji.
 *
 * NOTE the deliberate divergence from `loadingInsightLint.ts`, which also spans
 * the Arrows and Dingbats blocks. That is right for a one-line insight headline
 * and wrong here: this text carries pour instructions, and "→" is how a pour
 * points at its target. No `u` flag — the project's TS target predates it.
 */
const EMOJI_GLOBAL_RE = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uFE0F\u200D]/g;

/** Remove emoji from a complete string. */
export function stripEmoji(text: string): string {
  return text.replace(EMOJI_GLOBAL_RE, "");
}

/**
 * A stripper for a token stream.
 *
 * The one thing a per-chunk `stripEmoji` gets wrong is a surrogate pair split
 * across two deltas: the high half arrives, matches nothing on its own, gets
 * emitted, and the user sees a broken glyph. So a trailing unpaired high
 * surrogate is held back and prepended to the next chunk. Everything else is
 * emitted immediately — the stream stays as responsive as it was.
 *
 * Call `flush()` when the stream ends to drop anything still held (a dangling
 * high surrogate is not printable text in any case).
 */
export function createEmojiStripper(): {
  push: (chunk: string) => string;
  flush: () => string;
} {
  let carry = "";
  return {
    push(chunk: string): string {
      const text = carry + chunk;
      carry = "";
      // A high surrogate in final position has no partner YET — wait for it.
      const last = text.charCodeAt(text.length - 1);
      let body = text;
      if (last >= 0xd800 && last <= 0xdbff) {
        carry = text.slice(-1);
        body = text.slice(0, -1);
      }
      return stripEmoji(body);
    },
    flush(): string {
      carry = "";
      return "";
    },
  };
}
