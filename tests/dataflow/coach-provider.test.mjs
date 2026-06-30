// Coach-provider selection tests — bundles the REAL src/lib/ai/coachProvider.ts
// with esbuild so the test tracks the actual selection rule. This guards the
// load-bearing safety property of the Opus→Mistral coach migration: with no
// coach key the coach MUST stay on Opus (deploying the code can never break it),
// and COACH_PROVIDER force-overrides either way (instant rollback).
//
//   node --test tests/dataflow/coach-provider.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const entry = `export { selectCoachProvider } from ${JSON.stringify(
  path.join(ROOT, "src/lib/ai/coachProvider.ts"),
)};`;
const dir = await mkdtemp(join(tmpdir(), "coach-"));
const out = join(dir, "b.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { selectCoachProvider } = await import(pathToFileURL(out).href);

function withEnv(env, fn) {
  const saved = {
    COACH_PROVIDER: process.env.COACH_PROVIDER,
    MISTRAL_COACH_API_KEY: process.env.MISTRAL_COACH_API_KEY,
  };
  for (const k of Object.keys(saved)) delete process.env[k];
  Object.assign(process.env, env);
  try {
    return fn();
  } finally {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

test("no coach key → Opus (deploying the code can't break the coach)", () => {
  withEnv({}, () => assert.equal(selectCoachProvider(), "anthropic"));
});

test("coach key present → Mistral (auto)", () => {
  withEnv({ MISTRAL_COACH_API_KEY: "sk-coach" }, () =>
    assert.equal(selectCoachProvider(), "mistral"),
  );
});

test("COACH_PROVIDER=anthropic forces Opus even with a key (rollback lever)", () => {
  withEnv({ MISTRAL_COACH_API_KEY: "sk-coach", COACH_PROVIDER: "anthropic" }, () =>
    assert.equal(selectCoachProvider(), "anthropic"),
  );
});

test("COACH_PROVIDER=mistral forces Mistral even with no key", () => {
  withEnv({ COACH_PROVIDER: "mistral" }, () =>
    assert.equal(selectCoachProvider(), "mistral"),
  );
});

test("COACH_PROVIDER is case/space tolerant", () => {
  withEnv({ COACH_PROVIDER: "  ANTHROPIC  ", MISTRAL_COACH_API_KEY: "sk-coach" }, () =>
    assert.equal(selectCoachProvider(), "anthropic"),
  );
});

test("an unknown COACH_PROVIDER value falls through to auto-detect", () => {
  withEnv({ COACH_PROVIDER: "gpt", MISTRAL_COACH_API_KEY: "sk-coach" }, () =>
    assert.equal(selectCoachProvider(), "mistral"),
  );
  withEnv({ COACH_PROVIDER: "gpt" }, () =>
    assert.equal(selectCoachProvider(), "anthropic"),
  );
});
