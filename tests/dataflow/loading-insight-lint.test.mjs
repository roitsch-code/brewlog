// Loading-insight gate tests. Bundles the REAL loadingInsightLint.ts AND the
// REAL COFFEE_HINTS seed with esbuild, so the test tracks the actual data.
//
//   node --test tests/dataflow/loading-insight-lint.test.mjs
//
// Two jobs:
//   1. Contract: every line in the static COFFEE_HINTS seed must satisfy the
//      mechanical rules (≤80 chars, ≤15 words, no emoji, no "!", unique). This
//      is the format contract the auto-refresh agent must also meet — if a new
//      hand-added seed line breaks it, CI fails here.
//   2. Gate behaviour: length / words / emoji / "!" / dedupe / source-grounding
//      all reject as intended (the grounding check is what keeps the slice-2
//      web source from smuggling unattributed specifics onto the screen).

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const entry = `
export { lintLoadingInsight, normalizeForDedupe, factualTokens, wordCount, MAX_CHARS, MAX_WORDS }
  from ${JSON.stringify(path.join(ROOT, "src/lib/insights/loadingInsightLint.ts"))};
export { COFFEE_HINTS } from ${JSON.stringify(path.join(ROOT, "src/lib/coffeeHints.ts"))};
`;
const dir = await mkdtemp(join(tmpdir(), "loading-insight-"));
const out = join(dir, "b.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const {
  lintLoadingInsight,
  normalizeForDedupe,
  factualTokens,
  COFFEE_HINTS,
  MAX_CHARS,
  MAX_WORDS,
} = await import(pathToFileURL(out).href);

test("static seed satisfies the mechanical contract", () => {
  assert.ok(COFFEE_HINTS.length > 0, "seed should not be empty");
  const seen = new Set();
  for (const line of COFFEE_HINTS) {
    // No sourceText — the seed is hand-verified; we only check format + dedupe.
    const { ok, reasons } = lintLoadingInsight(line, { existing: seen });
    assert.ok(ok, `seed line failed gate (${reasons.join(", ")}): ${line}`);
    seen.add(normalizeForDedupe(line));
  }
});

test("rejects over-length and over-word lines", () => {
  const long = "x".repeat(MAX_CHARS + 1);
  assert.ok(!lintLoadingInsight(long).ok);
  const wordy = Array.from({ length: MAX_WORDS + 1 }, () => "a").join(" ");
  assert.ok(!lintLoadingInsight(wordy).ok);
});

test("rejects emoji and exclamation marks", () => {
  assert.ok(lintLoadingInsight("Coffee is a fruit ☕").reasons.includes("emoji"));
  assert.ok(lintLoadingInsight("Coffee is a fruit!").reasons.includes("exclamation"));
});

test("dedupes case- and punctuation-insensitively", () => {
  const existing = new Set([normalizeForDedupe("Coffee is a fruit — the bean is its seed.")]);
  const dup = lintLoadingInsight("coffee is a fruit, the bean is its seed", { existing });
  assert.ok(dup.reasons.includes("duplicate"));
});

test("factualTokens flags mid-sentence proper nouns and numbers, not sentence starts", () => {
  // "Hendon" + "2014" must be caught; leading "Water" must NOT.
  const toks = factualTokens("Water chemistry: Hendon showed it in 2014.");
  assert.ok(toks.includes("Hendon"));
  assert.ok(toks.includes("2014"));
  assert.ok(!toks.includes("Water"));
});

test("grounding gate rejects a specific absent from the source, accepts one present", () => {
  const ungrounded = lintLoadingInsight("Hendon proved magnesium matters in 2014.", {
    sourceText: "Water chemistry shapes extraction.",
  });
  assert.ok(ungrounded.reasons.some((r) => r.startsWith("ungrounded:")));

  const grounded = lintLoadingInsight("Geisha made its name in Panama.", {
    sourceText: "Geisha came from Ethiopia and made its name in Panama in the 1960s.",
  });
  assert.ok(grounded.ok, `expected grounded line to pass: ${grounded.reasons.join(", ")}`);
});
