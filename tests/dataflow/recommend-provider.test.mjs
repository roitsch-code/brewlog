// Which model answers /recommend — bundles the REAL src/lib/ai/recommendProvider.ts
// so the test tracks the actual rule, not a copy of it.
//
//   node --test tests/dataflow/recommend-provider.test.mjs
//
// The default was reversed in Aug 2026: /recommend is back on Opus, and Mistral
// is opt-in. The property worth pinning is that the DEFAULT no longer depends on
// whether a Mistral key happens to be in the environment — that was the old
// rule, and leaving it in place would have meant the rollback silently undoing
// itself the moment the key was present, which it still is (deliberately, so
// flipping back is one env var and not a re-key).
//
// Sibling of coach-provider.test.mjs, which pins the opposite default for the
// coach — they are separate decisions on separate surfaces and must not drift
// into each other.

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const dir = await mkdtemp(join(tmpdir(), "recprov-"));
const out = join(dir, "p.mjs");
await build({
  stdin: {
    contents: `export { selectProvider } from ${JSON.stringify(path.join(ROOT, "src/lib/ai/recommendProvider.ts"))};`,
    resolveDir: ROOT,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { selectProvider } = await import(pathToFileURL(out).href);

function withEnv(env, fn) {
  const saved = {
    RECOMMEND_PROVIDER: process.env.RECOMMEND_PROVIDER,
    MISTRAL_API_KEY: process.env.MISTRAL_API_KEY,
  };
  for (const k of Object.keys(saved)) delete process.env[k];
  Object.assign(process.env, env);
  try {
    fn();
  } finally {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

test("with no override the answer is Opus, key present or not", () => {
  // The load-bearing one. The VPS still carries MISTRAL_API_KEY on purpose, so
  // if presence-of-key still selected, the rollback would be a no-op there.
  withEnv({ MISTRAL_API_KEY: "sk-live-key-is-present" }, () => {
    assert.equal(selectProvider(), "anthropic");
  });
  withEnv({}, () => {
    assert.equal(selectProvider(), "anthropic");
  });
});

test("Mistral is reachable, but only by asking for it", () => {
  withEnv({ RECOMMEND_PROVIDER: "mistral", MISTRAL_API_KEY: "k" }, () => {
    assert.equal(selectProvider(), "mistral");
  });
  // Case and stray whitespace shouldn't silently drop an intended override.
  withEnv({ RECOMMEND_PROVIDER: "  MISTRAL  ", MISTRAL_API_KEY: "k" }, () => {
    assert.equal(selectProvider(), "mistral");
  });
});

test("an explicit anthropic override still works", () => {
  withEnv({ RECOMMEND_PROVIDER: "anthropic", MISTRAL_API_KEY: "k" }, () => {
    assert.equal(selectProvider(), "anthropic");
  });
});

test("an unrecognised value falls to the default rather than throwing", () => {
  withEnv({ RECOMMEND_PROVIDER: "gpt", MISTRAL_API_KEY: "k" }, () => {
    assert.equal(selectProvider(), "anthropic");
  });
  withEnv({ RECOMMEND_PROVIDER: "" }, () => {
    assert.equal(selectProvider(), "anthropic");
  });
});
