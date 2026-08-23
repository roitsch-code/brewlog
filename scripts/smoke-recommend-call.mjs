// LIVE smoke test for the /recommend model call.
//
//   node scripts/smoke-recommend-call.mjs
//
// WHY THIS EXISTS. On 2026-08-21 a single added parameter (`temperature: 0.8`)
// made claude-opus-4-7 reject EVERY recipe request with
//   400 invalid_request_error: "`temperature` is deprecated for this model."
// and /recommend stayed dead for two days while tsc, 383 tests, CI and the
// deploy were all green. No offline gate can see that class of break: the
// request is well-typed and well-formed, and only the live API knows the
// parameter is refused.
//
// The existing scripts/verify-recommend-cache.mjs does NOT cover it — it builds
// its own messages.create and so never sends what the app sends. This one calls
// the app's REAL callRecommendModel, so whatever the app puts on the wire is
// what gets validated: model id, parameters, system-block shape, key, quota.
//
// Costs one Opus call (~$0.20) per run. Run it after any change to a model call
// — parameters, model id, provider, prompt structure — and before assuming a
// recipe still generates.

import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

if (!process.env.ANTHROPIC_API_KEY) {
  console.log("ANTHROPIC_API_KEY not set — skipping live smoke test (not a failure).");
  process.exit(0);
}
// Pin the provider so the smoke test checks the path production actually uses
// (Opus by default) rather than silently drifting to Mistral.
process.env.RECOMMEND_PROVIDER = process.env.RECOMMEND_PROVIDER || "anthropic";

const ROOT = process.cwd();
const dir = await mkdtemp(join(tmpdir(), "recsmoke-"));
const out = join(dir, "p.mjs");
await build({
  stdin: {
    contents: `export { callRecommendModel } from ${JSON.stringify(
      path.join(ROOT, "src/lib/ai/recommendProvider.ts"),
    )};`,
    resolveDir: ROOT,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { callRecommendModel } = await import(pathToFileURL(out).href);

// A real, minimal turn. Deliberately terse: this checks that the CALL is
// accepted and comes back usable, not that the recipe is good — recipe quality
// is measured by scripts/recommend-variety-sim.mjs.
const userMessage = `COFFEE: Friedhats — Quiquira (Colombia, Washed, Pink Bourbon, light roast, roasted 10 days ago)
CONTEXT: occasion morning-ritual, goal balanced, 350ml, time normal, grinder Niche Zero, equipment V60.
Return the JSON object described in the system prompt: 2 candidates.`;

console.log(`provider: ${process.env.RECOMMEND_PROVIDER}`);
const started = Date.now();
let result;
try {
  result = await callRecommendModel(userMessage);
} catch (err) {
  console.error("\nFAIL — the model call was REJECTED. This is the outage class this script exists for.");
  console.error(`  ${String(err?.message ?? err).slice(0, 600)}`);
  process.exit(1);
}
const elapsed = ((Date.now() - started) / 1000).toFixed(1);

console.log(`ok    responded in ${elapsed}s via ${result.provider}`);
console.log(`usage input=${result.usage.input_tokens} output=${result.usage.output_tokens}`);

if (!result.text || result.usage.output_tokens === 0) {
  console.error("FAIL — the call succeeded but returned no content.");
  process.exit(1);
}

// Informational, NOT the gate: a terse prompt can legitimately produce a
// response that misses the full schema. The gate is "the API accepted the
// request and answered"; schema conformance on real turns is covered offline.
let shape = "unparseable (informational only)";
try {
  const m = result.text.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(m ? m[0] : result.text);
  const n = Array.isArray(parsed.candidates) ? parsed.candidates.length : 0;
  shape = `parsed JSON, ${n} candidate(s)`;
} catch {}
console.log(`shape ${shape}`);

console.log("\nPASS — /recommend's live model call works.");
