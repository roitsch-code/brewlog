/**
 * Emoji stripper for the chat's streamed output.
 *
 * The brand forbids emoji everywhere, including AI replies, and the chat's
 * prompt says so. It reached the user anyway ("Ha, völlig berechtigt! 😄"),
 * which is unsurprising: the chat is the only one of the seven AI surfaces here
 * with no output-side check at all. `loadingInsightLint.ts` has enforced the
 * same rule in code, with a CI test behind it, since the insight agent shipped.
 *
 * This is deliberately narrow. Emoji are mechanically detectable and a regex
 * removing them cannot damage a sentence. The rest of the voice rules
 * (exclamation marks, interjections, apologies) stay prompt-side, because a
 * regex for those would mangle real writing — "3:30!" is not an exclamation and
 * "Ah" is a word.
 */

/**
 * A whole astral pair, or a BMP emoji / dingbat / arrow, or the variation
 * selector and zero-width joiner that glue sequences together.
 *
 * Matching the PAIR rather than the high surrogate alone matters: removing half
 * a pair leaves a lone low surrogate, which renders as a replacement character —
 * visibly worse than the emoji. Ranges mirror `loadingInsightLint.ts`; both
 * avoid the `u` flag because the project's TS target predates it.
 */
const EMOJI_GLOBAL_RE =
  /[\uD800-\uDBFF][\uDC00-\uDFFF]|[←-⇿⌀-➿⬀-⯿️‍]/g;

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
