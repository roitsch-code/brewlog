// What /recommend actually SENDS to Anthropic — bundles the REAL
// src/lib/ai/recommendProvider.ts and captures the outgoing HTTP request body
// by stubbing global fetch under the SDK.
//
//   node --test tests/dataflow/recommend-request-shape.test.mjs
//
// WHY THIS EXISTS (2026-08-23). PR #541 added `temperature: 0.8` to the Opus
// call. `claude-opus-4-7` rejects that parameter outright —
//   400 invalid_request_error: "`temperature` is deprecated for this model."
// with `x-should-retry: false` — so EVERY recipe request 400'd from the
// 2026-08-21 deploy until 2026-08-23, and the client only ever showed its
// generic "Recommendation failed". Two days of a dead recipe generator from one
// line, because nothing on the way to production ever put a real request in
// front of the real API.
//
// HONEST SCOPE, so nobody mistakes this for more than it is: this test would
// NOT have caught the original break. It asserts a shape, and the shape was
// deliberate — only the live API knew the parameter was rejected. What it does
// is stop the parameter being re-added now that we know, which matters because
// the deleted code carried a persuasive written rationale for setting it.
// Catching the NEXT unknown-unknown of this class needs one real call after a
// deploy (see the smoke-test note in CLAUDE.md), not a unit test.

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const dir = await mkdtemp(join(tmpdir(), "recreq-"));
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

/**
 * Run one recommend call with fetch stubbed, and return the JSON body the SDK
 * put on the wire. The Anthropic SDK issues its request through global fetch,
 * so this captures the real serialized payload rather than a reconstruction.
 *
 * Called ONCE, at module load, and the result shared by every test below: the
 * provider memoizes its Anthropic client, and that client holds the `fetch` it
 * was constructed with — so a second stub installed by a second test is never
 * consulted and its capture stays null. (Found by running it, not by reasoning.)
 */
async function captureAnthropicRequestBody() {
  const realFetch = globalThis.fetch;
  let captured = null;
  globalThis.fetch = async (url, init = {}) => {
    captured = { url: String(url), body: JSON.parse(init.body ?? "{}") };
    return new Response(
      JSON.stringify({
        id: "msg_test",
        type: "message",
        role: "assistant",
        model: "claude-opus-4-7",
        content: [{ type: "text", text: "{}" }],
        stop_reason: "end_turn",
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  try {
    process.env.RECOMMEND_PROVIDER = "anthropic";
    process.env.ANTHROPIC_API_KEY = "test-key-not-real";
    await callRecommendModel("test user message");
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.ok(captured, "no request was issued");
  return captured;
}

const REQUEST = await captureAnthropicRequestBody();

test("the Opus recipe request carries NO temperature (the API rejects it)", async () => {
  const { body } = REQUEST;
  assert.equal(
    "temperature" in body,
    false,
    "`temperature` is deprecated for claude-opus-4-7: sending it 400s every recipe request. Do not re-add it.",
  );
});

test("it also sends no other sampling parameter that model could reject", async () => {
  const { body } = REQUEST;
  for (const key of ["top_p", "top_k"]) {
    assert.equal(
      key in body,
      false,
      `${key} is a sampling parameter — same deprecation class as temperature. Verify against the live API before adding one.`,
    );
  }
});

test("the request is still the real recommend call (model, cached system prompt)", async () => {
  const { url, body } = REQUEST;
  assert.match(url, /api\.anthropic\.com/);
  assert.equal(body.model, "claude-opus-4-7");
  assert.equal(body.max_tokens, 5000);
  // The system prompt must stay ONE cached block: the cache prefix is what keeps
  // this ~40k-token call affordable (see recommend-cache-prefix.test.mjs).
  assert.ok(Array.isArray(body.system) && body.system.length === 1);
  assert.equal(body.system[0].cache_control?.type, "ephemeral");
  assert.ok(body.system[0].text.length > 1000, "system prompt looks empty");
});

test("the source carries no temperature line for the Anthropic path", async () => {
  const src = await readFile(path.join(ROOT, "src/lib/ai/recommendProvider.ts"), "utf8");
  const anthropicFn = src.slice(
    src.indexOf("async function callAnthropic"),
    src.indexOf("async function callMistral"),
  );
  assert.ok(anthropicFn.length > 0, "callAnthropic not found — did the file get restructured?");
  assert.equal(
    /^\s*temperature:/m.test(anthropicFn),
    false,
    "callAnthropic must not set temperature — claude-opus-4-7 400s on it.",
  );
  // Mistral's own temperature is fine and deliberate — assert it survived, so a
  // careless sweep for "temperature" doesn't strip the parameter that works.
  const mistralFn = src.slice(src.indexOf("async function callMistral"));
  assert.ok(/temperature:\s*0\.5/.test(mistralFn), "Mistral's temperature: 0.5 was removed");
});
