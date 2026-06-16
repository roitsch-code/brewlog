// Deterministic gate for loading-screen insights.
//
// This is the machine reviewer that REPLACES a human reviewer on the
// auto-refreshed loading-insight pool (the user chose full-auto, no PR). It is
// the load-bearing reason an agent can write to that screen without breaking
// the "never fabricate" Hard Rule: a generated line only ships if it passes
// here AND a model claim-check.
//
// Pure module — no DB, no Anthropic, no Node-only APIs — so it is the SINGLE
// source of truth shared by:
//   • the refresh agent (src/app/api/loading-insights/refresh/route.ts) — full
//     gate incl. source-grounding,
//   • the GET read (src/app/api/loading-insights/route.ts) — defensive length,
//   • the screen merge (LightStepRecommend) — length floor,
//   • the CI test (tests/dataflow/loading-insight-lint.test.mjs) — asserts the
//     static COFFEE_HINTS seed satisfies the mechanical contract.

// The Fraunces-40 headline format. 80 chars / 15 words is the validated ceiling
// the static seed already lives within (its longest line is exactly 80 chars).
export const MAX_CHARS = 80;
export const MAX_WORDS = 15;

// Emoji / pictographic ranges (arrows, dingbats, misc symbols, the VS16
// selector, and any astral-plane char via its high surrogate — where the
// modern emoji live). Plain BMP ranges + a surrogate range so it works without
// the `u` flag (the project's TS target predates it). The brand forbids emoji.
const EMOJI_RE = /[\u2190-\u21FF\u2300-\u27BF\u2B00-\u2BFF\uFE0F\uD800-\uDBFF]/;

export function wordCount(s: string): number {
  const t = s.trim();
  return t === "" ? 0 : t.split(/\s+/).length;
}

export function hasEmoji(s: string): boolean {
  return EMOJI_RE.test(s);
}

// Normalized key for dedup — case- and punctuation-insensitive.
export function normalizeForDedupe(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Tokens in a line that assert a checkable specific — and therefore must be
// present in the cited source for the line to count as grounded:
//   • anything containing a digit (years, ppm, °C, ratios, percentages), and
//   • a capitalized word that is NOT sentence-initial (a proper noun mid-line:
//     a person, place, cultivar, roaster).
// Sentence-initial capitals are ordinary English and exempt. This is what
// stops the (slice-2) web source from smuggling an attributed specific
// ("Hendon's 2014 paper…") onto the screen unless a fetched source backs it.
// ASCII-based (no `u` flag / `\p{}` — see the TS-target note on EMOJI_RE). This
// means a proper noun opening with a non-ASCII capital (Š, É) isn't flagged —
// an acceptable under-catch; the model claim-check + the "prefer general, avoid
// names" generation prompt are the other two layers. Only `.!?` reset the
// sentence (a colon often precedes the very name we want to check).
export function factualTokens(line: string): string[] {
  const out: string[] = [];
  let sentenceStart = true;
  for (const raw of line.split(/\s+/)) {
    if (raw === "") continue;
    const w = raw.replace(/^[^A-Za-z0-9]+/, "").replace(/[^A-Za-z0-9%°]+$/, "");
    if (w !== "") {
      if (/\d/.test(w)) out.push(w);
      else if (!sentenceStart && /^[A-Z][a-z]/.test(w)) out.push(w);
    }
    sentenceStart = /[.!?]$/.test(raw);
  }
  return out;
}

export interface LintOptions {
  // When provided, every factual token in the line must appear in this text
  // (the cited source). Omit for the hand-verified static seed.
  sourceText?: string;
  // When provided, a line whose normalized form is already present is rejected.
  existing?: Set<string>;
}

export interface LintResult {
  ok: boolean;
  reasons: string[];
}

export function lintLoadingInsight(line: string, opts: LintOptions = {}): LintResult {
  const reasons: string[] = [];
  const trimmed = line.trim();

  if (trimmed === "") reasons.push("empty");
  if (trimmed.length > MAX_CHARS) reasons.push(`too-long:${trimmed.length}`);
  if (wordCount(trimmed) > MAX_WORDS) reasons.push(`too-many-words:${wordCount(trimmed)}`);
  if (hasEmoji(trimmed)) reasons.push("emoji");
  if (trimmed.includes("!")) reasons.push("exclamation");

  if (opts.existing && opts.existing.has(normalizeForDedupe(trimmed))) {
    reasons.push("duplicate");
  }

  if (opts.sourceText !== undefined) {
    const src = opts.sourceText.toLowerCase();
    for (const tok of factualTokens(trimmed)) {
      if (!src.includes(tok.toLowerCase())) reasons.push(`ungrounded:${tok}`);
    }
  }

  return { ok: reasons.length === 0, reasons };
}
