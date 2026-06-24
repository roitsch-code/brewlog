// Empirical prompt-cache verification for /api/recommend.
//
//   ANTHROPIC_API_KEY=... node scripts/verify-recommend-cache.mjs
//
// Runs via .github/workflows/verify-cache.yml (workflow_dispatch) using the
// ANTHROPIC_API_KEY repo secret — the run log IS the proof. Bundles the REAL
// recommendPrompt.ts with esbuild (the exact prefix production sends), counts the
// prefix tokens, then fires two messages.create calls with the SAME cached system
// block and a DIFFERENT user turn each time, and checks the 2nd call READS the
// cache. The offline guard tests/dataflow/recommend-cache-prefix.test.mjs protects
// the prefix size on every PR; this is the on-demand live confirmation.

import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";

const OPUS_47_CACHE_MIN_TOKENS = 4096; // claude-opus-4-7 minimum cacheable prefix

if (!process.env.ANTHROPIC_API_KEY) {
  console.log("SKIPPED — ANTHROPIC_API_KEY is not set.");
  console.log(
    "Add an ANTHROPIC_API_KEY repo secret (Settings → Secrets and variables → Actions) " +
      "and re-run this workflow to verify caching live.",
  );
  process.exit(0);
}

// --- bundle the REAL prompt module (avoids recommend.ts's heavy import graph) ---
const ROOT = process.cwd();
const entry = `
export { SYSTEM_PROMPT, RECOMMEND_MODEL } from ${JSON.stringify(
  path.join(ROOT, "src/lib/claude/recommendPrompt.ts"),
)};
`;
const dir = await mkdtemp(join(tmpdir(), "rec-cache-verify-"));
const out = join(dir, "b.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { SYSTEM_PROMPT, RECOMMEND_MODEL } = await import(pathToFileURL(out).href);

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Exactly what recommend.ts sends: one static system block with the breakpoint.
const systemBlock = [
  { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
];

const fmt = (x) =>
  `input=${x.input_tokens} ` +
  `cache_creation=${x.cache_creation_input_tokens ?? 0} ` +
  `cache_read=${x.cache_read_input_tokens ?? 0} ` +
  `output=${x.output_tokens}`;

// --- 0) prefix token count vs the cache minimum ---
const counted = await client.messages.countTokens({
  model: RECOMMEND_MODEL,
  system: [{ type: "text", text: SYSTEM_PROMPT }],
  messages: [{ role: "user", content: "x" }],
});
const aboveMin = counted.input_tokens >= OPUS_47_CACHE_MIN_TOKENS;
console.log(`Model: ${RECOMMEND_MODEL}`);
console.log(
  `System-prefix tokens: ${counted.input_tokens}  ` +
    `(cache minimum for ${RECOMMEND_MODEL}: ${OPUS_47_CACHE_MIN_TOKENS})`,
);
console.log(
  aboveMin
    ? "  → clears the cache minimum"
    : "  → BELOW the minimum: caching is a silent no-op",
);

// --- 1) two sequential calls: same system prefix, different user turn each ---
const call = async (probe) => {
  const res = await client.messages.create({
    model: RECOMMEND_MODEL,
    max_tokens: 16,
    system: systemBlock,
    messages: [{ role: "user", content: probe }],
  });
  return res.usage;
};

console.log("\nCall 1 (writes the cache)…");
const u1 = await call("Cache-verification probe A. Reply with the single word: ok.");
console.log("  usage:", fmt(u1));

console.log("Call 2 (different user turn — should READ the cache)…");
const u2 = await call(
  "Cache-verification probe B, a deliberately different user turn. Reply with: ok.",
);
console.log("  usage:", fmt(u2));

// --- 2) verdict ---
const wrote = (u1.cache_creation_input_tokens ?? 0) > 0;
const read =
  (u2.cache_read_input_tokens ?? 0) > 0 &&
  (u2.cache_creation_input_tokens ?? 0) === 0;

console.log("\n=== VERDICT ===");
console.log(`Call 1 wrote the cache (cache_creation > 0):              ${wrote ? "yes" : "no"}`);
console.log(`Call 2 read the cache (cache_read > 0, cache_creation 0): ${read ? "yes" : "no"}`);

if (wrote && read) {
  console.log(
    "\nPASS — the recommendation system prompt is cached and reused across calls.",
  );
  process.exit(0);
}
if (!aboveMin) {
  console.log(
    "\nFAIL — the system prefix is below the cache minimum. The fix (enlarging it) " +
      "changes the prompt wording, so it needs owner sign-off; do not do it silently.",
  );
  process.exit(1);
}
console.log("\nFAIL — caching did not behave as expected; inspect the usage lines above.");
process.exit(1);
