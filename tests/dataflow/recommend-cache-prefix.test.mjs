// Offline regression guard for the /api/recommend prompt cache. Bundles the REAL
// recommendPrompt.ts with esbuild so the assertion tracks the actual cached prefix.
//
//   node --test tests/dataflow/recommend-cache-prefix.test.mjs
//
// Prompt caching only kicks in when the cached system prefix clears the model's
// minimum cacheable size — 4096 tokens for claude-opus-4-7. If a future edit trims
// SYSTEM_PROMPT below that, caching silently becomes a no-op (no error, no warning).
// Accurate token counting needs the API (see scripts/verify-recommend-cache.mjs +
// .github/workflows/verify-cache.yml); this is a cheap OFFLINE proxy — a character
// floor comfortably above the worst-case chars-for-4096-tokens, so a PR fails long
// before the prefix ever gets near the threshold.

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
export { SYSTEM_PROMPT, RECOMMEND_MODEL } from ${JSON.stringify(
  path.join(ROOT, "src/lib/claude/recommendPrompt.ts"),
)};
`;
const dir = await mkdtemp(join(tmpdir(), "rec-cache-"));
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

// 4096 tokens (claude-opus-4-7 minimum) × ~4.5 chars/token worst case ≈ 18.4k chars.
// Floor at 18000 with margin; the actual prompt is ~47k chars (~13k tokens) as of writing.
const CACHE_PREFIX_MIN_CHARS = 18000;

test("recommend SYSTEM_PROMPT stays well above the opus-4-7 cache minimum", () => {
  assert.ok(
    SYSTEM_PROMPT.length >= CACHE_PREFIX_MIN_CHARS,
    `SYSTEM_PROMPT is ${SYSTEM_PROMPT.length} chars; it must stay >= ${CACHE_PREFIX_MIN_CHARS} so the ` +
      `prompt cache (claude-opus-4-7 has a 4096-token minimum cacheable prefix) keeps hitting. ` +
      `If you intentionally shrank the prompt, run .github/workflows/verify-cache.yml to confirm ` +
      `it still caches, then adjust this floor.`,
  );
});

test("recommend model matches the one this cache floor is reasoned about", () => {
  // The 4096-token minimum above is specific to claude-opus-4-7. If the model
  // changes, re-check the new model's minimum cacheable prefix before trusting this guard.
  assert.equal(RECOMMEND_MODEL, "claude-opus-4-7");
});
