// Drip-Assist guard tests — bundles the REAL src/lib/utils/dripAssist.ts with
// esbuild so the test tracks the actual rule. This is the deterministic
// backstop /recommend applies after generation: "V60 + Drip Assist" is the
// owner's emergency/travel-only brewer and must NEVER be surfaced proactively
// (CLAUDE.md). The Opus→Mistral swap (issue #453) made the prompt's soft ban
// less reliable, so this guard enforces it deterministically.
//
//   node --test tests/dataflow/drip-assist-guard.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const entry = `export { isDripAssistMethod, stripProactiveDripAssist } from ${JSON.stringify(
  path.join(ROOT, "src/lib/utils/dripAssist.ts"),
)};`;
const dir = await mkdtemp(join(tmpdir(), "dripassist-"));
const out = join(dir, "b.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { isDripAssistMethod, stripProactiveDripAssist } = await import(
  pathToFileURL(out).href
);

test("isDripAssistMethod matches any Drip Assist spelling", () => {
  assert.equal(isDripAssistMethod("V60 + Drip Assist"), true);
  assert.equal(isDripAssistMethod("V60 + Drip-Assist"), true);
  assert.equal(isDripAssistMethod("drip assist"), true);
  assert.equal(isDripAssistMethod("V60"), false);
  assert.equal(isDripAssistMethod("AeroPress"), false);
  assert.equal(isDripAssistMethod(undefined), false);
});

test("unlocked: a leaked Drip Assist candidate is dropped, the clean one kept", () => {
  const out = stripProactiveDripAssist(
    [
      { method: "V60 + Drip Assist", title: "Slow-flow probe" },
      { method: "V60", title: "Clean V60" },
    ],
    false,
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].method, "V60");
  assert.equal(out[0].title, "Clean V60");
});

test("unlocked: when EVERY candidate is Drip Assist, relabel to V60 (never empty)", () => {
  const out = stripProactiveDripAssist(
    [
      { method: "V60 + Drip Assist", title: "A" },
      { method: "V60 + Drip Assist", title: "B" },
    ],
    false,
  );
  assert.equal(out.length, 2);
  assert.deepEqual(
    out.map((c) => c.method),
    ["V60", "V60"],
  );
});

test("locked: Drip Assist is honored verbatim (user explicitly chose it)", () => {
  const input = [
    { method: "V60 + Drip Assist", title: "Locked" },
    { method: "V60", title: "Alt" },
  ];
  const out = stripProactiveDripAssist(input, true);
  assert.deepEqual(out, input);
});

test("unlocked: a normal portfolio is returned untouched", () => {
  const input = [
    { method: "V60", title: "A" },
    { method: "AeroPress", title: "B" },
  ];
  const out = stripProactiveDripAssist(input, false);
  assert.deepEqual(out, input);
});
